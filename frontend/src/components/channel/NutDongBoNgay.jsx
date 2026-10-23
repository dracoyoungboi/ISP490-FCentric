import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleStop, Loader2, Minus, RefreshCw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import {
  cacBuocDongBo,
  cauConLai,
  dangChayDongBo,
  dongHoDaChay,
  ketQuaDongBo,
  phanTramDongBo,
  soChuaDay,
  thoiLuong,
} from "./tienDoDongBo";

/** Ảnh chụp tạm trong lúc chờ máy chủ nhận lệnh bắt đầu */
const PHIEN_DANG_BAT_DAU = { trangThai: "dang_chay", giaiDoan: "doc_san_pham", daXuLy: 0, soThanhCong: 0, soLoi: 0, daChayMs: 0 };
const SO_LOI_HIEN = 3;
const NUT = "h-9 gap-2 rounded-lg border-bo-border bg-white px-3.5 text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
const MAU_CHAM = { ok: "bg-bo-success", canh: "bg-amber-500", loi: "bg-bo-danger", dung: "bg-slate-400" };
// Điện thoại (dưới 640 px): nút và liên kết trong bảng cao 44 px cho dễ chạm
const NUT_NHO =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-bo-border bg-white px-2.5 text-[12.5px] font-medium text-bo-foreground transition-colors hover:bg-bo-surface-subtle disabled:cursor-default disabled:text-bo-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:h-11 max-sm:px-3.5";
const LIEN_KET =
  "text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 rounded-sm max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";
const CHUA_SAN_SANG = "Chưa tải xong thông tin gian hàng, bấm lại sau giây lát.";

const so = (n) => Number(n || 0).toLocaleString("vi-VN");

function gioPhut(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Nút "Đồng bộ ngay" kèm bảng tiến độ thả xuống, số liệu thật từ máy chủ. Có ở cả ba trang của gian hàng
 * (Tổng quan, Sản phẩm, Đơn hàng — PA1 chốt 19/10/2026), cùng một đợt nên trang nào cũng thấy cùng tiến độ.
 * Rảnh: bấm là bắt đầu và mở bảng. Đang chạy: nút hiện phần trăm, bấm để mở hoặc ẩn bảng; ẩn bảng thì đồng bộ vẫn chạy.
 * Xong lúc bảng đang ẩn: nút đổi thành "Kết quả đồng bộ" có chấm màu, tới khi người dùng mở xem rồi đóng.
 * `onDen(duongDan)`: mở một trang con của gian hàng (SKU lỗi, đơn mới, cấu hình).
 * `viecPhu`: chữ hiện trên nút khi trang đang chạy một việc khác với gian hàng (vd. "Đang tải sản phẩm…");
 * lúc đó nút bị khóa để hai việc không chồng nhau.
 * `lyDoKhoa`: không cho bắt đầu đợt mới vì gian hàng chưa gọi được (vd. "Ủy quyền lại trước khi đồng bộ"). Nút mờ nhưng
 * vẫn nhận tiêu điểm và di chuột (aria-disabled, không dùng disabled vì nút shadcn bị khóa thì bỏ qua chuột): lý do hiện ở
 * chú thích khi di chuột và được đọc qua aria-describedby; "Đồng bộ lại" trong bảng kết quả cũng nhường chỗ cho lý do.
 */
export default function NutDongBoNgay({ tienDo, tenSan, onDen, viecPhu = null, lyDoKhoa = null }) {
  const { phien, dangChay, dangGui, conLaiMs, cuaTrangNay, daXem, danhDauDaXem, sanSang = true, batDau, dung } = tienDo;
  const [mo, setMo] = useState(false);
  const idLyDo = useId();

  const ketThucCuaTrang = cuaTrangNay && phien && !dangChay ? phien.maPhien : null;
  const choXem = ketThucCuaTrang != null && ketThucCuaTrang !== daXem;
  // Việc khác của trang chỉ chạy được khi rảnh (menu ⋯ khóa lúc đang đồng bộ)
  const banViecKhac = Boolean(viecPhu) && !dangChay && !dangGui;
  // Bấm nút lúc rảnh là bắt đầu đợt mới (kết quả chưa xem thì bấm để mở xem)
  const ranh = !dangChay && !dangGui && !choXem;
  // Gian hàng đang bị khóa: không cho bắt đầu đợt mới
  const khoaBatDau = Boolean(lyDoKhoa) && ranh;
  // Chưa tải xong thông tin gian hàng (1–2 giây đầu mỗi lần mở trang): giữ kiểu nút bình thường để không nhấp nháy
  // trạng thái khóa; bấm lúc này thì báo chờ, không bắt đầu
  const choTai = !sanSang && !lyDoKhoa && ranh;
  const hien = dangGui && !dangChay ? PHIEN_DANG_BAT_DAU : phien;
  const pct = phanTramDongBo(hien);

  const batDauVaMo = async () => {
    setMo(true);
    const p = await batDau();
    if (!p) setMo(false);
  };

  // "Đồng bộ lại" trong bảng kết quả: cùng điều kiện với nút chính
  const batDauLai = () => {
    if (lyDoKhoa) return;
    if (!sanSang) {
      toast.info(CHUA_SAN_SANG);
      return;
    }
    void batDau();
  };

  const doiMo = (moMoi) => {
    if (moMoi) {
      if (banViecKhac) return;
      // Màn chạm không hiện title: bấm vào nút đang khóa thì nói lý do
      if (khoaBatDau) {
        toast.info(lyDoKhoa);
        return;
      }
      if (choTai) {
        toast.info(CHUA_SAN_SANG);
        return;
      }
      if (ranh) {
        void batDauVaMo();
        return;
      }
      setMo(true);
      return;
    }
    setMo(false);
    if (ketThucCuaTrang) danhDauDaXem(ketThucCuaTrang);
  };

  const den = (duongDan) => {
    doiMo(false);
    onDen(duongDan);
  };

  let noiDungNut;
  if (dangGui && !dangChay) {
    noiDungNut = (
      <>
        <Loader2 className="size-4 animate-spin" />
        Đang bắt đầu…
      </>
    );
  } else if (dangChay) {
    noiDungNut = (
      <>
        <VongTienDo pct={pct} />
        <span>
          Đang đồng bộ · <span className="inline-block min-w-[3.5ch] tabular-nums">{pct}%</span>
        </span>
        {mo ? <ChevronUp className="size-3.5 text-bo-muted" /> : <ChevronDown className="size-3.5 text-bo-muted" />}
      </>
    );
  } else if (banViecKhac) {
    noiDungNut = (
      <>
        <Loader2 className="size-4 animate-spin text-bo-primary" />
        {viecPhu}
      </>
    );
  } else if (choXem) {
    noiDungNut = (
      <>
        <span className={cn("size-2 rounded-full", MAU_CHAM[ketQuaDongBo(phien).tone])} aria-hidden="true" />
        Kết quả đồng bộ
        {mo ? <ChevronUp className="size-3.5 text-bo-muted" /> : <ChevronDown className="size-3.5 text-bo-muted" />}
      </>
    );
  } else {
    noiDungNut = (
      <>
        <RefreshCw className="size-4" />
        Đồng bộ ngay
      </>
    );
  }

  return (
    <>
      <Popover open={mo} onOpenChange={doiMo}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-haspopup="dialog"
            aria-label={dangChay ? `Đang đồng bộ ${pct}%, ${mo ? "ẩn" : "xem"} tiến độ` : undefined}
            aria-busy={banViecKhac || dangGui || choTai || undefined}
            aria-disabled={khoaBatDau || undefined}
            aria-describedby={khoaBatDau ? idLyDo : undefined}
            disabled={banViecKhac}
            title={khoaBatDau ? lyDoKhoa : undefined}
            className={cn(
              NUT,
              dangChay && "border-[#b9d5ff] text-[#0b4fb3] hover:bg-bo-primary-soft",
              banViecKhac && "disabled:opacity-100 text-bo-muted",
              khoaBatDau && "cursor-not-allowed opacity-50 hover:bg-white",
            )}
          >
            {noiDungNut}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          aria-label="Tiến độ đồng bộ"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[376px] max-w-[calc(100vw-32px)] rounded-[10px] border-bo-border bg-white p-0 text-bo-foreground shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28),0_2px_6px_rgba(16,24,40,0.06)]"
        >
          {hien ? (
            <BangTienDo
              phien={hien}
              pct={pct}
              conLaiMs={conLaiMs}
              tenSan={tenSan}
              onDong={() => doiMo(false)}
              onDung={dung}
              onBatDauLai={batDauLai}
              lyDoKhoa={lyDoKhoa}
              dangGui={dangGui}
              onDen={den}
            />
          ) : null}
        </PopoverContent>
      </Popover>
      {/* Lý do khóa cho trình đọc màn hình; người dùng chuột đọc ở chú thích (title) của nút */}
      {khoaBatDau ? (
        <span id={idLyDo} className="sr-only">
          {lyDoKhoa}
        </span>
      ) : null}
    </>
  );
}

function VongTienDo({ pct }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(#1677ff ${pct}%, #dbe3ee 0)`,
        WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
        mask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
      }}
    />
  );
}

function BangTienDo({ phien: p, pct, conLaiMs, tenSan, onDong, onDung, onBatDauLai, lyDoKhoa, dangGui, onDen }) {
  const chay = dangChayDongBo(p);
  const kq = chay ? null : ketQuaDongBo(p);
  const buoc = cacBuocDongBo(p, tenSan);
  const nguoi = p.nguoiBam ? ` · ${p.nguoiBam}` : "";
  const phu = !p.maPhien
    ? "Đang gửi lệnh tới máy chủ…"
    : chay
      ? `Bắt đầu ${gioPhut(p.batDau) ?? ""}${nguoi} · đã chạy ${dongHoDaChay(p.daChayMs)}`
      : `Lúc ${gioPhut(p.ketThuc) ?? "—"} · mất ${thoiLuong(p.daChayMs)}${nguoi}`;
  const chuaDay = soChuaDay(p);

  return (
    <div>
      <div className="flex items-start gap-2.5 py-2.5 pl-3.5 pr-2">
        <BieuTuongTieuDe chay={chay} tone={kq?.tone} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-bo-heading">{chay ? `Đồng bộ với ${tenSan}` : kq.tieuDe}</p>
          <p className="truncate text-xs leading-[18px] text-bo-muted tabular-nums" title={phu}>
            {phu}
          </p>
        </div>
        <button
          type="button"
          onClick={onDong}
          aria-label={chay ? "Ẩn bảng, đồng bộ vẫn chạy" : "Đóng"}
          title={chay ? "Ẩn, đồng bộ vẫn chạy tiếp" : "Đóng"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-bo-muted transition-colors hover:bg-[#eef1f5] hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:size-11"
        >
          {chay ? <Minus className="size-4" /> : <X className="size-4" />}
        </button>
      </div>

      {chay ? (
        <div className="flex items-center gap-2.5 px-3.5 pb-2.5">
          <div
            role="progressbar"
            aria-label="Tiến độ đồng bộ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8edf3]"
          >
            <div className="h-full rounded-full bg-bo-primary transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-9 text-right text-xs font-semibold tabular-nums text-[#0b4fb3]">{pct}%</span>
        </div>
      ) : null}

      <ol className="px-3.5 pb-3.5 pt-1">
        {buoc.map((b) => (
          <li
            key={b.ma}
            className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 pb-3.5 last:pb-0 before:absolute before:bottom-[3px] before:left-[9.5px] before:top-[25px] before:w-px before:bg-bo-border last:before:hidden"
          >
            <BieuTuongBuoc tt={b.tt} />
            <div className="min-w-0">
              <div className="flex min-h-5 items-baseline justify-between gap-2.5">
                <span className={cn("text-[13.5px] font-medium", b.tt === "cho" || b.tt === "boqua" ? "text-bo-muted" : "text-bo-heading")}>
                  {b.ten}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-right text-[12.5px] tabular-nums",
                    b.tt === "loi" || b.tt === "canh" ? "text-bo-danger" : "text-bo-muted",
                  )}
                >
                  {b.phu}
                </span>
              </div>
              <ChiTietBuoc ma={b.ma} tt={b.tt} phien={p} />
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-[10px] border-t border-[#eef1f5] bg-bo-surface-subtle px-3.5 py-2.5">
        {chay ? (
          <>
            <span className="min-w-0 flex-1 text-[12.5px] text-bo-muted">{p.maPhien ? cauConLai(p, conLaiMs) : "Đang bắt đầu…"}</span>
            {p.maPhien && p.giaiDoan !== "lay_don" ? (
              <button type="button" onClick={onDung} disabled={p.yeuCauDung} className={cn(NUT_NHO, "enabled:hover:border-red-200 enabled:hover:bg-bo-danger-soft enabled:hover:text-bo-danger")}>
                <Square className="size-2.5 fill-current" />
                {p.yeuCauDung ? "Đang dừng…" : "Dừng"}
              </button>
            ) : null}
          </>
        ) : p.trangThai === "xong" ? (
          <>
            <span className="min-w-0 flex-1 text-[12.5px] text-bo-muted">
              {p.soLoi || p.soDonMoi ? null : "Tồn kho đã khớp, không có đơn mới"}
            </span>
            {p.soLoi ? (
              <button type="button" className={cn(LIEN_KET, "text-bo-danger hover:text-bo-danger")} onClick={() => onDen("/products?trangThai=loi")}>
                Xem SKU lỗi
              </button>
            ) : null}
            {p.soDonMoi ? (
              <button type="button" className={LIEN_KET} onClick={() => onDen("/orders?trangThai=nhap")}>
                Xem đơn mới
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-[12.5px] text-bo-muted">{chuaDay ? `Còn ${so(chuaDay)} SKU chưa đẩy` : null}</span>
            {p.trangThai === "loi" ? (
              <button type="button" className={LIEN_KET} onClick={() => onDen("/settings")}>
                Mở cấu hình
              </button>
            ) : null}
            {/* Gian hàng đang bị khóa (vd. hết hạn ủy quyền): ghi lý do thay cho nút, không để nút bấm vào chỉ để báo lỗi */}
            {lyDoKhoa ? (
              <span className="text-[12.5px] font-medium text-bo-warning">{lyDoKhoa}</span>
            ) : (
              <button type="button" onClick={onBatDauLai} disabled={dangGui} className={NUT_NHO}>
                <RefreshCw className={cn("size-3", dangGui && "animate-spin")} />
                Đồng bộ lại
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Dòng phụ dưới một bước: SKU đang đẩy, lý do dừng, vài SKU lỗi đầu tiên. */
function ChiTietBuoc({ ma, tt, phien: p }) {
  const dong = "mt-1 text-xs leading-[1.45] [overflow-wrap:anywhere]";
  if (tt === "dang" && ma === "day-ton" && p.skuDangDay) {
    return (
      <p className={cn(dong, "text-bo-muted")}>
        Đang đẩy <code className="font-mono text-[11.5px] text-bo-foreground">{p.skuDangDay}</code>
      </p>
    );
  }
  if (tt === "loi" && p.loi) {
    return <p className={cn(dong, "text-bo-danger")}>{p.loi}</p>;
  }
  if (ma === "day-ton" && (tt === "canh" || tt === "loi" || tt === "dung") && p.dsLoi?.length) {
    const conLai = Number(p.soLoi || 0) - Math.min(p.dsLoi.length, SO_LOI_HIEN);
    return (
      <div className={cn(dong, "space-y-0.5 text-bo-muted")}>
        {p.dsLoi.slice(0, SO_LOI_HIEN).map((l) => (
          <p key={l.maSku}>
            <LyDoLoiSku loi={l} />
          </p>
        ))}
        {conLai > 0 ? <p>và {so(conLai)} SKU lỗi khác</p> : null}
      </div>
    );
  }
  return null;
}

/** Lý do lỗi của một SKU; lý do đã nhắc mã SKU thì chỉ tô mã trong câu, không in mã hai lần. */
function LyDoLoiSku({ loi }) {
  const ma = <code className="font-mono text-[11.5px] text-bo-foreground">{loi.maSku}</code>;
  const viTri = loi.lyDo && loi.maSku ? loi.lyDo.indexOf(loi.maSku) : -1;
  if (viTri < 0) {
    return (
      <>
        {ma} · {loi.lyDo}
      </>
    );
  }
  return (
    <>
      {loi.lyDo.slice(0, viTri)}
      {ma}
      {loi.lyDo.slice(viTri + loi.maSku.length)}
    </>
  );
}

function BieuTuongTieuDe({ chay, tone }) {
  const khung = "grid size-5 shrink-0 place-items-center pt-px";
  if (chay) {
    return (
      <span className={cn(khung, "text-bo-primary")}>
        <Loader2 className="size-[18px] animate-spin" />
      </span>
    );
  }
  if (tone === "ok") {
    return (
      <span className={cn(khung, "text-bo-success")}>
        <CircleCheck className="size-[18px]" />
      </span>
    );
  }
  if (tone === "dung") {
    return (
      <span className={cn(khung, "text-bo-muted")}>
        <CircleStop className="size-[18px]" />
      </span>
    );
  }
  return (
    <span className={cn(khung, tone === "loi" ? "text-bo-danger" : "text-amber-600")}>
      <CircleAlert className="size-[18px]" />
    </span>
  );
}

function BieuTuongBuoc({ tt }) {
  if (tt === "xong") {
    return (
      <span className="mt-px grid size-5 place-items-center rounded-full bg-bo-success text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (tt === "canh" || tt === "loi") {
    return (
      <span className={cn("mt-px grid size-5 place-items-center rounded-full text-xs font-bold text-white", tt === "loi" ? "bg-bo-danger" : "bg-amber-600")}>
        !
      </span>
    );
  }
  if (tt === "dang") {
    return (
      <span className="mt-px grid size-5 place-items-center text-bo-primary">
        <Loader2 className="size-[18px] animate-spin" />
      </span>
    );
  }
  if (tt === "dung") {
    return (
      <span className="mt-px grid size-5 place-items-center rounded-full bg-slate-200 text-slate-700">
        <Square className="size-2 fill-current" />
      </span>
    );
  }
  return <span className={cn("mt-px size-5 rounded-full border-[1.5px] border-slate-300", tt === "boqua" && "border-dashed")} />;
}
