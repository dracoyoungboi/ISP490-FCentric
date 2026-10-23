import { useRef } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ListRestart, Loader2, MoreHorizontal, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/shared/StatusBadge";
import ChannelLogo from "@/components/channel/ChannelLogo";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { TheCaiDat, VUNG_CHAM_CONG_TAC } from "@/components/channel/KhuonCaiDat";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { ngayThang } from "@/components/channel/ngay";
import { noiDungSan } from "@/components/channel/noiDungSan";
import { conLaiUyQuyen, hanUyQuyen, nhanTrangThaiKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { cn } from "@/lib/utils";

const MUC_MENU = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/** Dấu "·" đứng trước mỗi mục của dòng phụ (rộng cố định để lề âm của dòng cắt vừa dấu đầu dòng). */
function DauCach() {
  return (
    <span aria-hidden="true" className="w-4 shrink-0 text-center">
      ·
    </span>
  );
}

function NoiDungMuc({ icon, nhan, moTa, nguyHiem = false }) {
  const Icon = icon;
  return (
    <>
      <Icon className={cn("mt-0.5 size-4", nguyHiem ? "text-bo-danger" : "text-bo-muted")} aria-hidden="true" />
      <span className="flex min-w-0 flex-col gap-0.5">
        {/* Chữ đỏ đậm: đủ tương phản trên nền đỏ nhạt khi mục được chọn */}
        <span className={cn("font-medium", nguyHiem ? "text-bo-danger-strong" : "text-bo-foreground")}>{nhan}</span>
        {moTa ? <span className="text-xs leading-4 text-bo-muted">{moTa}</span> : null}
      </span>
    </>
  );
}

/**
 * Thẻ "Gian hàng" ở trang Cấu hình của sàn ủy quyền (KH mục B.8, bố cục B như Shopify): gian hàng, mã gian hàng
 * trên sàn, hạn ủy quyền (còn ≤ 7 ngày thì vàng, hết hạn thì đỏ), tình trạng, công tắc đồng bộ, kiểm tra kết nối
 * và menu ⋯ (ủy quyền lại, cập nhật khóa ứng dụng, chạy lại trình thiết lập, ngắt kết nối).
 * Trang cha giữ trạng thái và gọi API; `dangChay`: tên thao tác đang chạy ("kiem-tra", "uy-quyen", "ngat").
 */
export default function TheGianHangUyQuyen({
  san,
  ketNoi,
  dongBoGianHang,
  onDoiDongBo,
  khoa = false,
  dangChay = null,
  ketQuaKetNoi,
  onKiemTra,
  onUyQuyenLai,
  onCapNhatKhoa,
  onNgatKetNoi,
}) {
  const noiDung = noiDungSan(san.maKenh);
  const han = hanUyQuyen(ketNoi);
  const trangThai = trangThaiKetNoi(ketNoi);
  const hetHan = trangThai === "het_han";
  const tinhTrang = nhanTrangThaiKetNoi(trangThai, san.kieuKetNoi);
  // Mục mở hộp thoại: chạy sau khi menu đóng hẳn. Không để menu tự trả tiêu điểm (hộp thoại vừa mở nhận "tiêu điểm ra
  // ngoài" rồi tự đóng): tự đặt tiêu điểm về nút ⋯ trước khi mở, để đóng hộp thoại thì tiêu điểm quay lại nút này
  const viecSauMenuRef = useRef(null);
  const nutMenuRef = useRef(null);
  const sauKhiDongMenu = (viec) => () => {
    viecSauMenuRef.current = viec;
  };

  return (
    <TheCaiDat aria-label="Gian hàng">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5">
        {/* Phần gian hàng co giãn (dòng phụ tự xuống dòng) để thẻ giữ một hàng ngang khi có "(còn N ngày)" */}
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
          <ChannelLogo maKenh={san.maKenh} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5 text-bo-heading">{ketNoi?.tenGianHang || `Gian hàng ${san.ten}`}</p>
            {/* Mỗi mục có dấu "·" phía trước; mục nào xuống dòng thì dấu đầu dòng nằm ngoài lề âm và bị cắt (như Tổng
                quan), nên không có "·" treo cuối dòng ở mọi bề rộng */}
            <div className="mt-0.5 overflow-hidden">
              <p className="-ml-4 flex flex-wrap items-center text-[13px] leading-5 text-bo-muted">
                {ketNoi?.shopIdSan ? (
                  <span className="flex items-center whitespace-nowrap tabular-nums">
                    <DauCach />
                    {noiDung?.nhanIdSan ?? "Mã gian hàng"} {ketNoi.shopIdSan}
                  </span>
                ) : null}
                {/* Hết hạn thì thẻ trạng thái bên cạnh đã ghi "Hết hạn ủy quyền": không ghi lại ở dòng này */}
                {han && !han.hetHan ? (
                  <span className="flex items-center whitespace-nowrap tabular-nums">
                    <DauCach />
                    Ủy quyền đến {ngayThang(han.han, { coNam: true })}
                    {han.sapHet ? <span className="ml-1 font-medium text-bo-warning">({conLaiUyQuyen(han)})</span> : null}
                  </span>
                ) : null}
              </p>
            </div>
            {/* Vùng thông báo luôn có sẵn (rỗng thì không chiếm chỗ) để trình đọc màn hình đọc kết quả kiểm tra */}
            <p role="status" className={ketQuaKetNoi ? "mt-1" : undefined}>
              {ketQuaKetNoi ? (
                <TrangThaiCham label={ketQuaKetNoi.text} tone={ketQuaKetNoi.ok ? "success" : "danger"} className="whitespace-normal" />
              ) : null}
            </p>
          </div>
        </div>
        <span aria-hidden="true" className="hidden h-10 w-px bg-[#eef1f5] md:block" />
        <StatusBadge label={tinhTrang} />

        {/* Cụm bên phải: hẹp ngang thì cả cụm xuống hàng dưới, vẫn nằm bên phải */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
          <div className="flex items-center gap-3" title="Tắt để tạm dừng mọi việc tự động">
            <label htmlFor="dong-bo-gian-hang" className="cursor-pointer text-sm font-medium text-bo-heading">
              Đồng bộ với gian hàng này
            </label>
            <Switch
              id="dong-bo-gian-hang"
              checked={dongBoGianHang}
              onCheckedChange={onDoiDongBo}
              disabled={khoa}
              aria-describedby="dong-bo-gian-hang-mo-ta"
              className={cn(SWITCH_CLASS, VUNG_CHAM_CONG_TAC)}
            />
            <span id="dong-bo-gian-hang-mo-ta" className="sr-only">
              Tắt để tạm dừng mọi việc tự động.
            </span>
          </div>
          <span aria-hidden="true" className="hidden h-10 w-px bg-[#eef1f5] md:block" />

          <div className="flex shrink-0 items-center gap-1">
            {/* Hết hạn: kiểm tra kết nối chắc chắn không qua; việc cần làm là Ủy quyền lại (trang Cấu hình không có
                thanh nhắc, thẻ này là chỗ nhắc duy nhất) */}
            {hetHan ? (
              <Button
                type="button"
                disabled={khoa}
                onClick={onUyQuyenLai}
                className="h-8 gap-2 rounded-lg bg-bo-primary px-3 text-[13px] text-white hover:bg-bo-primary-hover max-sm:h-11"
              >
                {dangChay === "uy-quyen" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                {dangChay === "uy-quyen" ? `Đang mở trang ${san.ten}…` : "Ủy quyền lại"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={khoa}
                onClick={onKiemTra}
                className="h-8 gap-2 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
              >
                {dangChay === "kiem-tra" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                Kiểm tra kết nối
              </Button>
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={nutMenuRef}
                  type="button"
                  variant="ghost"
                  disabled={khoa}
                  aria-label="Thao tác khác với gian hàng"
                  className="size-8 rounded-lg p-0 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground max-sm:size-11"
                >
                  {dangChay === "uy-quyen" || dangChay === "ngat" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-50 w-72 max-w-[calc(100vw-32px)] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                onCloseAutoFocus={(event) => {
                  const viec = viecSauMenuRef.current;
                  if (!viec) return;
                  viecSauMenuRef.current = null;
                  event.preventDefault();
                  nutMenuRef.current?.focus();
                  viec();
                }}
              >
                <DropdownMenuItem onSelect={onUyQuyenLai} className={MUC_MENU}>
                  <NoiDungMuc icon={ShieldCheck} nhan="Ủy quyền lại" moTa={`Mở lại trang đồng ý của ${san.ten}, giữ nguyên cấu hình.`} />
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={sauKhiDongMenu(onCapNhatKhoa)} className={MUC_MENU}>
                  <NoiDungMuc icon={KeyRound} nhan="Cập nhật khóa ứng dụng" moTa={noiDung?.coServiceId ? "App Key, App Secret, Service ID." : "App Key, App Secret."} />
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={MUC_MENU}>
                  <Link to={`${san.duongDan}/setup?buoc=1`}>
                    <NoiDungMuc icon={ListRestart} nhan="Chạy lại trình thiết lập" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-bo-border" />
                <DropdownMenuItem onSelect={sauKhiDongMenu(onNgatKetNoi)} className={cn(MUC_MENU, "focus:bg-bo-danger-soft")}>
                  <NoiDungMuc icon={Unplug} nhan="Ngắt kết nối" moTa="Xóa ủy quyền đã lưu, giữ liên kết sản phẩm và đơn đã nhận." nguyHiem />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </TheCaiDat>
  );
}
