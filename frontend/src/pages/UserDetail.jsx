import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Copy, KeyRound, Lock } from "lucide-react";

import { nguoiDungService } from "@/services/nguoiDungService";
import { companyProfileService } from "@/services/companyProfileService";
import { getApiErrorMessage } from "@/utils/apiError";
import { PHONE_ERROR_MESSAGE, getPhoneError, isPhoneValid, sanitizePhoneInput } from "@/utils/phoneValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorModal from "@/components/AvatarEditorModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import HangCoBieuTuong from "@/components/nguoi-dung/ho-so/HangCoBieuTuong";
import QuyenCuaToi from "@/components/nguoi-dung/ho-so/QuyenCuaToi";
import {
  goiYHoSo,
  hieuLucCuaToi,
  khoCuaToiNgan,
  mailtoLienHe,
  ngayGio,
  ngayNgan,
  tenVaiTro,
} from "@/components/nguoi-dung/phanQuyen";
import useSaoChep from "@/hooks/useSaoChep";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const NUT_CHINH = "bg-bo-primary text-white hover:bg-bo-primary-hover";
const O_NHAP =
  "h-9 w-full border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";
const NHAN = "flex items-center gap-1 text-[12.5px] leading-[18px] text-bo-muted";
const MUC = "border-b border-slate-100 py-5 sm:py-[22px]";

const KIEU_GOI_Y = {
  cam: "border-orange-200 bg-orange-50 text-orange-950",
  xanh: "border-blue-200 bg-blue-50 text-blue-950",
  xam: "border-bo-border bg-bo-surface-subtle text-slate-700",
};

/** Một ô của mục Thông tin cá nhân: nhãn trên, giá trị dưới. `khoa` = không đổi được (biểu tượng khóa cạnh nhãn). */
function O({ nhan, htmlFor, khoa, children }) {
  return (
    <div className="group min-w-0">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={NHAN}>
          {nhan}
        </label>
      ) : (
        <span className={NHAN}>
          {nhan}
          {khoa ? (
            <span title="Không đổi được" className="inline-flex">
              <Lock className="size-3" aria-hidden="true" />
              <span className="sr-only">(không đổi được)</span>
            </span>
          ) : null}
        </span>
      )}
      <div className="mt-1 flex min-h-[30px] min-w-0 items-center gap-1 text-sm leading-[22px] text-bo-foreground">{children}</div>
    </div>
  );
}

/** Nút sao chép cạnh giá trị: chỉ hiện khi rê chuột vào ô (máy cảm ứng, điện thoại thì luôn hiện). */
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

/** Thanh gợi ý ở đầu trang: chỉ khi có việc cần làm, mỗi lần một cái, kèm một nút làm ngay. */
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
 * Hồ sơ của tôi (route /profile, chốt 18/10/2026, mẫu chung cho 5 vai trò): một khối gồm đầu khối, thanh gợi ý,
 * Thông tin cá nhân (một nút Chỉnh sửa; Hủy/Lưu hiện đúng chỗ nút đó), Mật khẩu và Quyền của tôi.
 * Chỉ sửa được họ tên và số điện thoại; tên đăng nhập và email không đổi được (máy chủ cũng chặn).
 * Quyền đọc từ CSDL; quyền khác phiên đăng nhập thì nhắc đăng nhập lại. Không cần API mới.
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

  const [dangSua, setDangSua] = useState(false);
  const [nhap, setNhap] = useState({ hoTen: "", soDienThoai: "" });
  const [loi, setLoi] = useState({ hoTen: "", soDienThoai: "" });
  const [dangLuu, setDangLuu] = useState(false);
  const [oDauTien, setODauTien] = useState("ho-ten");
  const [moAnh, setMoAnh] = useState(false);
  const [moMatKhau, setMoMatKhau] = useState(false);
  const nutSuaRef = useRef(null);

  // Vào chế độ sửa: đặt con trỏ vào ô vừa chọn (bấm "Thêm số điện thoại" thì vào ô số điện thoại)
  useEffect(() => {
    if (dangSua) document.getElementById(oDauTien)?.focus();
  }, [dangSua, oDauTien]);

  const hoSo = hoSoQ.data;
  const quyen = quyenQ.data;

  if (hoSoQ.error && !hoSo) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
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
  const khoNgan = khoCuaToiNgan({ vaiTro: hoSo.vaiTro, quyen, khoTuHoSo: hoSo.khoPhuTrachActive?.[0] ?? null });
  const tenKho = quyen?.kho ? quyen.kho.tenKho || quyen.kho.maKho : "";

  const batSua = (o = "ho-ten") => {
    setNhap({ hoTen: hoSo.hoTen || "", soDienThoai: hoSo.soDienThoai || "" });
    setLoi({ hoTen: "", soDienThoai: "" });
    setODauTien(o);
    setDangSua(true);
  };
  const veNutSua = () => requestAnimationFrame(() => nutSuaRef.current?.focus());
  const huySua = () => {
    if (dangLuu) return;
    setDangSua(false);
    setLoi({ hoTen: "", soDienThoai: "" });
    veNutSua();
  };
  const chuan = (v) => (v ?? "").trim();
  const coThayDoi = chuan(nhap.hoTen) !== chuan(hoSo.hoTen) || chuan(nhap.soDienThoai) !== chuan(hoSo.soDienThoai);

  const luu = async () => {
    if (dangLuu) return;
    if (!coThayDoi) {
      huySua();
      return;
    }
    const loiMoi = {
      hoTen: chuan(nhap.hoTen) ? "" : "Họ và tên không được để trống.",
      soDienThoai: isPhoneValid(nhap.soDienThoai) ? "" : PHONE_ERROR_MESSAGE,
    };
    setLoi(loiMoi);
    if (loiMoi.hoTen || loiMoi.soDienThoai) return;
    setDangLuu(true);
    try {
      const res = await nguoiDungService.updateMe({
        hoTen: chuan(nhap.hoTen),
        soDienThoai: chuan(nhap.soDienThoai) || null,
      });
      if (!res?.data) throw new Error("Không đọc được dữ liệu trả về");
      hoSoQ.setData(res.data);
      setDangSua(false);
      toast.success("Đã cập nhật hồ sơ.");
      veNutSua();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không cập nhật được hồ sơ. Vui lòng thử lại."));
    } finally {
      setDangLuu(false);
    }
  };
  const phim = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      luu();
    } else if (e.key === "Escape") {
      e.preventDefault();
      huySua();
    }
  };

  const dangNhapLai = () => {
    nguoiDungService.logout();
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  const loiSdtTrucTiep = loi.soDienThoai || getPhoneError(nhap.soDienThoai);

  // Thanh gợi ý: mật khẩu tạm → quyền vừa đổi → hiệu lực sắp hết → chưa có số điện thoại
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
  } else if (loaiGoiY === "sap_het_hieu_luc") {
    const hl = hieuLucCuaToi(quyen?.ngayKetThuc);
    const href = mailtoLienHe(emailLienHe, `Đề nghị gia hạn quyền tại ${tenKho}`);
    goiY = {
      kieu: "cam",
      tieuDe: `Quyền tại ${tenKho} hết hiệu lực sau ${hl.conNgay} ngày (${hl.denNgay}).`,
      noiDung: "Liên hệ quản trị viên nếu cần gia hạn.",
      nut: href ? (
        <Button asChild variant="outline" size="sm" className={NUT_VIEN}>
          <a href={href}>Liên hệ quản trị viên</a>
        </Button>
      ) : null,
    };
  } else if (loaiGoiY === "chua_co_sdt") {
    goiY = {
      kieu: "xam",
      tieuDe: "Chưa có số điện thoại.",
      noiDung: "Thêm số để đăng nhập bằng số điện thoại.",
      nut: dangSua ? null : (
        <Button type="button" variant="outline" size="sm" onClick={() => batSua("so-dien-thoai")} className={NUT_VIEN}>
          Thêm số điện thoại
        </Button>
      ),
    };
  }

  const chanKhoi = [
    hoSo.ngayTao ? `Tạo tài khoản ${ngayNgan(hoSo.ngayTao)}` : "",
    hoSo.ngayCapNhat ? `Cập nhật hồ sơ ${ngayNgan(hoSo.ngayCapNhat)}` : "",
  ].filter(Boolean);

  return (
    <PageContainer>
      <article className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        {/* Đầu khối: vai trò và kho chỉ ghi một lần ở đây */}
        <header className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="relative shrink-0">
            <UserAvatar userId={hoSo.id} name={hoSo.hoTen} avatarUrl={hoSo.avatarUrl} size="md" />
            <button
              type="button"
              onClick={() => setMoAnh(true)}
              aria-label="Đổi ảnh đại diện"
              title="Đổi ảnh đại diện"
              className="absolute -bottom-0.5 -right-0.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-bo-foreground text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
            >
              <Camera className="size-3" aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0">
            {/* Không hiện thẻ trạng thái: tự xem hồ sơ thì luôn đang hoạt động (tài khoản bị khóa không đăng nhập được) */}
            <PageHeading className="max-sm:line-clamp-2 max-sm:whitespace-normal">
              <span title={hoSo.hoTen || undefined}>{hoSo.hoTen || hoSo.tenDangNhap || "—"}</span>
            </PageHeading>
            <p className="mt-0.5 break-words text-[13px] leading-5 text-bo-muted">
              <span className="font-mono font-semibold text-slate-700">@{hoSo.tenDangNhap}</span>
              {` · ${tenVaiTro(hoSo.vaiTro)}`}
              {khoNgan ? ` · ${khoNgan}` : ""}
            </p>
          </div>
        </header>

        {goiY ? <ThanhGoiY {...goiY} /> : null}

        <div className="border-t border-bo-border px-4 sm:px-6">
          {/* Thông tin cá nhân */}
          <section aria-labelledby="ho-so-thong-tin" className={MUC}>
            <div className="mb-3.5 flex min-h-9 flex-wrap items-center justify-between gap-3">
              <h2 id="ho-so-thong-tin" className="text-[15px] font-semibold leading-[22px] text-bo-foreground">
                Thông tin cá nhân
              </h2>
              {dangSua ? (
                // Hủy và Lưu thay đúng chỗ nút Chỉnh sửa, không nhảy xuống cuối mục
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={huySua} disabled={dangLuu} className={`max-sm:h-10 ${NUT_VIEN}`}>
                    Hủy
                  </Button>
                  <Button type="button" size="sm" onClick={luu} disabled={dangLuu || !coThayDoi} className={`max-sm:h-10 ${NUT_CHINH}`}>
                    {dangLuu ? "Đang lưu..." : "Lưu"}
                  </Button>
                </div>
              ) : (
                <Button ref={nutSuaRef} type="button" variant="outline" size="sm" onClick={() => batSua()} className={`max-sm:h-10 ${NUT_VIEN}`}>
                  Chỉnh sửa
                </Button>
              )}
            </div>

            <div className="@container">
              <div className="grid gap-x-8 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-4">
                <O nhan="Họ và tên" htmlFor={dangSua ? "ho-ten" : undefined}>
                  {dangSua ? (
                    <div className="w-full">
                      <Input
                        id="ho-ten"
                        value={nhap.hoTen}
                        maxLength={100}
                        autoComplete="name"
                        aria-invalid={Boolean(loi.hoTen)}
                        onKeyDown={phim}
                        onChange={(e) => {
                          setNhap((cu) => ({ ...cu, hoTen: e.target.value }));
                          setLoi((cu) => ({ ...cu, hoTen: "" }));
                        }}
                        className={cn(O_NHAP, loi.hoTen && "border-bo-danger")}
                      />
                      {loi.hoTen ? <p className="mt-1 text-xs text-bo-danger">{loi.hoTen}</p> : null}
                    </div>
                  ) : (
                    <span className="truncate" title={hoSo.hoTen || undefined}>
                      {hoSo.hoTen || "—"}
                    </span>
                  )}
                </O>

                <O nhan="Số điện thoại" htmlFor={dangSua ? "so-dien-thoai" : undefined}>
                  {dangSua ? (
                    <div className="w-full">
                      <Input
                        id="so-dien-thoai"
                        value={nhap.soDienThoai}
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={10}
                        placeholder="10 số, bắt đầu bằng 0"
                        aria-invalid={Boolean(loiSdtTrucTiep)}
                        onKeyDown={phim}
                        onChange={(e) => {
                          setNhap((cu) => ({ ...cu, soDienThoai: sanitizePhoneInput(e.target.value) }));
                          setLoi((cu) => ({ ...cu, soDienThoai: "" }));
                        }}
                        className={cn(O_NHAP, "tabular-nums", loiSdtTrucTiep && "border-bo-danger")}
                      />
                      {loiSdtTrucTiep ? (
                        <p className="mt-1 text-xs text-bo-danger">{loiSdtTrucTiep}</p>
                      ) : (
                        <p className="mt-1 text-xs text-bo-muted">Cũng dùng để đăng nhập. Để trống nếu không muốn lưu.</p>
                      )}
                    </div>
                  ) : hoSo.soDienThoai ? (
                    <span className="truncate tabular-nums">{hoSo.soDienThoai}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => batSua("so-dien-thoai")}
                      className="rounded text-sm font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                    >
                      + Thêm số điện thoại
                    </button>
                  )}
                </O>

                <O nhan="Email" khoa>
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
                </O>

                <O nhan="Tên đăng nhập" khoa>
                  <span className="truncate font-mono text-[13.5px]" title={hoSo.tenDangNhap}>
                    {hoSo.tenDangNhap}
                  </span>
                  <NutChep nhan="Sao chép tên đăng nhập" onClick={() => saoChep(hoSo.tenDangNhap, { nhan: "Sao chép tên đăng nhập" })} />
                </O>
              </div>
            </div>
          </section>

          {/* Mật khẩu: một hàng, lời nghiệp vụ; không nói cơ chế phiên hay token */}
          <section aria-labelledby="ho-so-mat-khau" className={MUC}>
            <HangCoBieuTuong
              icon={KeyRound}
              tieuDeId="ho-so-mat-khau"
              tieuDe={
                <>
                  Mật khẩu
                  {hoSo.mustChangePassword ? <StatusBadge label="Tạm thời" nhom="canChuY" /> : null}
                </>
              }
              moTa={
                hoSo.mustChangePassword
                  ? "Mật khẩu do quản trị viên cấp lúc tạo tài khoản."
                  : "Cập nhật mật khẩu để bảo vệ tài khoản của bạn."
              }
              hanhDong={
                <Button type="button" variant="outline" size="sm" onClick={() => setMoMatKhau(true)} className={`max-sm:h-10 max-sm:w-full ${NUT_VIEN}`}>
                  Đổi mật khẩu
                </Button>
              }
            />
          </section>

          <QuyenCuaToi
            vaiTro={hoSo.vaiTro}
            quyen={quyen}
            dangTai={quyenQ.loading}
            loi={quyenQ.error}
            onThuLai={quyenQ.reload}
            emailLienHe={emailLienHe}
          />
        </div>

        {chanKhoi.length ? (
          <footer className="border-t border-slate-100 bg-bo-surface-subtle px-4 py-3 text-[12.5px] leading-[18px] text-bo-muted sm:px-6">
            {chanKhoi.join(" · ")}
          </footer>
        ) : null}
      </article>

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
        onSuccess={() => {
          toast.success("Đã đổi mật khẩu.");
          hoSoQ.reload();
        }}
      />
    </PageContainer>
  );
}
