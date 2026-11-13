package com.dev.backend.exception.customize;

/**
 * Mã lỗi nghiệp vụ dùng với {@link LoiCoMaException} (giao diện xử lý theo mã, không dò câu chữ).
 * Bảng mã, HTTP và dữ liệu kèm theo: hợp đồng chung đợt "Mẫu email mới", mục 2.1.
 */
public final class MaLoi {

    private MaLoi() {
    }

    // ---------------- Cổng nhà cung cấp ----------------

    /** 400 · Không có đơn hoặc email không khớp nhà cung cấp của đơn (một câu chung, không lộ đơn nào tồn tại). */
    public static final String DON_HOAC_EMAIL_SAI = "DON_HOAC_EMAIL_SAI";
    /** 409 · Đơn không ở trạng thái chờ báo giá (2) / đã có kết quả / yêu cầu không còn ở 3. */
    public static final String DON_KHONG_CON_NHAN = "DON_KHONG_CON_NHAN";
    /** 429 · Xin mã lại trong thời gian chờ, hoặc quá số mã mỗi giờ. data: guiLaiSauGiay, hetHanGiay. */
    public static final String MA_CU_CON_HIEU_LUC = "MA_CU_CON_HIEU_LUC";
    /** 400 · Sai mã xác nhận. data: conLaiLanThu. */
    public static final String MA_SAI = "MA_SAI";
    /** 400 · Mã quá hạn, đã dùng, hoặc đã sai đủ số lần. */
    public static final String MA_HET_HAN = "MA_HET_HAN";
    /** 403 · Thiếu / sai / hết hạn / khác đơn header X-Phien-Bao-Gia. */
    public static final String PHIEN_HET_HAN = "PHIEN_HET_HAN";
    /** 503 · Email mã xác nhận không gửi được (mã đã bị xóa, xin lại được ngay). */
    public static final String CHUA_GUI_DUOC_MA = "CHUA_GUI_DUOC_MA";
    /** 400 · Dữ liệu báo giá sai. data: dong (id dòng sai, nếu có). */
    public static final String BAO_GIA_KHONG_HOP_LE = "BAO_GIA_KHONG_HOP_LE";

    // ---------------- Xét báo giá ----------------

    /** 409 · Đơn không còn ở trạng thái chờ xét (2). */
    public static final String DON_DA_CO_KET_QUA = "DON_DA_CO_KET_QUA";
    /** 409 · Nhà cung cấp chưa gửi báo giá (chưa có ngayBaoGia). */
    public static final String CHUA_CO_BAO_GIA = "CHUA_CO_BAO_GIA";
    /** 409 · ngayBaoGiaDaXem khác giá trị trong CSDL (nhà cung cấp vừa gửi lại). */
    public static final String BAO_GIA_DA_DOI = "BAO_GIA_DA_DOI";
    /**
     * 409 · Xét báo giá / gửi lại email yêu cầu báo giá khi yêu cầu không còn mở: yêu cầu khác 3, đã có đơn cùng yêu
     * cầu ở 3 hoặc 5, đơn không thuộc yêu cầu nào hoặc yêu cầu không còn trong CSDL.
     */
    public static final String YEU_CAU_KHONG_CON_MO = "YEU_CAU_KHONG_CON_MO";

    // ---------------- Gửi yêu cầu báo giá ----------------

    /** 409 · Thiếu Tên đăng ký kinh doanh / Địa chỉ đăng ký. data: thieu (chỉ mục thiếu). */
    public static final String THIEU_THONG_TIN_CUA_HANG = "THIEU_THONG_TIN_CUA_HANG";
    /** 409 · Yêu cầu không còn ở trạng thái đã duyệt (2): đã gửi rồi (bấm 2 lần). */
    public static final String YEU_CAU_DA_GUI = "YEU_CAU_DA_GUI";
    /** 409 · Gửi lại email yêu cầu báo giá khi không đủ điều kiện / bấm lại trong thời gian chờ. */
    public static final String KHONG_GUI_LAI_DUOC = "KHONG_GUI_LAI_DUOC";

    // ---------------- Kết nối kênh bán hàng ----------------

    /** 409 · Ngắt kết nối khi kênh đang đẩy tồn hoặc đang "Đồng bộ ngay". */
    public static final String DANG_DONG_BO = "DANG_DONG_BO";
    /** 409 · Đang kết nối mà lưu khóa với tên miền cửa hàng khác: phải ngắt kết nối trước. */
    public static final String GIAN_HANG_KHAC = "GIAN_HANG_KHAC";
    /** 400 · Máy chủ chưa hỗ trợ kết nối / ngắt kết nối với sàn này (hiện chỉ Shopify). */
    public static final String SAN_KHONG_HO_TRO = "SAN_KHONG_HO_TRO";
    /** 409 · Thao tác cần khóa truy cập (tải sản phẩm, lấy đơn, đẩy tồn…) khi kênh chưa kết nối. Giao diện đọc lại kết nối. */
    public static final String KENH_CHUA_KET_NOI = "KENH_CHUA_KET_NOI";
    /** 424 · Cấp lại khóa truy cập (khóa làm mới OAuth) không thành công. Không dùng 502: Cloudflare thay trang lỗi 502. */
    public static final String LAM_MOI_KHOA_LOI = "LAM_MOI_KHOA_LOI";
    /** 400 · Lỗi xác thực OAuth2 hoặc trao đổi mã authorization code với TikTok Shop thất bại. */
    public static final String TIKTOK_AUTH_FAILED = "TIKTOK_AUTH_FAILED";
    /** 401 · Access Token TikTok Shop đã hết hạn hoặc bị người bán thu hồi trên Seller Center. */
    public static final String TIKTOK_TOKEN_EXPIRED = "TIKTOK_TOKEN_EXPIRED";
    /** 404 · Không tìm thấy kho bán hàng (warehouse) tương ứng trên TikTok Shop để nhận tồn. */
    public static final String TIKTOK_WAREHOUSE_NOT_FOUND = "TIKTOK_WAREHOUSE_NOT_FOUND";
    /** 429 · Chạm giới hạn tần suất gọi API (Rate Limit) của TikTok Shop, cần giãn cách theo backoff. */
    public static final String TIKTOK_RATE_LIMIT = "TIKTOK_RATE_LIMIT";
    /** 400 · Lỗi gọi TikTok Shop Open API hoặc phản hồi nghiệp vụ thất bại. */
    public static final String TIKTOK_API_ERROR = "TIKTOK_API_ERROR";

    // ---------------- Tài khoản ----------------

    /**
     * 403 · Tài khoản còn mật khẩu tạm (must_change_password): chỉ gọi được Xem thông tin của tôi, Đổi mật khẩu,
     * Đăng xuất và danh sách kho của tôi cho tới khi đổi mật khẩu. Giao diện mở hộp Đổi mật khẩu.
     */
    public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
    /** 400 · Liên kết đặt mật khẩu không có (sai, thiếu ký tự khi chép). */
    public static final String LIEN_KET_KHONG_HOP_LE = "LIEN_KET_KHONG_HOP_LE";
    /** 400 · Liên kết đặt mật khẩu đã quá hạn. */
    public static final String LIEN_KET_HET_HAN = "LIEN_KET_HET_HAN";
    /** 400 · Liên kết đặt mật khẩu đã dùng để đặt mật khẩu. */
    public static final String LIEN_KET_DA_DUNG = "LIEN_KET_DA_DUNG";
    /** 400 · Liên kết đặt mật khẩu đã bị hủy: quản trị viên gửi liên kết mới hơn, hoặc mật khẩu vừa đổi bằng cách khác. */
    public static final String LIEN_KET_DA_THAY = "LIEN_KET_DA_THAY";

    // ---------------- Sản phẩm ----------------

    /**
     * 409 · Tạo/sửa sản phẩm với tên đã có (không phân biệt hoa thường, có phân biệt dấu, tính mọi trạng thái kể cả
     * Ngừng hoạt động). data: sanPhamId, maSanPham của sản phẩm đã có.
     */
    public static final String TEN_SAN_PHAM_TRUNG = "TEN_SAN_PHAM_TRUNG";

    // ---------------- Kiểm kê khoanh vùng (đặc tả BA 03/11, mục 9.2) ----------------

    /** 409 · Phạm vi giao thoa với đợt khác đang giữ khóa. data: vanDe (danh sách mã đợt, kệ / lô, loại khóa). */
    public static final String STK_SCOPE_CONFLICT = "STK_SCOPE_CONFLICT";
    /** 409 · Còn phiếu nhặt đang mở, phiếu xuất đã nhặt chưa xuất hoặc QR payOS đang giữ hàng trong phạm vi. data: vanDe. */
    public static final String STK_PENDING_PICK = "STK_PENDING_PICK";
    /**
     * Cảnh báo ở Xem trước, KHÔNG chặn Bắt đầu: phiếu chuyển đang về kho, phiếu nhập chưa hoàn tất đã gán kệ trong
     * phạm vi (việc có thể làm lệch số đếm nếu người kiểm không biết).
     */
    public static final String STK_SCOPE_WARNING = "STK_SCOPE_WARNING";
    /** Cảnh báo không chặn ở hộp Phê duyệt: sau điều chỉnh, đơn chờ xuất / phiếu chuyển đang giữ chỗ không còn đủ hàng. */
    public static final String STK_APPROVE_WARNING = "STK_APPROVE_WARNING";
    /** 400 · Khu vực / kệ khác kho, thiếu lựa chọn, kho ảo, danh mục sai, kệ bảo trì, tồn chưa có kệ. data: vanDe. */
    public static final String STK_INVALID_SCOPE = "STK_INVALID_SCOPE";
    /** 409 · Thao tác không hợp lệ với trạng thái hiện tại của đợt hoặc dòng. data: trangThai. */
    public static final String STK_INVALID_STATE = "STK_INVALID_STATE";
    /** 409 · Còn dòng chưa kiểm / cần kiểm lại hoặc dòng lệch thiếu lý do. data: chuaKiem, canKiemLai, thieuLyDo. */
    public static final String STK_COUNT_INCOMPLETE = "STK_COUNT_INCOMPLETE";
    /** 409 · Tồn tại kệ khác số đã chốt lúc bắt đầu; không duyệt. data: vanDe. */
    public static final String STK_STOCK_CHANGED = "STK_STOCK_CHANGED";
    /** 409 · Tồn sau điều chỉnh thấp hơn phần đang giữ cho đơn. data: vanDe. */
    public static final String STK_RESERVED_EXCEEDS_STOCK = "STK_RESERVED_EXCEEDS_STOCK";
    /** 409 · expectedVersion không khớp, hoặc Idempotency-Key đã dùng cho yêu cầu khác. data: phienBan. */
    public static final String STK_VERSION_CONFLICT = "STK_VERSION_CONFLICT";
    /**
     * 409 · Luồng nhập / xuất / bán / nhặt / sửa dữ liệu chủ chạm phạm vi đợt đang kiểm kê hoặc chờ duyệt.
     * data: dotKiemKeId, maDotKiemKe, viTri, maLo.
     */
    public static final String STK_LOCKED = "STK_LOCKED";
    /** 503 · CSDL chưa chạy migration-2026-11-03-kiem-ke-khoanh-vung.sql. */
    public static final String STK_NOT_READY = "STK_NOT_READY";
}
