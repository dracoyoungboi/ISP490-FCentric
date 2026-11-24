package com.dev.backend.services;

import com.dev.backend.dto.request.inbound.GiaoTraHangLoiRequest;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.dto.response.inbound.DanhSachTraHangNccDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuNhapKho;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface BienBanTraHangService {
    BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId);

    BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId);

    /**
     * Kho ghi người giao hàng đã ký biên bản giấy của lần lập cuối, rồi biên bản mới gửi email cho nhà cung cấp. Trả ngay
     * thì hàng lỗi rời kho theo người giao hàng.
     */
    BienBanTraHangDto ghiKy(Integer id);

    /** Biên bản đang chờ ghi người giao hàng đã ký (chưa gửi nhà cung cấp): phiếu chưa nhập kho được. */
    boolean choNguoiGiaoKy(BienBanTraHangNcc bienBan);

    /** Tab Trả hàng ở chi tiết nhà cung cấp, khối hàng lỗi ở chi tiết đơn mua; mọi bộ lọc có thể null. */
    DanhSachTraHangNccDto danhSach(Integer nhaCungCapId, Integer donMuaHangId, String trangThai, String tuKhoa);

    BienBanTraHangDto chiTiet(Integer id);

    /**
     * Nhà cung cấp trả lời trên Cổng nhà cung cấp ({@code nhaCungCapIds}: các nhà cung cấp của email phiên cổng), cho TỪNG
     * DÒNG sản phẩm lỗi: cách bù (DOI_HANG / TRU_CONG_NO) và hàng lỗi còn ở kho (NHAN_LAI / TIEU_HUY). {@code theoDong}:
     * lựa chọn của từng dòng (null là không đổi); dòng không có trong danh sách lấy {@code phuongAn} / {@code hangLoi}
     * chung (cách gửi cũ: một lựa chọn cho mọi dòng). Lần đầu phải chọn mọi việc còn mở của mọi dòng. Phiếu chưa nhập kho:
     * trừ tiền áp vào đơn lúc nhập kho; đã nhập kho: áp ngay. {@code phienBan}: lần lập nhà cung cấp đang xem (null chỉ với
     * biên bản cũ không có nhật ký lập); không khớp lần lập cuối thì 409. {@code camKet}: người xác nhận đã đánh dấu câu cam
     * kết trong hộp xác nhận (ghi vào nhật ký).
     */
    BienBanTraHangDto traLoiTuCong(Integer id, Collection<Integer> nhaCungCapIds, Integer phienBan,
                                   List<LuaChonDong> theoDong, String phuongAn, String hangLoi, String nguoiXacNhan,
                                   String ghiChu, boolean camKet);

    /** Cách gửi cũ: một lựa chọn cho mọi dòng. */
    default BienBanTraHangDto traLoiTuCong(Integer id, Collection<Integer> nhaCungCapIds, Integer phienBan, String phuongAn,
                                           String hangLoi, String nguoiXacNhan, String ghiChu) {
        return traLoiTuCong(id, nhaCungCapIds, phienBan, null, phuongAn, hangLoi, nguoiXacNhan, ghiChu, false);
    }

    /** Lựa chọn của một dòng biên bản ({@code dongId}: id dòng chi_tiet_tra_hang_ncc); null là không đổi. */
    record LuaChonDong(Integer dongId, String phuongAn, String hangLoi) {
    }

    /** Biên bản của các nhà cung cấp (Cổng nhà cung cấp, không có phạm vi kho), mới trước, không kèm dòng hàng lỗi. */
    List<BienBanTraHangDto> dsChoCong(Collection<Integer> nhaCungCapIds);

    /** Chi tiết biên bản cho Cổng nhà cung cấp: không thuộc các nhà cung cấp này thì 404 KHONG_TIM_THAY. */
    BienBanTraHangDto chiTietChoCong(Integer id, Collection<Integer> nhaCungCapIds);

    /**
     * Gửi lại email biên bản (đưa vào hàng đợi) khi biên bản còn chờ nhà cung cấp trả lời. Nhà cung cấp chưa có email, đã
     * trả lời, biên bản hủy, hoặc vừa gửi lại trong 60 giây: 409.
     */
    BienBanTraHangDto guiLaiEmail(Integer id);

    /** Phiếu nhập bị hủy: hủy biên bản còn hiệu lực của phiếu (báo mua hàng, email nhà cung cấp nếu đã gửi biên bản). */
    void huyTheoPhieuNhap(PhieuNhapKho phieu, Integer nguoiHuyId);

    /** Số hàng lỗi đã trừ tiền theo biến thể của đơn mua (đã nằm trong "đã nhận" của dòng đơn). */
    Map<Integer, Integer> truTienTheoBienThe(Integer donMuaHangId);

    /**
     * Kho ghi đã giao trả hàng lỗi cho nhà cung cấp: các dòng {@code request.dongIds} (thiếu: mọi dòng còn ở kho nhà cung
     * cấp chọn nhận lại); mỗi dòng phải còn ở kho và nhà cung cấp đã chọn nhận lại.
     */
    BienBanTraHangDto ghiDaGiaoTra(Integer id, GiaoTraHangLoiRequest request);

    /**
     * Quản lý kho ghi tiêu hủy hàng lỗi: các dòng {@code request.dongIds} (thiếu: mọi dòng còn ở kho nhà cung cấp đồng ý
     * tiêu hủy); mỗi dòng phải còn ở kho và nhà cung cấp đã đồng ý tiêu hủy trên cổng.
     */
    BienBanTraHangDto ghiTieuHuy(Integer id, GiaoTraHangLoiRequest request);

    /** Id các biên bản đã gửi email mà nhà cung cấp còn việc phải trả lời (việc định kỳ xét hạn). */
    List<Integer> dsChoNccTraLoi();

    /** Xét hạn trả lời của một biên bản: nhắc trước 2 ngày, quá hạn chưa chọn cách bù thì chuyển trừ tiền. */
    void xetHanTraLoi(Integer id, Instant now);

    /**
     * Biên bản còn khớp hàng không đạt đang lưu theo lô của phiếu (cùng lô, cùng lý do, cùng số lượng).
     * Lập biên bản rồi xóa / khóa lại lô lỗi thì không còn khớp: phải lập lại trước khi nhập kho.
     */
    boolean khopHangLoiHienTai(BienBanTraHangNcc bienBan);

    /**
     * Phiếu nhập vừa hoàn tất (đã COMPLETED): số lỗi đã khóa. Nhà cung cấp đã chọn trừ tiền thì áp vào đơn mua ngay;
     * chưa trả lời thì báo bộ phận mua hàng. Gọi trong giao dịch nhập kho, trước khi tính đơn đã nhận đủ chưa.
     */
    void khiNhapKho(BienBanTraHangNcc bienBan, PhieuNhapKho phieu, Integer nguoiNhapId);

    /**
     * Đơn mua đóng nhận thiếu: hàng lỗi chờ chọn / chờ giao bù chuyển sang trừ tiền (tối đa phần còn thiếu của dòng đơn).
     * Gọi trong giao dịch đóng đơn, sau khi đã khóa dòng đơn và đơn.
     */
    void chuyenTruTienKhiDongDon(DonMuaHang don, NguoiDung nguoiDong, String lyDo);

    /** Biên bản trả ngay cho người giao hàng còn hiệu lực của phiếu (phiếu không sửa kiểm đếm / không hủy được nữa), hoặc null. */
    BienBanTraHangNcc bienBanTraNgayCuaPhieu(Integer phieuNhapKhoId);
}
