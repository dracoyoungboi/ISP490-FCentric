import { createElement, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, User, Phone, Mail, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { getKhachHangById } from "@/services/khachHangService";

import PageContainer from "@/components/backoffice/PageContainer";
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

function InfoField({ label, value, icon, className = "" }) {
  return (
    <div className={`flex min-w-0 items-start gap-3 ${className}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
        {createElement(icon, { className: "size-4", "aria-hidden": true })}
      </span>
      <div className="min-w-0">
        <dt className="mb-1 text-xs font-medium text-bo-muted">{label}</dt>
        <dd className="break-words text-sm font-semibold leading-6 text-bo-foreground">{value?.trim() || "—"}</dd>
      </div>
    </div>
  );
}

function normalizeName(value) {
  return (value || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
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
  const contactName = khachHang.nguoiLienHe?.trim();
  const contactIsCustomer = contactName && normalizeName(contactName) === normalizeName(khachHang.tenKhachHang);

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
      </div>

      <section aria-label="Nhận diện khách hàng" className="relative min-w-0 overflow-hidden rounded-xl border border-[#315578] bg-linear-to-br from-[#122c4e] via-[#173e69] to-[#1c5488] p-5 text-white shadow-sm sm:min-h-56 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 size-[420px] rounded-full border border-white/10">
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute inset-20 rounded-full border border-white/10" />
          <div className="absolute inset-30 rounded-full border border-white/10" />
        </div>
        <div className="relative">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/80">HỒ SƠ KHÁCH HÀNG</p>
            <Button
              type="button"
              onClick={() => navigate(`/customers/${id}/edit`)}
              className="ml-auto h-10 shrink-0 gap-2 bg-white px-4 text-[#17365a] shadow-sm hover:bg-slate-100"
            >
              <Edit aria-hidden="true" className="size-4" />
              Chỉnh sửa hồ sơ
            </Button>
          </div>
          <h1 className="max-w-5xl break-words text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{khachHang.tenKhachHang || "—"}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={`Mã khách hàng: ${khachHang.maKhachHang || "—"}`}
              dot={false}
              className="h-auto min-h-8 break-words border-blue-200/40 bg-[#0d2747] px-3 py-1.5 text-sm font-semibold leading-5 text-blue-50"
            />
            <StatusBadge label={loai?.label || "—"} tone={loai?.tone} dot={false} className="h-auto min-h-8 px-3 py-1.5 text-sm font-semibold leading-5" />
            <StatusBadge
              label={khachHang.trangThai === 1 ? "Đang hoạt động" : "Ngừng hoạt động"}
              tone={khachHang.trangThai === 1 ? "success" : "neutral"}
              className="h-auto min-h-8 px-3 py-1.5 text-sm font-semibold leading-5"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="customer-contact-title" className="min-w-0 rounded-xl border border-bo-border bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-6">
        <h2 id="customer-contact-title" className="text-base font-semibold text-bo-foreground sm:text-lg">Thông tin liên hệ</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:gap-x-16">
          <InfoField label="Người liên hệ" value={contactIsCustomer ? "Như tên khách hàng" : contactName} icon={User} className="border-b border-bo-border py-5" />
          <InfoField label="Số điện thoại" value={khachHang.soDienThoai} icon={Phone} className="border-b border-bo-border py-5" />
          <InfoField label="Email" value={khachHang.email} icon={Mail} className="border-b border-bo-border py-5 sm:border-b-0 sm:pb-0" />
          <InfoField label={khachHang.loaiKhachHang === "doanh_nghiep" ? "Địa chỉ trụ sở" : "Địa chỉ"} value={khachHang.diaChi} icon={MapPin} className="pt-5" />
        </dl>
      </section>
      <CustomerPurchaseHistory key={id} customerId={id} />
    </PageContainer>
  );
}
