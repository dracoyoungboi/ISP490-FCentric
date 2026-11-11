package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuChuyenKe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ChiTietPhieuChuyenKeRepository extends JpaRepository<ChiTietPhieuChuyenKe, Integer> {

    /** Dòng của các phiếu kèm biến thể, sản phẩm, lô, kệ (một câu cho cả trang danh sách). */
    @Query("""
            SELECT c FROM ChiTietPhieuChuyenKe c
              JOIN FETCH c.bienTheSanPham bt JOIN FETCH bt.sanPham
              JOIN FETCH c.loHang JOIN FETCH c.keNguon JOIN FETCH c.keDich
             WHERE c.phieuChuyenKe.id IN :phieuIds
             ORDER BY c.phieuChuyenKe.id, c.id
            """)
    List<ChiTietPhieuChuyenKe> theoPhieu(@Param("phieuIds") Collection<Integer> phieuIds);
}
