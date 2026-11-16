import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, LayoutGrid, Lock, MapPin, PackageSearch, RefreshCw, TriangleAlert, Wrench, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import { t, tDuLieu } from "@/i18n";
import ChuGiaiMucDay from "@/components/mat-bang/ChuGiaiMucDay";
import { mucDay, toneMucDay } from "@/constants/nhapKho";
import { viTriKe } from "./nhanKe";
import { KE_NGUON_KHONG_CHON, conTrongCua, keCanXuLy, khopLocNguon, layDuocCua, loaiKeDich, loaiKeNguon, tomTatKhu, xepSoDoKe } from "./chuyenKe";

/*
 * Sơ đồ kệ của màn Chuyển kệ nội bộ: khu → dãy → lưới hàng × tầng (tầng cao ở trên), cùng dáng ô với sơ đồ ở trang Vị
 * trí kho. Bước Kệ nguồn: thanh mức chứa cùng màu và chú giải với Vị trí kho, kệ không lấy được hàng thì mờ; bước Kệ
 * đích tô theo "còn bao nhiêu chỗ". Bấm ô = quét mã kệ
 * đó; ô giữ tiêu điểm ở ô quét (máy quét bắn tiếp được ngay). Cả sơ đồ là một điểm dừng Tab, phím mũi tên đi giữa các ô.
 */

const O =
  "relative flex w-full min-w-0 flex-col justify-between gap-1 rounded-md border px-2.5 py-2 text-left text-[11px] leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40";
const NHAN = "text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const soTang = (x) => (Number.isFinite(Number(x)) ? Number(x) : x);

/** Màu mức đầy như sơ đồ ở trang Vị trí kho (ThanhMuc): dưới 70% xanh, từ 70% cam, đầy / vượt đỏ; kệ bảo trì xám. */
function mauMucDay(ke) {
  if (ke.khoa === "BAO_TRI" || ke.trangThai === "BAO_TRI") return "bg-slate-400";
  const tone = toneMucDay(mucDay(ke.dangChua, ke.sucChua));
  return tone === "bad" ? "bg-bo-danger" : tone === "warn" ? "bg-amber-600" : "bg-bo-primary";
}

/** Thanh mức chứa ở đáy ô: phần đang chứa (`mau`) và phần sắp cất thêm (xanh). `cao`: lớp chiều cao thanh. */
function ThanhO({ ke, them = 0, mau = "bg-slate-400", cao = "h-1.5", className }) {
  if (!ke.sucChua)
    return (
      <span
        className={cn("block rounded-full bg-[repeating-linear-gradient(90deg,#cbd5e1_0_3px,transparent_3px_6px)]", cao, className)}
        aria-hidden="true"
      />
    );
  const pDang = Math.min(100, ((ke.dangChua ?? 0) / ke.sucChua) * 100);
  const pThem = Math.max(0, Math.min(100, (((ke.dangChua ?? 0) + them) / ke.sucChua) * 100) - pDang);
  return (
    <span className={cn("flex overflow-hidden rounded-full bg-[#e9eef4]", cao, className)} aria-hidden="true">
      <span className={mau} style={{ width: `${pDang}%` }} />
      {pThem > 0 ? <span className="bg-bo-primary" style={{ width: `${pThem}%` }} /> : null}
    </span>
  );
}

// Giữ tiêu điểm ở ô quét khi bấm chuột vào sơ đồ (máy quét bắn tiếp không phải bấm lại ô quét)
const giuOQuet = (e) => e.preventDefault();

/** Nhãn khu của dữ liệu ("" = kệ chưa gán khu). */
const tenKhu = (khu) => (khu ? tDuLieu(khu) : t("Chưa có khu"));

// Từ bao nhiêu khu thì đổi nút liền một hàng sang ô thả xuống có tìm (nhiều khu thì hàng nút dài, phải cuộn ngang)
const NGUONG_THA_XUONG = 4;
const boDau = (x) =>
  String(x ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
const MA_TAT_CA = "*tat-ca";

/**
 * Chọn khu để lọc sơ đồ. `dsKhu`: kết quả `tomTatKhu`. Một khu: ẩn. 2–3 khu: nút liền một hàng (bấm một lần). Từ
 * {@link NGUONG_THA_XUONG} khu: ô thả xuống có tìm (không dấu), mỗi dòng ghi số kệ và số kệ cần xử lý (`hienViec`).
 */
function ChonKhu({ dsKhu, khu, onKhu, hienViec = false, onVeOQuet }) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  if (dsKhu.length < 2) return null;
  const tongKe = dsKhu.reduce((s, x) => s + x.soKe, 0);
  const tongViec = dsKhu.reduce((s, x) => s + x.soViec, 0);

  if (dsKhu.length < NGUONG_THA_XUONG) {
    return (
      <div className="flex max-w-full overflow-x-auto rounded-md border border-bo-border bg-white p-0.5 text-[12px]" role="group" aria-label={t("Khu vực")}>
        {[null, ...dsKhu.map((x) => x.khu)].map((k) => {
          const chon = k === khu;
          return (
            <button
              key={k ?? MA_TAT_CA}
              type="button"
              aria-pressed={chon}
              onMouseDown={giuOQuet}
              onClick={() => onKhu(k)}
              className={cn(
                "h-7 shrink-0 whitespace-nowrap rounded px-2.5",
                chon ? "bg-bo-primary-soft font-medium text-bo-primary-strong" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              {k === null ? t("Tất cả khu") : tenKhu(k)}
            </button>
          );
        })}
      </div>
    );
  }

  const doiMo = (m) => {
    setMo(m);
    setTim("");
  };
  const chon = (k) => {
    doiMo(false);
    onKhu(k);
  };
  const tu = boDau(tim);
  const dsKhop = dsKhu.filter((x) => !tu || boDau(tenKhu(x.khu)).includes(tu));
  const hienTatCa = !tu || boDau(t("Tất cả khu")).includes(tu);
  const chu = khu === null ? t("Tất cả khu") : tenKhu(khu);
  const dong = (ma, ten, soKe, soViec, dangChon, onSelect) => (
    <CommandItem
      key={ma}
      value={ma}
      onSelect={onSelect}
      className="items-center gap-2 py-2 data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
    >
      <MapPin className={cn("size-4 shrink-0", dangChon ? "text-bo-primary" : "text-bo-muted")} aria-hidden="true" />
      <span className="grid min-w-0 flex-1">
        <span className={cn("truncate text-sm", dangChon ? "font-medium text-bo-foreground" : "text-slate-700")}>{ten}</span>
        <span className="text-xs text-bo-muted">{t("{{so}} kệ", { so: soVN(soKe), count: soKe })}</span>
      </span>
      {hienViec && soViec ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2 text-xs font-medium leading-5 text-amber-700">
          {t("{{so}} cần xử lý", { so: soVN(soViec), count: soViec })}
        </span>
      ) : null}
      {dangChon ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : null}
    </CommandItem>
  );
  return (
    <Popover open={mo} onOpenChange={doiMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={mo}
          aria-label={t("Khu vực: {{chu}}. Bấm để đổi", { chu })}
          onMouseDown={giuOQuet}
          className="h-8 min-w-0 max-w-[260px] justify-between gap-2 border-bo-border bg-white px-2.5 text-[13px] font-normal text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className={cn("size-3.5 shrink-0", khu === null ? "text-bo-muted" : "text-bo-primary")} aria-hidden="true" />
            <span className="truncate font-medium">{chu}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-32px))] border-bo-border bg-bo-surface p-0" onCloseAutoFocus={(e) => {
          // Đóng danh sách: tiêu điểm về ô quét (máy quét bắn tiếp được), không về nút chọn khu
          e.preventDefault();
          onVeOQuet?.();
        }}>
        <Command label={t("Tìm khu")} shouldFilter={false} className="rounded-lg [&_[data-slot=command-input-wrapper]]:border-bo-border">
          <CommandInput value={tim} onValueChange={setTim} placeholder={t("Tìm khu…")} className="text-bo-foreground" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-5 text-center text-sm text-bo-muted">{t("Không có khu nào khớp “{{tuKhoa}}”", { tuKhoa: tim.trim() })}</CommandEmpty>
            <CommandGroup>
              {hienTatCa ? dong(MA_TAT_CA, t("Tất cả khu"), tongKe, tongViec, khu === null, () => chon(null)) : null}
              {dsKhop.map((x) => dong(`khu:${x.khu}`, tenKhu(x.khu), x.soKe, x.soViec, khu === x.khu, () => chon(x.khu)))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CapNhatLuc({ luc, dangTai, onTaiLai }) {
  return (
    <span className="flex items-center gap-1 text-[12px] text-bo-muted">
      {luc
        ? t("Cập nhật {{gio}}", {
            gio: new Date(luc).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        : null}
      <button
        type="button"
        onMouseDown={giuOQuet}
        onClick={onTaiLai}
        disabled={dangTai}
        title={t("Tải lại sơ đồ")}
        aria-label={t("Tải lại sơ đồ")}
        className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-60"
      >
        <RefreshCw className={cn("size-4", dangTai && "animate-spin")} aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Lưới sơ đồ. `ds`: kệ dạng ds-ke; `veO(ke, nav)`: vẽ một ô, rải `nav` (tabIndex, onFocus, data-o) lên nút.
 * Roving tabindex: một điểm dừng Tab cho cả sơ đồ, mũi tên đi trong dãy (nhóm "kệ khác" đi trái / phải).
 * Khung dãy rộng vừa số hàng (ô 96px–`rongO`), các dãy xếp liền nhau; khung chỉ có nền nhạt, không viền.
 */
const KHUNG_DAY = "min-w-0 max-w-full rounded-lg bg-bo-surface-subtle p-3";
export function BanDoKe({ ds, veO, nhan, rongO = 116 }) {
  const soDo = useMemo(() => xepSoDoKe(ds), [ds]);
  const [dangDung, setDangDung] = useState(null);
  const gocRef = useRef(null);
  const dau = soDo[0]?.dsDay[0] ? [...soDo[0].dsDay[0].o.values()][0]?.id : soDo[0]?.khac[0]?.id;
  const diem = ds.some((k) => k.id === dangDung) ? dangDung : dau;
  const nav = (ke, viTri) => ({
    tabIndex: ke.id === diem ? 0 : -1,
    onFocus: () => setDangDung(ke.id),
    "data-o": viTri,
  });

  const diChuyen = (e) => {
    const huong = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[e.key];
    const o = e.target.closest?.("[data-o]");
    if (!huong || !o) return;
    const [nhom, r, c] = o.dataset.o.split("~");
    const toi = gocRef.current?.querySelector(`[data-o="${CSS.escape(`${nhom}~${Number(r) + huong[0]}~${Number(c) + huong[1]}`)}"]`);
    if (toi) {
      e.preventDefault();
      toi.focus();
    }
  };

  return (
    <div ref={gocRef} className="grid gap-5" role="group" aria-label={nhan} onKeyDown={diChuyen}>
      {soDo.map((khu, ik) => (
        <div key={khu.khu || "*"} className="grid gap-2">
          <p className={cn(NHAN, "flex items-center gap-1.5")}>
            <MapPin className="size-3.5" aria-hidden="true" />
            {tenKhu(khu.khu)}
            <span className="font-normal normal-case tracking-normal">· {t("{{so}} kệ", { so: soVN(khu.soKe), count: khu.soKe })}</span>
          </p>
          {/* min-w-0: dãy rộng hơn màn (điện thoại) co lại và vuốt ngang trong khung dãy, không đẩy cả thẻ rộng ra */}
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            {khu.dsDay.map((day) => (
              <div key={day.day} className={KHUNG_DAY}>
                <p className="mb-2 text-[13px] font-semibold text-bo-heading">{t("Dãy {{so}}", { so: day.day })}</p>
                {/* Ô tối thiểu 96px để mã kệ không bị cắt; dãy rộng hơn màn (điện thoại) thì vuốt ngang trong khung này */}
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `44px repeat(${day.hang.length}, minmax(96px, ${rongO}px))`,
                    }}
                  >
                    <span />
                    {day.hang.map((h) => (
                      <span key={h} className="text-center text-[11px] font-semibold text-bo-muted">
                        {t("Hàng {{so}}", { so: soTang(h) })}
                      </span>
                    ))}
                    {day.tang.map((tg, r) => (
                      <div key={tg} className="contents">
                        <span className="grid place-items-center text-[11px] font-semibold text-bo-muted">{t("Tầng {{so}}", { so: soTang(tg) })}</span>
                        {day.hang.map((h, c) => {
                          const ke = day.o.get(`${h}|${tg}`);
                          return ke ? (
                            <div key={h} className="min-w-0">
                              {veO(ke, nav(ke, `${ik}:${day.day}~${r}~${c}`))}
                            </div>
                          ) : (
                            <span key={h} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {khu.khac.length ? (
            <div className={cn(KHUNG_DAY, "justify-self-start")}>
              <p className="mb-2 text-[13px] font-semibold text-bo-heading">{t("Kệ đặt tên riêng")}</p>
              <div className="flex flex-wrap gap-1.5">
                {khu.khac.map((ke, i) => (
                  <div key={ke.id} className="min-w-0 shrink-0" style={{ width: rongO }}>
                    {veO(ke, nav(ke, `${ik}:#~0~${i}`))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Ô kệ ở bước Kệ nguồn (2 dòng): mã kệ + số đậm = số lấy được (đang chứa khi máy chủ chưa trả phần giữ cho phiếu nhặt),
 * dưới là thanh mức chứa. Chữ ở dòng dưới chỉ khi có chuyện (giữ cho phiếu nhặt, vượt sức chứa, bảo trì, kiểm kê); sức
 * chứa xem ở chú thích khi rê chuột. Kệ trống vẽ nhạt (nét đứt, không số 0, không thanh) để mắt dừng ở kệ có hàng.
 */
function ONguon({ ke, mo, doi, soHang, ban, onChon, nav }) {
  const loai = loaiKeNguon(ke);
  const tat = KE_NGUON_KHONG_CHON.has(loai);
  const giu = ke.choNhat ?? 0;
  const ghi = {
    khoa: <span className="truncate text-slate-500">{t("Đang kiểm kê")}</span>,
    "giu-het": (
      <span className="truncate text-bo-warning" title={t("Toàn bộ đang giữ cho phiếu nhặt")}>
        {t("Đã giữ hết")}
      </span>
    ),
    "bao-tri": <span className="min-w-0 truncate text-slate-600">{giu ? t("Bảo trì · giữ {{so}}", { so: soVN(giu) }) : t("Bảo trì")}</span>,
    vuot: (
      <span className="truncate font-medium tabular-nums text-bo-danger">
        {t("{{dang}}/{{suc}} · dư {{du}}", {
          dang: soVN(ke.dangChua),
          suc: soVN(ke.sucChua),
          du: soVN(ke.dangChua - ke.sucChua),
        })}
      </span>
    ),
    "co-hang": giu ? <span className="shrink-0 tabular-nums text-bo-warning">{t("giữ {{so}}", { so: soVN(giu) })}</span> : null,
  }[loai];
  const vien = {
    khoa: "cursor-not-allowed border-slate-200 bg-slate-100",
    trong: "cursor-not-allowed flex-row items-center border-dashed border-slate-200 bg-transparent",
    "giu-het": "cursor-not-allowed border-bo-border bg-white",
    "bao-tri": "border-dashed border-slate-400 bg-bo-surface-subtle hover:bg-slate-100",
    vuot: "border-red-300 bg-white hover:bg-red-50/50",
    "co-hang": "border-bo-border bg-white hover:border-slate-400 hover:bg-slate-50",
  }[loai];
  const nhanDoi = soHang != null ? (
    <span className="shrink-0 rounded bg-bo-primary-soft px-1 font-semibold tabular-nums text-bo-primary-strong">{t("có {{so}}", { so: soVN(soHang) })}</span>
  ) : doi ? (
    <span
      className={cn("shrink-0 rounded px-1 font-semibold tabular-nums", doi > 0 ? "bg-bo-primary-soft text-bo-primary-strong" : "bg-slate-100 text-slate-600")}
    >
      {doi > 0 ? `+${soVN(doi)}` : `−${soVN(-doi)}`}
    </span>
  ) : null;
  const chuThich = [ke.maViTri, viTriKe(ke), ke.sucChua ? t("sức chứa {{so}}", { so: soVN(ke.sucChua) }) : t("Không giới hạn")];
  return (
    <button
      type="button"
      {...nav}
      aria-disabled={tat || ban || undefined}
      title={chuThich.filter(Boolean).join(" · ")}
      onMouseDown={giuOQuet}
      onClick={() => (tat || ban ? null : onChon(ke))}
      className={cn(O, "h-12 gap-0", vien, doi && "ring-2 ring-amber-300", mo && "opacity-25")}
    >
      {loai === "trong" ? (
        <>
          <span className="truncate font-mono text-xs font-medium text-slate-400">{ke.maViTri}</span>
          {nhanDoi ?? <span className="shrink-0 text-slate-400">{t("Trống")}</span>}
        </>
      ) : (
        <>
          <span className="flex items-baseline justify-between gap-1.5">
            <span className={cn("truncate font-mono text-xs font-semibold", tat ? "text-slate-500" : "text-bo-heading")}>{ke.maViTri}</span>
            {loai === "khoa" ? (
              <Lock className="size-3.5 shrink-0 text-slate-500" aria-label={t("Đang kiểm kê")} />
            ) : (
              <b className={cn("text-[13px] font-semibold tabular-nums", tat ? "text-slate-400" : "text-bo-heading")}>{soVN(layDuocCua(ke))}</b>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {ghi}
            {loai === "co-hang" || loai === "bao-tri" ? <ThanhO ke={ke} mau={mauMucDay(ke)} cao="h-1" className="min-w-6 flex-1" /> : null}
            {nhanDoi}
          </span>
        </>
      )}
    </button>
  );
}

const LOC = [
  ["tat-ca", t("Tất cả")],
  ["co-hang", t("Lấy được")],
  ["bao-tri", t("Bảo trì còn hàng")],
  ["vuot", t("Vượt sức chứa")],
];

/** Tên hàng vừa quét: tên sản phẩm · màu · cỡ (dữ liệu, dịch nếu có). */
const tenHang = (h) => [h.tenSanPham, h.mau, h.kichCo].filter(Boolean).map((x) => tDuLieu(x)).join(" · ") || h.maSku || h.maLo;
const SO_KE_HANG_HIEN = 8;

/** Khối kết quả quét mã hàng ở màn mở đầu: hàng nào, ở mấy kệ, bấm kệ để lấy hàng từ đó. */
function KhoiHangTim({ hangTim, ban, onChonKe, onBo }) {
  const lay = hangTim.ke.reduce((s, k) => s + k.layDuoc, 0);
  const hien = hangTim.ke.slice(0, SO_KE_HANG_HIEN);
  return (
    <div className="grid gap-2 border-b border-bo-border bg-bo-primary-soft/40 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <PackageSearch className="size-4 shrink-0 text-bo-primary" aria-hidden="true" />
        <b className="font-semibold text-bo-heading">{tenHang(hangTim)}</b>
        <span className="font-mono text-[12px] text-bo-muted">{hangTim.maLo ? t("Lô {{ma}}", { ma: hangTim.maLo }) : hangTim.maSku}</span>
        <span className="mr-auto text-bo-muted">
          {t("đang ở {{so}} kệ · lấy được {{lay}}", { so: soVN(hangTim.ke.length), lay: soVN(lay), count: hangTim.ke.length })}
        </span>
        <button
          type="button"
          onMouseDown={giuOQuet}
          onClick={onBo}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-bo-primary-strong hover:bg-white/70"
        >
          <X className="size-3.5" aria-hidden="true" />
          {t("Bỏ tìm")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {hien.map((k) => {
          const tat = k.khoa === "KIEM_KE" || k.layDuoc <= 0;
          return (
            <button
              key={k.id}
              type="button"
              disabled={ban || tat}
              onMouseDown={giuOQuet}
              onClick={() => onChonKe(k)}
              title={k.khoa === "KIEM_KE" ? t("Đang kiểm kê") : undefined}
              className="flex items-center gap-2 rounded-md border border-bo-border bg-white px-2.5 py-1.5 hover:border-bo-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="font-mono text-[13px] font-semibold text-bo-heading">{k.maViTri}</span>
              <span className="rounded bg-bo-primary-soft px-1 text-[12px] font-semibold tabular-nums text-bo-primary-strong">{soVN(k.layDuoc)}</span>
              {k.soLuong > k.layDuoc ? <span className="text-[11px] text-bo-muted">{t("giữ {{so}}", { so: soVN(k.soLuong - k.layDuoc) })}</span> : null}
            </button>
          );
        })}
        {hangTim.ke.length > hien.length ? (
          <span className="self-center text-[12px] text-bo-muted">{t("+{{so}} kệ khác trên sơ đồ", { so: soVN(hangTim.ke.length - hien.length) })}</span>
        ) : null}
      </div>
    </div>
  );
}

// Khu đã chọn ở màn mở đầu, nhớ theo kho trên máy này (null = tất cả khu)
const khoaKhu = (khoId) => `fcentric.chuyen-ke.khu.${khoId}`;
function docKhuDaChon(khoId) {
  try {
    const v = localStorage.getItem(khoaKhu(khoId));
    return v == null ? null : JSON.parse(v);
  } catch {
    return null;
  }
}
function ghiKhuDaChon(khoId, khu) {
  try {
    if (khu === null) localStorage.removeItem(khoaKhu(khoId));
    else localStorage.setItem(khoaKhu(khoId), JSON.stringify(khu));
  } catch {
    // Trình duyệt chặn lưu: lần sau về Tất cả khu
  }
}

/**
 * Thẻ "Sơ đồ kệ" ở màn mở đầu (chưa có kệ nguồn): mục Cần xử lý, lọc nhanh, sơ đồ tô theo số lấy được. `q`: chữ đang gõ ở
 * ô quét (làm rõ kệ khớp); `doi`: `{ [mã kệ]: ±số }` của lượt vừa chuyển để đánh dấu kệ vừa đổi. Nơi dùng gắn
 * `key` theo kho để đổi kho thì khu / bộ lọc về mặc định.
 */
export function TheSoDoNguon({ khoId, q, ds, dangTai, lanDau, loi, capNhatLuc, onTaiLai, doi, ban, coViTriKho, onChonKe, onXuLy, onVeOQuet, hangTim, onBoHangTim }) {
  const navigate = useNavigate();
  const [khu, setKhuState] = useState(() => docKhuDaChon(khoId));
  const [loc, setLoc] = useState("tat-ca");
  const setKhu = (k) => {
    setKhuState(k);
    ghiKhuDaChon(khoId, k);
  };
  const dsKhu = useMemo(() => tomTatKhu(ds), [ds]);
  const nhieuKhu = dsKhu.length > 1;
  const khuHieuLuc = khu !== null && dsKhu.some((x) => x.khu === khu) ? khu : null;
  const dsHien = useMemo(() => (khuHieuLuc === null ? ds : ds.filter((k) => (k.khuVuc || "") === khuHieuLuc)), [ds, khuHieuLuc]);
  // Cần xử lý tính trên toàn kho: lọc theo khu không được làm khuất việc ở khu khác
  const canXuLy = useMemo(() => keCanXuLy(ds), [ds]);
  const tim = String(q ?? "")
    .trim()
    .toLowerCase();
  const khop = (k) => !tim || String(k.maViTri).toLowerCase().includes(tim);
  const soKhop = tim ? dsHien.filter(khop).length : 0;
  const soKhopKhuKhac = tim && khuHieuLuc !== null ? ds.filter((k) => (k.khuVuc || "") !== khuHieuLuc && khop(k)).length : 0;
  const coChoNhat = ds.some((k) => k.choNhat != null);
  // Vừa quét mã hàng: chỉ làm rõ kệ đang chứa hàng đó, ghi số lấy được của hàng đó trên kệ
  const keHang = useMemo(() => (hangTim ? new Map(hangTim.ke.map((k) => [k.id, k])) : null), [hangTim]);

  let than;
  if (lanDau) {
    than = (
      <div
        className="grid gap-2 p-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
        aria-busy="true"
        aria-label={t("Đang tải sơ đồ kệ")}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="h-[60px] animate-pulse rounded-md bg-slate-100" />
        ))}
      </div>
    );
  } else if (loi) {
    than = (
      <ErrorState
        title={t("Chưa tải được sơ đồ kệ")}
        description={getApiErrorMessage(loi, t("Kiểm tra kết nối rồi thử lại. Ô quét vẫn dùng được."))}
        error={loi}
        onRetry={onTaiLai}
        className="min-h-48"
      />
    );
  } else if (!ds.length) {
    than = (
      <EmptyState
        icon={LayoutGrid}
        title={t("Kho này chưa có kệ nào")}
        description={t("Tạo kệ ở Vị trí kho rồi quay lại để chuyển hàng giữa các kệ.")}
        className="min-h-48"
        action={
          coViTriKho ? (
            <Button variant="outline" onClick={() => navigate("/warehouse/locations")} className="h-9 gap-2 border-bo-border bg-white">
              <MapPin className="size-4" aria-hidden="true" />
              {t("Mở Vị trí kho")}
            </Button>
          ) : null
        }
      />
    );
  } else {
    than = (
      <>
        {hangTim ? <KhoiHangTim hangTim={hangTim} ban={ban} onChonKe={onChonKe} onBo={onBoHangTim} /> : null}
        {canXuLy.length ? (
          <div className="border-b border-bo-border">
            <p className={cn(NHAN, "px-4 pt-2.5")}>{t("Cần xử lý")}</p>
            <ul className="divide-y divide-bo-border/70">
              {canXuLy.map((x) => (
                <li key={x.ke.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md",
                      x.loai === "bao-tri" ? "bg-amber-100 text-bo-warning" : "bg-red-100 text-bo-danger",
                    )}
                  >
                    {x.loai === "bao-tri" ? <Wrench className="size-3.5" aria-hidden="true" /> : <TriangleAlert className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="mr-auto min-w-0 text-[13px] text-bo-foreground">
                    {x.loai === "bao-tri"
                      ? coChoNhat
                        ? t("{{ma}} đang bảo trì, còn {{so}} sản phẩm lấy được", { ma: x.ke.maViTri, so: soVN(x.so), count: x.so })
                        : t("{{ma}} đang bảo trì, còn {{so}} sản phẩm trên kệ", { ma: x.ke.maViTri, so: soVN(x.so), count: x.so })
                      : t("{{ma}} vượt sức chứa {{dang}}/{{suc}}, cần bớt {{so}}", {
                          ma: x.ke.maViTri,
                          dang: soVN(x.ke.dangChua),
                          suc: soVN(x.ke.sucChua),
                          so: soVN(x.so),
                        })}
                    {nhieuKhu ? <span className="text-bo-muted"> · {tenKhu(x.ke.khuVuc || "")}</span> : null}
                  </span>
                  <Button
                    variant="outline"
                    disabled={ban}
                    onMouseDown={giuOQuet}
                    onClick={() => onXuLy(x)}
                    className="h-8 gap-1.5 border-bo-border bg-white px-2.5 text-[13px] text-bo-foreground hover:bg-slate-50"
                  >
                    {x.loai === "bao-tri" ? t("Chuyển hết") : t("Chuyển bớt {{so}}", { so: soVN(x.so) })}
                    <ArrowRight className="size-3.5 text-bo-muted" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Lọc kệ")}>
            {LOC.map(([ma, ten]) => {
              const n = dsHien.filter((k) => khopLocNguon(k, ma)).length;
              const chon = loc === ma;
              // Chip đang chọn vẫn hiện khi về 0 (vd. vừa chuyển hết phần dư) để người dùng bỏ lọc được
              if (!n && ma !== "tat-ca" && !chon) return null;
              return (
                <button
                  key={ma}
                  type="button"
                  aria-pressed={chon}
                  onMouseDown={giuOQuet}
                  onClick={() => setLoc(chon ? "tat-ca" : ma)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px]",
                    chon
                      ? "border-bo-primary bg-bo-primary-soft font-medium text-bo-primary-strong"
                      : "border-bo-border bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {ten}
                  <span className={cn("tabular-nums", !chon && "text-bo-muted")}>{soVN(n)}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[12px] text-bo-muted">
            {tim
              ? t('{{so}} kệ khớp "{{ma}}"', {
                  so: soVN(soKhop),
                  ma: String(q).trim(),
                  count: soKhop,
                })
              : coChoNhat
                ? t("Số trên ô = số lấy được (đã trừ hàng giữ cho phiếu nhặt)")
                : t("Số trên ô = số đang chứa")}
          </span>
          {soKhopKhuKhac ? (
            <button type="button" onMouseDown={giuOQuet} onClick={() => setKhu(null)} className="text-[12px] font-medium text-bo-primary-strong hover:underline">
              {t("{{so}} kệ khớp ở khu khác · Xem tất cả khu", { so: soVN(soKhopKhuKhac), count: soKhopKhuKhac })}
            </button>
          ) : null}
          <ChuGiaiMucDay trongNetDut className="sm:ml-auto" />
        </div>
        <div className="p-4">
          <BanDoKe
            ds={dsHien}
            nhan={t("Sơ đồ kệ")}
            veO={(ke, nav) => (
              <ONguon
                ke={ke}
                nav={nav}
                ban={ban}
                doi={doi?.[ke.maViTri]}
                soHang={keHang?.get(ke.id)?.layDuoc}
                mo={!khopLocNguon(ke, loc) || !khop(ke) || Boolean(keHang && !keHang.has(ke.id))}
                onChon={onChonKe}
              />
            )}
          />
        </div>
      </>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-bo-border bg-bo-surface shadow-sm" aria-labelledby="ck-so-do">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-bo-border px-4 py-2.5">
        <h2 id="ck-so-do" className="text-sm font-semibold text-bo-heading">
          {t("Sơ đồ kệ")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {ds.length ? <ChonKhu dsKhu={dsKhu} khu={khuHieuLuc} onKhu={setKhu} hienViec onVeOQuet={onVeOQuet} /> : null}
          <CapNhatLuc luc={capNhatLuc} dangTai={dangTai} onTaiLai={onTaiLai} />
        </div>
      </div>
      {than}
    </section>
  );
}

/** Ô kệ ở bước Kệ đích: số đậm = chỗ còn trống; kệ đã chọn ghi số cất thêm và thứ tự cất. */
function ODich({ ke, loai, goiY, daChon, ban, onChon, nav }) {
  const tat = loai === "khoa" || loai === "khong-nhan" || loai === "nguon";
  const con = ke.sucChua ? conTrongCua(ke) : null;
  const chuSuc = ke.sucChua ? `${soVN(ke.dangChua)}/${soVN(ke.sucChua)}` : t("Không giới hạn");
  let vien;
  let so;
  let phu;
  if (daChon) {
    vien = "border-bo-primary bg-white ring-2 ring-bo-primary/25";
    so = <b className="text-[13px] font-semibold tabular-nums text-bo-primary-strong">+{soVN(daChon.nhan)}</b>;
    phu = (
      <span className="truncate tabular-nums text-bo-muted">
        {ke.sucChua
          ? t("→ {{moi}}/{{suc}}", {
              moi: soVN(ke.dangChua + daChon.nhan),
              suc: soVN(ke.sucChua),
            })
          : t("Không giới hạn")}
      </span>
    );
  } else if (loai === "nguon") {
    vien = "border-2 border-bo-sidebar bg-white";
    phu = <span className="font-semibold text-bo-sidebar">{t("Kệ nguồn")}</span>;
  } else if (loai === "khoa") {
    vien = "cursor-not-allowed border-slate-200 bg-slate-100";
    so = <Lock className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
    phu = <span className="text-slate-500">{t("Đang kiểm kê")}</span>;
  } else if (loai === "khong-nhan") {
    vien = "cursor-not-allowed border-dashed border-slate-300 bg-white";
    phu = <span className="truncate text-slate-500">{ke.khoa === "BAO_TRI" || ke.trangThai === "BAO_TRI" ? t("Bảo trì") : t("Không nhận hàng")}</span>;
  } else if (loai === "day") {
    vien = "border-bo-border bg-bo-surface-subtle hover:bg-slate-100";
    so = <span className="text-[12px] text-slate-500">{t("Đầy")}</span>;
    phu = <span className="tabular-nums text-slate-500">{chuSuc}</span>;
  } else {
    vien = goiY
      ? "border-[1.5px] border-emerald-500 bg-emerald-50/70 hover:bg-emerald-50"
      : "border-bo-border bg-white hover:border-slate-400 hover:bg-slate-50";
    so = <b className={cn("text-[13px] font-semibold tabular-nums", loai === "du" ? "text-bo-success" : "text-bo-warning")}>{con == null ? "∞" : soVN(con)}</b>;
    phu = goiY ? (
      <span className="truncate font-semibold text-emerald-700">{goiY.cungMa ? t("Gợi ý · cùng mã hàng") : t("Gợi ý")}</span>
    ) : loai === "thieu" ? (
      <span className="truncate text-bo-warning">{t("ít chỗ hơn")}</span>
    ) : (
      <span className="truncate tabular-nums text-bo-muted">{chuSuc}</span>
    );
  }
  return (
    <button
      type="button"
      {...nav}
      data-goi-y={goiY ? "1" : undefined}
      aria-disabled={tat || ban || undefined}
      aria-pressed={daChon ? true : undefined}
      title={
        loai === "day"
          ? t("{{ma}} đã đầy: quản lý kho vẫn cất vượt được", {
              ma: ke.maViTri,
            })
          : ke.maViTri
      }
      onMouseDown={giuOQuet}
      onClick={() => (tat || ban || daChon ? null : onChon(ke))}
      className={cn(O, "h-[60px]", vien)}
    >
      {daChon ? (
        <span
          className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-md bg-bo-primary text-[10px] font-bold text-white ring-2 ring-white"
          aria-label={t("Thứ tự cất {{so}}", { so: daChon.thuTu })}
        >
          {daChon.thuTu}
        </span>
      ) : null}
      <span className="flex items-baseline justify-between gap-1.5">
        <span className={cn("truncate font-mono text-xs font-semibold", tat && loai !== "nguon" ? "text-slate-500" : "text-bo-heading")}>{ke.maViTri}</span>
        {so}
      </span>
      <span className="flex min-w-0 items-center">{phu}</span>
      {daChon ? <ThanhO ke={ke} them={daChon.nhan} /> : <span className="h-1.5" aria-hidden="true" />}
    </button>
  );
}

/**
 * Sơ đồ kệ đích (trong khối lượt chuyển, trên chân xác nhận). `can`: số còn phải cất; `goiY`: danh sách gợi ý đã xếp
 * theo thứ tự máy chủ (làm nổi đúng {@link SO_GOI_Y_NOI} kệ đầu); `phan`: kệ đích đã chọn theo thứ tự cất.
 */
const SO_GOI_Y_NOI = 5;
export function SoDoKeDich({ ds, keNguonId, can, goiY, phan, ban, capNhatLuc, dangTai, onTaiLai, onChon, onVeOQuet }) {
  const [khu, setKhu] = useState(null);
  const dsKhu = useMemo(() => tomTatKhu(ds), [ds]);
  const khuHieuLuc = khu !== null && dsKhu.some((x) => x.khu === khu) ? khu : null;
  const dsHien = useMemo(() => (khuHieuLuc === null ? ds : ds.filter((k) => (k.khuVuc || "") === khuHieuLuc)), [ds, khuHieuLuc]);
  const goiYNoi = useMemo(() => new Map(can > 0 ? (goiY ?? []).slice(0, SO_GOI_Y_NOI).map((k) => [k.id, k]) : []), [goiY, can]);
  const daChon = useMemo(() => new Map(phan.map((p, i) => [p.ke.id, { thuTu: i + 1, nhan: p.nhan }])), [phan]);
  const loaiCua = (ke) => loaiKeDich(ke, { keNguonId, can });
  const dem = useMemo(() => {
    const d = { du: 0, thieu: 0, day: 0 };
    for (const k of dsHien) {
      const l = loaiKeDich(k, { keNguonId, can });
      if (l in d && !daChon.has(k.id)) d[l] += 1;
    }
    return d;
  }, [dsHien, keNguonId, can, daChon]);

  return (
    <div className="border-t border-bo-border" role="region" aria-labelledby="ck-so-do-dich">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <h3 id="ck-so-do-dich" className="text-sm font-semibold text-bo-heading">
          {t("Sơ đồ kệ đích")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <ChonKhu dsKhu={dsKhu} khu={khuHieuLuc} onKhu={setKhu} onVeOQuet={onVeOQuet} />
          <CapNhatLuc luc={capNhatLuc} dangTai={dangTai} onTaiLai={onTaiLai} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 text-[12px] text-slate-600">
        {can > 0 ? (
          <span>
            {t("Cần chỗ cho {{so}} · số trên ô = chỗ còn trống", {
              so: soVN(can),
              count: can,
            })}
          </span>
        ) : (
          <span>{t("Đã đủ chỗ · số trên ô = chỗ còn trống")}</span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border-[1.5px] border-emerald-500 bg-emerald-50" aria-hidden="true" />
          {t("Gợi ý")}
        </span>
        <span>
          <b className="text-bo-success tabular-nums">{soVN(dem.du)}</b> {t("đủ chỗ")}
        </span>
        {dem.thieu ? (
          <span>
            <b className="text-bo-warning tabular-nums">{soVN(dem.thieu)}</b> {t("ít chỗ hơn, sẽ hỏi tách cất")}
          </span>
        ) : null}
        {dem.day ? (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] border border-bo-border bg-bo-surface-subtle" aria-hidden="true" />
            {t("{{so}} kệ đầy · quản lý kho cất vượt được", {
              so: soVN(dem.day),
              count: dem.day,
            })}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <BanDoKe
          ds={dsHien}
          nhan={t("Sơ đồ kệ đích")}
          // Ô kệ đích 3 dòng ("Gợi ý · cùng mã hàng", "→ 30/40") cần rộng hơn ô kệ nguồn
          rongO={136}
          veO={(ke, nav) => {
            const l = loaiCua(ke);
            return <ODich ke={ke} nav={nav} loai={l} goiY={goiYNoi.get(ke.id)} daChon={daChon.get(ke.id)} ban={ban} onChon={onChon} />;
          }}
        />
      </div>
    </div>
  );
}
