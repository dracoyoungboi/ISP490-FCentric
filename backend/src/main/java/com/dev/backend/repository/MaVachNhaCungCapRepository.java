package com.dev.backend.repository;

import com.dev.backend.entities.MaVachNhaCungCap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MaVachNhaCungCapRepository extends JpaRepository<MaVachNhaCungCap, Integer> {
    Optional<MaVachNhaCungCap> findByBarcodeNccAndNhaCungCap_Id(String barcodeNcc, Integer nhaCungCapId);

    Optional<MaVachNhaCungCap> findFirstByBarcodeNcc(String barcodeNcc);

    boolean existsByBarcodeNccAndNhaCungCap_Id(String barcodeNcc, Integer nhaCungCapId);

    /** Gỡ toàn bộ mã vạch của một nhà cung cấp (dùng khi xóa nhà cung cấp chưa có giao dịch). */
    @Modifying
    @Query("delete from MaVachNhaCungCap m where m.nhaCungCap.id = :nhaCungCapId")
    int deleteByNhaCungCapId(@Param("nhaCungCapId") Integer nhaCungCapId);

    /** Mã vạch NCC đã liên kết của các biến thể trong một phiếu: mỗi dòng {bienTheId, barcodeNcc}. */
    @Query("select m.bienTheSanPham.id, m.barcodeNcc from MaVachNhaCungCap m " +
           "where m.nhaCungCap.id = :nhaCungCapId and m.bienTheSanPham.id in :bienTheIds order by m.id asc")
    List<Object[]> findBarcodeTheoBienThe(@Param("nhaCungCapId") Integer nhaCungCapId,
                                          @Param("bienTheIds") Collection<Integer> bienTheIds);

    @Query(value = "SELECT m FROM MaVachNhaCungCap m " +
           "JOIN FETCH m.nhaCungCap " +
           "JOIN FETCH m.bienTheSanPham bt " +
           "JOIN FETCH bt.sanPham " +
           "JOIN FETCH bt.mauSac " +
           "JOIN FETCH bt.size " +
           "LEFT JOIN FETCH m.phieuNhapKho " +
           "LEFT JOIN FETCH m.nguoiLienKet " +
           "WHERE (:nhaCungCapId IS NULL OR m.nhaCungCap.id = :nhaCungCapId) " +
           "AND (:q IS NULL OR :q = '' OR LOWER(m.barcodeNcc) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(m.maSanPhamNcc) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.mauSac.tenMau) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.sanPham.tenSanPham) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!')",
           countQuery = "SELECT COUNT(m) FROM MaVachNhaCungCap m " +
           "JOIN m.bienTheSanPham bt " +
           "WHERE (:nhaCungCapId IS NULL OR m.nhaCungCap.id = :nhaCungCapId) " +
           "AND (:q IS NULL OR :q = '' OR LOWER(m.barcodeNcc) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(m.maSanPhamNcc) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.mauSac.tenMau) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!' " +
           "     OR LOWER(bt.sanPham.tenSanPham) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!')")
    Page<MaVachNhaCungCap> searchMappings(@Param("nhaCungCapId") Integer nhaCungCapId,
                                          @Param("q") String q,
                                          Pageable pageable);
}

