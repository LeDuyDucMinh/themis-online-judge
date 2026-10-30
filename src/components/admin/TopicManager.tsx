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
  ListTree,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Layers,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Video,
  FilePlus,
  Clock,
  HardDrive,
  GraduationCap,
  Globe,
  Filter,
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
    getStudentsInClass,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <ListTree className="w-5 h-5 text-[#c51f26] dark:text-red-400" />
            Quản lý Chủ đề & Bài tập (Topics & Problems)
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Tạo chủ đề, tích chọn các lớp học được giao, thêm bài tập cụ thể vào từng chủ đề và quản lý thứ tự giảng dạy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút thêm bài tập mới */}
          <button
            onClick={() => setCreatingForTopicId(activeTab === 'topics' ? (topics[0]?.id || '') : '')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-[#c51f26] text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-emerald-600" />
            <span>Thêm bài tập mới</span>
          </button>

          {/* Nút thêm chủ đề */}
          {activeTab === 'topics' && !isAddingTopic && !editingTopicId && (
            <button
              onClick={handleStartAddTopic}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm chủ đề mới
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher: Danh sách Chủ đề vs Các bài tập */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`pb-2 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'topics'
              ? 'border-[#c51f26] text-[#c51f26] dark:text-red-400'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <ListTree className="w-4 h-4" />
          <span>Danh sách Chủ đề</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono font-semibold">
            {topics.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('problems')}
          className={`pb-2 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'problems'
              ? 'border-[#c51f26] text-[#c51f26] dark:text-red-400'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Các bài tập</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-50 dark:bg-red-950/20 text-[#c51f26] dark:text-red-400 font-mono font-bold">
            {problems.length}
          </span>
          {unassignedProblemsCount > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold"
              title={`${unassignedProblemsCount} bài tập chưa phân vào chủ đề`}
            >
              {unassignedProblemsCount} chưa gán
            </span>
          )}
        </button>
      </div>

      {activeTab === 'topics' && (
        <>

      {/* Bộ lọc chủ đề theo lớp */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#c51f26] dark:text-red-400" />
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Lọc chủ đề theo lớp:</span>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:border-[#c51f26] font-medium cursor-pointer"
          >
            <option value="ALL">🌐 Tất cả lớp học ({topics.length} chủ đề)</option>
            {classes.map((cls) => {
              const count = topics.filter((t) => isTopicInClass(t, cls.id)).length;
              return (
                <option key={cls.id} value={cls.id}>
                  🏫 {cls.className} ({count} chủ đề)
                </option>
              );
            })}
          </select>
        </div>

        <span className="text-xs text-stone-500 dark:text-stone-400">
          Đang hiển thị <b className="text-stone-900 dark:text-white font-mono">{displayedTopics.length}</b> / <b className="text-stone-700 dark:text-stone-300 font-mono">{topics.length}</b> chủ đề
        </span>
      </div>

      {/* Add / Edit Form Box for Topic */}
      {(isAddingTopic || editingTopicId) && (
        <div className="bg-white dark:bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-red-600 dark:text-red-300 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {isAddingTopic ? 'Tạo chủ đề bài tập mới' : 'Chỉnh sửa chủ đề'}
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tích chọn 1 hoặc nhiều lớp bên dưới để giao chủ đề cùng lúc
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên chủ đề: *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Mảng 1 chiều, Quy hoạch động, Số học..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả ngắn về chủ đề:
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ví dụ: Rèn luyện kỹ thuật cơ bản, prefix sum, binary search..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* KHUNG TÍCH CHỌN CÁC LỚP HỌC (MULTI-CLASSROOM CHECKBOX GROUP) */}
          <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-red-500 dark:text-red-400" />
                <span>Giao vào các Lớp học (Tích chọn một hoặc nhiều lớp): *</span>
              </label>

              {/* Thao tác chọn nhanh */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                    isAllClasses
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-300 dark:border-slate-700'
                  }`}
                  title="Giao cho tất cả học sinh ở mọi lớp học"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Tất cả các lớp</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllClasses}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {/* Lưới các thẻ Lớp học kèm Checkbox */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {classes.map((cls) => {
                const isSelected = isAllClasses || selectedClassObjects.some((c: Classroom) => c.id === cls.id);
                const studentCount = getStudentsInClass(cls.id).length;

                return (
                  <div
                    key={cls.id}
                    onClick={() => handleToggleClass(cls.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? 'bg-red-500/15 border-red-500/50 shadow-sm shadow-red-500/10 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox Icon */}
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="truncate">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
                          <span className="truncate">{cls.className}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          Mã: <span className="text-slate-700 dark:text-slate-300 font-bold">{cls.joinCode}</span> • {studentCount} HS
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shrink-0">
                        Đã chọn
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Thanh hiển thị trạng thái số lớp đã chọn */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
              {isAllClasses ? (
                <div className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 font-medium">
                  <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Chủ đề này đang được giao công khai cho <b>Tất cả các lớp ({classes.length} lớp học)</b>.</span>
                </div>
              ) : selectedClassObjects.length > 0 ? (
                <div className="text-red-600 dark:text-red-400 flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4 text-red-500 shrink-0" />
                  <span>
                    Đang giao cho <b>{selectedClassObjects.length} lớp</b>:{' '}
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                      {selectedClassObjects.map((c: Classroom) => c.className).join(', ')}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                  <span>⚠️ Bạn chưa tích chọn lớp nào. Vui lòng bấm vào lớp muốn giao bài hoặc chọn "Tất cả các lớp".</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              onClick={handleCancelTopic}
              className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Hủy
            </button>
            <button
              onClick={handleSaveTopic}
              disabled={!isAllClasses && selectedClassObjects.length === 0}
              className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                !isAllClasses && selectedClassObjects.length === 0
                  ? 'bg-stone-300 dark:bg-stone-700 opacity-50 cursor-not-allowed'
                  : 'bg-[#c51f26] hover:bg-[#a8181e]'
              }`}
            >
              <Check className="w-4 h-4" /> Lưu chủ đề
            </button>
          </div>
        </div>
      )}

      {/* Topics List Table & Drill-down Problems */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50">
                <th className="py-3 px-4 w-16 text-center" title="Kéo thả hàng để sắp xếp thứ tự">STT</th>
                <th className="py-3 px-4">Tên chủ đề</th>
                <th className="py-3 px-4 text-center">Lớp được giao</th>
                <th className="py-3 px-4">Mô tả</th>
                <th className="py-3 px-4 text-center">Số bài tập</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {displayedTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Layers className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="font-semibold text-sm">Chưa có chủ đề nào phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Nhấp vào nút "+ Thêm chủ đề mới" ở trên để bắt đầu tạo chủ đề và giao vào lớp học.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedTopics.map((t, idx) => {
                const topicProblems = problems.filter((p) => p.topicId === t.id);
                const isExpanded = expandedTopicId === t.id;

                return (
                  <React.Fragment key={t.id}>
                    <tr
                      draggable={!editingTopicId}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none ${
                        isExpanded ? 'bg-slate-100/80 dark:bg-slate-800/60' : ''
                      } ${draggedIdx === idx ? 'opacity-40 bg-slate-200 dark:bg-slate-800' : ''} ${
                        dragOverIdx === idx && draggedIdx !== idx
                          ? 'border-t-2 border-red-500 bg-red-500/10'
                          : ''
                      }`}
                      onClick={() => setExpandedTopicId(isExpanded ? null : t.id)}
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500 dark:text-slate-400">
                        <div
                          className="flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-red-500 transition-colors"
                          title="Kéo thả hàng này để sắp xếp thứ tự chủ đề"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-4 h-4 text-slate-400 hover:text-red-500 shrink-0" />
                          <span>#{idx + 1}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-950 dark:text-white">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-red-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-slate-950 dark:text-white font-bold text-sm tracking-tight">{t.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const ids = t.classIds && t.classIds.length > 0
                            ? t.classIds
                            : (t.classId ? [t.classId] : ['ALL']);

                          if (ids.includes('ALL')) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                <Globe className="w-3 h-3" />
                                <span>Tất cả các lớp</span>
                              </span>
                            );
                          }

                          const targetClasses = classes.filter((c) => ids.includes(c.id));
                          if (targetClasses.length === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">
                                Lớp đã xóa
                              </span>
                            );
                          }

                          return (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xs mx-auto">
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
                        })()}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {t.description || 'Chưa có mô tả'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {topicProblems.length} bài
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {/* Nút thêm bài cụ thể vào chủ đề này */}
                          <button
                            onClick={() => setCreatingForTopicId(t.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-red-600/20 hover:bg-red-600 text-rose-700 dark:text-red-300 hover:text-white border border-rose-200 dark:border-red-500/30 transition-all font-bold text-xs shadow-sm cursor-pointer"
                            title="Thêm bài tập mới trực tiếp vào chủ đề này"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm bài</span>
                          </button>

                          <button
                            onClick={() => handleStartEditTopic(t)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            title="Sửa chủ đề"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            title="Xóa chủ đề"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED VIEW: Danh sách bài tập cụ thể trong chủ đề này */}
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-950/90 border-y border-slate-200 dark:border-slate-800">
                        <td colSpan={6} className="p-4 sm:p-5">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                              <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                <FileCode2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                Danh sách bài tập trong chủ đề: <span className="text-slate-950 dark:text-white normal-case font-bold">{t.name}</span>
                              </h5>
                            </div>

                            {topicProblems.length === 0 ? (
                              <div className="py-6 text-center text-slate-500 text-xs">
                                Chủ đề này chưa có bài tập nào.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                                {topicProblems.map((prob) => {
                                  const testCount =
                                    prob.testCases && prob.testCases.length > 0
                                      ? prob.testCases.length
                                      : (asyncTestCounts[prob.id] || 0);
                                  const hasVideo = prob.videoConfig?.enabled && prob.videoConfig?.url;

                                  return (
                                    <div
                                      key={prob.id}
                                      className="py-3 px-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-900/60 rounded-xl transition-colors border border-transparent hover:border-slate-200 dark:border-slate-800"
                                    >
                                      <div className="flex items-start sm:items-center gap-3">
                                        <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 shrink-0">
                                          {prob.code}
                                        </span>
                                        <div>
                                          <h6 className="font-bold text-slate-950 dark:text-white text-xs sm:text-sm">
                                            {prob.title}
                                          </h6>
                                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            <span>
                                              Thang điểm: <b className="text-amber-600 dark:text-amber-400 font-mono font-semibold">{prob.totalPoints}đ</b>
                                            </span>
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
                                            <span className="font-mono flex items-center gap-1">
                                              <Clock className="w-3 h-3 text-slate-400" /> {prob.timeLimit}s
                                            </span>
                                            <span>•</span>
                                            <span className="font-mono flex items-center gap-1">
                                              <HardDrive className="w-3 h-3 text-slate-400" /> {prob.memoryLimit}MB
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                                        {/* Nút Test Cases (Themis) */}
                                        <button
                                          onClick={() => setManagingTestsProblem(prob)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm cursor-pointer ${
                                            testCount > 0
                                              ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:bg-blue-600 hover:text-white'
                                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                                          }`}
                                          title="Nhấp để nạp ZIP hoặc chỉnh sửa test case Themis"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          <span>{testCount > 0 ? `${testCount} Tests (Themis)` : 'Chưa có Test!'}</span>
                                        </button>

                                        {/* Nút Video */}
                                        <button
                                          onClick={() => setConfiguringVideoProblem(prob)}
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                            hasVideo
                                              ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:text-white'
                                          }`}
                                          title="Nhấp để cấu hình video chữa bài"
                                        >
                                          <Video className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                          <span>{hasVideo ? 'Đã gắn video' : '+ Gắn video'}</span>
                                        </button>

                                        {/* Nút Sửa đề */}
                                        <button
                                          onClick={() => setEditingProblem(prob)}
                                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                          title="Sửa nội dung bài"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Nút Xóa bài */}
                                        <button
                                          onClick={() => {
                                            openConfirmModal({
                                              title: 'Xác nhận xóa bài tập',
                                              message: `Bạn có chắc chắn muốn xóa bài [${prob.code}] "${prob.title}" khỏi chủ đề "${t.name}"? Tất cả bài nộp liên quan cũng sẽ bị gỡ bỏ.`,
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
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Tab Các bài tập */}
      {activeTab === 'problems' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Bộ lọc & Tìm kiếm bài tập */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Ô tìm kiếm */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  placeholder="Tìm theo mã bài, tiêu đề, tác giả..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Lọc theo chủ đề */}
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                <select
                  value={problemTopicFilter}
                  onChange={(e) => setProblemTopicFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium cursor-pointer"
                >
                  <option value="ALL">🌐 Tất cả chủ đề ({problems.length} bài)</option>
                  <option value="__UNASSIGNED__">
                    ⚠️ Chưa phân vào chủ đề ({unassignedProblemsCount} bài)
                  </option>
                  {topics.map((t) => {
                    const count = problems.filter((p) => p.topicId === t.id).length;
                    return (
                      <option key={t.id} value={t.id}>
                        📁 {t.name} ({count} bài)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Đang hiển thị <b className="text-slate-900 dark:text-white font-mono">{filteredProblems.length}</b> / <b className="text-slate-700 dark:text-slate-300 font-mono">{problems.length}</b> bài tập
              </span>
              <button
                type="button"
                onClick={() => setCreatingForTopicId('')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bài mới</span>
              </button>
            </div>
          </div>

          {/* Bảng danh sách tất cả các bài tập */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/40">
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
