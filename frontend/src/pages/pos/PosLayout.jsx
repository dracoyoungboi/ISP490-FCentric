import { useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import '@/styles/print.css';

const POS_DOCUMENT_TITLE = 'Bán hàng tại quầy · FCentric';
const DEFAULT_DOCUMENT_TITLE = 'FCentric · Quản lý kho & bán lẻ thời trang đa kênh';

/**
 * Shell toàn màn hình cho Bán hàng tại quầy — KHÔNG có sidebar/header backoffice.
 * Nằm dưới ProtectedRoute (vẫn kiểm tra phiên đăng nhập) và giữ modal bắt buộc đổi
 * mật khẩu như BackofficeLayout, để không thể "đi vòng" qua /pos để né đổi mật khẩu.
 * Thanh trên cùng (logo, kho, người dùng…) do từng trang POS tự render qua PosTopBar.
 */
export default function PosLayout() {
  const { mustChangePassword, setMustChangePassword } = useOutletContext();

  useEffect(() => {
    document.title = POS_DOCUMENT_TITLE;
    return () => { document.title = DEFAULT_DOCUMENT_TITLE; };
  }, []);

  return (
    <>
      <div
        // overflow-clip (không phải hidden): khung không là vùng cuộn, focus/scrollIntoView không đẩy lệch được.
        className="flex h-dvh min-h-0 w-full flex-col overflow-clip bg-bo-canvas font-backoffice text-bo-foreground"
        data-pos-shell
      >
        <Outlet />
      </div>
      <ChangePasswordModal
        forceChange
        onOpenChange={() => {}}
        onSuccess={() => setMustChangePassword(false)}
        open={mustChangePassword}
      />
    </>
  );
}
