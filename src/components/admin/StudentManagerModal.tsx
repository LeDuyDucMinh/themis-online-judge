import React, { useState } from 'react';
import { useJudge } from '../../context/JudgeContext';
import {
  Users,
  UserPlus,
  Trash2,
  X,
  KeyRound,
  User,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';

export const StudentManagerModal: React.FC = () => {
  const {
    isStudentModalOpen,
    setIsStudentModalOpen,
    students,
    addStudent,
    deleteStudent,
    openConfirmModal,
  } = useJudge();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isStudentModalOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const res = addStudent(fullName, username, password);
    if (!res.success) {
      setErrorMessage(res.message);
    } else {
      setFullName('');
      setUsername('');
      setPassword('');
      setErrorMessage('');
    }
  };

  const handleCopy = (student: { username: string; fullName: string; password?: string }, id: string) => {
    navigator.clipboard.writeText(`Học sinh: ${student.fullName}\nTên đăng nhập: ${student.username}\nMật khẩu: ${student.password || ''}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Top Gradient Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 shrink-0" />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Quản Lý Tài Khoản Học Sinh
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                  {students.length} học sinh
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cấp tài khoản đăng nhập để học sinh vào làm bài và lưu đúng Họ tên vào Bảng điểm Themis.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsStudentModalOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Form Tạo tài khoản học sinh mới */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-400" /> Cấp tài khoản học sinh mới
            </h4>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Họ và tên học sinh:
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tên đăng nhập (Username):
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: vanan2026"
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Mật khẩu cấp:
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="VD: 123456"
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Tạo tài khoản học sinh
                </button>
              </div>
            </form>
          </div>

          {/* Danh sách học sinh đã tạo */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" /> Danh sách tài khoản đã cấp
              </span>
              <span className="text-[11px] text-slate-500 normal-case font-normal">
                (Học sinh dùng Username và Password này để đăng nhập)
              </span>
            </h4>

            {students.length === 0 ? (
              <div className="p-8 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
                Chưa có tài khoản học sinh nào. Hãy điền thông tin ở khung trên để cấp tài khoản đầu tiên!
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 shadow-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-800/50">
                      <th className="py-2.5 px-4 w-12 text-center">STT</th>
                      <th className="py-2.5 px-4">Họ và tên</th>
                      <th className="py-2.5 px-4">Tên đăng nhập</th>
                      <th className="py-2.5 px-4">Mật khẩu</th>
                      <th className="py-2.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {students.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-500">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <span>{st.fullName}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-400">
                          {st.username}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {st.password}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleCopy(st, st.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              title="Copy thông tin tài khoản"
                            >
                              {copiedId === st.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                openConfirmModal({
                                  title: 'Xóa tài khoản học sinh',
                                  message: `Bạn có chắc chắn muốn xóa tài khoản của học sinh "${st.fullName}" (${st.username})?`,
                                  confirmLabel: 'Xác nhận xóa',
                                  onConfirm: () => deleteStudent(st.id),
                                });
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors"
                              title="Xóa tài khoản học sinh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Giáo viên quản lý và phân phối thông tin đăng nhập cho học sinh.
          </span>
          <button
            onClick={() => setIsStudentModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
