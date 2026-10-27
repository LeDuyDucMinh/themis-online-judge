import React from 'react';
import type { VideoConfig } from '../../types/judge';
import { Video, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface VideoSectionProps {
  videoConfig: VideoConfig;
  hasSubmitted: boolean;
  isFullScore: boolean;
}

export const VideoSection: React.FC<VideoSectionProps> = ({
  videoConfig,
  hasSubmitted,
  isFullScore,
}) => {
  if (!videoConfig || !videoConfig.enabled || !videoConfig.url) {
    return null;
  }

  // Kiểm tra điều kiện mở khóa
  let isUnlocked = false;
  let lockReason = '';

  if (videoConfig.unlockRule === 'always') {
    isUnlocked = true;
  } else if (videoConfig.unlockRule === 'after_submission') {
    isUnlocked = hasSubmitted;
    lockReason = 'Bạn cần nộp bài ít nhất 1 lần để mở khóa video hướng dẫn này.';
  } else if (videoConfig.unlockRule === 'full_score') {
    isUnlocked = isFullScore;
    lockReason = 'Bạn cần đạt điểm tối đa (Full AC 100%) để mở khóa video bài giảng chuyên sâu này.';
  }

  // Chuyển link YouTube thông thường thành link embed
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        const v = urlParams.get('v');
        return `https://www.youtube.com/embed/${v}`;
      }
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (url.includes('drive.google.com/file/d/')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
      }
    } catch {
      return url;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(videoConfig.url);

  return (
    <div className="mt-8 bg-[#0d121d] border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
            {videoConfig.type === 'youtube' ? <YoutubeIcon className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              {videoConfig.title || 'Video Hướng Dẫn & Chữa Bài Chi Tiết'}
            </h4>
            <p className="text-[11px] text-slate-400">
              Bài giảng video từ giáo viên hướng dẫn tư duy thuật toán và tối ưu độ phức tạp
            </p>
          </div>
        </div>

        {isUnlocked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã mở khóa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Lock className="w-3.5 h-3.5" /> Đang khóa
          </span>
        )}
      </div>

      {/* Video Content or Lock Overlay */}
      <div className="p-6">
        {isUnlocked ? (
          <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-black shadow-lg border border-slate-800">
            {videoConfig.type === 'direct' ? (
              <video src={videoConfig.url} controls className="w-full h-full object-contain" />
            ) : (
              <iframe
                src={embedUrl}
                title={videoConfig.title || 'Video chữa bài'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        ) : (
          <div className="py-12 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h5 className="font-bold text-base text-slate-200">Video chưa được mở khóa</h5>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{lockReason}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Hãy thử tự suy nghĩ và giải bài trước nhé!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
