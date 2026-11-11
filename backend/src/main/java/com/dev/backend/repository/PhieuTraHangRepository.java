package com.dev.backend.repository;

import com.dev.backend.entities.PhieuTraHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhieuTraHangRepository extends JpaRepository<PhieuTraHang, Integer> {
    Optional<PhieuTraHang> findByRequestId(String requestId);

    List<PhieuTraHang> findByDonBanHangIdOrderByIdAsc(Integer donBanHangId);

    /** Số đuôi lớn nhất của tiền tố RET-YYYYMMDD- (null = chưa có phiếu nào trong ngày). */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(so_phieu, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
          FROM phieu_tra_hang
         WHERE so_phieu LIKE CONCAT(:tienTo, '%')
           AND SUBSTRING(so_phieu, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);
}
