import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Copy, Lock, Pencil, ShieldCheck, Warehouse } from "lucide-react";

import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorModal from "@/components/AvatarEditorModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import ChinhSuaHoSoModal from "@/components/nguoi-dung/ho-so/ChinhSuaHoSoModal";
import QuyenCuaToi from "@/components/nguoi-dung/ho-so/QuyenCuaToi";
import ThietBiDangNhap from "@/components/nguoi-dung/ho-so/ThietBiDangNhap";
import { QUAN_TRI_VIEN, goiYHoSo, khoCuaToiNgan, ngayGio, ngayNgan, tenVaiTro } from "@/components/nguoi-dung/phanQuyen";
import { companyProfileService } from "@/services/companyProfileService";
import useSaoChep from "@/hooks/useSaoChep";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const NHAN = "flex items-center gap-1 text-[12.5px] leading-[18px] text-bo-muted";
const NUT_CHU = "rounded text-[13px] font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40";

const KIEU_GOI_Y = {
  cam: "border-orange-200 bg-orange-50 text-orange-950",
  xanh: "border-blue-200 bg-blue-50 text-blue-950",
};


function KhoaNho() {
  return (
    <span title="Không đổi được" className="inline-flex">
      <Lock className="size-3" aria-hidden="true" />
      <span className="sr-only">(không đổi được)</span>
    </span>
  );
}

/** Số điện thoại 10 số hiển thị dạng 0987 654 321 cho dễ đọc; số khác giữ nguyên. */
const sdtDeDoc = (sdt) => String(sdt ?? "").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");

/** Một dòng thuộc tính ở cột Tài khoản: nhãn trên, giá trị dưới. */
function ThuocTinh({ nhan, khoa, children }) {
  return (
    <div className="group min-w-0 px-5 py-2">
      <dt className={NHAN}>
        {nhan}
        {khoa ? <KhoaNho /> : null}
      </dt>
      <dd className="m-0 mt-0.5 flex min-h-[26px] min-w-0 items-center gap-1.5 text-sm leading-5 text-bo-foreground">{children}</dd>
    </div>
  );
}

/** Nút sao chép cạnh giá trị: hiện khi rê chuột vào dòng (máy cảm ứng, điện thoại thì luôn hiện). */
function NutChep({ nhan, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={nhan}
      title="Sao chép"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted opacity-0 outline-none transition-opacity hover:bg-slate-100 hover:text-bo-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-bo-primary/40 group-hover:opacity-100 max-sm:size-9 max-sm:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <Copy className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/** Thanh gợi ý ở đầu trang: mỗi lần một việc, kèm một nút làm ngay. */
function ThanhGoiY({ kieu, tieuDe, noiDung, nut }) {
  return (
    <div className="px-4 pb-4 sm:px-6">
      <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5 text-[13px] leading-[19px]", KIEU_GOI_Y[kieu])}>
        <span className="min-w-60 flex-1">
          <b className="font-semibold">{tieuDe}</b> {noiDung}
        </span>
        {nut}
      </div>
    </div>
  );
}

/**
 * Hồ sơ của tôi (route /profile, chốt PA5 ngày 31/10/2026, mẫu chung cho 5 vai trò): một khối gồm
 * - đầu khối: ảnh đại diện (bấm để đổi), họ tên, vai trò và nơi làm việc, nút Chỉnh sửa (mở hộp sửa họ tên, số điện thoại);
 * - thanh gợi ý khi có việc phải làm ngay (mật khẩu tạm, quyền vừa đổi);
 * - cột chính: Thiết bị đang đăng nhập, Quyền của tôi; cột phải: thuộc tính tài khoản (khung hẹp thì xuống dưới);
 * - quản trị viên: không có mục Quyền (đầu trang ghi "Toàn quyền trên mọi kho"), trang một cột: Tài khoản rồi Thiết bị.
 * Chỉ sửa được họ tên và số điện thoại; tên đăng nhập và email không đổi được (máy chủ cũng chặn).
 */
export default function UserDetail() {
  useClaimPageTitle(true);
  const navigate = useNavigate();
  const { saoChep } = useSaoChep();

  const hoSoQ = useTaiDuLieu(async () => {
    const res = await nguoiDungService.getMe();
    if (!res?.data) throw new Error("Không đọc được dữ liệu người dùng");
    return res.data;
  }, "");
  const quyenQ = useTaiDuLieu(() => nguoiDungService.getMyPermissions(), "");
  // Email liên hệ của công ty (Cấu hình → Thông tin công ty) cho các liên kết "Liên hệ quản trị viên"
  const congTyQ = useTaiDuLieu(() => companyProfileService.get(), "");

  const [moSua, setMoSua] = useState(false);
  const [oDauTien, setODauTien] = useState("ho-ten");
  const [moAnh, setMoAnh] = useState(false);
  const [moMatKhau, setMoMatKhau] = useState(false);
  // Đổi mật khẩu thì máy chủ đăng xuất các thiết bị khác: tăng khóa để mục Thiết bị tải lại
  const [lanDoiMatKhau, setLanDoiMatKhau] = useState(0);

  const hoSo = hoSoQ.data;
  const quyen = quyenQ.data;

  if (hoSoQ.error && !hoSo) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
          <ErrorState
            title="Không tải được hồ sơ"
            description={getApiErrorMessage(hoSoQ.error, "Kiểm tra kết nối rồi thử lại.")}
            onRetry={hoSoQ.reload}
          />
        </div>
      </PageContainer>
    );
  }
  if (!hoSo) {
    return (
      <PageContainer>
        <LoadingState label="Đang tải hồ sơ" />
      </PageContainer>
    );
  }

  const emailLienHe = congTyQ.data?.email?.trim() || "";
  // Quản trị viên: không có mục Quyền, đầu trang ghi luôn phạm vi "Toàn quyền trên mọi kho"
  const laQuanTri = hoSo.vaiTro === QUAN_TRI_VIEN || Boolean(quyen?.toanQuyen);
  const khoNgan = laQuanTri
    ? "Toàn quyền trên mọi kho"
    : khoCuaToiNgan({ vaiTro: hoSo.vaiTro, quyen, khoTuHoSo: hoSo.khoPhuTrachActive?.[0] ?? null });

  const moChinhSua = (o = "ho-ten") => {
    setODauTien(o);
    setMoSua(true);
  };

  // Các dòng của mục Tài khoản: quản trị viên hiện thành một mục trải ngang, vai trò khác ở cột phải
  const truongTaiKhoan = (
    <>
      <ThuocTinh nhan="Tên đăng nhập" khoa>
        <span className="truncate font-mono text-[13.5px]" title={hoSo.tenDangNhap}>
          {hoSo.tenDangNhap}
        </span>
        <NutChep nhan="Sao chép tên đăng nhập" onClick={() => saoChep(hoSo.tenDangNhap, { nhan: "Sao chép tên đăng nhập" })} />
      </ThuocTinh>
      <ThuocTinh nhan="Email" khoa>
        {hoSo.email ? (
        <>
            <span className="truncate" title={hoSo.email}>
              {hoSo.email}
            </span>
            <NutChep nhan="Sao chép email" onClick={() => saoChep(hoSo.email, { nhan: "Sao chép email" })} />
        </>
      ) : (
        <span className="text-bo-muted">Chưa có</span>
      )}
    </ThuocTinh>
    <ThuocTinh nhan="Số điện thoại">
      {hoSo.soDienThoai ? (
        <span className="truncate tabular-nums">{sdtDeDoc(hoSo.soDienThoai)}</span>
      ) : (
        <button type="button" onClick={() => moChinhSua("so-dien-thoai")} className={NUT_CHU}>
          + Thêm số điện thoại
        </button>
      )}
    </ThuocTinh>
    <ThuocTinh nhan="Mật khẩu">
      {hoSo.mustChangePassword ? (
        <span className="inline-flex h-5 items-center rounded-[5px] bg-bo-tt-chu-y px-1.5 text-xs font-semibold text-bo-tt-chu-y-chu">
          Tạm thời · cần đổi
        </span>
      ) : (
        <span aria-label="Đã đặt mật khẩu" className="tracking-[0.12em] text-bo-foreground">
          ••••••••
        </span>
      )}
      <button type="button" onClick={() => setMoMatKhau(true)} className={cn(NUT_CHU, "shrink-0", laQuanTri ? "ml-3" : "ml-auto")}>
        Đổi mật khẩu
      </button>
    </ThuocTinh>
    </>
  );
  const truongNgay = (
    <>
      {hoSo.ngayTao ? <ThuocTinh nhan="Tạo tài khoản">{ngayNgan(hoSo.ngayTao)}</ThuocTinh> : null}
      {hoSo.ngayCapNhat ? <ThuocTinh nhan="Cập nhật hồ sơ">{ngayNgan(hoSo.ngayCapNhat)}</ThuocTinh> : null}
    </>
  );

  const dangNhapLai = () => {
    nguoiDungService.logout();
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  // Thanh gợi ý chỉ cho việc phải làm ngay VÀ làm được ngay trên trang này (chốt 31/10/2026): mật khẩu tạm, quyền vừa đổi.
  // Hiệu lực quyền sắp hết: chỉ chữ cam ở mục Quyền của tôi (người dùng không tự gia hạn được).
  // Chưa có số điện thoại: ô "+ Thêm số điện thoại" ở cột Tài khoản.
  const loaiGoiY = goiYHoSo({ hoSo, quyen });
  let goiY = null;
  if (loaiGoiY === "mat_khau_tam") {
    goiY = {
      kieu: "cam",
      tieuDe: "Bạn đang dùng mật khẩu tạm thời.",
      noiDung: "Đổi sang mật khẩu riêng để bảo vệ tài khoản.",
      nut: (
        <Button type="button" variant="outline" size="sm" onClick={() => setMoMatKhau(true)} className={NUT_VIEN}>
          Đổi mật khẩu
        </Button>
      ),
    };
  } else if (loaiGoiY === "quyen_vua_doi") {
    goiY = {
      kieu: "xanh",
      tieuDe: `Quyền của bạn vừa được cập nhật${quyen?.capNhatLuc ? ` lúc ${ngayGio(quyen.capNhatLuc)}` : ""}.`,
      noiDung: "Đăng nhập lại để dùng quyền mới.",
      nut: (
        <Button type="button" variant="outline" size="sm" onClick={dangNhapLai} className={NUT_VIEN}>
          Đăng nhập lại
        </Button>
      ),
    };
  }

  return (
    <PageContainer>
      <article className="@container overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={() => setMoAnh(true)}
            aria-label="Đổi ảnh đại diện"
            title="Đổi ảnh đại diện"
            className="group/anh relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-bo-primary focus-visible:ring-offset-2"
          >
            <UserAvatar userId={hoSo.id} name={hoSo.hoTen || hoSo.tenDangNhap} avatarUrl={hoSo.avatarUrl} size="md" />
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-bo-heading/50 text-white opacity-0 transition-opacity group-hover/anh:opacity-100 group-focus-visible/anh:opacity-100"
            >
              <Camera className="size-5" />
            </span>
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-bo-foreground text-white"
            >
              <Camera className="size-3" />
            </span>
          </button>
          <div className="min-w-0 flex-1 basis-56">
            <PageHeading className="max-sm:line-clamp-2 max-sm:whitespace-normal">
              <span title={hoSo.hoTen || undefined}>{hoSo.hoTen || hoSo.tenDangNhap || "—"}</span>
            </PageHeading>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] leading-5 text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-[15px] text-bo-primary" aria-hidden="true" />
                {tenVaiTro(hoSo.vaiTro)}
              </span>
              {khoNgan ? (
                <span className="inline-flex items-center gap-1.5">
                  <Warehouse className="size-[15px] text-bo-muted" aria-hidden="true" />
                  {khoNgan}
                </span>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => moChinhSua()} className={cn("max-sm:h-10", NUT_VIEN)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Chỉnh sửa
          </Button>
        </header>

        {goiY ? <ThanhGoiY {...goiY} /> : null}

        {laQuanTri ? (
          // Quản trị viên không có mục Quyền: một cột, Tài khoản thành một mục trải ngang rồi tới Thiết bị
          <div className="divide-y divide-slate-100 border-t border-bo-border">
            <section aria-labelledby="ho-so-tai-khoan" className="px-4 py-5 sm:px-6 sm:py-[22px]">
              <h2 id="ho-so-tai-khoan" className="text-[15px] font-semibold leading-[22px] text-bo-foreground">
                Tài khoản
              </h2>
              <dl className="m-0 -mx-5 mt-2 grid @xl:grid-cols-2 @4xl:grid-cols-3">{truongTaiKhoan}{truongNgay}</dl>
            </section>
            <ThietBiDangNhap khoaTaiLai={lanDoiMatKhau} />
          </div>
        ) : (
          <div className="grid border-t border-bo-border @5xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 divide-y divide-slate-100">
              <ThietBiDangNhap khoaTaiLai={lanDoiMatKhau} />
              <QuyenCuaToi
                vaiTro={hoSo.vaiTro}
                quyen={quyen}
                dangTai={quyenQ.loading}
                loi={quyenQ.error}
                onThuLai={quyenQ.reload}
                emailLienHe={emailLienHe}
              />
            </div>

            <aside aria-labelledby="ho-so-tai-khoan" className="border-t border-bo-border bg-bo-surface-subtle/70 pb-3 @5xl:border-l @5xl:border-t-0">
              <h2 id="ho-so-tai-khoan" className="px-5 pb-1.5 pt-[18px] text-xs font-semibold uppercase tracking-[0.04em] text-bo-muted">
                Tài khoản
              </h2>
              <dl className="m-0 grid @xl:@max-5xl:grid-cols-2">{truongTaiKhoan}</dl>
              <div className="mx-5 my-2 border-t border-slate-200/80" />
              <dl className="m-0 grid @xl:@max-5xl:grid-cols-2">{truongNgay}</dl>
            </aside>
          </div>
        )}
      </article>

      <ChinhSuaHoSoModal
        open={moSua}
        onOpenChange={setMoSua}
        hoSo={hoSo}
        oDauTien={oDauTien}
        onSaved={(dto) => hoSoQ.setData(dto)}
      />
      <AvatarEditorModal
        open={moAnh}
        onOpenChange={setMoAnh}
        userId={hoSo.id}
        userName={hoSo.hoTen}
        avatarUrl={hoSo.avatarUrl}
        onSaved={(dto) => hoSoQ.setData(dto)}
      />
      <ChangePasswordModal
        open={moMatKhau}
        onOpenChange={setMoMatKhau}
        tenDangNhap={hoSo.tenDangNhap}
        email={hoSo.email || ""}
        onSuccess={() => {
          toast.success("Đã đổi mật khẩu.");
          hoSoQ.reload();
          setLanDoiMatKhau((n) => n + 1);
        }}
      />
    </PageContainer>
  );
}
