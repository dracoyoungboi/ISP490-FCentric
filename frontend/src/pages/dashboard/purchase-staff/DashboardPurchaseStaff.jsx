import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import Stat from "@/components/dashboard/Stat";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import { ShoppingCart, Clock, Truck } from "lucide-react";

export default function DashboardPurchaseStaff() {

    const [data, setData] = useState(null);

    useEffect(() => {
        dashboardService.getDashboard().then(res => {
            setData(res.data.data);
        });
    }, []);

    if (!data) return null;

    return (

        <PageContainer className="space-y-5">

            <PageHeader
                title="Tổng quan mua hàng"
                description="Đơn mua và nhà cung cấp"
            />

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <Stat
                    icon={<ShoppingCart className="h-5 w-5 text-bo-primary" />}
                    label="Đơn mua hôm nay"
                    value={data.purchaseToday}
                />

                <Stat
                    icon={<Clock className="h-5 w-5 text-bo-warning" />}
                    label="Yêu cầu nhập chờ duyệt"
                    value={data.pendingPurchaseOrders}
                />

                <Stat
                    icon={<Truck className="h-5 w-5 text-bo-success" />}
                    label="Nhà cung cấp"
                    value={data.totalSuppliers}
                />

            </section>

        </PageContainer>

    )

}
