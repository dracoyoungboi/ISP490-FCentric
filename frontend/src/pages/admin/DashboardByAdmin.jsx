import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import { adminService } from "@/services/adminService";
import { Link } from "react-router-dom";

import {
    Users,
    ShoppingCart,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    ChevronDown
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";


export default function DashboardByAdmin() {

    const [data, setData] = useState(null);
    const [latestUsers, setLatestUsers] = useState([]);

    const [pagination, setPagination] = useState({
        pageNumber: 0,
        pageSize: 5,
        totalPages: 0,
        totalElements: 0,
    });

    /* ================= LOAD USERS ================= */

    const loadUsers = async (page = 0, size = pagination.pageSize) => {

        try {

            const res = await adminService.getUserListByAdmin({
                page,
                size,
                sort: "ngayTao,desc",
            });

            const pageData = res.data.data;

            setLatestUsers(pageData.content);

            setPagination({
                pageNumber: pageData.number,
                pageSize: pageData.size,
                totalPages: pageData.totalPages,
                totalElements: pageData.totalElements,
            });

        } catch (err) {
            console.error(err);
        }

    };

    useEffect(() => {

        dashboardService.getDashboardByAdmin().then((res) => {
            setData(res.data.data);
        });

        loadUsers();

    }, []);


    const handlePageChange = (page) => {
        if (page < 0 || page >= pagination.totalPages) return;
        loadUsers(page, pagination.pageSize);
    };

    const handlePageSizeChange = (size) => {
        loadUsers(0, size);
    };


    if (!data) return null;

    return (

        <div className="lux-sync p-6 space-y-6 bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 min-h-screen">

            {/* ===== STATS ===== */}

            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <Stat
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    label="User mới hôm nay"
                    value={data.newUsersToday}
                />

                <Stat
                    icon={<Users className="w-5 h-5 text-purple-600" />}
                    label="Tổng user"
                    value={data.totalUsers}
                />

                <Stat
                    icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
                    label="Doanh thu ngày"
                    value={`${data.revenueToday.toLocaleString("vi-VN")} ₫`}
                />

                <Stat
                    icon={<ShoppingCart className="w-5 h-5 text-orange-600" />}
                    label="Đơn bán hôm nay"
                    value={data.totalOrdersToday}
                />

            </section>


            {/* ===== CHART + ALERT ===== */}

            <section className="grid lg:grid-cols-3 gap-4">

                {/* CHART */}

                <div className="bg-bo-surface border-0 shadow-md rounded-xl p-5 lg:col-span-2">

                    <div className="flex items-center justify-between">

                        <div>
                            <div className="text-sm font-semibold text-gray-900">
                                Doanh thu 7 ngày
                            </div>

                            <div className="text-xs text-gray-500">
                                don_ban_hang.ngay_dat_hang
                            </div>
                        </div>

                        <div className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                            7 ngày gần nhất
                        </div>

                    </div>

                    <div className="mt-4 h-48 flex items-end justify-between gap-3 p-4 bg-bo-surface-subtle rounded-lg">

                        {(() => {

                            const max = Math.max(...data.revenueLast7Days.map(i => i.value), 1);

                            return data.revenueLast7Days.map((item) => {

                                const height = Math.max((item.value / max) * 100, 8);

                                return (
                                    <div
                                        key={item.date}
                                        className="flex flex-col items-center gap-1 group"
                                    >

                                        <div className="text-[10px] opacity-0 group-hover:opacity-100 bg-gray-700 text-white px-1.5 py-0.5 rounded">
                                            {(item.value / 1000).toFixed(0)}k
                                        </div>

                                        <div
                                            key={item.date}
                                            className="w-8 rounded-t-md bg-purple-600 hover:bg-purple-700 transition shadow-sm"
                                            style={{ height }}
                                            title={`${item.date}: ${item.value.toLocaleString("vi-VN")} ₫`}
                                        />

                                        <span className="text-[10px] text-gray-500">
                                            {item.date.slice(5)}
                                        </span>

                                    </div>
                                );

                            });

                        })()}

                    </div>

                </div>


                {/* ALERT */}

                <div className="bg-bo-surface border-0 shadow-md rounded-xl p-5">

                    <div className="text-sm font-semibold text-gray-900">
                        Cảnh báo nhanh
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                        Tổng hợp từ hệ thống
                    </div>

                    <div className="mt-4 space-y-3">

                        <AlertBox
                            title="Tồn kho thấp"
                            subtitle={`${data.lowStockCount} cảnh báo`}
                            color="red"
                        />

                        <AlertBox
                            title="Đơn chờ duyệt"
                            subtitle={`${data.pendingPurchaseOrders} mua / ${data.pendingSaleOrders} bán`}
                            color="yellow"
                        />

                        <AlertBox
                            title="User bị khóa"
                            subtitle={`${data.bannedUsers} tài khoản`}
                            color="gray"
                        />

                    </div>

                </div>

            </section>


            {/* ===== LATEST USERS ===== */}

            <section className="bg-bo-surface border-0 shadow-md rounded-xl p-5">

                <div className="flex items-start justify-between">

                    <div>

                        <div className="text-sm font-semibold text-gray-900">
                            User mới tạo gần đây
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                            nguoi_dung (id, ten_dang_nhap, vai_tro)
                        </div>

                    </div>

                    <Link
                        to="/users"
                        className="text-sm border-b font-medium"
                    >
                        Xem tất cả
                    </Link>

                </div>


                <div className="mt-4 overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead>

                            <tr className="border-b text-xs text-gray-500">

                                <th className="py-2 text-left">Username</th>
                                <th className="py-2 text-left">Họ tên</th>
                                <th className="py-2 text-left">Vai trò</th>
                                <th className="py-2 text-left">Trạng thái</th>
                                <th className="py-2 text-left">Ngày tạo</th>

                            </tr>

                        </thead>

                        <tbody>

                            {latestUsers.map((user) => (

                                <tr
                                    key={user.id}
                                    className="border-b hover:bg-violet-50/50"
                                >

                                    <td className="py-3 font-semibold">
                                        {user.tenDangNhap}
                                    </td>

                                    <td>{user.hoTen}</td>

                                    <td>
                                        <span className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700">
                                            {user.vaiTro}
                                        </span>
                                    </td>

                                    <td>
                                        <StatusBadge status={user.trangThai} />
                                    </td>

                                    <td>
                                        {new Date(user.ngayTao).toLocaleDateString("vi-VN")}
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>


                {/* ===== PAGINATION ===== */}

                <Card className="border-none bg-bo-surface mt-4">

                    <CardContent className="p-4">

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

                            {/* Page size */}

                            <div className="flex items-center gap-2">
                                <Label className="text-sm text-gray-600 whitespace-nowrap">Hiển thị:</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-[120px] justify-between font-normal bg-bo-surface border-gray-200">
                                            {pagination.pageSize} dòng
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-[120px] bg-bo-surface shadow-lg border border-gray-100 z-50">
                                        {[5, 10, 20, 50, 100].map(size => (
                                            <DropdownMenuItem
                                                key={size}
                                                onClick={() => handlePageSizeChange(size)}
                                                className="cursor-pointer"
                                            >
                                                {size} dòng
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>


                            {/* Page info */}

                            <div className="text-sm text-gray-600">

                                Hiển thị{" "}

                                <span className="font-semibold text-gray-900">
                                    {pagination.pageNumber * pagination.pageSize + 1}
                                </span>

                                {" - "}

                                <span className="font-semibold text-gray-900">
                                    {Math.min(
                                        (pagination.pageNumber + 1) * pagination.pageSize,
                                        pagination.totalElements
                                    )}
                                </span>

                                {" trong tổng số "}

                                <span className="font-semibold text-purple-600">
                                    {pagination.totalElements}
                                </span>

                                {" kết quả"}

                            </div>


                            {/* Navigation */}

                            <div className="flex items-center gap-2">

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(pagination.pageNumber - 1)}
                                    disabled={pagination.pageNumber === 0}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Trước
                                </Button>


                                {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {

                                    let pageNum;

                                    if (pagination.totalPages <= 5) {
                                        pageNum = idx;
                                    } else if (pagination.pageNumber < 3) {
                                        pageNum = idx;
                                    } else if (pagination.pageNumber > pagination.totalPages - 4) {
                                        pageNum = pagination.totalPages - 5 + idx;
                                    } else {
                                        pageNum = pagination.pageNumber - 2 + idx;
                                    }

                                    return (

                                        <Button
                                            key={idx}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={
                                                pagination.pageNumber === pageNum
                                                    ? "bg-purple-600 text-white"
                                                    : "border-gray-200"
                                            }
                                        >
                                            {pageNum + 1}
                                        </Button>

                                    );

                                })}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(pagination.pageNumber + 1)}
                                    disabled={pagination.pageNumber >= pagination.totalPages - 1}
                                >
                                    Sau
                                    <ChevronRight className="h-4 w-4" />
                                </Button>

                            </div>

                        </div>

                    </CardContent>

                </Card>

            </section>

        </div>

    );
    function Stat({ icon, label, value }) {

        return (

            <div className="bg-bo-surface border-0 shadow-md rounded-xl p-4">

                <div className="flex items-center justify-between">

                    <div className="text-xs text-gray-500">
                        {label}
                    </div>

                    {icon}

                </div>

                <div className="mt-2 text-2xl font-bold text-gray-900">
                    {value}
                </div>

            </div>

        );

    }
    function AlertBox({ title, subtitle, color }) {

        const colorMap = {
            red: "bg-red-50 border-red-200 text-red-700",
            yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
            gray: "bg-gray-50 border-gray-200 text-gray-800",
        };

        return (

            <div className={`p-3 rounded-lg border ${colorMap[color]}`}>

                <div className="text-sm font-semibold">
                    {title}
                </div>

                <div className="text-xs mt-1">
                    {subtitle}
                </div>

            </div>

        );

    }
    function StatusBadge({ status }) {

        return status === 1 ? (

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                Hoạt động

            </span>

        ) : (

            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-bo-danger-soft px-2.5 py-1 text-xs font-semibold text-red-600">

                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

                Bị khóa

            </span>

        );

    }

}