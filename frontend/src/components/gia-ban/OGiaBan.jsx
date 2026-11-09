import { useId, useState } from "react";
import { Loader2, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MoneyInput from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";
import ChipLyDo from "./ChipLyDo";
import { GIA_BAN_TOI_DA, dinhDangPhanTram, mucDoiGia, tinhLaiGop } from "./nhomGiaBan";
import { formatNumber } from "@/utils/formatters";
import { t } from "@/i18n";

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
export default function OGiaBan({ dsDong, hienThi, tieuDe, phu, ariaLabel, open, onOpenChange, lyDoMacDinh, dangLuu, onLuu, onXemLichSu }) {
  return (
    <Popover open={open} onOpenChange={(mo) => !dangLuu && onOpenChange(mo)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("{{ariaLabel}}, giá hiện tại: {{chu}}{{ghiChu}}", { ariaLabel, chu: hienThi.chu, ghiChu: hienThi.title ? ` (${hienThi.title.toLocaleLowerCase("vi")})` : "" })}
          title={hienThi.title ?? t("Đổi giá bán")}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            // Điện thoại / máy tính bảng dọc (cảm ứng): nút cao 44px, bút chì luôn hiện (không rê chuột được để biết ô sửa được)
            "group/gia -mr-2 inline-flex h-[30px] items-center gap-1.5 rounded-md border border-transparent px-2 text-sm font-medium",
            "hover:border-bo-border hover:bg-bo-surface focus-visible:border-bo-border focus-visible:bg-bo-surface focus-visible:outline-none",
            open && "border-bo-primary bg-bo-surface shadow-[0_0_0_3px_rgba(13,97,228,0.15)] hover:border-bo-primary",
          )}
        >
          <Pencil
            className={cn("size-[13px] shrink-0 text-bo-primary opacity-0 transition-opacity group-hover/gia:opacity-100 group-focus-visible/gia:opacity-100 cam-ung:max-lg:opacity-100", open && "opacity-100")}
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
        className="w-[348px] max-w-[calc(100vw-24px)] rounded-[10px] border border-bo-border bg-bo-surface p-0 text-bo-foreground shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
      >
        <NoiDungGia
          dsDong={dsDong}
          tieuDe={tieuDe}
          phu={phu}
          lyDoMacDinh={lyDoMacDinh}
          dangLuu={dangLuu}
          onHuy={() => onOpenChange(false)}
          onLuu={onLuu}
          onXemLichSu={onXemLichSu}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Nội dung popover: chỉ dựng khi mở, nên mỗi lần mở lại bắt đầu từ giá đang lưu và lý do dùng lần trước. */
function NoiDungGia({ dsDong, tieuDe, phu, lyDoMacDinh, dangLuu, onHuy, onLuu, onXemLichSu }) {
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
  if (quaLon) thongTin = t("Giá bán vượt giới hạn cho phép");
  else if (!vonTxt) thongTin = t("Chưa có giá vốn");
  else if (!(soGia > 0)) thongTin = t("Giá vốn {{vonTxt}}", { vonTxt });
  else if (lai.lo) thongTin = t("Thấp hơn giá vốn {{vonTxt}} — bán lỗ {{lo}}/sp", { vonTxt, lo: vnd(-lai.lai) });
  else thongTin = t("Giá vốn {{vonTxt}} · Lãi gộp {{lai}} ({{phanTram}})", { vonTxt, lai: vnd(lai.lai), phanTram: dinhDangPhanTram(lai.phanTram) });

  return (
    <div role="group" aria-labelledby={`${id}-tieu-de`}>
      <div className="px-4 pt-3.5">
        <p id={`${id}-tieu-de`} className="text-sm font-semibold">{tieuDe}</p>
        {phu ? <p className="mt-0.5 truncate text-xs text-bo-muted">{phu}</p> : null}
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          {t("Giá bán mới (₫)")}
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
            lai?.lo || quaLon ? "bg-bo-danger-soft font-medium text-bo-danger-strong" : "bg-bo-surface-subtle text-slate-600",
          )}
        >
          {thongTin}
        </p>
        <ChipLyDo value={lyDo} onChange={setLyDo} disabled={dangLuu} nhanId={`${id}-ly-do`} />
      </div>
      {/* Điện thoại / máy tính bảng dọc (cảm ứng): ô giá và hai nút cao 44px */}
      <div className="flex items-center gap-2 rounded-b-[10px] border-t border-bo-border bg-[#fafbfc] px-4 py-2.5">
        {/* Một SKU đã từng đổi giá: bấm dòng này mở ngăn Lịch sử giá của SKU đó */}
        {muc.lanGanNhat && onXemLichSu ? (
          <button
            type="button"
            onClick={onXemLichSu}
            disabled={dangLuu}
            className="mr-auto rounded text-left text-[11.5px] text-bo-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50"
          >
            {t("Đổi lần gần nhất {{lanGanNhat}} · Xem lịch sử", { lanGanNhat: ngayVN(muc.lanGanNhat) })}
          </button>
        ) : (
          <span className="mr-auto text-[11.5px] text-bo-muted">
            {muc.lanGanNhat ? t("Đổi lần gần nhất {{lanGanNhat}}", { lanGanNhat: ngayVN(muc.lanGanNhat) }) : t("Chưa đổi giá lần nào")}
          </span>
        )}
        <Button type="button" variant="outline" size="sm" disabled={dangLuu} onClick={onHuy} className="h-8 border-bo-border bg-bo-surface px-2.5 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle">
          {t("Hủy")}
        </Button>
        <Button type="button" size="sm" disabled={!hopLe || dangLuu} onClick={luu} className="h-8 gap-1.5 bg-bo-primary px-2.5 text-[13px] text-white hover:bg-bo-primary-hover">
          {dangLuu ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {dangLuu ? t("Đang lưu…") : t("Lưu giá")}
        </Button>
      </div>
    </div>
  );
}
