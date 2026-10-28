import { useId, useState } from "react";
import { Loader2, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MoneyInput from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";
import ChipLyDo from "./ChipLyDo";
import { GIA_BAN_TOI_DA, dinhDangPhanTram, mucDoiGia, tinhLaiGop } from "./nhomGiaBan";
import { formatNumber } from "@/utils/formatters";

const vnd = (n) => `${formatNumber(n)} ₫`;
const ngayVN = (d) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Màu chữ của giá theo tình trạng: thường, chưa có giá (cam), khoảng giá (xám nhỏ), dưới giá vốn (đỏ). */
const MAU_GIA = {
  thuong: "text-bo-foreground",
  chua: "text-[13px] text-orange-700",
  khoang: "text-[13px] text-slate-600",
  duoiVon: "text-bo-danger",
};

/**
 * Chữ giá trong ô (dùng chung cho nút sửa của quản trị viên và chữ chỉ xem của quản lý kho). `hienThi.title`: chú thích
 * khi rê chuột (dưới giá vốn, có phân loại chưa có giá).
 */
export function ChuGia({ hienThi, coTitle = true }) {
  return (
    <span title={coTitle ? hienThi.title : undefined} className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {hienThi.mau === "duoiVon" ? <TriangleAlert className="size-3.5 shrink-0 text-bo-danger" aria-hidden="true" /> : null}
      <span className={MAU_GIA[hienThi.mau] ?? MAU_GIA.thuong}>{hienThi.chu}</span>
    </span>
  );
}

/**
 * Ô giá bán sửa được (chỉ quản trị viên): nút chữ, rê chuột hiện viền và bút chì; bấm mở Popover (Radix, qua portal
 * nên không bị cắt trong khung cuộn của bảng) gồm ô giá, dòng lãi gộp tính ngay khi gõ, chip lý do, lần đổi gần nhất.
 * Enter lưu, Esc đóng. `dsDong`: SKU sẽ đổi (một SKU, hoặc mọi phân loại đang hiện của sản phẩm) — SKU ngừng bỏ qua.
 */
export default function OGiaBan({ dsDong, hienThi, tieuDe, phu, ariaLabel, open, onOpenChange, lyDoMacDinh, dangLuu, onLuu }) {
  return (
    <Popover open={open} onOpenChange={(mo) => !dangLuu && onOpenChange(mo)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${ariaLabel}, giá hiện tại: ${hienThi.chu}${hienThi.title ? ` (${hienThi.title.toLocaleLowerCase("vi")})` : ""}`}
          title={hienThi.title ?? "Đổi giá bán"}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "group/gia -mr-2 inline-flex h-[30px] items-center gap-1.5 rounded-md border border-transparent px-2 text-sm font-medium",
            "hover:border-bo-border hover:bg-white focus-visible:border-bo-border focus-visible:bg-white focus-visible:outline-none",
            open && "border-bo-primary bg-white shadow-[0_0_0_3px_rgba(22,119,255,0.15)] hover:border-bo-primary",
          )}
        >
          <Pencil
            className={cn("size-[13px] shrink-0 text-bo-primary opacity-0 transition-opacity group-hover/gia:opacity-100 group-focus-visible/gia:opacity-100", open && "opacity-100")}
            aria-hidden="true"
          />
          <ChuGia hienThi={hienThi} coTitle={false} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        onClick={(event) => event.stopPropagation()}
        aria-label={tieuDe}
        className="w-[348px] max-w-[calc(100vw-24px)] rounded-[10px] border border-bo-border bg-white p-0 text-bo-foreground shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
      >
        <NoiDungGia
          dsDong={dsDong}
          tieuDe={tieuDe}
          phu={phu}
          lyDoMacDinh={lyDoMacDinh}
          dangLuu={dangLuu}
          onHuy={() => onOpenChange(false)}
          onLuu={onLuu}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Nội dung popover: chỉ dựng khi mở, nên mỗi lần mở lại bắt đầu từ giá đang lưu và lý do dùng lần trước. */
function NoiDungGia({ dsDong, tieuDe, phu, lyDoMacDinh, dangLuu, onHuy, onLuu }) {
  const id = useId();
  const muc = mucDoiGia(dsDong);
  const giaChung = muc.muc.length && muc.muc.every((d) => Number(d.giaBan) > 0 && Number(d.giaBan) === Number(muc.muc[0].giaBan))
    ? Number(muc.muc[0].giaBan)
    : "";
  const [gia, setGia] = useState(giaChung);
  const [lyDo, setLyDo] = useState(lyDoMacDinh);
  const soGia = gia === "" ? 0 : Number(gia);
  const quaLon = soGia > GIA_BAN_TOI_DA;
  const hopLe = soGia > 0 && !quaLon && Boolean(lyDo) && muc.muc.length > 0 && !muc.khongDoi(soGia);
  const luu = () => {
    if (hopLe && !dangLuu) onLuu({ ids: muc.muc.map((d) => d.id), gia: soGia, lyDo });
  };

  const vonTxt = muc.vonCao === null ? null : muc.vonThap === muc.vonCao ? vnd(muc.vonCao) : `${formatNumber(muc.vonThap)} – ${vnd(muc.vonCao)}`;
  const lai = tinhLaiGop(soGia, muc.vonCao);
  let thongTin;
  if (quaLon) thongTin = "Giá bán vượt giới hạn cho phép";
  else if (!vonTxt) thongTin = "Chưa có giá vốn";
  else if (!(soGia > 0)) thongTin = `Giá vốn ${vonTxt}`;
  else if (lai.lo) thongTin = `Thấp hơn giá vốn ${vonTxt} — bán lỗ ${vnd(-lai.lai)}/sp`;
  else thongTin = `Giá vốn ${vonTxt} · Lãi gộp ${vnd(lai.lai)} (${dinhDangPhanTram(lai.phanTram)})`;

  return (
    <div role="group" aria-labelledby={`${id}-tieu-de`}>
      <div className="px-4 pt-3.5">
        <p id={`${id}-tieu-de`} className="text-sm font-semibold">{tieuDe}</p>
        {phu ? <p className="mt-0.5 truncate text-xs text-bo-muted">{phu}</p> : null}
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Giá bán mới (₫)
          <MoneyInput
            autoFocus
            // Ô điền sẵn giá đang lưu: chọn hết để gõ là thay giá, không nối vào số cũ
            onFocus={(event) => event.target.select()}
            value={gia}
            onChange={setGia}
            disabled={dangLuu}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                luu();
              }
            }}
            className="h-[38px] px-2.5 text-[15px] font-semibold"
          />
        </label>
        <p
          className={cn(
            "rounded-md px-2.5 py-[7px] text-[12.5px]",
            lai?.lo || quaLon ? "bg-bo-danger-soft font-medium text-red-700" : "bg-bo-surface-subtle text-slate-600",
          )}
        >
          {thongTin}
        </p>
        <ChipLyDo value={lyDo} onChange={setLyDo} disabled={dangLuu} nhanId={`${id}-ly-do`} />
      </div>
      <div className="flex items-center gap-2 rounded-b-[10px] border-t border-bo-border bg-[#fafbfc] px-4 py-2.5">
        <span className="mr-auto text-[11.5px] text-bo-muted">
          {muc.lanGanNhat ? `Đổi lần gần nhất ${ngayVN(muc.lanGanNhat)}` : "Chưa đổi giá lần nào"}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={dangLuu} onClick={onHuy} className="h-8 border-bo-border bg-white px-2.5 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle">
          Hủy
        </Button>
        <Button type="button" size="sm" disabled={!hopLe || dangLuu} onClick={luu} className="h-8 gap-1.5 bg-bo-primary px-2.5 text-[13px] text-white hover:bg-bo-primary-hover">
          {dangLuu ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {dangLuu ? "Đang lưu…" : "Lưu giá"}
        </Button>
      </div>
    </div>
  );
}
