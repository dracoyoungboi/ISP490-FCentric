package com.dev.backend.repository;

import com.dev.backend.entities.TonKhoViTri;
import org.springframework.data.jpa.repository.JpaRepository;
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
}

