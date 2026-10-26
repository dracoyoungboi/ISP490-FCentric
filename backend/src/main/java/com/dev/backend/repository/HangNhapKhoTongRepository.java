package com.dev.backend.repository;

import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.utils.PublicAssetUrl;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * Truy vấn của màn Tạo yêu cầu nhập hàng: các Kho tổng đang hoạt động và danh mục biến thể nhập được kèm khả dụng ở
 * Kho tổng. Số đang về và yêu cầu nhập đang mở lấy từ TongQuanVaiTroRepository (cùng định nghĩa với mục Cần mua).
 */
@Repository
public class HangNhapKhoTongRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public HangNhapKhoTongRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Một biến thể nhập được với khả dụng ở Kho tổng; daTungNhap: cặp (Kho tổng, biến thể) đã từng có lô. */
    public record HangDong(Integer bienTheId, String maSku, String maVach, Integer sanPhamId, String maSanPham,
                           String tenSanPham, String nhomHang, String tenMau, String maMauHex, String tenSize,
                           String tenChatLieu, String anh, long khaDung, boolean daTungNhap, int nguong) {}

    static final String SQL_KHO_TONG = """
            SELECT k.id, k.ma_kho, k.ten_kho, k.dia_chi, nd.ho_ten AS quan_ly
            FROM kho k
            LEFT JOIN nguoi_dung nd ON nd.id = k.quan_ly_id
            WHERE k.loai_kho = 'kho_tong' AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            ORDER BY k.id
            """;

    /** Kho tổng đang hoạt động (nơi duy nhất nhận hàng từ nhà cung cấp), id tăng dần. */
    public List<KhoTong> khoTongHoatDong() {
        return jdbc.query(SQL_KHO_TONG, (rs, i) -> new KhoTong(rs.getInt("id"), rs.getString("ma_kho"),
                rs.getString("ten_kho"), rs.getString("dia_chi"), rs.getString("quan_ly")));
    }

    /**
     * Biến thể đang bán (bt.trang_thai = 1) của sản phẩm chưa ngừng hoạt động (Còn hàng 1 hoặc Hết hàng 0 do hệ thống
     * tự đặt). Ngưỡng theo sản phẩm, trống hoặc 0 thì lấy mặc định — cùng cách Tổng quan (TongQuanAdminRepository).
     * Ảnh: ảnh biến thể đang bật (id nhỏ nhất, như màn bán tại quầy — AnhBienTheRepository.findActiveByBienTheIds),
     * không có thì ảnh chính của sản phẩm.
     */
    static final String SQL_HANG_KHO_TONG = """
            SELECT bt.id AS bien_the_id, bt.ma_sku, bt.ma_vach_sku, sp.id AS san_pham_id, sp.ma_san_pham,
                   sp.ten_san_pham, dm.ten_danh_muc, ms.ten_mau, ms.ma_mau_hex, sz.ten_size, cl.ten_chat_lieu,
                   COALESCE(
                       (SELECT tt.duong_dan FROM anh_bien_the a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                         WHERE a.bien_the_id = bt.id AND a.trang_thai = 1 ORDER BY a.id LIMIT 1),
                       (SELECT tt.duong_dan FROM anh_quan_ao a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                         WHERE a.quan_ao_id = sp.id AND COALESCE(a.trang_thai, 1) = 1
                         ORDER BY COALESCE(a.anh_chinh, 0) = 1 DESC, a.id LIMIT 1))              AS anh,
                   COALESCE(t.kha_dung, 0)                                                         AS kha_dung,
                   CASE WHEN t.bien_the_id IS NULL THEN 0 ELSE 1 END                               AS da_tung_nhap,
                   COALESCE(NULLIF(sp.muc_ton_toi_thieu, 0), :nguongMacDinh)                     AS nguong
            FROM bien_the_san_pham bt
            JOIN san_pham_quan_ao sp      ON sp.id = bt.san_pham_id
            LEFT JOIN danh_muc_quan_ao dm ON dm.id = sp.danh_muc_id
            LEFT JOIN mau_sac ms          ON ms.id = bt.mau_sac_id
            LEFT JOIN size sz             ON sz.id = bt.size_id
            LEFT JOIN chat_lieu cl        ON cl.id = bt.chat_lieu_id
            LEFT JOIN (
                SELECT lh.bien_the_san_pham_id AS bien_the_id, SUM(tk.so_luong_kha_dung) AS kha_dung
                FROM ton_kho_theo_lo tk
                JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                WHERE tk.kho_id = :khoId
                GROUP BY lh.bien_the_san_pham_id
            ) t ON t.bien_the_id = bt.id
            WHERE bt.trang_thai = 1 AND sp.trang_thai IN (0, 1)
            ORDER BY sp.ten_san_pham, sp.id, bt.id
            """;

    public List<HangDong> hangKhoTong(Integer khoId, int nguongMacDinh) {
        MapSqlParameterSource p = new MapSqlParameterSource("khoId", khoId).addValue("nguongMacDinh", nguongMacDinh);
        return jdbc.query(SQL_HANG_KHO_TONG, p, (rs, i) -> new HangDong(rs.getInt("bien_the_id"),
                rs.getString("ma_sku"), rs.getString("ma_vach_sku"), rs.getInt("san_pham_id"),
                rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), rs.getString("ten_danh_muc"),
                rs.getString("ten_mau"), rs.getString("ma_mau_hex"), rs.getString("ten_size"),
                rs.getString("ten_chat_lieu"), PublicAssetUrl.toHttps(rs.getString("anh")), so(rs, "kha_dung"),
                rs.getInt("da_tung_nhap") == 1, rs.getInt("nguong")));
    }

    /** Số lượng làm tròn về số nguyên (như TongQuanVaiTroRepository.so). */
    private static long so(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).longValue();
    }
}
