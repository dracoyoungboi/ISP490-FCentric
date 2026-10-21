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
import { cn } from "@/lib/utils";

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

  const mucMenu = thanhMang(menu).filter(Boolean);
  const coMenu = coSaoChep || mucMenu.length > 0;
  const coMoTa = mucMenu.some((m) => m.moTa);
  const propsTrangThai = typeof trangThai === "string" ? { label: trangThai } : trangThai;
  const phanPhu = Array.isArray(dongPhu) ? dongPhu.filter(coNoiDung) : null;
  const dsNutPhu = thanhMang(nutPhu).filter(Boolean);
  const dsNutChinh = thanhMang(nutChinh).filter(Boolean);

  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
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
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1
              title={typeof ma === "string" ? ma : undefined}
              className={cn(
                "min-w-0 tabular-nums",
                CO_TIEU_DE[coTieuDe] ?? CO_TIEU_DE.lg,
                kepTieuDe === 2 ? "line-clamp-2 break-words" : "truncate",
              )}
            >
              {coNoiDung(ma) ? ma : "—"}
            </h1>
            {propsTrangThai?.label ? <StatusBadge {...propsTrangThai} size="lg" /> : null}
            {nhanPhu}
          </div>
          {phanPhu ? (
            phanPhu.length ? (
              <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                {phanPhu.map((phan, i) => (
                  <Fragment key={i}>
                    {i > 0 ? " · " : null}
                    <span className="inline-block max-w-full truncate align-bottom">{phan}</span>
                  </Fragment>
                ))}
              </p>
            ) : null
          ) : coNoiDung(dongPhu) ? (
            <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{dongPhu}</p>
          ) : null}
        </div>
      </div>

      {dsNutPhu.length || coMenu || dsNutChinh.length ? (
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {dsNutPhu.map((nut, i) => (
            <NutThaoTac key={nut.ma ?? i} nut={nut} kieuMacDinh="vien" />
          ))}

          {coMenu ? (
            <DropdownMenu modal={false} open={moMenu} onOpenChange={doiMenu}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={nhanMenu}
                  title={nhanMenu}
                  className={NUT_VIEN}
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  "z-50 max-w-[calc(100vw-32px)] rounded-lg border border-bo-border bg-white p-1 shadow-lg",
                  coMoTa ? "w-[272px]" : "w-[220px]",
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
                      <DropdownMenuItem
                        onSelect={muc.onSelect}
                        disabled={Boolean(muc.khoa)}
                        className={cn(MUC_MENU, muc.nguyHiem && "focus:bg-bo-danger-soft")}
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
          ) : null}

          {dsNutChinh.map((nut, i) => (
            <NutThaoTac key={nut.ma ?? i} nut={nut} kieuMacDinh="chinh" />
          ))}
        </div>
      ) : null}
    </header>
  );
}
