package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Biên bản trả hàng nhà cung cấp. Chỉ dùng các cột sẵn có của bảng (BA chốt 23/11/2026: không thêm cột); chi tiết từng
 * việc (lập, gửi email, nhà cung cấp trả lời, giao trả, tiêu hủy) nằm ở lich_su_thay_doi — xem NhatKyTraHangNcc.
 * <ul>
 *   <li>{@code trangThai}: hàng lỗi đang ở đâu — CHO_TRA_HANG (còn dòng ở kho chờ trả), DA_TRA_HANG, DA_TIEU_HUY,
 *   DA_XU_LY (mọi dòng đã rời kho, có dòng trả có dòng tiêu hủy) — hoặc DA_HUY.</li>
 *   <li>{@code phuongAnXuLy}: nhà cung cấp bù gì — CHO_CHOT (còn dòng chưa chọn), DOI_HANG (giao bù), TRU_CONG_NO
 *   (trừ tiền), HON_HOP (dòng giao bù, dòng trừ tiền).</li>
 * </ul>
 * Nhà cung cấp quyết cả hai việc cho TỪNG DÒNG sản phẩm lỗi trên Cổng nhà cung cấp, kho chỉ làm theo. Lựa chọn của từng
 * dòng nằm ở nhật ký; hai cột trên là tổng của các dòng, ghi lại sau mỗi việc.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "bien_ban_tra_hang_ncc")
public class BienBanTraHangNcc {

    // ── trang_thai: hàng lỗi đi đâu ──
    /** Hàng lỗi đang ở khu chờ trả của kho. */
    public static final String CHO_TRA_HANG = "CHO_TRA_HANG";
    /** Hàng lỗi đã rời kho về nhà cung cấp (trả ngay cho người giao hàng, nhà cung cấp đến lấy, gửi vận chuyển). */
    public static final String DA_TRA_HANG = "DA_TRA_HANG";
    /** Nhà cung cấp không lấy lại, kho đã tiêu hủy. */
    public static final String DA_TIEU_HUY = "DA_TIEU_HUY";
    /** Mọi dòng hàng lỗi đã rời kho, dòng giao trả dòng tiêu hủy (nhà cung cấp chọn khác nhau theo dòng). */
    public static final String DA_XU_LY = "DA_XU_LY";
    /**
     * Biên bản bị hủy (phiếu nhập bị hủy, hoặc phiếu hết hàng lỗi). Không xóa dòng: số biên bản đã cấp (có thể đã in,
     * đã giao người giao hàng / nhà cung cấp) không bao giờ được cấp lại cho biên bản khác.
     */
    public static final String DA_HUY = "DA_HUY";

    // ── phuong_an_xu_ly: nhà cung cấp bù gì ──
    public static final String PA_CHO_CHOT = "CHO_CHOT";
    /** Nhà cung cấp giao lại hàng đạt: dòng đơn mua vẫn chờ nhận số lỗi. */
    public static final String PA_DOI_HANG = "DOI_HANG";
    /** Không giao lại: số lỗi cộng vào "đã nhận" của dòng đơn mua (đơn không chờ nữa), tiền hàng giảm theo. */
    public static final String PA_TRU_CONG_NO = "TRU_CONG_NO";
    /** Mọi dòng đã có cách bù, có dòng giao bù có dòng trừ tiền. */
    public static final String PA_HON_HOP = "HON_HOP";
    /** Mã của biên bản lập trước 22/11/2026: giao bù. */
    static final String PA_CU_DOI_HANG_MOI = "DOI_HANG_MOI";
    /** Mã của biên bản lập trước 22/11/2026: hàng lỗi theo tài xế về, đơn đã trừ số lỗi. */
    public static final String PA_CU_TRA_TAI_XE = "TRA_TAI_XE";

    // ── Cách xử lý hàng lỗi kho chọn lúc lập (lưu trong nhật ký lập biên bản) ──
    /** Để hàng lỗi ở khu chờ trả, nhà cung cấp đến lấy hoặc kho gửi trả sau. */
    public static final String GIU_KHO = "GIU_KHO";
    /** Người của nhà cung cấp mang hàng lỗi về ngay lúc giao, hàng không vào kho (bên vận chuyển không nhận thay). */
    public static final String TRA_NGAY = "TRA_NGAY";

    /** Ai ký biên bản bên giao hàng lúc kiểm (lưu ở nhật ký lập, không phải cột). */
    public static final String BEN_KY_NCC = "DAI_DIEN_NCC";
    /** Tài xế nhà xe, bưu tá: chỉ xác nhận số lỗi lúc giao, không đại diện nhà cung cấp. */
    public static final String BEN_KY_VAN_CHUYEN = "VAN_CHUYEN";

    // ── Nhà cung cấp quyết hàng lỗi còn ở kho (lưu trong nhật ký lần trả lời) ──
    /** Nhà cung cấp lấy lại hàng lỗi: kho giao trả (nhà cung cấp đến lấy hoặc gửi vận chuyển). */
    public static final String HL_NHAN_LAI = "NHAN_LAI";
    /** Nhà cung cấp không lấy lại, đồng ý để kho tiêu hủy. */
    public static final String HL_TIEU_HUY = "TIEU_HUY";

    // ── Mã hàng lỗi trả về giao diện (tính từ trang_thai) ──
    public static final String HANG_O_KHO = "O_KHO";
    public static final String HANG_DA_TRA = "DA_TRA";
    public static final String HANG_DA_TIEU_HUY = "DA_TIEU_HUY";
    /** Mọi dòng đã rời kho, dòng trả dòng tiêu hủy. */
    public static final String HANG_DA_XU_LY = "DA_XU_LY";

    public static final String GIAO_TAI_XE = "TAI_XE";
    public static final String GIAO_NCC_LAY = "NCC_LAY";
    public static final String GIAO_VAN_CHUYEN = "VAN_CHUYEN";

    private static final Set<String> TRANG_THAI_HANG_DA_ROI_KHO = Set.of(DA_TRA_HANG, DA_TIEU_HUY, DA_XU_LY);

    /** Biên bản còn hiệu lực (chưa hủy). */
    public boolean dangHieuLuc() {
        return !DA_HUY.equals(trangThai);
    }

    /** Còn ít nhất một dòng hàng lỗi ở kho chờ trả (biên bản còn hiệu lực). */
    public boolean hangConOKho() {
        return dangHieuLuc() && !TRANG_THAI_HANG_DA_ROI_KHO.contains(trangThai) && !PA_CU_TRA_TAI_XE.equals(phuongAnXuLy);
    }

    /** O_KHO (còn dòng ở kho) | DA_TRA | DA_TIEU_HUY | DA_XU_LY (biên bản cũ trả tài xế: đã trả). Biên bản đã hủy: null. */
    public String maHangLoi() {
        if (!dangHieuLuc()) return null;
        if (DA_TIEU_HUY.equals(trangThai)) return HANG_DA_TIEU_HUY;
        if (DA_XU_LY.equals(trangThai)) return HANG_DA_XU_LY;
        if (DA_TRA_HANG.equals(trangThai) || PA_CU_TRA_TAI_XE.equals(phuongAnXuLy)) return HANG_DA_TRA;
        return HANG_O_KHO;
    }

    /** Phương án theo mã hiện hành: mã cũ DOI_HANG_MOI = giao bù, TRA_TAI_XE = trừ tiền, trống = chờ chốt. */
    public String phuongAn() {
        if (phuongAnXuLy == null || phuongAnXuLy.isBlank()) return PA_CHO_CHOT;
        if (PA_CU_DOI_HANG_MOI.equals(phuongAnXuLy)) return PA_DOI_HANG;
        if (PA_CU_TRA_TAI_XE.equals(phuongAnXuLy)) return PA_TRU_CONG_NO;
        return phuongAnXuLy;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_bien_ban", nullable = false, length = 50, unique = true)
    String maBienBan;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phieu_nhap_kho_id", nullable = false)
    PhieuNhapKho phieuNhapKho;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nha_cung_cap_id", nullable = false)
    NhaCungCap nhaCungCap;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nguoi_tao_id", nullable = false)
    NguoiDung nguoiTao;

    @ColumnDefault("0")
    @Column(name = "tong_so_luong_loi", nullable = false)
    @Builder.Default
    Integer tongSoLuongLoi = 0;

    /** CHO_CHOT | DOI_HANG | TRU_CONG_NO | HON_HOP (đọc qua {@link #phuongAn()} để quy đổi mã cũ). */
    @Size(max = 50)
    @Column(name = "phuong_an_xu_ly", length = 50)
    @Builder.Default
    String phuongAnXuLy = PA_CHO_CHOT;

    /** CHO_TRA_HANG | DA_TRA_HANG | DA_TIEU_HUY | DA_XU_LY | DA_HUY. */
    @Size(max = 50)
    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    String trangThai = CHO_TRA_HANG;

    /** Ghi chú kho gửi nhà cung cấp lúc lập biên bản. */
    @Lob
    @Column(name = "ghi_chu")
    String ghiChu;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @OneToMany(mappedBy = "bienBanTraHangNcc", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    List<ChiTietTraHangNcc> chiTiets;
}
