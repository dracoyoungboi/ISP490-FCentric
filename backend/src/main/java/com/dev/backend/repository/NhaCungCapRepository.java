package com.dev.backend.repository;

import com.dev.backend.entities.NhaCungCap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NhaCungCapRepository extends JpaRepository<NhaCungCap, Integer>, JpaSpecificationExecutor<NhaCungCap> {

    // Search theo mã hoặc tên (không phân biệt hoa/thường)
    List<NhaCungCap> findByMaNhaCungCapContainingIgnoreCaseOrTenNhaCungCapContainingIgnoreCase(
            String maNhaCungCap, String tenNhaCungCap);

    /**
     * Tìm theo mã, tên, người liên hệ, số điện thoại, email (khớp ô tìm kiếm của trang danh sách);
     * nhà cung cấp mới nhất lên đầu.
     */
    @Query("""
            select n from NhaCungCap n
            where lower(n.maNhaCungCap) like lower(concat('%', :tuKhoa, '%'))
               or lower(n.tenNhaCungCap) like lower(concat('%', :tuKhoa, '%'))
               or lower(coalesce(n.nguoiLienHe, '')) like lower(concat('%', :tuKhoa, '%'))
               or coalesce(n.soDienThoai, '') like concat('%', :tuKhoa, '%')
               or lower(coalesce(n.email, '')) like lower(concat('%', :tuKhoa, '%'))
            order by n.id desc
            """)
    List<NhaCungCap> timKiem(@Param("tuKhoa") String tuKhoa);

    // Kiểm tra trùng mã khi tạo mới
    boolean existsByMaNhaCungCap(String maNhaCungCap);
    long count();
}
