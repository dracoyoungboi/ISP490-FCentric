import { CalendarDays, ChevronDown, Clock3, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { docNgay, gioPhut, ngayDayDu, tenThu } from "../tong-quan/tongQuanFormat";
import { KhoMenu, KyMenu, NutCapNhat } from "./BoLocMenu";
import { FOCUS, KHUNG, NHAN_KY, khoangKy, tenKhoDangXem } from "./boLoc";

/*
 * Thanh lọc đầu trang Tổng quan. Bố cục kiểu Shopify, kiểu dáng theo hệ thống (token bo-*):
 * bên trái là nút chọn kho và nút chọn kỳ (bấm mở danh sách kèm khoảng ngày thật) cùng kỳ đem so sánh,
 * bên phải là ngày, giờ số liệu và nút cập nhật (SRS 11.1.1: nút Cập nhật + thời điểm cập nhật).
 * Không hiện tiêu đề nhìn thấy (DASHBOARD là ownTitle trong BackofficeLayout); thẻ h1 vẫn giữ cho trình đọc màn hình.
 */
export default function TongQuanHeader({ data, ky, setKy, khoId, setKhoId, dsKho, loading, refreshing, onReload }) {
  const k = khoangKy(ky, data?.thoiDiem);
  const t = docNgay(data?.thoiDiem);
  const tenKho = tenKhoDangXem(khoId, dsKho);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="sr-only">Tổng quan</h1>

      <KhoMenu data={data} dsKho={dsKho} khoId={khoId} onChange={setKhoId} disabled={loading}>
        <button type="button" aria-label={`Chọn kho, đang xem: ${tenKho}`} className={cn(KHUNG, FOCUS, "inline-flex max-w-[240px] items-center gap-2 px-3")}>
          <Warehouse className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{tenKho}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </KhoMenu>

      <KyMenu ky={ky} onChange={setKy} thoiDiem={data?.thoiDiem}>
        <button type="button" aria-label={`Chọn kỳ xem, đang xem: ${NHAN_KY[ky]}`} className={cn(KHUNG, FOCUS, "inline-flex items-center gap-2 px-3")}>
          <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          {NHAN_KY[ky]}
          <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </KyMenu>

      <span className="hidden text-[13px] text-bo-muted lg:inline" title={`Kỳ so sánh: ${k.soSanh}`}>
        so với {k.tenSoSanh.toLowerCase()}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-bo-muted sm:inline-flex">
          <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
          {t ? (
            <>
              <span className="hidden xl:inline">
                {tenThu(t)}, {ngayDayDu(data.thoiDiem)} ·
              </span>{" "}
              số liệu lúc {gioPhut(data.thoiDiem)}
            </>
          ) : (
            "Đang tải số liệu…"
          )}
        </span>
        <NutCapNhat data={data} refreshing={refreshing} onReload={onReload} />
      </div>
    </div>
  );
}
