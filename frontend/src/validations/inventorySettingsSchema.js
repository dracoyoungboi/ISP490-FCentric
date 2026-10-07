// Chỉ định nghĩa nhãn/đơn vị và mã, không có giá trị mặc định. Giá trị/kiểu lấy từ API.
export const INVENTORY_SETTINGS = [
  { code: "DEFAULT_MIN_STOCK_ALERT", label: "Ngưỡng cảnh báo tồn kho tối thiểu", unit: "Số lượng", description: "Ngưỡng cảnh báo mặc định khi sản phẩm chưa có thiết lập riêng.", group: "stock" },
  { code: "OMNI_SYNC_INTERVAL_MINS", label: "Chu kỳ đồng bộ đơn hàng đa kênh", unit: "Phút", description: "Khoảng thời gian giữa các lần đồng bộ đơn hàng định kỳ.", group: "sync" },
  { code: "REALTIME_SYNC_THRESHOLD", label: "Ngưỡng chuyển sang đồng bộ real-time", unit: "Số lượng", description: "Ngưỡng số lượng dùng để kích hoạt đồng bộ theo thời gian thực.", group: "sync" },
];

export function createEmptyInventoryValues() {
  return Object.fromEntries(INVENTORY_SETTINGS.map((item) => [item.code, ""]));
}

export function readCompleteInventorySettings(data) {
  const settings = selectInventorySettings(data);
  if (settings.length !== INVENTORY_SETTINGS.length || settings.some((item) => item.kieuDuLieu !== "INT")) {
    throw new Error("Không thể tải đủ cài đặt số nguyên.");
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

export function getInventoryChanges(settings, values) {
  return settings.filter((setting) => values[setting.maCauHinh] !== setting.giaTri)
    .map((setting) => ({ maCauHinh: setting.maCauHinh, giaTri: values[setting.maCauHinh] }));
}
