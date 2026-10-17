import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Delta } from "./ui";
import { khoangKy } from "./boLoc";
import { bienDong, formatPhanTram, formatSo, formatTienNgan, tachTien, tyLe } from "../tong-quan/tongQuanFormat";
import { CHI_SO, diemDaTron, tongHopKy } from "../tong-quan/tongQuanSoLieu";

export const ID_BIEU_DO = "tq-bieu-do-ky";

/**
 * 4 chỉ số của kỳ xem trong dải đầu trang. Mỗi ô là một tab: bấm để biểu đồ bên dưới vẽ chỉ số đó theo ngày
 * (hoặc tháng). Số so sánh: kỳ liền trước (7/30 ngày) hoặc cùng kỳ năm trước (12 tháng); kỳ trước bằng 0 thì
 * không ghi % mà ghi một ý có ích (biên lãi, số ngày có đơn). Dòng phụ chỉ ghi số đọc ngay; cách tính và số kỳ trước
 * nằm ở chú thích khi rê chuột (title).
 */
export default function KpiStrip({ data, ky, loading, error, onRetry, chon, setChon }) {
  const dt = data?.doanhThu;
  const { nay, truoc } = tongHopKy(dt);
  const k = khoangKy(ky, data?.thoiDiem);
  const namTruoc = dt?.kieuSoSanh === "cung_ky_nam_truoc";
  const soVoi = namTruoc ? " so với năm trước" : " so với kỳ trước";
  const bien = nay ? tyLe(nay.loiNhuan, nay.doanhThu) : null;
  const daTron = diemDaTron(dt);
  const coDon = daTron.filter((d) => d.soDon > 0).length;
  const donVi = dt?.nhom === "thang" ? "tháng" : "ngày";

  /* Phần chữ sau % là một khối không ngắt giữa chừng: ô hẹp thì cả khối xuống dòng ("+13,7%" / "so với kỳ trước"). */
  const khoiSoVoi = <span className="whitespace-nowrap">{soVoi}</span>;
  const khoiBien = (
    <span className="whitespace-nowrap @max-[400px]/dau:block">
      <span className="@max-[400px]/dau:hidden"> ·</span> biên lãi {formatPhanTram(bien)}
    </span>
  );
  const phu = {
    doanhThu: { soVoi: khoiSoVoi, khongSo: "Kỳ trước chưa có số liệu" },
    loiNhuan: { soVoi: bien == null ? khoiSoVoi : khoiBien, khongSo: bien == null ? "" : `Biên lãi gộp ${formatPhanTram(bien)}` },
    soDon: { soVoi: khoiSoVoi, khongSo: coDon ? `Có đơn trong ${formatSo(coDon)}/${formatSo(daTron.length)} ${donVi}` : "Chưa có đơn đã giao" },
    tbDon: { soVoi: khoiSoVoi, khongSo: "", cachTinh: "Doanh thu ÷ số đơn đã giao" },
  };

  if (error && !loading) {
    return (
      <div role="alert" className="flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-6 text-sm text-bo-muted">
        Không tải được kết quả kinh doanh của kỳ.
        <button type="button" onClick={onRetry} className="cursor-pointer font-medium text-bo-primary hover:underline">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div role="tablist" aria-label="Chỉ số của kỳ, chọn để xem theo ngày" className="grid min-w-0 flex-1 grid-cols-2 @min-[640px]/dau:grid-cols-4">
      {CHI_SO.map((c, i) => {
        const on = c.key === chon;
        const gt = nay?.[c.key] ?? 0;
        const so = c.tien ? tachTien(gt) : { so: formatSo(gt), donVi: "đơn" };
        const bd = truoc ? bienDong(gt, truoc[c.key]) : null;
        const p = phu[c.key];
        const tieuDe =
          [
            p.cachTinh,
            truoc?.[c.key] != null
              ? `${namTruoc ? "Cùng kỳ năm trước" : "Kỳ trước"} (${k.soSanh}): ${c.tien ? formatTienNgan(truoc[c.key]) : `${formatSo(truoc[c.key])} đơn`}`
              : null,
          ]
            .filter(Boolean)
            .join(". ") || undefined;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={ID_BIEU_DO}
            title={tieuDe}
            onClick={() => setChon(c.key)}
            className={cn(
              "flex min-w-0 cursor-pointer flex-col justify-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
              "@max-[400px]/dau:px-3.5 @min-[640px]/dau:py-4",
              // Vạch ngăn: 2 × 2 trên điện thoại, một hàng 4 ô từ 640px
              i % 2 === 0 && "border-r border-[#eef1f5]",
              i < 2 && "border-b border-[#eef1f5] @min-[640px]/dau:border-b-0",
              i === 1 && "@min-[640px]/dau:border-r",
              on ? "shadow-[inset_0_-2px_0_var(--color-bo-primary)]" : "shadow-[inset_0_-2px_0_transparent]",
            )}
          >
            <span className={cn("truncate text-sm @max-[400px]/dau:text-[13px]", on ? "font-medium text-bo-foreground" : "text-bo-muted")}>{c.ten}</span>
            {loading ? (
              <span className="flex flex-col gap-1.5 py-1" aria-hidden="true">
                <Skeleton className="h-6 w-3/4 bg-slate-100" />
                <Skeleton className="h-3 w-1/2 bg-slate-100" />
              </span>
            ) : (
              <>
                <span className="truncate whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.025em] text-bo-foreground @min-[800px]/dau:text-2xl @min-[800px]/dau:leading-8">
                  {so.so}
                  <span className="ml-1 text-sm font-medium tracking-normal text-bo-muted">{so.donVi}</span>
                </span>
                {/* Không có gì để ghi thì vẫn giữ chiều cao dòng để 4 ô thẳng hàng; ô hẹp thì xuống dòng thay vì cắt */}
                <span className="min-h-4 text-xs text-bo-muted">
                  {bd ? (
                    <>
                      <Delta bd={bd} />
                      {p.soVoi}
                    </>
                  ) : (
                    p.khongSo
                  )}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
