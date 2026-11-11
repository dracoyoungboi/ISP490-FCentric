import { Lock, Minus, Plus, Wrench, X } from "lucide-react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t, tDuLieu } from "@/i18n";
import { coGioiHan, soNguyen } from "./chuyenKe";

// Nhãn trạng thái kệ (vi_tri_kho.trang_thai). Đổi ngôn ngữ là tải lại trang nên gọi t() ở cấp module vẫn đúng
const TRANG_THAI_KE = {
  HOAT_DONG: { nhan: t("Hoạt động"), lop: "border-emerald-200 bg-bo-success-soft text-emerald-700" },
  DAY_HANG: { nhan: t("Đầy hàng"), lop: "border-amber-200 bg-bo-warning-soft text-amber-800" },
  BAO_TRI: { nhan: t("Bảo trì"), lop: "border-amber-200 bg-bo-warning-soft text-amber-800" },
  KHOA_KIEM_KE: { nhan: t("Đang kiểm kê"), lop: "border-red-200 bg-bo-danger-soft text-red-700" },
};

export function NhanTrangThaiKe({ trangThai, className }) {
  const k = TRANG_THAI_KE[trangThai] ?? { nhan: trangThai ?? "", lop: "border-bo-border bg-bo-surface-subtle text-bo-muted" };
  if (!k.nhan) return null;
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", k.lop, className)}>
      {TRANG_THAI_KE[trangThai] ? k.nhan : tDuLieu(k.nhan)}
    </span>
  );
}

/** Thanh lấp đầy kệ: `dangChua` trên `sucChua`, phần `them` (sắp cất vào) tô đậm hơn. Kệ không giới hạn: chỉ ghi số. */
export function ThanhSucChua({ ke, them = 0, className }) {
  const dang = ke?.dangChua ?? 0;
  if (!coGioiHan(ke)) {
    return (
      <p className={cn("text-xs tabular-nums text-bo-muted", className)}>
        {t("Đang chứa {{so}} · không giới hạn sức chứa", { so: soVN(dang) })}
      </p>
    );
  }
  const sau = dang + them;
  const pDang = Math.min(100, (dang / ke.sucChua) * 100);
  const pThem = Math.max(0, Math.min(100, (sau / ke.sucChua) * 100) - pDang);
  const vuot = sau > ke.sucChua;
  return (
    <div className={cn("grid gap-1", className)}>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ke.sucChua}
        aria-valuenow={Math.min(sau, ke.sucChua)}
        aria-label={t("Lấp đầy kệ {{ma}}", { ma: ke.maViTri })}
      >
        <span className="h-full bg-slate-400" style={{ width: `${pDang}%` }} />
        {pThem > 0 ? <span className={cn("h-full", vuot ? "bg-bo-danger" : "bg-bo-primary")} style={{ width: `${pThem}%` }} /> : null}
      </div>
      <p className={cn("flex justify-between gap-2 text-xs tabular-nums", vuot ? "text-bo-danger" : "text-bo-muted")}>
        <span>
          {them > 0
            ? t("Sau khi cất: {{sau}}/{{sucChua}}", { sau: soVN(sau), sucChua: soVN(ke.sucChua) })
            : t("Đang chứa {{dang}}/{{sucChua}}", { dang: soVN(dang), sucChua: soVN(ke.sucChua) })}
        </span>
        <span>{t("Còn trống {{so}}", { so: soVN(Math.max(0, ke.sucChua - sau)) })}</span>
      </p>
    </div>
  );
}

/** Vị trí kệ "Khu A · Dãy 01 · Hàng 02 · Tầng 3" (bỏ phần trống). */
function viTriCua(ke) {
  return [
    ke?.khuVuc ? tDuLieu(ke.khuVuc) : null,
    ke?.dayKe ? t("Dãy {{so}}", { so: ke.dayKe }) : null,
    ke?.hangKe ? t("Hàng {{so}}", { so: ke.hangKe }) : null,
    ke?.tangKe ? t("Tầng {{so}}", { so: ke.tangKe }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Đầu thẻ kệ đã quét: mã kệ, vị trí, trạng thái, sức chứa; nút × bỏ kệ. */
export function DauKe({ ke, onBo, nhanBo, them = 0, children }) {
  return (
    <div className="grid gap-2.5 rounded-lg border border-bo-border bg-bo-surface-subtle/60 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold leading-6 text-bo-heading">{ke.maViTri}</span>
            <NhanTrangThaiKe trangThai={ke.trangThai} />
            {ke.trangThai === "BAO_TRI" ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-800">
                <Wrench className="size-3.5" aria-hidden="true" />
                {t("Chỉ chuyển hàng đi, không nhận hàng")}
              </span>
            ) : null}
          </div>
          {viTriCua(ke) ? <p className="mt-0.5 text-[13px] text-bo-muted">{viTriCua(ke)}</p> : null}
        </div>
        {onBo ? (
          <button
            type="button"
            onClick={onBo}
            aria-label={nhanBo}
            title={nhanBo}
            className="grid size-8 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-white hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <ThanhSucChua ke={ke} them={them} />
      {children}
    </div>
  );
}

const NUT_BUOC =
  "grid size-9 place-items-center rounded-md border border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";

/**
 * Một lô trên kệ nguồn (BA 6.1 "Danh sách SKU &amp; Lô" + "Số lượng chuyển"): ảnh, tên, màu / cỡ, SKU, mã lô, ngày nhập;
 * tồn ở kệ, đang chờ nhặt, khả dụng; ô số lượng có nút − / +. `loi`: câu lỗi dưới dòng (A2).
 */
export function DongLo({ dong, giaTri, onDoi, loi, inputRef, noiBat }) {
  const so = soNguyen(giaTri);
  const khoa = dong.khoaKiemKe || dong.khaDung <= 0;
  const idO = `ck-sl-${dong.loHangId}`;
  return (
    <li
      className={cn(
        "grid gap-2 rounded-lg border border-bo-border bg-white p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        so > 0 && "border-bo-primary/40 bg-bo-primary-soft/40",
        noiBat && "ring-2 ring-bo-primary/30",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AnhBienThe src={dong.anh} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-bo-foreground">{dong.tenSanPham ? tDuLieu(dong.tenSanPham) : dong.maSku}</p>
          <MauKichCo tenMau={dong.mau} maMauHex={dong.maMauHex} kichCo={dong.kichCo} className="mt-0.5" />
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-bo-muted">
            <span>
              {t("SKU")} <span className="font-mono text-bo-foreground">{dong.maSku}</span>
            </span>
            <span>
              {t("Lô")} <span className="font-mono text-bo-foreground">{dong.maLo}</span>
            </span>
            {dong.ngayNhap ? <span>{t("Nhập {{ngay}}", { ngay: new Date(dong.ngayNhap).toLocaleDateString("vi-VN") })}</span> : null}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
            <span className="text-bo-muted">
              {t("Tồn ở kệ")} <b className="font-semibold text-bo-foreground">{soVN(dong.tonTaiKe)}</b>
            </span>
            {dong.dangGiuNhat > 0 ? (
              <span className="text-amber-800">{t("Chờ nhặt {{so}}", { so: soVN(dong.dangGiuNhat) })}</span>
            ) : null}
            <span className="text-bo-muted">
              {t("Khả dụng")} <b className="font-semibold text-bo-success">{soVN(dong.khaDung)}</b>
            </span>
          </p>
        </div>
      </div>
      {dong.khoaKiemKe ? (
        <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full border border-red-200 bg-bo-danger-soft px-2.5 py-1 text-xs font-medium text-red-700 sm:justify-self-end">
          <Lock className="size-3.5" aria-hidden="true" />
          {t("Lô đang kiểm kê")}
        </span>
      ) : (
        <div className="flex items-center gap-1.5 justify-self-start sm:justify-self-end">
          <button type="button" className={NUT_BUOC} disabled={khoa || so <= 0} onClick={() => onDoi(so - 1)} aria-label={t("Bớt 1")}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <label htmlFor={idO} className="sr-only">
            {t("Số lượng chuyển lô {{ma}}", { ma: dong.maLo })}
          </label>
          <input
            ref={inputRef}
            id={idO}
            inputMode="numeric"
            autoComplete="off"
            disabled={khoa}
            value={giaTri ?? ""}
            placeholder="0"
            onChange={(e) => onDoi(e.target.value.replace(/[^\d]/g, ""))}
            onFocus={(e) => e.target.select()}
            aria-invalid={loi ? true : undefined}
            aria-describedby={loi ? `${idO}-loi` : undefined}
            className={cn(
              "h-9 w-16 rounded-md border border-bo-input-border bg-white text-center text-sm font-semibold tabular-nums outline-none focus:border-bo-primary focus:ring-[3px] focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle",
              loi && "border-bo-danger",
            )}
          />
          <button type="button" className={NUT_BUOC} disabled={khoa || so >= dong.khaDung} onClick={() => onDoi(so + 1)} aria-label={t("Thêm 1")}>
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {loi ? (
        <p id={`${idO}-loi`} className="text-xs font-medium text-bo-danger sm:col-span-2">
          {loi}
        </p>
      ) : null}
    </li>
  );
}
