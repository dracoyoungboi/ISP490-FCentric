package com.dev.backend.repository;

import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.entities.Kho;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Truy vấn phụ của màn Tạo yêu cầu nhập hàng: danh sách Kho tổng đang hoạt động (kèm địa chỉ, người quản lý chính)
 * và mã vạch SKU phục vụ máy quét. Số liệu tồn kho, ROP và số lượng đề xuất lấy trực tiếp từ bộ máy DSS.
 */
@Repository
public class HangNhapKhoTongRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public HangNhapKhoTongRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** quan_ly: họ tên người quản lý chính (Kho.quanLy, cùng câu con). */
    static final String SQL_KHO_TONG = """
            SELECT k.id, k.ma_kho, k.ten_kho, k.dia_chi, nd.ho_ten AS quan_ly
            FROM kho k
            LEFT JOIN nguoi_dung nd ON nd.id = %s
            WHERE k.loai_kho = 'kho_tong' AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            ORDER BY k.id
            """.formatted(Kho.sqlQuanLyChinh("k.id"));

    static final String SQL_MA_VACH_THEO_BIEN_THE = """
            SELECT bt.id AS bien_the_id, bt.ma_vach_sku
            FROM bien_the_san_pham bt
            WHERE bt.id IN (:ids)
              AND bt.ma_vach_sku IS NOT NULL
              AND bt.ma_vach_sku <> ''
            """;

    /** Kho tổng đang hoạt động (nơi duy nhất nhận hàng từ nhà cung cấp), id tăng dần. */
    public List<KhoTong> khoTongHoatDong() {
        return jdbc.query(SQL_KHO_TONG, (rs, i) -> new KhoTong(rs.getInt("id"), rs.getString("ma_kho"),
                rs.getString("ten_kho"), rs.getString("dia_chi"), rs.getString("quan_ly")));
    }

    /** Nạp mã vạch SKU theo lô id biến thể để phục vụ quét mã tại ô tìm hàng. */
    public Map<Integer, String> maVachTheoBienThe(Collection<Integer> bienTheIds) {
        Map<Integer, String> ketQua = new HashMap<>();
        if (bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        jdbc.query(SQL_MA_VACH_THEO_BIEN_THE, new MapSqlParameterSource("ids", bienTheIds), rs -> {
            ketQua.put(rs.getInt("bien_the_id"), rs.getString("ma_vach_sku"));
        });
        return ketQua;
    }
}
