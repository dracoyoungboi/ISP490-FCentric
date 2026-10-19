import { createElement } from "react";
import { Mail, Phone } from "lucide-react";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { nhanLoaiKho } from "@/pages/warehouse/loaiKho";
import { formatDateTime } from "@/utils/formatters";
import { moTaHieuLuc, vietHoaDau } from "@/components/nguoi-dung/phanQuyen";

const NUT_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

function NhanNhom({ children }) {
  return <div className="text-xs font-medium leading-4 text-bo-muted">{children}</div>;
}

function DongLienHe({ nhan, giaTri, href, nhanMo, icon, nhanSaoChep, kieu }) {
  return (
    <div className="mt-2.5 flex min-w-0 items-center gap-0.5">
      <div className="min-w-0 flex-1">
        <div className="text-xs leading-4 text-bo-muted">{nhan}</div>
        {giaTri ? (
          <div className={`truncate text-[13px] font-medium text-bo-foreground ${kieu ?? ""}`} title={giaTri}>
            {giaTri}
          </div>
        ) : (
          <div className="text-[13px] text-bo-muted">Chưa có</div>
        )}
      </div>
      {giaTri ? (
        <>
          <a href={href} aria-label={nhanMo} title={nhanMo} className={NUT_ICON}>
            {createElement(icon, { className: "size-3.5", "aria-hidden": true })}
          </a>
          <NutSaoChep giaTri={giaTri} nhan={nhanSaoChep} />
        </>
      ) : null}
    </div>
  );
}

function BangThuocTinh({ children }) {
  return (
    <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] leading-5">{children}</dl>
  );
}

function Dong({ nhan, children, kieu }) {
  return (
    <>
      <dt className="text-bo-muted">{nhan}</dt>
      <dd className={`m-0 min-w-0 break-words text-bo-foreground ${kieu ?? ""}`}>{children}</dd>
    </>
  );
}

/**
 * Cột thuộc tính bên phải của Chi tiết người dùng: liên hệ, tài khoản, phân quyền kho.
 * Dưới 1280px xuống dưới vùng tab, xếp 2 cột khi khối rộng từ 576px.
 */
export default function ThuocTinhNguoiDung({ nguoiDung, pq }) {
  const email = nguoiDung.email?.trim() || "";
  const soDienThoai = nguoiDung.soDienThoai?.trim() || "";
  const loaiKho = pq?.kho ? nhanLoaiKho(pq.kho).label : "";

  return (
    <aside
      aria-label="Thông tin người dùng"
      className="nd-cot-phai grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @xl:grid-cols-2 xl:block xl:border-l xl:border-t-0"
    >
      <section className="border-b border-slate-200/70 py-4">
        <NhanNhom>Liên hệ</NhanNhom>
        <DongLienHe
          nhan="Email · đăng nhập, đặt lại mật khẩu"
          giaTri={email}
          href={`mailto:${email}`}
          nhanMo="Gửi email"
          icon={Mail}
          nhanSaoChep="Sao chép email"
        />
        <DongLienHe
          nhan="Số điện thoại · cũng dùng để đăng nhập"
          giaTri={soDienThoai}
          href={`tel:${soDienThoai}`}
          nhanMo={`Gọi ${soDienThoai}`}
          icon={Phone}
          nhanSaoChep="Sao chép số điện thoại"
          kieu="tabular-nums"
        />
      </section>

      <section className="border-b border-slate-200/70 py-4">
        <div className="mb-2.5">
          <NhanNhom>Tài khoản</NhanNhom>
        </div>
        <BangThuocTinh>
          <Dong nhan="Tên đăng nhập" kieu="font-mono font-semibold text-slate-700">
            {nguoiDung.tenDangNhap || "—"}
          </Dong>
          <Dong nhan="Mã người dùng" kieu="tabular-nums">
            {nguoiDung.id ?? "—"}
          </Dong>
          <Dong nhan="Mật khẩu" kieu={nguoiDung.mustChangePassword ? "text-amber-700" : undefined}>
            {nguoiDung.mustChangePassword ? "Chưa đổi mật khẩu tạm thời" : "Đã đặt mật khẩu riêng"}
          </Dong>
          <Dong nhan="Ngày tạo" kieu="tabular-nums">
            {formatDateTime(nguoiDung.ngayTao)}
          </Dong>
          <Dong nhan="Cập nhật" kieu="tabular-nums">
            {formatDateTime(nguoiDung.ngayCapNhat)}
          </Dong>
        </BangThuocTinh>
      </section>

      {pq?.kho ? (
        <section className="py-4 xl:border-b-0">
          <div className="mb-2.5">
            <NhanNhom>Phân quyền kho</NhanNhom>
          </div>
          <BangThuocTinh>
            <Dong nhan="Kho">
              {pq.kho.tenKho || "—"}{" "}
              {pq.kho.maKho ? <span className="font-mono text-xs text-bo-muted">{pq.kho.maKho}</span> : null}
            </Dong>
            <Dong nhan="Loại kho">{loaiKho || "—"}</Dong>
            <Dong nhan="Hiệu lực">{vietHoaDau(moTaHieuLuc(pq))}</Dong>
            <Dong nhan="Người cấp">{pq.tenNguoiCapQuyen || "—"}</Dong>
            <Dong nhan="Ghi chú" kieu={pq.ghiChu ? undefined : "text-bo-muted"}>
              {pq.ghiChu || "—"}
            </Dong>
          </BangThuocTinh>
        </section>
      ) : null}
    </aside>
  );
}
