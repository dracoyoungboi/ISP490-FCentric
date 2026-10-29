package com.dev.backend.repository;

import com.dev.backend.entities.PhieuDieuChinhKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PhieuDieuChinhKhoRepository extends JpaRepository<PhieuDieuChinhKho, Integer> {

    Optional<PhieuDieuChinhKho> findFirstByBienBanGiaoNhan_Id(Integer bienBanGiaoNhanId);

    /** Số đuôi lớn nhất của số phiếu dạng `DCK-yyyyMMdd-` + chữ số. */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(so_phieu, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM phieu_dieu_chinh_kho
        WHERE so_phieu LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(so_phieu, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);
}
