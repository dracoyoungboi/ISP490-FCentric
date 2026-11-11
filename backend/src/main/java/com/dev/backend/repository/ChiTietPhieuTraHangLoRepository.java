package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuTraHangLo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietPhieuTraHangLoRepository extends JpaRepository<ChiTietPhieuTraHangLo, Integer> {
    /** Số đã trả theo (biến thể, lô) qua mọi phiếu trả của đơn: [bien_the_san_pham_id, lo_hang_id, tổng số lượng]. */
    @Query("""
        select c.bienTheSanPhamId, l.loHangId, sum(l.soLuong)
          from ChiTietPhieuTraHangLo l, ChiTietPhieuTraHang c, PhieuTraHang p
         where c.id = l.chiTietPhieuTraHangId and p.id = c.phieuTraHangId and p.donBanHangId = :donId
         group by c.bienTheSanPhamId, l.loHangId
    """)
    List<Object[]> daTraTheoLo(@Param("donId") Integer donBanHangId);
}
