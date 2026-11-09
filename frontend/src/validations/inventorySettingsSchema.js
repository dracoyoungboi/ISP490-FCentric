import { t } from "../i18n/t.js";
// Chỉ định nghĩa nhãn/đơn vị và mã, không có giá trị mặc định. Giá trị/kiểu lấy từ API.
// min/max, pattern khớp validateBoundary của BE (DieuHanhHeThongServiceImpl); đổi một bên thì đổi cả bên kia.
// `type`: kiểu dữ liệu mong đợi từ API (mặc định INT). `group`: mục trong trung tâm Cấu hình (settings.config.js).
export const INVENTORY_SETTINGS = [
  { code: "DEFAULT_MIN_STOCK_ALERT", label: t("Ngưỡng cảnh báo mặc định"), unit: t("cái", { context: "don_vi" }), group: "stock", min: 0, max: 100000 },
  { code: "OMNI_SYNC_INTERVAL_MINS", label: t("Chu kỳ đồng bộ"), unit: t("phút", { context: "don_vi" }), group: "sync", min: 1, max: 1440 },
  { code: "REALTIME_SYNC_THRESHOLD", label: t("Đẩy tồn ngay khi còn dưới"), unit: t("cái", { context: "don_vi" }), group: "sync", min: 0, max: 100, rangeNote: t("0 là tắt") },
  {
    code: "MA_KHACH_HANG_TIEN_TO",
    label: t("Tiền tố mã khách hàng"),
    unit: "",
    group: "customer",
    type: "STRING",
    maxLength: 10,
    pattern: /^[A-Z0-9._-]{1,10}$/,
    patternMessage: t("Gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -"),
  },
  {
    // Màn Kiểm đếm & khóa lô (pages/receipt/kiemDem.js · CHE_DO_XAC_NHAN); BE chỉ nhận đúng hai giá trị này
    code: "KIEM_DEM_XAC_NHAN",
    label: t("Cách xác nhận chất lượng"),
    unit: "",
    group: "inbound",
    type: "STRING",
    options: [
      {
        value: "QUET_TIEP_LA_DAT",
        label: t("Quét tiếp là Đạt"),
        moTa: t("Mỗi sản phẩm bóp máy quét 1 lần; quét cái kế tiếp là cái trước giữ Đạt. Hàng lỗi quét thêm thẻ KHÔNG ĐẠT. Đề xuất."),
      },
      {
        value: "QUET_THE_TUNG_CAI",
        label: t("Quét thẻ cho từng cái"),
        moTa: t("Mỗi sản phẩm phải quét thẻ ĐẠT hoặc KHÔNG ĐẠT mới quét tiếp được (2 lần bóp mỗi cái)."),
      },
    ],
  },
  {
    // Mã lô gợi ý ở hộp Khóa lô: <tiền tố>-<số phiếu>-NN (pages/receipt/kiemDem.js · goiYMaLo)
    code: "MA_LO_TIEN_TO",
    label: t("Tiền tố mã lô gợi ý"),
    unit: "",
    group: "inbound",
    type: "STRING",
    maxLength: 10,
    // Mã lô gợi ý = tiền tố + "-" + …: không được chứa FC- (dạng thẻ lệnh kiểm đếm FC-KHOA-LO…), máy chủ cũng chặn
    pattern: /^(?!.*FC-)(?!.*FC$)[A-Z0-9._-]{1,10}$/,
    patternMessage: t("Gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -; không kết thúc bằng FC hay chứa FC- (dành cho thẻ lệnh)"),
  },
  {
    // Mã vạch SKU tự sinh khi tạo biến thể để trống mã vạch: tiền tố + id đệm 0 đủ 10 chữ số (backend utils/MaVachSku)
    code: "MA_VACH_TIEN_TO",
    label: t("Tiền tố mã vạch tự sinh"),
    unit: "",
    group: "product",
    type: "STRING",
    maxLength: 2,
    inputMode: "numeric",
    pattern: /^[0-9]{2}$/,
    patternMessage: t("Gồm đúng 2 chữ số, nên dùng 20–29 (vùng mã nội bộ)."),
    goiY: t("Đúng 2 chữ số"),
  },
  {
    // Tem sản phẩm (thẻ "Tem sản phẩm" ở Cấu hình › Mẫu in); khổ khớp components/print/paperStyles.js · KHO_TEM
    code: "TEM_KHO_MAC_DINH",
    label: t("Khổ tem"),
    unit: "",
    group: "label",
    type: "STRING",
    options: [
      { value: "35x22", label: t("Tem 35 × 22 mm · 2 tem/hàng"), moTa: t("Cuộn 74 mm, khe 2 mm giữa hai tem.") },
      { value: "50x30", label: t("Tem 50 × 30 mm · 1 tem/hàng"), moTa: t("Cuộn 52 mm, chữ và vạch to hơn.") },
    ],
  },
  { code: "TEM_IN_TEN_CUA_HANG", label: t("In tên cửa hàng"), unit: "", group: "label", type: "BOOLEAN" },
  { code: "TEM_IN_SKU", label: t("In SKU"), unit: "", group: "label", type: "BOOLEAN" },
  { code: "TEM_NGUONG_XAC_NHAN", label: t("Ngưỡng hỏi xác nhận"), unit: t("tem", { context: "don_vi" }), group: "label", min: 1, max: 9999 },
  {
    // Ký hiệu phiếu xuất kho kiêm vận chuyển nội bộ điền sẵn ở hộp Xác nhận xuất của phiếu chuyển kho; trống = chưa có
    code: "XKNB_KY_HIEU_MAC_DINH",
    label: t("Ký hiệu mặc định"),
    unit: "",
    group: "documents",
    type: "STRING",
    maxLength: 7,
    choPhepTrong: true,
    pattern: /^6[CK][0-9]{2}N[A-Z0-9]{2}$/,
    patternMessage: t("Gồm 7 ký tự, ví dụ 6K26NAB: 6, C hoặc K, 2 số năm, N, 2 ký tự công ty tự đặt."),
    goiY: t("7 ký tự · để trống nếu chưa có"),
  },
  {
    // Hộp Xác nhận xuất của phiếu chuyển kho khi chưa có số phiếu XKNB (PhieuChuyenKhoService.xacNhanXuat)
    code: "XKNB_CHE_DO",
    label: t("Khi xác nhận xuất mà chưa có số XKNB"),
    unit: "",
    group: "documents",
    type: "STRING",
    options: [
      {
        value: "CHAN",
        label: t("Chặn xuất"),
        moTa: t("Khóa nút xuất và báo \"Cần ký hiệu và số của giấy đi đường (phiếu XKNB) trước khi hàng rời kho\"."),
      },
      {
        value: "CHI_CANH_BAO",
        label: t("Chỉ cảnh báo"),
        moTa: t("Cho xuất trước, ghi số sau; phiếu nằm ở mục Thiếu giấy đi đường tới khi ghi số. Dùng khi công ty chưa dùng phần mềm hóa đơn điện tử."),
      },
    ],
  },
  {
    // Nút Xử lý chênh lệch của phiếu chuyển kho nhận lệch (PhieuChuyenKhoService.duocXuLyChenhLech); QTV luôn được
    code: "CHUYEN_KHO_QUYEN_XU_LY_LECH",
    label: t("Ai được xử lý chênh lệch"),
    unit: "",
    group: "transfer",
    type: "STRING",
    options: [
      {
        value: "QL_KHO_TONG",
        label: t("Quản lý Kho tổng"),
        moTa: t("Quản trị viên hoặc quản lý kho được phân công ở Kho tổng. Mặc định."),
      },
      {
        value: "QL_KHO_TONG_VA_KHO_XUAT",
        label: t("Thêm quản lý kho xuất"),
        moTa: t("Như trên, thêm quản lý của kho gửi hàng trên phiếu (làm việc tại kho đó). Họ chọn Giao bù thì phiếu giao bù chờ Quản lý Kho tổng duyệt."),
      },
      {
        value: "CHI_QUAN_TRI",
        label: t("Chỉ Quản trị viên"),
        moTa: t("Quản lý Kho tổng vẫn xem phiếu nhưng không xử lý được."),
      },
    ],
  },
];

/** Mã cấu hình được để trống (VD ký hiệu XKNB khi công ty chưa có): bỏ qua kiểm tra "không được để trống". */
export const duocDeTrong = (code) => INVENTORY_SETTINGS.some((field) => field.code === code && field.choPhepTrong);

const soVi = (value) => Number(value).toLocaleString("vi-VN");

/**
 * Câu mô tả tác động của giá trị, đổi theo số đang nhập. Trả về [trước, phần in đậm, sau].
 * Bám đúng cách backend dùng: OMNI_SYNC_INTERVAL_MINS cho cả job lấy đơn và job đẩy tồn;
 * REALTIME_SYNC_THRESHOLD đẩy ngay khi tồn còn DƯỚI ngưỡng (0 = tắt).
 */
export function moTaTacDong(code, value) {
  switch (code) {
    case "DEFAULT_MIN_STOCK_ALERT":
      return [t("Báo thiếu hàng khi tồn khả dụng còn "), t("{{so}} cái", { count: Number(value), so: soVi(value) }), t(" trở xuống.")];
    case "OMNI_SYNC_INTERVAL_MINS":
      return [t("Lấy đơn mới và đẩy tồn lên kênh bán "), t("mỗi {{so}} phút", { count: Number(value), so: soVi(value) }), t(", khoảng {{soLan}} lần/ngày.", { soLan: soVi(Math.floor(1440 / Number(value))) })];
    case "REALTIME_SYNC_THRESHOLD":
      return Number(value) === 0
        ? [t("Đẩy tồn tức thời "), t("đang tắt"), t("; tồn chỉ được đẩy theo chu kỳ.")]
        : [t("Mã còn "), t("dưới {{so}} cái", { count: Number(value), so: soVi(value) }), t(" sau khi bán hoặc xuất kho được đẩy tồn ngay, không đợi chu kỳ.")];
    case "MA_KHACH_HANG_TIEN_TO":
      return [t("Mã mới có dạng "), maKhachHangMau(value), t(". Mã đã cấp giữ nguyên.")];
    case "KIEM_DEM_XAC_NHAN":
      // Mô tả từng cách đã nằm ở lựa chọn; ở đây chỉ nói lúc nào cách mới được áp dụng
      return [t("Màn kiểm đếm đang mở "), t("áp dụng ở lần tải dữ liệu kế tiếp"), t(" (khóa lô, quay lại thẻ hoặc tải lại trang); lô đã khóa không bị ảnh hưởng.")];
    case "MA_LO_TIEN_TO":
      return [t("Mã lô gợi ý có dạng "), `${value || ""}-PN202610201-01`, t(". Người kiểm vẫn sửa được mã lô khi khóa.")];
    case "MA_VACH_TIEN_TO":
      return [t("Biến thể mới để trống mã vạch nhận mã dạng "), maVachMau(value), t(". Mã đã cấp giữ nguyên khi đổi tiền tố.")];
    case "TEM_NGUONG_XAC_NHAN":
      return [t("Lần in có hơn "), t("{{so}} tem", { count: Number(value), so: soVi(value) }), t(" phải bấm in lần nữa để xác nhận.")];
    case "XKNB_KY_HIEU_MAC_DINH":
      return value
        ? [t("Hộp Xác nhận xuất điền sẵn ký hiệu "), value, t(" và số tiếp theo (số lớn nhất đã ghi của ký hiệu + 1), người xuất vẫn sửa được. Ví dụ 6K26NAB: 6 mẫu số, K không mã, 26 năm, N phiếu XKNB, AB công ty tự đặt.")]
        : [t("Chưa đặt: "), t("người xuất tự gõ ký hiệu"), t(" ở hộp Xác nhận xuất, hệ thống điền số tiếp theo khi ký hiệu đủ 7 ký tự. Ví dụ 6K26NAB: 6 mẫu số, K không mã, 26 năm, N phiếu XKNB, AB công ty tự đặt.")];
    case "XKNB_CHE_DO":
      return [t("Phiếu XKNB lập ngoài F Centric (phần mềm hóa đơn điện tử của công ty); F Centric ghi lại ký hiệu và số. Đổi cách này thì áp dụng từ "), t("lần xác nhận xuất kế tiếp"), "."];
    case "CHUYEN_KHO_QUYEN_XU_LY_LECH":
      // Máy chủ đọc cấu hình mỗi lần mở / bấm, nên phiếu đang chờ cũng theo cách mới
      return [t("Phiếu nhận thiếu, hỏng chờ những người này chọn Ghi giảm hao hụt hoặc Giao bù; Quản trị viên luôn được. Đổi cách này "), t("áp dụng ngay"), t(" cho cả phiếu đang chờ.")];
    default:
      return ["", "", ""];
  }
}

/** Phạm vi cho phép, hiện dưới ô nhập. VD "0–100 · 0 là tắt". */
export function phamViCauHinh(code) {
  const field = INVENTORY_SETTINGS.find((item) => item.code === code);
  if (!field || field.options) return "";
  if (field.goiY) return field.goiY;
  if (field.maxLength) return t("Tối đa {{maxLength}} ký tự", { maxLength: field.maxLength });
  const range = `${soVi(field.min)}–${soVi(field.max)}`;
  return field.rangeNote ? `${range} · ${field.rangeNote}` : range;
}

/** Mã mẫu cho tiền tố đang nhập, VD "KH" → "KH000124". */
export const maKhachHangMau = (tienTo) => `${tienTo || ""}000124`;

/** Mã vạch mẫu của biến thể id 150 với tiền tố đang nhập: tiền tố + id đệm 0 đủ 10 chữ số, VD "20" → "2000000150". */
export const maVachMau = (tienTo) => `${tienTo || ""}${"150".padStart(Math.max(3, 10 - String(tienTo || "").length), "0")}`;

export function createEmptyInventoryValues() {
  return Object.fromEntries(INVENTORY_SETTINGS.map((item) => [item.code, ""]));
}

/**
 * Cấu hình đọc từ API, kiểm đủ mã và đúng kiểu. `group`: chỉ bắt buộc đủ mã của mục đang mở
 * (mục khác thiếu mã — VD frontend mới chạy trước backend chưa nạp mã mới — không làm hỏng mục này).
 */
export function readCompleteInventorySettings(data, group) {
  const settings = selectInventorySettings(data);
  const sai = settings.some((item) => {
    const field = INVENTORY_SETTINGS.find(({ code }) => code === item.maCauHinh);
    return item.kieuDuLieu !== (field?.type ?? "INT");
  });
  const canCo = INVENTORY_SETTINGS.filter((field) => !group || field.group === group);
  const thieu = canCo.some((field) => !settings.some((item) => item.maCauHinh === field.code));
  if (thieu || sai) {
    throw new Error(t("Không thể tải đủ cài đặt."));
  }
  return settings;
}

export function validateInventorySetting(value, type) {
  if (typeof value !== "string" || !value.trim()) return t("Giá trị cấu hình không được để trống.");
  if (value.length > 255) return t("Giá trị cấu hình tối đa 255 ký tự.");
  switch (type) {
    case "INT": {
      // Integer.parseInt của BE: không nhận số thập phân, số mũ hay khoảng trắng.
      if (!/^[+-]?\d+$/.test(value)) return t("Nhập số nguyên, không có khoảng trắng hoặc phần thập phân.");
      const number = Number(value);
      if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) {
        return t("Số nguyên phải nằm trong khoảng -2147483648 đến 2147483647.");
      }
      return "";
    }
    case "DECIMAL": {
      // Double.parseDouble: số thập phân/số mũ, hex float, NaN và Infinity.
      const decimal = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?|NaN|Infinity)$/;
      const hex = /^[+-]?0[xX](?:[\da-fA-F]+(?:\.[\da-fA-F]*)?|\.[\da-fA-F]+)[pP][+-]?\d+[fFdD]?$/;
      return decimal.test(value.trim()) || hex.test(value.trim()) ? "" : t("Giá trị không đúng định dạng số.");
    }
    case "BOOLEAN":
      return /^(true|false|1|0)$/i.test(value) ? "" : t("Nhập true, false, 1 hoặc 0.");
    case "STRING":
      return "";
    default:
      return t("Kiểu dữ liệu cấu hình chưa được hỗ trợ: ") + type;
  }
}

export function selectInventorySettings(data) {
  return INVENTORY_SETTINGS.flatMap(({ code }) => {
    const matches = data.filter((item) => item?.maCauHinh === code);
    if (matches.length > 1) throw new Error(t("API trả về mã cấu hình trùng lặp: ") + code);
    if (!matches.length) return [];
    const setting = matches[0];
    if (typeof setting.giaTri !== "string" || typeof setting.kieuDuLieu !== "string") {
      throw new Error(t("Dữ liệu cấu hình không hợp lệ: ") + code);
    }
    return [setting];
  });
}

// Kiểm tra kiểu dữ liệu trước, rồi tới giới hạn min/max của từng cấu hình.
export function validateInventoryField(code, value, type) {
  if (value === "" && duocDeTrong(code)) return "";
  const typeError = validateInventorySetting(value, type);
  if (typeError) return typeError;
  const field = INVENTORY_SETTINGS.find((item) => item.code === code);
  if (field?.options) return field.options.some((o) => o.value === value) ? "" : t("Chọn một trong các cách có sẵn.");
  if (field?.pattern) return field.pattern.test(value) ? "" : field.patternMessage;
  if (field?.min === undefined || field?.max === undefined) return "";
  const number = Number(value);
  return number < field.min || number > field.max
    ? t("Nhập giá trị từ {{min}} đến {{max}}.", { min: field.min.toLocaleString("vi-VN"), max: field.max.toLocaleString("vi-VN") })
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
