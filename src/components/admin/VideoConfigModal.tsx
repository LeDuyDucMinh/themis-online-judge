import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, VideoConfig } from '../../types/judge';
import {
  X,
  Video,
  Save,
  Eye,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface VideoConfigModalProps {
  problem: Problem;
  onClose: () => void;
}

export const VideoConfigModal: React.FC<VideoConfigModalProps> = ({ problem, onClose }) => {
  const { updateProblem, showToast } = useJudge();

  const [enabled, setEnabled] = useState(problem.videoConfig?.enabled ?? false);
  const [type, setType] = useState<VideoConfig['type']>(problem.videoConfig?.type || 'youtube');
  const [url, setUrl] = useState(problem.videoConfig?.url || '');
  const [title, setTitle] = useState(problem.videoConfig?.title || '');
  const [unlockRule, setUnlockRule] = useState<VideoConfig['unlockRule']>(
    problem.videoConfig?.unlockRule || 'always'
  );

  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    updateProblem(problem.id, {
      videoConfig: {
        enabled,
        type,
        url: url.trim(),
        title: title.trim() || `Video Hướng dẫn: [${problem.code}] ${problem.title}`,
        unlockRule,
      },
    });

    showToast('Đã lưu Video bài giảng', `Cập nhật cấu hình video cho bài [${problem.code}]`, 'success');
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        // Nhấp vào vùng nền đen bên ngoài để đóng modal
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Sticky Header với nút Đóng và nút X to rõ */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-800/90 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Cấu hình Video Hướng Dẫn
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bài tập: <span className="font-semibold text-slate-800 dark:text-slate-200">[{problem.code}] {problem.title}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Đóng (Phím ESC hoặc click bên ngoài)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <div>
              <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                Bật video chữa bài cho bài tập này
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Khi bật, video sẽ xuất hiện ở phần dưới cùng của trang làm bài
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {enabled && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Video Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề video bài giảng:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Video Hướng dẫn tư duy giải thuật O(N log N)..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Video Source Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nguồn phát video:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('youtube')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'youtube'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <YoutubeIcon className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('drive')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'drive'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('direct')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === 'direct'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Link MP4/WebM
                  </button>
                </div>
              </div>

              {/* Video URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Đường dẫn (URL / Link nhúng): *
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    type === 'youtube'
                      ? 'https://www.youtube.com/watch?v=...'
                      : type === 'drive'
                      ? 'https://drive.google.com/file/d/.../view'
                      : 'https://example.com/video.mp4'
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              {/* Unlock Rule Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Quy tắc hiển thị / Mở khóa video (Unlock Rules):
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setUnlockRule('always')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      unlockRule === 'always'
                        ? 'bg-red-50/80 dark:bg-red-950/25 border-red-500 ring-1 ring-red-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Luôn luôn hiển thị ở cuối bài
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Học sinh có thể xem video hướng dẫn bất cứ lúc nào khi mở bài tập
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setUnlockRule('after_submission')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      unlockRule === 'after_submission'
                        ? 'bg-red-50/80 dark:bg-red-950/25 border-red-500 ring-1 ring-red-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Chỉ mở khóa sau khi User đã nộp bài ít nhất 1 lần
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Khuyến khích học sinh chủ động code thử trước khi xem đáp án của giáo viên
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setUnlockRule('full_score')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      unlockRule === 'full_score'
                        ? 'bg-red-50/80 dark:bg-red-950/25 border-red-500 ring-1 ring-red-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Chỉ mở khóa sau khi User đạt điểm tối đa (Full AC 100%)
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Dành cho bài giảng nâng cao hoặc giải thích các kỹ thuật tối ưu hóa sau khi đã hoàn thành
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer - Đã xóa nút Đóng/Hủy thừa, giữ 1 nút Đóng trên góc và nút Lưu cấu hình Video */}
        <div className="shrink-0 p-4 bg-white/95 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end sticky bottom-0 z-10">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" /> Lưu cấu hình Video
          </button>
        </div>
      </div>
    </div>
  );
};
