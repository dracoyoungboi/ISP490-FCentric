import { createElement } from "react";
import { Info, Mail, Phone } from "lucide-react";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { laHoatDong } from "@/components/supplier/quyTacNhaCungCap";
import { formatDateTime } from "@/utils/formatters";

const NUT_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

function NhanNhom({ children }) {
  return <div className="text-xs font-medium leading-4 text-bo-muted">{children}</div>;
}

/** Một dòng liên hệ: nhãn nhỏ, giá trị, nút mở (gọi / gửi email) và nút sao chép. */
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
          <div className="text-[13px] text-bo-muted">—</div>
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

/**
 * Cột thông tin bên phải (cùng kiểu Chi tiết đơn mua hàng): liên hệ, mã, trạng thái kèm hệ quả, ngày tạo,
 * cập nhật, và một dòng nói rõ thanh toán cho nhà cung cấp do kế toán làm ngoài hệ thống
 * (thay cho thẻ "Thông tin thanh toán" cũ). Dưới 1280px: xuống dưới vùng giao dịch, xếp 2 cột khi khối rộng từ 576px.
 */
export default function ThuocTinhNcc({ ncc }) {
  const soDienThoai = ncc.soDienThoai?.trim() || "";
  const email = ncc.email?.trim() || "";
  const dangHoatDong = laHoatDong(ncc);

  return (
    <aside
      aria-label="Thông tin nhà cung cấp"
      className="grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:px-6 @xl:grid-cols-2 xl:block xl:border-l xl:border-t-0"
    >
      <section className="border-b border-slate-200/70 py-4">
        <NhanNhom>Liên hệ</NhanNhom>
        <div className="mt-2 font-semibold text-bo-foreground">{ncc.nguoiLienHe || "—"}</div>
        <div className="text-xs leading-4 text-bo-muted">Người liên hệ</div>
        <DongLienHe
          nhan="Số điện thoại"
          giaTri={soDienThoai}
          href={`tel:${soDienThoai}`}
          nhanMo={`Gọi ${soDienThoai}`}
          icon={Phone}
          nhanSaoChep="Sao chép số điện thoại"
          kieu="tabular-nums"
        />
        <DongLienHe
          nhan="Email · nhận yêu cầu báo giá"
          giaTri={email}
          href={`mailto:${email}`}
          nhanMo="Gửi email"
          icon={Mail}
          nhanSaoChep="Sao chép email"
        />
        <div className="mt-2.5">
          <div className="text-xs leading-4 text-bo-muted">Địa chỉ</div>
          <div className="break-words text-[13px] font-medium leading-5 text-bo-foreground">{ncc.diaChi || "—"}</div>
        </div>
      </section>

      <div>
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-b border-slate-200/70 py-4 text-[13px] leading-5">
          <dt className="text-bo-muted">Mã</dt>
          <dd className="m-0 min-w-0 font-mono font-semibold text-slate-700">{ncc.maNhaCungCap || "—"}</dd>
          <dt className="text-bo-muted">Trạng thái</dt>
          <dd className="m-0 min-w-0 text-bo-foreground">
            {dangHoatDong ? "Được chọn khi gửi yêu cầu báo giá" : "Không được chọn khi gửi yêu cầu báo giá"}
          </dd>
          <dt className="text-bo-muted">Ngày tạo</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(ncc.ngayTao)}</dd>
          <dt className="text-bo-muted">Cập nhật</dt>
          <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">{formatDateTime(ncc.ngayCapNhat)}</dd>
        </dl>
        <p className="flex gap-2 pt-3.5 text-xs leading-[18px] text-bo-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Kế toán liên hệ và thanh toán cho nhà cung cấp ngoài FCentric.
        </p>
      </div>
    </aside>
  );
}
