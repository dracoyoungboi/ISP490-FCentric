import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import NutSaoChep from "@/components/shared/NutSaoChep";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

const coGiaTri = (x) => x != null && x !== false && x !== "";
const TRONG = <span className="text-bo-muted">—</span>;

/**
 * Cột thuộc tính bên phải của khối chứng từ (cùng kiểu ThuocTinhDonMua): người, nơi, ghi chú, chứng từ liên quan.
 * Từ 1280px: cột 340px cạnh bảng (KhungChungTu chia cột). Hẹp hơn: xuống dưới bảng, các nhóm xếp 2 cột khi KHỐI rộng
 * từ 672px (`@2xl/khoi`, container của KhungChungTu) — không theo khổ màn hình, để 768px có thanh bên vẫn một cột.
 * `nhan`: tên vùng cho trình đọc màn hình, vd. "Thông tin phiếu nhặt hàng".
 */
export default function CotThuocTinh({ nhan, children, className }) {
  return (
    <aside
      aria-label={nhan}
      className={cn(
        "grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @2xl/khoi:grid-cols-2 xl:block xl:border-l xl:border-t-0",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/**
 * Một nhóm trong cột thuộc tính: nhãn nhỏ (tùy chọn) + nội dung, vạch ngăn bên dưới (nhóm cuối không có).
 * `rong`: chiếm cả 2 cột khi cột thuộc tính đang xếp 2 cột (khối ≥ 672px, dưới 1280px).
 */
export function NhomThuocTinh({ nhan, children, rong = false, className }) {
  return (
    <section className={cn("min-w-0 border-b border-slate-200/70 py-4 last:border-b-0", rong && "@2xl/khoi:col-span-2", className)}>
      {nhan ? <h2 className="text-xs font-medium leading-4 text-bo-muted">{nhan}</h2> : null}
      <div className={nhan ? "mt-2" : undefined}>{children}</div>
    </section>
  );
}

/**
 * Bảng nhãn – giá trị 2 cột (<dl>). `muc`: `[{ nhan, giaTri, an }]`; giá trị trống hiện "—", `an` thì bỏ dòng.
 * `rongNhan`: bề rộng cột nhãn (mặc định 104px như Chi tiết đơn mua hàng).
 */
export function BangThuocTinh({ muc, rongNhan = 104, className }) {
  const ds = (Array.isArray(muc) ? muc : []).filter((m) => m && !m.an);
  if (!ds.length) return null;
  return (
    <dl
      style={{ gridTemplateColumns: `${rongNhan}px minmax(0, 1fr)` }}
      className={cn("m-0 grid gap-x-3 gap-y-2.5 text-[13px] leading-5", className)}
    >
      {ds.map((m, i) => (
        <div key={m.ma ?? (typeof m.nhan === "string" ? m.nhan : i)} className="contents">
          <dt className="text-bo-muted">{m.nhan}</dt>
          <dd className="m-0 min-w-0 break-words text-bo-foreground">{coGiaTri(m.giaTri) ? m.giaTri : TRONG}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Giá trị một dòng kèm nút sao chép (email, số điện thoại, mã): dài thì cắt "…" (rê chuột thấy đủ). */
export function GiaTriSaoChep({ giaTri, nhanSaoChep, className }) {
  if (!coGiaTri(giaTri)) return TRONG;
  const chu = String(giaTri);
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="min-w-0 flex-1 truncate" title={chu}>
        {chu}
      </span>
      <NutSaoChep giaTri={chu} nhan={nhanSaoChep} className="size-6" />
    </span>
  );
}

const THE =
  "flex min-w-0 items-center justify-between gap-2 rounded-md border border-bo-border bg-white px-2.5 py-2 text-[13px] leading-5";
const THE_BAM =
  "transition-colors hover:border-slate-300 hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

/**
 * Nhóm "Chứng từ liên quan": mỗi mục một thẻ `{ loai, ma, to | onClick, trangThai, quyTrinh, nhomTrangThai }`.
 * `to` → liên kết trong ứng dụng, `onClick` → nút, không có cả hai → chỉ hiện. Có `trangThai` thì hiện thẻ trạng thái
 * (StatusBadge, truyền `quyTrinh` của loại chứng từ đó), không thì mũi tên. Danh sách rỗng: không vẽ gì.
 * `chan`: nội dung dưới danh sách (vd. nút "Xem thêm n phiếu xuất", câu giải thích khi không tìm thấy chứng từ);
 * có `chan` thì nhóm vẫn vẽ dù danh sách rỗng.
 */
export function ChungTuLienQuan({ ds, nhan = "Chứng từ liên quan", rong = false, chan }) {
  const muc = (Array.isArray(ds) ? ds : []).filter(Boolean);
  if (!muc.length && !chan) return null;
  return (
    <NhomThuocTinh nhan={nhan} rong={rong}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {muc.map((m, i) => {
          const noiDung = (
            <>
              <span className="min-w-0">
                <span className="block text-xs leading-4 text-bo-muted">{m.loai}</span>
                <span className="block truncate font-semibold tabular-nums text-bo-foreground">{coGiaTri(m.ma) ? m.ma : "—"}</span>
              </span>
              {m.trangThai ? (
                <StatusBadge label={m.trangThai} quyTrinh={m.quyTrinh} nhom={m.nhomTrangThai} />
              ) : m.to || m.onClick ? (
                <ChevronRight className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
              ) : null}
            </>
          );
          return (
            <li key={m.khoa ?? `${m.loai}-${m.ma ?? i}`} className="min-w-0">
              {m.to ? (
                <Link to={m.to} className={cn(THE, THE_BAM)}>
                  {noiDung}
                </Link>
              ) : m.onClick ? (
                <button type="button" onClick={m.onClick} className={cn(THE, THE_BAM, "w-full text-left")}>
                  {noiDung}
                </button>
              ) : (
                <div className={THE}>{noiDung}</div>
              )}
            </li>
          );
        })}
      </ul>
      {chan ? <div className={muc.length ? "mt-2" : undefined}>{chan}</div> : null}
    </NhomThuocTinh>
  );
}
