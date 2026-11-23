import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass } from '../../types/judge';
import { TopicManager } from './TopicManager';
import {
  getEffectiveTestCount,
  getProblemAssignedClasses,
} from '../../utils/teacherMetrics';
import { X } from 'lucide-react';

export type ProblemBankFilterMode = 'all' | 'missing_tests' | 'unassigned';

interface ProblemBankProps {
  initialFilter?: ProblemBankFilterMode;
  onOpenProblemEditor: (problemId: string | 'NEW', focusSection?: 'info' | 'de' | 'test' | 'giao') => void;
  onOpenClass: (classId: string) => void;
}

export const ProblemBank: React.FC<ProblemBankProps> = ({
  initialFilter = 'all',
  onOpenProblemEditor,
  onOpenClass,
}) => {
  const {
    problems,
    topics,
    classes,
    problemTestCounts,
    refreshProblemTestCounts,
    createClass,
    showToast,
  } = useJudge();

  const [activeTab, setActiveTab] = useState<'problems' | 'topics' | 'sets'>('problems');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('ALL');
  const [chipFilter, setChipFilter] = useState<ProblemBankFilterMode>(initialFilter);

  // Modal tạo nhanh Bộ đề mới (là 1 lớp luyện đề chuyên biệt)
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [setName, setSetName] = useState('');
  const [setDesc, setSetDesc] = useState('');
  const [isSavingSet, setIsSavingSet] = useState(false);

  useEffect(() => {
    setChipFilter(initialFilter);
    if (initialFilter !== 'all') {
      setActiveTab('problems');
    }
  }, [initialFilter]);

  useEffect(() => {
    refreshProblemTestCounts(false).catch(() => {});
  }, []);

  const topicMap = useMemo(() => {
    const m = new Map<string, string>();
    topics.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);

  // Tính sẵn số test thật & danh sách lớp đang giao cho mỗi bài
  const enrichedProblems = useMemo(() => {
    return problems.map((p) => {
      const testCount = getEffectiveTestCount(p, problemTestCounts);
      const assignedClasses = getProblemAssignedClasses(p, topics, classes);
      const topicName = p.topicId ? topicMap.get(p.topicId) || 'Chưa rõ chủ đề' : 'Chưa gắn chủ đề';
      return {
        problem: p,
        testCount,
        assignedClasses,
        topicName,
      };
    });
  }, [problems, problemTestCounts, topics, classes, topicMap]);

  const missingTestCount = useMemo(
    () => enrichedProblems.filter((x) => x.testCount === 0).length,
    [enrichedProblems]
  );

  const unassignedCount = useMemo(
    () => enrichedProblems.filter((x) => x.assignedClasses.length === 0).length,
    [enrichedProblems]
  );

  const filteredProblems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enrichedProblems.filter(({ problem, testCount, assignedClasses, topicName }) => {
      if (chipFilter === 'missing_tests' && testCount > 0) return false;
      if (chipFilter === 'unassigned' && assignedClasses.length > 0) return false;
      if (selectedTopicId === '__NONE__' && problem.topicId) return false;
      if (selectedTopicId !== 'ALL' && selectedTopicId !== '__NONE__' && problem.topicId !== selectedTopicId) {
        return false;
      }
      if (q) {
        const matchCode = (problem.code || '').toLowerCase().includes(q);
        const matchTitle = (problem.title || '').toLowerCase().includes(q);
        const matchTopic = topicName.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchTopic) return false;
      }
      return true;
    });
  }, [enrichedProblems, chipFilter, selectedTopicId, searchTerm]);

  // Tab "Bộ đề": ưu tiên các lớp/bộ đề chuyên luyện đề (tên chứa "đề" / "hsg" / "ôn" / "thi") hoặc hiển thị toàn bộ lớp để giáo viên mở nhanh
  const examSets = useMemo(() => {
    const examKeyword = /(bộ\s*đề|đề\s*thi|hsg|luyện\s*đề|kỳ\s*thi|đề\s*số)/i;
    const allWithStats = classes.map((cls) => {
      const clsProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics, classes));
      const clsTopics = topics.filter((t) => {
        const ids = t.classIds && t.classIds.length > 0 ? t.classIds : t.classId ? [t.classId] : ['ALL'];
        return ids.includes(cls.id) || ids.includes('ALL');
      });
      return {
        cls,
        problemCount: clsProblems.length,
        topicCount: clsTopics.length,
        isExamSet: examKeyword.test(cls.className) || examKeyword.test(cls.description || ''),
      };
    });
    const matched = allWithStats.filter((x) => x.isExamSet);
    return matched.length > 0 ? matched : allWithStats;
  }, [classes, problems, topics]);

  const handleCreateSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName.trim()) {
      showToast('Thiếu tên bộ đề', 'Vui lòng nhập tên bộ đề (VD: Bộ Đề Số 2 - HSG Tỉnh).', 'warning');
      return;
    }
    setIsSavingSet(true);
    try {
      const created = await createClass(setName.trim(), setDesc.trim());
      setIsCreatingSet(false);
      setSetName('');
      setSetDesc('');
      onOpenClass(created.id);
    } catch (err: unknown) {
      showToast('Lỗi tạo bộ đề', (err as Error)?.message || 'Không thể tạo bộ đề mới', 'error');
    } finally {
      setIsSavingSet(false);
    }
  };

  return (
    <div
      className="banner-editorial-page w-full text-[#1F1D1A] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-[#1F1D1A] leading-tight">
            Kho bài
          </h1>
          <p className="text-[15px] text-[#6B655C] mt-2 max-w-[640px]">
            Nơi tạo bài và nạp test. Muốn lớp nào thấy bài, hãy giao chủ đề chứa bài đó cho lớp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenProblemEditor('NEW')}
          className="px-5 py-[11px] rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[15px] font-semibold transition-colors cursor-pointer shrink-0"
        >
          + Thêm bài
        </button>
      </div>

      {/* 3 Tab chính: Bài tập | Chủ đề | Bộ đề */}
      <div className="flex items-center gap-7 border-b border-[#D9D2C3] mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('problems')}
          className={`py-2.5 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'problems'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Bài tập ({problems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`py-2.5 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'topics'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Chủ đề ({topics.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sets')}
          className={`py-2.5 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'sets'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Bộ đề ({examSets.length})
        </button>
      </div>

      {/* TAB 1: DANH SÁCH BÀI TẬP */}
      {activeTab === 'problems' && (
        <div>
          {/* Thanh tìm kiếm & chip lọc nhanh */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã bài hoặc tên"
              aria-label="Tìm bài"
              className="w-full sm:w-[300px] px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
            />

            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              aria-label="Chủ đề"
              className="px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] max-w-[260px]"
            >
              <option value="ALL">Mọi chủ đề</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__NONE__">Chưa gắn chủ đề</option>
            </select>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setChipFilter('all')}
                className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                  chipFilter === 'all'
                    ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                    : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                }`}
              >
                Tất cả
              </button>

              <button
                type="button"
                onClick={() => setChipFilter('missing_tests')}
                className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                  chipFilter === 'missing_tests'
                    ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                    : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                }`}
              >
                Thiếu test ({missingTestCount})
              </button>

              <button
                type="button"
                onClick={() => setChipFilter('unassigned')}
                className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                  chipFilter === 'unassigned'
                    ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                    : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                }`}
              >
                Chưa giao lớp nào ({unassignedCount})
              </button>
            </div>
          </div>

          {/* Bảng danh sách bài tập */}
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[120px_minmax(170px,1.2fr)_100px_135px_130px_minmax(140px,1fr)_70px] gap-4 items-center text-[13px] text-[#6B655C]">
                <span>Mã bài</span>
                <span>Chủ đề</span>
                <span>Độ khó</span>
                <span>Giới hạn</span>
                <span>Test</span>
                <span>Đang giao cho</span>
                <span />
              </div>

              {filteredProblems.length === 0 ? (
                <div className="border-t border-b border-[#D9D2C3] py-10 text-center text-[14px] text-[#6B655C]">
                  {problems.length === 0
                    ? 'Kho bài chưa có bài tập nào. Bấm "+ Thêm bài" ở góc trên phải để tạo bài đầu tiên.'
                    : 'Không tìm thấy bài tập nào khớp bộ lọc hiện tại.'}
                </div>
              ) : (
                <div>
                  {filteredProblems.map(({ problem, testCount, assignedClasses, topicName }) => {
                    const showSubTitle =
                      problem.title &&
                      problem.title.trim().toUpperCase() !== problem.code.trim().toUpperCase();
                    return (
                      <div
                        key={problem.id}
                        className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[120px_minmax(170px,1.2fr)_100px_135px_130px_minmax(140px,1fr)_70px] gap-4 items-center hover:bg-black/[0.015] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-[14.5px] text-[#1F1D1A] truncate" title={problem.code}>
                            {problem.code}
                          </div>
                          {showSubTitle && (
                            <div className="text-[12px] text-[#6B655C] truncate" title={problem.title}>
                              {problem.title}
                            </div>
                          )}
                        </div>

                        <div className="text-[14px] text-[#1F1D1A] truncate" title={topicName}>
                          {topicName}
                        </div>

                        <div className="text-[14px] text-[#1F1D1A] truncate">
                          {problem.difficulty || 'Trung bình'}
                        </div>

                        <div className="text-[14px] text-[#6B655C] whitespace-nowrap tabular-nums">
                          {problem.timeLimit || 1} giây · {problem.memoryLimit || 1024} MB
                        </div>

                        <div className="text-[14px] whitespace-nowrap">
                          {testCount > 0 ? (
                            <span className="inline-flex items-center">
                              <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#2F6B3F] shrink-0" />
                              <span>{testCount} test</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#D69A1F] shrink-0" />
                              <b className="text-[#8A5A00]">Chưa có test</b>
                            </span>
                          )}
                        </div>

                        <div
                          className={`text-[14px] truncate ${
                            assignedClasses.length > 0 ? 'text-[#1F1D1A]' : 'text-[#6B655C]'
                          }`}
                          title={assignedClasses.map((c) => c.className).join(', ')}
                        >
                          {assignedClasses.length > 0
                            ? assignedClasses.map((c) => c.className).join(', ')
                            : 'Chưa giao lớp nào'}
                        </div>

                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => onOpenProblemEditor(problem.id)}
                            className="text-[14.5px] font-semibold text-[#B4281F] hover:text-[#8F1F18] hover:underline whitespace-nowrap cursor-pointer"
                          >
                            Sửa →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-[#D9D2C3] py-3.5 text-[14px] text-[#6B655C]">
                Hiện {filteredProblems.length} trong {problems.length} bài
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHỦ ĐỀ */}
      {activeTab === 'topics' && (
        <div className="pt-1">
          <TopicManager />
        </div>
      )}

      {/* TAB 3: BỘ ĐỀ */}
      {activeTab === 'sets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[14px] text-[#6B655C]">
              Các bộ đề / không gian luyện đề chuyên biệt để giao trực tiếp cho học sinh hoặc gắn lên Banner trang chủ.
            </p>
            <button
              type="button"
              onClick={() => setIsCreatingSet(true)}
              className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[14px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer"
            >
              + Tạo bộ đề mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[1.4fr_130px_110px_110px_120px] gap-4 items-center text-[13px] text-[#6B655C]">
                <span>Tên bộ đề / lớp luyện đề</span>
                <span>Mã tham gia</span>
                <span>Chủ đề</span>
                <span>Số bài</span>
                <span />
              </div>

              {examSets.length === 0 ? (
                <div className="border-t border-b border-[#D9D2C3] py-10 text-center text-[14px] text-[#6B655C]">
                  Chưa có bộ đề nào. Bấm <b>+ Tạo bộ đề mới</b> để khởi tạo.
                </div>
              ) : (
                <div className="border-b border-[#D9D2C3]">
                  {examSets.map(({ cls, problemCount, topicCount }) => (
                    <div
                      key={cls.id}
                      className="border-t border-[#D9D2C3] py-4 grid grid-cols-[1.4fr_130px_110px_110px_120px] gap-4 items-center hover:bg-black/[0.015]"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[15px] text-[#1F1D1A] truncate">
                          {cls.className}
                        </div>
                        {cls.description && (
                          <div className="text-[13px] text-[#6B655C] truncate mt-0.5">
                            {cls.description}
                          </div>
                        )}
                      </div>

                      <div className="font-mono font-bold text-[13.5px] text-[#B4281F]">
                        {cls.joinCode}
                      </div>

                      <div className="text-[14px] text-[#1F1D1A]">{topicCount} chủ đề</div>

                      <div className="text-[14px] text-[#1F1D1A]">{problemCount} bài</div>

                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => onOpenClass(cls.id)}
                          className="text-[14.5px] font-semibold text-[#B4281F] hover:text-[#8F1F18] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Mở bộ đề →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo nhanh Bộ đề mới */}
      {isCreatingSet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          onClick={() => !isSavingSet && setIsCreatingSet(false)}
        >
          <form
            onSubmit={handleCreateSetSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-[#FFFDF8] border border-[#D9D2C3] p-6 shadow-xl space-y-4 text-[#1F1D1A]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-bold">Tạo bộ đề mới</h3>
              <button
                type="button"
                onClick={() => setIsCreatingSet(false)}
                className="p-1 text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">Tên bộ đề</label>
              <input
                type="text"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="VD: Bộ Đề Số 2 — Thi HSG các tỉnh"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Mô tả ngắn <span className="font-normal text-[#6B655C]">(không bắt buộc)</span>
              </label>
              <textarea
                rows={2}
                value={setDesc}
                onChange={(e) => setSetDesc(e.target.value)}
                placeholder="Tuyển tập đề thi HSG Tin học cấp huyện / cấp tỉnh có test mẫu."
                className="w-full px-3 py-2 rounded-lg border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D9D2C3]">
              <button
                type="button"
                onClick={() => setIsCreatingSet(false)}
                className="px-4 py-2 text-[14px] font-semibold text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingSet}
                className="px-5 py-2 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {isSavingSet ? 'Đang tạo...' : 'Tạo bộ đề'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
