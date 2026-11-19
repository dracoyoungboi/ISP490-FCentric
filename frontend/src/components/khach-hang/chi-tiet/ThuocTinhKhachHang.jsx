import { createElement } from "react";
import { Mail, Phone } from "lucide-react";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { formatDateTime } from "@/utils/formatters";
import { moTaKenhMua } from "./tinhKhachHang";
import { laSoBiChe } from "../hienThiKhachHang";
import { t } from "@/i18n";

const NUT_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";
const NUT_CHU = "font-medium text-bo-primary hover:text-bo-primary-hover hover:underline";

/**
 * Một dòng liên hệ: nhãn nhỏ, giá trị (hoặc "Chưa có … · Thêm"), nút mở (gọi / gửi email) và nút sao chép.
 * `biChe`: số sàn đã che (có dấu *): vẫn hiện nguyên văn nhưng không có nút gọi, không sao chép.
 */
function DongLienHe({ nhan, giaTri, trong, href, nhanMo, icon, kieu, onThem, biChe = false }) {
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
                  {t("Thêm")}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
      {giaTri && href && !biChe ? (
        <a href={href} aria-label={nhanMo} title={nhanMo} className={NUT_ICON}>
          {createElement(icon, { className: "size-3.5", "aria-hidden": true })}
        </a>
      ) : null}
      {giaTri && !biChe ? <NutSaoChep giaTri={giaTri} nhan={t("Sao chép {{ten}}", { ten: nhan.toLocaleLowerCase("vi-VN") })} /> : null}
    </div>
  );
}

/**
 * Cột thông tin bên phải (cùng kiểu Chi tiết nhà cung cấp): Liên hệ và Thông tin (trạng thái không nhắc lại vì đầu
 * trang đã có huy hiệu và dải xám khi ngừng hoạt động).
 * Thiếu số điện thoại / email / địa chỉ: ghi rõ "Chưa có …", kèm "Thêm" khi có quyền sửa.
 * `onChinhSua(o)` mở popup Sửa khách hàng, đặt con trỏ vào đúng ô `o` ("soDienThoai", "email", "diaChi").
 * `kenhMua`: các kênh khách đã mua qua (từ số tổng hợp); `undefined` khi chưa tải được.
 * Dưới 1280px: xuống dưới vùng giao dịch, xếp 2 cột khi khối rộng từ 576px.
 */
export default function ThuocTinhKhachHang({ khachHang, kenhMua, onChinhSua }) {
  const them = (o) => (onChinhSua ? () => onChinhSua(o) : undefined);
  const soDienThoai = khachHang.soDienThoai?.trim() || "";
  const email = khachHang.email?.trim() || "";
  const diaChi = khachHang.diaChi?.trim() || "";

  return (
    <aside
      aria-label={t("Thông tin khách hàng")}
      className="kh-cot-phai grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @xl:grid-cols-2 xl:block xl:border-l xl:border-t-0"
    >
      <section aria-labelledby="kh-lien-he" className="border-b border-slate-200/70 py-4">
        <h2 id="kh-lien-he" className="text-[13px] font-semibold leading-5 text-bo-foreground">
          {t("Liên hệ")}
        </h2>
        <DongLienHe
          nhan={t("Số điện thoại")}
          giaTri={soDienThoai}
          trong={t("Chưa có số điện thoại")}
          href={`tel:${soDienThoai}`}
          nhanMo={t("Gọi {{soDienThoai}}", { soDienThoai })}
          icon={Phone}
          kieu="tabular-nums"
          biChe={laSoBiChe(soDienThoai)}
          onThem={them("soDienThoai")}
        />
        <DongLienHe
          nhan="Email"
          giaTri={email}
          trong={t("Chưa có email")}
          href={`mailto:${email}`}
          nhanMo={t("Gửi email tới {{email}}", { email })}
          icon={Mail}
          onThem={them("email")}
        />
        <DongLienHe nhan={t("Địa chỉ")} giaTri={diaChi} trong={t("Chưa có địa chỉ")} onThem={them("diaChi")} />
      </section>

      <section aria-labelledby="kh-thong-tin" className="py-4">
        <h2 id="kh-thong-tin" className="text-[13px] font-semibold leading-5 text-bo-foreground">
          {t("Thông tin")}
        </h2>
        <dl className="mt-2.5 grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] leading-5">
          <dt className="text-bo-muted">{t("Mã khách hàng")}</dt>
          <dd className="m-0 min-w-0 break-words font-mono font-semibold text-slate-700">{khachHang.maKhachHang || "—"}</dd>
          <dt className="text-bo-muted">{t("Mua qua")}</dt>
          <dd className="m-0 min-w-0 text-bo-foreground">{kenhMua === undefined ? "—" : moTaKenhMua(kenhMua)}</dd>
          <dt className="text-bo-muted">{t("Ngày tạo")}</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(khachHang.ngayTao)}</dd>
          <dt className="text-bo-muted">{t("Cập nhật", { context: "ngay" })}</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(khachHang.ngayCapNhat)}</dd>
        </dl>
      </section>
    </aside>
  );
}
