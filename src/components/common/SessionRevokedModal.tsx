import React from 'react';

interface SessionRevokedModalProps {
  isOpen?: boolean;
  onConfirm?: () => void;
}

/**
 * Cơ chế Lưới điện / văng nick đã được dỡ bỏ hoàn toàn.
 * Component này luôn trả về null để không bao giờ hiển thị cảnh báo ngắt phiên.
 */
export const SessionRevokedModal: React.FC<SessionRevokedModalProps> = () => {
  return null;
};
