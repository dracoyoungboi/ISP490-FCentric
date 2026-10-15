/** Chuyển cấu hình đồng bộ (API) ↔ giá trị form, kiểm tra hợp lệ trước khi lưu. */

const GIOI_HAN_SO_LUONG = 100000;

export function taoGiaTriCauHinh(dto) {
  return {
    tuDongDayTon: dto?.tuDongDayTon ?? true,
    tuDongLayDon: dto?.tuDongLayDon ?? true,
    tyLeDayTon: String(dto?.tyLeDayTon ?? 100),
    tonDem: String(dto?.tonDem ?? 0),
    nguongVe0: String(dto?.nguongVe0 ?? 0),
  };
}

const laSoNguyen = (value) => /^\d+$/.test(String(value ?? "").trim());

export function kiemTraCauHinh(values) {
  const errors = {};
  const tyLe = Number(values.tyLeDayTon);
  if (!laSoNguyen(values.tyLeDayTon) || tyLe < 1 || tyLe > 100) errors.tyLeDayTon = "Nhập số nguyên từ 1 đến 100.";
  if (!laSoNguyen(values.tonDem) || Number(values.tonDem) > GIOI_HAN_SO_LUONG) errors.tonDem = "Nhập số nguyên từ 0 đến 100.000.";
  if (!laSoNguyen(values.nguongVe0) || Number(values.nguongVe0) > GIOI_HAN_SO_LUONG) errors.nguongVe0 = "Nhập số nguyên từ 0 đến 100.000.";
  return errors;
}

/** Quy tắc số tồn ở dạng số (dùng cho ví dụ và khi đẩy tồn thủ công). Ô sai thì dùng mặc định. */
export function quyTacTonKho(values) {
  const so = (value, macDinh) => (laSoNguyen(value) ? Number(value) : macDinh);
  return {
    tyLeDayTon: so(values?.tyLeDayTon, 100),
    tonDem: so(values?.tonDem, 0),
    nguongVe0: so(values?.nguongVe0, 0),
  };
}

/** `phan`: "ton-kho" | "don-hang" | undefined (cả hai). */
export function taoPayloadCauHinh(values, phan) {
  const tonKho = {
    tuDongDayTon: Boolean(values.tuDongDayTon),
    tyLeDayTon: Number(values.tyLeDayTon),
    tonDem: Number(values.tonDem),
    nguongVe0: Number(values.nguongVe0),
  };
  const donHang = { tuDongLayDon: Boolean(values.tuDongLayDon) };
  if (phan === "ton-kho") return tonKho;
  if (phan === "don-hang") return donHang;
  return { ...tonKho, ...donHang };
}

/** Cách tính số lượng trên sàn: "bang" = bằng số khả dụng (100%, không giữ lại, không ngưỡng); "tuy" = tùy chỉnh. */
export const QUY_TAC_MAC_DINH = { tyLeDayTon: "100", tonDem: "0", nguongVe0: "0" };

export function cheDoTheoGiaTri(values) {
  const q = quyTacTonKho(values);
  return q.tyLeDayTon === 100 && q.tonDem === 0 && q.nguongVe0 === 0 ? "bang" : "tuy";
}

/**
 * Tên địa điểm Shopify nhận số tồn (địa điểm mặc định của cửa hàng) từ kết quả `getKhoSan`.
 * Không lấy dòng đầu khi thiếu đánh dấu mặc định: Shopify không xếp địa điểm mặc định lên đầu.
 */
export function tenDiaDiemNhanTon(kho) {
  if (kho?.initialLoading) return "Đang đọc từ Shopify…";
  return (Array.isArray(kho?.data) ? kho.data.find((k) => k.macDinh)?.tenKhoSan : null) ?? null;
}

export function coThayDoiCauHinh(values, dto) {
  const goc = taoGiaTriCauHinh(dto);
  return Object.keys(goc).some((key) => String(goc[key]) !== String(values[key]));
}
