import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, User, Phone, Hash, Users,
} from "lucide-react";
import { toast } from "sonner";
import { getKhachHangById } from "@/services/khachHangService";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import CustomerPurchaseHistory from "./components/CustomerPurchaseHistory";

const LOAI_MAP = {
  le:           { label: "Khách lẻ (Retail)",       tone: "info" },
  si:           { label: "Khách sỉ (Wholesale)",     tone: "success" },
  doanh_nghiep: { label: "Doanh nghiệp (Business)", tone: "warning" },
};

function InfoField({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">{label}</p>
      <p className="font-semibold leading-snug text-bo-foreground">{value || "—"}</p>
    </div>
  );
}

export default function KhachHangDetails() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [loading,    setLoading]    = useState(true);
  const [khachHang,  setKhachHang]  = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKhachHangById(id);
      setKhachHang(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải thông tin khách hàng");
      navigate("/customers");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  if (loading) {
    return (
      <PageContainer>
        <SurfaceCard>
          <LoadingState rows={4} label="Đang tải thông tin khách hàng" />
        </SurfaceCard>
      </PageContainer>
    );
  }

  if (!khachHang) return null;

  const loai = LOAI_MAP[khachHang.loaiKhachHang];

  return (
    <PageContainer className="space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate("/customers")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </button>
        <PageHeader
          className="mb-0"
          title={khachHang.tenKhachHang}
          description="Hồ sơ khách hàng và thông tin liên hệ"
          actions={
            <Button
              onClick={() => navigate(`/customers/${id}/edit`)}
              className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              <Edit className="size-4" />
              Chỉnh sửa hồ sơ
            </Button>
          }
        />
      </div>

      {/* ── Stats cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-medium text-bo-muted">Mã khách hàng</p>
            <p className="mt-1 truncate font-mono text-sm font-bold text-bo-foreground">
              {khachHang.maKhachHang}
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
            <Hash className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-medium text-bo-muted">Loại khách hàng</p>
            <p className="mt-1 truncate text-sm font-bold text-bo-foreground">{loai?.label || "—"}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Users className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-medium text-bo-muted">Số điện thoại</p>
            <p className="mt-1 truncate text-sm font-bold text-bo-foreground">
              {khachHang.soDienThoai || "—"}
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-success-soft text-bo-success">
            <Phone className="size-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-medium text-bo-muted">Trạng thái</p>
            <p className="mt-1.5">
              <StatusBadge
                label={khachHang.trangThai === 1 ? "Đang hoạt động" : "Ngừng hoạt động"}
                tone={khachHang.trangThai === 1 ? "success" : "neutral"}
              />
            </p>
          </div>
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${khachHang.trangThai === 1 ? "bg-bo-success-soft text-bo-success" : "bg-slate-100 text-slate-400"}`}
          >
            <User className="size-5" />
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── Left: Profile card ── */}
        <div className="lg:col-span-1">
          <section className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
            {/* Banner phẳng theo tông backoffice */}
            <div className="h-20 bg-bo-foreground" />

            <div className="px-5 pb-5 text-center">
              <div className="-mt-10 mb-3 flex justify-center">
                <span className="flex size-20 items-center justify-center rounded-full border-4 border-bo-surface bg-bo-surface-subtle">
                  <User className="size-9 text-bo-muted" />
                </span>
              </div>

              <h2 className="text-base font-bold text-bo-foreground">{khachHang.tenKhachHang}</h2>
              <p className="mt-1 font-mono text-xs text-bo-muted">{khachHang.maKhachHang}</p>

              {loai && (
                <div className="mt-3 flex justify-center">
                  <StatusBadge label={loai.label} tone={loai.tone} />
                </div>
              )}

              <div className="mt-5 space-y-2 text-left">
                <div className="flex items-center justify-between gap-3 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-sm">
                  <span className="text-bo-muted">Mã KH</span>
                  <span className="font-mono font-bold text-bo-foreground">{khachHang.maKhachHang}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-sm">
                  <span className="text-bo-muted">Trạng thái</span>
                  <StatusBadge
                    label={khachHang.trangThai === 1 ? "Hoạt động" : "Ngừng"}
                    tone={khachHang.trangThai === 1 ? "success" : "neutral"}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right: Info panels ── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Thông tin cá nhân */}
          <SurfaceCard title="Thông tin cá nhân & Liên hệ" description="Hồ sơ khách hàng">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InfoField label="Họ và tên"       value={khachHang.tenKhachHang} />
              <InfoField label="Người liên hệ"   value={khachHang.nguoiLienHe} />
              <InfoField label="Số điện thoại"   value={khachHang.soDienThoai} />
              <InfoField label="Địa chỉ Email"   value={khachHang.email} />
              <InfoField label="Loại khách hàng" value={loai?.label} />
              <InfoField label="Mã định danh"    value={khachHang.maKhachHang} />
            </div>
            <div className="mt-5 border-t border-bo-border pt-5">
              <InfoField label="Địa chỉ cư trú / Trụ sở" value={khachHang.diaChi} />
            </div>
          </SurfaceCard>

        </div>
      </div>
      <CustomerPurchaseHistory key={id} customerId={id} />
    </PageContainer>
  );
}
