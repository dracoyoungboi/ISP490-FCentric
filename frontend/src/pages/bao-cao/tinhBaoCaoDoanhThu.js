// Phần tính của màn Báo cáo doanh thu (không gọi API): kỳ xem, chỉ số so với cùng kỳ năm trước, dữ liệu biểu đồ và bảng.

const hai = (n) => String(n).padStart(2, "0");
/** yyyy-MM-dd theo giờ máy (không lệch ngày như toISOString lúc gần nửa đêm). */
export const ngayMay = (d) => `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
export const ngayVN = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");

export const LOAI_KY = [
  { value: "ngay", label: "Theo ngày" },
  { value: "thang", label: "Theo tháng" },
  { value: "nam", label: "Theo năm" },
];

/** Mốc nhanh của kỳ theo ngày; "tuy-chon" dùng hai ô ngày. */
export const MOC_NGAY = [
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "thang-nay", label: "Tháng này" },
  { value: "thang-truoc", label: "Tháng trước" },
  { value: "tuy-chon", label: "Tùy chọn khoảng ngày" },
];

export const SO_NAM = [3, 5, 10];

/** Khoảng ngày của một mốc nhanh (tuy-chon: giữ khoảng đang có). */
export function khoangMoc(moc, homNay = new Date(), hienTai = null) {
  const h = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate());
  const lui = (n) => { const d = new Date(h); d.setDate(d.getDate() - n); return d; };
  switch (moc) {
    case "7": return { tuNgay: ngayMay(lui(6)), denNgay: ngayMay(h) };
    case "30": return { tuNgay: ngayMay(lui(29)), denNgay: ngayMay(h) };
    case "thang-nay": return { tuNgay: ngayMay(new Date(h.getFullYear(), h.getMonth(), 1)), denNgay: ngayMay(h) };
    case "thang-truoc": return {
      tuNgay: ngayMay(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
      denNgay: ngayMay(new Date(h.getFullYear(), h.getMonth(), 0)),
    };
    default: return hienTai ?? { tuNgay: ngayMay(new Date(h.getFullYear(), h.getMonth(), 1)), denNgay: ngayMay(h) };
  }
}

/** Tham số gửi máy chủ của kỳ đang xem. */
export function thamSo({ loai, nam, khoang, soNam, khoId }, homNay = new Date()) {
  const kho = khoId ? { khoId } : {};
  if (loai === "ngay") return { loai, tuNgay: khoang.tuNgay, denNgay: khoang.denNgay, ...kho };
  if (loai === "nam") return { loai, tuNam: homNay.getFullYear() - soNam + 1, denNam: homNay.getFullYear(), ...kho };
  return { loai: "thang", nam, ...kho };
}

const N = (v) => Number(v) || 0;

/** Tăng / giảm so với cùng kỳ: tỷ lệ (0,128 = 12,8%); cùng kỳ bằng 0 thì null (không so được). */
export function tyLeTang(nay, truoc) {
  const b = N(truoc);
  if (!b) return null;
  return (N(nay) - b) / Math.abs(b);
}

/** Biên lãi gộp (0–1); doanh thu 0 thì null. */
export const bienLai = (loiNhuan, doanhThu) => (N(doanhThu) ? N(loiNhuan) / N(doanhThu) : null);

/** Chỉ số của dải đầu trang (đổi chỉ số thì biểu đồ đổi theo). */
export const CHI_SO = [
  { ma: "doanhThu", ten: "Doanh thu", tien: true },
  { ma: "loiNhuan", ten: "Lợi nhuận gộp", tien: true },
  { ma: "giaVon", ten: "Giá vốn", tien: true },
  { ma: "soDon", ten: "Đơn đã giao", tien: false },
];

const truongCungKy = { doanhThu: "doanhThuCungKy", loiNhuan: "loiNhuanCungKy", giaVon: "giaVonCungKy", soDon: "soDonCungKy" };

/** Nhãn ngắn trên trục X: T1…T12 theo tháng, 01/10 theo ngày, năm theo năm. */
export function nhanTruc(loai, ky) {
  if (loai === "thang") return `T${N(ky.sortKey)}`;
  return ky.nhanThoiGian;
}

/**
 * Dữ liệu biểu đồ của một chỉ số: { nhan, nhanDay, nay, truoc }; theo năm không có cùng kỳ (mỗi cột đã là một năm). Kỳ
 * chưa tới để trống (null) để cột không có và đường không rơi về 0.
 */
export function duLieuBieuDo(tongHop, chiSo) {
  if (!tongHop?.theoKy) return [];
  return tongHop.theoKy.map((k) => ({
    nhan: nhanTruc(tongHop.loai, k),
    nhanDay: tongHop.loai === "thang" ? `Tháng ${N(k.sortKey)}` : tongHop.loai === "nam" ? `Năm ${k.nhanThoiGian}` : ngayVN(k.tuNgay),
    nay: k.chuaToi ? null : N(k[chiSo]),
    truoc: tongHop.loai === "nam" || k.chuaToi ? null : N(k[truongCungKy[chiSo]]),
  }));
}

/**
 * Lỗi của khoảng ngày tùy chọn (cùng quy tắc máy chủ): từ năm 2000, không sau hôm nay, đến ngày trước từ ngày + 1 năm.
 * "" = hợp lệ.
 */
export function loiKhoangNgay(tuNgay, denNgay, homNay = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(denNgay ?? "")) return "Chọn đủ từ ngày và đến ngày.";
  if (Number(tuNgay.slice(0, 4)) < 2000 || Number(denNgay.slice(0, 4)) < 2000) return "Ngày phải từ năm 2000 trở đi.";
  if (tuNgay > denNgay) return "Từ ngày phải trước hoặc bằng đến ngày.";
  if (denNgay > ngayMay(homNay)) return "Đến ngày không được sau hôm nay.";
  const motNam = `${Number(tuNgay.slice(0, 4)) + 1}${tuNgay.slice(4)}`;
  if (denNgay >= motNam) return "Xem theo ngày tối đa 1 năm; khoảng dài hơn hãy xem theo tháng.";
  return "";
}

/**
 * Dòng bảng chi tiết (mới nhất trước): ghép doanh thu với tiền thu theo nhãn kỳ, bỏ kỳ chưa có gì (tháng chưa tới, ngày
 * không bán).
 */
export function dongBang(tongHop, tienThu) {
  if (!tongHop?.theoKy) return [];
  const thu = new Map((tienThu?.theoKy ?? []).map((k) => [k.nhanThoiGian, k]));
  return tongHop.theoKy
    .map((k) => {
      const t = thu.get(k.nhanThoiGian);
      return {
        khoa: k.nhanThoiGian,
        ten: tongHop.loai === "thang" ? `Tháng ${N(k.sortKey)}` : tongHop.loai === "nam" ? `Năm ${k.nhanThoiGian}` : ngayVN(k.tuNgay),
        doanhThu: N(k.doanhThu),
        doanhThuCungKy: N(k.doanhThuCungKy),
        tang: tyLeTang(k.doanhThu, k.doanhThuCungKy),
        giaVon: N(k.giaVon),
        loiNhuan: N(k.loiNhuan),
        bien: bienLai(k.loiNhuan, k.doanhThu),
        soDon: N(k.soDon),
        tienMat: N(t?.tienMat),
        chuyenKhoan: N(t?.chuyenKhoan),
        hoan: N(t?.hoan),
      };
    })
    .filter((d, i) => !tongHop.theoKy[i].chuaToi
      && (d.doanhThu || d.doanhThuCungKy || d.soDon || d.tienMat || d.chuyenKhoan || d.hoan))
    .reverse();
}

/** Số tiền gọn cho ô chỉ số: { so, donVi } — "136,0" "triệu ₫", "455.625" "₫", "1,25" "tỷ ₫". */
export function soGon(v) {
  const x = N(v);
  const a = Math.abs(x);
  const fmt = (n, d) => n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (a >= 1e9) return { so: fmt(x / 1e9, 2), donVi: "tỷ ₫" };
  if (a >= 1e6) return { so: fmt(x / 1e6, 1), donVi: "triệu ₫" };
  return { so: fmt(x, 0), donVi: "₫" };
}

/** Tên tệp Excel khi máy chủ không cho đọc tên (khác nguồn khi chạy dev). */
export function tenTepExcel(ts) {
  const hau = ts.loai === "ngay" ? `${ts.tuNgay}_${ts.denNgay}` : ts.loai === "nam" ? `${ts.tuNam}-${ts.denNam}` : String(ts.nam);
  return `Bao-cao-doanh-thu_${hau}.xlsx`;
}
