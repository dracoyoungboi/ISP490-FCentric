package com.dev.backend.repository;

import com.dev.backend.entities.DonBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface DonBanHangRepository
        extends JpaRepository<DonBanHang, Integer>,
        JpaSpecificationExecutor<DonBanHang> {

    @Query("""
        select function('date', d.ngayDatHang), sum(d.tongCong)
        from DonBanHang d
        where d.ngayDatHang >= :fromDate
          and d.loaiChungTu = 'don_ban_hang'
          and d.trangThai != 4
        group by function('date', d.ngayDatHang)
        order by function('date', d.ngayDatHang)
    """)
    List<Object[]> revenueFromDate(@Param("fromDate") Instant fromDate);

    @Query("""
        select count(d)
        from DonBanHang d
        where function('date', d.ngayDatHang) = current_date
          and d.loaiChungTu = 'don_ban_hang'
    """)
    Long countOrdersToday();

    @Query("""
        select coalesce(sum(d.tongCong), 0)
        from DonBanHang d
        where function('date', d.ngayDatHang) = current_date
          and d.loaiChungTu = 'don_ban_hang'
          and d.trangThai != 4
    """)
    Long sumRevenueToday();
    @Query("""
        select count(d)
        from DonBanHang d
        where d.trangThai = 1
          and d.loaiChungTu = 'don_ban_hang'
    """)
    Long countPendingSaleOrders();
    long countBySoDonHangStartingWith(String prefix);

    // Dùng để tìm kiếm khôi phục chứng từ khi Hủy đơn
    java.util.Optional<DonBanHang> findBySoDonHang(String soDonHang);

    List<DonBanHang> findByKhoXuat_IdAndTrangThaiAndDanhSachNhatHangIsNull(Integer khoId, Integer trangThai);

    List<DonBanHang> findByIdInAndKhoXuat_Id(List<Integer> ids, Integer khoId);
}