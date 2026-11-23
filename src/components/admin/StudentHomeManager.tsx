import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { BannerManager } from './BannerManager';
import { ExamCountdownManager } from './ExamCountdownManager';

interface StudentHomeManagerProps {
  initialSubTab?: 'banners' | 'countdowns';
}

export const StudentHomeManager: React.FC<StudentHomeManagerProps> = ({
  initialSubTab = 'banners',
}) => {
  const { homeBanners, examCountdowns } = useJudge();
  const [subTab, setSubTab] = useState<'banners' | 'countdowns'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div
      className="banner-editorial-page w-full space-y-6 text-[#1F1D1A] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Thanh tab gộp Banner trang chủ + Đếm ngược kỳ thi */}
      <div className="flex items-center gap-7 border-b border-[#D9D2C3]">
        <button
          type="button"
          onClick={() => setSubTab('banners')}
          className={`pb-3 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            subTab === 'banners'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Banner trang chủ ({homeBanners.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('countdowns')}
          className={`pb-3 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            subTab === 'countdowns'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Đếm ngược kỳ thi ({examCountdowns.length})
        </button>
      </div>

      {subTab === 'banners' ? <BannerManager /> : <ExamCountdownManager />}
    </div>
  );
};
