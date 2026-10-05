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