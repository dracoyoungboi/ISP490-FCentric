// Số liệu dùng chung cho dải chỉ số đầu trang và biểu đồ theo ngày của màn Tổng quan (bản Kiểu 3).

/** 4 chỉ số của kỳ xem; ô đang chọn quyết định biểu đồ bên dưới vẽ chỉ số nào. */
export const CHI_SO = [
  { key: "doanhThu", ten: "Doanh thu", tien: true, theoNgay: "Doanh thu theo ngày", theoThang: "Doanh thu theo tháng" },
  { key: "loiNhuan", ten: "Lợi nhuận gộp", tien: true, theoNgay: "Lợi nhuận gộp theo ngày", theoThang: "Lợi nhuận gộp theo tháng" },
  { key: "soDon", ten: "Đơn đã giao", tien: false, theoNgay: "Đơn đã giao theo ngày", theoThang: "Đơn đã giao theo tháng" },
  { key: "tbDon", ten: "Giá trị đơn trung bình", tien: true, theoNgay: "Giá trị đơn trung bình theo ngày", theoThang: "Giá trị đơn trung bình theo tháng" },
];

export const CHI_SO_MAC_DINH = "doanhThu";

/** Giá trị một chỉ số tại một điểm (ngày hoặc tháng). Giá trị đơn trung bình của ngày không có đơn là null (bỏ trống, không vẽ 0). */
export function giaTriDiem(d, key) {
  if (!d) return null;
  if (key === "loiNhuan") return d.loiNhuan;
  if (key === "soDon") return d.soDon;
  if (key === "tbDon") return d.soDon ? d.doanhThu / d.soDon : null;
  return d.doanhThu;
}

/** Các điểm đã trọn của kỳ xem (bỏ ngày/tháng đang chạy, khớp tổng ở dải chỉ số). */
export function diemDaTron(dt) {
  return (dt?.diem ?? []).filter((d) => !d.chuaKetThuc);
}

/** Tổng 4 chỉ số của một danh sách điểm. */
function tongDiem(ds) {
  const doanhThu = ds.reduce((s, d) => s + d.doanhThu, 0);
  const loiNhuan = ds.reduce((s, d) => s + d.loiNhuan, 0);
  const soDon = ds.reduce((s, d) => s + d.soDon, 0);
  return { doanhThu, loiNhuan, soDon, tbDon: soDon ? doanhThu / soDon : 0 };
}

/** Tổng của kỳ xem (lấy từ API) và của kỳ so sánh (cộng diemKyTruoc; null khi máy chủ chưa trả kỳ trước theo ngày). */
export function tongHopKy(dt) {
  if (!dt) return { nay: null, truoc: null };
  const nay = {
    doanhThu: dt.tongDoanhThu,
    loiNhuan: dt.tongLoiNhuan,
    soDon: dt.tongSoDon,
    tbDon: dt.tongSoDon ? dt.tongDoanhThu / dt.tongSoDon : 0,
  };
  const ds = Array.isArray(dt.diemKyTruoc) ? dt.diemKyTruoc : null;
  const truoc = ds ? { ...tongDiem(ds), doanhThu: dt.doanhThuKyTruoc } : dt.doanhThuKyTruoc ? { doanhThu: dt.doanhThuKyTruoc } : null;
  return { nay, truoc };
}

/** Bước chia trục đẹp: 1, 2, 2,5, 5 × 10^n. */
export function buocDep(x) {
  if (!(x > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(x));
  const f = x / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

/**
 * Vạch trục tung (4–5 vạch) phủ cả số âm nếu có (lợi nhuận gộp có thể âm). Luôn gồm 0. Số đơn là số nguyên.
 * Trả { ticks, day, dinh } với day ≤ 0 ≤ dinh.
 */
export function vachTruc(min, max, laSoNguyen) {
  const thap = Math.min(0, min);
  const cao = Math.max(0, max);
  let buoc = buocDep((cao - thap || 1) / 4);
  if (laSoNguyen) buoc = Math.max(1, Math.ceil(buoc));
  const day = Math.floor(thap / buoc) * buoc;
  const dinh = Math.max(buoc, Math.ceil(cao / buoc) * buoc);
  const ticks = [];
  for (let t = day; t <= dinh + buoc / 1e6; t += buoc) ticks.push(Number(t.toPrecision(12)));
  return { ticks, day, dinh };
}
