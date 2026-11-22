import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { HomeBanner, BannerLinkType } from '../../types/judge';
import { Loader2 } from 'lucide-react';

const MAX_BANNER_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

function normalizeExternalDisplay(url?: string): string {
  if (!url) return '';
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/**
 * Nén nhẹ ảnh banner phía trình duyệt (JPG/PNG/WebP <= 2MB) thành Data URL WebP/JPEG
 * sắc nét (tối đa rộng 1920px) để lưu nhanh gọn trên Cloud và hiển thị tức thì.
 */
async function processBannerImageFile(file: File): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.');
  }
  if (file.size > MAX_BANNER_FILE_BYTES) {
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

  // Ảnh nhỏ (< 180 KB) giữ nguyên bản để độ nét chữ vector đạt 100%
  if (file.size <= 180 * 1024) {
    return rawDataUrl;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File ảnh bị hỏng hoặc không thể giải mã.'));
      el.src = rawDataUrl;
    });

    const maxW = 1920;
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, w, h);

    const webp = canvas.toDataURL('image/webp', 0.86);
    if (webp.startsWith('data:image/webp') && webp.length < rawDataUrl.length) {
      return webp;
    }
    const jpeg = canvas.toDataURL('image/jpeg', 0.86);
    return jpeg.length < rawDataUrl.length ? jpeg : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

interface BannerDraft {
  id: string | null; // null = đang tạo banner mới
  title: string;
  imageUrl?: string;
  linkType: BannerLinkType;
  internalTargetValue: string; // 'class:<id>' | 'problem:<id>' | ''
  externalUrl: string;
  audienceClassId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const FaminhCubeEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <path
      d="M32 6L55 19V45L32 58L9 45V19L32 6Z"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path d="M32 32V58M32 32L55 19M32 32L9 19" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
    <path d="M20 26L32 33L44 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BannerManager: React.FC = () => {
  const {
    homeBanners,
    saveHomeBanners,
    classes,
    problems,
    showToast,
    openConfirmModal,
  } = useJudge();

  const sortedBanners = useMemo(
    () => [...homeBanners].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [homeBanners]
  );

  const buildDraftFromBanner = (b: HomeBanner): BannerDraft => ({
    id: b.id,
    title: b.title || '',
    imageUrl: b.imageUrl,
    linkType: b.linkType || 'none',
    internalTargetValue: b.targetProblemId
      ? `problem:${b.targetProblemId}`
      : b.targetClassId
      ? `class:${b.targetClassId}`
      : classes[0]
      ? `class:${classes[0].id}`
      : '',
    externalUrl: b.externalUrl || '',
    audienceClassId: b.audienceClassId || 'ALL',
    startDate: b.startDate || '',
    endDate: b.endDate || '',
    isActive: b.isActive !== false,
  });

  const buildEmptyDraft = (): BannerDraft => ({
    id: null,
    title: '',
    imageUrl: undefined,
    linkType: classes.length > 0 ? 'internal' : 'none',
    internalTargetValue: classes[0] ? `class:${classes[0].id}` : '',
    externalUrl: '',
    audienceClassId: 'ALL',
    startDate: '',
    endDate: '',
    isActive: true,
  });

  const [selectedBannerId, setSelectedBannerId] = useState<string | 'NEW' | null>(() =>
    sortedBanners[0]?.id || 'NEW'
  );
  const [draft, setDraft] = useState<BannerDraft>(() =>
    sortedBanners[0] ? buildDraftFromBanner(sortedBanners[0]) : buildEmptyDraft()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Đồng bộ lựa chọn khi danh sách banner từ Cloud vừa tải về lần đầu
  useEffect(() => {
    if (selectedBannerId === 'NEW') return;
    if (selectedBannerId && sortedBanners.some((b) => b.id === selectedBannerId)) return;
    if (sortedBanners.length > 0) {
      setSelectedBannerId(sortedBanners[0].id);
      setDraft(buildDraftFromBanner(sortedBanners[0]));
    } else {
      setSelectedBannerId('NEW');
      setDraft(buildEmptyDraft());
    }
  }, [sortedBanners.length]);

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.id, c.className));
    return m;
  }, [classes]);

  const problemMap = useMemo(() => {
    const m = new Map<string, string>();
    problems.forEach((p) => m.set(p.id, `[${p.code}] ${p.title}`));
    return m;
  }, [problems]);

  const getLinkSummary = (b: HomeBanner): string => {
    if (b.linkType === 'internal') {
      if (b.targetProblemId) {
        return `Mở đề: ${problemMap.get(b.targetProblemId) || b.targetProblemId}`;
      }
      if (b.targetClassId) {
        return `Mở lớp: ${classMap.get(b.targetClassId) || 'Lớp học'}`;
      }
      return 'Chưa chọn lớp / đề';
    }
    if (b.linkType === 'external') {
      const clean = normalizeExternalDisplay(b.externalUrl);
      return clean ? `Link ngoài: ${clean}` : 'Chưa nhập link ngoài';
    }
    return 'Chưa gắn link';
  };

  const getAudienceLabel = (audienceClassId: string): string => {
    if (!audienceClassId || audienceClassId === 'ALL') return 'Tất cả học sinh';
    const name = classMap.get(audienceClassId);
    return name ? `Lớp ${name}` : 'Lớp đã chọn';
  };

  const handleSelectEdit = (b: HomeBanner) => {
    setSelectedBannerId(b.id);
    setDraft(buildDraftFromBanner(b));
  };

  const handleStartAddNew = () => {
    setSelectedBannerId('NEW');
    setDraft(buildEmptyDraft());
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const dataUrl = await processBannerImageFile(file);
      setDraft((prev) => ({
        ...prev,
        imageUrl: dataUrl,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
    } catch (err: unknown) {
      showToast('Không thể tải ảnh banner', (err as Error)?.message || 'Lỗi đọc file ảnh', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleToggleVisibility = async (banner: HomeBanner) => {
    setIsSaving(true);
    try {
      const next = sortedBanners.map((b) =>
        b.id === banner.id
          ? { ...b, isActive: !b.isActive, updatedAt: new Date().toISOString() }
          : b
      );
      await saveHomeBanners(next);
      if (selectedBannerId === banner.id) {
        setDraft((prev) => ({ ...prev, isActive: !banner.isActive }));
      }
      showToast(
        banner.isActive ? 'Đã ẩn banner' : 'Đã hiện banner',
        `Banner "${banner.title}" đã được chuyển sang trạng thái ${banner.isActive ? 'Đang ẩn' : 'Đang hiện'}.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Lỗi cập nhật trạng thái', (err as Error)?.message || 'Không thể lưu lên Cloud', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBanner = (banner: HomeBanner) => {
    openConfirmModal({
      title: 'Xóa banner trang chủ',
      message: `Bạn có chắc muốn xóa banner "${banner.title}" khỏi trang chủ học sinh không?`,
      confirmLabel: 'Xóa banner',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          const remaining = sortedBanners
            .filter((b) => b.id !== banner.id)
            .map((b, idx) => ({ ...b, order: idx + 1 }));
          await saveHomeBanners(remaining);
          if (selectedBannerId === banner.id) {
            if (remaining.length > 0) {
              setSelectedBannerId(remaining[0].id);
              setDraft(buildDraftFromBanner(remaining[0]));
            } else {
              setSelectedBannerId('NEW');
              setDraft(buildEmptyDraft());
            }
          }
          showToast('Đã xóa banner', `Đã xóa banner "${banner.title}".`, 'info');
        } catch (err: unknown) {
          showToast('Lỗi xóa banner', (err as Error)?.message || 'Không thể xóa trên Cloud', 'error');
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleReorderDrop = async (targetId: string) => {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const fromIdx = sortedBanners.findIndex((b) => b.id === draggedId);
    const toIdx = sortedBanners.findIndex((b) => b.id === targetId);
    setDraggedId(null);
    if (fromIdx < 0 || toIdx < 0) return;

    const reordered = [...sortedBanners];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const numbered = reordered.map((b, idx) => ({ ...b, order: idx + 1 }));

    setIsSaving(true);
    try {
      await saveHomeBanners(numbered);
      showToast('Đã đổi thứ tự banner', `Banner "${moved.title}" đã chuyển lên vị trí số ${toIdx + 1}.`, 'success');
    } catch (err: unknown) {
      showToast('Lỗi lưu thứ tự', (err as Error)?.message || 'Không thể lưu lên Cloud', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = draft.title.trim();
    if (!cleanTitle) {
      showToast('Thiếu tên banner', 'Vui lòng nhập Tên banner trước khi lưu.', 'warning');
      return;
    }
    if (draft.linkType === 'external' && !draft.externalUrl.trim()) {
      showToast('Thiếu đường dẫn', 'Vui lòng nhập đường link ngoài (ví dụ https://zalo.me/g/...).', 'warning');
      return;
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      showToast('Khoảng ngày không hợp lệ', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.', 'warning');
      return;
    }

    let targetClassId: string | undefined;
    let targetProblemId: string | undefined;
    if (draft.linkType === 'internal' && draft.internalTargetValue) {
      if (draft.internalTargetValue.startsWith('class:')) {
        targetClassId = draft.internalTargetValue.slice('class:'.length);
      } else if (draft.internalTargetValue.startsWith('problem:')) {
        targetProblemId = draft.internalTargetValue.slice('problem:'.length);
      }
    }

    const nowIso = new Date().toISOString();
    const isCreating = selectedBannerId === 'NEW' || !draft.id;

    let nextList: HomeBanner[];
    let savedId: string;

    if (isCreating) {
      savedId = `banner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newBanner: HomeBanner = {
        id: savedId,
        title: cleanTitle,
        imageUrl: draft.imageUrl,
        linkType: draft.linkType,
        targetClassId,
        targetProblemId,
        externalUrl: draft.linkType === 'external' ? draft.externalUrl.trim() : undefined,
        audienceClassId: draft.audienceClassId || 'ALL',
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        isActive: draft.isActive,
        order: sortedBanners.length + 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextList = [...sortedBanners, newBanner];
    } else {
      savedId = draft.id!;
      nextList = sortedBanners.map((b) =>
        b.id === savedId
          ? {
              ...b,
              title: cleanTitle,
              imageUrl: draft.imageUrl,
              linkType: draft.linkType,
              targetClassId,
              targetProblemId,
              externalUrl: draft.linkType === 'external' ? draft.externalUrl.trim() : undefined,
              audienceClassId: draft.audienceClassId || 'ALL',
              startDate: draft.startDate || undefined,
              endDate: draft.endDate || undefined,
              isActive: draft.isActive,
              updatedAt: nowIso,
            }
          : b
      );
    }

    setIsSaving(true);
    try {
      await saveHomeBanners(nextList);
      setSelectedBannerId(savedId);
      const savedBanner = nextList.find((b) => b.id === savedId);
      if (savedBanner) setDraft(buildDraftFromBanner(savedBanner));
      showToast(
        isCreating ? 'Đã thêm banner mới' : 'Đã lưu thay đổi',
        `Banner "${cleanTitle}" đã được đồng bộ lên trang chủ học sinh.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Lỗi lưu banner', (err as Error)?.message || 'Không thể lưu lên Cloud', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedBannerId === 'NEW') {
      if (sortedBanners.length > 0) {
        setSelectedBannerId(sortedBanners[0].id);
        setDraft(buildDraftFromBanner(sortedBanners[0]));
      } else {
        setDraft(buildEmptyDraft());
      }
      return;
    }
    const orig = sortedBanners.find((b) => b.id === selectedBannerId);
    if (orig) setDraft(buildDraftFromBanner(orig));
  };

  const editingBannerIndex =
    selectedBannerId && selectedBannerId !== 'NEW'
      ? sortedBanners.findIndex((b) => b.id === selectedBannerId)
      : -1;
  const editingBannerObj = editingBannerIndex >= 0 ? sortedBanners[editingBannerIndex] : null;

  const fallbackThumbBgs = ['bg-[#1F1D1A]', 'bg-[#B4281F]', 'bg-[#9E9589]'];

  return (
    <div
      className="banner-editorial-page max-w-[1060px] mx-auto pb-12 text-[#1F1D1A]"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Tiêu đề & Nút + Thêm banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-[28px] font-bold tracking-tight text-[#1F1D1A] leading-tight"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            Banner trang chủ
          </h2>
          <p className="text-[13.5px] text-[#6B655C] mt-1.5 max-w-[520px] leading-relaxed">
            Banner hiện ở đầu trang chủ của học sinh. Gắn link để học sinh bấm vào là mở thẳng lớp hoặc trang bạn muốn.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartAddNew}
          className="px-4 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13.5px] font-semibold transition-colors cursor-pointer shrink-0"
        >
          + Thêm banner
        </button>
      </div>

      {/* Bảng danh sách banner */}
      <p className="text-[12.5px] text-[#6B655C] mb-2.5">
        Banner số 1 hiện đầu tiên. Kéo thả hàng để đổi thứ tự.
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header cột */}
          <div className="grid grid-cols-[42px_156px_minmax(190px,1.5fr)_135px_115px_128px] items-center gap-4 py-2.5 px-3 border-t-[1.5px] border-t-[#1F1D1A] border-b border-b-[#DDD6C7] text-[12.5px] font-medium text-[#6B655C]">
            <span>#</span>
            <span>Ảnh</span>
            <span>Tên và link</span>
            <span>Hiện cho</span>
            <span>Trạng thái</span>
            <span className="text-right" />
          </div>

          {sortedBanners.length === 0 ? (
            <div className="py-10 px-4 text-center border-b border-[#E5DFD3] text-[13.5px] text-[#6B655C]">
              Chưa có banner nào. Hãy điền thông tin vào khung bên dưới rồi bấm{' '}
              <b className="text-[#1F1D1A]">Thêm banner</b> để hiển thị lên trang chủ học sinh.
            </div>
          ) : (
            <div>
              {sortedBanners.map((b, idx) => {
                const isSelected = selectedBannerId === b.id;
                const isDragTarget = dragOverId === b.id && draggedId !== b.id;

                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => setDraggedId(b.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverId !== b.id) setDragOverId(b.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === b.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleReorderDrop(b.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onClick={() => handleSelectEdit(b)}
                    className={`grid grid-cols-[42px_156px_minmax(190px,1.5fr)_135px_115px_128px] items-center gap-4 py-3.5 px-3 border-b border-[#E5DFD3] transition-colors cursor-pointer select-none ${
                      isDragTarget
                        ? 'bg-[#F5E8E6] border-t-2 border-t-[#B4281F]'
                        : isSelected
                        ? 'bg-[#ECE5D6]'
                        : 'hover:bg-[#F3EEE2]'
                    }`}
                  >
                    <span className="font-mono text-[13.5px] text-[#6B655C]">{idx + 1}</span>

                    {/* Thumbnail ảnh banner */}
                    <div
                      className={`w-[138px] h-[30px] rounded-md overflow-hidden flex items-center px-2.5 shrink-0 ${
                        b.imageUrl ? 'bg-[#1F1D1A] border border-[#D9D2C3]' : fallbackThumbBgs[idx % fallbackThumbBgs.length]
                      }`}
                    >
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt={b.title}
                          className="w-full h-full object-cover -mx-2.5 max-w-none"
                          style={{ width: 'calc(100% + 20px)' }}
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-white truncate">
                          {b.title}
                        </span>
                      )}
                    </div>

                    {/* Tên và link */}
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[#1F1D1A] truncate">
                        {b.title}
                      </div>
                      <div className="text-[12px] text-[#6B655C] truncate mt-0.5">
                        {getLinkSummary(b)}
                      </div>
                    </div>

                    {/* Hiện cho */}
                    <div className="text-[13px] text-[#1F1D1A] truncate">
                      {getAudienceLabel(b.audienceClassId)}
                    </div>

                    {/* Trạng thái */}
                    <div className="flex items-center gap-1.5 text-[13px]">
                      {b.isActive ? (
                        <>
                          <span className="w-2 h-2 rounded-[2px] bg-[#2E7D32] shrink-0" />
                          <span className="font-semibold text-[#2E7D32]">Đang hiện</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-[2px] border border-[#8A8277] shrink-0" />
                          <span className="text-[#6B655C]">Đang ẩn</span>
                        </>
                      )}
                    </div>

                    {/* Hành động */}
                    <div
                      className="flex items-center justify-end gap-3.5 text-[13px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectEdit(b)}
                        className="text-[#6B655C] hover:text-[#1F1D1A] font-medium cursor-pointer transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleToggleVisibility(b)}
                        className="text-[#6B655C] hover:text-[#1F1D1A] font-medium cursor-pointer transition-colors disabled:opacity-40"
                      >
                        {b.isActive ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleDeleteBanner(b)}
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

      {/* Khung sửa / thêm banner */}
      <form
        onSubmit={handleSaveDraft}
        className="mt-7 bg-white border border-[#D9D2C3] rounded-2xl p-6 sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <h3
            className="text-[17px] font-bold text-[#1F1D1A]"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {editingBannerIndex >= 0 ? `Sửa banner số ${editingBannerIndex + 1}` : 'Thêm banner mới'}
          </h3>
          <span className="text-[13px] text-[#6B655C] truncate max-w-[260px]">
            {draft.title.trim() || 'Chưa đặt tên'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-7 mt-5">
          {/* Cột trái: Ảnh banner */}
          <div>
            <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
              Ảnh banner
            </label>

            <div className="w-full aspect-[24/7] min-h-[118px] rounded-xl overflow-hidden bg-[#191715] border border-[#D9D2C3] relative flex items-center justify-between">
              {draft.imageUrl ? (
                <img
                  src={draft.imageUrl}
                  alt={draft.title || 'Xem trước banner'}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full px-5 py-4 flex items-center justify-between gap-3 text-white">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#E57368]">
                      FAMINH Judge
                    </div>
                    <div className="text-[16px] sm:text-[18px] font-bold leading-snug mt-0.5 truncate">
                      {draft.title.trim() || 'Tiêu đề banner trang chủ'}
                    </div>
                  </div>
                  <FaminhCubeEmblem className="w-11 h-11 text-white/90 shrink-0" />
                </div>
              )}

              {isUploadingImage && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tối ưu ảnh...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3">
              <label className="banner-btn-outline cursor-pointer inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-white hover:bg-[#FAF7EE] text-[#1F1D1A] text-[13px] font-semibold border border-[#1F1D1A] transition-colors">
                <span>{draft.imageUrl ? 'Chọn ảnh khác' : 'Chọn ảnh banner'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePickImage}
                  disabled={isUploadingImage || isSaving}
                  className="hidden"
                />
              </label>

              {draft.imageUrl && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, imageUrl: undefined }))}
                  className="text-[13px] text-[#6B655C] hover:text-[#B4281F] underline underline-offset-2 cursor-pointer transition-colors"
                >
                  Xóa ảnh
                </button>
              )}
            </div>

            <div className="text-[12px] text-[#6B655C] space-y-1.5 mt-3.5 leading-relaxed">
              <p>Khuyên dùng 2400 × 500 px (tỉ lệ 24:5). JPG, PNG hoặc WebP, tối đa 2 MB.</p>
              <p>Đặt chữ quan trọng ở giữa ảnh, vì trên điện thoại hai bên ảnh có thể bị cắt.</p>
            </div>
          </div>

          {/* Cột phải: Thông tin, Link, Đối tượng, Lịch hiện */}
          <div className="space-y-4">
            {/* Tên banner */}
            <div>
              <label className="block text-[13px] text-[#1F1D1A] mb-1.5">
                <span className="font-bold">Tên banner</span>{' '}
                <span className="text-[#6B655C] font-normal">
                  (người dùng trình đọc màn hình sẽ nghe tên này)
                </span>
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ví dụ: Bộ đề HSG các tỉnh"
                className="w-full h-10 px-3.5 rounded-lg border border-[#D9D2C3] bg-white text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] transition-colors"
                required
              />
            </div>

            {/* Khi học sinh bấm vào banner */}
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
                Khi học sinh bấm vào banner
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'none', label: 'Không gắn link' },
                    { id: 'internal', label: 'Mở lớp / đề trong web' },
                    { id: 'external', label: 'Link ngoài' },
                  ] as Array<{ id: BannerLinkType; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        linkType: opt.id,
                        internalTargetValue:
                          opt.id === 'internal' && !prev.internalTargetValue && classes[0]
                            ? `class:${classes[0].id}`
                            : prev.internalTargetValue,
                      }))
                    }
                    className={`px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                      draft.linkType === opt.id
                        ? 'banner-pill-active bg-[#1F1D1A] text-white border-[#1F1D1A]'
                        : 'bg-white text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {draft.linkType === 'internal' && (
                <div className="mt-2.5">
                  <select
                    value={draft.internalTargetValue}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, internalTargetValue: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  >
                    <option value="">-- Chọn lớp học hoặc đề bài --</option>
                    {classes.length > 0 && (
                      <optgroup label="Lớp học">
                        {classes.map((cls) => (
                          <option key={cls.id} value={`class:${cls.id}`}>
                            {cls.className}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {problems.length > 0 && (
                      <optgroup label="Đề bài cụ thể">
                        {problems.map((p) => (
                          <option key={p.id} value={`problem:${p.id}`}>
                            [{p.code}] {p.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-[12px] text-[#6B655C] mt-1.5 leading-relaxed">
                    Học sinh bấm vào banner sẽ vào thẳng lớp này. Chọn &quot;Link ngoài&quot; nếu muốn mở Zalo, Facebook hay Google Form.
                  </p>
                </div>
              )}

              {draft.linkType === 'external' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={draft.externalUrl}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, externalUrl: e.target.value }))
                    }
                    placeholder="https://zalo.me/g/..."
                    className="w-full h-10 px-3.5 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  />
                  <p className="text-[12px] text-[#6B655C] mt-1.5 leading-relaxed">
                    Khi bấm vào banner, trang sẽ tự mở trong tab mới (Zalo, Facebook, Google Form...).
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
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, audienceClassId: e.target.value }))
                }
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

            {/* Từ ngày / Đến ngày */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12.5px] text-[#1F1D1A] mb-1.5">
                  <span className="font-bold">Từ ngày</span>{' '}
                  <span className="text-[#6B655C]">(không bắt buộc)</span>
                </label>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                />
              </div>

              <div>
                <label className="block text-[12.5px] text-[#1F1D1A] mb-1.5">
                  <span className="font-bold">Đến ngày</span>{' '}
                  <span className="text-[#6B655C]">(không bắt buộc)</span>
                </label>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                />
              </div>
            </div>

            {/* Checkbox Đang hiện trên trang chủ học sinh */}
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

        {/* Chân khung sửa */}
        <div className="flex items-center justify-between gap-4 pt-5 mt-6 border-t border-[#E6E0D3]">
          <div>
            {editingBannerObj && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeleteBanner(editingBannerObj)}
                className="text-[13px] text-[#6B655C] hover:text-[#B4281F] underline underline-offset-2 cursor-pointer transition-colors disabled:opacity-40"
              >
                Xóa banner này
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
              disabled={isSaving || isUploadingImage}
              className="px-5 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingBannerObj ? 'Lưu thay đổi' : 'Thêm banner'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
