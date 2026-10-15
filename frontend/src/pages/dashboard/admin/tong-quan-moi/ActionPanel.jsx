import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileInput,
  FilePen,
  FileText,
  History,
  ListChecks,
  Lock,
  PackageOpen,
  ShoppingCart,
  Store,
  Truck,
  Upload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import DauTichDong from "./DauTichDong";
import { MoreLink, Segmented } from "./ui";
import { formatSo, formatTien, thoiGianNgan } from "../tong-quan/tongQuanFormat";

const UU_TIEN = { bad: 0, warn: 1, info: 2 };
const SO_DONG_GON = 7;

/**
 * Đơn chờ xuất, Phiếu nhặt hàng và Chuyển kho nội bộ chỉ xem kho làm việc (selected_kho_id).
 * Dòng của các trang này mang theo kho: bấm vào thì đổi kho làm việc sang kho đó rồi mở trang,
 * để số trên dòng bằng số dòng trên trang. Xem "Tất cả kho" thì tách một dòng cho mỗi kho có việc
 * (backend trả viecCanXuLy.theoKho).
 */
const VIEC_THEO_KHO_LAM_VIEC = new Set(["donChoXuatKho", "phieuNhatChuaPhanCong", "phieuChuyenChoDuyet", "phieuChuyenChoXuatHang"]);

function tachTheoKho(dong, v, khoId) {
  if (!VIEC_THEO_KHO_LAM_VIEC.has(dong.key)) return [dong];
  if (khoId != null) return [{ ...dong, kho: khoId }];
  if (!Array.isArray(v.theoKho)) return [dong];
  return v.theoKho
    .filter((k) => (k[dong.key] ?? 0) > 0)
    .map((k) => ({ ...dong, key: `${dong.key}-${k.khoId}`, so: k[dong.key], phu: k.tenKho, kho: k.khoId }));
}

/** Việc đang chờ: chỉ giữ dòng có số > 0, xếp gấp trước. Một dòng = một trạng thái chứng từ, mở đúng danh sách và đúng tab (?trangThai=). */
function danhSachViec(v, khoId) {
  const tatCaKho = khoId == null;
  const ds = [
    { key: "hetThieu", ten: "Hết hàng hoặc thiếu hàng", so: v.hetHang == null ? 0 : v.hetHang + v.thieuHang, muc: "bad", icon: AlertTriangle, to: `/reports/inventory?kho=${tatCaKho ? "tat-ca" : khoId}` },
    { key: "donChoXuatKho", ten: "Đơn chờ nhặt hàng", so: v.donChoXuatKho, muc: "warn", icon: PackageOpen, to: "/goods-issues/pending-orders" },
    // Đếm phiếu bán hàng Nháp (chờ đóng gói) + Chờ xuất; danh sách phiếu xuất chỉ lọc được một trạng thái nên mở tab Tất cả
    { key: "phieuXuatChoXuatKho", ten: "Phiếu xuất chưa xuất kho", so: v.phieuXuatChoXuatKho, muc: "warn", icon: Truck, to: "/goods-issues" },
    { key: "phieuChuyenChoDuyet", ten: "Phiếu chuyển kho chờ duyệt", so: v.phieuChuyenChoDuyet, muc: "warn", icon: ArrowLeftRight, to: "/transfer-tickets?trangThai=cho-duyet" },
    { key: "phieuNhatChuaPhanCong", ten: "Phiếu nhặt chưa phân công", so: v.phieuNhatChuaPhanCong, muc: "warn", icon: ListChecks, to: "/goods-issues/pick-lists" },
    // Mở đúng tab Chờ duyệt (và đúng kho đang xem) để số trên dòng bằng số dòng trên trang
    { key: "yeuCauNhapChoDuyet", ten: "Yêu cầu nhập hàng chờ duyệt", so: v.yeuCauNhapChoDuyet, muc: "warn", icon: FileText, to: `/purchase-requests?trangThai=cho-duyet${tatCaKho ? "" : `&kho=${khoId}`}` },
    { key: "donNhapChuaGuiKho", ten: "Đơn nháp chưa gửi kho", so: v.donNhapChuaGuiKho, muc: "info", icon: FilePen, to: "/sales-orders?trangThai=nhap" },
    { key: "phieuNhapChoNhapKho", ten: "Phiếu nhập chờ nhập kho", so: v.phieuNhapChoNhapKho, muc: "info", icon: FileInput, to: "/goods-receipts?trangThai=cho-nhap-kho" },
    { key: "phieuChuyenChoXuatHang", ten: "Phiếu chuyển chờ xuất hàng", so: v.phieuChuyenChoXuatHang, muc: "info", icon: ArrowLeftRight, to: "/transfer-tickets?trangThai=cho-xuat-hang" },
    { key: "dotKiemKeDangMo", ten: "Đợt kiểm kê đang mở", so: v.dotKiemKeDangMo, muc: "info", icon: ClipboardCheck, to: "/stock-take?trangThai=dang-kiem-ke" },
    ...(tatCaKho ? [{ key: "taiKhoanBiKhoa", ten: "Tài khoản bị khóa", so: v.taiKhoanBiKhoa, muc: "info", icon: Lock, to: "/users?trangThai=0" }] : []),
  ];
  return ds
    .filter((d) => (d.so ?? 0) > 0)
    // nhom = số của cả việc, thuTu = vị trí trong danh sách: xếp như cũ; các dòng tách theo kho
    // của cùng một việc đứng liền nhau, kho nhiều việc hơn đứng trước
    .flatMap((d, thuTu) => tachTheoKho({ ...d, nhom: d.so, thuTu }, v, khoId))
    .sort((a, b) => UU_TIEN[a.muc] - UU_TIEN[b.muc] || b.nhom - a.nhom || a.thuTu - b.thuTu || b.so - a.so);
}

/** Đổi kho làm việc trước khi mở trang chỉ xem một kho. */
function datKhoLamViec(kho) {
  if (kho != null) window.localStorage.setItem("selected_kho_id", String(kho));
}

const LOAI = {
  nhap_kho: { ten: "Nhập kho", icon: Download, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  nhap_chuyen_kho: { ten: "Nhận hàng chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  xuat_kho: { ten: "Xuất kho", icon: Upload, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-issues/${x.id}/view` },
  xuat_chuyen_kho: { ten: "Xuất chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.doiTac ? `Đến ${x.doiTac}` : x.tenKho, x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`], to: (x) => `/goods-issues/${x.id}/view` },
  don_ban: { ten: "Đơn bán mới", icon: ShoppingCart, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.doiTac ?? "Đơn bán trực tiếp"], to: (x) => `/sales-orders/${x.id}` },
  ban_tai_quay: { ten: "Bán tại quầy", icon: Store, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.tenKho], to: (x) => `/sales-orders/${x.id}` },
  kiem_ke: { ten: "Kiểm kê xong", icon: ClipboardCheck, mo: (x) => [x.doiTac, x.tenKho], to: (x) => `/stock-take/${x.id}` },
};

/**
 * Cột phải, 2 tab: "Cần xử lý" (chỉ việc đang có, gấp trước) và "Hoạt động gần đây".
 * Luôn mở sẵn "Cần xử lý" để vị trí tab cố định mỗi lần tải trang; không có việc thì hiện trạng thái trống
 * kèm nút chuyển sang "Hoạt động gần đây".
 */
export default function ActionPanel({ data, khoId, loading, loiViec, loiHoatDong, onRetry }) {
  const [moRong, setMoRong] = useState(false);
  const [tabChon, setTab] = useState(null);
  const v = data?.viecCanXuLy;
  const viec = v ? danhSachViec(v, khoId) : [];
  const tong = viec.reduce((s, d) => s + d.so, 0);
  const tab = tabChon ?? "viec";
  const hienViec = moRong ? viec : viec.slice(0, SO_DONG_GON);
  const hd = data?.hoatDongGanDay ?? [];

  return (
    <section aria-label="Cần xử lý và hoạt động gần đây" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e6e9ef] bg-white">
      <header className="flex min-h-[52px] items-center justify-between gap-3 px-5 pt-4">
        <Segmented
          label="Cần xử lý hoặc hoạt động gần đây"
          value={tab}
          onChange={setTab}
          options={[
            { value: "viec", label: "Cần xử lý", badge: v ? formatSo(tong) : null, badgeTone: tong > 0 ? "bad" : null },
            { value: "hoatDong", label: "Hoạt động gần đây" },
          ]}
        />
      </header>

      <div className="relative min-h-0 flex-1 px-3 pb-3 pt-2">
        {loading ? (
          <div className="space-y-2 px-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full bg-slate-100" />)}
          </div>
        ) : tab === "viec" ? (
          loiViec ? (
            <p role="alert" className="px-2 py-2 text-[13px] text-bo-warning">
              Không tải được việc cần xử lý. <button type="button" onClick={onRetry} className="font-medium text-bo-primary hover:underline">Thử lại</button>
            </p>
          ) : viec.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
              <DauTichDong key={data?.thoiDiem} />
              <p className="text-sm font-medium text-bo-foreground">Không có việc nào đang chờ</p>
              <p className="max-w-60 text-[13px] text-bo-muted">Đơn chờ xuất, phiếu chờ duyệt và hàng thiếu sẽ hiện ở đây.</p>
              {hd.length ? (
                <button
                  type="button"
                  onClick={() => setTab("hoatDong")}
                  className="mt-1 inline-flex items-center gap-1 rounded text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                >
                  Xem hoạt động gần đây
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <ul>
                {hienViec.map((d) => (
                  <li key={d.key}>
                    <Link
                      to={d.to}
                      onClick={() => datKhoLamViec(d.kho)}
                      className="group flex h-10 items-center gap-3 rounded-lg px-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                    >
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", d.muc === "bad" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500")}>
                        {createElement(d.icon, { className: "size-[15px]", "aria-hidden": true })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-bo-foreground">{d.ten}</span>
                      {/* Tên kho luôn hiện đủ (dòng tách theo kho); tên việc rút gọn trước */}
                      {d.phu ? <span className="max-w-[45%] shrink-0 truncate text-[13px] text-bo-muted" title={d.phu}>{d.phu}</span> : null}
                      <span className={cn("text-sm font-semibold tabular-nums", d.muc === "bad" ? "text-red-600" : d.muc === "warn" ? "text-amber-700" : "text-bo-foreground")}>
                        {formatSo(d.so)}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {viec.length > SO_DONG_GON ? (
                <button
                  type="button"
                  onClick={() => setMoRong((x) => !x)}
                  aria-expanded={moRong}
                  className="ml-2 mt-1 inline-flex items-center gap-1 rounded text-[13px] font-medium text-bo-muted hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                >
                  {moRong ? "Thu gọn" : `Thêm ${viec.length - SO_DONG_GON} việc khác`}
                  <ChevronDown className={cn("size-3.5 transition-transform", moRong && "rotate-180")} aria-hidden="true" />
                </button>
              ) : null}
            </>
          )
        ) : loiHoatDong ? (
          <p role="alert" className="px-2 py-2 text-[13px] text-bo-warning">Không tải được hoạt động gần đây.</p>
        ) : hd.length === 0 ? (
          <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-bo-muted">
            <History className="size-4" aria-hidden="true" />
            Chưa có chứng từ nào hoàn tất.
          </p>
        ) : (
          <>
          <ol>
            {hd.map((x) => {
              const l = LOAI[x.loai] ?? { ten: x.loai, icon: History, mo: () => [x.tenKho], to: () => "#" };
              return (
                <li key={`${x.loai}-${x.id}`}>
                  <Link
                    to={l.to(x)}
                    className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      {createElement(l.icon, { className: "size-[14px]", "aria-hidden": true })}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium leading-5 text-bo-foreground">
                        {l.ten} <span className="font-normal text-bo-muted">· {x.maChungTu}</span>
                      </span>
                      <span className="block truncate text-xs leading-5 text-bo-muted">{l.mo(x).filter(Boolean).join(" · ")}</span>
                    </span>
                    <time dateTime={x.thoiGian} className="whitespace-nowrap pt-px text-xs tabular-nums text-bo-muted">
                      {thoiGianNgan(x.thoiGian, data.thoiDiem)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ol>
          <div className="px-2 pt-1">
            <MoreLink to="/inventory-transactions">Lịch sử kho</MoreLink>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
