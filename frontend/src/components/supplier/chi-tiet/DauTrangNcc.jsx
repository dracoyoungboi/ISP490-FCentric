import { ArrowLeft, CircleCheck, CirclePause, Ellipsis, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import NutSaoChep from "@/components/shared/NutSaoChep";
import StatusBadge from "@/components/shared/StatusBadge";
import { laHoatDong } from "@/components/supplier/quyTacNhaCungCap";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const MUC_MENU = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/**
 * Đầu khối của màn Chi tiết nhà cung cấp (bản một khối, chốt 17/10/2026):
 * nút quay lại, tên + trạng thái, dòng phụ là mã nhà cung cấp kèm nút sao chép.
 * Mỗi thông tin chỉ ở một chỗ (chốt 19/10/2026): người liên hệ nằm ở mục Liên hệ, ngày tạo / cập nhật ở cột phải.
 *
 * Thao tác (chỉ vai trò quản lý nhà cung cấp): ⋯ và nút chính Chỉnh sửa. Menu ⋯ (vị trí 2 đã chốt):
 * Ngừng hoạt động / Cho phép hoạt động (kèm một dòng hệ quả), vạch ngăn, Xóa.
 * Xóa theo `trangThaiXoa` (trang cha hỏi máy chủ): "khong" (đã có giao dịch) và "dang-kiem-tra" thì ẩn,
 * "duoc" thì hiện, "chua-ro" (kiểm tra lỗi) vẫn hiện để hộp thoại xóa tự kiểm tra lại.
 * Điện thoại: hai nút lớn Gọi và Gửi email, Chỉnh sửa chuyển vào ⋯.
 * Màn tự vẽ tiêu đề nên phải "nhận" tiêu đề để layout không vẽ thêm tiêu đề dự phòng.
 */
export default function DauTrangNcc({ ncc, coTheQuanLy, trangThaiXoa, onQuayLai, onChinhSua, onDoiTrangThai, onXoa }) {
  useClaimPageTitle(true);

  const dangHoatDong = laHoatDong(ncc);
  const hienXoa = trangThaiXoa === "duoc" || trangThaiXoa === "chua-ro";

  const soDienThoai = ncc.soDienThoai?.trim();
  const email = ncc.email?.trim();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex min-w-0 flex-1 basis-80 items-start gap-3.5 sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onQuayLai}
          aria-label="Quay lại"
          title="Quay lại"
          className={`shrink-0 ${NUT_VIEN}`}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            {/* Tên dài: điện thoại cho xuống 2 dòng thay vì cắt "…" */}
            <PageHeading className="max-sm:line-clamp-2 max-sm:whitespace-normal">
              <span title={ncc.tenNhaCungCap || undefined}>{ncc.tenNhaCungCap || ncc.maNhaCungCap || "—"}</span>
            </PageHeading>
            <StatusBadge doiTuong="nguoi" size="lg" label={dangHoatDong ? "Hoạt động" : "Ngừng hoạt động"} />
          </div>
          {ncc.maNhaCungCap ? (
            <p className="mt-0.5 flex items-center gap-0.5 text-[13px] leading-5 text-bo-muted">
              <span className="font-mono font-semibold text-slate-700">{ncc.maNhaCungCap}</span>
              <NutSaoChep giaTri={ncc.maNhaCungCap} nhan="Sao chép mã nhà cung cấp" className="size-6" />
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full">
        {/* Điện thoại: liên hệ là việc hay làm nhất, nên đưa ra hai nút lớn */}
        {soDienThoai ? (
          <Button asChild variant="outline" className={`h-11 flex-1 gap-1.5 sm:hidden ${NUT_VIEN}`}>
            <a href={`tel:${soDienThoai}`}>
              <Phone className="size-4" aria-hidden="true" />
              Gọi
            </a>
          </Button>
        ) : null}
        {email ? (
          <Button asChild variant="outline" className={`h-11 flex-1 gap-1.5 sm:hidden ${NUT_VIEN}`}>
            <a href={`mailto:${email}`}>
              <Mail className="size-4" aria-hidden="true" />
              Gửi email
            </a>
          </Button>
        ) : null}

        {coTheQuanLy ? (
          <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Thao tác khác"
                  title="Thao tác khác"
                  className={`max-sm:size-11 ${NUT_VIEN}`}
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-50 w-[272px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
              >
                <DropdownMenuItem onClick={onChinhSua} className={`${MUC_MENU} sm:hidden`}>
                  <Pencil className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                  Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDoiTrangThai} className={MUC_MENU}>
                  {dangHoatDong ? (
                    <CirclePause className="mt-0.5 size-4 text-bo-warning" aria-hidden="true" />
                  ) : (
                    <CircleCheck className="mt-0.5 size-4 text-bo-success" aria-hidden="true" />
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-bo-foreground">
                      {dangHoatDong ? "Ngừng hoạt động" : "Cho phép hoạt động"}
                    </span>
                    <span className="text-xs leading-4 text-bo-muted">
                      {dangHoatDong
                        ? "Không được chọn khi gửi yêu cầu báo giá mới"
                        : "Được chọn lại khi gửi yêu cầu báo giá"}
                    </span>
                  </span>
                </DropdownMenuItem>
                {hienXoa ? (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-bo-border" />
                    <DropdownMenuItem onClick={onXoa} className={`${MUC_MENU} focus:bg-bo-danger-soft`}>
                      <Trash2 className="mt-0.5 size-4 text-bo-danger" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium text-bo-danger">Xóa nhà cung cấp</span>
                        <span className="text-xs leading-4 text-bo-muted">
                          {trangThaiXoa === "duoc"
                            ? "Chưa có giao dịch · xóa xong không khôi phục được"
                            : "Chỉ xóa được khi chưa có giao dịch"}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              onClick={onChinhSua}
              className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:hidden"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Chỉnh sửa
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
