package com.dev.backend.repository;

import com.dev.backend.entities.MaVachNhaCungCap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MaVachNhaCungCapRepository extends JpaRepository<MaVachNhaCungCap, Integer> {
    Optional<MaVachNhaCungCap> findByBarcodeNccAndNhaCungCap_Id(String barcodeNcc, Integer nhaCungCapId);

    Optional<MaVachNhaCungCap> findFirstByBarcodeNcc(String barcodeNcc);

    boolean existsByBarcodeNccAndNhaCungCap_Id(String barcodeNcc, Integer nhaCungCapId);

    @Query("SELECT m FROM MaVachNhaCungCap m " +
           "JOIN FETCH m.nhaCungCap " +
           "JOIN FETCH m.bienTheSanPham bt " +
           "JOIN FETCH bt.sanPham " +
           "WHERE (:nhaCungCapId IS NULL OR m.nhaCungCap.id = :nhaCungCapId) " +
           "AND (:q IS NULL OR :q = '' OR LOWER(m.barcodeNcc) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(m.maSanPhamNcc) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(bt.sanPham.tenSanPham) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<MaVachNhaCungCap> searchMappings(@Param("nhaCungCapId") Integer nhaCungCapId,
                                          @Param("q") String q,
                                          Pageable pageable);
}

