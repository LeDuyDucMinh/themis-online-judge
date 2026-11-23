import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { ExamCountdown, ExamBackgroundType, ExamExpireBehavior } from '../../types/judge';
import {
  ExamCountdownCard,
  EXAM_COLOR_SWATCHES,
  computeExamState,
  formatExamCompactTimeVN,
  isLightHexColor,
  normalizeHexColor,
  sortExamCountdowns,
} from '../common/ExamCountdownCard';
import { Loader2 } from 'lucide-react';

const MAX_BG_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

async function processExamBgImage(file: File): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.');
  }
  if (file.size > MAX_BG_IMAGE_BYTES) {
    throw new Error(
      `Ảnh nặng ${(file.size / (1024 * 1024)).toFixed(2)} MB, vượt giới hạn tối đa 2 MB.`
    );
  }
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });

  if (file.size <= 160 * 1024) return rawDataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File ảnh bị hỏng hoặc không thể giải mã.'));
      el.src = rawDataUrl;
    });
    const maxW = 1400;
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    const webp = canvas.toDataURL('image/webp', 0.84);
    if (webp.startsWith('data:image/webp') && webp.length < rawDataUrl.length) return webp;
    const jpeg = canvas.toDataURL('image/jpeg', 0.84);
    return jpeg.length < rawDataUrl.length ? jpeg : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

function getDefaultFutureDateIso(daysAhead = 30): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ExamDraft {
  id: string | null;
  title: string;
  note: string;
  examDate: string;
  examTime: string;
  bgType: ExamBackgroundType;
  bgColor: string;
  bgImageUrl?: string;
  audienceClassId: string;
  expireBehavior: ExamExpireBehavior;
  isActive: boolean;
}

export const ExamCountdownManager: React.FC = () => {
  const {
    examCountdowns,
    saveExamCountdowns,
    classes,
    showToast,
    openConfirmModal,
  } = useJudge();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sortedExams = useMemo(
    () => sortExamCountdowns(examCountdowns, nowMs),
    [examCountdowns, Math.floor(nowMs / 10000)] // Tránh sort lại mỗi giây, chỉ đổi thứ tự khi qua mốc
  );

  const buildDraftFromExam = (e: ExamCountdown): ExamDraft => ({
    id: e.id,
    title: e.title || '',
    note: e.note || '',
    examDate: e.examDate || getDefaultFutureDateIso(30),
    examTime: e.examTime || '07:30',
    bgType: e.bgType || 'color',
    bgColor: normalizeHexColor(e.bgColor || '#1F1D1A'),
    bgImageUrl: e.bgImageUrl,
    audienceClassId: e.audienceClassId || 'ALL',
    expireBehavior: e.expireBehavior || 'ongoing_1d',
    isActive: e.isActive !== false,
  });

  const buildEmptyDraft = (idx = 0): ExamDraft => ({
    id: null,
    title: '',
    note: '',
    examDate: getDefaultFutureDateIso(30),
    examTime: '07:30',
    bgType: 'color',
    bgColor: EXAM_COLOR_SWATCHES[idx % EXAM_COLOR_SWATCHES.length],
    bgImageUrl: undefined,
    audienceClassId: 'ALL',
    expireBehavior: 'ongoing_1d',
    isActive: true,
  });

  const [selectedId, setSelectedId] = useState<string | 'NEW' | null>(() =>
    sortedExams[0]?.id || 'NEW'
  );
  const [draft, setDraft] = useState<ExamDraft>(() =>
    sortedExams[0] ? buildDraftFromExam(sortedExams[0]) : buildEmptyDraft(0)
  );
  const [hexInput, setHexInput] = useState<string>(() =>
    sortedExams[0] ? normalizeHexColor(sortedExams[0].bgColor) : '#1F1D1A'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  useEffect(() => {
    if (selectedId === 'NEW') return;
    if (selectedId && sortedExams.some((e) => e.id === selectedId)) return;
    if (sortedExams.length > 0) {
      setSelectedId(sortedExams[0].id);
      const d = buildDraftFromExam(sortedExams[0]);
      setDraft(d);
      setHexInput(d.bgColor);
    } else {
      setSelectedId('NEW');
      const d = buildEmptyDraft(0);
      setDraft(d);
      setHexInput(d.bgColor);
    }
  }, [sortedExams.length]);

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.id, c.className));
    return m;
  }, [classes]);

  const getAudienceLabel = (audienceClassId: string): string => {
    if (!audienceClassId || audienceClassId === 'ALL') return 'Tất cả học sinh';
    const name = classMap.get(audienceClassId);
    return name ? `Lớp ${name}` : 'Lớp đã chọn';
  };

  const handleSelectEdit = (exam: ExamCountdown) => {
    setSelectedId(exam.id);
    const d = buildDraftFromExam(exam);
    setDraft(d);
    setHexInput(d.bgColor);
  };

  const handleStartAddNew = () => {
    setSelectedId('NEW');
    const d = buildEmptyDraft(sortedExams.length);
    setDraft(d);
    setHexInput(d.bgColor);
  };

  const handlePickBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingImg(true);
    try {
      const dataUrl = await processExamBgImage(file);
      setDraft((prev) => ({ ...prev, bgType: 'image', bgImageUrl: dataUrl }));
    } catch (err: unknown) {
      showToast('Không thể tải ảnh nền', (err as Error)?.message || 'Lỗi đọc file ảnh', 'error');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleToggleActive = async (exam: ExamCountdown) => {
    setIsSaving(true);
    try {
      const next = examCountdowns.map((item) =>
        item.id === exam.id
          ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() }
          : item
      );
      await saveExamCountdowns(next);
      if (selectedId === exam.id) {
        setDraft((prev) => ({ ...prev, isActive: !exam.isActive }));
      }
      showToast(
        exam.isActive ? 'Đã ẩn kỳ thi' : 'Đã hiện kỳ thi',
        `Kỳ thi "${exam.title}" đã chuyển sang trạng thái ${exam.isActive ? 'Đang ẩn' : 'Đang hiện'}.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Lỗi cập nhật', (err as Error)?.message || 'Không thể lưu lên Cloud', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = (exam: ExamCountdown) => {
    openConfirmModal({
      title: 'Xóa kỳ thi đếm ngược',
      message: `Bạn có chắc chắn muốn xóa kỳ thi "${exam.title}" khỏi trang chủ học sinh không?`,
      confirmLabel: 'Xóa kỳ thi',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          const remaining = examCountdowns.filter((item) => item.id !== exam.id);
          await saveExamCountdowns(remaining);
          if (selectedId === exam.id) {
            const nextSorted = sortExamCountdowns(remaining, Date.now());
            if (nextSorted.length > 0) {
              setSelectedId(nextSorted[0].id);
              const d = buildDraftFromExam(nextSorted[0]);
              setDraft(d);
              setHexInput(d.bgColor);
            } else {
              setSelectedId('NEW');
              const d = buildEmptyDraft(0);
              setDraft(d);
              setHexInput(d.bgColor);
            }
          }
          showToast('Đã xóa kỳ thi', `Đã xóa "${exam.title}".`, 'info');
        } catch (err: unknown) {
          showToast('Lỗi xóa kỳ thi', (err as Error)?.message || 'Không thể xóa trên Cloud', 'error');
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = draft.title.trim();
    if (!cleanTitle) {
      showToast('Thiếu tên kỳ thi', 'Vui lòng nhập Tên kỳ thi trước khi lưu.', 'warning');
      return;
    }
    if (!draft.examDate) {
      showToast('Thiếu ngày thi', 'Vui lòng chọn Ngày thi.', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const safeColor = normalizeHexColor(draft.bgColor);
    const isCreating = selectedId === 'NEW' || !draft.id;

    let nextList: ExamCountdown[];
    let savedId: string;

    if (isCreating) {
      savedId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newExam: ExamCountdown = {
        id: savedId,
        title: cleanTitle,
        note: draft.note.trim() || undefined,
        examDate: draft.examDate,
        examTime: draft.examTime || '07:30',
        bgType: draft.bgType,
        bgColor: safeColor,
        bgImageUrl: draft.bgType === 'image' ? draft.bgImageUrl : undefined,
        audienceClassId: draft.audienceClassId || 'ALL',
        expireBehavior: draft.expireBehavior,
        isActive: draft.isActive,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextList = [...examCountdowns, newExam];
    } else {
      savedId = draft.id!;
      nextList = examCountdowns.map((item) =>
        item.id === savedId
          ? {
              ...item,
              title: cleanTitle,
              note: draft.note.trim() || undefined,
              examDate: draft.examDate,
              examTime: draft.examTime || '07:30',
              bgType: draft.bgType,
              bgColor: safeColor,
              bgImageUrl: draft.bgType === 'image' ? draft.bgImageUrl : undefined,
              audienceClassId: draft.audienceClassId || 'ALL',
              expireBehavior: draft.expireBehavior,
              isActive: draft.isActive,
              updatedAt: nowIso,
            }
          : item
      );
    }

    setIsSaving(true);
    try {
      const savedList = await saveExamCountdowns(nextList);
      setSelectedId(savedId);
      const savedObj = savedList.find((x) => x.id === savedId);
      if (savedObj) {
        const d = buildDraftFromExam(savedObj);
        setDraft(d);
        setHexInput(d.bgColor);
      }
      showToast(
        isCreating ? 'Đã thêm kỳ thi mới' : 'Đã lưu thay đổi',
        `Bộ đếm ngược "${cleanTitle}" đã được cập nhật lên trang chủ học sinh.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Lỗi lưu kỳ thi', (err as Error)?.message || 'Không thể lưu lên Cloud', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedId === 'NEW') {
      if (sortedExams.length > 0) {
        handleSelectEdit(sortedExams[0]);
      } else {
        const d = buildEmptyDraft(0);
        setDraft(d);
        setHexInput(d.bgColor);
      }
      return;
    }
    const orig = sortedExams.find((x) => x.id === selectedId);
    if (orig) handleSelectEdit(orig);
  };

  const editingIdx =
    selectedId && selectedId !== 'NEW'
      ? sortedExams.findIndex((x) => x.id === selectedId)
      : -1;
  const editingObj = editingIdx >= 0 ? sortedExams[editingIdx] : null;

  return (
    <div
      className="banner-editorial-page max-w-[1060px] mx-auto pb-12 text-[#1F1D1A]"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-[28px] font-bold tracking-tight text-[#1F1D1A] leading-tight"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            Đếm ngược kỳ thi
          </h2>
          <p className="text-[13.5px] text-[#6B655C] mt-1.5 max-w-[540px] leading-relaxed">
            Các kỳ thi hiện ở trang chủ học sinh, đếm ngược theo giờ thật. Bạn chọn tên, ngày giờ và màu nền cho từng kỳ thi.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartAddNew}
          className="px-4 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13.5px] font-semibold transition-colors cursor-pointer shrink-0"
        >
          + Thêm kỳ thi
        </button>
      </div>

      {/* Bảng danh sách kỳ thi */}
      <p className="text-[12.5px] text-[#6B655C] mb-2.5">
        Kỳ thi sắp diễn ra nhất hiện đầu tiên. Kỳ thi đã qua tự ẩn.
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[42px_138px_minmax(190px,1.5fr)_135px_135px_125px] items-center gap-4 py-2.5 px-3 border-t-[1.5px] border-t-[#1F1D1A] border-b border-b-[#DDD6C7] text-[12.5px] font-medium text-[#6B655C]">
            <span>#</span>
            <span>Màu nền</span>
            <span>Tên và giờ thi</span>
            <span>Hiện cho</span>
            <span>Trạng thái</span>
            <span className="text-right" />
          </div>

          {sortedExams.length === 0 ? (
            <div className="py-10 px-4 text-center border-b border-[#E5DFD3] text-[13.5px] text-[#6B655C]">
              Chưa có kỳ thi nào. Hãy điền thông tin ở khung bên dưới rồi bấm{' '}
              <b className="text-[#1F1D1A]">Thêm kỳ thi</b> để hiển thị bộ đếm ngược cho học sinh.
            </div>
          ) : (
            <div>
              {sortedExams.map((exam, idx) => {
                const isSelected = selectedId === exam.id;
                const state = computeExamState(exam, nowMs);
                const isExpired = state.phase === 'expired';
                const useImgThumb = exam.bgType === 'image' && Boolean(exam.bgImageUrl) && !isExpired;
                const pillBg = isExpired ? '#8C8275' : normalizeHexColor(exam.bgColor);
                const pillTextColor = useImgThumb || !isLightHexColor(pillBg) ? '#FFFFFF' : '#1F1D1A';

                return (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectEdit(exam)}
                    className={`grid grid-cols-[42px_138px_minmax(190px,1.5fr)_135px_135px_125px] items-center gap-4 py-3.5 px-3 border-b border-[#E5DFD3] transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#ECE5D6]' : 'hover:bg-[#F3EEE2]'
                    }`}
                  >
                    <span className="font-mono text-[13.5px] text-[#6B655C]">{idx + 1}</span>

                    {/* Pill màu nền + số ngày còn lại */}
                    <div
                      className="w-[116px] h-[28px] rounded-md px-2.5 flex items-center text-[11.5px] font-semibold truncate relative overflow-hidden"
                      style={{
                        backgroundColor: pillBg,
                        backgroundImage: useImgThumb ? `url("${exam.bgImageUrl}")` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        color: pillTextColor,
                      }}
                    >
                      {useImgThumb && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-black/50"
                        />
                      )}
                      <span className="relative z-10 truncate">{state.pillLabel}</span>
                    </div>

                    {/* Tên và giờ thi */}
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[#1F1D1A] truncate">
                        {exam.title}
                      </div>
                      <div className="text-[12px] text-[#6B655C] truncate mt-0.5 font-mono">
                        {formatExamCompactTimeVN(exam.examDate, exam.examTime)}
                      </div>
                    </div>

                    {/* Hiện cho */}
                    <div className="text-[13px] text-[#1F1D1A] truncate">
                      {getAudienceLabel(exam.audienceClassId)}
                    </div>

                    {/* Trạng thái */}
                    <div className="flex items-center gap-1.5 text-[13px]">
                      {isExpired ? (
                        <>
                          <span className="w-2 h-2 rounded-[2px] border border-[#8A8277] shrink-0" />
                          <span className="text-[#6B655C]">Đã qua, tự ẩn</span>
                        </>
                      ) : !exam.isActive ? (
                        <>
                          <span className="w-2 h-2 rounded-[2px] border border-[#8A8277] shrink-0" />
                          <span className="text-[#6B655C]">Đang ẩn</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-[2px] bg-[#2E7D32] shrink-0" />
                          <span className="font-semibold text-[#2E7D32]">
                            {state.phase === 'ongoing' ? 'Đang diễn ra' : 'Đang đếm'}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Thao tác */}
                    <div
                      className="flex items-center justify-end gap-3.5 text-[13px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectEdit(exam)}
                        className="text-[#6B655C] hover:text-[#1F1D1A] font-medium cursor-pointer transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleToggleActive(exam)}
                        className="text-[#6B655C] hover:text-[#1F1D1A] font-medium cursor-pointer transition-colors disabled:opacity-40"
                      >
                        {exam.isActive ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleDeleteExam(exam)}
                        className="text-[#6B655C] hover:text-[#B4281F] font-medium cursor-pointer transition-colors disabled:opacity-40"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Khung sửa / thêm kỳ thi */}
      <form
        onSubmit={handleSaveDraft}
        className="mt-7 bg-white border border-[#D9D2C3] rounded-2xl p-6 sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <h3
            className="text-[17px] font-bold text-[#1F1D1A]"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {editingIdx >= 0 ? `Sửa kỳ thi số ${editingIdx + 1}` : 'Thêm kỳ thi mới'}
          </h3>
          <span className="text-[13px] text-[#6B655C] truncate max-w-[260px]">
            {draft.title.trim() || 'Chưa đặt tên'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-7 mt-5">
          {/* Cột trái: Xem trước trực tiếp */}
          <div>
            <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2.5">
              Xem trước, học sinh thấy thế này
            </label>

            <ExamCountdownCard
              exam={{
                title: draft.title || 'Thi HSG cấp huyện',
                note: draft.note,
                examDate: draft.examDate,
                examTime: draft.examTime,
                bgType: draft.bgType,
                bgColor: draft.bgColor,
                bgImageUrl: draft.bgImageUrl,
                expireBehavior: draft.expireBehavior,
                isActive: draft.isActive,
              }}
              nowMs={nowMs}
              compact
            />

            <p className="text-[12px] text-[#6B655C] mt-3 leading-relaxed">
              Các số tự đếm lùi theo giờ Việt Nam. Dưới 1 ngày thì đổi thành &quot;Hôm nay thi&quot; cho dễ nhớ.
            </p>
          </div>

          {/* Cột phải: Form cấu hình */}
          <div className="space-y-4">
            {/* Tên kỳ thi */}
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                Tên kỳ thi
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ví dụ: Thi HSG cấp huyện"
                className="w-full h-10 px-3.5 rounded-lg border border-[#D9D2C3] bg-white text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                required
              />
            </div>

            {/* Dòng ghi chú */}
            <div>
              <label className="block text-[13px] text-[#1F1D1A] mb-1.5">
                <span className="font-bold">Dòng ghi chú</span>{' '}
                <span className="text-[#6B655C]">(không bắt buộc)</span>
              </label>
              <input
                type="text"
                value={draft.note}
                onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Địa điểm, phòng thi..."
                className="w-full h-10 px-3.5 rounded-lg border border-[#D9D2C3] bg-white text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            {/* Ngày thi & Giờ thi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                  Ngày thi
                </label>
                <input
                  type="date"
                  value={draft.examDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, examDate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A]"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                  Giờ thi
                </label>
                <input
                  type="time"
                  value={draft.examTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, examTime: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A]"
                  required
                />
              </div>
            </div>

            {/* Nền thẻ: Màu / Ảnh riêng */}
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
                Nền thẻ
              </label>
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'color', label: 'Màu' },
                    { id: 'image', label: 'Ảnh riêng' },
                  ] as Array<{ id: ExamBackgroundType; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, bgType: opt.id }))}
                    className={`px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                      draft.bgType === opt.id
                        ? 'banner-pill-active bg-[#1F1D1A] text-white border-[#1F1D1A]'
                        : 'bg-white text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {draft.bgType === 'color' ? (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {EXAM_COLOR_SWATCHES.map((swatch) => {
                      const isPicked = normalizeHexColor(draft.bgColor) === swatch;
                      return (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, bgColor: swatch }));
                            setHexInput(swatch);
                          }}
                          aria-label={`Chọn màu ${swatch}`}
                          className={`w-8 h-8 rounded-lg cursor-pointer transition-transform ${
                            isPicked ? 'ring-2 ring-offset-2 ring-[#1F1D1A] scale-105' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      );
                    })}

                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setHexInput(raw);
                        if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.trim())) {
                          setDraft((prev) => ({ ...prev, bgColor: normalizeHexColor(raw) }));
                        }
                      }}
                      onBlur={() => setHexInput(normalizeHexColor(draft.bgColor))}
                      placeholder="#1F1D1A"
                      className="h-9 w-[112px] px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13px] font-mono text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                    />
                  </div>

                  <p className="text-[12px] text-[#6B655C] mt-2 leading-relaxed">
                    Chữ tự đổi sáng hoặc tối theo màu nền để luôn đọc được. Chọn &quot;Ảnh riêng&quot; nếu muốn dùng ảnh, ảnh sẽ được làm tối nhẹ.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="banner-btn-outline cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-[#FAF7EE] text-[#1F1D1A] text-[13px] font-semibold border border-[#1F1D1A] transition-colors">
                      {isUploadingImg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{draft.bgImageUrl ? 'Chọn ảnh nền khác' : 'Chọn ảnh nền'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePickBgImage}
                        disabled={isUploadingImg || isSaving}
                        className="hidden"
                      />
                    </label>

                    {draft.bgImageUrl && (
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, bgImageUrl: undefined }))}
                        className="text-[13px] text-[#6B655C] hover:text-[#B4281F] underline underline-offset-2 cursor-pointer"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] text-[#6B655C] leading-relaxed">
                    JPG, PNG hoặc WebP tối đa 2 MB. Hệ thống tự phủ lớp tối nhẹ lên ảnh để số đếm ngược luôn rõ nét.
                  </p>
                </div>
              )}
            </div>

            {/* Hiện cho */}
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                Hiện cho
              </label>
              <select
                value={draft.audienceClassId}
                onChange={(e) => setDraft((prev) => ({ ...prev, audienceClassId: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              >
                <option value="ALL">Tất cả học sinh</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Lớp {cls.className}
                  </option>
                ))}
              </select>
            </div>

            {/* Khi đến giờ thi */}
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                Khi đến giờ thi
              </label>
              <select
                value={draft.expireBehavior}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    expireBehavior: e.target.value as ExamExpireBehavior,
                  }))
                }
                className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              >
                <option value="ongoing_1d">Hiện &quot;Đang diễn ra&quot;, sau 1 ngày tự ẩn</option>
                <option value="hide_immediately">Tự ẩn ngay khi đến giờ thi</option>
                <option value="keep_ended">Giữ lại với nhãn &quot;Đã kết thúc&quot;</option>
              </select>
            </div>

            {/* Checkbox Đang hiện */}
            <label className="inline-flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#B4281F] cursor-pointer"
              />
              <span className="text-[13.5px] font-medium text-[#1F1D1A]">
                Đang hiện trên trang chủ học sinh
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 pt-5 mt-6 border-t border-[#E6E0D3]">
          <div>
            {editingObj && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeleteExam(editingObj)}
                className="text-[13px] text-[#6B655C] hover:text-[#B4281F] underline underline-offset-2 cursor-pointer transition-colors disabled:opacity-40"
              >
                Xóa kỳ thi này
              </button>
            )}
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCancelEdit}
              className="text-[13.5px] font-semibold text-[#1F1D1A] hover:text-[#B4281F] cursor-pointer transition-colors disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingImg}
              className="px-5 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingObj ? 'Lưu thay đổi' : 'Thêm kỳ thi'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
