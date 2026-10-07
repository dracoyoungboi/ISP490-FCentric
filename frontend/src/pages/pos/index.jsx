import { useEffect, useMemo, useState } from 'react';
import PosSalesPage from './PosSalesPage';
import { getMineKhoList } from '@/services/khoService';
import { donBanHangService } from '@/services/donBanHangService';
import { toPosCustomer } from '@/services/posService';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

/**
 * Gate checkout phía frontend (chốt chặn thật vẫn là server `pos.checkout-enabled`):
 * - `npm run dev` (DEV): BẬT mặc định; tắt bằng VITE_POS_CHECKOUT=false.
 * - `npm run build` (production): TẮT mặc định; chỉ bật khi build với VITE_POS_CHECKOUT=true.
 * Khi tắt, mọi đường submit bị khóa với thông báo rõ ràng — không có nhánh giả thành công.
 */
const POS_CHECKOUT_FLAG = import.meta.env.VITE_POS_CHECKOUT;
const CHECKOUT_ENABLED = POS_CHECKOUT_FLAG === 'true'
  || (import.meta.env.DEV && POS_CHECKOUT_FLAG !== 'false');

/**
 * Trang /pos — nằm trong shell backoffice (ProtectedRoute + BackofficeLayout).
 * Tải kho được phân quyền (POST /api/v1/kho/mine) + khách hàng hợp lệ
 * (GET /api/v1/khach-hang/for-sales-order) qua API client hiện có.
 * Lỗi API KHÔNG fallback về dữ liệu mẫu — hiển thị lỗi kèm nút thử lại.
 */
export default function PosPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([
      getMineKhoList(),
      donBanHangService.getCustomersForCreate(),
    ])
      .then(([khoList, customerResponse]) => {
        const customerRows = customerResponse?.data?.data ?? [];
        setWarehouses(khoList ?? []);
        setCustomers(customerRows.map(toPosCustomer));
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  const initialWarehouseId = useMemo(() => {
    if (!warehouses.length) return null;
    const stored = Number(localStorage.getItem('selected_kho_id'));
    return warehouses.some((w) => w.id === stored) ? stored : warehouses[0].id;
  }, [warehouses]);

  if (loading) {
    return <LoadingState label="Đang tải dữ liệu bán hàng" />;
  }
  if (error) {
    return (
      <ErrorState
        description="Không thể tải kho hoặc danh sách khách hàng. Không hiển thị dữ liệu mẫu."
        onRetry={retry}
        title="Không thể mở màn bán hàng tại quầy"
      />
    );
  }
  if (!warehouses.length) {
    return (
      <EmptyState
        description="Tài khoản của bạn chưa được giao phụ trách kho nào. Hãy liên hệ quản trị viên để được phân quyền kho bán hàng."
        title="Chưa có kho bán hàng"
      />
    );
  }

  return (
    <PosSalesPage
      checkoutEnabled={CHECKOUT_ENABLED}
      customers={customers}
      initialWarehouseId={initialWarehouseId}
      warehouses={warehouses}
    />
  );
}
