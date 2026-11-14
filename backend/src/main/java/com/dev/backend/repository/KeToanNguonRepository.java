package com.dev.backend.repository;

import com.dev.backend.services.impl.ketoan.NguonKeToan;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Đọc dữ liệu nguồn cho xuất kế toán bằng SQL thuần (đọc nhiều bảng, chỉ đọc). Chứng từ "chưa xuất" = không có dòng
 * chung_tu_xuat_ke_toan còn hiệu lực; nối qua cột sinh khoa_hieu_luc (UNIQUE, có index) nên không quét bảng.
 *
 * <p>Dòng phiếu xuất / phiếu nhập chỉ lấy dòng có lô (lo_hang_id): phiếu đi qua nhặt hàng và phiếu nhập từ đơn mua có
 * thêm dòng gốc không lô, cộng cả hai là nhân đôi số lượng (lỗi giá vốn của báo cáo doanh thu trước 25/10/2026).</p>
 *
 * <p>Thời điểm truyền vào và đọc ra là Instant; quy ra ngày Việt Nam ở tầng service (không phụ thuộc múi giờ phiên).</p>
 */
@Repository
public class KeToanNguonRepository {

    private static final int CO_LO_IN = 1000;
    /** Tên hàng = tên sản phẩm - màu - size - chất liệu (bỏ phần trống). */
    private static final String TEN_HANG = "CONCAT_WS(' - ', sp.ten_san_pham, ms.ten_mau, sz.ten_size, cl.ten_chat_lieu)";
    private static final String NOI_HANG = """
            JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id
            JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
            LEFT JOIN mau_sac ms ON ms.id = bt.mau_sac_id
            LEFT JOIN size sz ON sz.id = bt.size_id
            LEFT JOIN chat_lieu cl ON cl.id = bt.chat_lieu_id
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public KeToanNguonRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ── Bán hàng ───────────────────────────────────────────────────────────

    /** Cột của đơn bán (dùng chung cho đơn chưa xuất và đơn hoàn trả); đi kèm {@link #NOI_DON_BAN}. */
    private static final String COT_DON_BAN = """
            SELECT d.id, d.so_don_hang, d.ngay_giao_hang, d.tien_hang, d.phi_van_chuyen, d.tong_cong, d.thue_suat_gtgt,
                   d.ma_don_hang_kenh, kb.ma_kenh, kb.ten_kenh,
                   kh.ma_khach_hang, kh.ten_khach_hang, kh.dia_chi, kh.ma_so_thue,
                   -- Đơn bán tại quầy (có pos_payment, luôn thu đủ tổng cộng): tiền mặt -> CASH (111), QR payOS
                   -- -> PAYOS (112), tiền mặt trả trước + QR -> KET_HOP (tạm 131, kèm cảnh báo cách tách).
                   -- Đơn khác -> NULL (131): tiền thu đơn thường (thanh_toan_don_ban) kế toán lập phiếu thu riêng.
                   (SELECT CASE WHEN p.phuong_thuc = 'CASH' THEN 'CASH'
                                WHEN COALESCE(p.tien_mat_truoc, 0) > 0 THEN 'KET_HOP'
                                ELSE 'PAYOS' END
                      FROM pos_payment p WHERE p.don_ban_hang_id = d.id
                     ORDER BY p.id DESC LIMIT 1) AS phuong_thuc_pos,
                   -- so_tien_hang (= tổng cộng), không lấy so_tien_thu: tiền mặt khách đưa gồm cả tiền thối
                   (SELECT CASE WHEN p.phuong_thuc = 'PAYOS' THEN COALESCE(p.tien_mat_truoc, 0) ELSE p.so_tien_hang END
                      FROM pos_payment p WHERE p.don_ban_hang_id = d.id
                     ORDER BY p.id DESC LIMIT 1) AS tien_mat_da_thu,
                   (SELECT CASE WHEN p.phuong_thuc = 'PAYOS' THEN p.so_tien_hang - COALESCE(p.tien_mat_truoc, 0) ELSE 0 END
                      FROM pos_payment p WHERE p.don_ban_hang_id = d.id
                     ORDER BY p.id DESC LIMIT 1) AS ngan_hang_da_thu,
                   COALESCE(
                     (SELECT k.ma_kho FROM phieu_xuat_kho p JOIN kho k ON k.id = p.kho_id
                       WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3
                       ORDER BY p.ngay_xuat DESC, p.id DESC LIMIT 1),
                     kx.ma_kho) AS ma_kho,
                   (SELECT GROUP_CONCAT(p.so_phieu_xuat ORDER BY p.ngay_xuat, p.id SEPARATOR ', ')
                      FROM phieu_xuat_kho p
                     WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3) AS so_phieu_xuat
            """;
    private static final String NOI_DON_BAN = """
              FROM don_ban_hang d
              JOIN khach_hang kh ON kh.id = d.khach_hang_id
              LEFT JOIN kho kx ON kx.id = d.kho_xuat_id
              LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            """;
    /** Nhật ký "chuyển đơn sang Bị hoàn trả" (DonBanHangService.returnOrder, từ 14/11/2026). */
    private static final String NHAT_KY_HOAN_TRA = """
            SELECT id_tham_chieu, MIN(ngay_thuc_hien) AS ngay_hoan
              FROM lich_su_thay_doi
             WHERE loai_tham_chieu = 'don_ban_hang' AND hanh_dong = 'hoan_tra_don_ban'
             GROUP BY id_tham_chieu
            """;

    /** Đơn bán trạng thái 3, 5 (không lấy báo giá), giao đủ trong [tu, den), chưa xuất kế toán. */
    public List<NguonKeToan.DonBan> donBanChuaXuat(Instant tu, Instant den) {
        String sql = COT_DON_BAN + NOI_DON_BAN + """
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('ban_hang:', d.id)
                 WHERE d.loai_chung_tu = 'don_ban_hang'
                   AND d.trang_thai IN (3, 5)
                   AND d.ngay_giao_hang >= :tu AND d.ngay_giao_hang < :den
                   AND c.id IS NULL
                 ORDER BY d.ngay_giao_hang, d.id
                """;
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> donBan(rs));
    }

    /**
     * Đơn đã giao kế toán (chứng từ bán đang khóa) rồi bị hoàn trả (trạng thái 6), có nhật ký hoàn trả trong [tu, den),
     * chưa có chứng từ trả lại. Đơn hoàn trả trước 14/11/2026 không có nhật ký: vẫn ở danh sách "Phát sinh sau khi xuất".
     */
    public List<NguonKeToan.DonHoan> donHoanChuaXuat(Instant tu, Instant den) {
        String sql = COT_DON_BAN + ", h.ngay_hoan, cb.ma_khach AS ma_khach_ban" + NOI_DON_BAN + """
                  JOIN (%s) h ON h.id_tham_chieu = d.id
                  JOIN chung_tu_xuat_ke_toan cb ON cb.khoa_hieu_luc = CONCAT('ban_hang:', d.id)
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('tra_lai_don:', d.id)
                 WHERE d.trang_thai = 6
                   AND h.ngay_hoan >= :tu AND h.ngay_hoan < :den
                   AND c.id IS NULL
                 ORDER BY h.ngay_hoan, d.id
                """.formatted(NHAT_KY_HOAN_TRA);
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> new NguonKeToan.DonHoan(donBan(rs), instant(rs, "ngay_hoan"),
                rs.getString("ma_khach_ban")));
    }

    private static NguonKeToan.DonBan donBan(ResultSet rs) throws SQLException {
        return new NguonKeToan.DonBan(
                rs.getInt("id"),
                rs.getString("so_don_hang"),
                instant(rs, "ngay_giao_hang"),
                rs.getString("ma_khach_hang"),
                rs.getString("ten_khach_hang"),
                rs.getString("dia_chi"),
                rs.getString("ma_so_thue"),
                rs.getString("ma_kho"),
                so(rs, "tien_hang"),
                so(rs, "phi_van_chuyen"),
                so(rs, "tong_cong"),
                rs.getString("phuong_thuc_pos"),
                // Chỉ đơn Shopify có giảm giá dòng (tien_giam_gia) / mã giảm phí ship; Lazada, TikTok lưu giá khác cách
                "SHOPIFY".equals(rs.getString("ma_kenh"))
                        && rs.getString("ma_don_hang_kenh") != null && !rs.getString("ma_don_hang_kenh").isBlank(),
                rs.getString("ma_don_hang_kenh"),
                rs.getString("ten_kenh"),
                rs.getString("so_phieu_xuat"),
                so(rs, "tien_mat_da_thu"),
                so(rs, "ngan_hang_da_thu"),
                rs.getBigDecimal("thue_suat_gtgt"),
                rs.getString("ma_kenh"));
    }

    public List<NguonKeToan.DongBan> dongDonBan(Collection<Integer> donIds) {
        String sql = """
                SELECT ct.don_ban_hang_id, bt.ma_sku, %s AS ten_hang, sp.don_vi_tinh, sp.danh_muc_id,
                       ct.so_luong_dat, ct.don_gia, ct.thanh_tien, ct.tien_giam_gia
                  FROM chi_tiet_don_ban_hang ct
                %s
                 WHERE ct.don_ban_hang_id IN (:ids)
                 ORDER BY ct.don_ban_hang_id, ct.id
                """.formatted(TEN_HANG, NOI_HANG);
        return theoLo(donIds, ids -> jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, i) -> new NguonKeToan.DongBan(
                rs.getInt("don_ban_hang_id"),
                rs.getString("ma_sku"),
                rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"),
                soNguyen(rs, "danh_muc_id"),
                so(rs, "so_luong_dat"),
                so(rs, "don_gia"),
                so(rs, "thanh_tien"),
                so(rs, "tien_giam_gia"))));
    }

    // ── Trả hàng tại quầy ──────────────────────────────────────────────────

    /**
     * Phiếu trả hàng tại quầy lập trong [tu, den), chưa xuất kế toán. donDaGiao: chứng từ bán của đơn gốc đang khóa trong
     * một lô; laPos: đơn gốc bán tại quầy (có pos_payment hoặc kênh POS) — gom về khách lẻ như chứng từ bán.
     */
    public List<NguonKeToan.PhieuTraQuay> phieuTraQuayChuaXuat(Instant tu, Instant den) {
        String sql = """
                SELECT p.id, p.so_phieu, p.ngay_tao, p.tong_tien_hoan, p.phuong_thuc_hoan,
                       d.id AS don_id, d.so_don_hang, d.ngay_giao_hang, cb.id IS NOT NULL AS don_da_giao, cb.ma_khach AS ma_khach_ban,
                       kh.ma_khach_hang, kh.ten_khach_hang, kh.dia_chi, kh.ma_so_thue, kb.ma_kenh,
                       (kb.ma_kenh = 'POS' OR EXISTS (SELECT 1 FROM pos_payment pp WHERE pp.don_ban_hang_id = d.id)) AS la_pos,
                       kn.ma_kho AS ma_kho_nhan, pn.so_phieu_nhap
                  FROM phieu_tra_hang p
                  JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
                  JOIN khach_hang kh ON kh.id = d.khach_hang_id
                  LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                  JOIN kho kn ON kn.id = p.kho_nhan_id
                  LEFT JOIN phieu_nhap_kho pn ON pn.id = p.phieu_nhap_kho_id
                  LEFT JOIN chung_tu_xuat_ke_toan cb ON cb.khoa_hieu_luc = CONCAT('ban_hang:', d.id)
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('tra_lai_quay:', p.id)
                 WHERE p.ngay_tao >= :tu AND p.ngay_tao < :den
                   AND c.id IS NULL
                 ORDER BY p.ngay_tao, p.id
                """;
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> new NguonKeToan.PhieuTraQuay(
                rs.getInt("id"),
                rs.getString("so_phieu"),
                instant(rs, "ngay_tao"),
                rs.getInt("don_id"),
                rs.getString("so_don_hang"),
                instant(rs, "ngay_giao_hang"),
                rs.getBoolean("don_da_giao"),
                rs.getString("ma_khach_hang"),
                rs.getString("ten_khach_hang"),
                rs.getString("dia_chi"),
                rs.getString("ma_so_thue"),
                rs.getString("ma_kenh"),
                rs.getBoolean("la_pos"),
                rs.getString("ma_kho_nhan"),
                rs.getString("so_phieu_nhap"),
                so(rs, "tong_tien_hoan"),
                rs.getString("phuong_thuc_hoan"),
                rs.getString("ma_khach_ban")));
    }

    public List<NguonKeToan.DongTraQuay> dongTraQuay(Collection<Integer> phieuIds) {
        String sql = """
                SELECT ct.phieu_tra_hang_id, bt.ma_sku, %s AS ten_hang, sp.don_vi_tinh, sp.danh_muc_id,
                       ct.so_luong, ct.thanh_tien_hoan, ct.tinh_trang
                  FROM chi_tiet_phieu_tra_hang ct
                %s
                 WHERE ct.phieu_tra_hang_id IN (:ids)
                 ORDER BY ct.phieu_tra_hang_id, ct.id
                """.formatted(TEN_HANG, NOI_HANG);
        return theoLo(phieuIds, ids -> jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, i) -> new NguonKeToan.DongTraQuay(
                rs.getInt("phieu_tra_hang_id"),
                rs.getString("ma_sku"),
                rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"),
                soNguyen(rs, "danh_muc_id"),
                so(rs, "so_luong"),
                so(rs, "thanh_tien_hoan"),
                rs.getString("tinh_trang"))));
    }

    // ── Mua hàng ───────────────────────────────────────────────────────────

    /**
     * Phiếu nhập từ đơn mua đã hoàn tất trong [tu, den), chưa xuất kế toán, kèm hóa đơn nhà cung cấp nếu đã nhập. Bỏ
     * phiếu không có dòng nào vào kho (cả phiếu không đạt kiểm tra, trả lại nhà cung cấp): không phải mua hàng.
     */
    public List<NguonKeToan.PhieuMua> phieuMuaChuaXuat(Instant tu, Instant den) {
        String sql = """
                SELECT pn.id, pn.so_phieu_nhap, pn.ngay_nhap, dm.so_don_mua, k.ma_kho,
                       ncc.ma_nha_cung_cap, ncc.ten_nha_cung_cap, ncc.dia_chi, ncc.ma_so_thue,
                       hd.co_hoa_don, hd.mau_so, hd.ky_hieu, hd.so_hoa_don, hd.ngay_hoa_don, hd.thue_suat
                  FROM phieu_nhap_kho pn
                  JOIN don_mua_hang dm ON dm.id = pn.don_mua_hang_id
                  JOIN kho k ON k.id = pn.kho_id
                  LEFT JOIN nha_cung_cap ncc ON ncc.id = COALESCE(pn.nha_cung_cap_id, dm.nha_cung_cap_id)
                  LEFT JOIN hoa_don_dau_vao hd ON hd.phieu_nhap_kho_id = pn.id
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('mua_hang:', pn.id)
                 WHERE pn.trang_thai = 3
                   AND pn.ngay_nhap >= :tu AND pn.ngay_nhap < :den
                   AND c.id IS NULL
                   AND EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap_kho ct
                                WHERE ct.phieu_nhap_kho_id = pn.id AND ct.lo_hang_id IS NOT NULL AND ct.so_luong_nhap > 0)
                 ORDER BY pn.ngay_nhap, pn.id
                """;
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> {
            Object coHd = rs.getObject("co_hoa_don");
            java.sql.Date ngayHd = rs.getDate("ngay_hoa_don");
            return new NguonKeToan.PhieuMua(
                    rs.getInt("id"),
                    rs.getString("so_phieu_nhap"),
                    instant(rs, "ngay_nhap"),
                    rs.getString("so_don_mua"),
                    rs.getString("ma_nha_cung_cap"),
                    rs.getString("ten_nha_cung_cap"),
                    rs.getString("dia_chi"),
                    rs.getString("ma_so_thue"),
                    rs.getString("ma_kho"),
                    coHd == null ? null : rs.getBoolean("co_hoa_don"),
                    rs.getString("mau_so"),
                    rs.getString("ky_hieu"),
                    rs.getString("so_hoa_don"),
                    ngayHd == null ? null : ngayHd.toLocalDate(),
                    rs.getBigDecimal("thue_suat"));
        });
    }

    public List<NguonKeToan.DongMua> dongPhieuMua(Collection<Integer> phieuIds) {
        String sql = """
                SELECT ct.phieu_nhap_kho_id, MAX(bt.ma_sku) AS ma_sku, MAX(%s) AS ten_hang, MAX(sp.don_vi_tinh) AS don_vi_tinh,
                       MAX(sp.danh_muc_id) AS danh_muc_id, SUM(ct.so_luong_nhap) AS so_luong, ct.don_gia
                  FROM chi_tiet_phieu_nhap_kho ct
                %s
                 WHERE ct.phieu_nhap_kho_id IN (:ids) AND ct.lo_hang_id IS NOT NULL AND ct.so_luong_nhap > 0
                 GROUP BY ct.phieu_nhap_kho_id, ct.bien_the_san_pham_id, ct.don_gia
                 ORDER BY ct.phieu_nhap_kho_id, MIN(ct.id)
                """.formatted(TEN_HANG, NOI_HANG);
        return theoLo(phieuIds, ids -> jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, i) -> new NguonKeToan.DongMua(
                rs.getInt("phieu_nhap_kho_id"),
                rs.getString("ma_sku"),
                rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"),
                soNguyen(rs, "danh_muc_id"),
                so(rs, "so_luong"),
                so(rs, "don_gia"))));
    }

    // ── Chuyển kho ─────────────────────────────────────────────────────────

    /**
     * Bước xuất: phiếu xuất chuyển kho (PX-CK, loai_xuat chuyen_kho) đã xuất (trạng thái 3) trong [tu, den), chưa xuất
     * kế toán. Phiếu chuyển ở bảng phieu_chuyen_kho (từ 28/10/2026); "lệnh" = lệnh điều động lúc duyệt, phiếu cũ không có
     * lệnh thì lấy số phiếu chuyển. parent_id chỉ còn ở phiếu con cũ chưa chạy tệp dọn (phiếu cha PX-TRF cũ).
     */
    public List<NguonKeToan.PhieuChuyen> chuyenKhoXuatChuaXuat(Instant tu, Instant den) {
        String sql = """
                SELECT px.id, px.so_phieu_xuat, px.ngay_xuat,
                       COALESCE(pck.so_lenh_dieu_dong, pck.so_phieu_chuyen, cha.so_phieu_xuat) AS so_lenh,
                       COALESCE(pck.ngay_lenh_dieu_dong, pck.ngay_tao, cha.ngay_tao) AS ngay_lenh,
                       kx.ma_kho AS ma_kho_xuat, kx.ten_kho AS ten_kho_xuat, kn.ma_kho AS ma_kho_dich, kn.ten_kho AS ten_kho_dich
                  FROM phieu_xuat_kho px
                  LEFT JOIN phieu_chuyen_kho pck ON pck.id = px.phieu_chuyen_kho_id
                  LEFT JOIN phieu_xuat_kho cha ON cha.id = px.parent_id
                  JOIN kho kx ON kx.id = px.kho_id
                  LEFT JOIN kho kn ON kn.id = COALESCE(pck.kho_nhap_id, px.kho_chuyen_den_id, cha.kho_chuyen_den_id)
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('chuyen_kho_xuat:', px.id)
                 WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3
                   AND px.ngay_xuat >= :tu AND px.ngay_xuat < :den
                   AND c.id IS NULL
                 ORDER BY px.ngay_xuat, px.id
                """;
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> new NguonKeToan.PhieuChuyen(
                "chuyen_kho_xuat",
                rs.getInt("id"),
                rs.getString("so_phieu_xuat"),
                instant(rs, "ngay_xuat"),
                rs.getString("so_lenh"),
                instant(rs, "ngay_lenh"),
                rs.getString("ma_kho_xuat"),
                rs.getString("ten_kho_xuat"),
                rs.getString("ma_kho_dich"),
                rs.getString("ten_kho_dich"),
                false));
    }

    /**
     * Bước nhận: phiếu nhập của phiếu chuyển (phieu_chuyen_kho_id) đã hoàn tất trong [tu, den), chưa xuất kế toán.
     * PN-TRF nhập kho nhận; PN-RET nhập lại kho xuất khi hủy phiếu chuyển giữa đường. Nhận biết hoàn về theo kho (kho
     * nhập = kho xuất của phiếu chuyển), không theo tiền tố: phiếu nhập hàng khách trả cũng mang PN-RET.
     */
    public List<NguonKeToan.PhieuChuyen> chuyenKhoNhanChuaXuat(Instant tu, Instant den) {
        String sql = """
                SELECT pn.id, pn.so_phieu_nhap, pn.ngay_nhap,
                       COALESCE(pck.so_lenh_dieu_dong, pck.so_phieu_chuyen) AS so_lenh,
                       COALESCE(pck.ngay_lenh_dieu_dong, pck.ngay_tao) AS ngay_lenh,
                       kn.ma_kho AS ma_kho_nhan, kn.ten_kho AS ten_kho_nhan,
                       pn.kho_id = pck.kho_xuat_id AS la_hoan_ve
                  FROM phieu_nhap_kho pn
                  JOIN phieu_chuyen_kho pck ON pck.id = pn.phieu_chuyen_kho_id
                  JOIN kho kn ON kn.id = pn.kho_id
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('chuyen_kho_nhan:', pn.id)
                 WHERE pn.trang_thai = 3
                   AND pn.ngay_nhap >= :tu AND pn.ngay_nhap < :den
                   AND c.id IS NULL
                 ORDER BY pn.ngay_nhap, pn.id
                """;
        return jdbc.query(sql, khoang(tu, den), (rs, i) -> new NguonKeToan.PhieuChuyen(
                "chuyen_kho_nhan",
                rs.getInt("id"),
                rs.getString("so_phieu_nhap"),
                instant(rs, "ngay_nhap"),
                rs.getString("so_lenh"),
                instant(rs, "ngay_lenh"),
                null,
                null,
                rs.getString("ma_kho_nhan"),
                rs.getString("ten_kho_nhan"),
                rs.getBoolean("la_hoan_ve")));
    }

    public List<NguonKeToan.DongChuyen> dongChuyenKhoXuat(Collection<Integer> phieuIds) {
        String sql = """
                SELECT ct.phieu_xuat_kho_id AS phieu_id, MAX(bt.ma_sku) AS ma_sku, MAX(%s) AS ten_hang,
                       MAX(sp.don_vi_tinh) AS don_vi_tinh, SUM(ct.so_luong_xuat) AS so_luong
                  FROM chi_tiet_phieu_xuat_kho ct
                %s
                 WHERE ct.phieu_xuat_kho_id IN (:ids) AND ct.lo_hang_id IS NOT NULL AND ct.so_luong_xuat > 0
                 GROUP BY ct.phieu_xuat_kho_id, ct.bien_the_san_pham_id
                 ORDER BY ct.phieu_xuat_kho_id, MIN(ct.id)
                """.formatted(TEN_HANG, NOI_HANG);
        return theoLo(phieuIds, ids -> jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, i) -> dongChuyen("chuyen_kho_xuat", rs)));
    }

    public List<NguonKeToan.DongChuyen> dongChuyenKhoNhan(Collection<Integer> phieuIds) {
        String sql = """
                SELECT ct.phieu_nhap_kho_id AS phieu_id, MAX(bt.ma_sku) AS ma_sku, MAX(%s) AS ten_hang,
                       MAX(sp.don_vi_tinh) AS don_vi_tinh, SUM(ct.so_luong_nhap) AS so_luong
                  FROM chi_tiet_phieu_nhap_kho ct
                %s
                 WHERE ct.phieu_nhap_kho_id IN (:ids) AND ct.lo_hang_id IS NOT NULL AND ct.so_luong_nhap > 0
                 GROUP BY ct.phieu_nhap_kho_id, ct.bien_the_san_pham_id
                 ORDER BY ct.phieu_nhap_kho_id, MIN(ct.id)
                """.formatted(TEN_HANG, NOI_HANG);
        return theoLo(phieuIds, ids -> jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, i) -> dongChuyen("chuyen_kho_nhan", rs)));
    }

    private static NguonKeToan.DongChuyen dongChuyen(String loai, ResultSet rs) throws SQLException {
        return new NguonKeToan.DongChuyen(loai, rs.getInt("phieu_id"), rs.getString("ma_sku"), rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"), so(rs, "so_luong"));
    }

    // ── Tồn đầu kỳ ─────────────────────────────────────────────────────────

    /**
     * Tồn từng lô ở từng kho tại thời điểm mốc.
     *
     * <p>Kho thật: lấy số đã ghi trong sổ kho sát mốc nhất thay vì cộng trừ ngược từ tồn hiện tại:</p>
     * <ol>
     *   <li>có giao dịch từ mốc trở đi: "số trước" của giao dịch đầu tiên;</li>
     *   <li>không có: "số sau" của giao dịch cuối cùng trước mốc;</li>
     *   <li>sổ kho không có dòng nào của lô ở kho đó: tồn hiện tại.</li>
     * </ol>
     *
     * <p>Kho trung chuyển KHO_TRANSIT: tính từ chứng từ, cùng điều kiện với hai bước chuyển kho xuất sang kế toán — phiếu
     * xuất chuyển kho đã xuất (trạng thái 3) trước mốc, trừ phiếu nhập của phiếu chuyển (PN-TRF / PN-RET) đã hoàn tất
     * trước mốc, trừ phiếu ghi giảm hao hụt chuyển kho (phieu_dieu_chinh_kho nguồn chuyen_kho, đã áp dụng) trước mốc. Sổ
     * kho không dùng được cho kho này: trước 29/10/2026 nhận hàng trừ tồn trung chuyển mà không ghi sổ, nên số theo sổ
     * còn treo hàng đã nhận. Tính cùng điều kiện thì tồn đầu kỳ + các bước chuyển kho sau mốc trên AMIS luôn khớp nhau.</p>
     *
     * <p>Trả cả dòng âm để service báo lỗi dữ liệu thay vì giấu đi.</p>
     */
    public List<NguonKeToan.TonLo> tonTaiMoc(Instant moc) {
        String sql = """
                WITH truoc AS (
                        SELECT kho_id, lo_hang_id, so_luong_sau,
                               ROW_NUMBER() OVER (PARTITION BY kho_id, lo_hang_id ORDER BY ngay_giao_dich DESC, id DESC) AS thu_tu
                          FROM lich_su_giao_dich_kho
                         WHERE ngay_giao_dich < :moc AND loai_giao_dich <> 'chuyen_ke_noi_bo'
                ), sau AS (
                        SELECT kho_id, lo_hang_id, so_luong_truoc,
                               ROW_NUMBER() OVER (PARTITION BY kho_id, lo_hang_id ORDER BY ngay_giao_dich, id) AS thu_tu
                          FROM lich_su_giao_dich_kho
                         WHERE ngay_giao_dich >= :moc AND loai_giao_dich <> 'chuyen_ke_noi_bo'
                ), di AS (
                        SELECT ct.lo_hang_id, SUM(ct.so_luong_xuat) AS so_luong
                          FROM chi_tiet_phieu_xuat_kho ct
                          JOIN phieu_xuat_kho px ON px.id = ct.phieu_xuat_kho_id
                         WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3
                           AND px.ngay_xuat < :moc AND ct.lo_hang_id IS NOT NULL
                         GROUP BY ct.lo_hang_id
                ), den AS (
                        SELECT x.lo_hang_id, SUM(x.so_luong) AS so_luong FROM (
                            SELECT ct.lo_hang_id, ct.so_luong_nhap AS so_luong
                              FROM chi_tiet_phieu_nhap_kho ct
                              JOIN phieu_nhap_kho pn ON pn.id = ct.phieu_nhap_kho_id
                             WHERE pn.phieu_chuyen_kho_id IS NOT NULL AND pn.trang_thai = 3
                               AND pn.ngay_nhap < :moc AND ct.lo_hang_id IS NOT NULL
                            UNION ALL
                            -- Ghi giảm hao hụt (thiếu, hỏng) lúc xử lý chênh lệch: so_luong_dieu_chinh âm
                            SELECT ct.lo_hang_id, -ct.so_luong_dieu_chinh
                              FROM chi_tiet_phieu_dieu_chinh ct
                              JOIN phieu_dieu_chinh_kho d ON d.id = ct.phieu_dieu_chinh_kho_id
                             WHERE d.nguon = 'chuyen_kho' AND d.trang_thai = 2
                               AND d.ngay_dieu_chinh < :moc AND ct.lo_hang_id IS NOT NULL
                        ) x
                         GROUP BY x.lo_hang_id
                ), lo_trung_chuyen AS (
                        SELECT lo_hang_id FROM di UNION SELECT lo_hang_id FROM den
                )
                SELECT ma_kho, ma_sku, don_vi_tinh, lo_hang_id, gia_von, ton_moc FROM (
                    SELECT k.ma_kho, bt.ma_sku, sp.don_vi_tinh, t.lo_hang_id, lh.gia_von,
                           COALESCE(s.so_luong_truoc, tr.so_luong_sau, t.so_luong_ton) AS ton_moc
                      FROM ton_kho_theo_lo t
                      JOIN kho k ON k.id = t.kho_id
                      JOIN lo_hang lh ON lh.id = t.lo_hang_id
                      JOIN bien_the_san_pham bt ON bt.id = lh.bien_the_san_pham_id
                      JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                      LEFT JOIN sau s ON s.kho_id = t.kho_id AND s.lo_hang_id = t.lo_hang_id AND s.thu_tu = 1
                      LEFT JOIN truoc tr ON tr.kho_id = t.kho_id AND tr.lo_hang_id = t.lo_hang_id AND tr.thu_tu = 1
                     WHERE k.ma_kho <> 'KHO_TRANSIT'
                    UNION ALL
                    SELECT k.ma_kho, bt.ma_sku, sp.don_vi_tinh, l.lo_hang_id, lh.gia_von,
                           COALESCE(di.so_luong, 0) - COALESCE(den.so_luong, 0) AS ton_moc
                      FROM lo_trung_chuyen l
                      JOIN kho k ON k.ma_kho = 'KHO_TRANSIT'
                      JOIN lo_hang lh ON lh.id = l.lo_hang_id
                      JOIN bien_the_san_pham bt ON bt.id = lh.bien_the_san_pham_id
                      JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                      LEFT JOIN di ON di.lo_hang_id = l.lo_hang_id
                      LEFT JOIN den ON den.lo_hang_id = l.lo_hang_id
                ) x
                 WHERE ton_moc <> 0
                 ORDER BY ma_kho, ma_sku, lo_hang_id
                """;
        return jdbc.query(sql, new MapSqlParameterSource("moc", Timestamp.from(moc)), (rs, i) -> new NguonKeToan.TonLo(
                rs.getString("ma_kho"),
                rs.getString("ma_sku"),
                rs.getString("don_vi_tinh"),
                rs.getInt("lo_hang_id"),
                so(rs, "ton_moc"),
                so(rs, "gia_von")));
    }

    // ── Danh mục ───────────────────────────────────────────────────────────

    public List<NguonKeToan.KhoKt> kho() {
        return jdbc.query("SELECT ma_kho, ten_kho, dia_chi FROM kho ORDER BY id", (rs, i) ->
                new NguonKeToan.KhoKt(rs.getString("ma_kho"), rs.getString("ten_kho"), rs.getString("dia_chi")));
    }

    /**
     * Chỉ khách có chứng từ trong lô (kể cả đã ngừng). Trước 14/11/2026 gửi cả danh sách khách đang hoạt động: mỗi người
     * mua trên sàn một mã nên danh mục AMIS phình hàng nghìn dòng; nay khách sàn đã gom theo sàn (DungChungTuAmis.khach).
     */
    public List<NguonKeToan.KhachHangKt> khachHang(Collection<String> maDaDung) {
        if (maDaDung.isEmpty()) {
            return List.of();
        }
        String sql = """
                SELECT ma_khach_hang, ten_khach_hang, dia_chi, ma_so_thue, so_dien_thoai, email, nguoi_lien_he, loai_khach_hang
                  FROM khach_hang
                 WHERE ma_khach_hang IN (:ma)
                 ORDER BY id
                """;
        return jdbc.query(sql, new MapSqlParameterSource("ma", maDaDung), (rs, i) ->
                new NguonKeToan.KhachHangKt(rs.getString("ma_khach_hang"), rs.getString("ten_khach_hang"),
                        rs.getString("dia_chi"), rs.getString("ma_so_thue"), rs.getString("so_dien_thoai"),
                        rs.getString("email"), rs.getString("nguoi_lien_he"), rs.getString("loai_khach_hang")));
    }

    public List<NguonKeToan.NhaCungCapKt> nhaCungCap() {
        String sql = """
                SELECT ma_nha_cung_cap, ten_nha_cung_cap, dia_chi, ma_so_thue, so_dien_thoai, email, nguoi_lien_he
                  FROM nha_cung_cap ORDER BY id
                """;
        return jdbc.query(sql, (rs, i) -> new NguonKeToan.NhaCungCapKt(rs.getString("ma_nha_cung_cap"),
                rs.getString("ten_nha_cung_cap"), rs.getString("dia_chi"), rs.getString("ma_so_thue"),
                rs.getString("so_dien_thoai"), rs.getString("email"), rs.getString("nguoi_lien_he")));
    }

    /** Mọi biến thể (AMIS nhập danh mục ở chế độ Cập nhật, nên gửi cả bộ không sao). */
    public List<NguonKeToan.HangHoa> hangHoa() {
        String sql = """
                SELECT bt.ma_sku, %s AS ten_hang, sp.don_vi_tinh, sp.danh_muc_id, bt.gia_ban
                  FROM bien_the_san_pham bt
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                  LEFT JOIN mau_sac ms ON ms.id = bt.mau_sac_id
                  LEFT JOIN size sz ON sz.id = bt.size_id
                  LEFT JOIN chat_lieu cl ON cl.id = bt.chat_lieu_id
                 ORDER BY bt.id
                """.formatted(TEN_HANG);
        return jdbc.query(sql, (rs, i) -> new NguonKeToan.HangHoa(rs.getString("ma_sku"), rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"), soNguyen(rs, "danh_muc_id"), rs.getBigDecimal("gia_ban")));
    }

    // ── Đối chiếu ──────────────────────────────────────────────────────────

    /**
     * Doanh thu theo cùng điều kiện Báo cáo doanh thu trong [tu, den): đơn bán trạng thái 3, 5 theo ngày giao đủ, trừ tiền
     * hoàn của phiếu trả hàng tại quầy theo ngày trả (Báo cáo doanh thu trừ như vậy từ 11/11/2026).
     */
    public BigDecimal doanhThuBaoCao(Instant tu, Instant den) {
        String sql = """
                SELECT (SELECT COALESCE(SUM(d.tong_cong), 0) FROM don_ban_hang d
                         WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (3, 5)
                           AND d.ngay_giao_hang >= :tu AND d.ngay_giao_hang < :den)
                     - (SELECT COALESCE(SUM(p.tong_tien_hoan), 0) FROM phieu_tra_hang p
                         WHERE p.ngay_tao >= :tu AND p.ngay_tao < :den)
                """;
        BigDecimal kq = jdbc.queryForObject(sql, khoang(tu, den), BigDecimal.class);
        return kq == null ? BigDecimal.ZERO : kq;
    }

    /** Tiền hoàn của phiếu trả hàng tại quầy lập trong [tu, den) chưa có chứng từ trả lại đang khóa. */
    public BigDecimal tienHoanTraQuayChuaXuat(Instant tu, Instant den) {
        BigDecimal kq = jdbc.queryForObject("""
                SELECT COALESCE(SUM(p.tong_tien_hoan), 0) FROM phieu_tra_hang p
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT('tra_lai_quay:', p.id)
                 WHERE p.ngay_tao >= :tu AND p.ngay_tao < :den AND c.id IS NULL
                """, khoang(tu, den), BigDecimal.class);
        return kq == null ? BigDecimal.ZERO : kq;
    }

    /**
     * Doanh thu đã giao kế toán (chứng từ còn khóa) có ngày hạch toán trong [tuNgay, denNgay]: chứng từ bán trừ chứng từ
     * hàng bán trả lại.
     */
    public BigDecimal doanhThuDaGiao(java.time.LocalDate tuNgay, java.time.LocalDate denNgay) {
        String sql = """
                SELECT COALESCE(SUM(CASE WHEN c.loai = 'ban_hang' THEN c.tong_tien ELSE -c.tong_tien END), 0)
                  FROM chung_tu_xuat_ke_toan c
                 WHERE c.loai IN ('ban_hang', 'tra_lai_quay', 'tra_lai_don') AND c.trang_thai = 'da_xuat'
                   AND c.ngay_hach_toan BETWEEN :tu AND :den
                """;
        BigDecimal kq = jdbc.queryForObject(sql, new MapSqlParameterSource("tu", java.sql.Date.valueOf(tuNgay))
                .addValue("den", java.sql.Date.valueOf(denNgay)), BigDecimal.class);
        return kq == null ? BigDecimal.ZERO : kq;
    }

    /**
     * Phiếu mua đang khóa mà hóa đơn nhà cung cấp được nhập sau lúc tạo lô khóa nó (tức lúc xuất phiếu chưa có hóa đơn,
     * HoaDonDauVaoService chỉ cho nhập hóa đơn sau khi xuất trong trường hợp này), cập nhật sau {@code sau} (lúc tạo lô
     * còn hiệu lực mới nhất): mỗi thay đổi hiện ở đúng một lô.
     */
    public List<NguonKeToan.HoaDonSauXuat> hoaDonSauXuat(Instant sau) {
        String sql = """
                SELECT pn.id, pn.so_phieu_nhap, pn.ngay_nhap, l.so_lo, hd.co_hoa_don, hd.ky_hieu, hd.so_hoa_don,
                       hd.ngay_hoa_don, hd.thue_suat
                  FROM chung_tu_xuat_ke_toan c
                  JOIN lo_xuat_ke_toan l ON l.id = c.lo_xuat_id
                  JOIN phieu_nhap_kho pn ON pn.id = c.id_nguon
                  JOIN hoa_don_dau_vao hd ON hd.phieu_nhap_kho_id = pn.id
                 WHERE c.loai = 'mua_hang' AND c.trang_thai = 'da_xuat'
                   AND hd.ngay_cap_nhat > l.ngay_tao
                   AND hd.ngay_cap_nhat > :sau
                 ORDER BY hd.ngay_cap_nhat, pn.id
                """;
        return jdbc.query(sql, new MapSqlParameterSource("sau", Timestamp.from(sau)), (rs, i) -> new NguonKeToan.HoaDonSauXuat(
                rs.getInt("id"),
                rs.getString("so_phieu_nhap"),
                instant(rs, "ngay_nhap"),
                rs.getString("so_lo"),
                rs.getBoolean("co_hoa_don"),
                rs.getString("ky_hieu"),
                rs.getString("so_hoa_don"),
                rs.getObject("ngay_hoa_don", java.time.LocalDate.class),
                rs.getBigDecimal("thue_suat"),
                null));
    }

    /**
     * Đơn đã giao kế toán (còn khóa) nhưng giờ ở trạng thái Bị hoàn trả (6), không có nhật ký hoàn trả (hoàn trả trước
     * 14/11/2026): kế toán lập Hàng bán trả lại tay. Đơn có nhật ký thì đã thành chứng từ trả lại (donHoanChuaXuat).
     */
    public List<NguonKeToan.SauXuat> donDaXuatBiHoanTra() {
        String sql = """
                SELECT d.id, d.so_don_hang, l.so_lo
                  FROM chung_tu_xuat_ke_toan c
                  JOIN lo_xuat_ke_toan l ON l.id = c.lo_xuat_id
                  JOIN don_ban_hang d ON d.id = c.id_nguon
                 WHERE c.loai = 'ban_hang' AND c.trang_thai = 'da_xuat' AND d.trang_thai = 6
                   AND NOT EXISTS (SELECT 1 FROM lich_su_thay_doi h
                                    WHERE h.loai_tham_chieu = 'don_ban_hang' AND h.id_tham_chieu = d.id
                                      AND h.hanh_dong = 'hoan_tra_don_ban')
                 ORDER BY d.id
                """;
        return jdbc.query(sql, (rs, i) -> new NguonKeToan.SauXuat(rs.getInt("id"), rs.getString("so_don_hang"),
                rs.getString("so_lo")));
    }

    /** Nhóm biến động kho tự dựng thành phiếu nhập / xuất kho khác (bảng nguồn là phiếu điều chỉnh, phiếu xuất, phiếu nhập). */
    private static final String NHOM_TU_DONG = """
            nhom IN ('kiem_ke', 'xuat_khac', 'nhap_khac', 'ghi_giam_chuyen_kho')
            AND loai_tham_chieu IN ('phieu_dieu_chinh_kho', 'phieu_xuat_kho', 'phieu_nhap_kho')
            AND id_tham_chieu IS NOT NULL
            """;

    /**
     * Từng dòng sổ kho trong [tu, den), phân nhóm theo chứng từ gốc. nhom NULL = đã có chứng từ kế toán tương ứng (mua,
     * bán, chuyển kho) hoặc là dòng của kho trung chuyển đã nằm trong chứng từ chuyển kho. tra_quay: phiếu nhập hàng đạt
     * của phiếu trả hàng tại quầy (sang kế toán bằng chứng từ Hàng bán trả lại). Cần tham số :tu, :den, :moc.
     */
    private static final String DONG_BIEN_DONG = """
            SELECT l.loai_tham_chieu, l.id_tham_chieu, k.ma_kho, l.ngay_giao_dich, l.bien_the_san_pham_id,
                   COALESCE(NULLIF(l.gia_von, 0), lh.gia_von) AS gia_von,
                   COALESCE(px.so_phieu_xuat, pn.so_phieu_nhap, dck.so_phieu, dkk.ma_dot_kiem_ke) AS so_chung_tu,
                   LEFT(COALESCE(pn.ghi_chu, dck.ly_do, CONCAT('Đơn ', dx.so_don_hang)), 200) AS ghi_chu,
                   CASE WHEN l.so_luong_truoc IS NOT NULL AND l.so_luong_sau IS NOT NULL THEN l.so_luong_sau - l.so_luong_truoc
                        WHEN l.loai_giao_dich = 'xuat_kho' THEN -l.so_luong
                        ELSE l.so_luong END AS chenh,
                   CASE WHEN l.loai_tham_chieu = 'phieu_dieu_chinh_kho' AND dck.nguon = 'chuyen_kho' THEN 'ghi_giam_chuyen_kho'
                        WHEN k.ma_kho = 'KHO_TRANSIT' THEN NULL
                        WHEN l.loai_giao_dich = 'dieu_chinh' THEN 'kiem_ke'
                        WHEN l.loai_tham_chieu = 'phieu_xuat_kho' AND px.loai_xuat NOT IN ('ban_hang', 'chuyen_kho') THEN 'xuat_khac'
                        -- Xuất bán của đơn đã hủy / hoàn trả mà chưa từng sang kế toán: không có chứng từ bán hàng
                        WHEN l.loai_tham_chieu = 'phieu_xuat_kho' AND px.loai_xuat = 'ban_hang' AND l.loai_giao_dich = 'xuat_kho'
                             AND dx.trang_thai IN (4, 6) AND cb.id IS NULL THEN 'xuat_ban_khong_doanh_thu'
                        WHEN l.loai_tham_chieu = 'phieu_xuat_kho' AND px.loai_xuat = 'ban_hang' AND l.loai_giao_dich = 'nhap_kho'
                             AND px.ngay_xuat < :moc THEN 'nhap_lai_ban_truoc_moc'
                        WHEN l.loai_tham_chieu = 'phieu_nhap_kho' AND pn.don_mua_hang_id IS NULL AND pn.phieu_chuyen_kho_id IS NULL
                             AND pn.so_phieu_nhap LIKE 'PN-RET-%' THEN 'nhap_hang_hoan'
                        WHEN l.loai_tham_chieu = 'phieu_nhap_kho' AND pn.don_mua_hang_id IS NULL AND pn.phieu_chuyen_kho_id IS NULL THEN 'nhap_khac'
                        WHEN COALESCE(l.loai_tham_chieu, '') NOT IN ('phieu_nhap_kho', 'phieu_xuat_kho') THEN 'khac'
                   END AS nhom,
                   pn.id IS NOT NULL AND EXISTS (SELECT 1 FROM phieu_tra_hang pth WHERE pth.phieu_nhap_kho_id = pn.id) AS tra_quay
              FROM lich_su_giao_dich_kho l
              JOIN kho k ON k.id = l.kho_id
              LEFT JOIN lo_hang lh ON lh.id = l.lo_hang_id
              LEFT JOIN phieu_xuat_kho px ON l.loai_tham_chieu = 'phieu_xuat_kho' AND px.id = l.id_tham_chieu
              LEFT JOIN don_ban_hang dx ON dx.id = px.don_ban_hang_id
              LEFT JOIN chung_tu_xuat_ke_toan cb ON cb.khoa_hieu_luc = CONCAT('ban_hang:', dx.id)
              LEFT JOIN phieu_nhap_kho pn ON l.loai_tham_chieu = 'phieu_nhap_kho' AND pn.id = l.id_tham_chieu
              LEFT JOIN phieu_dieu_chinh_kho dck ON l.loai_tham_chieu = 'phieu_dieu_chinh_kho' AND dck.id = l.id_tham_chieu
              LEFT JOIN dot_kiem_ke dkk ON l.loai_tham_chieu = 'kiem_ke' AND dkk.id = l.id_tham_chieu
             WHERE l.ngay_giao_dich >= :tu AND l.ngay_giao_dich < :den
               AND l.loai_giao_dich <> 'chuyen_ke_noi_bo'
            """;

    /**
     * Biến động kho trong [tu, den) mà lô kế toán không có chứng từ tương ứng, để kế toán lập tay trên AMIS (không thì tồn
     * AMIS lệch dần và phiếu xuất sau bị báo xuất quá tồn): hàng của phiếu xuất bán trước ngày mốc nhập lại kho; hàng hoàn
     * của đơn bán (PN-RET); phiếu xuất bán của đơn đã hủy / hoàn trả chưa từng sang kế toán; giao dịch khác. Kiểm kê, hao
     * hụt chuyển kho, xuất khác, nhập khác và phiếu nhập của trả hàng tại quầy phát sinh từ {@code tuDong} trở đi đã thành
     * chứng từ (khoKhacChuaXuat, phieuTraQuayChuaXuat) nên bỏ; trước {@code tuDong} (lô tạo trước khi có chức năng tự dựng)
     * vẫn liệt kê như cũ.
     */
    public List<NguonKeToan.BienDongKho> bienDongKhoKhongCoChungTu(Instant tu, Instant den, Instant moc, Instant tuDong) {
        String sql = """
                SELECT nhom, loai_tham_chieu, id_tham_chieu, ma_kho,
                       MAX(so_chung_tu) AS so_chung_tu, MAX(ghi_chu) AS ghi_chu, COUNT(*) AS so_dong,
                       SUM(GREATEST(chenh, 0)) AS tang, SUM(GREATEST(-chenh, 0)) AS giam, MIN(ngay_giao_dich) AS ngay
                  FROM (%s) x
                 WHERE nhom IS NOT NULL
                   AND NOT (ngay_giao_dich >= :tuDong AND (tra_quay OR (%s)))
                 GROUP BY nhom, loai_tham_chieu, id_tham_chieu, ma_kho
                 ORDER BY MIN(ngay_giao_dich), id_tham_chieu
                """.formatted(DONG_BIEN_DONG, NHOM_TU_DONG);
        MapSqlParameterSource thamSo = khoang(tu, den).addValue("moc", Timestamp.from(moc))
                .addValue("tuDong", Timestamp.from(tuDong));
        return jdbc.query(sql, thamSo, (rs, i) -> new NguonKeToan.BienDongKho(
                rs.getString("nhom"),
                rs.getString("loai_tham_chieu"),
                soNguyen(rs, "id_tham_chieu"),
                rs.getString("so_chung_tu"),
                rs.getString("ma_kho"),
                rs.getInt("so_dong"),
                so(rs, "tang"),
                so(rs, "giam"),
                instant(rs, "ngay"),
                rs.getString("ghi_chu")));
    }

    /**
     * Biến động kho tự dựng thành phiếu nhập / xuất kho khác: dòng sổ kho trong [tu, den) thuộc nhóm kiểm kê, hao hụt
     * chuyển kho, xuất khác, nhập khác; gộp theo chiều (tăng / giảm), chứng từ gốc, kho, mã hàng; chưa xuất kế toán (khóa
     * theo chiều và bảng nguồn, xem ChungTuXuatKeToan.LOAI_NHAP_KHAC_*). giaTri = Σ số lượng × giá vốn của dòng sổ kho
     * (không có thì giá vốn lô).
     */
    public List<NguonKeToan.DongKhoKhac> khoKhacChuaXuat(Instant tu, Instant den, Instant moc) {
        String sql = """
                SELECT y.*, bt.ma_sku, %s AS ten_hang, sp.don_vi_tinh
                  FROM (
                    SELECT IF(chenh > 0, 'tang', 'giam') AS huong, loai_tham_chieu, id_tham_chieu, MAX(nhom) AS nhom,
                           MAX(so_chung_tu) AS so_chung_tu, MIN(ngay_giao_dich) AS ngay, MAX(ghi_chu) AS ghi_chu, ma_kho,
                           bien_the_san_pham_id, SUM(ABS(chenh)) AS so_luong,
                           SUM(ABS(chenh) * COALESCE(gia_von, 0)) AS gia_tri,
                           SUM(CASE WHEN gia_von IS NULL OR gia_von <= 0 THEN 1 ELSE 0 END) AS thieu_gia
                      FROM (%s) x
                     WHERE chenh <> 0 AND %s
                     GROUP BY IF(chenh > 0, 'tang', 'giam'), loai_tham_chieu, id_tham_chieu, ma_kho, bien_the_san_pham_id
                  ) y
                  JOIN bien_the_san_pham bt ON bt.id = y.bien_the_san_pham_id
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                  LEFT JOIN mau_sac ms ON ms.id = bt.mau_sac_id
                  LEFT JOIN size sz ON sz.id = bt.size_id
                  LEFT JOIN chat_lieu cl ON cl.id = bt.chat_lieu_id
                  LEFT JOIN chung_tu_xuat_ke_toan c ON c.khoa_hieu_luc = CONCAT(
                        IF(y.huong = 'tang', 'nhap_khac_', 'xuat_khac_'),
                        CASE y.loai_tham_chieu WHEN 'phieu_dieu_chinh_kho' THEN 'dck' WHEN 'phieu_xuat_kho' THEN 'pxk' ELSE 'pnk' END,
                        ':', y.id_tham_chieu)
                 WHERE c.id IS NULL
                 ORDER BY y.ngay, y.id_tham_chieu, y.huong, y.ma_kho, bt.ma_sku
                """.formatted(TEN_HANG, DONG_BIEN_DONG, NHOM_TU_DONG);
        return jdbc.query(sql, khoang(tu, den).addValue("moc", Timestamp.from(moc)), (rs, i) -> new NguonKeToan.DongKhoKhac(
                rs.getString("huong"),
                rs.getString("loai_tham_chieu"),
                rs.getInt("id_tham_chieu"),
                rs.getString("so_chung_tu"),
                rs.getString("nhom"),
                instant(rs, "ngay"),
                rs.getString("ghi_chu"),
                rs.getString("ma_kho"),
                rs.getString("ma_sku"),
                rs.getString("ten_hang"),
                rs.getString("don_vi_tinh"),
                so(rs, "so_luong"),
                so(rs, "gia_tri"),
                rs.getInt("thieu_gia")));
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────

    private static MapSqlParameterSource khoang(Instant tu, Instant den) {
        return new MapSqlParameterSource("tu", Timestamp.from(tu)).addValue("den", Timestamp.from(den));
    }

    private static Instant instant(ResultSet rs, String cot) throws SQLException {
        Timestamp t = rs.getTimestamp(cot);
        return t == null ? null : t.toInstant();
    }

    private static BigDecimal so(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }

    private static Integer soNguyen(ResultSet rs, String cot) throws SQLException {
        int v = rs.getInt(cot);
        return rs.wasNull() ? null : v;
    }

    private interface TruyVanLo<T> {
        List<T> chay(List<Integer> ids);
    }

    private static <T> List<T> theoLo(Collection<Integer> ids, TruyVanLo<T> truyVan) {
        List<T> kq = new ArrayList<>();
        List<Integer> ds = new ArrayList<>(ids);
        for (int i = 0; i < ds.size(); i += CO_LO_IN) {
            kq.addAll(truyVan.chay(ds.subList(i, Math.min(ds.size(), i + CO_LO_IN))));
        }
        return kq;
    }
}
