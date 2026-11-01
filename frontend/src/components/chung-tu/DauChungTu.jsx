import { Fragment, createElement, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Ellipsis, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PAGE_HEADING_TYPE, useClaimPageTitle } from "@/components/backoffice/pageTitle";
import StatusBadge from "@/components/shared/StatusBadge";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import useSaoChep from "@/hooks/useSaoChep";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBanPhimAoMo } from "@/hooks/useBanPhimAo";
import { cn } from "@/lib/utils";

/**
 * Điện thoại (< 768px): nút chính của chứng từ nằm ở thanh thao tác dính đáy màn (ngón cái với tới), bên trái là ⋯
 * (gom cả nút phụ như In…). Lý do khóa ghi bằng chữ thay cho chú thích rê chuột: cạnh nút khi chỉ có một nút, thành
 * dòng riêng phía trên khi có hai nút. Trang được đệm đáy (index.css: html[data-co-thanh-thao-tac]).
 * Khi bàn phím ảo mở (đang gõ ô quét / ô nhập) thanh tạm ẩn để không bị bàn phím che hay trôi giữa màn.
 */
// Tối đa 2 nút chính trên thanh; nút thứ ba trở đi vào ⋯
const SO_NUT_TREN_THANH = 2;
// Cột lý do cạnh nút chỉ còn ~100px ở 390px (sau ⋯ và nút chính): quá chừng này ký tự thì hai dòng không chứa hết, nên
// lý do lên dòng riêng phía trên thay vì bị cắt ("Chưa hoàn tất được: còn 2 sả…")
const LY_DO_CANH_NUT_TOI_DA = 28;
// Đếm số thanh đang gắn: thanh cũ gỡ sau khi thanh mới gắn (chuyển trang) không xóa nhầm thuộc tính của thanh mới
let soThanhDangGan = 0;

function ThanhThaoTacDay({ dsNut, menu }) {
  const lyDo = dsNut.find((nut) => nut.khoa && nut.lyDo)?.lyDo;
  const lyDoCanhNut = Boolean(lyDo) && dsNut.length === 1 && String(lyDo).length <= LY_DO_CANH_NUT_TOI_DA;
  const lyDoTren = Boolean(lyDo) && !lyDoCanhNut;
  // Dòng lý do phía trên xuống tối đa hai dòng: đo số dòng thật để trang chừa đủ chỗ ở đáy (index.css)
  const lyDoRef = useRef(null);
  // Kết quả đo gắn với câu lý do đã đo: câu khác (hay lý do vừa hiện lại) thì coi là một dòng cho tới khi đo xong
  const [doLyDo, setDoLyDo] = useState(null);
  const lyDoHaiDong = lyDoTren && doLyDo?.lyDo === lyDo && doLyDo.haiDong;
  useEffect(() => {
    const p = lyDoRef.current;
    if (!p || typeof ResizeObserver === "undefined") return undefined;
    // Thanh tạm ẩn khi bàn phím ảo mở (cao 0): giữ số dòng cũ
    const tinh = () => {
      if (!p.offsetHeight) return;
      const haiDong = p.offsetHeight > 20;
      setDoLyDo((cu) => (cu?.lyDo === lyDo && cu.haiDong === haiDong ? cu : { lyDo, haiDong }));
    };
    tinh();
    const theoDoi = new ResizeObserver(tinh);
    theoDoi.observe(p);
    return () => theoDoi.disconnect();
  }, [lyDoTren, lyDo]);
  useEffect(() => {
    soThanhDangGan += 1;
    return () => {
      soThanhDangGan -= 1;
      if (!soThanhDangGan) document.documentElement.removeAttribute("data-co-thanh-thao-tac");
    };
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-co-thanh-thao-tac", lyDoTren ? (lyDoHaiDong ? "cao-2" : "cao") : "");
  }, [lyDoTren, lyDoHaiDong]);
  const banPhimMo = useBanPhimAoMo();

  return (
    <div
      className={cn(
        "no-print fixed inset-x-0 bottom-0 z-30 border-t border-bo-border bg-bo-surface px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]",
        banPhimMo && "hidden",
      )}
    >
      {lyDoTren ? <p ref={lyDoRef} className="mb-2 line-clamp-2 text-[13px] leading-[18px] text-bo-muted">{lyDo}</p> : null}
      <div className="flex items-center gap-3">
        {menu}
        {lyDoCanhNut ? <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-[18px] text-bo-muted">{lyDo}</p> : null}
        {dsNut.map((nut, i) => {
          const kieu = KIEU_NUT[nut.kieu] ? nut.kieu : "chinh";
          return (
            <Button
              key={nut.ma ?? i}
              type="button"
              variant={kieu === "vien" ? "outline" : "default"}
              onClick={nut.onClick}
              disabled={Boolean(nut.khoa || nut.dangChay)}
              aria-busy={nut.dangChay ? true : undefined}
              className={cn(
                "h-10 min-w-0 gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                KIEU_NUT[kieu],
                lyDoCanhNut ? "max-w-[60%] shrink-0" : "flex-1",
              )}
            >
              {nut.dangChay ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : nut.icon ? (
                createElement(nut.icon, { className: "size-4 shrink-0", "aria-hidden": true })
              ) : null}
              {/* Nhãn dài xuống tối đa hai dòng thay vì bị cắt: hai nút chia đôi thanh ("Xác nhận nhận đủ"), hoặc một nút đứng
                  cạnh lý do khóa ("Tạo phiếu điều chuyển") chỉ còn ~115–155px cho chữ ở 390px */}
              <span className="line-clamp-2 whitespace-normal text-center leading-[18px]">{nut.nhan}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** Nút (phụ / chính thừa) thành mục ⋯ trên điện thoại: khóa thì lý do thành dòng mô tả. */
const mucTuNut = (nut) => ({
  ma: nut.ma,
  nhan: nut.nhan,
  icon: nut.icon,
  onSelect: nut.onClick,
  khoa: Boolean(nut.khoa || nut.dangChay),
  moTa: nut.khoa ? nut.lyDo : undefined,
  nguyHiem: nut.kieu === "nguyHiem",
});

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const KIEU_NUT = {
  chinh: "bg-bo-primary text-white hover:bg-bo-primary-hover",
  nguyHiem: "bg-bo-danger text-white hover:bg-bo-danger-strong",
  vien: NUT_VIEN,
};
const MUC_MENU =
  "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

// Cỡ tiêu đề: "lg" = tiêu đề trang chuẩn (24px); "md" = 20px cho tiêu đề là tên dài (vd. tên biến thể ở Chọn lô hàng)
const CO_TIEU_DE = {
  lg: PAGE_HEADING_TYPE,
  md: cn(PAGE_HEADING_TYPE, "text-xl leading-7"),
};

const thanhMang = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const coNoiDung = (x) => x != null && x !== false && x !== "";

/**
 * Một nút ở vùng thao tác. Khóa kèm lý do: bọc span nhận rê chuột / phím Tab để hiện chú thích (nút khóa không nhận
 * sự kiện chuột), lý do đọc được qua aria-describedby (sr-only), hoặc hiện thẳng cạnh nút khi `hienLyDo`.
 */
function NutThaoTac({ nut, kieuMacDinh }) {
  const id = useId();
  const kieu = KIEU_NUT[nut.kieu] ? nut.kieu : kieuMacDinh;
  const coLyDo = Boolean(nut.khoa && nut.lyDo);
  const idLyDo = `${id}-ly-do`;
  const gian = kieu !== "vien"; // nút chính / nguy hiểm giãn đều hàng trên điện thoại

  const nut0 = (
    <Button
      type="button"
      variant={kieu === "vien" ? "outline" : "default"}
      onClick={nut.onClick}
      disabled={Boolean(nut.khoa || nut.dangChay)}
      aria-describedby={coLyDo ? idLyDo : undefined}
      aria-busy={nut.dangChay ? true : undefined}
      className={cn(
        "gap-1.5 disabled:cursor-not-allowed disabled:opacity-50",
        KIEU_NUT[kieu],
        gian && (coLyDo && !nut.hienLyDo ? "max-sm:w-full" : "max-sm:flex-1"),
      )}
    >
      {nut.dangChay ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : nut.icon ? (
        createElement(nut.icon, { className: "size-4", "aria-hidden": true })
      ) : null}
      {nut.nhan}
    </Button>
  );

  if (!coLyDo) return nut0;

  if (nut.hienLyDo) {
    // Màn rộng: lý do đứng trước nút; điện thoại: xuống hàng riêng dưới các nút
    return (
      <>
        <span id={idLyDo} className="text-xs leading-4 text-bo-muted max-sm:order-last max-sm:w-full">
          {nut.lyDo}
        </span>
        {nut0}
      </>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span nhận rê chuột thay cho nút đang khóa (nút khóa không nhận sự kiện chuột) */}
          <span
            tabIndex={0}
            className={cn(
              "inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
              // Màn cảm ứng: chạm 44px để xem lý do khóa (nút 36px bên trong không nhận chạm khi khóa)
              "cam-ung:relative cam-ung:before:absolute cam-ung:before:inset-x-0 cam-ung:before:-inset-y-1 cam-ung:before:content-['']",
              gian && "max-sm:flex-1",
            )}
          >
            {nut0}
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-bo-foreground text-white">
          <p>{nut.lyDo}</p>
        </TooltipContent>
      </Tooltip>
      <span id={idLyDo} className="sr-only">
        {nut.lyDo}
      </span>
    </TooltipProvider>
  );
}

/**
 * Đầu khối của màn chi tiết chứng từ (rút từ DauTrangDonMua đã chốt): nút ←, mã chứng từ (H1) + thẻ trạng thái,
 * một dòng phụ, bên phải: nút phụ (In…), menu ⋯, nút chính. Màn tự vẽ tiêu đề nên "nhận" tiêu đề của layout.
 *
 * - `ma`: H1 (một h1 cho cả màn). `kepTieuDe`: 1 (mặc định, một dòng rồi "…") | 2 (tối đa 2 dòng rồi "…", cho tên dài);
 *   `coTieuDe`: "lg" (mặc định, 24px như mọi tiêu đề trang) | "md" (20px, khi tiêu đề là tên sản phẩm). Chữ dài có title.
 * - `trangThai`: chuỗi nhãn hoặc props của StatusBadge `{ label, quyTrinh, nhom, tone }` (luôn vẽ cỡ "lg").
 * - `dongPhu`: nội dung dòng phụ; mảng thì bỏ phần trống, nối bằng " · ", mỗi phần không bị bẻ giữa chừng (hết chỗ thì
 *   cả phần xuống dòng; phần dài hơn cả dòng thì cắt "…").
 * - `nutPhu` (trước ⋯) và `nutChinh` (sau ⋯): một nút hoặc mảng `{ nhan, icon, onClick, kieu, khoa, lyDo, hienLyDo, dangChay }`;
 *   `kieu` "vien" | "chinh" | "nguyHiem" (mặc định: nút phụ "vien", nút chính "chinh"). Không có quyền thì đừng truyền nút;
 *   có quyền nhưng chưa đủ điều kiện thì `khoa` + `lyDo`.
 * - `menu`: các mục ⋯ `{ nhan, icon, onSelect, moTa, nguyHiem, khoa }`; mục nguy hiểm chữ đỏ, có vạch ngăn phía trên.
 * - `saoChepMa`: `{ giaTri, nhan }` thêm mục "Sao chép…" đầu menu, báo theo config/thongBaoNhanh.js → nutSaoChep
 *   (giống DauTrangDonMua: "thong-bao" bật thông báo nhanh, "tai-cho" đổi chữ thành "Đã sao chép" rồi đóng menu).
 */
export default function DauChungTu({
  ma,
  kepTieuDe = 1,
  coTieuDe = "lg",
  trangThai,
  nhanPhu,
  dongPhu,
  onQuayLai,
  nhanQuayLai = "Quay lại",
  nutPhu,
  nutChinh,
  menu,
  saoChepMa,
  nhanMenu = "Thao tác khác",
  className,
}) {
  useClaimPageTitle(true);
  const isMobile = useIsMobile();
  const [moMenu, setMoMenu] = useState(false);
  const { daChep, saoChep, quenDaChep, taiCho } = useSaoChep();
  const henDongMenu = useRef(0);

  useEffect(() => () => clearTimeout(henDongMenu.current), []);

  const doiMenu = (mo) => {
    clearTimeout(henDongMenu.current);
    if (!mo) quenDaChep();
    setMoMenu(mo);
  };

  const coSaoChep = coNoiDung(saoChepMa?.giaTri);
  const nhanSaoChep = saoChepMa?.nhan || "Sao chép mã";
  const chepMa = async (suKien) => {
    if (!taiCho) {
      // Menu đóng như mọi mục khác, thông báo nhanh báo đã chép
      await saoChep(saoChepMa.giaTri, { nhan: nhanSaoChep });
      return;
    }
    suKien.preventDefault(); // giữ menu mở để người dùng thấy "Đã sao chép"
    if (await saoChep(saoChepMa.giaTri)) {
      clearTimeout(henDongMenu.current);
      henDongMenu.current = setTimeout(() => doiMenu(false), CAU_HINH_THONG_BAO_NHANH.dongMenuSauSaoChep);
    }
  };

  const propsTrangThai = typeof trangThai === "string" ? { label: trangThai } : trangThai;
  const phanPhu = Array.isArray(dongPhu) ? dongPhu.filter(coNoiDung) : null;
  const dsNutPhu = thanhMang(nutPhu).filter(Boolean);
  const dsNutChinh = thanhMang(nutChinh).filter(Boolean);
  const nutODay = isMobile && dsNutChinh.length > 0;
  // Điện thoại có thanh đáy: ⋯ gom nút chính thừa, nút phụ rồi tới các mục menu sẵn có (mục nguy hiểm để cuối)
  const nutThua = nutODay ? dsNutChinh.slice(SO_NUT_TREN_THANH) : [];
  // Nút chính duy nhất đang khóa (vd. "Xác nhận xuất" chờ nhặt đủ hàng) mà trang đánh dấu một nút phụ là bước kế tiếp
  // (`buocTiep`, vd. "Mở phiếu nhặt"): nút đó đứng cạnh nút chính trên thanh, không giấu trong ⋯
  const nutPhuLenThanh =
    nutODay && dsNutChinh.length === 1 && dsNutChinh[0].khoa ? dsNutPhu.find((n) => n.buocTiep && !n.khoa) ?? null : null;
  const dsNutThanh = nutPhuLenThanh
    ? [{ ...nutPhuLenThanh, kieu: "vien" }, dsNutChinh[0]]
    : dsNutChinh.slice(0, SO_NUT_TREN_THANH);
  const mucMenu = [
    ...(nutODay
      ? [...nutThua.filter((n) => n.kieu !== "nguyHiem"), ...dsNutPhu.filter((n) => n !== nutPhuLenThanh)].map(mucTuNut)
      : []),
    ...thanhMang(menu).filter(Boolean),
    ...nutThua.filter((n) => n.kieu === "nguyHiem").map(mucTuNut),
  ];
  const coMenu = coSaoChep || mucMenu.length > 0;
  // Điện thoại, đầu chứng từ chỉ có ⋯ (phiếu đã xong, người xem không có việc ở phiếu này): ⋯ ở cuối hàng nhãn trạng thái thay vì
  // đứng một mình thành hàng riêng chen giữa dòng phụ và nội dung; tiêu đề vẫn giữ trọn chiều ngang nên số chứng từ không bị bẻ
  const menuCanhNhan = isMobile && !nutODay && coMenu && !dsNutPhu.length && !dsNutChinh.length;
  const coMoTa = mucMenu.some((m) => m.moTa);

  const menuThaoTac = coMenu ? (
    <DropdownMenu modal={false} open={moMenu} onOpenChange={doiMenu}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={nhanMenu}
          title={nhanMenu}
          className={cn(NUT_VIEN, nutODay && "size-10 shrink-0")}
        >
          <Ellipsis className={nutODay ? "size-5" : "size-4"} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={nutODay ? "start" : "end"}
        // Điện thoại: menu cách mép màn 12px (không dính sát mép trái)
        collisionPadding={isMobile ? 12 : undefined}
        className={cn(
          "z-50 max-w-[calc(100vw-32px)] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg",
          coMoTa ? "w-[272px]" : "w-[220px]",
          // Chạm bằng ngón tay trên thanh đáy: mục cao 44px
          nutODay && "[&_[role=menuitem]]:min-h-11",
        )}
      >
        {coSaoChep ? (
          <DropdownMenuItem onSelect={chepMa} className={MUC_MENU}>
            {daChep ? (
              <>
                <Check className="mt-0.5 size-4 text-bo-success" strokeWidth={2.5} aria-hidden="true" />
                <span className="text-bo-success">Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                {nhanSaoChep}
              </>
            )}
          </DropdownMenuItem>
        ) : null}
        {mucMenu.map((muc, i) => {
          const truocDo = i > 0 ? !mucMenu[i - 1].nguyHiem : coSaoChep;
          return (
            <Fragment key={muc.ma ?? muc.nhan ?? i}>
              {muc.nguyHiem && truocDo ? <DropdownMenuSeparator className="my-1 bg-bo-border" /> : null}
              {/* Mục khóa vẫn tới được bằng phím (aria-disabled, không dùng disabled của Radix) để trình đọc
                  màn hình đọc được lý do khóa ở dòng mô tả; chọn thì không làm gì, menu giữ nguyên */}
              <DropdownMenuItem
                onSelect={muc.khoa ? (suKien) => suKien.preventDefault() : muc.onSelect}
                aria-disabled={muc.khoa ? true : undefined}
                className={cn(
                  MUC_MENU,
                  muc.nguyHiem && "focus:bg-bo-danger-soft",
                  muc.khoa && "cursor-not-allowed opacity-60",
                )}
              >
                {muc.icon
                  ? createElement(muc.icon, {
                    className: cn("mt-0.5 size-4", muc.nguyHiem ? "text-bo-danger" : "text-slate-400"),
                    "aria-hidden": true,
                  })
                  : null}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      muc.nguyHiem ? "font-medium text-bo-danger" : muc.moTa ? "font-medium text-bo-foreground" : "",
                    )}
                  >
                    {muc.nhan}
                  </span>
                  {muc.moTa ? <span className="text-xs leading-4 text-bo-muted">{muc.moTa}</span> : null}
                </span>
              </DropdownMenuItem>
            </Fragment>
          );
        })}
        <span className="sr-only" aria-live="polite">
          {daChep ? "Đã sao chép" : ""}
        </span>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <div className={cn("flex min-w-0 items-start gap-3.5 sm:items-center", menuCanhNhan && "flex-1")}>
        {onQuayLai ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onQuayLai}
            aria-label={nhanQuayLai}
            title={nhanQuayLai}
            className={cn("shrink-0", NUT_VIEN)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <div className={cn("min-w-0", menuCanhNhan && "flex-1")}>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1
              title={typeof ma === "string" ? ma : undefined}
              className={cn(
                "min-w-0 tabular-nums",
                CO_TIEU_DE[coTieuDe] ?? CO_TIEU_DE.lg,
                // Điện thoại: tiêu đề dài ("Nhận hàng · PX-TRF-202610291") xuống tối đa hai dòng, không cắt mất số chứng từ
                kepTieuDe === 2 ? "line-clamp-2 break-words" : "truncate max-md:line-clamp-2 max-md:whitespace-normal max-md:break-words",
              )}
            >
              {/* Tiêu đề "Việc · Số chứng từ": phần sau dấu · không ngắt ở dấu gạch khi tiêu đề xuống dòng trên điện thoại
                  ("Nhận hàng · PX-TRF-202610291"); vẫn là chuỗi nên giữ title cho máy tính */}
              {typeof ma === "string" && ma.includes(" · ") ? (
                <>
                  {ma.slice(0, ma.lastIndexOf(" · ") + 3)}
                  <span className="whitespace-nowrap">{ma.slice(ma.lastIndexOf(" · ") + 3)}</span>
                </>
              ) : coNoiDung(ma) ? ma : "—"}
            </h1>
            {propsTrangThai?.label ? <StatusBadge {...propsTrangThai} size="lg" /> : null}
            {nhanPhu}
            {menuCanhNhan ? <span className="ml-auto">{menuThaoTac}</span> : null}
          </div>
          {phanPhu ? (
            phanPhu.length ? (
              <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                {phanPhu.map((phan, i) => (
                  <Fragment key={i}>
                    {/* Khoảng trắng trước "·" không ngắt dòng: dòng phụ xuống dòng trên điện thoại thì "·" ở cuối dòng trên, không đứng một mình */}
                    {i > 0 ? "\u00a0· " : null}
                    {/* Điện thoại: các phần chảy nối nhau như chữ thường và xuống dòng thay vì bị cắt ("Chọn kho nguồn, kho đích và
                        hàng cần chuyển"); inline-block chiếm trọn dòng sẽ để "·" đứng một mình */}
                    <span className="inline-block max-w-full truncate align-bottom max-md:inline max-md:whitespace-normal">{phan}</span>
                  </Fragment>
                ))}
              </p>
            ) : null
          ) : coNoiDung(dongPhu) ? (
            <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{dongPhu}</p>
          ) : null}
        </div>
      </div>

      {nutODay ? (
        // Thanh đáy sau tiêu đề trong DOM: thứ tự Tab là tiêu đề → ⋯ → nút chính
        <ThanhThaoTacDay dsNut={dsNutThanh} menu={menuThaoTac} />
      ) : !menuCanhNhan && (dsNutPhu.length || coMenu || dsNutChinh.length) ? (
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {dsNutPhu.map((nut, i) => (
            <NutThaoTac key={nut.ma ?? i} nut={nut} kieuMacDinh="vien" />
          ))}
          {menuThaoTac}
          {dsNutChinh.map((nut, i) => (
            <NutThaoTac key={nut.ma ?? i} nut={nut} kieuMacDinh="chinh" />
          ))}
        </div>
      ) : null}
    </header>
  );
}
