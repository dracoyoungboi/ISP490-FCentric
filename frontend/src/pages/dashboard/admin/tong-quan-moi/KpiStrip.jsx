import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Delta } from "./ui";
import GiaiThich from "./GiaiThich";
import { bienDong, formatPhanTram, formatSo, formatTienNgan, ngayDayDu, tachTien, tenThuGiuaCau, tyLe } from "../tong-quan/tongQuanFormat";
import { CHI_SO, giaTri } from "../tong-quan/tongQuanSoLieu";
import { khoangChu, moTaKy } from "../tong-quan/kyXem";
import { t } from "@/i18n";

export const ID_BIEU_DO = "tq-bieu-do-ky";

const nf = new Intl.NumberFormat("vi-VN");
const gioPhut = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Số lớn của một ô: tiền theo triệu / tỷ; giá trị trung bình dưới 1 triệu ghi "459 nghìn ₫"; số đơn kèm "đơn". */
function soLon(c, v) {
  if (v == null) return { so: "—", donVi: "" };
  if (c.key === "tbDon" && Math.abs(v) < 1e6) return { so: nf.format(Math.round(v / 1000)), donVi: t("nghìn ₫") };
  if (c.tien) return tachTien(v);
  return { so: formatSo(v), donVi: t("đơn") };
}

const fmt = (c, v) => (v == null ? "—" : c.tien ? formatTienNgan(v) : t("{{soDon}} đơn", { soDon: formatSo(v), count: v }));

/**
 * 4 chỉ số của kỳ trong dải đầu trang (đặc tả bản 2, mục 2, 10). Mỗi ô là một tab: bấm để biểu đồ vẽ chỉ số đó. Tên chỉ số
 * gạch chân chấm mở hộp giải thích cách tính. Dòng phụ: % so với kỳ trước (rê chuột thấy khoảng đem so); Hôm nay ghi số
 * tiền cùng giờ thứ đó tuần trước thay cho %; kho mới mở sau đầu kỳ so sánh thì không ghi %.
 * Ô Doanh thu của kỳ đang chạy có thêm dòng "Chờ xuất": đơn đặt trong kỳ chưa xuất kho nên chưa tính doanh thu.
 */
export default function KpiStrip({ data, k, khoId, dsKho, loading, error, onRetry, chon, setChon }) {
  const kq = data?.ketQua;
  const nay = kq?.nay;
  const truoc = kq?.truoc;
  const homNay = k?.ma === "hom_nay";
  const [, soVoiChu] = moTaKy(k);
  const khoMoi = (kq?.khoMoTrongKySoSanh ?? []).map((id) => dsKho.find((x) => x.id === id)).filter(Boolean);
  const khoDangXemMoi = khoId != null && khoMoi.some((x) => x.id === khoId) ? khoMoi.find((x) => x.id === khoId) : null;
  const tenKho = khoId == null ? t("Tất cả kho") : dsKho.find((x) => x.id === khoId)?.tenKho;
  const kc = khoangChu(k);
  const kyTruocChu = homNay
    ? t("Cùng giờ tuần trước")
    : kc.cungGio
      ? t("Kỳ so sánh ({{khoang}}, cùng giờ)", { khoang: kc.truoc })
      : t("Kỳ so sánh ({{khoang}})", { khoang: kc.truoc });

  if (error && !loading) {
    return (
      <div role="alert" className="flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-6 text-sm text-bo-muted">
        {t("Không tải được kết quả kinh doanh của kỳ.")}
        <button type="button" onClick={onRetry} className="cursor-pointer font-medium text-bo-primary hover:underline">
          {t("Thử lại")}
        </button>
      </div>
    );
  }

  const giaiThich = nay ? hopGiaiThich(nay, truoc, kyTruocChu, tenKho, khoId == null ? khoMoi : []) : {};

  return (
    <div role="tablist" aria-label={t("Chỉ số của kỳ, chọn để xem biểu đồ")} className="grid min-w-0 flex-1 grid-cols-2 @min-[640px]/dau:grid-cols-4">
      {CHI_SO.map((c, i) => {
        const on = c.key === chon;
        const v = giaTri(nay, c.key);
        const w = giaTri(truoc, c.key);
        const so = soLon(c, v);
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={ID_BIEU_DO}
            onClick={() => setChon(c.key)}
            className={cn(
              "flex min-w-0 cursor-pointer flex-col justify-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
              "@max-[400px]/dau:px-3.5 @min-[640px]/dau:py-4",
              i % 2 === 0 && "border-r border-[#eef1f5]",
              i < 2 && "border-b border-[#eef1f5] @min-[640px]/dau:border-b-0",
              i === 1 && "@min-[640px]/dau:border-r",
              on ? "shadow-[inset_0_-2px_0_var(--color-bo-primary)]" : "shadow-[inset_0_-2px_0_transparent]",
            )}
          >
            <span className={cn("truncate text-sm @max-[400px]/dau:text-[13px]", on ? "font-medium text-bo-foreground" : "text-bo-muted")}>
              {nay ? <GiaiThich {...giaiThich[c.key]}>{c.ten}</GiaiThich> : c.ten}
            </span>
            {loading ? (
              <span className="flex flex-col gap-1.5 py-1" aria-hidden="true">
                <Skeleton className="h-6 w-3/4 bg-slate-100" />
                <Skeleton className="h-3 w-1/2 bg-slate-100" />
              </span>
            ) : (
              <>
                <span className="truncate whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.025em] text-bo-foreground @min-[800px]/dau:text-2xl @min-[800px]/dau:leading-8">
                  {so.so}
                  {so.donVi ? <span className="ml-1 text-sm font-medium tracking-normal text-bo-muted">{so.donVi}</span> : null}
                </span>
                <span className="min-h-4 text-xs text-bo-muted">
                  <DongSoSanh c={c} v={v} w={w} nay={nay} k={k} homNay={homNay} soVoiChu={soVoiChu} khoDangXemMoi={khoDangXemMoi} khoMoi={khoMoi} homQua={giaTri(kq?.homQuaCungGio, c.key)} />
                </span>
                {c.key === "doanhThu" && k?.dangChay && kq?.choXuatSoDon > 0 ? (
                  <span className="truncate text-xs text-bo-muted" title={t("Đơn đặt trong kỳ, chưa xuất kho nên chưa tính vào doanh thu")}>
                    {t("Chờ xuất {{soDon}} đơn · {{tien}}", { soDon: formatSo(kq.choXuatSoDon), tien: formatTienNgan(kq.choXuatTien), count: Number(kq.choXuatSoDon) })}
                  </span>
                ) : null}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DongSoSanh({ c, v, w, nay, k, homNay, soVoiChu, khoDangXemMoi, khoMoi, homQua }) {
  if (!nay) return null;
  if (khoDangXemMoi && !homNay) {
    return t("kho mới mở {{ngay}}, kỳ trước chưa đủ ngày để so", { ngay: ngayDayDu(khoDangXemMoi.ngayMo) });
  }
  if (v == null) return nay.soDon <= 0 && nay.doanhThu === 0 ? t("chưa có đơn") : t("doanh thu kỳ này chưa dương");
  if (homNay) {
    const thu = k?.tuTruoc ? tenThuGiuaCau(k.tuTruoc) : "";
    return (
      <span title={t("Tính từ 00:00 tới {{gio}}, cùng giờ với hôm nay. Hôm qua cùng giờ: {{homQua}}", { gio: k?.den ? gioPhut(k.den) : "", homQua: fmt(c, homQua) })}>
        {t("{{thu}} tuần trước: {{so}}", { thu, so: fmt(c, w) })}
      </span>
    );
  }
  if (!w) return t("kỳ trước chưa có đơn");
  const bd = bienDong(v, w);
  if (c.key === "loiNhuan") {
    return (
      <>
        <Delta bd={bd} />
        <span className="whitespace-nowrap">{t(" · biên lãi {{bien}}", { bien: nay.doanhThu > 0 ? formatPhanTram(tyLe(nay.loiNhuan, nay.doanhThu)) : "—" })}</span>
      </>
    );
  }
  const ghiChu = khoMoi.length ? t(". Gồm {{kho}} mở trong kỳ so sánh", { kho: khoMoi.map((x) => x.tenKho).join(", ") }) : "";
  return (
    <>
      <Delta bd={bd} />
      <span className="whitespace-nowrap" title={`${soVoiChu}${ghiChu}`}>
        {t(" so với kỳ trước")}
      </span>
    </>
  );
}

/** Nội dung hộp giải thích của 4 chỉ số, tính bằng chính số đang hiện. */
function hopGiaiThich(a, b, kyTruocChu, tenKho, khoMoi) {
  const tien = formatTienNgan;
  const tb = (x) => (x && x.soDon > 0 && x.doanhThu > 0 ? x.doanhThu / x.soDon : null);
  const moiMo = khoMoi.map((x) => t(" {{kho}} mở ngày {{ngay}}, kỳ so sánh chưa có đủ số của kho này.", { kho: x.tenKho, ngay: ngayDayDu(x.ngayMo) })).join("");
  const bien = a.doanhThu > 0 ? a.loiNhuan / a.doanhThu : null;
  return {
    doanhThu: {
      tieuDe: t("Doanh thu"),
      moTa: t("Tiền hàng của các đơn đã xuất đủ hàng trong kỳ (đơn tại quầy tính lúc bán), mọi kênh, sau giảm giá. Không gồm thuế GTGT và phí vận chuyển; đơn sàn không ghi thuế nên giữ nguyên tiền hàng. Hàng khách trả và đơn sàn bị hoàn trừ vào ngày nhập hàng trả về, nên số của kỳ đã qua không đổi. {{kho}}.", { kho: tenKho }),
      dong: [
        [t("Tiền hàng đơn đã xuất"), tien(a.tienHangXuat)],
        [t("Khách trả hàng, đơn hoàn"), `− ${tien(a.tienHangTra)}`],
        [t("Thuế GTGT trong giá"), `− ${tien(a.thueGtgt)}`],
        [t("Doanh thu"), tien(a.doanhThu), true],
      ],
      ghiChu: `${kyTruocChu} ${tien(b?.doanhThu ?? 0)}.${moiMo}`,
      lienKet: { to: "/reports/revenue", ten: t("Xem báo cáo doanh thu") },
    },
    loiNhuan: {
      tieuDe: t("Lợi nhuận gộp"),
      moTa: t("Doanh thu trừ giá vốn của hàng đã bán (giá nhập của từng lô). Hàng khách trả còn bán được thì cộng lại giá vốn; hàng trả bị lỗi không cộng lại. Chưa trừ phí sàn, vận chuyển, lương, mặt bằng."),
      dong: [
        [t("Doanh thu"), tien(a.doanhThu)],
        [t("Giá vốn hàng đã xuất"), `− ${tien(a.giaVonXuat)}`],
        [t("Giá vốn hàng trả còn bán được"), `+ ${tien(a.giaVonTraTot)}`],
        [t("Lợi nhuận gộp"), tien(a.loiNhuan), true],
      ],
      ghiChu: bien == null ? null : [
        a.giaVonTraLoi ? t("Hàng trả lỗi {{tien}} giá vốn không cộng lại.", { tien: tien(a.giaVonTraLoi) }) : null,
        t("Biên lãi {{bien}}: cứ 100.000 ₫ bán ra thì lãi gộp {{lai}} ₫.", { bien: formatPhanTram(bien * 100), lai: nf.format(Math.round((bien * 100000) / 1000) * 1000) }),
      ].filter(Boolean).join(" "),
      lienKet: { to: "/reports/revenue", ten: t("Xem báo cáo doanh thu") },
    },
    soDon: {
      tieuDe: t("Đơn đã bán"),
      moTa: t("Số đơn đã xuất đủ hàng trong kỳ (đơn tại quầy tính lúc bán). Đơn khách trả cả đơn hoặc sàn hoàn về trừ vào kỳ có ngày trả, cùng cách với doanh thu, nên số của kỳ đã qua không tự giảm. Đơn hủy không tính."),
      dong: [
        [t("Đơn đã xuất đủ hàng"), formatSo(a.donXuat)],
        [t("Đơn trả, hoàn trong kỳ"), `− ${formatSo(a.donTra)}`],
        [t("Đơn đã bán"), formatSo(a.soDon), true],
      ],
      ghiChu: t("{{kyTruoc}} {{soDon}} đơn.", { kyTruoc: kyTruocChu, soDon: formatSo(b?.soDon ?? 0), count: Number(b?.soDon ?? 0) }),
      lienKet: { to: "/sales-orders", ten: t("Xem danh sách đơn") },
    },
    tbDon: {
      tieuDe: t("Giá trị đơn trung bình"),
      moTa: t("Trung bình mỗi đơn khách trả bao nhiêu, chưa gồm thuế GTGT."),
      dong: [
        [t("Doanh thu"), tien(a.doanhThu)],
        [t("÷ Đơn đã bán"), formatSo(a.soDon)],
        [t("Trung bình"), tb(a) == null ? "—" : tien(tb(a)), true],
      ],
      ghiChu: tb(a) == null
        ? t("Doanh thu hoặc số đơn kỳ này chưa dương nên chưa tính trung bình.")
        : t("{{kyTruoc}} {{tien}} mỗi đơn.", { kyTruoc: kyTruocChu, tien: tb(b) == null ? "—" : tien(tb(b)) }),
    },
  };
}
