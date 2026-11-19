import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import { getChannelName } from "@/constants/channel";
import {
  DON_BAN_HANG_DA_KET_THUC_KHONG_THU,
  DON_BAN_HANG_THANH_TOAN,
  getDonBanHangStatus,
} from "@/constants/donBanHang";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { t } from "@/i18n";

const LIEN_KET = "font-mono text-[13px] font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline";
const O_DAU = "py-3 pl-4 pr-3 text-left font-normal sm:pl-6";
const O = "px-3 py-3";
const O_CUOI = "py-3 pl-3 pr-4 text-right sm:pr-6";
const DONG = "border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle";

const hai = (n) => String(n).padStart(2, "0");
function gio(thoiDiem) {
  const d = thoiDiem ? new Date(thoiDiem) : null;
  return d && !Number.isNaN(d.getTime()) ? `${hai(d.getHours())}:${hai(d.getMinutes())}` : "";
}

/** Tiêu đề cột dính trên cùng khi thân bảng tự cuộn (màn rộng, xem index.css → .kh-khoi). */
function DauBang({ cot }) {
  return (
    <thead className="sticky top-0 z-[1]">
      <tr className="whitespace-nowrap border-b border-bo-border bg-bo-surface-subtle text-xs font-medium leading-4 text-bo-muted">
        {cot.map((c, i) => (
          <th
            key={c.nhan}
            scope="col"
            className={cn(
              "px-3 py-2.5 font-medium",
              c.phai ? "text-right" : "text-left",
              i === 0 && "pl-4 sm:pl-6",
              i === cot.length - 1 && "pr-4 sm:pr-6",
            )}
          >
            {c.nhan}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Một dòng của danh sách trên điện thoại: mã · thẻ trạng thái · tiền, dòng dưới là thông tin phụ. Bấm cả dòng để mở. */
function DongDienThoai({ to, ma, trangThai, tien, phu }) {
  return (
    <li className="border-b border-slate-100">
      <Link to={to} className="block px-4 py-3 active:bg-bo-surface-subtle">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-bo-primary">{ma}</span>
          <StatusBadge quyTrinh="donBan" label={trangThai} />
          <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-bo-foreground">{tien}</span>
        </span>
        <span className="mt-1 block text-xs leading-4 text-bo-muted">{phu}</span>
      </Link>
    </li>
  );
}

const tenKenh = (d) => (d.kenhBanHang ? d.kenhBanHang.tenKenh || t(getChannelName(d.kenhBanHang.maKenh)) : t("Bán thường"));

/**
 * Một trang đơn bán của khách, mới nhất ở trên. Giờ đặt xuống dòng dưới ngày để bảng vừa khối ở 1366px.
 * Điện thoại (dưới 640px): danh sách hai dòng thay cho bảng, không phải kéo ngang.
 */
export function BangDonKhachHang({ dons }) {
  return (
    <>
      <ul className="sm:hidden">
        {dons.map((d) => (
          <DongDienThoai
            key={d.id}
            to={`/sales-orders/${d.id}`}
            ma={d.soDonHang || `#${d.id}`}
            trangThai={getDonBanHangStatus(d.trangThai).label}
            tien={formatCurrency(d.tongCong)}
            phu={[
              `${formatDate(d.ngayDatHang)} ${gio(d.ngayDatHang)}`.trim(),
              tenKenh(d) + (d.maDonHangKenh ? ` ${d.maDonHangKenh}` : ""),
              DON_BAN_HANG_THANH_TOAN[d.trangThaiThanhToan]?.label,
            ].filter(Boolean).join(" · ")}
          />
        ))}
      </ul>
      <BangDonDayDu dons={dons} />
    </>
  );
}

function BangDonDayDu({ dons }) {
  return (
    <table className="w-full min-w-[720px] border-collapse text-sm max-sm:hidden">
      <DauBang
        cot={[
          { nhan: t("Mã đơn") },
          { nhan: t("Ngày đặt") },
          { nhan: t("Kênh bán") },
          { nhan: t("Trạng thái") },
          { nhan: t("Thanh toán") },
          { nhan: t("Tổng tiền"), phai: true },
        ]}
      />
      <tbody>
        {dons.map((d) => {
          const tt = getDonBanHangStatus(d.trangThai);
          const thanhToan = DON_BAN_HANG_THANH_TOAN[d.trangThaiThanhToan]?.label ?? d.trangThaiThanhToan ?? "—";
          // Nhắc thu tiền: đơn chưa thu đủ còn hiệu lực (đơn đã hủy / hoàn trả không còn phải thu; đơn sàn thanh toán theo sàn)
          const canThu =
            (d.trangThaiThanhToan === "chua_thanh_toan" || d.trangThaiThanhToan === "thanh_toan_mot_phan") &&
            !d.kenhBanHang && !d.maDonHangKenh &&
            !DON_BAN_HANG_DA_KET_THUC_KHONG_THU.includes(Number(d.trangThai));
          return (
            <tr key={d.id} className={DONG}>
              <th scope="row" className={O_DAU}>
                <Link to={`/sales-orders/${d.id}`} className={LIEN_KET}>
                  {d.soDonHang || `#${d.id}`}
                </Link>
              </th>
              <td className={cn(O, "whitespace-nowrap text-slate-700")}>
                {formatDate(d.ngayDatHang)}
                <div className="text-xs leading-4 text-bo-muted">{gio(d.ngayDatHang)}</div>
              </td>
              <td className={cn(O, "text-slate-700")}>
                {tenKenh(d)}
                {d.maDonHangKenh ? (
                  <div className="font-mono text-xs leading-4 text-bo-muted">{d.maDonHangKenh}</div>
                ) : null}
              </td>
              <td className={O}>
                <StatusBadge quyTrinh="donBan" label={tt.label} />
              </td>
              <td className={cn(O, "whitespace-nowrap", canThu ? "font-medium text-bo-warning" : "text-slate-700")}>
                {thanhToan}
              </td>
              <td className={cn(O_CUOI, "whitespace-nowrap font-semibold text-bo-foreground")}>{formatCurrency(d.tongCong)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
