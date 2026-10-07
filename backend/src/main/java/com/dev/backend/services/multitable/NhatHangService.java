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
    Page<DanhSachNhatHangDto> getDanhSachPickList(Integer khoId, String trangThai, String searchText, Pageable pageable);

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
     * API 5: Hoàn tất đợt nhặt hàng và tự động khởi tạo Phiếu xuất kho ở trạng thái chờ xuất (SRS 6.3.1 -> 6.3.2)
     */
    DanhSachNhatHangDto hoanTatNhatHang(Integer pickListId);
}

