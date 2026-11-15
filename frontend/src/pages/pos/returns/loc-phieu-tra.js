import { t } from "@/i18n";

/** Mốc "Chọn khoảng ngày…" của thẻ Phiếu đã trả (từ ngày – đến ngày tự chọn, xem phiếu cũ). */
export const KHOANG = 'khoang';

/** yyyy-MM-dd theo lịch máy (ô date của trình duyệt và tham số máy chủ dùng dạng này). */
export const ngayIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** dd/MM/yyyy, hoặc dd/MM khi bỏ năm. */
const ngayVn = (iso, coNam = true) => {
  const [y, m, d] = iso.split('-');
  return coNam ? `${d}/${m}/${y}` : `${d}/${m}`;
};

/**
 * Mốc kỳ theo cách đối soát tiền hoàn: ca hôm nay, ca tối hôm trước (Hôm qua), tuần, và tháng dương lịch kế toán chốt
 * sổ (Tháng này / Tháng trước). Mỗi mốc tính ra từ ngày – đến ngày theo đồng hồ của trang. Nhãn dịch lúc hiện.
 */
export const MOC_KY = [
  { ma: 'hom-nay', nhan: 'Hôm nay', khoang: (d) => [d, d] }, // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  { ma: 'hom-qua', nhan: 'Hôm qua', khoang: (d) => { const h = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); return [h, h]; } }, // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  { ma: '7-ngay', nhan: '7 ngày qua', khoang: (d) => [new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6), d] }, // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  { ma: 'thang-nay', nhan: 'Tháng này', khoang: (d) => [new Date(d.getFullYear(), d.getMonth(), 1), d] }, // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  { ma: 'thang-truoc', nhan: 'Tháng trước', khoang: (d) => [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)] }, // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
];

/** Từ ngày – đến ngày (yyyy-MM-dd) của một mốc, hoặc của khoảng tự chọn. */
export function khoangCuaLoc({ moc, khoang }, bayGio = Date.now()) {
  if (moc === KHOANG) return khoang;
  const m = MOC_KY.find((x) => x.ma === moc) ?? MOC_KY[0];
  const [tu, den] = m.khoang(new Date(bayGio));
  return { tuNgay: ngayIso(tu), denNgay: ngayIso(den) };
}

/** "16/11/2026" khi một ngày, "10/11 – 16/11/2026" cùng năm, đủ năm hai đầu khi khác năm. */
export function nhanKhoang({ tuNgay, denNgay }) {
  if (tuNgay === denNgay) return ngayVn(tuNgay);
  return `${ngayVn(tuNgay, tuNgay.slice(0, 4) !== denNgay.slice(0, 4))} – ${ngayVn(denNgay)}`;
}

/** Ngắn cho nút kỳ khi đã có tên mốc: "16/11/2026" hoặc "10/11 – 16/11". */
export function nhanKhoangNgan({ tuNgay, denNgay }) {
  if (tuNgay === denNgay) return ngayVn(tuNgay);
  const cungNam = tuNgay.slice(0, 4) === denNgay.slice(0, 4);
  return `${ngayVn(tuNgay, !cungNam)} – ${ngayVn(denNgay, !cungNam)}`;
}

/** Khoảng gợi ý khi mở "Chọn khoảng ngày…" lần đầu: từ đầu tháng trước tới hôm nay. */
export function khoangMacDinh(bayGio = Date.now()) {
  const hn = new Date(bayGio);
  return { tuNgay: ngayIso(new Date(hn.getFullYear(), hn.getMonth() - 1, 1)), denNgay: ngayIso(hn) };
}

/** Bộ lọc ban đầu: Hôm nay, không lọc chữ. */
export const locBanDau = (bayGio) => ({ moc: 'hom-nay', khoang: khoangMacDinh(bayGio), q: '' });

/** Cùng luật với máy chủ: đủ hai ngày, từ ≤ đến, không sau hôm nay, tối đa 1 năm. Trả câu lỗi, hợp lệ thì chuỗi rỗng. */
export function loiKhoang({ tuNgay, denNgay }, bayGio = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(denNgay ?? '')) return t("Chọn đủ từ ngày và đến ngày.");
  if (Number(tuNgay.slice(0, 4)) < 2000) return t("Ngày phải từ năm 2000 trở đi.");
  if (tuNgay > denNgay) return t("Từ ngày phải trước hoặc bằng đến ngày.");
  if (denNgay > ngayIso(new Date(bayGio))) return t("Đến ngày không được sau hôm nay.");
  if (denNgay >= `${Number(tuNgay.slice(0, 4)) + 1}${tuNgay.slice(4)}`) return t("Xem tối đa 1 năm. Chọn khoảng ngày ngắn hơn.");
  return '';
}
