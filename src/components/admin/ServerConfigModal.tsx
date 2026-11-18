import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
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
  const getInitialDisplayUrl = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('faminh_judge0_api_url');
      if (saved && saved.trim() && saved !== '/api/judge0') return saved.trim();
    }
    return DEFAULT_JUDGE0_URL;
  };

  const [serverUrl, setLocalServerUrl] = useState<string>(getInitialDisplayUrl);
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
      const current = getInitialDisplayUrl();
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white border border-[#D9D2C3] rounded-2xl shadow-2xl overflow-hidden text-[#1F1D1A]"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[#1F1D1A] tracking-tight">
                  Cấu hình máy chủ chấm bài
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded text-[#6B655C] border border-[#D9D2C3] bg-[#FAF7EE]">
                  Judge0
                </span>
              </div>
              <p className="text-xs text-[#6B655C] mt-1">
                Kết nối hệ thống chấm tự động với máy chủ riêng của FAMINH.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#6B655C] hover:text-[#1F1D1A] transition-colors cursor-pointer p-1"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="border-b border-[#D9D2C3] mt-4" />
        </div>

        {/* Body */}
        <div className="px-6 py-2 space-y-5">
          {/* Trạng thái kết nối hiện tại */}
          <div className="p-4 rounded-xl border border-[#D9D2C3] bg-white flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <span
                className={`w-3 h-3 rounded-xs shrink-0 mt-0.5 ${
                  isTesting
                    ? 'bg-amber-500 animate-pulse'
                    : testStatus.success
                    ? 'bg-[#2E7D32]'
                    : 'bg-[#B4281F]'
                }`}
              />
              <div>
                <div className="text-sm font-bold text-[#1F1D1A] flex items-center gap-1.5">
                  {isTesting ? (
                    <span>Đang kiểm tra kết nối...</span>
                  ) : testStatus.success ? (
                    <>
                      <span>Hoạt động tốt</span>
                      {testStatus.version && (
                        <span className="text-xs font-mono font-normal text-[#6B655C]">
                          v{testStatus.version}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#B4281F]">Mất kết nối</span>
                  )}
                </div>
                <div className="text-xs text-[#6B655C] mt-0.5">
                  {isTesting
                    ? 'Đang gửi gói tin ping đến VPS...'
                    : testStatus.success
                    ? `Kết nối máy chủ Judge0 thành công${
                        testStatus.latencyMs !== undefined ? ` (${testStatus.latencyMs} ms)` : ''
                      }`
                    : testStatus.message || 'Chưa kiểm tra'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={isTesting}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#1F1D1A] text-[#1F1D1A] bg-white hover:bg-[#FAF7EE] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
            </button>
          </div>

          {/* Ô nhập URL Server */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#1F1D1A]">
              Địa chỉ IP hoặc URL của máy chủ
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setLocalServerUrl(e.target.value)}
              placeholder={DEFAULT_JUDGE0_URL}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9D2C3] bg-white focus:outline-none focus:border-[#1F1D1A] text-sm text-[#1F1D1A] font-mono transition-colors"
            />
            <div className="space-y-0.5 pt-0.5">
              <p className="text-xs text-[#6B655C]">
                Mặc định: <span className="font-mono">{DEFAULT_JUDGE0_URL}</span> (VPS riêng của FAMINH).
              </p>
              <p className="text-xs text-[#2E7D32]">
                Đã bật Secure HTTPS Proxy, tự vượt lỗi Mixed Content để kết nối an toàn.
              </p>
            </div>
          </div>

          <div className="border-b border-[#D9D2C3]" />

          {/* Card ưu điểm hệ thống */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[#1F1D1A]">
              Vì sao nên dùng máy chủ VPS riêng
            </h4>
            <ul className="space-y-1.5 text-xs text-[#1F1D1A]">
              <li>
                • <strong className="font-bold">Chấm nhanh:</strong> thời gian chấm chỉ 0.005s – 0.020s mỗi test.
              </li>
              <li>
                • <strong className="font-bold">Không nghẽn mạng:</strong> tự xếp hàng và chấm song song khi cả lớp nộp bài.
              </li>
              <li>
                • <strong className="font-bold">Cô lập an toàn:</strong> sandbox cgroup v1 bảo vệ máy chủ.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 mt-4 border-t border-[#D9D2C3]">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-[#6B655C] hover:text-[#1F1D1A] underline cursor-pointer"
          >
            Khôi phục mặc định
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-[#1F1D1A] hover:underline cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white transition-colors cursor-pointer shadow-xs"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

