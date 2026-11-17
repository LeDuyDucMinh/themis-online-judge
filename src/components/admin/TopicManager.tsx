import React, { useState, useMemo, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Topic, Problem, Classroom } from '../../types/judge';
import { idbService } from '../../services/db';
import { storageService } from '../../services/storageService';
import { ProblemEditorModal } from './ProblemEditorModal';
import { TestCaseManagerModal } from './TestCaseManagerModal';
import { VideoConfigModal } from './VideoConfigModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  X,
  Video,
  Clock,
  HardDrive,
  GraduationCap,
  Globe,
  Search,
  BookOpen,
  AlertCircle,
} from 'lucide-react';

interface TopicManagerProps {
  initialClassId?: string;
}

export const TopicManager: React.FC<TopicManagerProps> = ({ initialClassId }) => {
  const {
    topics,
    problems,
    classes,
    activeClassId,
    addTopic,
    updateTopic,
    deleteTopic,
    deleteProblem,
    reorderTopics,
    openConfirmModal,
  } = useJudge();

  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  // Tab switcher: 'topics' (Danh sách chủ đề) vs 'problems' (Các bài tập)
  const [activeTab, setActiveTabState] = useState<'topics' | 'problems'>(() => {
    return (storageService.getTopicManagerTab() as any) || 'topics';
  });
  const setActiveTab = (tab: 'topics' | 'problems') => {
    setActiveTabState(tab);
    storageService.setTopicManagerTab(tab);
  };

  // Filter & Search states cho Tab "Các bài tập"
  const [problemSearch, setProblemSearch] = useState('');
  const [problemTopicFilter, setProblemTopicFilter] = useState<string>('ALL'); // 'ALL' | '__UNASSIGNED__' | topicId

  // Bộ lọc chủ đề theo lớp học
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClassId || 'ALL');

  // Drag and drop state để kéo thả sắp xếp chủ đề
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Form states for Topic
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Danh sách các classId được tích chọn (Hỗ trợ chọn nhiều lớp)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(initialClassId ? [initialClassId] : ['ALL']);

  // Modals for Problem Actions
  const [creatingForTopicId, setCreatingForTopicId] = useState<string | null>(null);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [managingTestsProblem, setManagingTestsProblem] = useState<Problem | null>(null);
  const [configuringVideoProblem, setConfiguringVideoProblem] = useState<Problem | null>(null);

  // Bộ đệm số lượng test case thực tế từ IndexedDB
  const [asyncTestCounts, setAsyncTestCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const counts: Record<string, number> = {};
      for (const p of problems) {
        if (p.testCases && p.testCases.length > 0) {
          counts[p.id] = p.testCases.length;
        } else {
          const dbTests = await idbService.getTestCases(p.id);
          if (dbTests && dbTests.length > 0) {
            counts[p.id] = dbTests.length;
          }
        }
      }
      if (isMounted) setAsyncTestCounts(counts);
    })();
    return () => {
      isMounted = false;
    };
  }, [problems]);

  // Helper kiểm tra một chủ đề có thuộc lớp học được lọc không
  const isTopicInClass = (t: Topic, filterClassId: string): boolean => {
    if (filterClassId === 'ALL') return true;
    const ids = t.classIds && t.classIds.length > 0
      ? t.classIds
      : (t.classId ? [t.classId] : ['ALL']);
    if (ids.includes('ALL')) return true;
    return ids.includes(filterClassId);
  };

  // Danh sách các lớp học hợp lệ thực tế đang được chọn
  const selectedClassObjects: Classroom[] = useMemo(() => {
    if (selectedClassIds.includes('ALL')) {
      return classes;
    }
    const idSet = new Set(selectedClassIds);
    return classes.filter((c: Classroom) => idSet.has(c.id));
  }, [classes, selectedClassIds]);

  const isAllClasses =
    selectedClassIds.includes('ALL') ||
    (classes.length > 0 && selectedClassObjects.length === classes.length);

  const handleToggleClass = (classIdToToggle: string) => {
    setSelectedClassIds((prev) => {
      const validClassIdSet = new Set(classes.map((c) => c.id));
      const currentlySelected = prev.includes('ALL')
        ? classes.map((c) => c.id)
        : prev.filter((id) => validClassIdSet.has(id));

      if (currentlySelected.includes(classIdToToggle)) {
        return currentlySelected.filter((id) => id !== classIdToToggle);
      } else {
        const next = [...currentlySelected, classIdToToggle];
        if (next.length >= classes.length && classes.length > 0) {
          return ['ALL'];
        }
        return next;
      }
    });
  };

  const handleSelectAllClasses = () => {
    setSelectedClassIds(['ALL']);
  };

  const handleClearAllClasses = () => {
    setSelectedClassIds([]);
  };

  const handleStartAddTopic = () => {
    setIsAddingTopic(true);
    setEditingTopicId(null);
    setName('');
    setDescription('');
    if (initialClassId) {
      setSelectedClassIds([initialClassId]);
    } else if (selectedClassFilter !== 'ALL') {
      setSelectedClassIds([selectedClassFilter]);
    } else if (activeClassId) {
      setSelectedClassIds([activeClassId]);
    } else {
      setSelectedClassIds(['ALL']);
    }
  };

  const handleStartEditTopic = (t: Topic) => {
    setEditingTopicId(t.id);
    setIsAddingTopic(false);
    setName(t.name);
    setDescription(t.description || '');

    const validClassIdSet = new Set(classes.map((c) => c.id));
    if (t.classIds && t.classIds.length > 0) {
      if (t.classIds.includes('ALL')) {
        setSelectedClassIds(['ALL']);
      } else {
        const valid = t.classIds.filter((id) => validClassIdSet.has(id));
        setSelectedClassIds(valid.length > 0 ? valid : (classes.length > 0 ? [classes[0].id] : ['ALL']));
      }
    } else if (t.classId) {
      if (t.classId === 'ALL') {
        setSelectedClassIds(['ALL']);
      } else if (validClassIdSet.has(t.classId)) {
        setSelectedClassIds([t.classId]);
      } else {
        setSelectedClassIds(classes.length > 0 ? [classes[0].id] : ['ALL']);
      }
    } else {
      setSelectedClassIds(['ALL']);
    }
  };

  const handleSaveTopic = () => {
    if (!name.trim()) return;

    if (!isAllClasses && selectedClassObjects.length === 0) {
      return;
    }

    const finalClassIds = isAllClasses
      ? ['ALL']
      : selectedClassObjects.map((c: Classroom) => c.id);
    const primaryClassId = finalClassIds.includes('ALL') ? 'ALL' : (finalClassIds[0] || 'ALL');

    if (isAddingTopic) {
      addTopic({
        name: name.trim(),
        description: description.trim(),
        order: topics.length + 1,
        classId: primaryClassId,
        classIds: finalClassIds,
      });
      setIsAddingTopic(false);
    } else if (editingTopicId) {
      updateTopic(editingTopicId, {
        name: name.trim(),
        description: description.trim(),
        classId: primaryClassId,
        classIds: finalClassIds,
      });
      setEditingTopicId(null);
    }
    setName('');
    setDescription('');
    setSelectedClassIds(initialClassId ? [initialClassId] : ['ALL']);
  };

  const handleCancelTopic = () => {
    setIsAddingTopic(false);
    setEditingTopicId(null);
    setName('');
    setDescription('');
    setSelectedClassIds(initialClassId ? [initialClassId] : ['ALL']);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...topics];
    const [draggedItem] = reordered.splice(draggedIdx, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    reorderTopics(reordered.map((t) => t.id));
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Thống kê số lượng bài tập chưa phân vào chủ đề
  const unassignedProblemsCount = useMemo(() => {
    const validTopicIds = new Set(topics.map((t) => t.id));
    return problems.filter((p) => !p.topicId || !validTopicIds.has(p.topicId)).length;
  }, [problems, topics]);

  // Danh sách bài tập hiển thị trong Tab "Các bài tập"
  const filteredProblems = useMemo(() => {
    const validTopicIds = new Set(topics.map((t) => t.id));
    const q = problemSearch.toLowerCase().trim();

    return problems.filter((p) => {
      // 1. Tìm kiếm theo mã hoặc tiêu đề hoặc tác giả
      if (q) {
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchAuthor = (p.author || '').toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchAuthor) return false;
      }

      // 2. Lọc theo chủ đề
      if (problemTopicFilter === '__UNASSIGNED__') {
        if (p.topicId && validTopicIds.has(p.topicId)) return false;
      } else if (problemTopicFilter !== 'ALL') {
        if (p.topicId !== problemTopicFilter) return false;
      }

      return true;
    });
  }, [problems, topics, problemSearch, problemTopicFilter]);

  // Danh sách chủ đề sau khi áp dụng bộ lọc theo lớp
  const displayedTopics = topics.filter((t) => isTopicInClass(t, selectedClassFilter));

  return (
    <div className="space-y-6" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1F1D1A] tracking-tight">
            Chủ đề & bài tập
          </h1>
          <p className="text-sm text-[#6B655C] mt-1">
            Tạo chủ đề, chọn lớp được giao, thêm bài tập vào từng chủ đề. Kéo thả hàng để đổi thứ tự.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCreatingForTopicId(activeTab === 'topics' ? (topics[0]?.id || '') : '')}
            className="px-4 py-2 rounded-lg border border-[#D9D2C3] bg-white hover:bg-[#F4EFE6] text-[#1F1D1A] text-sm font-medium transition-colors cursor-pointer"
          >
            Thêm bài tập mới
          </button>

          {activeTab === 'topics' && !isAddingTopic && !editingTopicId && (
            <button
              onClick={handleStartAddTopic}
              className="px-4 py-2 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Thêm chủ đề mới
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher: Danh sách Chủ đề vs Các bài tập */}
      <div className="flex items-center gap-6 border-b border-[#D9D2C3] pb-0 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`pb-2.5 text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'topics'
              ? 'border-b-2 border-[#B4281F] text-[#1F1D1A]'
              : 'border-b-2 border-transparent text-[#6B655C] hover:text-[#1F1D1A]'
          }`}
        >
          Danh sách chủ đề ({topics.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('problems')}
          className={`pb-2.5 text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'problems'
              ? 'border-b-2 border-[#B4281F] text-[#1F1D1A]'
              : 'border-b-2 border-transparent text-[#6B655C] hover:text-[#1F1D1A]'
          }`}
        >
          Các bài tập ({problems.length})
        </button>
      </div>

      {activeTab === 'topics' && (
        <>
          {/* Bộ lọc chủ đề theo lớp */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B655C]">Lọc theo lớp</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#FAF7EE] border border-[#D9D2C3] rounded text-sm text-[#1F1D1A] outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả lớp học ({topics.length} chủ đề)</option>
                {classes.map((cls) => {
                  const count = topics.filter((t) => isTopicInClass(t, cls.id)).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.className} ({count} chủ đề)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="text-sm text-[#6B655C]">
              Đang hiển thị {displayedTopics.length} / {topics.length} chủ đề
            </div>
          </div>

          {/* Add / Edit Form Box for Topic */}
          {(isAddingTopic || editingTopicId) && (
            <div className="bg-[#FFFDF8] border border-[#D9D2C3] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D5]">
                <h4 className="text-base font-bold text-[#1F1D1A]">
                  {isAddingTopic ? 'Tạo chủ đề bài tập mới' : 'Chỉnh sửa chủ đề'}
                </h4>
                <button
                  onClick={handleCancelTopic}
                  className="text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F1D1A] mb-1">
                    Tên chủ đề: *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: CĐ1 - NHẬP XUẤT VÀ ĐIỀU KIỆN"
                    className="w-full px-3.5 py-2 bg-white border border-[#1F1D1A] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#1F1D1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F1D1A] mb-1">
                    Mô tả ngắn:
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung chủ đề..."
                    className="w-full px-3.5 py-2 bg-white border border-[#D9D2C3] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F1D1A]"
                  />
                </div>
              </div>

              {/* Tích chọn lớp học */}
              <div className="space-y-2.5 pt-3 border-t border-[#E5E0D5]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-[#1F1D1A]">
                    Giao vào các Lớp học:
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer ${
                        isAllClasses
                          ? 'bg-[#1F1D1A] text-white border-[#1F1D1A]'
                          : 'bg-white text-[#1F1D1A] border-[#D9D2C3]'
                      }`}
                    >
                      Tất cả các lớp
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllClasses}
                      className="px-2.5 py-1 rounded text-xs font-medium text-[#6B655C] bg-white border border-[#D9D2C3] cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {classes.map((cls) => {
                    const isSelected = isAllClasses || selectedClassObjects.some((c: Classroom) => c.id === cls.id);
                    return (
                      <div
                        key={cls.id}
                        onClick={() => handleToggleClass(cls.id)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                          isSelected
                            ? 'bg-[#FAF7EE] border-[#B4281F] text-[#1F1D1A]'
                            : 'bg-white border-[#D9D2C3] text-[#6B655C]'
                        }`}
                      >
                        <span className="text-xs font-bold truncate">{cls.className}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-[#B4281F]">Đã chọn</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D5]">
                <button
                  onClick={handleCancelTopic}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#1F1D1A] hover:text-[#6B655C] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveTopic}
                  disabled={!isAllClasses && selectedClassObjects.length === 0}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#B4281F] hover:bg-[#8F1F18] text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Lưu chủ đề
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto pt-2">
            <div className="min-w-[760px]">
              {/* Table Column Headers */}
              <div className="border-t-2 border-[#1F1D1A] py-3 grid grid-cols-[40px_260px_160px_1fr_100px_160px] items-center gap-3 text-[13px] text-[#6B655C] font-normal">
                <div>#</div>
                <div>Tên chủ đề</div>
                <div>Lớp được giao</div>
                <div>Mô tả</div>
                <div>Số bài</div>
                <div></div>
              </div>

              {displayedTopics.length === 0 ? (
                <div className="border-t border-[#D9D2C3] py-12 text-center text-[#6B655C]">
                  <p className="text-base font-bold text-[#1F1D1A]">Chưa có chủ đề nào phù hợp</p>
                  <p className="text-xs text-[#6B655C] mt-1">
                    Nhấp vào nút "Thêm chủ đề mới" ở trên để bắt đầu tạo chủ đề.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#D9D2C3]">
                  {displayedTopics.map((t, idx) => {
                    const topicProblems = problems.filter((p) => p.topicId === t.id);
                    const isExpanded = expandedTopicId === t.id;

                    const ids =
                      t.classIds && t.classIds.length > 0
                        ? t.classIds
                        : t.classId
                        ? [t.classId]
                        : ['ALL'];
                    const isAll = ids.includes('ALL');
                    const targetClasses = classes.filter((c) => ids.includes(c.id));
                    const assignedLabel = isAll
                      ? 'Tất cả các lớp'
                      : targetClasses.length > 0
                      ? targetClasses.map((c) => c.className).join(', ')
                      : 'Chưa giao lớp nào';

                    return (
                      <div key={t.id}>
                        <div
                          draggable={!editingTopicId}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setExpandedTopicId(isExpanded ? null : t.id)}
                          className={`py-3.5 grid grid-cols-[40px_260px_160px_1fr_100px_160px] items-center gap-3 text-sm hover:bg-black/[0.01] transition-colors cursor-pointer select-none ${
                            draggedIdx === idx ? 'opacity-40' : ''
                          }`}
                        >
                          {/* # */}
                          <div className="text-sm text-[#6B655C]">
                            {idx + 1}
                          </div>

                          {/* Tên chủ đề */}
                          <div>
                            <span className="font-bold text-[#1F1D1A] text-sm hover:text-[#B4281F]">
                              {t.name}
                            </span>
                          </div>

                          {/* Lớp được giao */}
                          <div className="text-sm text-[#1F1D1A] truncate" title={assignedLabel}>
                            {assignedLabel}
                          </div>

                          {/* Mô tả */}
                          <div className="text-sm text-[#6B655C] truncate">
                            {t.description || 'Chưa có mô tả'}
                          </div>

                          {/* Số bài */}
                          <div className="text-sm text-[#1F1D1A]">
                            {topicProblems.length} bài
                          </div>

                          {/* Thao tác */}
                          <div className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setCreatingForTopicId(t.id)}
                              className="text-sm font-semibold text-[#B4281F] hover:underline cursor-pointer"
                            >
                              + Thêm bài
                            </button>
                            <button
                              onClick={() => handleStartEditTopic(t)}
                              className="text-sm text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer ml-3"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => {
                                openConfirmModal({
                                  title: 'Xác nhận xóa chủ đề',
                                  message: `Bạn có chắc chắn muốn xóa chủ đề "${t.name}"? Các bài tập trong chủ đề này vẫn được bảo lưu.`,
                                  confirmLabel: 'Xác nhận xóa',
                                  onConfirm: () => deleteTopic(t.id),
                                });
                              }}
                              className="text-sm text-[#6B655C] hover:text-[#B4281F] cursor-pointer ml-3"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>

                        {/* Expanded Drill-down Problems list */}
                        {isExpanded && (
                          <div className="bg-[#FAF7EE] border-t border-[#E5E0D5] p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[#D9D2C3]">
                              <span className="font-bold text-xs uppercase text-[#1F1D1A]">
                                Danh sách bài tập trong chủ đề: {t.name}
                              </span>
                              <button
                                onClick={() => setCreatingForTopicId(t.id)}
                                className="text-xs font-semibold text-[#B4281F] hover:underline"
                              >
                                + Thêm bài tập
                              </button>
                            </div>

                            {topicProblems.length === 0 ? (
                              <div className="py-4 text-center text-xs text-[#6B655C]">
                                Chủ đề này chưa có bài tập nào. Bấm "+ Thêm bài" để nạp bài tập mới.
                              </div>
                            ) : (
                              <div className="divide-y divide-[#E5E0D5]">
                                {topicProblems.map((prob) => {
                                  const testCount =
                                    prob.testCases && prob.testCases.length > 0
                                      ? prob.testCases.length
                                      : asyncTestCounts[prob.id] || 0;
                                  return (
                                    <div
                                      key={prob.id}
                                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-[#1F1D1A]">
                                          {prob.code}
                                        </span>
                                        <span className="font-medium text-[#1F1D1A]">
                                          {prob.title}
                                        </span>
                                        <span className="text-[#6B655C]">
                                          • {prob.totalPoints}đ
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => setManagingTestsProblem(prob)}
                                          className="text-xs font-semibold text-[#1F1D1A] hover:underline"
                                        >
                                          {testCount > 0 ? `${testCount} Tests` : 'Chưa có Test!'}
                                        </button>
                                        <button
                                          onClick={() => setConfiguringVideoProblem(prob)}
                                          className="text-xs text-[#6B655C] hover:text-[#1F1D1A]"
                                        >
                                          Video
                                        </button>
                                        <button
                                          onClick={() => setEditingProblem(prob)}
                                          className="text-xs text-[#6B655C] hover:text-[#1F1D1A]"
                                        >
                                          Sửa
                                        </button>
                                        <button
                                          onClick={() => {
                                            openConfirmModal({
                                              title: 'Xác nhận xóa bài tập',
                                              message: `Bạn có chắc chắn muốn xóa bài [${prob.code}] "${prob.title}"?`,
                                              confirmLabel: 'Xác nhận xóa',
                                              onConfirm: () => deleteProblem(prob.id),
                                            });
                                          }}
                                          className="text-xs text-[#6B655C] hover:text-[#B4281F]"
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab Các bài tập */}
      {activeTab === 'problems' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Bộ lọc & Tìm kiếm bài tập */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FAF7EE] border border-[#D9D2C3] rounded-lg">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Ô tìm kiếm */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  placeholder="Tìm theo mã bài, tiêu đề, tác giả..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D9D2C3] rounded-lg text-xs text-[#1F1D1A] placeholder-stone-400 focus:outline-none focus:border-[#1F1D1A] font-medium"
                />
              </div>

              {/* Lọc theo chủ đề */}
              <div className="flex items-center gap-1.5">
                <select
                  value={problemTopicFilter}
                  onChange={(e) => setProblemTopicFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[#D9D2C3] rounded-lg text-xs text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] font-medium cursor-pointer"
                >
                  <option value="ALL">Tất cả chủ đề ({problems.length} bài)</option>
                  <option value="__UNASSIGNED__">
                    Chưa phân vào chủ đề ({unassignedProblemsCount} bài)
                  </option>
                  {topics.map((t) => {
                    const count = problems.filter((p) => p.topicId === t.id).length;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({count} bài)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6B655C]">
                Đang hiển thị <b className="text-[#1F1D1A] font-mono">{filteredProblems.length}</b> / <b className="text-[#6B655C] font-mono">{problems.length}</b> bài tập
              </span>
              <button
                type="button"
                onClick={() => setCreatingForTopicId('')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bài mới</span>
              </button>
            </div>
          </div>

          {/* Bảng danh sách tất cả các bài tập */}
          <div className="border border-[#D9D2C3] bg-white rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#D9D2C3] text-[11px] font-bold uppercase text-[#6B655C] bg-[#FAF7EE]">
                    <th className="py-3 px-4 w-14 text-center">STT</th>
                    <th className="py-3 px-4">Mã bài</th>
                    <th className="py-3 px-4">Tiêu đề bài tập</th>
                    <th className="py-3 px-4">Chủ đề</th>
                    <th className="py-3 px-4 text-center">Lớp được giao</th>
                    <th className="py-3 px-4">Thông số</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredProblems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <BookOpen className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                        <p className="font-semibold text-sm">Không tìm thấy bài tập nào phù hợp</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Thử thay đổi bộ lọc tìm kiếm hoặc nhấp vào "Thêm bài mới" để tạo bài tập.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProblems.map((prob, idx) => {
                      const topic = topics.find((t) => t.id === prob.topicId);
                      const targetClass = classes.find((c) => c.id === prob.classId);
                      const testCount =
                        prob.testCases && prob.testCases.length > 0
                          ? prob.testCases.length
                          : (asyncTestCounts[prob.id] || 0);
                      const hasVideo = prob.videoConfig?.enabled && prob.videoConfig?.url;

                      return (
                        <tr
                          key={prob.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-500 dark:text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 text-xs">
                              {prob.code}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-950 dark:text-white text-xs sm:text-sm">
                              {prob.title}
                            </div>
                            {prob.author && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Nguồn: {prob.author}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {topic ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                <Layers className="w-3.5 h-3.5 shrink-0" />
                                <span>{topic.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Chưa phân chủ đề</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {(() => {
                              // 1. Nếu bài tập đã được gán vào 1 chủ đề: hiển thị các lớp được giao chủ đề đó
                              if (topic) {
                                const topicClassIds = topic.classIds && topic.classIds.length > 0
                                  ? topic.classIds
                                  : (topic.classId ? [topic.classId] : ['ALL']);

                                if (topicClassIds.includes('ALL')) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                      <Globe className="w-3 h-3" />
                                      <span>Tất cả các lớp</span>
                                    </span>
                                  );
                                }

                                const targetClasses = classes.filter((c) => topicClassIds.includes(c.id));
                                if (targetClasses.length === 0) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">
                                      Chưa gán lớp cho chủ đề
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[200px] mx-auto">
                                    {targetClasses.map((c) => (
                                      <span
                                        key={c.id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold shadow-sm"
                                        title={`Mã vào lớp: ${c.joinCode}`}
                                      >
                                        <GraduationCap className="w-3 h-3 shrink-0" />
                                        <span>{c.className}</span>
                                      </span>
                                    ))}
                                  </div>
                                );
                              }

                              // 2. Nếu bài tập chưa phân vào chủ đề: hiển thị lớp trực tiếp của bài hoặc lưu trữ
                              if (prob.classId === 'ALL') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                    <Globe className="w-3 h-3" />
                                    <span>Tất cả các lớp</span>
                                  </span>
                                );
                              }

                              if (prob.classId && prob.classId !== 'NONE') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">
                                    <GraduationCap className="w-3 h-3 text-red-400" />
                                    <span>{targetClass?.className || prob.classId}</span>
                                  </span>
                                );
                              }

                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                                  🔒 Không giao lớp nào (Lưu trữ)
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span className="font-mono font-bold text-amber-500">{prob.totalPoints}đ</span>
                              <span>•</span>
                              <span
                                className={`font-semibold ${
                                  prob.difficulty === 'Dễ'
                                    ? 'text-emerald-500'
                                    : prob.difficulty === 'Trung bình'
                                    ? 'text-blue-500'
                                    : 'text-amber-500'
                                }`}
                              >
                                {prob.difficulty}
                              </span>
                              <span>•</span>
                              <span className="font-mono flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> {prob.timeLimit}s
                              </span>
                              <span>•</span>
                              <span className="font-mono flex items-center gap-0.5">
                                <HardDrive className="w-3 h-3" /> {prob.memoryLimit}MB
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Tests button */}
                              <button
                                type="button"
                                onClick={() => setManagingTestsProblem(prob)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  testCount > 0
                                    ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:bg-blue-600 hover:text-white'
                                    : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                                }`}
                                title="Quản lý bộ test Themis"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>{testCount > 0 ? `${testCount} Tests (Themis)` : 'Chưa có Test!'}</span>
                              </button>

                              {/* Video button */}
                              <button
                                type="button"
                                onClick={() => setConfiguringVideoProblem(prob)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                  hasVideo
                                    ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:text-white'
                                }`}
                                title="Cấu hình video chữa bài"
                              >
                                <Video className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                <span>{hasVideo ? 'Đã gắn video' : '+ Gắn video'}</span>
                              </button>

                              {/* Sửa button */}
                              <button
                                type="button"
                                onClick={() => setEditingProblem(prob)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Sửa đề bài & chủ đề"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Xóa button */}
                              <button
                                type="button"
                                onClick={() => {
                                  openConfirmModal({
                                    title: 'Xác nhận xóa bài tập',
                                    message: `Bạn có chắc chắn muốn xóa bài [${prob.code}] "${prob.title}"? Tất cả bài nộp liên quan cũng sẽ bị gỡ bỏ.`,
                                    confirmLabel: 'Xác nhận xóa',
                                    onConfirm: () => deleteProblem(prob.id),
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Xóa bài tập này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Problem Editor Modal */}
      {(creatingForTopicId !== null || editingProblem !== null) && (
        <ProblemEditorModal
          problem={editingProblem}
          initialTopicId={creatingForTopicId || undefined}
          classId={
            creatingForTopicId
              ? (() => {
                  const targetTopic = topics.find((t) => t.id === creatingForTopicId);
                  if (!targetTopic) return undefined;
                  const ids = targetTopic.classIds && targetTopic.classIds.length > 0
                    ? targetTopic.classIds
                    : (targetTopic.classId ? [targetTopic.classId] : ['ALL']);
                  return ids[0] !== 'ALL' ? ids[0] : undefined;
                })()
              : undefined
          }
          onClose={() => {
            setCreatingForTopicId(null);
            setEditingProblem(null);
          }}
        />
      )}

      {/* Test Case Manager Modal */}
      {managingTestsProblem && (
        <ErrorBoundary
          fallback={(_err, reset) => (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
                <h4 className="text-sm font-bold text-white">Đã lưu trữ an toàn cấu hình</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dữ liệu bài tập của bạn đã được bảo vệ. Vui lòng thử mở lại cửa sổ test case.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setManagingTestsProblem(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          )}
        >
          <TestCaseManagerModal
            problem={managingTestsProblem}
            onClose={() => setManagingTestsProblem(null)}
          />
        </ErrorBoundary>
      )}

      {/* Video Config Modal */}
      {configuringVideoProblem && (
        <VideoConfigModal
          problem={configuringVideoProblem}
          onClose={() => setConfiguringVideoProblem(null)}
        />
      )}
    </div>
  );
};
