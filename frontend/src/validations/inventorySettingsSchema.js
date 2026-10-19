// Chỉ định nghĩa nhãn/đơn vị và mã, không có giá trị mặc định. Giá trị/kiểu lấy từ API.
// min/max, pattern khớp validateBoundary của BE (DieuHanhHeThongServiceImpl); đổi một bên thì đổi cả bên kia.
// `type`: kiểu dữ liệu mong đợi từ API (mặc định INT).
export const INVENTORY_SETTINGS = [
  { code: "DEFAULT_MIN_STOCK_ALERT", label: "Ngưỡng cảnh báo tồn kho tối thiểu", unit: "Số lượng", description: "Ngưỡng cảnh báo mặc định khi sản phẩm chưa có thiết lập riêng.", group: "stock", min: 0, max: 100000 },
  { code: "OMNI_SYNC_INTERVAL_MINS", label: "Chu kỳ đồng bộ đơn hàng đa kênh", unit: "Phút", description: "Khoảng thời gian giữa các lần đồng bộ đơn hàng định kỳ.", group: "sync", min: 1, max: 1440 },
  { code: "REALTIME_SYNC_THRESHOLD", label: "Ngưỡng chuyển sang đồng bộ tức thời", unit: "Số lượng", description: "Ngưỡng số lượng dùng để kích hoạt đồng bộ theo thời gian thực.", group: "sync", min: 0, max: 100 },
  {
    code: "MA_KHACH_HANG_TIEN_TO",
    label: "Tiền tố mã khách hàng",
    unit: "Tiền tố",
    description: "Thêm khách hàng mà để trống mã thì hệ thống tạo mã bằng tiền tố này và 6 chữ số.",
    group: "customer",
    type: "STRING",
    maxLength: 10,
    pattern: /^[A-Z0-9._-]{1,10}$/,
    patternMessage: "Gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -",
  },
];

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
