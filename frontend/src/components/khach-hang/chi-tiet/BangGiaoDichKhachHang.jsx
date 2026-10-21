import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import { getBaoGiaStatus } from "@/constants/baoGia";
import { getChannelName } from "@/constants/channel";
import {
  DON_BAN_HANG_DA_KET_THUC_KHONG_THU,
  DON_BAN_HANG_THANH_TOAN,
  getDonBanHangStatus,
} from "@/constants/donBanHang";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ghiChuBaoGia } from "./tinhKhachHang";

const LIEN_KET = "font-mono text-[13px] font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline";
const NUT_VIEN =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-bo-border bg-white px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";
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
            key={c.nhan || i}
            scope="col"
            className={cn(
              "px-3 py-2.5 font-medium",
              c.phai ? "text-right" : "text-left",
              i === 0 && "pl-4 sm:pl-6",
              i === cot.length - 1 && "pr-4 sm:pr-6",
            )}
          >
            {c.nhan ? c.nhan : <span className="sr-only">{c.nhanDoc}</span>}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Một dòng của danh sách trên điện thoại: mã · thẻ trạng thái · tiền, dòng dưới là thông tin phụ. Bấm cả dòng để mở. */
function DongDienThoai({ to, ma, trangThai, quyTrinh, tien, phu, sau }) {
  return (
    <li className="border-b border-slate-100">
      <Link to={to} className="block px-4 py-3 active:bg-bo-surface-subtle">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-bo-primary">{ma}</span>
          <StatusBadge quyTrinh={quyTrinh} label={trangThai} />
          <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-bo-foreground">{tien}</span>
        </span>
        <span className="mt-1 block text-xs leading-4 text-bo-muted">{phu}</span>
      </Link>
      {sau ? <div className="-mt-1 px-4 pb-3">{sau}</div> : null}
    </li>
  );
}

const tenKenh = (d) => (d.kenhBanHang ? d.kenhBanHang.tenKenh || getChannelName(d.kenhBanHang.maKenh) : "Bán thường");

/**
 * Tab "Đơn hàng": một trang đơn bán của khách, mới nhất ở trên. Giờ đặt xuống dòng dưới ngày để bảng vừa khối ở 1366px.
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
            quyTrinh="donBan"
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
          { nhan: "Mã đơn" },
          { nhan: "Ngày đặt" },
          { nhan: "Kênh bán" },
          { nhan: "Trạng thái" },
          { nhan: "Thanh toán" },
          { nhan: "Tổng tiền", phai: true },
        ]}
      />
      <tbody>
        {dons.map((d) => {
          const tt = getDonBanHangStatus(d.trangThai);
          const thanhToan = DON_BAN_HANG_THANH_TOAN[d.trangThaiThanhToan]?.label ?? d.trangThaiThanhToan ?? "—";
          // Nhắc thu tiền: chỉ đơn chưa thanh toán còn hiệu lực (đơn đã hủy / hoàn trả không còn phải thu)
          const canThu =
            d.trangThaiThanhToan === "chua_thanh_toan" &&
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

/**
 * Tab "Báo giá": báo giá đã gửi khách. Báo giá chờ phản hồi có nút "Tạo đơn bán" (`coTheTaoDon`)
 * mở Tạo đơn bán hàng với báo giá đó được chọn sẵn.
 */
export function BangBaoGiaKhachHang({ baoGias, coTheTaoDon }) {
  return (
    <>
      <ul className="sm:hidden">
        {baoGias.map((b) => (
          <DongDienThoai
            key={b.id}
            to={`/sales-quotations/${b.id}`}
            ma={b.soDonHang || `#${b.id}`}
            trangThai={getBaoGiaStatus(b.trangThai).label}
            quyTrinh="baoGiaBan"
            tien={formatCurrency(b.tongCong)}
            phu={[formatDate(b.ngayTao ?? b.ngayDatHang), ghiChuBaoGia(b)].filter(Boolean).join(" · ")}
            sau={
              coTheTaoDon && Number(b.trangThai) === 0 ? (
                <Link to={`/sales-orders/create?quoteId=${b.id}`} className={cn(NUT_VIEN, "h-10")}>
                  Tạo đơn bán
                </Link>
              ) : null
            }
          />
        ))}
      </ul>
      <BangBaoGiaDayDu baoGias={baoGias} coTheTaoDon={coTheTaoDon} />
    </>
  );
}

function BangBaoGiaDayDu({ baoGias, coTheTaoDon }) {
  return (
    <table className="w-full min-w-[720px] border-collapse text-sm max-sm:hidden">
      <DauBang
        cot={[
          { nhan: "Mã báo giá" },
          { nhan: "Ngày tạo" },
          { nhan: "Trạng thái" },
          { nhan: "Ghi chú" },
          { nhan: "Tổng tiền", phai: true },
          ...(coTheTaoDon ? [{ nhan: "", nhanDoc: "Thao tác", phai: true }] : []),
        ]}
      />
      <tbody>
        {baoGias.map((b) => {
          const tt = getBaoGiaStatus(b.trangThai);
          const ghiChu = ghiChuBaoGia(b);
          const choPhanHoi = Number(b.trangThai) === 0;
          return (
            <tr key={b.id} className={DONG}>
              <th scope="row" className={O_DAU}>
                <Link to={`/sales-quotations/${b.id}`} className={LIEN_KET}>
                  {b.soDonHang || `#${b.id}`}
                </Link>
              </th>
              <td className={cn(O, "whitespace-nowrap text-slate-700")}>{formatDate(b.ngayTao ?? b.ngayDatHang)}</td>
              <td className={O}>
                <StatusBadge quyTrinh="baoGiaBan" label={tt.label} />
              </td>
              <td className={cn(O, "max-w-[320px] text-[13px] text-bo-muted")}>
                {ghiChu ? (
                  <span className="line-clamp-2 break-words" title={ghiChu}>
                    {ghiChu}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td
                className={cn(
                  coTheTaoDon ? O : O_CUOI,
                  "whitespace-nowrap text-right font-semibold text-bo-foreground",
                )}
              >
                {formatCurrency(b.tongCong)}
              </td>
              {coTheTaoDon ? (
                <td className={cn(O_CUOI, "w-px")}>
                  {choPhanHoi ? (
                    <Link to={`/sales-orders/create?quoteId=${b.id}`} className={NUT_VIEN}>
                      Tạo đơn bán
                    </Link>
                  ) : null}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
