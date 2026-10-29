package com.dev.backend.repository;

import com.dev.backend.entities.PhieuChuyenKho;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhieuChuyenKhoRepository extends JpaRepository<PhieuChuyenKho, Integer>, JpaSpecificationExecutor<PhieuChuyenKho> {

    /** Khóa dòng phiếu (SELECT ... FOR UPDATE): mọi thao tác đổi trạng thái chạy tuần tự trên dòng này. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PhieuChuyenKho p WHERE p.id = :id")
    Optional<PhieuChuyenKho> khoaTheoId(@Param("id") Integer id);

    /** Số đuôi lớn nhất của số phiếu dạng `tienTo + chữ số` (PX-TRF-20261023 + n). Xem SoChungTu. */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(so_phieu_chuyen, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM phieu_chuyen_kho
        WHERE so_phieu_chuyen LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(so_phieu_chuyen, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);

    /** Số đuôi lớn nhất của số lệnh điều động dạng `LDD-yyyyMMdd-` + chữ số. */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(so_lenh_dieu_dong, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM phieu_chuyen_kho
        WHERE so_lenh_dieu_dong LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(so_lenh_dieu_dong, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soLenhLonNhat(@Param("tienTo") String tienTo);

    /** Số phiếu XKNB lớn nhất đã ghi cho một ký hiệu (chỉ số đúng dạng 7 chữ số); chưa có thì null. */
    @Query(value = """
        SELECT MAX(CAST(so_phieu_xknb AS UNSIGNED))
        FROM phieu_chuyen_kho
        WHERE ky_hieu_xknb = :kyHieu AND so_phieu_xknb REGEXP '^[0-9]{7}$'
    """, nativeQuery = true)
    Number soXknbLonNhat(@Param("kyHieu") String kyHieu);

    /** Cặp (ký hiệu, số) phiếu XKNB đã ghi cho phiếu chuyển khác chưa. */
    boolean existsByKyHieuXknbAndSoPhieuXknbAndIdNot(String kyHieuXknb, String soPhieuXknb, Integer id);

    /** Phiếu giao bù sinh từ phiếu này. */
    List<PhieuChuyenKho> findByPhieuGoc_Id(Integer phieuGocId);
}
