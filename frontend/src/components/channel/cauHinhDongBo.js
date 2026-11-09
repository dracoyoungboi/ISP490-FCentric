import { t, tDuLieu } from "@/i18n";
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
  if (!laSoNguyen(values.tyLeDayTon) || tyLe < 1 || tyLe > 100) errors.tyLeDayTon = t("Nhập số nguyên từ 1 đến 100.");
  if (!laSoNguyen(values.tonDem) || Number(values.tonDem) > GIOI_HAN_SO_LUONG) errors.tonDem = t("Nhập số nguyên từ 0 đến 100.000.");
  if (!laSoNguyen(values.nguongVe0) || Number(values.nguongVe0) > GIOI_HAN_SO_LUONG) errors.nguongVe0 = t("Nhập số nguyên từ 0 đến 100.000.");
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
  if (kho?.initialLoading) return t("Đang đọc từ Shopify…");
  return tenKhoSanHienThi((Array.isArray(kho?.data) ? kho.data.find((k) => k.macDinh)?.tenKhoSan : null) ?? null);
}

/**
 * Tên kho / địa điểm trên sàn để HIỆN (kết quả getKhoSan). Tên máy chủ tự đặt khi sàn không trả tên ("Kho mặc định
 * Lazada", "Địa điểm 123", "Kho 456", "Kho Shopify 789") được dịch; tên thật trên sàn không khớp khóa nên giữ nguyên.
 * Chỉ dùng lúc vẽ: tenKhoSan gửi lưu cấu hình vẫn là bản gốc.
 */
export function tenKhoSanHienThi(ten) {
  if (typeof ten !== "string" || !ten) return ten;
  const diaDiem = ten.match(/^Địa điểm (\d+)$/);
  if (diaDiem) return t("Địa điểm {{id}}", { id: diaDiem[1] });
  const kho = ten.match(/^Kho (\d+)$/);
  if (kho) return t("Kho {{id}}", { id: kho[1] });
  const khoShopify = ten.match(/^Kho Shopify (\d+)$/);
  if (khoShopify) return t("Kho Shopify {{id}}", { id: khoShopify[1] });
  return tDuLieu(ten);
}

export function coThayDoiCauHinh(values, dto) {
  const goc = taoGiaTriCauHinh(dto);
  return Object.keys(goc).some((key) => String(goc[key]) !== String(values[key]));
}
