package com.dev.backend.repository;

import com.dev.backend.entities.DonBanHang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
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

    /**
     * Nạp sẵn các quan hệ To-One (khách hàng, kênh bán, kho xuất) trong 1 câu SQL JOIN duy nhất,
     * bảo toàn tính phân trang ở tầng CSDL (tránh cạm bẫy HHH000104 In-Memory Pagination).
     */
    @Override
    @EntityGraph(attributePaths = {"khachHang", "kenhBanHang", "khoXuat"})
    Page<DonBanHang> findAll(Specification<DonBanHang> spec, Pageable pageable);

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
        where d.trangThai in (1, 2, 7, 8)
          and d.loaiChungTu = 'don_ban_hang'
    """)
    Long countPendingSaleOrders(); // đơn đang xử lý ở kho: chờ nhặt, xuất một phần, chờ đóng gói, chờ xuất kho

    @Query("""
        select count(d)
        from DonBanHang d
        where d.trangThai = 0
          and d.loaiChungTu = 'don_ban_hang'
    """)
    Long countOrdersChoXuLy();

    /** [ngayDatHang, trangThai, tongCong] của đơn bán thuộc kênh, nhận trong [tu, den) — màn Tổng quan kênh */
    @Query("""
        select d.ngayDatHang, d.trangThai, d.tongCong
        from DonBanHang d
        where d.kenhBanHang.id = :kenhId
          and d.loaiChungTu = 'don_ban_hang'
          and d.ngayDatHang >= :tu
          and d.ngayDatHang < :den
    """)
    List<Object[]> layDonKenhTrongKhoang(@Param("kenhId") Integer kenhId, @Param("tu") Instant tu, @Param("den") Instant den);

    /** [trangThai, số đơn] của đơn bán thuộc kênh (mọi thời điểm) — mục Việc cần xử lý */
    @Query("""
        select d.trangThai, count(d)
        from DonBanHang d
        where d.kenhBanHang.id = :kenhId
          and d.loaiChungTu = 'don_ban_hang'
        group by d.trangThai
    """)
    List<Object[]> demDonKenhTheoTrangThai(@Param("kenhId") Integer kenhId);
    long countBySoDonHangStartingWith(String prefix);

    // Dùng để tìm kiếm khôi phục chứng từ khi Hủy đơn
    java.util.Optional<DonBanHang> findBySoDonHang(String soDonHang);
    java.util.Optional<DonBanHang> findByMaDonHangKenh(String maDonHangKenh);

    List<DonBanHang> findByKhoXuat_IdAndTrangThaiAndDanhSachNhatHangIsNull(Integer khoId, Integer trangThai);

    List<DonBanHang> findByIdInAndKhoXuat_Id(List<Integer> ids, Integer khoId);
    List<DonBanHang> findByKhachHangIdOrderByNgayDatHangDesc(Integer khachHangId);
    List<DonBanHang> findByDanhSachNhatHang_Id(Integer danhSachNhatHangId);
}
