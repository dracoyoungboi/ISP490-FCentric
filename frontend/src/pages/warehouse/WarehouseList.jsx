import React from "react";
import {
    Warehouse,
    Eye,
    Edit,
    Trash2,
    MapPin,
    User2,
    Package2,
    Wallet,
    BoxSelect,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (value) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value ?? 0);

const formatNumber = (value) =>
    new Intl.NumberFormat("vi-VN").format(value ?? 0);

// ── sub-components ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    return status === 1 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Hoạt động
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Đóng
        </span>
    );
}

function ActionBtn({ title, onClick, color, children }) {
    const colors = {
        purple: "text-purple-600 hover:bg-purple-50 hover:border-purple-200",
        blue: "text-blue-600 hover:bg-blue-50 hover:border-blue-200",
        red: "text-red-500 hover:bg-red-50 hover:border-red-200",
    };
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition-all duration-150 hover:scale-110 active:scale-95 ${colors[color]}`}
        >
            {children}
        </button>
    );
}

// ── empty state ────────────────────────────────────────────────────────────
export function WarehouseEmptyState() {
    return (
        <div className="mt-4 rounded-2xl bg-bo-surface shadow-sm ring-1 ring-slate-200/80">
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <Warehouse className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Không tìm thấy kho</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Hiện tại chưa có dữ liệu kho phù hợp. Hãy thử thay đổi bộ lọc hoặc từ
                    khóa tìm kiếm để xem kết quả khác.
                </p>
            </div>
        </div>
    );
}

// ── main component ─────────────────────────────────────────────────────────
export default function WarehouseList({
    warehouses = [],
    onView,
    onEdit,
    onDelete,
}) {
    if (!warehouses.length) return <WarehouseEmptyState />;

    return (
        <div className="mt-4 rounded-2xl bg-bo-surface shadow-sm ring-1 ring-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    {/* ── HEADER ── */}
                    <thead>
                        <tr className="border-b border-slate-200 bg-bo-surface-subtle">
                            <th className="h-12 px-4 text-left font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Mã kho
                            </th>
                            <th className="h-12 px-4 text-left font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Tên kho &amp; Địa chỉ
                            </th>
                            <th className="h-12 px-4 text-center font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Tồn kho
                            </th>
                            <th className="h-12 px-4 text-center font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Giá trị
                            </th>
                            <th className="h-12 px-4 text-left font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Quản lý
                            </th>
                            <th className="h-12 px-4 text-center font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Trạng thái
                            </th>
                            <th className="h-12 px-4 text-center font-semibold text-slate-600 tracking-wide text-xs uppercase">
                                Thao tác
                            </th>
                        </tr>
                    </thead>

                    {/* ── BODY ── */}
                    <tbody className="divide-y divide-slate-100">
                        {warehouses.map((wh) => (
                            <tr
                                key={wh.id}
                                className="transition-colors duration-150 hover:bg-purple-50/50"
                            >
                                {/* Mã kho */}
                                <td className="px-4 py-3.5 align-middle">
                                    <span className="font-bold text-purple-600 tracking-wide">
                                        {wh.maKho}
                                    </span>
                                </td>

                                {/* Tên + địa chỉ */}
                                <td className="px-4 py-3.5 align-middle max-w-[220px]">
                                    <p className="font-semibold text-slate-900 leading-snug">
                                        {wh.tenKho}
                                    </p>
                                    <div className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span className="line-clamp-2 leading-relaxed">
                                            {wh.diaChi}
                                        </span>
                                    </div>
                                </td>

                                {/* Tồn kho */}
                                <td className="px-4 py-3.5 align-middle text-center">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1">
                                        <Package2 className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="font-semibold text-slate-800 text-xs">
                                            {formatNumber(wh.soLuongTon)} SP
                                        </span>
                                    </span>
                                </td>

                                {/* Giá trị */}
                                <td className="px-4 py-3.5 align-middle text-center">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1">
                                        <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="font-semibold text-emerald-700 text-xs">
                                            {formatCurrency(wh.giaTriTon)}
                                        </span>
                                    </span>
                                </td>

                                {/* Quản lý */}
                                <td className="px-4 py-3.5 align-middle">
                                    <div className="flex items-center gap-1.5">
                                        <User2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="font-medium text-slate-700 text-sm">
                                            {wh.quanLy?.hoTen ?? "Chưa có quản lý"}
                                        </span>
                                    </div>
                                </td>

                                {/* Trạng thái */}
                                <td className="px-4 py-3.5 align-middle text-center">
                                    <StatusBadge status={wh.trangThai} />
                                </td>

                                {/* Thao tác */}
                                <td className="px-4 py-3.5 align-middle">
                                    <div className="flex items-center justify-center gap-1">
                                        <ActionBtn title="Xem chi tiết" onClick={() => onView?.(wh)} color="purple">
                                            <Eye className="h-4 w-4" />
                                        </ActionBtn>
                                        <ActionBtn title="Chỉnh sửa" onClick={() => onEdit?.(wh)} color="blue">
                                            <Edit className="h-4 w-4" />
                                        </ActionBtn>
                                        <ActionBtn title="Xóa" onClick={() => onDelete?.(wh)} color="red">
                                            <Trash2 className="h-4 w-4" />
                                        </ActionBtn>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}