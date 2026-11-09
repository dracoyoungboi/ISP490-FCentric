import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import VungTaiTrang from '@/components/shared/VungTaiTrang';
import '@/styles/print.css';
import { t } from "@/i18n";

const POS_DOCUMENT_TITLE = t("Bán hàng tại quầy · FCentric");
const DEFAULT_DOCUMENT_TITLE = t("FCentric · Quản lý kho & bán lẻ thời trang đa kênh");

/**
 * Shell toàn màn hình cho Bán hàng tại quầy — KHÔNG có sidebar/header backoffice.
 * Nằm dưới ProtectedRoute: phiên đăng nhập và hộp đổi mật khẩu bắt buộc (còn mật khẩu tạm thì không vào được
 * /pos) đều do ProtectedRoute lo.
 * Thanh trên cùng (logo, kho, người dùng…) do từng trang POS tự render qua PosTopBar.
 */
export default function PosLayout() {
  useEffect(() => {
    document.title = POS_DOCUMENT_TITLE;
    return () => { document.title = DEFAULT_DOCUMENT_TITLE; };
  }, []);

  // Toàn màn hình (nút trên PosTopBar) áp cho cả trang: rời POS về quản trị thì thoát luôn.
  // Đặt ở layout vì PosTopBar mount lại khi trang POS đổi trạng thái tải/lỗi.
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  return (
    <div
      // overflow-clip (không phải hidden): khung không là vùng cuộn, focus/scrollIntoView không đẩy lệch được.
      className="flex h-dvh min-h-0 w-full flex-col overflow-clip bg-bo-canvas font-backoffice text-bo-foreground"
      data-pos-shell
    >
      <VungTaiTrang className="min-h-0 flex-1">
        <Outlet />
      </VungTaiTrang>
    </div>
  );
}
