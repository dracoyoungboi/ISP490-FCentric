package com.dev.backend.repository;

import com.dev.backend.entities.KhachHang;
import com.dev.backend.utils.NguonKhachHang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KhachHangRepository extends JpaRepository<KhachHang, Integer>, JpaSpecificationExecutor<KhachHang> {

    // Kiểm tra trùng từng trường riêng; chỉ gọi với giá trị KHÁC rỗng (null sẽ thành "IS NULL"
    // và khớp mọi khách không có SĐT/email).
    Optional<KhachHang> findFirstBySoDienThoai(String soDienThoai);

    Optional<KhachHang> findFirstByEmail(String email);

    Optional<KhachHang> findFirstBySoDienThoaiAndIdNot(String soDienThoai, Integer id);

    Optional<KhachHang> findFirstByEmailAndIdNot(String email, Integer id);

    /**
     * Khách cửa hàng khác (bỏ qua boQuaId, null = không bỏ) có cùng số điện thoại sau khi bỏ dấu cách, chấm, gạch, ngoặc
     * và đổi "+84" về "0" (như TuKhoaTimKiem.boNganCach). Thêm dạng "84912345678" không có dấu cộng (chỉ khi sdt bắt đầu
     * bằng 0: tổng đài 1900… không có dạng 84).
     * Chỉ so với khách cửa hàng (chốt 20/11): khách sàn ẩn khỏi màn Khách hàng, người mua Shopify (số thật) tới cửa hàng
     * được tạo hồ sơ cửa hàng riêng thay vì bị chặn bởi một hồ sơ không thấy ở đâu. Job đồng bộ đơn sàn dùng
     * findFirstBySoDienThoai, không qua hàm này.
     */
    default Optional<KhachHang> timTrungSoDienThoai(String sdt, Integer boQuaId) {
        String dang84 = sdt.startsWith("0") ? "84" + sdt.substring(1) : sdt;
        return timTrungSoDienThoaiHaiDang(sdt, dang84, boQuaId);
    }

    /** Xem timTrungSoDienThoai; dang84 = sdt khi không có dạng 84. */
    @Query(value = """
        select * from khach_hang k
        where (:boQuaId is null or k.id <> :boQuaId)
          and replace(replace(replace(replace(replace(replace(k.so_dien_thoai,
                ' ', ''), '.', ''), '-', ''), '(', ''), ')', ''), '+84', '0')
              in (:sdt, :dang84)
          and """ + NguonKhachHang.DIEU_KIEN_CUA_HANG_SQL + """
        order by k.id
        limit 1
        """, nativeQuery = true)
    Optional<KhachHang> timTrungSoDienThoaiHaiDang(@Param("sdt") String sdt, @Param("dang84") String dang84,
                                                   @Param("boQuaId") Integer boQuaId);

    /** Khách cửa hàng khác (bỏ qua boQuaId, null = không bỏ) có cùng email; như timTrungSoDienThoai. */
    default Optional<KhachHang> timTrungEmail(String email, Integer boQuaId) {
        return timTrungEmailCuaHang(email, boQuaId).stream().findFirst();
    }

    /** Xem timTrungEmail. */
    @Query("select k from KhachHang k where k.email = :email and (:boQuaId is null or k.id <> :boQuaId) and "
            + NguonKhachHang.DIEU_KIEN_CUA_HANG_JPQL + " order by k.id")
    List<KhachHang> timTrungEmailCuaHang(@Param("email") String email, @Param("boQuaId") Integer boQuaId);

    boolean existsByMaKhachHang(String maKhachHang);

    Optional<KhachHang> findByMaKhachHang(String maKhachHang);

    /**
     * Tìm khách cửa hàng đang hoạt động cho màn POS theo tên / SĐT / mã (pattern đã escape, dạng %từ khóa%;
     * null = không lọc). Khách lẻ (KHLE) luôn đứng đầu, sau đó khách mới thêm trước. Khách do đồng bộ đơn sàn tạo
     * không hiện (mỗi đơn Shopee một khách "****").
     */
    @Query(value = """
        select k from KhachHang k
        where k.trangThai = 1
          and """ + NguonKhachHang.DIEU_KIEN_CUA_HANG_JPQL + """
          and (:pattern is null
               or lower(k.tenKhachHang) like :pattern
               or k.soDienThoai like :pattern
               or lower(k.maKhachHang) like :pattern)
        order by case when k.maKhachHang = '""" + KhachHang.MA_KHACH_LE + "' then 0 else 1 end, k.id desc",
            countQuery = """
        select count(k) from KhachHang k
        where k.trangThai = 1
          and """ + NguonKhachHang.DIEU_KIEN_CUA_HANG_JPQL + """
          and (:pattern is null
               or lower(k.tenKhachHang) like :pattern
               or k.soDienThoai like :pattern
               or lower(k.maKhachHang) like :pattern)
    """)
    Page<KhachHang> searchActiveForPos(@Param("pattern") String pattern, Pageable pageable);
}