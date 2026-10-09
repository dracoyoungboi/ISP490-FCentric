package com.dev.backend.repository;

import com.dev.backend.entities.KhachHang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KhachHangRepository extends JpaRepository<KhachHang, Integer>, JpaSpecificationExecutor<KhachHang> {

    // Kiểm tra trùng từng trường riêng; chỉ gọi với giá trị KHÁC rỗng (null sẽ thành "IS NULL"
    // và khớp mọi khách không có SĐT/email).
    Optional<KhachHang> findFirstBySoDienThoai(String soDienThoai);

    Optional<KhachHang> findFirstByEmail(String email);

    Optional<KhachHang> findFirstBySoDienThoaiAndIdNot(String soDienThoai, Integer id);

    Optional<KhachHang> findFirstByEmailAndIdNot(String email, Integer id);

    boolean existsByMaKhachHang(String maKhachHang);

    /**
     * Tìm khách đang hoạt động cho màn POS theo tên / SĐT / mã (pattern đã escape, dạng %từ khóa%;
     * null = không lọc). Khách lẻ (KHLE) luôn đứng đầu, sau đó khách mới thêm trước.
     */
    @Query(value = """
        select k from KhachHang k
        where k.trangThai = 1
          and (:pattern is null
               or lower(k.tenKhachHang) like :pattern
               or k.soDienThoai like :pattern
               or lower(k.maKhachHang) like :pattern)
        order by case when k.maKhachHang = 'KHLE' then 0 else 1 end, k.id desc
    """, countQuery = """
        select count(k) from KhachHang k
        where k.trangThai = 1
          and (:pattern is null
               or lower(k.tenKhachHang) like :pattern
               or k.soDienThoai like :pattern
               or lower(k.maKhachHang) like :pattern)
    """)
    Page<KhachHang> searchActiveForPos(@Param("pattern") String pattern, Pageable pageable);
}