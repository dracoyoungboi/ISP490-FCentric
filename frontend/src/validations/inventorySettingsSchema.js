// Chỉ định nghĩa nhãn/đơn vị và mã, không có giá trị mặc định. Giá trị/kiểu lấy từ API.
// min/max, pattern khớp validateBoundary của BE (DieuHanhHeThongServiceImpl); đổi một bên thì đổi cả bên kia.
// `type`: kiểu dữ liệu mong đợi từ API (mặc định INT). `group`: mục trong trung tâm Cấu hình (settings.config.js).
export const INVENTORY_SETTINGS = [
  { code: "DEFAULT_MIN_STOCK_ALERT", label: "Ngưỡng cảnh báo mặc định", unit: "cái", group: "stock", min: 0, max: 100000 },
  { code: "OMNI_SYNC_INTERVAL_MINS", label: "Chu kỳ đồng bộ", unit: "phút", group: "sync", min: 1, max: 1440 },
  { code: "REALTIME_SYNC_THRESHOLD", label: "Đẩy tồn ngay khi còn dưới", unit: "cái", group: "sync", min: 0, max: 100, rangeNote: "0 là tắt" },
  {
    code: "MA_KHACH_HANG_TIEN_TO",
    label: "Tiền tố mã khách hàng",
    unit: "",
    group: "customer",
    type: "STRING",
    maxLength: 10,
    pattern: /^[A-Z0-9._-]{1,10}$/,
    patternMessage: "Gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -",
  },
];

const soVi = (value) => Number(value).toLocaleString("vi-VN");

/**
 * Câu mô tả tác động của giá trị, đổi theo số đang nhập. Trả về [trước, phần in đậm, sau].
 * Bám đúng cách backend dùng: OMNI_SYNC_INTERVAL_MINS cho cả job lấy đơn và job đẩy tồn;
 * REALTIME_SYNC_THRESHOLD đẩy ngay khi tồn còn DƯỚI ngưỡng (0 = tắt).
 */
export function moTaTacDong(code, value) {
  switch (code) {
    case "DEFAULT_MIN_STOCK_ALERT":
      return ["Báo thiếu hàng khi tồn khả dụng còn ", `${soVi(value)} cái`, " trở xuống."];
    case "OMNI_SYNC_INTERVAL_MINS":
      return ["Lấy đơn mới và đẩy tồn lên kênh bán ", `mỗi ${soVi(value)} phút`, `, khoảng ${soVi(Math.floor(1440 / Number(value)))} lần/ngày.`];
    case "REALTIME_SYNC_THRESHOLD":
      return Number(value) === 0
        ? ["Đẩy tồn tức thời ", "đang tắt", "; tồn chỉ được đẩy theo chu kỳ."]
        : ["Mã còn ", `dưới ${soVi(value)} cái`, " sau khi bán hoặc xuất kho được đẩy tồn ngay, không đợi chu kỳ."];
    case "MA_KHACH_HANG_TIEN_TO":
      return ["Mã mới có dạng ", maKhachHangMau(value), ". Mã đã cấp giữ nguyên."];
    default:
      return ["", "", ""];
  }
}

/** Phạm vi cho phép, hiện dưới ô nhập. VD "0–100 · 0 là tắt". */
export function phamViCauHinh(code) {
  const field = INVENTORY_SETTINGS.find((item) => item.code === code);
  if (!field) return "";
  if (field.maxLength) return `Tối đa ${field.maxLength} ký tự`;
  const range = `${soVi(field.min)}–${soVi(field.max)}`;
  return field.rangeNote ? `${range} · ${field.rangeNote}` : range;
}

/** Mã mẫu cho tiền tố đang nhập, VD "KH" → "KH000124". */
export const maKhachHangMau = (tienTo) => `${tienTo || ""}000124`;

export function createEmptyInventoryValues() {
  return Object.fromEntries(INVENTORY_SETTINGS.map((item) => [item.code, ""]));
}

export function readCompleteInventorySettings(data) {
  const settings = selectInventorySettings(data);
  const sai = settings.some((item) => {
    const field = INVENTORY_SETTINGS.find(({ code }) => code === item.maCauHinh);
    return item.kieuDuLieu !== (field?.type ?? "INT");
  });
  if (settings.length !== INVENTORY_SETTINGS.length || sai) {
    throw new Error("Không thể tải đủ cài đặt.");
  }
  return settings;
}

export function validateInventorySetting(value, type) {
  if (typeof value !== "string" || !value.trim()) return "Giá trị cấu hình không được để trống.";
  if (value.length > 255) return "Giá trị cấu hình tối đa 255 ký tự.";
  switch (type) {
    case "INT": {
      // Integer.parseInt của BE: không nhận số thập phân, số mũ hay khoảng trắng.
      if (!/^[+-]?\d+$/.test(value)) return "Nhập số nguyên, không có khoảng trắng hoặc phần thập phân.";
      const number = Number(value);
      if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) {
        return "Số nguyên phải nằm trong khoảng -2147483648 đến 2147483647.";
      }
      return "";
    }
    case "DECIMAL": {
      // Double.parseDouble: số thập phân/số mũ, hex float, NaN và Infinity.
      const decimal = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?|NaN|Infinity)$/;
      const hex = /^[+-]?0[xX](?:[\da-fA-F]+(?:\.[\da-fA-F]*)?|\.[\da-fA-F]+)[pP][+-]?\d+[fFdD]?$/;
      return decimal.test(value.trim()) || hex.test(value.trim()) ? "" : "Giá trị không đúng định dạng số.";
    }
    case "BOOLEAN":
      return /^(true|false|1|0)$/i.test(value) ? "" : "Nhập true, false, 1 hoặc 0.";
    case "STRING":
      return "";
    default:
      return "Kiểu dữ liệu cấu hình chưa được hỗ trợ: " + type;
  }
}

export function selectInventorySettings(data) {
  return INVENTORY_SETTINGS.flatMap(({ code }) => {
    const matches = data.filter((item) => item?.maCauHinh === code);
    if (matches.length > 1) throw new Error("API trả về mã cấu hình trùng lặp: " + code);
    if (!matches.length) return [];
    const setting = matches[0];
    if (typeof setting.giaTri !== "string" || typeof setting.kieuDuLieu !== "string") {
      throw new Error("Dữ liệu cấu hình không hợp lệ: " + code);
    }
    return [setting];
  });
}

// Kiểm tra kiểu dữ liệu trước, rồi tới giới hạn min/max của từng cấu hình.
export function validateInventoryField(code, value, type) {
  const typeError = validateInventorySetting(value, type);
  if (typeError) return typeError;
  const field = INVENTORY_SETTINGS.find((item) => item.code === code);
  if (field?.pattern) return field.pattern.test(value) ? "" : field.patternMessage;
  if (field?.min === undefined || field?.max === undefined) return "";
  const number = Number(value);
  return number < field.min || number > field.max
    ? `Nhập giá trị từ ${field.min.toLocaleString("vi-VN")} đến ${field.max.toLocaleString("vi-VN")}.`
    : "";
}

// "0100", "+100" và "100" là cùng một số: chuẩn hóa để không tính là thay đổi và gửi BE dạng gọn.
function normalizeInventoryValue(value, type) {
  return type === "INT" && /^[+-]?\d+$/.test(value) ? String(Number(value)) : value;
}

export function getInventoryChanges(settings, values) {
  return settings
    .map((setting) => ({ setting, giaTri: normalizeInventoryValue(values[setting.maCauHinh], setting.kieuDuLieu) }))
    .filter(({ setting, giaTri }) => giaTri !== normalizeInventoryValue(setting.giaTri, setting.kieuDuLieu))
    .map(({ setting, giaTri }) => ({ maCauHinh: setting.maCauHinh, giaTri }));
}
