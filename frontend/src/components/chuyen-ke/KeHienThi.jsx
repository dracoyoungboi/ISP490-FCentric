import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";

// Trạng thái kệ (vi_tri_kho.trang_thai): chấm màu + chữ như nhãn trạng thái ở các màn danh sách.
// Đổi ngôn ngữ là tải lại trang nên gọi t() ở cấp module vẫn đúng.
const TRANG_THAI_KE = {
  HOAT_DONG: { nhan: t("Hoạt động"), chu: "text-bo-success", cham: "bg-bo-success" },
  DAY_HANG: { nhan: t("Đầy hàng"), chu: "text-bo-warning", cham: "bg-amber-500" },
  BAO_TRI: { nhan: t("Bảo trì"), chu: "text-bo-warning", cham: "bg-amber-500" },
  KHOA_KIEM_KE: { nhan: t("Đang kiểm kê"), chu: "text-red-700", cham: "bg-bo-danger" },
};

/** Chấm màu + chữ. `tone`: "ok" | "warn" | "bad". */
export function ChamNhan({ tone = "ok", children, className }) {
  const mau = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-bo-warning" : "text-bo-success";
  const cham = tone === "bad" ? "bg-bo-danger" : tone === "warn" ? "bg-amber-500" : "bg-bo-success";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium", mau, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", cham)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function TrangThaiKe({ trangThai, className }) {
  const k = TRANG_THAI_KE[trangThai];
  if (!k) return trangThai ? <span className={cn("text-[13px] text-bo-muted", className)}>{tDuLieu(trangThai)}</span> : null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium", k.chu, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", k.cham)} aria-hidden="true" />
      {k.nhan}
    </span>
  );
}

/**
 * Thanh lấp đầy kệ: phần đang chứa (xám) và phần sắp cất thêm (xanh). Kệ không giới hạn sức chứa (`sucChua` null)
 * không vẽ thanh.
 */
export function ThanhSucChua({ dangChua = 0, them = 0, sucChua, maKe, className }) {
  if (!sucChua) return null;
  const pDang = Math.min(100, (dangChua / sucChua) * 100);
  const pThem = Math.max(0, Math.min(100, ((dangChua + them) / sucChua) * 100) - pDang);
  return (
    <div
      className={cn("flex h-1.5 overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={sucChua}
      aria-valuenow={Math.min(sucChua, dangChua + them)}
      aria-label={maKe ? t("Lấp đầy kệ {{ma}}", { ma: maKe }) : undefined}
    >
      <span className="bg-slate-400" style={{ width: `${pDang}%` }} />
      {pThem > 0 ? <span className={cn(dangChua + them > sucChua ? "bg-bo-danger" : "bg-bo-primary")} style={{ width: `${pThem}%` }} /> : null}
    </div>
  );
}
