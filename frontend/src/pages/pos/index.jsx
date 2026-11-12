import { useEffect, useMemo } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import PosSalesPage from './PosSalesPage';
import { usePosDuLieuChung } from './pos-du-lieu-chung';
import { Button } from '@/components/ui/button';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';
import PosTopBar from './components/PosTopBar';
import { t } from "@/i18n";

/**
 * Gate checkout phía frontend: BẬT ở cả `npm run dev` lẫn bản build deploy.
 * Muốn tạm khóa nút thanh toán: chạy/build với VITE_POS_CHECKOUT=false.
 * Chốt chặn thật vẫn là server (`pos.checkout-enabled`, tắt bằng POS_CHECKOUT_ENABLED=false).
 */
const CHECKOUT_ENABLED = import.meta.env.VITE_POS_CHECKOUT !== 'false';

/**
 * Trang /pos — màn hình toàn màn hình riêng (ProtectedRoute + PosLayout, không sidebar).
 * Kho được phân quyền (POST /api/v1/kho/mine) + khách hàng hợp lệ (GET /api/v1/khach-hang/for-sales-order) do khung
 * PosLayout tải và giữ (pos-du-lieu-chung.js).
 * Lỗi API KHÔNG fallback về dữ liệu mẫu — hiển thị lỗi kèm nút thử lại.
 */
export default function PosPage() {
  // Kho, khách và khóa tab giữ ở khung POS: lần đầu tải (hiện vòng chờ), quay lại từ màn trả hàng thì hiện ngay
  // bản đã có và làm mới ngầm (khách vừa thêm ở quản trị, kho vừa đổi quyền).
  const { kho, khach, khoaTab: tabLock } = usePosDuLieuChung();
  const { tai: taiKho } = kho;
  const { tai: taiKhach } = khach;
  const { batDau: batDauKhoa } = tabLock;
  useEffect(() => {
    taiKho();
    taiKhach();
    // Một tab POS cho mỗi tài khoản: tab không giữ quyền thì không render màn bán (không ghi nháp).
    batDauKhoa();
  }, [taiKho, taiKhach, batDauKhoa]);

  const warehouses = useMemo(() => kho.ds ?? [], [kho.ds]);
  const customers = useMemo(() => khach.ds ?? [], [khach.ds]);
  const error = kho.loi || khach.loi;
  const loading = !error && (!kho.ds || !khach.ds);

  const retry = () => {
    kho.thuLai();
    khach.thuLai();
  };

  const initialWarehouseId = useMemo(() => {
    if (!warehouses.length) return null;
    const stored = Number(localStorage.getItem('selected_kho_id'));
    return warehouses.some((w) => w.id === stored) ? stored : warehouses[0].id;
  }, [warehouses]);

  // Trạng thái tải/lỗi/trống vẫn có thanh trên cùng để thu ngân quay lại trang quản trị.
  const renderState = (content) => (
    <>
      <PosTopBar />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">{content}</div>
    </>
  );

  if (tabLock.status === 'blocked' || tabLock.status === 'lost') {
    return renderState(
      <EmptyState
        action={<Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" onClick={tabLock.takeOver}>{t("Dùng ở tab này")}</Button>}
        description={tabLock.status === 'lost'
          ? t("Bạn vừa mở màn bán hàng ở một tab khác nên tab này đã ngừng để tránh hai tab ghi đè hóa đơn của nhau. Bấm \"Dùng ở tab này\" để chuyển toàn bộ hóa đơn đang làm về đây.")
          : t("Tài khoản này đang mở màn bán hàng ở một tab khác. Bấm \"Dùng ở tab này\" để chuyển toàn bộ hóa đơn đang làm sang tab này; tab kia sẽ tự ngừng.")}
        icon={MonitorSmartphone}
        title={t("POS đang mở ở tab khác")}
      />
    );
  }
  if (loading || tabLock.status === 'checking') {
    return renderState(<LoadingState label={t("Đang tải dữ liệu bán hàng")} />);
  }
  if (error) {
    return renderState(
      <ErrorState
        description={t("Không thể tải kho hoặc danh sách khách hàng. Không hiển thị dữ liệu mẫu.")}
        onRetry={retry}
        title={t("Không thể mở màn bán hàng tại quầy")}
      />
    );
  }
  if (!warehouses.length) {
    return renderState(
      <EmptyState
        description={t("Tài khoản của bạn chưa được giao kho bán hàng nào đang hoạt động (Kho tổng không bán tại quầy). Hãy liên hệ quản trị viên để được phân quyền kho bán hàng.")}
        title={t("Chưa có kho bán hàng")}
      />
    );
  }

  return (
    <PosSalesPage
      checkoutEnabled={CHECKOUT_ENABLED}
      customers={customers}
      initialWarehouseId={initialWarehouseId}
      tabId={tabLock.tabId}
      warehouses={warehouses}
    />
  );
}
