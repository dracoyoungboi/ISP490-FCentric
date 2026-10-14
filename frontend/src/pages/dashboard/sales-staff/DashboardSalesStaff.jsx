import { formatCurrency } from "@/utils/formatters";
import { useCallback, useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import Stat from "@/components/dashboard/Stat";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { getApiErrorMessage } from "@/utils/apiError";
import { ShoppingCart, DollarSign, Truck } from "lucide-react";

export default function DashboardSalesStaff() {

    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(null);

    // Tải số liệu; lỗi thì hiện khối lỗi có nút "Thử lại" thay vì để trống trang
    const taiTongQuan = useCallback(async () => {
        setLoadError(null);
        try {
            const res = await dashboardService.getDashboard();
            const soLieu = res.data?.data;
            if (!soLieu) throw new Error("Máy chủ không trả về số liệu tổng quan");
            setData(soLieu);
        } catch (error) {
            setLoadError(error);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect)
    useEffect(() => {
        queueMicrotask(() => taiTongQuan());
    }, [taiTongQuan]);

    if (!data) {
        return (
            <PageContainer className="space-y-5">
                <PageHeader title="Tổng quan bán hàng" />
                {loadError ? (
                    <SurfaceCard contentClassName="p-0 sm:p-0">
                        <ErrorState
                            title="Không tải được số liệu tổng quan"
                            description={getApiErrorMessage(loadError, "Đã xảy ra lỗi khi tải số liệu. Vui lòng thử lại.")}
                            onRetry={taiTongQuan}
                        />
                    </SurfaceCard>
                ) : (
                    <LoadingState label="Đang tải số liệu tổng quan" />
                )}
            </PageContainer>
        );
    }

    return (

        <PageContainer className="space-y-5">

            <PageHeader
                title="Tổng quan bán hàng"
                description="Doanh thu và đơn hàng trong ngày"
            />

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <Stat
                    icon={<ShoppingCart className="h-5 w-5 text-bo-warning" />}
                    label="Đơn bán hôm nay"
                    value={data.totalOrdersToday}
                />

                <Stat
                    icon={<DollarSign className="h-5 w-5 text-bo-success" />}
                    label="Doanh thu hôm nay"
                    value={formatCurrency(data.revenueToday)}
                />

                <Stat
                    icon={<Truck className="h-5 w-5 text-bo-primary" />}
                    label="Đơn đang xử lý tại kho"
                    value={data.pendingSaleOrders}
                />

            </section>

        </PageContainer>

    )

}
