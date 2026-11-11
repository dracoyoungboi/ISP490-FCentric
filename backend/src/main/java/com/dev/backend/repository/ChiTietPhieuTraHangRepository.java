package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuTraHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietPhieuTraHangRepository extends JpaRepository<ChiTietPhieuTraHang, Integer> {
    List<ChiTietPhieuTraHang> findByPhieuTraHangIdOrderByIdAsc(Integer phieuTraHangId);

    /** Số đã trả theo dòng đơn gốc qua mọi phiếu trả của đơn: [chi_tiet_don_ban_hang_id, tổng số lượng]. */
    @Query("""
        select c.chiTietDonBanHangId, sum(c.soLuong) from ChiTietPhieuTraHang c, PhieuTraHang p
         where p.id = c.phieuTraHangId and p.donBanHangId = :donId
         group by c.chiTietDonBanHangId
    """)
    List<Object[]> daTraTheoDong(@Param("donId") Integer donBanHangId);

    /** Tiền đã hoàn theo dòng đơn gốc: [chi_tiet_don_ban_hang_id, tổng thành tiền hoàn]. */
    @Query("""
        select c.chiTietDonBanHangId, sum(c.thanhTienHoan) from ChiTietPhieuTraHang c, PhieuTraHang p
         where p.id = c.phieuTraHangId and p.donBanHangId = :donId
         group by c.chiTietDonBanHangId
    """)
    List<Object[]> daHoanTheoDong(@Param("donId") Integer donBanHangId);
}
