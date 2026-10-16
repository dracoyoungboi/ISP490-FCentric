/**
 * Cấu hình chung cho THÔNG BÁO NHANH (toast) của cả hệ thống: ô nổi tự tắt sau một thao tác
 * ("Đã lưu đơn mua", "Không lưu được…"). Khác với thông báo ở chuông trên đầu trang
 * (useThongBao, thongBaoService).
 *
 * Muốn đổi vị trí, thời gian, tốc độ hiệu ứng… cho mọi màn: chỉ sửa file này.
 * Kiểu đã chốt ngày 16/10/2026: "Đề xuất cho FCentric" trong bản demo các kiểu thông báo.
 */
export const CAU_HINH_THONG_BAO_NHANH = Object.freeze({
  kieu: "Đề xuất cho FCentric",

  /** Góc mặc định: dưới phải, không đè thanh tìm kiếm và các nút chính ở đầu trang. */
  viTri: "bottom-right",

  /**
   * Trang có nút thao tác chính nằm ở góc dưới phải thì đổi góc.
   * POS: cột hóa đơn và nút Thanh toán nằm bên phải → thông báo sang dưới trái (phía danh mục hàng).
   */
  viTriTheoTrang: Object.freeze([{ tienTo: "/pos", viTri: "bottom-left" }]),

  /** Khoảng cách tới mép màn hình (px). Điện thoại (≤ 600px) dùng số nhỏ hơn. */
  cachMep: 16,
  cachMepDienThoai: 12,

  /** Bề rộng một ô thông báo (px), số ô hiện cùng lúc và khoảng cách giữa các ô (px). */
  beRong: 360,
  soHienCungLuc: 3,
  khoangCach: 8,

  /**
   * Thời gian tự tắt (ms) theo loại. Infinity = chờ người dùng bấm đóng.
   * "coNutThaoTac": thông báo có nút như Hoàn tác, Mở phiếu, Thử lại.
   */
  thoiGian: Object.freeze({
    thanhCong: 3000,
    thongTin: 4000,
    canhBao: 6000,
    loi: 8000,
    coNutThaoTac: 8000,
  }),

  /**
   * Chữ dài thì giữ lâu hơn để kịp đọc: thời gian = max(theo loại, msNen + msMoiKyTu × số ký tự),
   * không vượt toiDa. Ví dụ "Đã lưu đơn mua" vẫn 3 giây; câu báo lỗi 150 ký tự được khoảng 9 giây.
   */
  docChu: Object.freeze({ msNen: 1000, msMoiKyTu: 55, toiDa: 10000 }),

  /** Tốc độ hiệu ứng (ms): hiện ra và tắt đi. */
  hieuUng: Object.freeze({ vao: 200, ra: 150 }),

  /**
   * Gộp thông báo giống hệt nhau (cùng loại, cùng nội dung) thành một ô có đếm "×2, ×3…"
   * thay vì xếp chồng nhiều ô. Hai lần gọi cách nhau dưới `msCungMotLan` coi là một lần
   * (bấm đúp, React StrictMode chạy hiệu ứng hai lần khi dev) nên không tăng số đếm.
   */
  gopThongBaoTrung: true,
  msCungMotLan: 300,

  /**
   * Bấm nút sao chép (số điện thoại, email, mã đơn…) thì báo thế nào:
   * - "thong-bao": bật thông báo nhanh "Đã sao chép số điện thoại" (đang dùng, chốt 16/10/2026).
   * - "tai-cho": không bật thông báo, nút đổi thành dấu tích kèm chữ "Đã chép" ngay tại chỗ.
   */
  nutSaoChep: "thong-bao",
  /** Chỉ dùng khi nutSaoChep = "tai-cho": dấu tích "Đã chép" hiện trong bao lâu (ms). */
  saoChepTaiCho: 1500,
  /** Chỉ dùng khi nutSaoChep = "tai-cho": mục "Sao chép…" trong menu ⋯ đổi thành "Đã sao chép" rồi menu tự đóng sau (ms). */
  dongMenuSauSaoChep: 700,

  /**
   * Thanh dính đáy màn hình (thanh nút Lưu của biểu mẫu, thanh Thanh toán của POS trên màn nhỏ…):
   * khi thanh đang nằm ở đáy, thông báo tự nâng lên trên thanh để không che nút.
   * Thanh viết theo kiểu khác thì gắn thuộc tính data-tranh-thong-bao.
   */
  boChonThanhDay: ".sticky.bottom-0, .fixed.bottom-0, [data-tranh-thong-bao]",
});
