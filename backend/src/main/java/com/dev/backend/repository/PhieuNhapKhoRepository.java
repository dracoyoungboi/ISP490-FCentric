package com.dev.backend.repository;

import com.dev.backend.entities.PhieuNhapKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PhieuNhapKhoRepository extends JpaRepository<PhieuNhapKho, Integer>, JpaSpecificationExecutor<PhieuNhapKho> {
    @Query("SELECT COUNT(p) FROM PhieuNhapKho p WHERE p.soPhieuNhap LIKE :prefix%")
    long countBySoPhieuPrefix(@Param("prefix") String prefix);
    Optional<PhieuNhapKho> findByGhiChuContaining(String ghiChu);
    /** Số phiếu nhập kho (mọi trạng thái) của một nhà cung cấp — dùng khi kiểm tra xóa nhà cung cấp. */
    long countByNhaCungCap_Id(Integer nhaCungCapId);
    @Query("""
SELECT COUNT(p)
FROM PhieuNhapKho p
WHERE p.trangThai = 0
""")
    Long countPendingImports();
    @Query("""
SELECT COUNT(p)
FROM PhieuNhapKho p
WHERE DATE(p.ngayNhap) = CURRENT_DATE
""")
    Long countImportToday();
}