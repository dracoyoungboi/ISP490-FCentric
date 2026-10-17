package com.dev.backend.repository;

import com.dev.backend.entities.LoHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface LoHangRepository extends JpaRepository<LoHang, Integer>, JpaSpecificationExecutor<LoHang> {
    boolean existsByMaLoAndBienTheSanPham_Id(String maLo, Integer bienTheSanPhamId);

    java.util.Optional<LoHang> findFirstByMaLo(String maLo);

    /** Số lô hàng ghi nhận nhà cung cấp này — dùng khi kiểm tra xóa nhà cung cấp. */
    long countByNhaCungCap_Id(Integer nhaCungCapId);
}