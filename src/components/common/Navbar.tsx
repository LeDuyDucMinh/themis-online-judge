import React from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { AdminTabType } from '../admin/AdminLayout';

interface NavbarProps {
  currentTab: AdminTabType;
  setCurrentTab: (tab: AdminTabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    isAdminAuthenticated,
    currentStudent,
    logoutStudent,
    setAuthModalTab,
    setIsAuthModalOpen,
    setIsChangeNameModalOpen,
    activeClass,
    setActiveClassId,
  } = useJudge();

  const handleBrandClick = () => {
    setActiveClassId(null);
    if (isAdminAuthenticated) {
      setCurrentTab('admin_classes');
    } else {
      setCurrentTab('classes');
    }
  };

  return (
    <nav style={{ borderBottom: '1px solid #D9D2C3', background: '#F4F0E8', position: 'sticky', top: 0, zIndex: 40 }}>
      <div className="fj-w fj-nv">
        {/* Brand */}
        <b
          style={{ fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleBrandClick}
          title="Trang chủ FAMINH Online Judge"
        >
          FAMINH <span style={{ color: '#B4281F' }}>Judge</span>
        </b>

        {/* Links Navigation */}
        <button
          className={`nav-link ${currentTab === 'classes' && !activeClass ? 'on' : ''}`}
          onClick={() => {
            setCurrentTab('classes');
            setActiveClassId(null);
          }}
        >
          Lớp học của tôi
        </button>

        {activeClass && (
          <button
            className={`nav-link ${currentTab === 'classes' && activeClass ? 'on' : ''}`}
            onClick={() => setCurrentTab('classes')}
          >
            Bài tập lớp
          </button>
        )}

        <button
          className={`nav-link ${currentTab === 'submissions' ? 'on' : ''}`}
          onClick={() => setCurrentTab('submissions')}
        >
          Lịch sử nộp bài
        </button>

        <span style={{ flex: 1 }}></span>

        {/* User profile & actions */}
        {currentStudent ? (
          <>
            <span style={{ fontWeight: 500, color: '#1F1D1A' }} title={currentStudent.email}>
              {currentStudent.fullName}
            </span>
            <button className="nav-link" onClick={() => setIsChangeNameModalOpen(true)}>
              Đổi tên
            </button>
            <button className="nav-link" onClick={logoutStudent}>
              Thoát
            </button>
          </>
        ) : (
          <button
            className="nav-link"
            style={{ color: '#B4281F', fontWeight: 600 }}
            onClick={() => {
              setAuthModalTab('student');
              setIsAuthModalOpen(true);
            }}
          >
            Đăng nhập
          </button>
        )}
      </div>
    </nav>
  );
};
