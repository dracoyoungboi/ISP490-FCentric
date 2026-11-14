package com.dev.backend.dto.response.entities;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LichSuGiaoDichKhoDto {
    private Integer id;
    private Instant ngayGiaoDich;
    private String loaiGiaoDich;
    private String loaiThamChieu;
    private Integer idThamChieu;
    private String tenSanPham;
    private String maSku;
    private String maLo;
    private Integer khoId;
    private String tenKho;
    private Integer khoChuyenDenId;
    private String tenKhoChuyenDen;
    private BigDecimal soLuong;
    private BigDecimal soLuongTruoc;
    private BigDecimal soLuongSau;
    private String nguoiDungTen;
    private String ghiChu;

    // Chỉ dòng chuyển kệ nội bộ (chuyen_ke_noi_bo): tách từ câu sổ "MV-…: kệ nguồn → kệ đích" do hệ thống tự ghi
    /** Mã phiếu chuyển kệ (MV-YYYYMMDD-XXXX). */
    private String maChungTu;
    private KeGiaoDich keNguon;
    private KeGiaoDich keDich;

    // ── Chỉ có ở chi tiết (getChiTiet): chứng từ và thông tin đi kèm, tra từ phiếu gốc và câu sổ hệ thống tự ghi ──
    /** Chứng từ của dòng sổ: phiếu nhập / xuất / điều chỉnh / chuyển kệ. Phiếu đã mất thì chỉ còn mã (id null). */
    private ChungTuGiaoDich chungTu;
    /**
     * Việc làm ra dòng sổ: nhap_ncc · nhap_tra_ve · khach_tra_tai_quay · nhan_chuyen_kho · nhan_chuyen_kho_chenh_lech ·
     * hoan_tra_chuyen_kho · roi_trung_chuyen · hang_di_duong · xuat_chuyen_kho · ban_tai_quay · xuat_don_ban · kiem_ke ·
     * chenh_lech_chuyen_kho. Null khi không xác định được (dữ liệu cũ).
     */
    private String nghiepVu;
    /** Phiếu chuyển kho mà chứng từ thuộc về (PX-CK, PN-TRF, PN-RET, phiếu điều chỉnh chênh lệch). */
    private ChungTuGiaoDich phieuChuyenKho;
    /** Đợt kiểm kê sinh ra phiếu điều chỉnh. */
    private ChungTuGiaoDich dotKiemKe;
    /** Đơn bán của phiếu xuất, hoặc đơn gốc của hàng khách trả tại quầy. */
    private ChungTuGiaoDich donBanHang;
    /** Mã phiếu trả hàng tại quầy (chỉ có trong câu sổ). */
    private String phieuTraHang;
    private String maVanDon;
    /** Kệ của dòng nhập từ nhà cung cấp / dòng kiểm kê (mã ghi trong sổ, kèm vị trí nếu kệ còn). */
    private KeGiaoDich ke;
    /** Dòng nhập ghi "Chưa gắn kệ": hàng vào phần chưa có kệ. */
    private Boolean chuaCoKe;
    /** Câu ghi chú do hệ thống tự ghi và mọi thông tin trong đó đã có ở các trường trên: giao diện không cần hiện lại. */
    private Boolean ghiChuDaTach;

    /** Một chứng từ liên quan. {@code khoNhanId}: kho bên nhận của phiếu chuyển / PX chuyển kho (xem được từ cả hai kho). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChungTuGiaoDich {
        /** phieu_nhap · phieu_xuat · phieu_dieu_chinh · phieu_chuyen_ke · phieu_chuyen_kho · dot_kiem_ke · don_ban */
        private String loai;
        private Integer id;
        private String ma;
        private Integer khoId;
        private Integer khoNhanId;
    }

    /** Kệ của một dòng chuyển kệ. Danh sách chỉ có mã; chi tiết thêm khu, dãy, hàng, tầng (tra theo mã kệ trong kho). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeGiaoDich {
        private String ma;
        private String khuVuc;
        private String dayKe;
        private String hangKe;
        private String tangKe;

        public static KeGiaoDich chiMa(String ma) {
            return new KeGiaoDich(ma, null, null, null, null);
        }
    }
}