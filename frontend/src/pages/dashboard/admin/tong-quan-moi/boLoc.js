import { docNgay } from "../tong-quan/tongQuanFormat";
import { t } from "../../../../i18n/t.js";

/* Hằng số và hàm dùng chung cho thanh lọc đầu trang Tổng quan: kiểu nút theo token hệ thống (bo-*),
   nhãn kỳ, khoảng ngày của kỳ và kỳ so sánh, danh sách kho. */

/** Nút trong thanh lọc: nền trắng, viền 1px, cao 36px, bo 8px (cùng kiểu ô lọc ở các màn khác). */
export const KHUNG =
  "h-9 rounded-lg border border-bo-border bg-white text-[13px] font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle disabled:opacity-60";

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";

/** Khung menu thả xuống. */
export const MENU = "z-50 rounded-xl border border-bo-border bg-white p-1.5 shadow-lg";


const hai = (n) => String(n).padStart(2, "0");
const dm = (d) => `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
const dmy = (d) => `${dm(d)}/${d.getFullYear()}`;
const thangNam = (d) => t("T{{thang}}/{{nam}}", { thang: d.getMonth() + 1, nam: d.getFullYear() });
const thangNamGon = (d) => t("T{{thang}}/{{nam}}", { thang: d.getMonth() + 1, nam: String(d.getFullYear()).slice(2) });

export const NHAN_KY = { "7_ngay": t("7 ngày qua"), "30_ngay": t("30 ngày qua"), "12_thang": t("12 tháng qua") };

/**
 * Khoảng ngày của kỳ xem và kỳ so sánh, tính từ thời điểm số liệu (giống quy tắc backend):
 * 7/30 ngày = các ngày đã trọn đến hết hôm qua, so với số ngày liền trước; 12 tháng = 12 tháng trọn trước tháng này,
 * so với cùng 12 tháng năm trước.
 */
export function khoangKy(ky, thoiDiem) {
  const tt = docNgay(thoiDiem) ?? new Date();
  const homNay = new Date(tt.getFullYear(), tt.getMonth(), tt.getDate());
  if (ky === "12_thang") {
    const tu = new Date(tt.getFullYear(), tt.getMonth() - 12, 1);
    const den = new Date(tt.getFullYear(), tt.getMonth() - 1, 1);
    const tuTruoc = new Date(tu.getFullYear() - 1, tu.getMonth(), 1);
    const denTruoc = new Date(den.getFullYear() - 1, den.getMonth(), 1);
    return {
      ngan: `${thangNam(tu)} – ${thangNam(den)}`,
      day: `${thangNam(tu)} – ${thangNam(den)}`,
      soSanh: `${thangNam(tuTruoc)} – ${thangNam(denTruoc)}`,
      tenSoSanh: t("Cùng kỳ năm trước"),
      // Bản không có năm đầy đủ, cho ô phạm vi và chú thích biểu đồ (chỗ hẹp)
      gon: `${thangNamGon(tu)} – ${thangNamGon(den)}`,
      soSanhGon: `${thangNamGon(tuTruoc)} – ${thangNamGon(denTruoc)}`,
    };
  }
  const n = ky === "7_ngay" ? 7 : 30;
  const den = new Date(homNay);
  den.setDate(den.getDate() - 1);
  const tu = new Date(homNay);
  tu.setDate(tu.getDate() - n);
  const denTruoc = new Date(tu);
  denTruoc.setDate(denTruoc.getDate() - 1);
  const tuTruoc = new Date(tu);
  tuTruoc.setDate(tuTruoc.getDate() - n);
  return {
    ngan: `${dm(tu)} – ${dmy(den)}`,
    day: `${dmy(tu)} – ${dmy(den)}`,
    soSanh: `${dm(tuTruoc)} – ${dmy(denTruoc)}`,
    tenSoSanh: t("{{n}} ngày liền trước", { n }),
    // Bản không có năm, cho ô phạm vi và chú thích biểu đồ (chỗ hẹp)
    gon: `${dm(tu)} – ${dm(den)}`,
    soSanhGon: `${dm(tuTruoc)} – ${dm(denTruoc)}`,
  };
}

const ngayMay = (d) => `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;

/**
 * Ngày đầu và ngày cuối (yyyy-MM-dd, tính cả hai đầu) của kỳ xem, cùng quy tắc với khoangKy: 7/30 ngày tới hết hôm qua,
 * 12 tháng là 12 tháng trọn trước tháng này. Dùng để mở báo cáo đúng khoảng ngày đang xem ở Tổng quan.
 */
export function ngayCuaKy(ky, thoiDiem) {
  const tt = docNgay(thoiDiem) ?? new Date();
  if (ky === "12_thang") {
    return {
      tuNgay: ngayMay(new Date(tt.getFullYear(), tt.getMonth() - 12, 1)),
      denNgay: ngayMay(new Date(tt.getFullYear(), tt.getMonth(), 0)),
    };
  }
  const n = ky === "7_ngay" ? 7 : 30;
  return {
    tuNgay: ngayMay(new Date(tt.getFullYear(), tt.getMonth(), tt.getDate() - n)),
    denNgay: ngayMay(new Date(tt.getFullYear(), tt.getMonth(), tt.getDate() - 1)),
  };
}

/** Danh sách kho kèm cờ Kho tổng (lấy từ khối tồn kho hoặc doanh thu theo kho). */
export function dsKhoDayDu(data, dsKho) {
  const tong = new Set(
    [...(data?.tonKho?.theoKho ?? []), ...(data?.doanhThuTheoKho ?? [])].filter((k) => k.laKhoTong).map((k) => k.khoId),
  );
  return dsKho.map((k) => ({ ...k, laKhoTong: tong.has(k.id) }));
}

export function tenKhoDangXem(khoId, dsKho) {
  return khoId == null ? t("Tất cả kho") : dsKho.find((k) => k.id === khoId)?.tenKho ?? t("Kho đã chọn");
}

