import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { docNgay } from "../tong-quan/tongQuanFormat";
import { NHOM_KY, SO_NGAY_TUY_CHON_TOI_DA, TEN_KY, khoangKy, loiTuyChon, moTaKy, soNgayCuaKy } from "../tong-quan/kyXem";
import { FOCUS, MENU } from "./boLoc";
import { t } from "@/i18n";

/* Thanh lọc Tổng quan (đặc tả bản 2, mục 1): menu chọn kho và menu chọn kỳ. Menu kỳ chia nhóm Theo ngày / Theo tháng /
   Tùy chọn; mỗi dòng ghi khoảng ngày giờ thật, không có đoạn giải thích. Tùy chọn mở lịch chọn từ ngày đến ngày. */

const MUC = cn(
  FOCUS,
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle",
);
const NHOM = "px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

function Muc({ chon, ten, phu, onClick }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={chon} onClick={onClick} className={MUC}>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", chon ? "text-bo-primary-hover" : "text-bo-foreground")}>{ten}</span>
        {phu ? <span className="block truncate text-xs tabular-nums text-bo-muted">{phu}</span> : null}
      </span>
      {chon ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
    </button>
  );
}

/** Menu kho: Tất cả kho, Kho tổng, Kho bán hàng; dòng giải thích ngắn về kho xuất của đơn. */
export function KhoMenu({ dsKho, khoId, onChange, disabled, children }) {
  const [mo, setMo] = useState(false);
  const khoTong = dsKho.filter((k) => k.laKhoTong);
  const cuaHang = dsKho.filter((k) => !k.laKhoTong);
  const chon = (id) => {
    onChange(id);
    setMo(false);
  };
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} role="menu" className={cn(MENU, "w-80")}>
        <Muc chon={khoId == null} ten={t("Tất cả kho")} phu={t("{{count}} kho, gồm hàng đang chuyển", { count: dsKho.length })} onClick={() => chon(null)} />
        {khoTong.length ? <p className={NHOM}>{t("Kho tổng")}</p> : null}
        {khoTong.map((k) => (
          <Muc key={k.id} chon={khoId === k.id} ten={k.tenKho} phu={t("Xuất đơn online và đơn sàn")} onClick={() => chon(k.id)} />
        ))}
        {cuaHang.length ? <p className={NHOM}>{t("Kho bán hàng")}</p> : null}
        {cuaHang.map((k) => (
          <Muc key={k.id} chon={khoId === k.id} ten={k.tenKho} phu={t("Bán tại quầy")} onClick={() => chon(k.id)} />
        ))}
        <p className="mx-2.5 mt-1.5 border-t border-bo-border pt-2 text-xs leading-5 text-bo-muted">
          {t("Đơn tính cho kho xuất hàng: đơn tại quầy cho cửa hàng, đơn online và đơn sàn cho kho gắn với kênh. Chọn một kho thì cả trang, kể cả Cần xử lý và Hoạt động, chỉ còn việc của kho đó.")}
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Menu kỳ. value: { ma, tuNgay, denNgay } (tuNgay / denNgay là Date của kỳ tùy chọn). kyDangXem: kỳ máy chủ trả cho lựa chọn
 * hiện tại (ghi đúng khoảng ở dòng Tùy chọn).
 */
export function KyMenu({ value, onChange, thoiDiem, ngayDauDuLieu, kyDangXem, children }) {
  const [mo, setMo] = useState(false);
  const [lich, setLich] = useState(null);
  const moMenu = (x) => {
    setMo(x);
    if (!x) setLich(null);
  };
  const chon = (ma) => {
    onChange({ ma });
    moMenu(false);
  };
  const moLich = () => {
    const goc = value.ma === "tuy_chon" && value.tuNgay ? value.tuNgay : docNgay(thoiDiem) ?? new Date();
    setLich({
      thang: new Date(goc.getFullYear(), goc.getMonth(), 1),
      tu: value.ma === "tuy_chon" ? value.tuNgay : null,
      den: value.ma === "tuy_chon" ? value.denNgay : null,
    });
  };
  return (
    <Popover open={mo} onOpenChange={moMenu}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} role="menu" className={cn(MENU, lich ? "w-[300px]" : "w-72")}>
        {lich ? (
          <Lich
            lich={lich}
            setLich={setLich}
            thoiDiem={thoiDiem}
            ngayDauDuLieu={ngayDauDuLieu}
            onBack={() => setLich(null)}
            onApply={(tu, den) => {
              onChange({ ma: "tuy_chon", tuNgay: tu, denNgay: den });
              moMenu(false);
            }}
          />
        ) : (
          <>
            {NHOM_KY.map((nhom, i) => (
              <div key={nhom.ten} className={cn(i > 0 && "mt-1 border-t border-bo-border pt-1")}>
                <p className={NHOM}>{nhom.ten}</p>
                {nhom.ds.map((ma) => (
                  <Muc key={ma} chon={value.ma === ma} ten={TEN_KY[ma]} phu={moTaKy(khoangKy(ma, thoiDiem))[0]} onClick={() => chon(ma)} />
                ))}
              </div>
            ))}
            <div className="mt-1 border-t border-bo-border pt-1">
              <Muc
                chon={value.ma === "tuy_chon"}
                ten={t("Tùy chọn…")}
                phu={value.ma === "tuy_chon" && kyDangXem ? moTaKy(kyDangXem)[0] : t("Chọn từ ngày đến ngày, tối đa {{soNgay}} ngày", { soNgay: SO_NGAY_TUY_CHON_TOI_DA })}
                onClick={moLich}
              />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const hai = (n) => String(n).padStart(2, "0");
const dm = (d) => `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
const cungNgay = (a, b) => a && b && a.toDateString() === b.toDateString();

/** Lịch chọn khoảng: bấm ngày đầu rồi ngày cuối; không chọn được ngày sau hôm nay và trước ngày có dữ liệu. */
function Lich({ lich, setLich, thoiDiem, ngayDauDuLieu, onBack, onApply }) {
  const bayGio = docNgay(thoiDiem) ?? new Date();
  const homNay = new Date(bayGio.getFullYear(), bayGio.getMonth(), bayGio.getDate());
  const dau = docNgay(ngayDauDuLieu);
  const y = lich.thang.getFullYear();
  const m = lich.thang.getMonth();
  const soNgayThang = new Date(y, m + 1, 0).getDate();
  const lech = (new Date(y, m, 1).getDay() + 6) % 7;
  const { tu, den } = lich;
  const loi = tu && den ? loiTuyChon(tu, den, homNay, dau) : null;
  const soNgay = tu && den ? soNgayCuaKy({ tu, den: new Date(den.getFullYear(), den.getMonth(), den.getDate() + 1) }) : 0;
  const thangTruocKhoa = dau && new Date(y, m, 1) <= new Date(dau.getFullYear(), dau.getMonth(), 1);
  const thangSauKhoa = new Date(y, m + 1, 1) > homNay;
  const diThang = (n) => setLich({ ...lich, thang: new Date(y, m + n, 1) });
  const bam = (d) => {
    if (!tu || den) setLich({ ...lich, tu: d, den: null });
    else if (d < tu) setLich({ ...lich, tu: d, den: tu });
    else setLich({ ...lich, den: d });
  };
  const nut = cn(FOCUS, "grid size-8 cursor-pointer place-items-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent");
  return (
    <div className="p-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <button type="button" className={nut} onClick={() => diThang(-1)} disabled={thangTruocKhoa} aria-label={t("Tháng trước")}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <b className="text-sm font-semibold text-bo-foreground">{t("Tháng {{thang}}/{{nam}}", { thang: m + 1, nam: y })}</b>
        <button type="button" className={nut} onClick={() => diThang(1)} disabled={thangSauKhoa} aria-label={t("Tháng sau")}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {THU.map((x) => (
          <span key={x} className="py-1 text-[11px] font-medium text-bo-muted">{t(x, { context: "thu" })}</span>
        ))}
        {Array.from({ length: lech }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: soNgayThang }, (_, i) => {
          const d = new Date(y, m, i + 1);
          const khoa = d > homNay || (dau && d < new Date(dau.getFullYear(), dau.getMonth(), dau.getDate()));
          const laDau = cungNgay(d, tu);
          const laCuoi = cungNgay(d, den);
          const giua = tu && den && d > tu && d < den;
          return (
            <button
              key={i}
              type="button"
              disabled={khoa}
              onClick={() => bam(d)}
              aria-pressed={laDau || laCuoi || undefined}
              className={cn(
                FOCUS,
                "h-8 cursor-pointer text-[13px] tabular-nums text-bo-foreground disabled:cursor-default disabled:text-slate-300",
                giua ? "bg-bo-primary-soft" : "rounded-md hover:bg-bo-surface-subtle",
                (laDau || laCuoi) && "rounded-md bg-bo-primary font-semibold text-white hover:bg-bo-primary",
                cungNgay(d, homNay) && !(laDau || laCuoi) && "font-semibold text-bo-primary",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-xs tabular-nums text-bo-muted" aria-live="polite">
        {!tu ? (
          t("Chọn ngày bắt đầu")
        ) : !den ? (
          t("Từ {{ngay}}, chọn ngày kết thúc", { ngay: dm(tu) })
        ) : loi ? (
          <span className="text-[#b42318]">{loi}</span>
        ) : cungNgay(den, homNay) ? (
          t("{{tu}} – {{den}} · {{soNgay}} ngày, hôm nay tính đến giờ số liệu", { tu: dm(tu), den: dm(den), soNgay })
        ) : (
          t("{{tu}} – {{den}} · {{soNgay}} ngày", { tu: dm(tu), den: dm(den), soNgay })
        )}
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onBack} className={cn(FOCUS, "h-8 cursor-pointer rounded-md border border-bo-border px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle")}>
          {t("Quay lại")}
        </button>
        <button
          type="button"
          disabled={!den || Boolean(loi)}
          onClick={() => onApply(tu, den)}
          className={cn(FOCUS, "h-8 cursor-pointer rounded-md bg-bo-primary px-3 text-[13px] font-medium text-white hover:bg-bo-primary-hover disabled:cursor-default disabled:opacity-50")}
        >
          {t("Áp dụng")}
        </button>
      </div>
    </div>
  );
}
