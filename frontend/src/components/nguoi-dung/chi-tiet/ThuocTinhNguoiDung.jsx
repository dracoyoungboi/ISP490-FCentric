import { createElement } from "react";
import { Mail, Phone } from "lucide-react";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { formatDateTime } from "@/utils/formatters";
import { hienTenDangNhapRieng } from "@/components/nguoi-dung/phanQuyen";
import { t } from "@/i18n";

const NUT_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

/** Một thông tin: nhãn nhỏ ở trên, giá trị ở dưới (cột hẹp vẫn hiện đủ email, ngày giờ), nút thao tác bên phải. */
function Dong({ nhan, children, hanhDong }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-4 text-bo-muted">{nhan}</dt>
      <dd className="m-0 mt-0.5 flex min-w-0 items-center gap-0.5 text-[13.5px] leading-5 text-bo-foreground">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
        {hanhDong}
      </dd>
    </div>
  );
}

function LienHe({ giaTri, href, nhanMo, icon, nhanSaoChep }) {
  if (!giaTri) return null;
  return (
    <>
      <a href={href} aria-label={nhanMo} title={nhanMo} className={NUT_ICON}>
        {createElement(icon, { className: "size-3.5", "aria-hidden": true })}
      </a>
      <NutSaoChep giaTri={giaTri} nhan={nhanSaoChep} />
    </>
  );
}

/**
 * Cột Tài khoản của Chi tiết người dùng (Kiểu D, chốt 19/10/2026): một mục, mỗi thông tin một dòng.
 * Vai trò và nơi làm việc ở đầu trang; hiệu lực, người cấp, ghi chú ở tiêu đề tab Quyền — không lặp ở đây.
 * Họ tên trống thì tiêu đề trang đã là tên đăng nhập, nên không hiện dòng Tên đăng nhập.
 * Dưới 1280px xuống dưới vùng tab, xếp 2 cột khi chính cột này rộng từ 576px (đo cột, không đo cả khối:
 * đo cả khối thì ở 1440px cột 340px vẫn bị chia 2 và email gãy chữ).
 */
export default function ThuocTinhNguoiDung({ nguoiDung }) {
  const email = nguoiDung.email?.trim() || "";
  const soDienThoai = nguoiDung.soDienThoai?.trim() || "";
  const hienTenDangNhap = hienTenDangNhapRieng(nguoiDung);
  const chua = <span className="text-bo-muted">{t("Chưa có")}</span>;

  return (
    <aside
      aria-labelledby="cot-tai-khoan"
      className="nd-cot-phai @container min-w-0 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 pt-4 sm:px-6 xl:border-l xl:border-t-0"
    >
      <h2 id="cot-tai-khoan" className="mb-3.5 text-[13px] font-semibold leading-5 text-bo-foreground">
        {t("Tài khoản")}
      </h2>
      <dl className="m-0 grid gap-x-8 gap-y-3.5 @xl:grid-cols-2">
        {hienTenDangNhap ? (
          <Dong
            nhan={t("Tên đăng nhập")}
            hanhDong={<NutSaoChep giaTri={nguoiDung.tenDangNhap} nhan={t("Sao chép tên đăng nhập")} />}
          >
            {nguoiDung.tenDangNhap}
          </Dong>
        ) : null}
        <Dong
          nhan="Email"
          hanhDong={
            <LienHe giaTri={email} href={`mailto:${email}`} nhanMo={t("Gửi email")} icon={Mail} nhanSaoChep={t("Sao chép email")} />
          }
        >
          {email || chua}
        </Dong>
        <Dong
          nhan={t("Số điện thoại")}
          hanhDong={
            <LienHe
              giaTri={soDienThoai}
              href={`tel:${soDienThoai}`}
              nhanMo={t("Gọi {{soDienThoai}}", { soDienThoai })}
              icon={Phone}
              nhanSaoChep={t("Sao chép số điện thoại")}
            />
          }
        >
          {soDienThoai ? <span className="tabular-nums">{soDienThoai}</span> : chua}
        </Dong>
        <Dong nhan={t("Mật khẩu")}>{nguoiDung.mustChangePassword ? t("Chưa đặt mật khẩu riêng") : t("Đã đặt mật khẩu riêng")}</Dong>
        <Dong nhan={t("Ngày tạo")}>
          <span className="tabular-nums">{formatDateTime(nguoiDung.ngayTao)}</span>
        </Dong>
        <Dong nhan={t("Cập nhật")}>
          <span className="tabular-nums">{formatDateTime(nguoiDung.ngayCapNhat)}</span>
        </Dong>
      </dl>
      <p className="mt-4 border-t border-slate-200/70 pt-3 text-xs leading-[18px] text-bo-muted">
        {t("Email và số điện thoại đều dùng để đăng nhập. Email không đổi được.")}
      </p>
    </aside>
  );
}
