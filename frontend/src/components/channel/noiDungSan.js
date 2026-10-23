/**
 * Chữ riêng của từng sàn kết nối bằng ủy quyền (Lazada, TikTok Shop) trên các màn kênh bán hàng, đúng câu trong
 * KH mục B (docs/omnichannel/KE-HOACH-LAZADA-TIKTOK.md) và bản demo đã chốt. Shopify (dán khóa) giữ chữ sẵn có
 * trong từng thành phần nên không có ở đây.
 */
const NOI_DUNG = {
  LAZADA: {
    nhanIdSan: "Seller ID",
    khachMacDinh: "Khách Lazada",
    goiYAppKey: "Lấy ở Lazada Open Platform › App Console.",
    coServiceId: false,
    moTaUyQuyen:
      "Bấm Ủy quyền, Lazada mở trang đăng nhập Seller Center và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong Lazada đưa bạn quay lại đây.",
    hanUyQuyen: "Ủy quyền có hạn 50 ngày và không tự gia hạn được. Hệ thống nhắc trước 7 ngày; bạn chỉ cần bấm Ủy quyền lại.",
    // Gian hàng một kho: Lazada nhận số vào kho mặc định nên chỉ hiện tên, không cho chọn
    khoSan: {
      nhan: "Kho trên Lazada",
      moTa: "Gian hàng một kho: Lazada nhận số vào kho mặc định, không cần chọn.",
      chiDoc: "Kho mặc định",
    },
    ghiChuTon: "Trong giờ sale lớn Lazada khóa cập nhật tồn; hệ thống chuyển sang cộng/trừ và đẩy lại ở lượt sau.",
    // Không lặp số phút: thẻ Đơn hàng đã ghi chu kỳ ở công tắc và dòng "Chu kỳ chạy"
    ghiChuDon: "Lazada không gửi thông báo tới máy chủ này nên đơn mới chỉ về theo chu kỳ quét.",
  },
  TIKTOK: {
    nhanIdSan: "Shop ID",
    khachMacDinh: "Khách TikTok Shop",
    goiYAppKey: "Lấy ở Partner Center › App & Service.",
    coServiceId: true,
    moTaUyQuyen:
      "Bấm Ủy quyền, TikTok Shop mở trang đăng nhập Seller Center và hỏi bạn có cho FCentric đọc sản phẩm, đơn hàng và cập nhật tồn không. Đồng ý xong TikTok Shop đưa bạn quay lại đây.",
    hanUyQuyen:
      "Thời hạn ủy quyền do bạn chọn khi đồng ý trên TikTok Shop. Hệ thống tự làm mới khóa 7 ngày một lần và nhắc trước 7 ngày khi sắp hết hạn.",
    khoSan: {
      nhan: "Kho bán hàng trên TikTok Shop",
      moTa: "Số tồn chỉ được ghi vào kho này. Kho khác trên TikTok Shop giữ nguyên.",
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
    { so: 1, ten: "Ủy quyền gian hàng", moTa: "Đăng nhập Seller Center và cho FCentric kết nối." },
    { so: 2, ten: "Tồn kho", moTa: `Chọn cách cập nhật số tồn lên ${tenSan}.` },
    { so: 3, ten: "Đơn hàng", moTa: `Bật nhận đơn mới từ ${tenSan} về FCentric.` },
    { so: 4, ten: "Liên kết sản phẩm", moTa: `Ghép sản phẩm trên ${tenSan} với biến thể FCentric.` },
  ];
}
