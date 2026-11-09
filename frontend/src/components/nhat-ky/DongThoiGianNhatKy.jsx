import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  aiThucHien,
  dongThayDoi,
  laGhiChuNhayCam,
  laHanhDongNguyHiem,
  nhanHanhDong,
} from "@/constants/nhatKy";
import { formatDateTime } from "@/utils/formatters";
import { t } from "@/i18n";

// Trường có giá trị là nhãn cố định (trạng thái, loại) → dịch lúc vẽ; giá trị khác là dữ liệu người dùng, giữ nguyên
// "Trước" / "Sau" của nhật ký khác "Trước" (trang trước) ở chỗ khác: dịch theo ngữ cảnh, thiếu thì dùng khóa trần
const NGU_CANH_NHAT_KY = { context: "nhat_ky" };
const TRUONG_NHAN_CO_DINH = new Set(["trangThai", "loaiKho", "loaiKhachHang"]);
const giaTriHien = (d, v) => (TRUONG_NHAN_CO_DINH.has(d.khoa) || v === "Có" || v === "Không" ? t(v) : v);

/** Người làm (tên người giữ nguyên) hoặc nguồn ("Hệ thống", "Shopify"…) đã dịch. */
const aiThucHienHien = (dong) =>
  dong?.nguoiThucHienTen || dong?.nguoiThucHienTenDangNhap ? aiThucHien(dong) : t(aiThucHien(dong));

/**
 * Phần đổi của một bản ghi: mỗi trường một dòng "Trường: cũ → mới" (cũ gạch mờ). Chỉ có giá trị mới (tạo) thì
 * "Trường: mới"; chỉ có giá trị cũ (xóa) thì "Trường: cũ" gạch.
 */
export function PhanThayDoi({ dong, className }) {
  const ds = dongThayDoi(dong);
  if (!ds.length) return null;
  return (
    <dl className={cn("m-0 grid gap-1 text-[13px] leading-5", className)}>
      {ds.map((d) => (
        <div key={d.khoa} className="min-w-0 break-words">
          {d.nhan ? <dt className="inline text-bo-muted">{t(d.nhan, NGU_CANH_NHAT_KY)}: </dt> : null}
          <dd className="m-0 inline text-bo-foreground">
            {d.coCu && d.coMoi ? (
              <>
                <span className="text-bo-muted line-through decoration-slate-300">{giaTriHien(d, d.cu)}</span>
                <ArrowRight className="mx-1 inline size-3.5 align-[-2px] text-bo-muted" aria-label={t("thành")} />
                <span className="font-medium">{giaTriHien(d, d.moi)}</span>
              </>
            ) : d.coMoi ? (
              <span className="font-medium">{giaTriHien(d, d.moi)}</span>
            ) : (
              <span className="text-bo-muted line-through decoration-slate-300">{giaTriHien(d, d.cu)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Ghi chú / lý do; ghi chú bắt đầu "[Nhạy cảm]" (đổi MST nhà cung cấp) có nền vàng nhạt. */
export function GhiChuNhatKy({ ghiChu, className }) {
  if (!ghiChu) return null;
  const nhayCam = laGhiChuNhayCam(ghiChu);
  return (
    <p
      className={cn(
        "m-0 whitespace-pre-line break-words rounded-md px-2.5 py-1.5 text-[13px] leading-5",
        nhayCam ? "border border-bo-warning/30 bg-bo-warning-soft text-slate-800" : "bg-bo-surface-subtle text-slate-700",
        className,
      )}
    >
      {ghiChu}
    </p>
  );
}

/**
 * Dòng thời gian lịch sử thay đổi của một mục danh mục (mới nhất trước): thời điểm, hành động, người hoặc nguồn
 * ("Hệ thống", "Shopify"), kho; phần đổi "Trường: cũ → mới"; lý do / ghi chú.
 * - `ds`: NhatKyDto[] từ máy chủ.
 * - `nhanDoiTuong`: (dong) => chữ phụ sau tên hành động, vd. SKU của dòng đổi giá trong lịch sử sản phẩm; null = không.
 */
export default function DongThoiGianNhatKy({ ds, nhanDoiTuong, className }) {
  return (
    <ol aria-label={t("Lịch sử thay đổi, mới nhất trước")} className={cn("m-0 list-none p-0", className)}>
      {ds.map((dong) => {
        const nguyHiem = laHanhDongNguyHiem(dong.hanhDong);
        const phu = [aiThucHienHien(dong), dong.tenKho].filter(Boolean).join(" · ");
        const doiTuong = nhanDoiTuong ? nhanDoiTuong(dong) : null;
        return (
          <li key={dong.id} className="relative border-b border-[#eef1f5] py-3.5 pl-5 last:border-b-0">
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-[21px] size-2 rounded-full",
                nguyHiem ? "bg-bo-danger" : "bg-bo-primary/70",
              )}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className={cn("m-0 text-sm font-semibold leading-5", nguyHiem ? "text-bo-danger" : "text-bo-foreground")}>
                {t(nhanHanhDong(dong.hanhDong))}
                {doiTuong ? <span className="font-normal text-bo-muted">{" · "}{doiTuong}</span> : null}
              </p>
              <time dateTime={dong.ngayThucHien ?? undefined} className="text-xs tabular-nums text-bo-muted">
                {formatDateTime(dong.ngayThucHien)}
              </time>
            </div>
            {phu ? <p className="m-0 mt-0.5 text-[13px] leading-5 text-bo-muted">{phu}</p> : null}
            <PhanThayDoi dong={dong} className="mt-1.5" />
            <GhiChuNhatKy ghiChu={dong.ghiChu} className="mt-1.5" />
          </li>
        );
      })}
    </ol>
  );
}
