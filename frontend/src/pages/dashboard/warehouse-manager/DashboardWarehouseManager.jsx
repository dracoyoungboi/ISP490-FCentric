import { useCallback, useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import Stat from "@/components/dashboard/Stat";
import AlertBox from "@/components/dashboard/AlertBox";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { getApiErrorMessage } from "@/utils/apiError";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";

export default function DashboardWarehouseManager() {

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
                <PageHeader title="Tổng quan kho" />
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
                title="Tổng quan kho"
                description="Theo dõi hoạt động nhập xuất và cảnh báo tồn kho"
            />

            {/* STATS */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <Stat
                    icon={<Package className="h-5 w-5 text-bo-primary" />}
                    label="Tổng sản phẩm"
                    value={data.totalProducts}
                />

                <Stat
                    icon={<AlertTriangle className="h-5 w-5 text-bo-danger" />}
                    label="Tồn kho thấp"
                    value={data.lowStockCount}
                />

                <Stat
                    icon={<ArrowDownToLine className="h-5 w-5 text-bo-success" />}
                    label="Phiếu nhập hôm nay"
                    value={data.importToday}
                />

                <Stat
                    icon={<ArrowUpFromLine className="h-5 w-5 text-bo-warning" />}
                    label="Phiếu xuất hôm nay"
                    value={data.exportToday}
                />

            </section>

            {/* ALERT */}

            <SurfaceCard
                title="Cảnh báo kho"
                description="Các phiếu và sản phẩm cần xử lý"
                className="lg:max-w-xl"
            >

                <div className="space-y-3">

                    <AlertBox
                        title="Sản phẩm tồn thấp"
                        subtitle={`${data.lowStockCount} sản phẩm`}
                        color="red"
                    />

                    <AlertBox
                        title="Phiếu nhập chờ xử lý"
                        subtitle={`${data.pendingImports} phiếu`}
                        color="yellow"
                    />

                    <AlertBox
                        title="Phiếu xuất chờ xử lý"
                        subtitle={`${data.pendingExports} phiếu`}
                        color="yellow"
                    />

                </div>

            </SurfaceCard>

        </PageContainer>

    )
}
