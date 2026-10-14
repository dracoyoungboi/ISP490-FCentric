package com.dev.backend.repository;

import com.dev.backend.entities.DonMuaHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DonMuaHangRepository extends JpaRepository<DonMuaHang, Integer>, JpaSpecificationExecutor<DonMuaHang> {
    /** Mã đơn là duy nhất (UNIQUE so_don_mua), so khớp không phân biệt hoa thường theo collation của cột. */
    Optional<DonMuaHang> findBySoDonMua(String soDonMua);

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