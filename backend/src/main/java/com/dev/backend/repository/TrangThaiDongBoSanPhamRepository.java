package com.dev.backend.repository;

import com.dev.backend.entities.TrangThaiDongBoSanPham;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrangThaiDongBoSanPhamRepository extends JpaRepository<TrangThaiDongBoSanPham, Integer>, JpaSpecificationExecutor<TrangThaiDongBoSanPham> {

    Optional<TrangThaiDongBoSanPham> findByKenhBanHangIdAndBienTheSanPhamId(Integer kenhBanId, Integer bienTheSanPhamId);

    /** Biến thể đã được ghép với một dòng khác (khác id) của cùng kênh hay chưa */
    boolean existsByKenhBanHangIdAndBienTheSanPhamIdAndIdNot(Integer kenhBanId, Integer bienTheSanPhamId, Integer id);

    Optional<TrangThaiDongBoSanPham> findByKenhBanHangIdAndMaSanPhamKenh(Integer kenhBanId, String maSanPhamKenh);

    List<TrangThaiDongBoSanPham> findByKenhBanHangId(Integer kenhBanId);

    List<TrangThaiDongBoSanPham> findByBienTheSanPhamId(Integer bienTheSanPhamId);

    long countByKenhBanHangId(Integer kenhBanId);

    long countByKenhBanHangIdAndTrangThaiDongBo(Integer kenhBanId, String trangThaiDongBo);

    @Query("""
        SELECT t FROM TrangThaiDongBoSanPham t
        JOIN FETCH t.bienTheSanPham bt
        JOIN FETCH bt.sanPham sp
        WHERE t.kenhBanHang.id = :kenhBanId
        AND (:trangThai IS NULL OR t.trangThaiDongBo = :trangThai)
        AND (:search IS NULL OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(t.maSanPhamKenh) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    Page<TrangThaiDongBoSanPham> filterByKenh(
            @Param("kenhBanId") Integer kenhBanId,
            @Param("trangThai") String trangThai,
            @Param("search") String search,
            Pageable pageable
    );

    /**
     * Trang id sản phẩm có ít nhất một liên kết khớp bộ lọc (cùng điều kiện với {@link #filterByKenh}),
     * sản phẩm có liên kết mới nhất lên trước. Thứ tự đã cố định ở đây: truyền Pageable không sắp xếp.
     */
    @Query(value = """
        SELECT sp.id FROM TrangThaiDongBoSanPham t
        JOIN t.bienTheSanPham bt
        JOIN bt.sanPham sp
        WHERE t.kenhBanHang.id = :kenhBanId
        AND (:trangThai IS NULL OR t.trangThaiDongBo = :trangThai)
        AND (:search IS NULL OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(t.maSanPhamKenh) LIKE LOWER(CONCAT('%', :search, '%')))
        GROUP BY sp.id
        ORDER BY MAX(t.id) DESC, sp.id DESC
    """, countQuery = """
        SELECT COUNT(DISTINCT sp.id) FROM TrangThaiDongBoSanPham t
        JOIN t.bienTheSanPham bt
        JOIN bt.sanPham sp
        WHERE t.kenhBanHang.id = :kenhBanId
        AND (:trangThai IS NULL OR t.trangThaiDongBo = :trangThai)
        AND (:search IS NULL OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(t.maSanPhamKenh) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    Page<Integer> pageSanPhamIdTheoKenh(
            @Param("kenhBanId") Integer kenhBanId,
            @Param("trangThai") String trangThai,
            @Param("search") String search,
            Pageable pageable
    );

    /**
     * Mọi liên kết khớp bộ lọc của các sản phẩm đã chọn (một trang của {@link #pageSanPhamIdTheoKenh}),
     * nạp sẵn màu, kích cỡ, chất liệu để dựng tên phân loại không cần truy vấn thêm.
     * Trong mỗi sản phẩm xếp theo màu, chất liệu, thứ tự kích cỡ (như các màn tồn kho).
     */
    @Query("""
        SELECT t FROM TrangThaiDongBoSanPham t
        JOIN FETCH t.bienTheSanPham bt
        JOIN FETCH bt.sanPham sp
        JOIN FETCH bt.mauSac ms
        JOIN FETCH bt.size s
        JOIN FETCH bt.chatLieu cl
        WHERE t.kenhBanHang.id = :kenhBanId
        AND sp.id IN :sanPhamIds
        AND (:trangThai IS NULL OR t.trangThaiDongBo = :trangThai)
        AND (:search IS NULL OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(t.maSanPhamKenh) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY ms.tenMau, ms.id, cl.tenChatLieu, cl.id, s.thuTuSapXep, s.id, bt.id
    """)
    List<TrangThaiDongBoSanPham> findTheoKenhVaSanPham(
            @Param("kenhBanId") Integer kenhBanId,
            @Param("sanPhamIds") Collection<Integer> sanPhamIds,
            @Param("trangThai") String trangThai,
            @Param("search") String search
    );

    /** [id sản phẩm, số liên kết với kênh] của các sản phẩm đã chọn, không theo bộ lọc. */
    @Query("""
        SELECT bt.sanPham.id, COUNT(t.id) FROM TrangThaiDongBoSanPham t
        JOIN t.bienTheSanPham bt
        WHERE t.kenhBanHang.id = :kenhBanId
        AND bt.sanPham.id IN :sanPhamIds
        GROUP BY bt.sanPham.id
    """)
    List<Object[]> demLienKetTheoSanPham(
            @Param("kenhBanId") Integer kenhBanId,
            @Param("sanPhamIds") Collection<Integer> sanPhamIds
    );
}

