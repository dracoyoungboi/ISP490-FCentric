import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta, LE } from "./ui";
import { MAU2 } from "./mau";
import { bienDong, formatPhanTram, formatSo, formatTienNgan, tyLe } from "../tong-quan/tongQuanFormat";
import { t } from "@/i18n";

/** Kênh POS / trực tiếp: máy chủ trả tên cố định tiếng Việt nên dịch; tên kênh sàn là dữ liệu, giữ nguyên. */
const tenKenhHien = (k) => (k.maKenh === "POS" || k.maKenh === "TRUC_TIEP" ? t(k.tenKenh) : k.tenKenh);

/* Mỗi dòng: tên trên nền trắng (nền xanh nhạt chỉ dành cho kho đang xem), Doanh thu, Tỷ trọng kèm thanh nhỏ, cột thứ tư.
   Lưới cột giống nhau ở cả hai danh sách để số thẳng hàng. Bản hẹp (bỏ cột Tỷ trọng, thanh mảnh xuống dưới tên) dùng khi
   thẻ ≤ 520px, và khi hai danh sách nằm cạnh nhau ở thẻ 680–1099px (mỗi danh sách chỉ còn nửa thẻ).
   Điện thoại (≤ 440px): hai cột, tên rộng hết bên trái; doanh thu và cột thứ tư xếp chồng bên phải.
   Danh sách kho bỏ cột Biến động khi không kho nào có số kỳ trước (ô Doanh thu đầu trang đã báo), nhưng chỉ khi hai danh
   sách nằm cạnh nhau; xếp chồng thì giữ đủ 4 cột (ghi "Mới" / "—") để số thẳng hàng với danh sách kênh bên dưới. */
const LUOI = [
  "grid grid-cols-[minmax(0,1fr)_112px_124px_84px] items-center gap-x-4",
  "@max-[520px]:grid-cols-[minmax(0,1fr)_104px_64px] @max-[520px]:gap-x-2.5",
  "@min-[680px]:@max-[1100px]:grid-cols-[minmax(0,1fr)_104px_76px] @min-[680px]:@max-[1100px]:gap-x-2.5",
  "@max-[440px]:grid-cols-[minmax(0,1fr)_auto] @max-[440px]:gap-x-3 @max-[440px]:gap-y-0.5",
].join(" ");
const LUOI_BO_COT4_KHI_CANH = [
  "grid grid-cols-[minmax(0,1fr)_112px_124px_84px] items-center gap-x-4",
  "@max-[520px]:grid-cols-[minmax(0,1fr)_104px_64px] @max-[520px]:gap-x-2.5",
  "@min-[680px]:@max-[1100px]:grid-cols-[minmax(0,1fr)_104px] @min-[680px]:@max-[1100px]:gap-x-2.5",
  "@min-[1100px]:grid-cols-[minmax(0,1fr)_112px_124px]",
  "@max-[440px]:grid-cols-[minmax(0,1fr)_auto] @max-[440px]:gap-x-3 @max-[440px]:gap-y-0.5",
].join(" ");
const AN_HEP = "@max-[520px]:hidden @min-[680px]:@max-[1100px]:hidden";
const HIEN_HEP = "@max-[520px]:block @min-[680px]:@max-[1100px]:block";
/* Bản hẹp không có cột Tỷ trọng (thanh dưới tên chỉ để nhìn): trình đọc màn hình đọc số ở đây */
const DOC_HEP = "@max-[520px]:inline @min-[680px]:@max-[1100px]:inline";

/**
 * Phân bổ doanh thu của kỳ theo kho bán và theo kênh bán, cùng một kiểu bảng gọn: thanh tỷ trọng nằm trong cột
 * Tỷ trọng (dài theo % của tổng), không trải nền sau tên để khỏi giống dòng đang chọn. Không dùng màu riêng cho từng
 * kênh. Thẻ từ 680px hai danh sách nằm cạnh nhau (laptop không còn xếp hai tầng); 680–1099px mỗi danh sách dùng bản hẹp.
 * Số đơn và giá trị trung bình mỗi đơn ở chú thích khi rê chuột.
 */
export default function Breakdowns({ data, ky, khoId, loading, loiKho, loiKenh, onRetry, className }) {
  const dsKho = [...(data?.doanhThuTheoKho ?? [])].sort((a, b) => b.doanhThu - a.doanhThu);
  const tongKho = dsKho.reduce((s, r) => s + r.doanhThu, 0);
  const namTruoc = ky === "12_thang";
  // Không kho nào có số kỳ trước thì cột Biến động chỉ toàn "Mới" / "—": bỏ cột (chỉ đổi cách hiện, không đổi số)
  const coCotBienDong = dsKho.some((r) => r.doanhThuKyTruoc > 0);

  const dsKenh = (data?.theoKenh ?? []).filter((k) => k.doanhThu > 0 || k.soDon > 0 || k.soDonHoan > 0).sort((a, b) => b.doanhThu - a.doanhThu);
  const tongKenh = dsKenh.reduce((s, k) => s + k.doanhThu, 0);
  const tongHoan = dsKenh.reduce((s, k) => s + k.soDonHoan, 0);
  const tongDon = dsKenh.reduce((s, k) => s + k.soDon + k.soDonHoan, 0);

  const trong = !loiKho && !loiKenh && tongKho === 0 && tongKenh === 0;

  return (
    <Card
      className={className}
      title={t("Phân bổ doanh thu")}
      loading={loading}
      empty={trong}
      emptyIcon={Store}
      emptyText={t("Chưa có đơn đã giao trong kỳ.")}
      bodyClassName="grid grid-cols-1 @min-[680px]:grid-cols-2"
    >
      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 pb-3.5 pt-3.5")}>
        <DauCot ten={t("Kho bán")} cot4={namTruoc ? t("So năm trước") : t("Biến động")} anCot4KhiCanh={!coCotBienDong} />
        {loiKho ? (
          <Loi onRetry={onRetry} />
        ) : (
          dsKho.map((r) => {
            const bd = bienDong(r.doanhThu, r.doanhThuKyTruoc);
            const chi = `${r.tenKho}${r.laKhoTong && !/kho tổng/i.test(r.tenKho) ? t(" (Kho tổng)") : ""}: ${
              r.soDon ? t("{{soDon}} đơn, trung bình {{trungBinh}}/đơn", { soDon: formatSo(r.soDon), trungBinh: formatTienNgan(r.doanhThu / r.soDon), count: r.soDon }) : t("chưa có đơn trong kỳ")
            }${r.doanhThuKyTruoc ? t(". Kỳ trước {{doanhThuKyTruoc}}", { doanhThuKyTruoc: formatTienNgan(r.doanhThuKyTruoc) }) : ""}`;
            return (
              <DongThanh
                key={r.khoId}
                ten={r.tenKho}
                phanTram={tyLe(r.doanhThu, tongKho)}
                chon={khoId === r.khoId}
                mo={khoId != null && khoId !== r.khoId}
                giaTri={formatTienNgan(r.doanhThu)}
                cot4={bd ? <Delta bd={bd} /> : <span className="text-bo-muted">{r.doanhThu > 0 && !r.doanhThuKyTruoc ? t("Mới") : "—"}</span>}
                anCot4KhiCanh={!coCotBienDong}
                chiTiet={chi}
              />
            );
          })
        )}
      </div>

      <div className={cn(LE, "flex min-w-0 flex-col gap-0.5 border-t border-[#eef1f5] pb-3.5 pt-3.5 @min-[680px]:border-l @min-[680px]:border-t-0")}>
        <DauCot ten={t("Kênh bán")} cot4={t("Tỷ lệ hoàn")} />
        {loiKenh ? (
          <Loi onRetry={onRetry} />
        ) : dsKenh.length === 0 ? (
          <p className="py-2 text-[13px] text-bo-muted">{t("Chưa có đơn đã giao trong kỳ.")}</p>
        ) : (
          <>
            {dsKenh.map((k) => (
              <DongThanh
                key={k.maKenh}
                ten={tenKenhHien(k)}
                phanTram={tyLe(k.doanhThu, tongKenh)}
                giaTri={formatTienNgan(k.doanhThu)}
                cot4={<span className="tabular-nums text-bo-foreground">{formatPhanTram(tyLe(k.soDonHoan, k.soDon + k.soDonHoan))}</span>}
                nhanHep={t("Hoàn")}
                chiTiet={t("{{tenKenh}}: {{soDon}} đơn đã giao, {{soDonHoan}} đơn hoàn{{trungBinh}}", { tenKenh: tenKenhHien(k), soDon: formatSo(k.soDon), count: Number(k.soDon), soDonHoan: formatSo(k.soDonHoan), trungBinh: k.soDon ? t(", trung bình {{tien}}/đơn", { tien: formatTienNgan(k.doanhThu / k.soDon) }) : "" })}
              />
            ))}
            <p className="pt-2 text-xs text-bo-muted">
              {tongHoan
                ? t("Đơn hoàn trong kỳ: {{tongHoan}} đơn, bằng {{tyLe}} số đơn.", { tongHoan: formatSo(tongHoan), tyLe: formatPhanTram(tyLe(tongHoan, tongDon)), count: tongHoan })
                : t("Không có đơn hoàn trong kỳ.")}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

/** anCot4KhiCanh: bỏ cột thứ tư khi hai danh sách nằm cạnh nhau (danh sách kho không có số kỳ trước). */
function DauCot({ ten, cot4, anCot4KhiCanh }) {
  return (
    <div className={cn(anCot4KhiCanh ? LUOI_BO_COT4_KHI_CANH : LUOI, "pb-1 text-xs font-medium leading-4 text-bo-muted")} aria-hidden="true">
      <span>{ten}</span>
      <span className="text-right">{t("Doanh thu")}</span>
      <span className={cn("text-right", AN_HEP)}>{t("Tỷ trọng")}</span>
      <span className={cn("whitespace-nowrap text-right @max-[440px]:hidden", anCot4KhiCanh && "@min-[680px]:hidden")}>{cot4}</span>
    </div>
  );
}

function DongThanh({ ten, phanTram, giaTri, cot4, nhanHep, chiTiet, chon, mo, anCot4KhiCanh }) {
  const rong = `${Math.max(0, Math.min(100, phanTram ?? 0))}%`;
  const thanh = { width: rong, background: MAU2.chinh, opacity: mo ? 0.4 : 1 };
  return (
    <div className={cn(anCot4KhiCanh ? LUOI_BO_COT4_KHI_CANH : LUOI, "-mx-2 rounded-md px-2 py-2", chon && "bg-bo-primary-soft")} title={chiTiet}>
      <div className="min-w-0 @max-[440px]:row-span-2">
        <span className={cn("block truncate text-sm font-medium @max-[440px]:whitespace-normal", mo ? "text-bo-muted" : "text-bo-foreground")}>
          {ten}
          <span className={cn("sr-only hidden", DOC_HEP)}>{t(", tỷ trọng {{phanTram}}", { phanTram: formatPhanTram(phanTram, 0) })}</span>
        </span>
        {/* Bản hẹp: cột Tỷ trọng ẩn, thanh mảnh nằm dưới tên */}
        <span className={cn("mt-1.5 hidden h-1 overflow-hidden rounded-full bg-[#eef1f5]", HIEN_HEP)} aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
      </div>
      <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-bo-foreground">{giaTri}</span>
      <span className={cn("flex items-center justify-end gap-2", AN_HEP)}>
        <span className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-[#eef1f5]" aria-hidden="true">
          <span className="block h-full rounded-full" style={thanh} />
        </span>
        <span className="w-9 shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-bo-muted">
          <span className="sr-only">{t("Tỷ trọng")} </span>
          {formatPhanTram(phanTram, 0)}
        </span>
      </span>
      <span className={cn("whitespace-nowrap text-right text-sm @max-[440px]:text-xs", anCot4KhiCanh && "@min-[680px]:hidden")}>
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
      {t("Không tải được số liệu.")}{" "}
      <button type="button" onClick={onRetry} className="cursor-pointer font-medium text-bo-primary hover:underline">
        {t("Thử lại")}
      </button>
    </p>
  );
}
