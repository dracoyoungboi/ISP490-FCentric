import { Link } from "react-router-dom";
import { Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import { getBaoGiaNccStatus, getDonMuaHangStatus } from "@/constants/donMuaHang";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { tinhTienDoNhan } from "@/components/order/chi-tiet-don-mua/tinhNhanHang";
import { ngayDat } from "@/components/supplier/chi-tiet/tinhNhaCungCap";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";

const LIEN_KET = "font-mono text-[13px] font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline";
// Cỡ nút theo bề rộng danh sách (container query), không theo màn hình: menu bên trái làm vùng nội dung hẹp hơn màn hình
const NUT_VIEN =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-bo-border bg-white px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle @max-2xl:h-11 @max-2xl:w-full @max-2xl:text-sm";
const DONG_VIEC =
  "grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-6 @2xl:grid-cols-[32px_minmax(180px,1.4fr)_minmax(120px,1fr)_auto_auto] @2xl:gap-x-4";

function chuHanGiao(giao) {
  if (giao.loai === "quaHan") return `Quá hạn ${giao.soNgay} ngày`;
  if (giao.loai === "homNay") return "Hạn hôm nay";
  if (giao.loai === "conLai") return `Còn ${giao.soNgay} ngày`;
  return "Chưa có hạn giao";
}

/** Cột "Giao hàng" của bảng đơn mua: thẻ trạng thái như mọi cột trạng thái khác. */
function GiaoHang({ giao }) {
  if (!giao) return <span className="text-bo-muted">—</span>;
  switch (giao.loai) {
    case "dungHan":
      return <StatusBadge label="Đúng hạn" />;
    case "tre":
      return <StatusBadge label={`Trễ ${giao.soNgay} ngày`} />;
    case "daDu":
      return <StatusBadge label="Đã nhận đủ" />;
    default:
      return <StatusBadge label={chuHanGiao(giao)} />;
  }
}

function ThanhNhan({ tienDo, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200", className)}
    >
      <span className="absolute inset-y-0 left-0 rounded-full bg-bo-primary" style={{ width: `${tienDo.phanTram}%` }} />
    </span>
  );
}

/**
 * Tab "Đang mở": đơn chờ giao và báo giá chờ duyệt, mỗi dòng đúng một nút đi tới chỗ xử lý.
 * `nutCuaDon(don)` trả `{ nhan, href }`: "Tạo phiếu nhập" khi được nhập hàng cho đơn, ngược lại "Xem đơn".
 */
export function DangMoNcc({ viec, nutCuaDon }) {
  return (
    <ul className="@container divide-y divide-slate-100">
      {viec.map((v) => {
        const d = v.don;
        if (v.loai === "don") {
          const nut = nutCuaDon(d);
          const tienDo = v.giao.tienDo ?? tinhTienDoNhan(d.chiTietDonMuaHangs);
          const quaHan = v.giao.loai === "quaHan";
          return (
            <li
              key={`don-${d.id}`}
              className={DONG_VIEC}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full",
                  quaHan ? "bg-bo-danger-soft text-bo-danger" : "bg-slate-100 text-slate-600",
                )}
              >
                <Clock className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/purchase-orders/${d.id}`} className={LIEN_KET}>
                    {d.soDonMua || `#${d.id}`}
                  </Link>
                  {/* Quá hạn: Đỏ · Hạn hôm nay: Cam · Còn N ngày: lịch xanh lá · Chưa có hạn giao: lịch xám (constants/trangThai) */}
                  <StatusBadge label={chuHanGiao(v.giao)} />
                </div>
                <div className="mt-0.5 text-[13px] text-bo-muted">
                  Đơn mua ·{" "}
                  <span className="whitespace-nowrap">
                    {d.ngayGiaoDuKien ? `giao dự kiến ${formatDate(d.ngayGiaoDuKien)}` : "chưa có ngày giao dự kiến"}
                  </span>
                  {d.khoNhap?.tenKho ? (
                    <>
                      {" · "}
                      <span className="whitespace-nowrap">{d.khoNhap.tenKho}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="text-right font-semibold tabular-nums text-bo-foreground @2xl:order-4">
                {formatCurrency(d.tongTien)}
              </div>
              <div className="col-span-3 flex min-w-0 items-center gap-2.5 @2xl:order-3 @2xl:col-span-1">
                <ThanhNhan tienDo={tienDo} className="@2xl:max-w-[120px]" />
                <span className="whitespace-nowrap text-[13px] tabular-nums text-slate-700">
                  Đã nhận {formatNumber(tienDo.daNhan)}/{formatNumber(tienDo.dat)}
                </span>
              </div>
              <Link to={nut.href} className={cn(NUT_VIEN, "col-span-3 @2xl:order-5 @2xl:col-span-1 @2xl:justify-self-end")}>
                {nut.nhan}
              </Link>
            </li>
          );
        }
        return (
          <li
            key={`bg-${d.id}`}
            className={DONG_VIEC}
          >
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-bo-primary-soft text-bo-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/quotation/${d.id}`} className={LIEN_KET}>
                  {d.soDonMua || `#${d.id}`}
                </Link>
                <StatusBadge quyTrinh="yeuCauBaoGia" label={getBaoGiaNccStatus(d.trangThai).label} />
              </div>
              <div className="mt-0.5 text-[13px] text-bo-muted">
                Báo giá · gửi yêu cầu {formatDate(ngayDat(d))}
              </div>
            </div>
            <div className="text-right font-semibold tabular-nums text-bo-foreground @2xl:order-4">
              {formatCurrency(d.tongTien)}
            </div>
            <div className="col-span-3 text-[13px] text-bo-muted @2xl:order-3 @2xl:col-span-1">
              {formatNumber((d.chiTietDonMuaHangs ?? []).length)} sản phẩm
            </div>
            <Link to={`/quotation/${d.id}`} className={cn(NUT_VIEN, "col-span-3 @2xl:order-5 @2xl:col-span-1 @2xl:justify-self-end")}>
              Xem báo giá
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Không bọc thêm khung cuộn: vùng tab (.ncc-bang) tự cuộn ngang và dọc, để tiêu đề cột dính được khi cuộn dọc. */
function Bang({ minW = 820, children }) {
  return (
    <table className={cn("w-full border-collapse text-sm", minW === 820 ? "min-w-[820px]" : "min-w-[880px]")}>{children}</table>
  );
}

/** Tiêu đề cột dính trên cùng khi thân bảng tự cuộn (màn rộng, xem index.css → .ncc-khoi). */
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

const O_DAU = "py-3 pl-4 pr-3 text-left font-normal sm:pl-6";
const O = "px-3 py-3";
const O_CUOI = "py-3 pl-3 pr-4 text-right sm:pr-6";
const DONG = "border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle";

/** Tab "Đơn mua hàng": đơn đã chốt (3, 5), kèm tình trạng giao. */
export function BangDonMuaNcc({ chot, giaoTheoDon }) {
  return (
    <Bang>
      <DauBang
        cot={[
          { nhan: "Mã đơn mua" },
          { nhan: "Ngày đặt" },
          { nhan: "Giao dự kiến" },
          { nhan: "Giao hàng" },
          { nhan: "Đã nhận", phai: true },
          { nhan: "Tổng tiền", phai: true },
        ]}
      />
      <tbody>
        {chot.map((d) => {
          const giao = giaoTheoDon.get(d.id);
          const tienDo = giao?.tienDo ?? tinhTienDoNhan(d.chiTietDonMuaHangs);
          return (
            <tr key={d.id} className={DONG}>
              <th scope="row" className={O_DAU}>
                <Link to={`/purchase-orders/${d.id}`} className={LIEN_KET}>
                  {d.soDonMua || `#${d.id}`}
                </Link>
                {d.khoNhap?.tenKho ? <div className="mt-0.5 text-xs leading-4 text-bo-muted">{d.khoNhap.tenKho}</div> : null}
              </th>
              <td className={cn(O, "text-slate-700")}>{formatDate(ngayDat(d))}</td>
              <td className={cn(O, "text-slate-700")}>{formatDate(d.ngayGiaoDuKien)}</td>
              <td className={cn(O, "whitespace-nowrap text-[13px]")}>
                <GiaoHang giao={giao} />
              </td>
              <td className={cn(O, "text-right text-slate-700")}>
                {formatNumber(tienDo.daNhan)}/{formatNumber(tienDo.dat)}
              </td>
              <td className={cn(O_CUOI, "font-semibold text-bo-foreground")}>{formatCurrency(d.tongTien)}</td>
            </tr>
          );
        })}
      </tbody>
    </Bang>
  );
}

/** Thẻ trạng thái của báo giá kèm chú thích việc đang chờ ai (chữ xám sau thẻ). */
function TrangThaiBaoGia({ trangThai }) {
  const tt = getDonMuaHangStatus(trangThai);
  const chuThich = Number(trangThai) === 1 ? "chờ nhà cung cấp" : Number(trangThai) === 2 ? "chờ duyệt" : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusBadge quyTrinh="donMua" label={tt.label} />
      {chuThich ? <span className="text-xs text-bo-muted">{chuThich}</span> : null}
    </span>
  );
}

/** Tab "Báo giá": yêu cầu báo giá chưa thành đơn mua (1, 2, 4). */
export function BangBaoGiaNcc({ baoGia }) {
  return (
    <Bang>
      <DauBang
        cot={[
          { nhan: "Mã báo giá" },
          { nhan: "Ngày gửi" },
          { nhan: "Cập nhật" },
          { nhan: "Trạng thái" },
          { nhan: "Số sản phẩm", phai: true },
          { nhan: "Tổng báo giá", phai: true },
        ]}
      />
      <tbody>
        {baoGia.map((d) => {
          const coGia = Number(d.trangThai) !== 1;
          return (
            <tr key={d.id} className={DONG}>
              <th scope="row" className={O_DAU}>
                <Link to={`/quotation/${d.id}`} className={LIEN_KET}>
                  {d.soDonMua || `#${d.id}`}
                </Link>
              </th>
              <td className={cn(O, "text-slate-700")}>{formatDate(ngayDat(d))}</td>
              <td className={cn(O, "text-slate-700")}>{formatDate(d.ngayCapNhat)}</td>
              <td className={cn(O, "whitespace-nowrap")}>
                <TrangThaiBaoGia trangThai={d.trangThai} />
              </td>
              <td className={cn(O, "text-right text-slate-700")}>{formatNumber((d.chiTietDonMuaHangs ?? []).length)}</td>
              <td className={cn(O_CUOI, "font-semibold text-bo-foreground")}>
                {coGia ? formatCurrency(d.tongTien) : <span className="font-normal text-bo-muted">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Bang>
  );
}

/** Tab "Phiếu nhập kho" (chỉ vai trò xem được phiếu nhập). */
export function BangPhieuNhapNcc({ phieus }) {
  return (
    <Bang>
      <DauBang
        cot={[
          { nhan: "Mã phiếu" },
          { nhan: "Ngày nhập" },
          { nhan: "Theo đơn mua" },
          { nhan: "Kho" },
          { nhan: "Trạng thái" },
        ]}
      />
      <tbody>
        {phieus.map((p) => {
          const tt = getGoodsReceiptStatus(p.trangThai);
          return (
            <tr key={p.id} className={DONG}>
              <th scope="row" className={O_DAU}>
                <Link to={`/goods-receipts/${p.id}`} className={LIEN_KET}>
                  {p.soPhieuNhap || `#${p.id}`}
                </Link>
              </th>
              <td className={cn(O, "text-slate-700")}>
                {p.ngayNhap ? formatDate(p.ngayNhap) : <span className="italic text-bo-muted">chờ nhập</span>}
              </td>
              <td className={O}>
                {p.donMuaHangId ? (
                  <Link to={`/purchase-orders/${p.donMuaHangId}`} className={LIEN_KET}>
                    {p.soDonMua || `#${p.donMuaHangId}`}
                  </Link>
                ) : (
                  <span className="text-bo-muted">—</span>
                )}
              </td>
              <td className={cn(O, "text-slate-700")}>{p.tenKho || "—"}</td>
              <td className="whitespace-nowrap py-3 pl-3 pr-4 sm:pr-6">
                <StatusBadge quyTrinh="phieuNhap" label={tt.label} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Bang>
  );
}

function SoVoiTruoc({ so }) {
  const pt = so.phanTram != null ? `${String(so.phanTram).replace(".", ",")}%` : "";
  if (so.loai === "tang") return <span className="font-medium text-bo-warning">Tăng {pt}</span>;
  if (so.loai === "giam") return <span className="font-medium text-bo-success">Giảm {pt}</span>;
  if (so.loai === "khongDoi") return <span className="text-bo-muted">Không đổi</span>;
  return <span className="text-bo-muted">Lần đầu mua</span>;
}

/** Tab "Sản phẩm & giá": lịch sử giá theo biến thể, để so khi duyệt báo giá mới. */
export function BangSanPhamGiaNcc({ dong }) {
  return (
    <Bang minW={880}>
      <DauBang
        cot={[
          { nhan: "Sản phẩm" },
          { nhan: "Giá gần nhất", phai: true },
          { nhan: "Thấp – cao", phai: true },
          { nhan: "So với lần trước" },
          { nhan: "Đã đặt", phai: true },
          { nhan: "Lần mua gần nhất", phai: true },
        ]}
      />
      <tbody>
        {dong.map((r) => (
          <tr key={r.bienTheId} className={DONG}>
            <th scope="row" className={cn(O_DAU, "min-w-[240px]")}>
              <div className="font-medium text-bo-foreground">{r.ten}</div>
              <div className="mt-0.5 text-xs leading-4 text-bo-muted">
                {[r.moTa, r.sku].filter(Boolean).map((phan, i) => (
                  <span key={phan}>
                    {i > 0 ? " · " : ""}
                    <span className={phan === r.sku ? "whitespace-nowrap font-mono" : "whitespace-nowrap"}>{phan}</span>
                  </span>
                ))}
              </div>
            </th>
            <td className={cn(O, "text-right font-medium text-bo-foreground")}>{formatCurrency(r.giaGanNhat)}</td>
            <td className={cn(O, "whitespace-nowrap text-right text-slate-700")}>
              {r.giaThap === r.giaCao ? formatCurrency(r.giaThap) : `${formatCurrency(r.giaThap)} – ${formatCurrency(r.giaCao)}`}
            </td>
            <td className={cn(O, "whitespace-nowrap text-[13px]")}>
              <SoVoiTruoc so={r.soVoiTruoc} />
            </td>
            <td className={cn(O, "text-right text-slate-700")}>{formatNumber(r.daDat)}</td>
            <td className={cn(O_CUOI, "text-slate-700")}>{formatDate(r.lanMuaGanNhat)}</td>
          </tr>
        ))}
      </tbody>
    </Bang>
  );
}
