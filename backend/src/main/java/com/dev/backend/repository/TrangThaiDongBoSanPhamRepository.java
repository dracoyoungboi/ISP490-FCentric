package com.dev.backend.repository;

import com.dev.backend.entities.TrangThaiDongBoSanPham;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrangThaiDongBoSanPhamRepository extends JpaRepository<TrangThaiDongBoSanPham, Integer>, JpaSpecificationExecutor<TrangThaiDongBoSanPham> {

    Optional<TrangThaiDongBoSanPham> findByKenhBanHangIdAndBienTheSanPhamId(Integer kenhBanId, Integer bienTheSanPhamId);

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
}

