import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const pad2 = (n) => String(n).padStart(2, "0");

/** "10/10" hoặc "09:15 · 12/10" (theo giờ máy người dùng, cùng cách Chi tiết đơn mua hàng hiển thị mốc). */
function ngayNgan(value, coGio = false) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const ngay = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  return coGio ? `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${ngay}` : ngay;
}

const KIEU_CHAM = {
  xong: "border-bo-primary bg-bo-primary text-white",
  dangLam: "border-bo-primary bg-white ring-4 ring-bo-primary-soft",
  chua: "border-slate-300 bg-white",
  dung: "border-bo-danger bg-bo-danger text-white",
};

const KIEU_NHAN = {
  xong: "font-medium text-bo-foreground",
  dangLam: "font-semibold text-bo-foreground",
  chua: "font-medium text-bo-muted",
  dung: "font-medium text-bo-danger",
};

const CHU_DOC = {
  xong: " (đã xong)",
  dangLam: " (đang làm)",
  chua: " (chưa tới)",
  dung: " (đã dừng)",
};

/**
 * Thanh tiến trình của chứng từ (tổng quát hóa TienTrinhDonMua): số bước tùy màn.
 * Mỗi bước `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, coGio, ai, canhBao }`, các dòng dưới nhãn:
 * `ai` (dòng nhỏ "ai làm", vd. "Kho nguồn") · `phu` kèm `canhBao` chữ đỏ · mốc `ngay` dòng riêng ("HH:mm · dd/MM" khi `coGio`).
 * Thanh tự là container: rộng từ 576px (`@xl`) thì một hàng ngang chia đều, có vạch nối; hẹp hơn (điện thoại, 768px có
 * thanh bên) thì danh sách dọc. Bước đang làm có aria-current="step" (mỗi thanh chỉ nên có một bước "dangLam").
 * `nhan`: tên vùng cho trình đọc màn hình, vd. "Tiến trình phiếu chuyển kho".
 */
export default function TienTrinhChungTu({ buoc, nhan = "Tiến trình", className }) {
  const ds = Array.isArray(buoc) ? buoc.filter(Boolean) : [];
  if (!ds.length) return null;

  // Điện thoại: thanh gọn một dòng (chấm từng bước + bước đang làm), chạm để xem danh sách bước — danh sách dọc 5 bước
  // chiếm ~250px đẩy phần làm việc xuống cuối màn. Từ 768px giữ nguyên.
  let iHienTai = ds.findIndex((b) => b.trangThai === "dangLam" || b.trangThai === "dung");
  if (iHienTai < 0) iHienTai = Math.max(0, ds.map((b) => b.trangThai).lastIndexOf("xong"));
  const hienTai = ds[iHienTai];
  const ttHienTai = KIEU_CHAM[hienTai.trangThai] ? hienTai.trangThai : "chua";
  const coCanhBao = ds.some((b) => b.canhBao);

  return (
    <nav
      aria-label={nhan}
      className={cn("@container/tientrinh border-t border-bo-border bg-bo-surface-subtle px-4 py-4 sm:px-6 sm:py-5 max-md:py-2!", className)}
    >
      <details className="group md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {ds.map((b, i) => (
              <span key={b.ma ?? i} className={cn("size-2 rounded-full", KIEU_CHAM_GON[KIEU_CHAM[b.trangThai] ? b.trangThai : "chua"])} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-bo-muted">
            <span className="sr-only">{`Bước ${iHienTai + 1}/${ds.length}: `}</span>
            <span className={cn("font-semibold", ttHienTai === "dung" ? "text-bo-danger" : "text-bo-foreground")}>{hienTai.nhan}</span>
            <span className="sr-only">{CHU_DOC[ttHienTai]}</span>
            {hienTai.phu ? ` · ${hienTai.phu}` : ""}
            {/* Cảnh báo (vd. "Lệch 2") của bất kỳ bước nào cũng phải thấy được khi thanh đang gập */}
            {coCanhBao ? (
              <span className="font-medium text-bo-danger">{` · ${hienTai.canhBao || ds.find((b) => b.canhBao).canhBao}`}</span>
            ) : null}
          </span>
          <ChevronDown className="size-4 shrink-0 text-bo-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          <span className="sr-only">Xem các bước</span>
        </summary>
        <ol className="flex flex-col gap-3 pb-2 pt-1">{ds.map((b, i) => veBuoc(b, i, ds.length))}</ol>
      </details>
      {/* Bọc riêng để ẩn trên điện thoại: lớp @xl/tientrinh:grid của ol đứng sau max-md:hidden trong CSS sẽ thắng */}
      <div className="max-md:hidden">
        <ol
          style={{ "--so-buoc": ds.length }}
          className="flex flex-col gap-3 @xl/tientrinh:grid @xl/tientrinh:grid-cols-[repeat(var(--so-buoc),minmax(0,1fr))] @xl/tientrinh:gap-0"
        >
          {ds.map((b, i) => veBuoc(b, i, ds.length))}
        </ol>
      </div>
    </nav>
  );
}

// Chấm nhỏ của thanh gọn trên điện thoại
const KIEU_CHAM_GON = {
  xong: "bg-bo-primary",
  dangLam: "bg-bo-primary ring-[3px] ring-bo-primary-soft",
  chua: "bg-slate-300",
  dung: "bg-bo-danger",
};

function veBuoc(b, i, soBuoc) {
  const cuoi = i === soBuoc - 1;
  const trangThai = KIEU_CHAM[b.trangThai] ? b.trangThai : "chua";
  const moc = ngayNgan(b.ngay, b.coGio);
  return (
    <li
      key={b.ma ?? i}
      aria-current={trangThai === "dangLam" ? "step" : undefined}
      className="flex min-w-0 gap-3 @xl/tientrinh:block @xl/tientrinh:pr-3"
    >
      <div className="flex shrink-0 items-center @xl/tientrinh:h-6">
        <span
          aria-hidden="true"
          className={cn(
            "relative z-[1] inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            KIEU_CHAM[trangThai],
          )}
        >
          {trangThai === "xong" ? <Check className="size-3.5" strokeWidth={3} /> : null}
          {trangThai === "dangLam" ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
          {trangThai === "dung" ? <X className="size-3.5" strokeWidth={3} /> : null}
        </span>
        {cuoi ? null : (
          <span
            aria-hidden="true"
            className={cn(
              "ml-2 hidden h-0.5 flex-1 rounded-full @xl/tientrinh:block",
              trangThai === "xong" ? "bg-bo-primary" : "bg-bo-border",
            )}
          />
        )}
      </div>
      <div className="min-w-0 @xl/tientrinh:mt-2.5">
        <div className={cn("text-[13px] leading-[18px]", KIEU_NHAN[trangThai])}>
          {b.nhan}
          <span className="sr-only">{CHU_DOC[trangThai]}</span>
        </div>
        {b.ai ? <div className="text-[11px] font-medium leading-4 text-slate-500">{b.ai}</div> : null}
        {b.phu || b.canhBao ? (
          <div className="mt-0.5 text-xs leading-4 text-bo-muted tabular-nums">
            {b.phu}
            {b.canhBao ? (
              <>
                {b.phu ? " · " : ""}
                <span className="font-medium text-bo-danger">{b.canhBao}</span>
              </>
            ) : null}
          </div>
        ) : null}
        {moc ? <div className="mt-0.5 text-xs leading-4 text-bo-muted tabular-nums">{moc}</div> : null}
      </div>
    </li>
  );
}
