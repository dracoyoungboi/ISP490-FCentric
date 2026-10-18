import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Ellipsis, KeyRound, Lock, LockOpen, ShieldCheck } from "lucide-react";
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
import StatusBadge from "@/components/shared/StatusBadge";
import UserAvatar from "@/components/UserAvatar";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import useSaoChep from "@/hooks/useSaoChep";
import { QUAN_TRI_VIEN, canKho, tenVaiTro } from "@/components/nguoi-dung/phanQuyen";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const MUC_MENU =
  "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/** Phần kho trên dòng phụ dưới tên: "Kho tổng", "mọi kho", "chưa có kho"… */
function khoNgan(nguoiDung, pq) {
  if (nguoiDung.vaiTro === QUAN_TRI_VIEN) return "mọi kho";
  if (!canKho(nguoiDung.vaiTro)) return "không dùng kho";
  return pq?.kho ? pq.kho.tenKho || pq.kho.maKho : "chưa có kho";
}

/**
 * Đầu khối của Chi tiết người dùng (PA2, chốt 18/10/2026): nút quay lại, ảnh đại diện, tên + trạng thái,
 * dòng phụ (@tên đăng nhập · vai trò · kho). Thao tác: ⋯ (Cấp lại mật khẩu, Sao chép tên đăng nhập,
 * Khóa / Mở khóa) và nút chính Phân quyền. Tài khoản của chính mình: không tự khóa, không tự phân quyền.
 */
export default function DauTrangNguoiDung({ nguoiDung, pq, laChinhMinh, onQuayLai, onPhanQuyen, onCapLaiMatKhau, onKhoaMoKhoa }) {
  useClaimPageTitle(true);

  const dangHoatDong = Number(nguoiDung.trangThai) === 1;
  const email = nguoiDung.email?.trim() || "";
  const [moMenu, setMoMenu] = useState(false);
  const { daChep, saoChep, quenDaChep, taiCho } = useSaoChep();
  const henDongMenu = useRef(0);

  useEffect(() => () => clearTimeout(henDongMenu.current), []);

  const doiMenu = (mo) => {
    clearTimeout(henDongMenu.current);
    if (!mo) quenDaChep();
    setMoMenu(mo);
  };

  const saoChepTen = async (suKien) => {
    if (!taiCho) {
      await saoChep(nguoiDung.tenDangNhap, { nhan: "Sao chép tên đăng nhập" });
      return;
    }
    suKien.preventDefault(); // giữ menu mở để người dùng thấy "Đã sao chép"
    if (await saoChep(nguoiDung.tenDangNhap)) {
      clearTimeout(henDongMenu.current);
      henDongMenu.current = setTimeout(() => doiMenu(false), CAU_HINH_THONG_BAO_NHANH.dongMenuSauSaoChep);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex min-w-0 flex-1 basis-80 items-center gap-3.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onQuayLai}
          aria-label="Quay lại danh sách"
          title="Quay lại danh sách"
          className={`shrink-0 ${NUT_VIEN}`}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <UserAvatar
          userId={nguoiDung.id}
          name={nguoiDung.hoTen}
          avatarUrl={nguoiDung.avatarUrl}
          className="size-11 shrink-0 max-sm:hidden"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <PageHeading className="max-sm:line-clamp-2 max-sm:whitespace-normal">
              <span title={nguoiDung.hoTen || undefined}>{nguoiDung.hoTen || nguoiDung.tenDangNhap || "—"}</span>
            </PageHeading>
            <StatusBadge size="lg" label={dangHoatDong ? "Hoạt động" : "Bị khóa"} />
          </div>
          <p className="mt-0.5 break-words text-[13px] leading-5 text-bo-muted">
            {nguoiDung.tenDangNhap ? (
              <span className="font-mono font-semibold text-slate-700">@{nguoiDung.tenDangNhap}</span>
            ) : null}
            {` · ${tenVaiTro(nguoiDung.vaiTro)} · ${khoNgan(nguoiDung, pq)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full">
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
          <DropdownMenuContent align="end" className="z-50 w-[300px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
            <DropdownMenuItem onClick={onCapLaiMatKhau} disabled={!email} className={MUC_MENU}>
              <KeyRound className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-bo-foreground">Cấp lại mật khẩu</span>
                <span className="break-all text-xs leading-4 text-bo-muted">
                  {email ? `Gửi mật khẩu tạm thời mới tới ${email}` : "Tài khoản chưa có email nên không gửi được"}
                </span>
              </span>
            </DropdownMenuItem>
            {nguoiDung.tenDangNhap ? (
              <DropdownMenuItem onSelect={saoChepTen} className={MUC_MENU}>
                {daChep ? (
                  <>
                    <Check className="mt-0.5 size-4 text-bo-success" strokeWidth={2.5} aria-hidden="true" />
                    <span className="text-bo-success">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                    Sao chép tên đăng nhập
                  </>
                )}
              </DropdownMenuItem>
            ) : null}
            {!laChinhMinh ? (
              <>
                <DropdownMenuSeparator className="my-1 bg-bo-border" />
                <DropdownMenuItem
                  onClick={onKhoaMoKhoa}
                  className={`${MUC_MENU} ${dangHoatDong ? "focus:bg-bo-danger-soft" : ""}`}
                >
                  {dangHoatDong ? (
                    <Lock className="mt-0.5 size-4 text-bo-danger" aria-hidden="true" />
                  ) : (
                    <LockOpen className="mt-0.5 size-4 text-bo-success" aria-hidden="true" />
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`font-medium ${dangHoatDong ? "text-bo-danger" : "text-bo-foreground"}`}>
                      {dangHoatDong ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                    </span>
                    <span className="text-xs leading-4 text-bo-muted">
                      {dangHoatDong
                        ? "Không đăng nhập được · phiếu và lịch sử giữ nguyên"
                        : "Người dùng đăng nhập lại được"}
                    </span>
                  </span>
                </DropdownMenuItem>
              </>
            ) : null}
            <span className="sr-only" aria-live="polite">
              {daChep ? "Đã sao chép tên đăng nhập" : ""}
            </span>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Nút bị tắt không nhận chuột (pointer-events-none) nên lý do đặt ở span bọc ngoài */}
        <span
          className="inline-flex max-sm:flex-1"
          title={laChinhMinh ? "Bạn không tự phân quyền cho chính mình được" : undefined}
        >
          <Button
            type="button"
            onClick={onPhanQuyen}
            disabled={laChinhMinh}
            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover max-sm:h-11 max-sm:flex-1"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            Phân quyền
          </Button>
        </span>
      </div>
    </header>
  );
}
