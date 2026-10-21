import React, { useState } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Topic, Problem } from '../../types/judge';
import { ProblemEditorModal } from './ProblemEditorModal';
import { TestCaseManagerModal } from './TestCaseManagerModal';
import { VideoConfigModal } from './VideoConfigModal';
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
} from 'lucide-react';

export const TopicManager: React.FC = () => {
  const {
    topics,
    problems,
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

  // Drag and drop state để kéo thả sắp xếp chủ đề
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Form states for Topic
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Modals for Problem Actions
  const [creatingForTopicId, setCreatingForTopicId] = useState<string | null>(null);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [managingTestsProblem, setManagingTestsProblem] = useState<Problem | null>(null);
  const [configuringVideoProblem, setConfiguringVideoProblem] = useState<Problem | null>(null);

  const handleStartAddTopic = () => {
    setIsAddingTopic(true);
    setEditingTopicId(null);
    setName('');
    setDescription('');
  };

  const handleStartEditTopic = (t: Topic) => {
    setEditingTopicId(t.id);
    setIsAddingTopic(false);
    setName(t.name);
    setDescription(t.description);
  };

  const handleSaveTopic = () => {
    if (!name.trim()) return;

    if (isAddingTopic) {
      addTopic({
        name: name.trim(),
        description: description.trim(),
        order: topics.length + 1,
      });
      setIsAddingTopic(false);
    } else if (editingTopicId) {
      updateTopic(editingTopicId, {
        name: name.trim(),
        description: description.trim(),
      });
      setEditingTopicId(null);
    }
    setName('');
    setDescription('');
  };

  const handleCancelTopic = () => {
    setIsAddingTopic(false);
    setEditingTopicId(null);
    setName('');
    setDescription('');
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ListTree className="w-5 h-5 text-red-400" />
            Quản lý Chủ đề & Bài tập (Topics & Problems)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tạo chủ đề, thêm bài tập cụ thể vào từng chủ đề, nạp test case và quản lý thứ tự giảng dạy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút thêm bài tập mới */}
          <button
            onClick={() => setCreatingForTopicId(topics[0]?.id || '')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all shadow cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-emerald-400" />
            <span>Thêm bài tập mới</span>
          </button>

          {/* Nút thêm chủ đề */}
          {!isAddingTopic && !editingTopicId && (
            <button
              onClick={handleStartAddTopic}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm chủ đề mới
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Form Box for Topic */}
      {(isAddingTopic || editingTopicId) && (
        <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <h4 className="text-sm font-bold text-red-300">
            {isAddingTopic ? 'Tạo chủ đề bài tập mới' : 'Chỉnh sửa chủ đề'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên chủ đề: *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Mảng 1 chiều, Nhập xuất và điều kiện..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mô tả ngắn về chủ đề:
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ví dụ: Rèn luyện kỹ thuật cơ bản, prefix sum, binary search..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleCancelTopic}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Hủy
            </button>
            <button
              onClick={handleSaveTopic}
              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Lưu chủ đề
            </button>
          </div>
        </div>
      )}

      {/* Topics List Table & Drill-down Problems */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/40">
                <th className="py-3 px-4 w-16 text-center" title="Kéo thả hàng để sắp xếp thứ tự">STT</th>
                <th className="py-3 px-4">Tên chủ đề</th>
                <th className="py-3 px-4">Mô tả</th>
                <th className="py-3 px-4 text-center">Số bài tập</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {topics.map((t, idx) => {
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
                        <td colSpan={5} className="p-4 sm:p-5">
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
                                  const testCount = prob.testCases?.length || 0;
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Problem Editor Modal */}
      {(creatingForTopicId !== null || editingProblem !== null) && (
        <ProblemEditorModal
          problem={editingProblem}
          initialTopicId={creatingForTopicId || undefined}
          onClose={() => {
            setCreatingForTopicId(null);
            setEditingProblem(null);
          }}
        />
      )}

      {/* Test Case Manager Modal */}
      {managingTestsProblem && (
        <TestCaseManagerModal
          problem={managingTestsProblem}
          onClose={() => setManagingTestsProblem(null)}
        />
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
