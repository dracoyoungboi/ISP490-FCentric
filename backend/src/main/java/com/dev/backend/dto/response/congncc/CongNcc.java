package com.dev.backend.dto.response.congncc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Dữ liệu trả về của Cổng nhà cung cấp (API công khai /api/v1/cong-ncc). Viết tay từng trường: chỉ những gì nhà cung
 * cấp được xem mới đi ra (không ghi chú nội bộ, người tạo / duyệt, giá vốn, tồn kho, đơn của nhà cung cấp khác).
 */
public final class CongNcc {

    private CongNcc() {
    }

    // ── Đăng nhập ──

    public record NhaCungCap(String ten, String email) {
    }

    /** Xác nhận mã đúng: token phiên (header X-Phien-Cong-Ncc) sống tới {@code hetHanPhien}. */
    public record DangNhap(String phien, Instant hetHanPhien, NhaCungCap nhaCungCap, CuaHangCongDto cuaHang) {
    }

    public record NguoiPhuTrach(String hoTen, String soDienThoai, String email) {
    }

    // ── Cần xử lý ──

    /** Hàng lỗi đang ở đâu: O_KHO | DA_TRA | DA_TIEU_HUY, kèm câu ngắn (tên kho / người giao hàng, biển số). */
    public record HangLoiTomTat(String trangThai, String moTa) {
    }

    /**
     * hanTraLoi: hết hạn trả lời (null khi chưa gửi được email biên bản). nguoiPhuTrach: người tạo đơn mua của biên bản
     * (null khi đơn không có người tạo).
     */
    public record BienBanCho(Integer id, String soBienBan, String soDonMua, String soPhieuNhap, Instant ngayLap,
                             Instant hanTraLoi, int tongSoLuong, BigDecimal tongGiaTri, HangLoiTomTat hangLoi,
                             NguoiPhuTrach nguoiPhuTrach) {
    }

    /** nguoiPhuTrach: người tạo đơn (null khi đơn không có người tạo). */
    /** hanBaoGia: gửi được tới hết ngày này (giờ Việt Nam). */
    public record DonChoBaoGia(Integer id, String soDonMua, int soMatHang, BigDecimal tongSoLuong, Instant ngayCanGiao,
                               String tenKho, Instant ngayGuiYeuCau, NguoiPhuTrach nguoiPhuTrach,
                               java.time.LocalDate hanBaoGia) {
    }

    public record SoLieu30Ngay(int baoGiaDaGui, int duocChapNhan, int sanPhamLoi, BigDecimal tienTru) {
    }

    /**
     * nguoiPhuTrach: người tạo đơn gửi gần nhất — màn Cần xử lý mới ghi người phụ trách trên từng việc, trường này giữ
     * cho bản giao diện cũ.
     */
    public record ViecCanLam(NhaCungCap nhaCungCap, List<BienBanCho> bienBanCho, List<DonChoBaoGia> donChoBaoGia,
                             SoLieu30Ngay soLieu30Ngay, NguoiPhuTrach nguoiPhuTrach) {
    }

    // ── Biên bản ──

    public record HangLoi(String trangThai, String cachXuLy, String nguoiNhan, String bienSoXe, Instant thoiDiem) {
    }

    /**
     * Một dòng sản phẩm lỗi và lựa chọn của Quý công ty cho riêng dòng đó. id: gửi kèm khi trả lời. cachBu: CHO_CHOT |
     * DOI_HANG | TRU_CONG_NO; nguonCachBu như {@link LuaChon#nguon()} (thêm NHAP_KHO: trừ tiền không áp được lúc nhập kho,
     * phải chọn lại). hangLoi: NHAN_LAI | TIEU_HUY | null; viTriHang: O_KHO | DA_TRA | DA_TIEU_HUY. cachBuMo / hangLoiMo:
     * còn chọn hoặc đổi được (rỗng: đã chốt). buXong: dòng giao bù đã nhận đủ hàng bù. soLuongTru / tienTru: dòng trừ
     * tiền — số lỗi và số tiền trừ (một phần khi đơn chỉ còn chờ một phần, phần kia coi như đã giao bù).
     */
    public record DongLoi(Integer id, String tenSanPham, String mauSac, String kichCo, String sku, String maLo, String lyDo,
                          String ghiChu,
                          int soLuong, BigDecimal donGia, BigDecimal giaTri, String cachBu, String nguonCachBu,
                          List<String> cachBuMo, boolean buXong, String hangLoi, String viTriHang, List<String> hangLoiMo,
                          String nguoiNhanHang, Instant thoiDiemRoiKho, int soLuongTru, BigDecimal tienTru) {
    }

    /**
     * Một lựa chọn đang áp dụng. giaTri: DOI_HANG | TRU_CONG_NO (cách bù) hoặc NHAN_LAI | TIEU_HUY (hàng lỗi). nguon:
     * CONG_NCC (nhà cung cấp chọn) | DONG_DON (bên mua đóng đơn nhận thiếu) | TU_DONG (quá hạn trả lời) | DU_LIEU_CU.
     */
    public record LuaChon(String giaTri, String nguon, String nguoiXacNhan, Instant luc, String ghiChu) {
    }

    /**
     * trangThai: CHO_XAC_NHAN (còn việc phải trả lời) | DA_XAC_NHAN | DA_HUY. cachBuMo / hangLoiMo: lựa chọn còn chọn hoặc
     * đổi được (rỗng: việc đó đã chốt). hanTraLoi: hết hạn trả lời. phienBan: gửi kèm khi trả lời. tienTru: tiền đã trừ
     * (hoặc dự kiến khi chưa nhập kho); soLuongTruTien: số lỗi đã trừ tiền. buXong / conChoGiao: giao bù đã nhận đủ / số
     * còn chờ giao. cachBuDaChon / hangLoiDaChon: lựa chọn đang áp dụng (null: chưa chọn).
     */
    public record BienBan(Integer id, String soBienBan, String soDonMua, String soPhieuNhap, String tenKho, String diaChiKho,
                          Instant ngayLap, boolean phieuDaNhap, String trangThai, String phuongAn, List<String> cachBuMo,
                          List<String> hangLoiMo, Instant hanTraLoi, Integer phienBan, HangLoi hangLoi,
                          List<DongLoi> dong, int tongSoLuong, BigDecimal tongGiaTri, BigDecimal tienTru,
                          int soLuongTruTien, boolean buXong, int conChoGiao, LuaChon cachBuDaChon,
                          LuaChon hangLoiDaChon, NguoiPhuTrach nguoiPhuTrach, String nguoiLienHeNcc) {
    }

    // ── Lịch sử ──

    /** ketQua: CHO_BAO_GIA | CHO_KET_QUA | DUOC_CHAP_NHAN | KHONG_CHAP_NHAN | HET_HAN | DA_HUY. */
    public record DongBaoGia(Integer id, String soDonMua, Instant ngayYeuCau, Instant ngayBaoGia, int soMatHang,
                             BigDecimal tongTien, String ketQua, java.time.LocalDate hanBaoGia) {
    }

    public record TomTatBaoGia(int daBaoGia, int duocChapNhan, int khongChapNhan, int choBaoGia) {
    }

    public record LichSuBaoGia(List<DongBaoGia> items, TomTatBaoGia tomTat) {
    }

    /** hangLoi: O_KHO | DA_TRA | DA_TIEU_HUY; hangLoiNcc: nhà cung cấp chọn NHAN_LAI | TIEU_HUY | null. */
    public record DongTraHang(Integer id, String soBienBan, Instant ngayLap, String soDonMua, int soLuongLoi,
                              String phuongAn, BigDecimal tienTru, boolean buXong, int conChoGiao, String hangLoi,
                              String hangLoiNcc, boolean choTraLoi, boolean daHuy) {
    }

    public record TomTatTraHang(int bienBan, int sanPhamLoi, BigDecimal tienTru, int choChon) {
    }

    public record LichSuTraHang(List<DongTraHang> items, TomTatTraHang tomTat) {
    }
}
