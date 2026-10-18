package com.dev.backend.repository;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mẫu quyền theo vai trò (bảng mau_quyen_vai_tro) và cờ quyền nhạy cảm (cột quyen_han.nhay_cam).
 * Bảng và cột do {@link com.dev.backend.config.PhanQuyenTableInitializer} tạo lúc khởi động.
 * Dùng JdbcTemplate vì bảng chỉ là cặp (vai_tro, quyen_han_id), không cần thực thể JPA.
 */
@Repository
@Slf4j
public class MauQuyenVaiTroRepository {

    private final JdbcTemplate jdbcTemplate;

    public MauQuyenVaiTroRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Vai trò → id quyền trong mẫu, xếp theo id. Bảng chưa có thì trả rỗng. */
    public Map<String, List<Integer>> layTatCa() {
        Map<String, List<Integer>> ketQua = new LinkedHashMap<>();
        try {
            jdbcTemplate.query(
                    "SELECT vai_tro, quyen_han_id FROM mau_quyen_vai_tro ORDER BY vai_tro, quyen_han_id",
                    rs -> {
                        ketQua.computeIfAbsent(rs.getString("vai_tro"), k -> new ArrayList<>())
                                .add(rs.getInt("quyen_han_id"));
                    });
        } catch (DataAccessException e) {
            log.warn("[PHAN-QUYEN] Không đọc được mẫu quyền theo vai trò: {}", e.getMessage());
        }
        return ketQua;
    }

    /** Thay toàn bộ mẫu của một vai trò. Chạy trong giao dịch của tầng service. */
    public void thayMau(String vaiTro, Collection<Integer> quyenHanIds) {
        jdbcTemplate.update("DELETE FROM mau_quyen_vai_tro WHERE vai_tro = ?", vaiTro);
        List<Object[]> dong = new ArrayList<>();
        for (Integer id : quyenHanIds) {
            dong.add(new Object[]{vaiTro, id});
        }
        if (!dong.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id) VALUES (?, ?)", dong);
        }
    }

    /** Id các quyền nhạy cảm. Cột chưa có thì trả rỗng. */
    public List<Integer> layIdQuyenNhayCam() {
        try {
            return jdbcTemplate.queryForList("SELECT id FROM quyen_han WHERE nhay_cam = 1 ORDER BY id", Integer.class);
        } catch (DataAccessException e) {
            log.warn("[PHAN-QUYEN] Không đọc được quyền nhạy cảm: {}", e.getMessage());
            return new ArrayList<>();
        }
    }
}
