import { formatCurrency } from "@/utils/formatters";
import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import Stat from "@/components/dashboard/Stat";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import { ShoppingCart, DollarSign, Truck } from "lucide-react";

export default function DashboardSalesStaff() {

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
