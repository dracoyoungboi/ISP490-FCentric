package com.dev.backend.repository;

import com.dev.backend.entities.ThuongHieu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface ThuongHieuRepository extends JpaRepository<ThuongHieu, Integer>, JpaSpecificationExecutor<ThuongHieu> {

    // Kiểm tra trùng mã thương hiệu (để trả lỗi khi create)
    boolean existsByMaThuongHieu(String maThuongHieu);

    // Kiểm tra trùng mã thương hiệu trừ chính bản ghi đang sửa
    boolean existsByMaThuongHieuAndIdNot(String maThuongHieu, Integer id);
}