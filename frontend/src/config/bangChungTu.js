/**
 * Cấu hình chung cho BẢNG HÀNG của các màn chi tiết chứng từ (yêu cầu nhập hàng, báo giá, phiếu nhặt hàng,
 * phiếu xuất kho, chọn lô, phiếu chuyển kho, phiếu nhập kho): khi nào hiện thanh công cụ, khi nào thu gọn theo
 * sản phẩm, cỡ trang, số thẻ lô / số đơn hiện trước. Kèm thời hạn chờ thao tác của hộp xác nhận chứng từ.
 *
 * Muốn đổi ngưỡng hay cỡ trang cho mọi màn: chỉ sửa file này (không viết số vào từng màn).
 * Chốt ngày 21/10/2026 cùng phương án "Màn chi tiết chứng từ – thiết kế lại" (mục 3: chứng từ nhiều sản phẩm).
 * File không import alias "@/…" để chạy được bằng `node --test`.
 */

/** Chứng từ có quá số dòng này thì hiện ô tìm, số kết quả, lọc nhanh và phân trang. Từ đó trở xuống: hiện hết. */
export const NGUONG_CONG_CU = 10;

/** Chứng từ có quá số biến thể này thì các nhóm sản phẩm mặc định thu gọn (tìm kiếm vẫn tự mở nhóm khớp). */
export const NGUONG_THU_GON = 30;

/** Lựa chọn cỡ trang khi phân trang theo sản phẩm (không cắt đôi một sản phẩm). Số đầu là mặc định. */
export const CO_TRANG_NHOM = Object.freeze([10, 20, 50]);

/** Lựa chọn cỡ trang khi phân trang theo dòng (phiếu nhặt hàng, phiếu xuất kho). Số đầu là mặc định. */
export const CO_TRANG_DONG = Object.freeze([20, 50, 100]);

/** Số thẻ lô hiện trên một dòng; còn lại gom vào nút "+n lô" mở tại chỗ. */
export const SO_LO_HIEN = 2;

/** Số đơn hiện trước ở cột phải (vd. đơn trong phiếu nhặt hàng); còn lại gom vào "Xem thêm n đơn". */
export const SO_DON_HIEN = 5;

/** Màn Chọn lô hàng: có quá số lô này thì hiện ô tìm mã lô và phân trang. */
export const NGUONG_CONG_CU_LO = 8;

/** Lựa chọn cỡ trang của danh sách lô (màn Chọn lô hàng). Số đầu là mặc định. */
export const CO_TRANG_LO = Object.freeze([10, 20]);

/** Tóm tắt màu · kích cỡ của một nhóm đang thu gọn: mỗi vế hiện tối đa ngần này giá trị, còn lại ghi "+n". */
export const SO_MUC_TOM_TAT = 6;

/** Hộp chọn kho theo tồn khả dụng (Gửi sang kho, Chốt thành đơn): có quá số kho này thì hiện ô tìm kho. */
export const NGUONG_TIM_KHO = 5;

/** Hộp chọn kho: số mặt hàng thiếu hiện dưới một kho thiếu hàng; còn lại ghi "Còn n mặt hàng thiếu khác". */
export const SO_MAT_HANG_THIEU_HIEN = 5;

/** Cột phải màn đơn bán hàng: số phiếu xuất hiện trước; còn lại gom vào "Xem thêm n phiếu xuất". */
export const SO_PHIEU_XUAT_HIEN = 3;

/**
 * Thời lượng video bằng chứng đóng gói (giây, gồm cả hai đầu). Máy chủ gửi khoảng thật (`thoiLuongVideoToiThieu`,
 * `thoiLuongVideoToiDa`, BangChungDongGoiServiceImpl); số ở đây chỉ dùng khi máy chủ không gửi. Màn Đóng gói khóa nút
 * Dừng quay dưới `toiThieu`, tự dừng ở `toiDa`, kiểm tệp chọn từ máy.
 */
export const THOI_LUONG_VIDEO_DONG_GOI = Object.freeze({ toiThieu: 15, toiDa: 180 });

/** Quay video đóng gói: số giây cuối trước khi tự dừng thì nhãn đổi thành "Tự dừng sau n giây". */
export const CANH_BAO_TU_DUNG_VIDEO_GIAY = 15;

/**
 * Chất lượng quay video đóng gói trên trang: khung mong muốn 1280×720, 1,5 Mbit/s. Đo thử trên Chrome (22/10/2026, VP9):
 * video 3 phút khoảng 26 MB, để trình duyệt tự chọn thì khoảng 43 MB. Đủ rõ để nhìn hàng và tem.
 */
export const CHAT_LUONG_QUAY_VIDEO = Object.freeze({ rong: 1280, cao: 720, bitGiay: 1_500_000 });

/** Dung lượng tối đa một video đóng gói (MB) — trùng MAX_VIDEO_SIZE của máy chủ; tệp lớn hơn bị chặn trước khi tải. */
export const DUNG_LUONG_VIDEO_TOI_DA_MB = 100;

/** Số ký tự tối đa của lý do khách từ chối báo giá bán (ô lý do ở Chi tiết báo giá; máy chủ lưu cột không giới hạn). */
export const LY_DO_KHACH_TU_CHOI_TOI_DA = 500;

/** Số đơn tối đa lấy về khi tìm các đơn bán sinh từ một báo giá (mỗi lần chốt lại sau khi hủy thêm một đơn "-n"). */
export const SO_DON_TU_BAO_GIA_TOI_DA = 50;

/** Số lời gọi API chạy cùng lúc khi tải thêm theo từng dòng (lô của từng dòng phiếu xuất, lô kế thừa của phiếu nhập). */
export const SO_VIEC_DONG_THOI = 4;

/**
 * Thời hạn (ms) chờ máy chủ trả lời một thao tác chạy từ hộp xác nhận chứng từ (HopXacNhanChungTu: duyệt, từ chối, hủy,
 * hoàn tất nhặt, xuất kho…). apiClient không đặt thời gian chờ chung, mà lúc hộp đang chạy thì mọi lối đóng hộp đều khóa:
 * quá thời hạn này màn đóng hộp, báo lỗi và tải lại (máy chủ có thể vẫn đã làm xong). Dùng qua chayCoThoiHan
 * (components/chung-tu/thoiHanThaoTac.js); không áp cho tải ảnh / video, hộp phân công, phân bổ lô.
 */
export const THOI_HAN_THAO_TAC_MS = 30000;

/**
 * Sau khi hết THOI_HAN_THAO_TAC_MS, màn khóa các nút thao tác của chứng từ tới khi lời gọi gốc (vẫn chạy ở nền) kết
 * thúc rồi tải lại — tránh bấm lại làm hai lần. Quá thời gian chờ thêm này (ms, tính từ lúc hết thời hạn) mà lời gọi
 * gốc vẫn chưa kết thúc thì vẫn mở khóa và tải lại, không khóa màn vĩnh viễn.
 */
export const THOI_HAN_CHO_GOC_MS = 120000;

/** Kiểm kê: số đếm lớn nhất nhập được cho một lô (ô Thực tế chỉ nhận số nguyên, tối đa ngần này chữ số). */
export const SO_DEM_KIEM_KE_TOI_DA = 999999;

/** Kiểm kê: hộp Hoàn thành liệt kê ngần này lô lệch nhiều nhất (còn lại xem bằng "Xem tất cả n lô lệch"). */
export const SO_LO_LECH_HIEN = 5;

/**
 * Kiểm kê, giao dịch xen giữa: giao dịch kho của một lô (nhập, xuất, bán tại quầy) ghi sau mốc (giờ đếm − khoảng này, ms)
 * thì coi là có thể xảy ra sau lúc đếm → lô cần đếm lại, hoàn thành không gửi. Khoảng này bù lệch đồng hồ giữa máy đếm và
 * máy chủ (giờ đếm lấy theo máy người dùng, chỉnh theo header Date của máy chủ khi đọc được).
 */
export const DUNG_SAI_GIO_KIEM_KE_MS = 120000;

/** Ghi chú khi tạo đợt kiểm kê: số ký tự tối đa. */
export const GHI_CHU_KIEM_KE_TOI_DA = 500;

/** Màn Gửi yêu cầu báo giá, cột "Gửi đến": số nhà cung cấp đã chọn hiện trước; còn lại gom "và n nhà cung cấp khác". */
export const SO_NCC_GUI_HIEN = 6;

/** Màn Gửi yêu cầu báo giá, cột phải: số dòng sản phẩm của yêu cầu hiện trước; đủ danh sách xem ở chi tiết yêu cầu. */
export const SO_DONG_YEU_CAU_HIEN = 5;

/**
 * Màn Gửi yêu cầu báo giá: lần gửi không rõ kết quả (mất kết nối, proxy hết giờ chờ) thì khóa nút Gửi ngần này (ms) rồi
 * mới tải lại yêu cầu — máy chủ gửi email lần lượt từng nhà cung cấp trong một giao dịch, có thể vẫn đang chạy.
 */
export const CHO_GUI_LAI_MS = 90000;
