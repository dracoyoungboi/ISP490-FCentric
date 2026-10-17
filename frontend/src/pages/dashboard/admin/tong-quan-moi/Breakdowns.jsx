import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta, LE } from "./ui";
import { MAU2 } from "./mau";
import { bienDong, formatPhanTram, formatSo, formatTienNgan, tyLe } from "../tong-quan/tongQuanFormat";
import { NHAN_KY } from "./boLoc";

/* Mỗi dòng: tên trên nền trắng (nền xanh nhạt chỉ dành cho kho đang xem), Doanh thu, Tỷ trọng kèm thanh nhỏ, cột thứ tư.
   Lưới cột giống nhau ở cả hai danh sách để số thẳng hàng. Thẻ hẹp (≤ 520px) bỏ cột Tỷ trọng, thanh mảnh xuống dưới tên.
   Điện thoại (≤ 440px): hai cột, tên rộng hết bên trái; doanh thu và cột thứ tư xếp chồng bên phải. */
const LUOI = [
  "grid grid-cols-[minmax(0,1fr)_112px_124px_84px] items-center gap-x-4",
  "@max-[520px]:grid-cols-[minmax(0,1fr)_104px_64px] @max-[520px]:gap-x-2.5",
  "@max-[440px]:grid-cols-[minmax(0,1fr)_auto] @max-[440px]:gap-x-3 @max-[440px]:gap-y-0.5",
].join(" ");
const AN_HEP = "@max-[520px]:hidden";

/**
 * Phân bổ doanh thu của kỳ theo kho bán và theo kênh bán, cùng một kiểu bảng gọn: thanh tỷ trọng nằm trong cột
 * Tỷ trọng (dài theo % của tổng), không trải nền sau tên để khỏi giống dòng đang chọn. Không dùng màu riêng cho từng
 * kênh. Thẻ rộng (≥ 1100px) hai danh sách nằm cạnh nhau.
 * Số đơn và giá trị trung bình mỗi đơn ở chú thích khi rê chuột.
 */
export default function Breakdowns({ data, ky, khoId, loading, loiKho, loiKenh, onRetry, className }) {
  const dsKho = [...(data?.doanhThuTheoKho ?? [])].sort((a, b) => b.doanhThu - a.doanhThu);
  const tongKho = dsKho.reduce((s, r) => s + r.doanhThu, 0);
  const namTruoc = ky === "12_thang";

  const dsKenh = (data?.theoKenh ?? []).filter((k) => k.doanhThu > 0 || k.soDon > 0 || k.soDonHoan > 0).sort((a, b) => b.doanhThu - a.doanhThu);
  const tongKenh = dsKenh.reduce((s, k) => s + k.doanhThu, 0);
  const tongHoan = dsKenh.reduce((s, k) => s + k.soDonHoan, 0);
  const tongDon = dsKenh.reduce((s, k) => s + k.soDon + k.soDonHoan, 0);

  const trong = !loiKho && !loiKenh && tongKho === 0 && tongKenh === 0;

  return (
    <Card
      className={className}
      title="Phân bổ doanh thu"
      scope={NHAN_KY[ky]}
      loading={loading}
      empty={trong}
      emptyIcon={Store}
      emptyText="Chưa có đơn đã giao trong kỳ."
      bodyClassName="grid grid-cols-1 @min-[1100px]:grid-cols-2"
    >
      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 pb-3.5 pt-3.5")}>
        <DauCot ten="Kho bán" cot4={namTruoc ? "So năm trước" : "Biến động"} />
        {loiKho ? (
          <Loi onRetry={onRetry} />
        ) : (
          dsKho.map((r) => {
            const bd = bienDong(r.doanhThu, r.doanhThuKyTruoc);
            const chi = `${r.tenKho}${r.laKhoTong && !/kho tổng/i.test(r.tenKho) ? " (Kho tổng)" : ""}: ${
              r.soDon ? `${formatSo(r.soDon)} đơn, trung bình ${formatTienNgan(r.doanhThu / r.soDon)}/đơn` : "chưa có đơn trong kỳ"
            }${r.doanhThuKyTruoc ? `. Kỳ trước ${formatTienNgan(r.doanhThuKyTruoc)}` : ""}`;
            return (
              <DongThanh
                key={r.khoId}
                ten={r.tenKho}
                phanTram={tyLe(r.doanhThu, tongKho)}
                chon={khoId === r.khoId}
                mo={khoId != null && khoId !== r.khoId}
                giaTri={formatTienNgan(r.doanhThu)}
                cot4={bd ? <Delta bd={bd} /> : <span className="text-bo-muted">{r.doanhThu > 0 && !r.doanhThuKyTruoc ? "Mới" : "—"}</span>}
                chiTiet={chi}
              />
            );
          })
        )}
      </div>

      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 border-t border-[#eef1f5] pb-3.5 pt-3.5 @min-[1100px]:border-l @min-[1100px]:border-t-0")}>
        <DauCot ten="Kênh bán" cot4="Tỷ lệ hoàn" />
        {loiKenh ? (
          <Loi onRetry={onRetry} />
        ) : dsKenh.length === 0 ? (
          <p className="py-2 text-[13px] text-bo-muted">Chưa có đơn đã giao trong kỳ.</p>
        ) : (
          <>
            {dsKenh.map((k) => (
              <DongThanh
                key={k.maKenh}
                ten={k.tenKenh}
                phanTram={tyLe(k.doanhThu, tongKenh)}
                giaTri={formatTienNgan(k.doanhThu)}
                cot4={<span className="tabular-nums text-bo-foreground">{formatPhanTram(tyLe(k.soDonHoan, k.soDon + k.soDonHoan))}</span>}
                nhanHep="Hoàn"
                chiTiet={`${k.tenKenh}: ${formatSo(k.soDon)} đơn đã giao, ${formatSo(k.soDonHoan)} đơn hoàn${
                  k.soDon ? `, trung bình ${formatTienNgan(k.doanhThu / k.soDon)}/đơn` : ""
                }`}
              />
            ))}
            <p className="pt-2 text-xs text-bo-muted">
              {tongHoan
                ? `Đơn hoàn trong kỳ: ${formatSo(tongHoan)} đơn, bằng ${formatPhanTram(tyLe(tongHoan, tongDon))} số đơn.`
                : "Không có đơn hoàn trong kỳ."}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function DauCot({ ten, cot4 }) {
  return (
    <div className={cn(LUOI, "pb-1 text-xs font-medium leading-4 text-bo-muted")} aria-hidden="true">
      <span>{ten}</span>
      <span className="text-right">Doanh thu</span>
      <span className={cn("text-right", AN_HEP)}>Tỷ trọng</span>
      <span className="text-right @max-[440px]:hidden">{cot4}</span>
    </div>
  );
}

function DongThanh({ ten, phanTram, giaTri, cot4, nhanHep, chiTiet, chon, mo }) {
  const rong = `${Math.max(0, Math.min(100, phanTram ?? 0))}%`;
  const thanh = { width: rong, background: MAU2.chinh, opacity: mo ? 0.4 : 1 };
  return (
    <div className={cn(LUOI, "-mx-2 rounded-md px-2 py-2", chon && "bg-bo-primary-soft")} title={chiTiet}>
      <div className="min-w-0 @max-[440px]:row-span-2">
        <span className={cn("block truncate text-sm font-medium @max-[440px]:whitespace-normal", mo ? "text-bo-muted" : "text-bo-foreground")}>{ten}</span>
        {/* Thẻ hẹp: cột Tỷ trọng ẩn, thanh mảnh nằm dưới tên */}
        <span className="mt-1.5 hidden h-1 overflow-hidden rounded-full bg-[#eef1f5] @max-[520px]:block" aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
      </div>
      <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-bo-foreground">{giaTri}</span>
      <span className={cn("flex items-center justify-end gap-2", AN_HEP)}>
        <span className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-[#eef1f5]" aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
        <span className="w-9 shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-bo-muted">
          <span className="sr-only">Tỷ trọng </span>
          {formatPhanTram(phanTram, 0)}
        </span>
      </span>
      <span className="whitespace-nowrap text-right text-sm @max-[440px]:text-xs">
        {/* Điện thoại không có dòng tiêu đề cột này nên ghi nhãn ngắn */}
        {nhanHep ? <span className="hidden text-bo-muted @max-[440px]:inline">{nhanHep} </span> : null}
        {cot4}
      </span>
    </div>
  );
}

function Loi({ onRetry }) {
  return (
    <p role="alert" className="py-2 text-[13px] text-bo-warning">
      Không tải được số liệu.{" "}
      <button type="button" onClick={onRetry} className="cursor-pointer font-medium text-bo-primary hover:underline">
        Thử lại
      </button>
    </p>
  );
}
