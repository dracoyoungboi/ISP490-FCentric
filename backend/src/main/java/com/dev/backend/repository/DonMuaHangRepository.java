package com.dev.backend.repository;

import com.dev.backend.entities.DonMuaHang;
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
public interface DonMuaHangRepository extends JpaRepository<DonMuaHang, Integer>, JpaSpecificationExecutor<DonMuaHang> {
    /** Mã đơn là duy nhất (UNIQUE so_don_mua), so khớp không phân biệt hoa thường theo collation của cột. */
    Optional<DonMuaHang> findBySoDonMua(String soDonMua);

    /**
     * Đọc đơn mua và khóa dòng (SELECT ... FOR UPDATE) tới hết giao dịch: chốt báo giá (chấp nhận / không chấp nhận)
     * không cho hai lần bấm cùng lúc cùng đọc thấy trạng thái chờ duyệt (tránh chốt trùng, gửi hai email).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DonMuaHang d WHERE d.id = :id")
    Optional<DonMuaHang> findByIdForUpdate(@Param("id") Integer id);

    /**
     * Chỉ lấy id yêu cầu nhập hàng của đơn, chưa nạp đơn (bước đầu của thứ tự khóa yêu cầu -> đơn).
     * Rỗng: không có đơn. 0: đơn cũ không thuộc yêu cầu nào (cột NULL). Đơn trỏ tới yêu cầu không còn (không có
     * khóa ngoại) có thể ra 0 hoặc id cũ tùy cách Hibernate dựng câu: nơi gọi luôn xử lý find có khóa trả null.
     * LEFT JOIN: entity khai optional = false nhưng cột cho NULL, đường dẫn d.yeuCauMuaHang.id sẽ là inner join.
     */
    @Query("select coalesce(y.id, 0) from DonMuaHang d left join d.yeuCauMuaHang y where d.id = :id")
    Optional<Integer> layIdYeuCau(@Param("id") Integer id);

    /**
     * Khóa mọi đơn mua cùng một yêu cầu theo id tăng dần (SELECT … FOR UPDATE, dùng index idx_dmh_yeu_cau).
     * Thứ tự khóa cố định của luồng mua hàng: yêu cầu trước, rồi các đơn theo id, nên không vòng chờ.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DonMuaHang d where d.yeuCauMuaHang.id = :yeuCauId order by d.id")
    List<DonMuaHang> khoaTheoYeuCau(@Param("yeuCauId") Integer yeuCauId);

    /** Số đơn mua hàng / yêu cầu báo giá (mọi trạng thái) của một nhà cung cấp — dùng khi kiểm tra xóa nhà cung cấp. */
    long countByNhaCungCap_Id(Integer nhaCungCapId);

    @Query("""
    select count(d)
    from DonMuaHang d
    where d.trangThai = 0
""")
    Long countPendingPurchaseOrders();

    @Query("""
    select count(d)
    from DonMuaHang d
    where DATE(d.ngayTao) = CURRENT_DATE
    """)
    Long countPurchaseToday();
}