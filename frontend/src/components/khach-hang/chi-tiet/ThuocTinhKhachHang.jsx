import { createElement } from "react";
import { Mail, Phone } from "lucide-react";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { formatDateTime } from "@/utils/formatters";
import { laHoatDong, moTaKenhMua, nhanDiaChi, nhanLoaiKhach } from "./tinhKhachHang";

const NUT_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";
const NUT_CHU = "font-medium text-bo-primary hover:text-bo-primary-hover hover:underline";

const chuanTen = (s) => (s || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");

/** Một dòng liên hệ: nhãn nhỏ, giá trị (hoặc "Chưa có … · Thêm"), nút mở (gọi / gửi email) và nút sao chép. */
function DongLienHe({ nhan, giaTri, trong, href, nhanMo, icon, kieu, onThem }) {
  return (
    <div className="mt-2.5 flex min-w-0 items-center gap-0.5">
      <div className="min-w-0 flex-1">
        <div className="text-xs leading-4 text-bo-muted">{nhan}</div>
        {giaTri ? (
          <div className={`break-words text-[13px] font-medium leading-5 text-bo-foreground ${kieu ?? ""}`}>{giaTri}</div>
        ) : (
          <div className="text-[13px] leading-5 text-bo-muted">
            {trong}
            {onThem ? (
              <>
                {" · "}
                <button type="button" onClick={onThem} className={NUT_CHU}>
                  Thêm
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
      {giaTri && href ? (
        <a href={href} aria-label={nhanMo} title={nhanMo} className={NUT_ICON}>
          {createElement(icon, { className: "size-3.5", "aria-hidden": true })}
        </a>
      ) : null}
      {giaTri ? <NutSaoChep giaTri={giaTri} nhan={`Sao chép ${nhan.toLocaleLowerCase("vi-VN")}`} /> : null}
    </div>
  );
}

/**
 * Cột thông tin bên phải (cùng kiểu Chi tiết nhà cung cấp): Liên hệ và Thông tin.
 * Thiếu số điện thoại / email / địa chỉ hay chưa phân loại: ghi rõ "Chưa có …", kèm "Thêm" / "Phân loại" khi có quyền sửa.
 * `onChinhSua(o)` mở popup Sửa khách hàng, đặt con trỏ vào đúng ô `o` ("soDienThoai", "email", "diaChi", "loaiKhachHang").
 * `kenhMua`: các kênh khách đã mua qua (từ số tổng hợp); `undefined` khi chưa tải được.
 * Dưới 1280px: xuống dưới vùng giao dịch, xếp 2 cột khi khối rộng từ 576px.
 */
export default function ThuocTinhKhachHang({ khachHang, kenhMua, onChinhSua }) {
  const them = (o) => (onChinhSua ? () => onChinhSua(o) : undefined);
  const soDienThoai = khachHang.soDienThoai?.trim() || "";
  const email = khachHang.email?.trim() || "";
  const diaChi = khachHang.diaChi?.trim() || "";
  const nguoiLienHe = khachHang.nguoiLienHe?.trim() || "";
  const hienNguoiLienHe = nguoiLienHe && chuanTen(nguoiLienHe) !== chuanTen(khachHang.tenKhachHang);
  const loai = nhanLoaiKhach(khachHang.loaiKhachHang);
  const nhanDc = nhanDiaChi(khachHang.loaiKhachHang);

  return (
    <aside
      aria-label="Thông tin khách hàng"
      className="kh-cot-phai grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @xl:grid-cols-2 xl:block xl:border-l xl:border-t-0"
    >
      <section aria-labelledby="kh-lien-he" className="border-b border-slate-200/70 py-4">
        <h2 id="kh-lien-he" className="text-[13px] font-semibold leading-5 text-bo-foreground">
          Liên hệ
        </h2>
        {hienNguoiLienHe ? (
          <div className="mt-2.5">
            <div className="text-xs leading-4 text-bo-muted">Người liên hệ</div>
            <div className="break-words text-[13px] font-medium leading-5 text-bo-foreground">{nguoiLienHe}</div>
          </div>
        ) : null}
        <DongLienHe
          nhan="Số điện thoại"
          giaTri={soDienThoai}
          trong="Chưa có số điện thoại"
          href={`tel:${soDienThoai}`}
          nhanMo={`Gọi ${soDienThoai}`}
          icon={Phone}
          kieu="tabular-nums"
          onThem={them("soDienThoai")}
        />
        <DongLienHe
          nhan="Email"
          giaTri={email}
          trong="Chưa có email"
          href={`mailto:${email}`}
          nhanMo={`Gửi email tới ${email}`}
          icon={Mail}
          onThem={them("email")}
        />
        <DongLienHe nhan={nhanDc} giaTri={diaChi} trong="Chưa có địa chỉ" onThem={them("diaChi")} />
      </section>

      <section aria-labelledby="kh-thong-tin" className="py-4">
        <h2 id="kh-thong-tin" className="text-[13px] font-semibold leading-5 text-bo-foreground">
          Thông tin
        </h2>
        <dl className="mt-2.5 grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] leading-5">
          <dt className="text-bo-muted">Mã khách hàng</dt>
          <dd className="m-0 min-w-0 break-words font-mono font-semibold text-slate-700">{khachHang.maKhachHang || "—"}</dd>
          <dt className="text-bo-muted">Loại khách</dt>
          <dd className="m-0 min-w-0 text-bo-foreground">
            {loai ?? (
              <>
                <span className="text-bo-muted">Chưa phân loại</span>
                {onChinhSua ? (
                  <>
                    {" · "}
                    <button type="button" onClick={them("loaiKhachHang")} className={NUT_CHU}>
                      Phân loại
                    </button>
                  </>
                ) : null}
              </>
            )}
          </dd>
          <dt className="text-bo-muted">Mua qua</dt>
          <dd className="m-0 min-w-0 text-bo-foreground">{kenhMua === undefined ? "—" : moTaKenhMua(kenhMua)}</dd>
          <dt className="text-bo-muted">Trạng thái</dt>
          <dd className="m-0 min-w-0 text-bo-foreground">
            {laHoatDong(khachHang)
              ? "Chọn được khi tạo báo giá, bán tại quầy"
              : "Không chọn được khi tạo báo giá, bán tại quầy"}
          </dd>
          <dt className="text-bo-muted">Ngày tạo</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(khachHang.ngayTao)}</dd>
          <dt className="text-bo-muted">Cập nhật</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(khachHang.ngayCapNhat)}</dd>
        </dl>
      </section>
    </aside>
  );
}
