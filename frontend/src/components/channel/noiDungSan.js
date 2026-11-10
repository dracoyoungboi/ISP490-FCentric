import { t } from "@/i18n";
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
    // Gian hàng một kho: Lazada nhận số vào kho mặc định nên chỉ hiện tên, không cho chọn
    khoSan: {
      nhan: t("Kho trên Lazada"),
      moTa: t("Gian hàng một kho: Lazada nhận số vào kho mặc định, không cần chọn."),
      chiDoc: t("Kho mặc định"),
    },
    ghiChuTon: t("Trong giờ sale lớn Lazada khóa cập nhật tồn; hệ thống chuyển sang cộng/trừ và đẩy lại ở lượt sau."),
    // Không lặp số phút: thẻ Đơn hàng đã ghi chu kỳ ở công tắc và dòng "Chu kỳ chạy"
    ghiChuDon: t("Lazada không gửi thông báo tới máy chủ này nên đơn mới chỉ về theo chu kỳ quét."),
  },
  LAZADA_SANDBOX: {
    nhanIdSan: "Seller ID (Test)",
    khachMacDinh: "Khách Lazada Sandbox", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Lấy ở Lazada Open Platform › App Console (Ứng dụng Sandbox)."),
    coServiceId: false,
    moTaUyQuyen:
      t("Bấm Ủy quyền, Lazada mở cổng đăng nhập tài khoản Sandbox Seller Center và yêu cầu cấp quyền đọc sản phẩm, đơn hàng và tồn kho. Vui lòng sử dụng tài khoản test từ Lazada Console."),
    hanUyQuyen: t("Ủy quyền môi trường Sandbox có hiệu lực tương tự Production (50 ngày). Bạn có thể bấm Ủy quyền lại bất cứ lúc nào để làm mới token thử nghiệm."),
    khoSan: {
      nhan: t("Kho trên Lazada Sandbox"),
      moTa: t("Gian hàng thử nghiệm một kho: Lazada Sandbox nhận số vào kho mặc định, không cần chọn."),
      chiDoc: t("Kho mặc định (Sandbox)"),
    },
    ghiChuTon: t("Môi trường Sandbox phục vụ mô phỏng kiểm thử cập nhật tồn kho an toàn, không ảnh hưởng gian hàng thật."),
    ghiChuDon: t("Đơn hàng Sandbox đồng bộ độc lập với tiền tố LZD-SBX- và tự động gắn nhãn đơn test thử nghiệm."),
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
      moTa: t("Gian hàng một kho: Shopee nhận số vào kho mặc định, không cần chọn."),
      chiDoc: t("Kho mặc định"),
    },
    ghiChuTon: t("Hệ thống tự động gom cụm đẩy tồn kho theo lô sang Shopee theo quy tắc tồn khả dụng đã cấu hình."),
    ghiChuDon: t("Đơn mới từ Shopee đồng bộ tự động theo chu kỳ quét định kỳ với tiền tố SHP-."),
  },
  SHOPEE_OFFICIAL: {
    nhanIdSan: "Shop ID",
    khachMacDinh: "Khách Shopee Chính Thống", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Partner ID ứng dụng đối tác trên Shopee Open Platform Console."),
    coServiceId: false,
    moTaUyQuyen:
      t("Bấm Ủy quyền, Shopee mở trang đăng nhập Shopee Partner và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong Shopee đưa bạn quay lại đây."),
    hanUyQuyen:
      t("Hạn ủy quyền Shopee là 30 ngày (hệ thống tự động làm mới mã truy cập mỗi 4 giờ bằng mã làm mới)."),
    khoSan: {
      nhan: t("Kho trên Shopee"),
      moTa: t("Gian hàng một kho: Shopee nhận số vào kho mặc định, không cần chọn."),
      chiDoc: t("Kho mặc định"),
    },
    ghiChuTon: t("Cập nhật tồn kho trực tiếp qua Shopee Open Platform API v2 (/api/v2/product/update_stock)."),
    ghiChuDon: t("Đồng bộ đơn hàng tự động qua Shopee Open Platform API v2 (/api/v2/order/get_order_list)."),
  },
  SHOPEE_SANDBOX: {
    nhanIdSan: "Shop ID (Sandbox)",
    khachMacDinh: "Khách Shopee Sandbox", // i18n-giu-nguyen: tên khách hàng mặc định đã lưu trong DB
    goiYAppKey: t("Môi trường giả lập Sandbox nội bộ: Không cần tài khoản Shopee thật."),
    coServiceId: false,
    moTaUyQuyen:
      t("Môi trường Sandbox nội bộ cho phép kích hoạt và thử nghiệm 1-chạm mà không cần tài khoản đối tác Shopee đã phê duyệt. Bấm Kết nối để sẵn sàng sinh đơn và đồng bộ."),
    hanUyQuyen: t("Môi trường thử nghiệm Sandbox nội bộ có hiệu lực vĩnh viễn (365 ngày tự gia hạn)."),
    khoSan: {
      nhan: t("Kho trên Shopee Sandbox"),
      moTa: t("Môi trường thử nghiệm: Đơn Shopee Sandbox mặc định xuất từ Kho Tổng FCentric."),
      chiDoc: t("Kho Tổng (Sandbox)"),
    },
    ghiChuTon: t("Đẩy tồn giả lập an toàn 100%, bảo toàn dữ liệu thực tế của hệ thống."),
    ghiChuDon: t("Hỗ trợ sinh đơn mẫu tức thì với SKU có thật trong kho để kiểm thử toàn diện quy trình nhặt, đóng gói, xuất kho và in vận đơn SPX nhiệt A6."),
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
      moTa: t("Số tồn chỉ được ghi vào kho này. Kho khác trên TikTok Shop giữ nguyên."),
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
