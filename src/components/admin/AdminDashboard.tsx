import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import { idbService } from '../../services/db';
import { ProblemEditorModal } from './ProblemEditorModal';
import { TestCaseManagerModal } from './TestCaseManagerModal';
import { VideoConfigModal } from './VideoConfigModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Video,
  Search,
  BookOpen,
  Clock,
  HardDrive,
} from 'lucide-react';

interface AdminDashboardProps {
  classId?: string;
  hideHeader?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ classId, hideHeader = false }) => {
  const { problems, topics, deleteProblem, openConfirmModal, activeClassId } = useJudge();
  const currentClassId = classId || activeClassId;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | 'ALL'>('ALL');

  // Modal states
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
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

  // Filter problems scoped by classId
  const scopedProblems = currentClassId
    ? problems.filter((prob) => isProblemInClass(prob, currentClassId, topics))
    : problems;

  const filteredProblems = scopedProblems.filter((prob) => {
    const matchSearch =
      prob.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prob.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTopic = selectedTopicId === 'ALL' || prob.topicId === selectedTopicId;
    return matchSearch && matchTopic;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Khu Vực Quản Trị Đề Bài & Bộ Test (Admin Center)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Soạn thảo đề bài, nạp bộ test case chuẩn Themis, gắn video bài giảng và quản lý thang điểm
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreatingNew(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Tạo đề bài mới
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}


      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã bài hoặc tên bài tập..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#c51f26]"
          >
            <option value="ALL">Tất cả chủ đề</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {hideHeader && (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đề bài mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Problems Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50">
                <th className="py-3 px-4">Mã bài & Tiêu đề</th>
                <th className="py-3 px-4">Chủ đề</th>
                <th className="py-3 px-4">Giới hạn</th>
                <th className="py-3 px-4 text-center">Bộ Test Case (Themis)</th>
                <th className="py-3 px-4 text-center">Video bài giảng</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {filteredProblems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <BookOpen className="w-10 h-10 mx-auto text-stone-400 mb-2 opacity-50" />
                    <p className="font-semibold text-sm">Chưa có bài tập nào</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Nhấn vào nút "Tạo đề bài mới" ở trên để bắt đầu thêm bài tập vào hệ thống.
                    </p>
                    <button
                      onClick={() => setIsCreatingNew(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tạo đề bài mới</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProblems.map((prob) => {
                  const topic = topics.find((t) => t.id === prob.topicId);
                  const testCount =
                    prob.testCases && prob.testCases.length > 0
                      ? prob.testCases.length
                      : (asyncTestCounts[prob.id] || 0);
                  const hasVideo = prob.videoConfig?.enabled && prob.videoConfig?.url;

                  return (
                    <tr key={prob.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {prob.code}
                          </span>
                          <div>
                            <h4 className="font-semibold text-slate-950 dark:text-white">{prob.title}</h4>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Thang điểm: <b className="text-amber-600 dark:text-amber-400">{prob.totalPoints}đ</b> • Độ khó: {prob.difficulty}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          {topic?.name || 'Chưa gán'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1" title="Thời gian">
                            <Clock className="w-3 h-3 text-slate-500" /> {prob.timeLimit}s
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1" title="Bộ nhớ">
                            <HardDrive className="w-3 h-3 text-slate-500" /> {prob.memoryLimit}MB
                          </span>
                        </div>
                      </td>

                      {/* Test cases badge & manage button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setManagingTestsProblem(prob)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                            testCount > 0
                              ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:bg-blue-600 hover:text-white'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                          }`}
                          title="Nhấp để nạp ZIP hoặc chỉnh sửa test case"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>{testCount > 0 ? `${testCount} Tests (Themis)` : 'Chưa có Test!'}</span>
                        </button>
                      </td>

                      {/* Video guide badge & manage button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setConfiguringVideoProblem(prob)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                            hasVideo
                              ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-600 hover:text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:text-white'
                          }`}
                          title="Nhấp để cấu hình video chữa bài"
                        >
                          <Video className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                          <span>{hasVideo ? 'Đã gắn video' : '+ Gắn video'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingProblem(prob)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                            title="Sửa đề bài"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              openConfirmModal({
                                title: 'Xác nhận xóa bài tập',
                                message: `Bạn có chắc chắn muốn xóa bài tập [${prob.code}] "${prob.title}" khỏi hệ thống? Tất cả các lần nộp bài liên quan cũng sẽ bị gỡ bỏ.`,
                                confirmLabel: 'Xác nhận xóa',
                                onConfirm: () => deleteProblem(prob.id),
                              });
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                            title="Xóa bài tập"
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

      {/* Modals */}
      {(isCreatingNew || editingProblem) && (
        <ProblemEditorModal
          problem={editingProblem}
          classId={currentClassId || undefined}
          initialTopicId={selectedTopicId !== 'ALL' ? selectedTopicId : undefined}
          onClose={() => {
            setIsCreatingNew(false);
            setEditingProblem(null);
          }}
        />
      )}


      {managingTestsProblem && (
        <ErrorBoundary
          fallback={(err, reset) => (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-slate-900 border border-red-500/50 rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                  <span className="text-xl font-bold">!</span>
                </div>
                <h3 className="text-lg font-bold text-white">Không thể đọc file test</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {err?.message || 'Đã xảy ra sự cố khi tải hoặc hiển thị dữ liệu test case. Web vẫn hoạt động an toàn.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      reset();
                      setManagingTestsProblem(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Đóng cửa sổ
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                  >
                    Thử lại
                  </button>
                </div>
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

      {configuringVideoProblem && (
        <VideoConfigModal
          problem={configuringVideoProblem}
          onClose={() => setConfiguringVideoProblem(null)}
        />
      )}
    </div>
  );
};
