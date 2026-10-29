package com.dev.backend.services.multitable;

import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NhatHangService {

    /**
     * API 1: Lấy và lọc danh sách đơn hàng chờ gom nhặt (Pending Order Aggregation - SRS 6.1.1)
     */
    Page<DonChoXuatDto> getDonChoXuat(DonChoXuatFilterRequest filterRequest);

    /**
     * API 2: Tạo consolidated Pick List từ mảng Order IDs đã chọn (SRS 6.1.1 & SRS 6.2.1)
     */
    DanhSachNhatHangDto taoPickList(TaoPickListRequest request);

    /**
     * Lấy danh sách Pick List theo kho và trạng thái (SRS 6.2.1 Pick List Management)
     */
    default Page<DanhSachNhatHangDto> getDanhSachPickList(Integer khoId, String trangThai, String searchText, Pageable pageable) {
        return getDanhSachPickList(khoId, trangThai, null, searchText, pageable);
    }

    /**
     * Như trên, lọc thêm theo loại phiếu nhặt: BAN_HANG (gom đơn bán), CHUYEN_KHO (phiếu chuyển kho); null = tất cả.
     */
    Page<DanhSachNhatHangDto> getDanhSachPickList(Integer khoId, String trangThai, String loai, String searchText, Pageable pageable);

    /**
     * Phiếu nhặt của phiếu chuyển kho vừa duyệt (đặc tả bước 8: duyệt thì đẩy PX-CK vào danh sách chờ nhặt): kho = kho xuất
     * của phiếu chuyển, chưa phân công, dòng nhặt = dòng phiếu chuyển, phân bổ lô FIFO ngay. Chạy trong giao dịch của bên
     * gọi (đã khóa phiếu chuyển).
     */
    com.dev.backend.entities.DanhSachNhatHang taoPhieuNhatChuyenKho(com.dev.backend.entities.PhieuChuyenKho phieuChuyen,
                                                                     com.dev.backend.entities.PhieuXuatKho phieuXuat,
                                                                     java.util.List<com.dev.backend.entities.ChiTietPhieuChuyenKho> dong);

    /**
     * Hủy phiếu nhặt của PX-CK khi phiếu chuyển bị hủy: hàng đã nhặt sinh lệnh trả kệ, báo màn nhặt dừng. Bên gọi đã khóa
     * phiếu chuyển và tự hủy PX-CK sau đó. Trả phiếu nhặt (null khi PX-CK không có phiếu nhặt).
     */
    com.dev.backend.entities.DanhSachNhatHang huyPhieuNhatChuyenKho(com.dev.backend.entities.PhieuXuatKho phieuXuat,
                                                                     String soPhieuChuyen);

    /**
     * Xem chi tiết đợt nhặt hàng Pick List kèm thông tin các SKU gom nhặt và mã đơn tham chiếu
     */
    DanhSachNhatHangDto getChiTietPickList(Integer id);

    /**
     * API 3: Phân công nhân viên kho nhặt hàng cho Pick List (SRS 6.2.1 Action 'Phân công' / 'Assign')
     */
    DanhSachNhatHangDto phanCongNguoiNhat(Integer id, PhanCongNguoiNhatRequest request);

    /**
     * API 4: Quét barcode đối soát mặt hàng và cập nhật số lượng đã nhặt (SRS 6.3.1 Execute Picking)
     */
    com.dev.backend.dto.response.customize.KetQuaQuetBarcodeDto quetBarcode(Integer pickListId, com.dev.backend.dto.request.QuetBarcodeRequest request);

    /**
     * API 5: Hoàn tất đợt nhặt hàng và tự động khởi tạo Phiếu xuất kho ở trạng thái chờ xuất (SRS 6.3.1 -> 6.3.2).
     * Phiếu nhặt của phiếu chuyển kho: không tạo phiếu xuất bán, chỉ ghi lô đã nhặt vào PX-CK (giữ hàng) để kho xuất bấm
     * Xác nhận xuất ở phiếu chuyển.
     */
    DanhSachNhatHangDto hoanTatNhatHang(Integer pickListId);

    /**
     * Các lô có thể phân bổ cho một dòng phiếu nhặt, sắp FIFO; số còn lại đã trừ phần phiếu nhặt / phiếu xuất khác giữ.
     */
    java.util.List<com.dev.backend.dto.response.customize.LoKhaDungNhatHangDto> getLoKhaDungChoDong(Integer pickListId, Integer chiTietId);

    /**
     * Lưu phân bổ lô (sửa tay) cho một dòng phiếu nhặt đang mở: tổng phải bằng số cần nhặt, mỗi lô không vượt phần
     * còn lại; chỉ người được giao nhặt hoặc quản lý kho / quản trị viên.
     */
    DanhSachNhatHangDto luuPhanBoLo(Integer pickListId, Integer chiTietId, com.dev.backend.dto.request.PhanBoLoNhatHangRequest request);

    /**
     * Xử lý ngoại lệ chuẩn đề xuất PM: Đơn bán hàng bị hủy trong đợt nhặt hàng
     * - Case 1: Nếu phiếu nhặt đang 'cho_nhat' hoặc 'dang_nhat': Tự động giảm trừ số lượng cần nhặt,
     *   bắn WebSocket thông báo tức thì đến màn hình Pick UI để picker không nhặt thừa hoặc chuyển hàng vào khay Put-back.
     * - Case 2: Nếu phiếu nhặt đã 'da_nhat' (đã có phiếu xuất nháp): Phiếu xuất chưa xuất (Nháp / Chờ xuất) của đơn được thu hồi về 4 (Đã hủy).
     */
    void xuLyDonBiHuyTrongPickList(com.dev.backend.entities.DonBanHang don);

    /**
     * Lấy danh sách nhiệm vụ cất hàng hoàn kệ (Put-away Task) phát sinh từ các đơn hủy trong đợt nhặt hoặc bàn đóng gói.
     */
    java.util.List<com.dev.backend.dto.response.customize.HangCanHoanKeDto> getDanhSachHangCanHoanKe(Integer khoId);

    /**
     * Xác nhận đã cất hàng hoàn kệ xong (hoàn tất Put-away Task).
     */
    void xacNhanHoanKe(Integer canhBaoId);
}

