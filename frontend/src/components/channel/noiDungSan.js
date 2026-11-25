import { t } from "../../i18n/t.js";
/**
 * Chữ riêng của từng sàn kết nối bằng ủy quyền (Lazada, TikTok Shop) trên các màn kênh bán hàng, đúng câu trong
 * KH mục B (docs/omnichannel/KE-HOACH-LAZADA-TIKTOK.md) và bản demo đã chốt. Shopify (dán khóa) giữ chữ sẵn có
 * trong từng thành phần nên không có ở đây.
 */
const NOI_DUNG = {
  LAZADA: {
    nhanIdSan: "Seller ID",
    khachMacDinh: "Khách Lazada", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Lấy ở Lazada Open Platform › App Console."),
    coServiceId: false,
    moTaUyQuyen:
      t("Bấm Ủy quyền, Lazada mở trang đăng nhập Seller Center và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong Lazada đưa bạn quay lại đây."),
    hanUyQuyen: t("Ủy quyền có hạn 50 ngày và không tự gia hạn được. Hệ thống nhắc trước 7 ngày; bạn chỉ cần bấm Ủy quyền lại."),
    // Chỉ hiển thị kho bán hàng mặc định đang lấy từ Lazada Seller Center (chỉ đọc)
    khoSan: {
      nhan: t("Kho trên Lazada"),
      moTa: t("Tự động đồng bộ theo kho bán hàng mặc định trên Lazada; để thay đổi, thao tác trực tiếp tại Lazada Seller Center rồi bấm Tải lại từ sàn."),
      chiDoc: null,
    },
    ghiChuTon: t("Trong giờ sale lớn Lazada khóa cập nhật tồn; hệ thống chuyển sang cộng/trừ và đẩy lại ở lượt sau."),
    // Không lặp số phút: thẻ Đơn hàng đã ghi chu kỳ ở công tắc và dòng "Chu kỳ chạy"
    ghiChuDon: t("Lazada không gửi thông báo tới máy chủ này nên đơn mới chỉ về theo chu kỳ quét."),
  },
  SHOPEE: {
    nhanIdSan: "Shop ID",
    khachMacDinh: "Khách Shopee", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Nhập mã Shop ID của gian hàng Shopee (ví dụ: 88201679)."),
    coServiceId: false,
    moTaUyQuyen:
      t("Kết nối trực tiếp với gian hàng Shopee bằng Shop ID. Hệ thống tự động xác thực và đồng bộ tồn kho, đơn hàng."),
    hanUyQuyen: t("Thời hạn kết nối có hiệu lực 365 ngày (hệ thống tự động gia hạn)."),
    khoSan: {
      nhan: t("Kho trên Shopee"),
      moTa: t("Tự động đồng bộ theo kho lấy hàng mặc định trên Shopee; để thay đổi, thao tác trực tiếp tại Shopee Seller Center rồi bấm Tải lại từ sàn."),
      chiDoc: null,
    },
    ghiChuTon: t("Hệ thống tự động gom cụm đẩy tồn kho theo lô sang Shopee theo quy tắc tồn khả dụng đã cấu hình."),
    ghiChuDon: t("Đơn mới từ Shopee đồng bộ tự động theo chu kỳ quét định kỳ với tiền tố SHP-."),
  },
  SHOPEE_OFFICIAL: {
    nhanIdSan: "Shop ID",
    khachMacDinh: "Khách Shopee", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Partner ID ứng dụng đối tác trên Shopee Open Platform Console."),
    coServiceId: false,
    moTaUyQuyen:
      t("Bấm Ủy quyền, Shopee mở trang đăng nhập Shopee Partner và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong Shopee đưa bạn quay lại đây."),
    hanUyQuyen:
      t("Hạn ủy quyền Shopee là 30 ngày (hệ thống tự động làm mới mã truy cập mỗi 4 giờ bằng mã làm mới)."),
    khoSan: {
      nhan: t("Kho trên Shopee"),
      moTa: t("Tự động đồng bộ theo kho lấy hàng mặc định trên Shopee; để thay đổi, thao tác trực tiếp tại Shopee Seller Center rồi bấm Tải lại từ sàn."),
      chiDoc: null,
    },
    ghiChuTon: null,
    ghiChuDon: null,
  },
  TIKTOK: {
    nhanIdSan: "Shop ID",
    khachMacDinh: "Khách TikTok Shop", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Lấy ở Partner Center › App & Service."),
    coServiceId: false,
    moTaUyQuyen:
      t("Bấm Ủy quyền, TikTok Shop mở trang đăng nhập Seller Center và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong TikTok Shop đưa bạn quay lại đây."),
    hanUyQuyen:
      t("Thời hạn ủy quyền do bạn chọn khi đồng ý trên TikTok Shop. Hệ thống tự làm mới khóa 7 ngày một lần và nhắc trước 7 ngày khi sắp hết hạn."),
    khoSan: {
      nhan: t("Kho bán hàng trên TikTok Shop"),
      moTa: t("Tự động đồng bộ theo kho bán hàng mặc định trên TikTok Shop; để thay đổi, thao tác trực tiếp tại TikTok Shop Seller Center rồi bấm Tải lại từ sàn."),
      chiDoc: null,
    },
    ghiChuTon: null,
    // Câu "Bật nhận thông báo tức thời…" và hàng webhook chỉ thêm khi máy chủ hỗ trợ webhook (KH Phần 7)
    ghiChuDon: null,
  },
};

/** Chữ của sàn ủy quyền theo mã kênh; Shopify và mã lạ trả null. */
export function noiDungSan(maKenh) {
  return NOI_DUNG[String(maKenh ?? "").toUpperCase()] ?? null;
}

/** Kho mặc định hiện hành của sàn (ưu tiên `macDinh: true`, không có thì lấy kho hợp lệ đầu tiên). */
export function khoMacDinhSan(dsKho) {
  const ds = Array.isArray(dsKho) ? dsKho : [];
  return ds.find((k) => k?.macDinh) ?? ds[0] ?? null;
}

/** Kho trên sàn đang nhận số tồn: kho đã lưu, không có thì kho mặc định của sàn (danh sách từ GET /{maKenh}/kho-san). */
export function khoSanDangChon(maKhoSan, dsKho) {
  const ds = Array.isArray(dsKho) ? dsKho : [];
  return ds.find((k) => k.maKhoSan === maKhoSan)?.maKhoSan ?? ds.find((k) => k.macDinh)?.maKhoSan ?? ds[0]?.maKhoSan ?? "";
}

/**
 * Kho đã lưu không còn trong danh sách kho của sàn (bị xóa / đổi trên sàn): ô chọn đang hiện kho mặc định thay cho nó,
 * nên phải coi là có thay đổi cần lưu, nếu không máy chủ vẫn đẩy vào kho cũ và lượt nào cũng lỗi.
 */
export function khoDaLuuKhongCon(maKhoSan, dsKho) {
  const ds = Array.isArray(dsKho) ? dsKho : [];
  return Boolean(maKhoSan) && ds.length > 0 && !ds.some((k) => k.maKhoSan === maKhoSan);
}

/** Bốn bước ở màn giới thiệu của sàn ủy quyền (chưa kết nối). */
export function buocGioiThieu(tenSan) {
  return [
    { so: 1, ten: t("Ủy quyền gian hàng"), moTa: t("Đăng nhập Seller Center và cho FCentric kết nối.") },
    { so: 2, ten: t("Tồn kho"), moTa: t("Chọn cách cập nhật số tồn lên {{tenSan}}.", { tenSan }) },
    { so: 3, ten: t("Đơn hàng"), moTa: t("Bật nhận đơn mới từ {{tenSan}} về FCentric.", { tenSan }) },
    { so: 4, ten: t("Liên kết sản phẩm"), moTa: t("Ghép sản phẩm trên {{tenSan}} với biến thể FCentric.", { tenSan }) },
  ];
}
