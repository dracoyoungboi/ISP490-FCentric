import DashboardAdmin from "./admin/DashboardAdmin";
import DashboardWarehouseManager from "./warehouse-manager/DashboardWarehouseManager";
import DashboardWarehouseStaff from "./warehouse-staff/DashboardWarehouseStaff";
import DashboardSalesStaff from "./sales-staff/DashboardSalesStaff";
import DashboardPurchaseStaff from "./purchase-staff/DashboardPurchaseStaff";
import { getStoredRoles } from "@/utils/roles";

/**
 * Màn Tổng quan theo vai trò. Tài khoản nhiều vai trò ("role" lưu nhiều vai trò cách nhau khoảng trắng) xem màn của
 * vai trò đứng trước theo thứ tự dưới đây (cùng thứ tự backend dùng ở /api/v1/tong-quan/cua-toi).
 */
const DASHBOARD_THEO_VAI_TRO = [
    ["quan_tri_vien", DashboardAdmin],
    ["quan_ly_kho", DashboardWarehouseManager],
    ["nhan_vien_kho", DashboardWarehouseStaff],
    ["nhan_vien_ban_hang", DashboardSalesStaff],
    ["nhan_vien_mua_hang", DashboardPurchaseStaff],
];

export default function Dashboard() {
    const vaiTro = getStoredRoles();
    const DashboardComponent = DASHBOARD_THEO_VAI_TRO.find(([ma]) => vaiTro.includes(ma))?.[1];

    if (!DashboardComponent) {

        return <div className="flex min-h-screen items-center justify-center bg-bo-canvas p-6 font-backoffice text-bo-muted">Không có quyền truy cập</div>;
    }

    return <DashboardComponent />;
}
