import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, Ellipsis, FileText, PackagePlus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import StatusBadge from "@/components/shared/StatusBadge";
import { getDonMuaHangStatus } from "@/constants/donMuaHang";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import useSaoChep from "@/hooks/useSaoChep";
import { formatCurrency, formatDate } from "@/utils/formatters";

const NUT_VIEN =
  "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";

/**
 * Đầu khối của màn Chi tiết đơn mua hàng: nút quay lại, mã đơn + trạng thái, dòng phụ
 * (tổng tiền · nhà cung cấp · kho · ngày tạo) và các nút In đơn hàng, ⋯, Tạo phiếu nhập kho.
 * Màn tự vẽ tiêu đề nên phải "nhận" tiêu đề để layout không vẽ thêm tiêu đề dự phòng.
 *
 * `taoPhieu`: `{ hien, khoa, lyDo, nhan, moPhieu }` — ẩn khi không có quyền; khóa kèm lý do khi đã đủ hàng
 * hoặc kho làm việc khác kho nhận của đơn. `moPhieu`: phần còn lại đã nằm ở phiếu nhập nháp, nút mở phiếu đó
 * (chữ theo `nhan`) thay vì tạo phiếu mới.
 *
 * "Sao chép mã đơn" trong menu ⋯ theo config/thongBaoNhanh.js → nutSaoChep: "thong-bao" thì menu đóng
 * và bật thông báo "Đã sao chép mã đơn"; "tai-cho" thì mục đổi thành "Đã sao chép" rồi menu tự đóng.
 */
export default function DauTrangDonMua({ don, taoPhieu, onQuayLai, onIn, onTaoPhieu, onMoYeuCau }) {
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

  const saoChepMa = async (suKien) => {
    if (!taiCho) {
      // Menu đóng như mọi mục khác, thông báo nhanh báo đã chép
      await saoChep(don.soDonMua, { nhan: "Sao chép mã đơn" });
      return;
    }
    suKien.preventDefault(); // giữ menu mở để người dùng thấy "Đã sao chép"
    if (await saoChep(don.soDonMua)) {
      clearTimeout(henDongMenu.current);
      henDongMenu.current = setTimeout(() => doiMenu(false), CAU_HINH_THONG_BAO_NHANH.dongMenuSauSaoChep);
    }
  };

  const trangThai = getDonMuaHangStatus(don.trangThai);
  const ncc = don.nhaCungCap;
  const kho = don.khoNhap;
  const coYeuCau = Boolean(don.yeuCauMuaHang?.id);

  const nutTaoPhieu = (
    <Button
      type="button"
      onClick={onTaoPhieu}
      disabled={taoPhieu.khoa}
      aria-describedby={taoPhieu.khoa ? "ly-do-khoa-tao-phieu" : undefined}
      className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full"
    >
      {taoPhieu.moPhieu ? <FileText className="size-4" aria-hidden="true" /> : <PackagePlus className="size-4" aria-hidden="true" />}
      {taoPhieu.nhan || "Tạo phiếu nhập kho"}
    </Button>
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onQuayLai}
          aria-label="Về danh sách đơn mua hàng"
          title="Về danh sách đơn mua hàng"
          className={`shrink-0 ${NUT_VIEN}`}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <PageHeading className="tabular-nums">{don.soDonMua || "—"}</PageHeading>
            <StatusBadge quyTrinh="donMua" size="lg" label={trangThai.label} />
          </div>
          <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
            <span className="font-semibold tabular-nums text-bo-foreground">{formatCurrency(don.tongTien)}</span>
            {ncc ? (
              <>
                {" · "}
                <Link to={`/supplier/${ncc.id}`} className="text-bo-primary hover:text-bo-primary-hover hover:underline">
                  {ncc.tenNhaCungCap || ncc.maNhaCungCap}
                </Link>
              </>
            ) : null}
            {kho?.tenKho ? ` · ${kho.tenKho}` : null}
            {don.ngayTao ? ` · tạo ${formatDate(don.ngayTao)}` : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
        <Button type="button" variant="outline" onClick={onIn} className={`gap-1.5 ${NUT_VIEN}`}>
          <Printer className="size-4" aria-hidden="true" />
          In đơn hàng
        </Button>

        <DropdownMenu modal={false} open={moMenu} onOpenChange={doiMenu}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác" title="Thao tác khác" className={NUT_VIEN}>
              <Ellipsis className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="z-50 w-[220px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
          >
            <DropdownMenuItem
              onSelect={saoChepMa}
              className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
            >
              {daChep ? (
                <>
                  <Check className="size-4 text-bo-success" strokeWidth={2.5} aria-hidden="true" />
                  <span className="text-bo-success">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="size-4 text-slate-400" aria-hidden="true" />
                  Sao chép mã đơn
                </>
              )}
            </DropdownMenuItem>
            {coYeuCau ? (
              <DropdownMenuItem
                onClick={onMoYeuCau}
                className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
              >
                <FileText className="size-4 text-slate-400" aria-hidden="true" />
                Mở yêu cầu nhập hàng
              </DropdownMenuItem>
            ) : null}
            <span className="sr-only" aria-live="polite">
              {daChep ? "Đã sao chép mã đơn" : ""}
            </span>
          </DropdownMenuContent>
        </DropdownMenu>

        {taoPhieu.hien ? (
          taoPhieu.khoa ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* span nhận rê chuột thay cho nút đang khóa (nút khóa không nhận sự kiện chuột) */}
                  <span tabIndex={0} className="inline-flex rounded-md max-sm:w-full">
                    {nutTaoPhieu}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-bo-foreground text-white">
                  <p>{taoPhieu.lyDo}</p>
                </TooltipContent>
              </Tooltip>
              <span id="ly-do-khoa-tao-phieu" className="sr-only">
                {taoPhieu.lyDo}
              </span>
            </TooltipProvider>
          ) : (
            nutTaoPhieu
          )
        ) : null}
      </div>
    </header>
  );
}
