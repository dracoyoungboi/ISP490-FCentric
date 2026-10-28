import { createElement, useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import {
    ClipboardList,
    Package,
    Warehouse,
    Calendar,
    User,
    Info as InfoIcon,
    ArrowLeft
} from "lucide-react";
import { PHIEU_XUAT_KHO_STATUS, getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";

// Trạng thái phiếu xuất — dùng chung tên với danh sách và bản in (constants/phieuXuatKho)
const STATUS_UI = PHIEU_XUAT_KHO_STATUS;

export default function PhieuXuatKhoView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            const res = await phieuXuatKhoService.view(id);
            setData(res);
        } catch {
            toast.error("Không thể tải chi tiết phiếu xuất");
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn tải lại chi tiết mỗi khi id đổi.
    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    if (loading || !data) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    <LoadingState rows={4} label="Đang tải dữ liệu phiếu xuất kho" />
                </div>
            </PageContainer>
        );
    }

    const statusInfo = getPhieuXuatKhoStatus(data.trangThai);

    return (
        <PageContainer className="space-y-5">

            {/* ── Header ── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge quyTrinh="phieuXuat" size="lg" label={statusInfo.label} />
                </div>
            </div>

            {/* ── Info Section ── */}
            <SurfaceCard title="Thông tin phiếu xuất">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoItem icon={Package} label="Số phiếu xuất" value={data.soPhieuXuat} highlight />

                    <InfoItem
                        icon={ClipboardList}
                        label="Đơn bán hàng"
                        value={data.soDonHang}
                    />

                    <InfoItem
                        icon={Warehouse}
                        label="Kho xuất"
                        value={data.tenKho}
                    />

                    <InfoItem
                        icon={Calendar}
                        label="Ngày xuất"
                        value={data.ngayXuat ? new Date(data.ngayXuat).toLocaleDateString("vi-VN") : "---"}
                    />

                    <InfoItem
                        icon={User}
                        label="Người xuất"
                        value={data.nguoiXuat}
                    />
                </div>

                {data.ghiChu && (
                    <div className="mt-5 border-t border-bo-border pt-4">
                        <InfoItem icon={InfoIcon} label="Ghi chú" value={data.ghiChu} />
                    </div>
                )}
            </SurfaceCard>
        </PageContainer>
    );
}

function InfoItem({ icon, label, value, highlight }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                {createElement(icon, { className: "size-3.5 text-bo-primary" })}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                    {label}
                </span>
            </div>
            <div className={`text-sm font-semibold ${highlight ? "text-bo-primary" : "text-bo-foreground"}`}>
                {value || "---"}
            </div>
        </div>
    );
}
