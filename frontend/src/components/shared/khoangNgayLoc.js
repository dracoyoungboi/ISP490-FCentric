import { t } from "@/i18n";

// Ngày dạng yyyy-mm-dd theo giờ máy (cùng dạng ô <input type="date">)
const hai = (n) => String(n).padStart(2, "0");
export const ngayMay = (d) => `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
const ngayVN = (s) => s.split("-").reverse().join("/");
const NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** Các kỳ nhanh, tính theo hôm nay. `ma` rỗng = không lọc ngày. */
export function dsKy(homNay = new Date()) {
  const ngay = (lui) => ngayMay(new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate() - lui));
  const dauThang = (lui) => ngayMay(new Date(homNay.getFullYear(), homNay.getMonth() - lui, 1));
  const cuoiThangTruoc = ngayMay(new Date(homNay.getFullYear(), homNay.getMonth(), 0));
  const hom = ngayMay(homNay);
  return [
    { ma: "", ten: t("Tất cả thời gian"), tuNgay: "", denNgay: "" },
    { ma: "hom-nay", ten: t("Hôm nay"), tuNgay: hom, denNgay: hom },
    { ma: "7-ngay", ten: t("7 ngày qua"), tuNgay: ngay(6), denNgay: hom },
    { ma: "thang-nay", ten: t("Tháng này"), tuNgay: dauThang(0), denNgay: hom },
    { ma: "thang-truoc", ten: t("Tháng trước"), tuNgay: dauThang(1), denNgay: cuoiThangTruoc },
  ];
}

/** Câu lỗi của khoảng tùy chọn; "" = hợp lệ. Cho phép bỏ trống một đầu (từ ngày … trở đi / đến ngày …). */
export function loiKhoangNgayLoc(tuNgay, denNgay, homNay = new Date()) {
  if (!tuNgay && !denNgay) return t("Chọn ít nhất một ngày.");
  if ((tuNgay && !NGAY.test(tuNgay)) || (denNgay && !NGAY.test(denNgay))) return t("Ngày không hợp lệ.");
  if ((tuNgay && tuNgay < "2000-01-01") || (denNgay && denNgay < "2000-01-01")) return t("Ngày phải từ năm 2000 trở đi.");
  if (tuNgay && denNgay && tuNgay > denNgay) return t("Từ ngày phải trước hoặc bằng đến ngày.");
  const hom = ngayMay(homNay);
  if ((tuNgay && tuNgay > hom) || (denNgay && denNgay > hom)) return t("Không chọn ngày sau hôm nay.");
  return "";
}

/** Chữ ngắn của khoảng đang lọc: tên kỳ nhanh nếu khớp, không thì ngày cụ thể; không lọc thì "Tất cả". */
export function nhanKhoangNgay(tuNgay, denNgay) {
  if (!tuNgay && !denNgay) return t("Tất cả");
  const ky = dsKy().find((k) => k.ma && k.tuNgay === tuNgay && k.denNgay === denNgay);
  if (ky) return ky.ten;
  if (tuNgay && denNgay) return tuNgay === denNgay ? ngayVN(tuNgay) : `${ngayVN(tuNgay)} – ${ngayVN(denNgay)}`;
  return tuNgay ? t("Từ {{ngay}}", { ngay: ngayVN(tuNgay) }) : t("Đến {{ngay}}", { ngay: ngayVN(denNgay) });
}
