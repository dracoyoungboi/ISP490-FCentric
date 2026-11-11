package com.dev.backend.repository;

import com.dev.backend.entities.PhieuChuyenKe;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface PhieuChuyenKeRepository extends JpaRepository<PhieuChuyenKe, Integer> {

    /** Số đuôi lớn nhất đã cấp cho tiền tố ngày (MV-20261111-), null khi chưa có phiếu nào. */
    @Query(value = """
            SELECT MAX(CAST(SUBSTRING(ma_phieu, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
              FROM phieu_chuyen_ke WHERE ma_phieu LIKE CONCAT(:tienTo, '%')
            """, nativeQuery = true)
    Long soDuoiLonNhat(@Param("tienTo") String tienTo);

    /**
     * Phiếu của một kho, mới nhất trước. {@code tim}: mã phiếu, mã kệ (nguồn / đích), mã SKU hoặc mã lô của một dòng;
     * null = không lọc. {@code tu} / {@code den}: khoảng ngày thực hiện [tu, den), null = không giới hạn.
     */
    @Query(value = """
            SELECT p FROM PhieuChuyenKe p JOIN FETCH p.nguoiThucHien
             WHERE p.kho.id = :khoId
               AND (:tu IS NULL OR p.ngayThucHien >= :tu) AND (:den IS NULL OR p.ngayThucHien < :den)
               AND (:tim IS NULL OR LOWER(p.maPhieu) LIKE :tim OR EXISTS (
                    SELECT 1 FROM ChiTietPhieuChuyenKe c
                     WHERE c.phieuChuyenKe = p AND (LOWER(c.keNguon.maViTri) LIKE :tim OR LOWER(c.keDich.maViTri) LIKE :tim
                        OR LOWER(c.bienTheSanPham.maSku) LIKE :tim OR LOWER(c.loHang.maLo) LIKE :tim)))
             ORDER BY p.ngayThucHien DESC, p.id DESC
            """, countQuery = """
            SELECT COUNT(p) FROM PhieuChuyenKe p
             WHERE p.kho.id = :khoId
               AND (:tu IS NULL OR p.ngayThucHien >= :tu) AND (:den IS NULL OR p.ngayThucHien < :den)
               AND (:tim IS NULL OR LOWER(p.maPhieu) LIKE :tim OR EXISTS (
                    SELECT 1 FROM ChiTietPhieuChuyenKe c
                     WHERE c.phieuChuyenKe = p AND (LOWER(c.keNguon.maViTri) LIKE :tim OR LOWER(c.keDich.maViTri) LIKE :tim
                        OR LOWER(c.bienTheSanPham.maSku) LIKE :tim OR LOWER(c.loHang.maLo) LIKE :tim)))
            """)
    Page<PhieuChuyenKe> timTheoKho(@Param("khoId") Integer khoId, @Param("tim") String tim,
                                  @Param("tu") Instant tu, @Param("den") Instant den, Pageable pageable);
}
