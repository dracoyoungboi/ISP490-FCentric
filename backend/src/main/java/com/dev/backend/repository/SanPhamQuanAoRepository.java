package com.dev.backend.repository;

import com.dev.backend.entities.SanPhamQuanAo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SanPhamQuanAoRepository extends JpaRepository<SanPhamQuanAo, Integer>, JpaSpecificationExecutor<SanPhamQuanAo> {

    Optional<SanPhamQuanAo> findSanPhamQuanAoByMaSanPham(String maSanPham);
    @Query("SELECT s FROM SanPhamQuanAo s " +
            "LEFT JOIN FETCH s.danhMuc d " +
            "LEFT JOIN FETCH d.danhMucCha " +
            "LEFT JOIN FETCH s.thuongHieu " +
            "WHERE s.id = :id")
    Optional<SanPhamQuanAo> findDetailById(@Param("id") Integer id);
    long countByMaSanPhamStartingWith(String prefix);

    /**
     * Sản phẩm có tên (đã gộp khoảng trắng như {@code chuanHoaTenSanPham}, để bắt cả tên cũ lưu chưa chuẩn hóa) bằng
     * :ten theo collation của cột (utf8mb4_unicode_ci: bỏ qua hoa thường và dấu), nên là tập ứng viên rộng; nơi gọi
     * tự lọc lại theo quy tắc trùng tên. Mỗi dòng: [id, ma_san_pham, ten_san_pham, trang_thai] (số đọc qua Number).
     */
    @Query(value = """
            SELECT id, ma_san_pham, ten_san_pham, CAST(trang_thai AS SIGNED)
            FROM san_pham_quan_ao
            WHERE TRIM(REGEXP_REPLACE(ten_san_pham, '[[:space:]]+', ' ')) = :ten
            """, nativeQuery = true)
    List<Object[]> findUngVienTrungTen(@Param("ten") String ten);

    @Query("""
            SELECT DISTINCT sp FROM SanPhamQuanAo sp
            JOIN FETCH sp.danhMuc dm
            JOIN sp.bienTheSanPhams bt
            JOIN LoHang lh ON lh.bienTheSanPham = bt
            JOIN TonKhoTheoLo tk ON tk.loHang = lh
            WHERE tk.kho.id = :khoId
              AND sp.trangThai = 1
              AND bt.trangThai = 1
              AND tk.soLuongKhaDung > 0
            ORDER BY sp.tenSanPham
            """)
    List<SanPhamQuanAo> findSanPhamTrongKho(@Param("khoId") Integer khoId);
}