package com.dev.backend.repository;

import com.dev.backend.entities.TonKhoViTri;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TonKhoViTriRepository extends JpaRepository<TonKhoViTri, Integer> {
    Optional<TonKhoViTri> findByViTriKho_IdAndLoHang_Id(Integer viTriKhoId, Integer loHangId);

    List<TonKhoViTri> findByViTriKho_Id(Integer viTriKhoId);

    @Query("SELECT t FROM TonKhoViTri t JOIN FETCH t.loHang JOIN FETCH t.bienTheSanPham WHERE t.viTriKho.id = :viTriKhoId AND t.soLuong > 0")
    List<TonKhoViTri> findActiveLotsByViTriId(@Param("viTriKhoId") Integer viTriKhoId);

    @Query("SELECT COALESCE(SUM(t.soLuong), 0) FROM TonKhoViTri t WHERE t.viTriKho.id = :viTriKhoId")
    Integer sumDangChuaByViTriId(@Param("viTriKhoId") Integer viTriKhoId);

    @Query("SELECT t.viTriKho.id, COALESCE(SUM(t.soLuong), 0) FROM TonKhoViTri t WHERE t.viTriKho.khuVucKho.kho.id = :khoId GROUP BY t.viTriKho.id")
    List<Object[]> sumDangChuaByKhoIdGroupByViTriId(@Param("khoId") Integer khoId);

    /** Kệ còn dòng tồn dương (kiểm thêm khi tổng tồn kệ về 0 vì có dòng âm bù). */
    boolean existsByViTriKho_IdAndSoLuongGreaterThan(Integer viTriKhoId, Integer soLuong);

    /** Xóa các dòng tồn không dương còn lại của một kệ trước khi xóa kệ (bảng không có khóa ngoại tới kệ). */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM TonKhoViTri t WHERE t.viTriKho.id = :viTriKhoId AND t.soLuong <= 0")
    int xoaDongSoKhongTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);
}

