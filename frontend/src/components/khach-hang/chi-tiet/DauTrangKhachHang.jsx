import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleCheck, CirclePause, Copy, Ellipsis, FilePlus2, Mail, Pencil, Phone } from "lucide-react";
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
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import useSaoChep from "@/hooks/useSaoChep";
import { formatDate } from "@/utils/formatters";
import { laHoatDong, nhanLoaiKhach } from "./tinhKhachHang";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const MUC_MENU = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/**
 * Đầu khối của màn Chi tiết khách hàng (bản một khối, chốt 18/10/2026): nút quay lại, tên + trạng thái,
 * dòng phụ (mã + nút sao chép · loại khách · khách từ ngày tạo).
 *
 * Thao tác theo quyền (backend vẫn là chốt chặn thật):
 * - `coTheSua` (quản trị viên, quản lý kho, NV bán hàng): Chỉnh sửa, Ngừng / Cho phép hoạt động (trong ⋯, kèm một dòng hệ quả).
 * - `coTheTaoBaoGia` (quản trị viên, NV bán hàng) và khách đang hoạt động: nút chính Tạo báo giá — đơn bán được tạo
 *   từ báo giá khách đồng ý (tab Báo giá có "Tạo đơn bán" ở từng báo giá chờ phản hồi).
 * Điện thoại: hai nút lớn Gọi và Gửi email; Chỉnh sửa, Tạo báo giá chuyển vào ⋯.
 * Màn tự vẽ tiêu đề nên phải "nhận" tiêu đề để layout không vẽ thêm tiêu đề dự phòng.
 */
export default function DauTrangKhachHang({
  khachHang,
  coTheSua,
  coTheTaoBaoGia,
  onQuayLai,
  onChinhSua,
  onDoiTrangThai,
  onTaoBaoGia,
}) {
  useClaimPageTitle(true);

  const dangHoatDong = laHoatDong(khachHang);
  const hienTaoBaoGia = coTheTaoBaoGia && dangHoatDong;
  const coMenu = coTheSua || hienTaoBaoGia;
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
      await saoChep(khachHang.maKhachHang, { nhan: "Sao chép mã khách hàng" });
      return;
    }
    suKien.preventDefault(); // giữ menu mở để người dùng thấy "Đã sao chép"
    if (await saoChep(khachHang.maKhachHang)) {
      clearTimeout(henDongMenu.current);
      henDongMenu.current = setTimeout(() => doiMenu(false), CAU_HINH_THONG_BAO_NHANH.dongMenuSauSaoChep);
    }
  };

  const soDienThoai = khachHang.soDienThoai?.trim();
  const email = khachHang.email?.trim();
  const loai = nhanLoaiKhach(khachHang.loaiKhachHang);

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
              <span title={khachHang.tenKhachHang || undefined}>{khachHang.tenKhachHang || khachHang.maKhachHang || "—"}</span>
            </PageHeading>
            <StatusBadge doiTuong="nguoi" size="lg" label={dangHoatDong ? "Hoạt động" : "Ngừng hoạt động"} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-6 text-bo-muted">
            {khachHang.maKhachHang ? (
              <span className="inline-flex items-center">
                <span className="font-mono font-semibold text-slate-700">{khachHang.maKhachHang}</span>
                <NutSaoChep giaTri={khachHang.maKhachHang} nhan="Sao chép mã khách hàng" className="ml-0.5 size-6" />
              </span>
            ) : null}
            {/* Điện thoại: loại khách xuống dòng riêng, không mở đầu dòng bằng dấu "·" */}
            <span className="max-sm:basis-full">
              {khachHang.maKhachHang ? <span className="max-sm:hidden">· </span> : null}
              {loai ?? "Chưa phân loại"}
              {khachHang.ngayTao ? ` · khách từ ${formatDate(khachHang.ngayTao)}` : ""}
            </span>
          </p>
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

        {coMenu ? (
          <DropdownMenu modal={false} open={moMenu} onOpenChange={doiMenu}>
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
              className="z-50 w-[288px] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
            >
              {hienTaoBaoGia ? (
                <DropdownMenuItem onClick={onTaoBaoGia} className={`${MUC_MENU} sm:hidden`}>
                  <FilePlus2 className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                  Tạo báo giá
                </DropdownMenuItem>
              ) : null}
              {coTheSua ? (
                <DropdownMenuItem onClick={onChinhSua} className={`${MUC_MENU} sm:hidden`}>
                  <Pencil className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                  Chỉnh sửa
                </DropdownMenuItem>
              ) : null}
              {khachHang.maKhachHang ? (
                <DropdownMenuItem onSelect={saoChepMa} className={MUC_MENU}>
                  {daChep ? (
                    <>
                      <Check className="mt-0.5 size-4 text-bo-success" strokeWidth={2.5} aria-hidden="true" />
                      <span className="text-bo-success">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                      Sao chép mã khách hàng
                    </>
                  )}
                </DropdownMenuItem>
              ) : null}
              {coTheSua ? (
                <>
                  <DropdownMenuSeparator className="my-1 bg-bo-border" />
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
                          ? "Không chọn được khi tạo báo giá và bán tại quầy. Lịch sử giữ nguyên."
                          : "Chọn lại được khi tạo báo giá và bán tại quầy."}
                      </span>
                    </span>
                  </DropdownMenuItem>
                </>
              ) : null}
              <span className="sr-only" aria-live="polite">
                {daChep ? "Đã sao chép mã khách hàng" : ""}
              </span>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {coTheSua ? (
          <Button type="button" variant="outline" onClick={onChinhSua} className={`gap-1.5 max-sm:hidden ${NUT_VIEN}`}>
            <Pencil className="size-4" aria-hidden="true" />
            Chỉnh sửa
          </Button>
        ) : null}
        {hienTaoBaoGia ? (
          <Button
            type="button"
            onClick={onTaoBaoGia}
            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:hidden"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            Tạo báo giá
          </Button>
        ) : null}
      </div>
    </header>
  );
}
