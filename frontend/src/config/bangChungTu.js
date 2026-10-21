/**
 * Cấu hình chung cho BẢNG HÀNG của các màn chi tiết chứng từ (yêu cầu nhập hàng, báo giá, phiếu nhặt hàng,
 * phiếu xuất kho, chọn lô, phiếu chuyển kho, phiếu nhập kho): khi nào hiện thanh công cụ, khi nào thu gọn theo
 * sản phẩm, cỡ trang, số thẻ lô / số đơn hiện trước.
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

/** Số lời gọi API chạy cùng lúc khi tải thêm theo từng dòng (lô của từng dòng phiếu xuất, lô kế thừa của phiếu nhập). */
export const SO_VIEC_DONG_THOI = 4;
