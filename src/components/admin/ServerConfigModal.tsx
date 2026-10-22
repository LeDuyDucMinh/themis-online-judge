import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  Zap,
  ExternalLink,
} from 'lucide-react';
import {
  getJudge0Url,
  setJudge0Url,
  testJudge0Connection,
  DEFAULT_JUDGE0_URL,
} from '../../services/judgeEngine';
import { useJudge } from '../../context/JudgeContext';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useJudge();
  const [serverUrl, setLocalServerUrl] = useState<string>(getJudge0Url());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{
    tested: boolean;
    success: boolean;
    version?: string;
    message: string;
    latencyMs?: number;
  }>({
    tested: false,
    success: false,
    message: '',
  });

  // Tự động kiểm tra kết nối khi mở modal
  useEffect(() => {
    if (isOpen) {
      const current = getJudge0Url();
      setLocalServerUrl(current);
      handleTestConnection(current);
    }
  }, [isOpen]);

  const handleTestConnection = async (targetUrl?: string) => {
    const url = targetUrl || serverUrl;
    setIsTesting(true);
    const start = performance.now();
    try {
      const res = await testJudge0Connection(url);
      const elapsed = Math.round(performance.now() - start);
      setTestStatus({
        tested: true,
        success: res.success,
        version: res.version,
        message: res.message,
        latencyMs: elapsed,
      });
    } catch {
      setTestStatus({
        tested: true,
        success: false,
        message: 'Lỗi không xác định khi kết nối máy chủ',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = serverUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      showToast('Lỗi cấu hình', 'Địa chỉ máy chủ không được để trống', 'error');
      return;
    }
    setJudge0Url(trimmed);
    showToast('Đã lưu cấu hình', `Máy chủ chấm bài đã được cập nhật: ${trimmed}`, 'success');
    onClose();
  };

  const handleResetDefault = () => {
    setLocalServerUrl(DEFAULT_JUDGE0_URL);
    handleTestConnection(DEFAULT_JUDGE0_URL);
    showToast('Đã khôi phục mặc định', `Địa chỉ: ${DEFAULT_JUDGE0_URL}`, 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-md shadow-red-500/10">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cấu hình Máy chủ Chấm bài (VPS)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                  JUDGE0
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Kết nối hệ thống chấm bài tự động với máy chủ riêng của FAMINH
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Trạng thái kết nối hiện tại */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  isTesting
                    ? 'bg-amber-400 animate-ping'
                    : testStatus.success
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                    : 'bg-rose-500 shadow-lg shadow-rose-500/50'
                }`}
              />
              <div>
                <p className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Trạng thái:</span>
                  {isTesting ? (
                    <span className="text-amber-400">Đang kiểm tra kết nối...</span>
                  ) : testStatus.success ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 inline" /> Hoạt động tốt
                      {testStatus.version && ` (v${testStatus.version})`}
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 inline" /> Mất kết nối
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isTesting
                    ? 'Đang gửi gói tin ping đến VPS...'
                    : testStatus.message || 'Chưa kiểm tra'}
                  {testStatus.latencyMs !== undefined && (
                    <span className="ml-2 text-slate-500">({testStatus.latencyMs} ms)</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTestConnection()}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>Kiểm tra</span>
            </button>
          </div>

          {/* Ô nhập URL Server */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Địa chỉ IP hoặc URL của Máy chủ Judge0:
            </label>
            <div className="relative">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setLocalServerUrl(e.target.value)}
                placeholder={DEFAULT_JUDGE0_URL}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
              <a
                href={serverUrl ? `${serverUrl.replace(/\/+$/, '')}/about` : '#'}
                target="_blank"
                rel="noreferrer"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Mở link kiểm tra trong tab mới"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400">
              Mặc định: <code className="text-red-400">{DEFAULT_JUDGE0_URL}</code> (VPS riêng của FAMINH).
            </p>
          </div>

          {/* Card ưu điểm hệ thống */}
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/30 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-red-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-red-400" />
              <span>Lợi thế khi dùng Máy chủ VPS riêng:</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Tốc độ cực nhanh:</strong> Thời gian chấm chỉ 0.005s - 0.020s / test case.
              </li>
              <li>
                <strong className="text-slate-200">Không lo nghẽn mạng:</strong> Hệ thống tự động xếp hàng và chấm song song khi cả lớp nộp bài.
              </li>
              <li>
                <strong className="text-slate-200">Cô lập an toàn:</strong> Sandbox cgroup v1 bảo vệ an toàn tuyệt đối cho máy chủ.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
