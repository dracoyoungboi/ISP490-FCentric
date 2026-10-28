import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardCheck,
  FileInput,
  FilePen,
  FileText,
  ListChecks,
  Lock,
  PackageOpen,
  RefreshCcw,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DauTichDong from "./DauTichDong";
import { Card, LE } from "./ui";
import { formatSo } from "../tong-quan/tongQuanFormat";
import { danhSachViec } from "../tong-quan/viecCanXuLy";
import { setKhoLamViecId } from "@/utils/khoLamViec";

const SO_DONG_GON = 7;

const BIEU_TUONG = {
  loiDongBo: RefreshCcw,
  donMuaQuaHan: Truck,
  donChoXuatKho: PackageOpen,
  phieuXuatChoXuatKho: PackageOpen,
  phieuChuyenChoDuyet: ArrowLeftRight,
  phieuNhatChuaPhanCong: ListChecks,
  yeuCauNhapChoDuyet: FileText,
  donNhapChuaGuiKho: FilePen,
  phieuNhapChoNhapKho: FileInput,
  phieuChuyenChoXuatHang: ArrowLeftRight,
  dotKiemKeDangMo: ClipboardCheck,
  taiKhoanBiKhoa: Lock,
};

/** Đổi kho đang xem (kho làm việc) trước khi mở trang chỉ xem một kho; phát sự kiện để ô chọn kho khớp theo. */
function datKhoLamViec(kho) {
  if (kho != null) setKhoLamViecId(kho);
}

/**
 * Cần xử lý: việc đang chờ, gấp trước (đỏ), tối đa 7 dòng, còn lại mở bằng "Xem cả … việc".
 * Không có việc thì hiện dấu tích và một câu ngắn.
 */
export default function ActionPanel({ data, khoId, loading, error, onRetry, className }) {
  const [moRong, setMoRong] = useState(false);
  const v = data?.viecCanXuLy;
  const viec = v ? danhSachViec(v, khoId) : [];
  const hien = moRong ? viec : viec.slice(0, SO_DONG_GON);

  return (
    <Card
      className={className}
      title="Cần xử lý"
      right={
        viec.length > SO_DONG_GON ? (
          <button
            type="button"
            onClick={() => setMoRong((x) => !x)}
            aria-expanded={moRong}
            className="inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap rounded text-sm font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            {moRong ? "Thu gọn" : `Xem cả ${formatSo(viec.length)} việc`}
            <ChevronRight className={cn("size-4 transition-transform", moRong && "-rotate-90")} aria-hidden="true" />
          </button>
        ) : null
      }
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {!v ? null : viec.length === 0 ? (
        <div className={cn(LE, "flex items-center gap-3 py-4")}>
          <DauTichDong key={data?.thoiDiem} className="size-9" />
          <div>
            <p className="text-sm font-medium text-bo-foreground">Không có việc nào đang chờ</p>
            <p className="text-xs text-bo-muted">Đơn chờ xuất, phiếu chờ duyệt, lỗi đồng bộ sẽ hiện ở đây.</p>
          </div>
        </div>
      ) : (
        <ul>
          {hien.map((d) => (
            <li key={d.key} className="border-t border-[#eef1f5] first:border-t-0">
              <Link
                to={d.to}
                title={d.phu ? `${d.ten} – ${d.phu}` : d.ten}
                onClick={() => datKhoLamViec(d.kho)}
                className={cn(LE, "group flex items-center gap-3 py-2.5 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", d.muc === "bad" ? "bg-bo-danger-soft text-red-600" : "bg-slate-100 text-slate-500")}>
                  {createElement(BIEU_TUONG[d.loai] ?? ClipboardCheck, { className: "size-4", "aria-hidden": true })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-bo-foreground">{d.ten}</span>
                  <span className="block truncate text-xs text-bo-muted">{d.phu}</span>
                </span>
                <span className={cn("shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums", d.muc === "bad" ? "text-[#b42318]" : "text-bo-foreground")}>{formatSo(d.so)}</span>
                <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
