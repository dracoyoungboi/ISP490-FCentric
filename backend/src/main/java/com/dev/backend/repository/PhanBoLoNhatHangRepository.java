package com.dev.backend.repository;

import com.dev.backend.entities.PhanBoLoNhatHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface PhanBoLoNhatHangRepository extends JpaRepository<PhanBoLoNhatHang, Integer> {

    /** Phân bổ của cả phiếu nhặt, nạp sẵn lô (màn chi tiết phiếu nhặt, hoàn tất nhặt). */
    @Query("""
        SELECT pb FROM PhanBoLoNhatHang pb
        JOIN FETCH pb.loHang
        WHERE pb.chiTietNhatHang.danhSachNhatHang.id = :phieuNhatId
        ORDER BY pb.id
    """)
    List<PhanBoLoNhatHang> findByPhieuNhatId(@Param("phieuNhatId") Integer phieuNhatId);

    @Query("""
        SELECT pb FROM PhanBoLoNhatHang pb
        JOIN FETCH pb.loHang
        WHERE pb.chiTietNhatHang.id = :chiTietId
        ORDER BY pb.id
    """)
    List<PhanBoLoNhatHang> findByChiTietId(@Param("chiTietId") Integer chiTietId);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("DELETE FROM PhanBoLoNhatHang pb WHERE pb.chiTietNhatHang.id = :chiTietId")
    void deleteByChiTietId(@Param("chiTietId") Integer chiTietId);

    /**
     * Lượng đang giữ theo lô bởi phiếu nhặt CÒN MỞ (cho_nhat / dang_nhat) ở một kho, bỏ qua một phiếu nhặt
     * (phiếu đang sửa phân bổ của chính nó). Trả về [loHangId, tổng số lượng].
     */
    @Query("""
        SELECT pb.loHang.id, SUM(pb.soLuong)
        FROM PhanBoLoNhatHang pb
        JOIN pb.chiTietNhatHang ct
        JOIN ct.danhSachNhatHang ds
        WHERE ds.khoXuat.id = :khoId
          AND ds.trangThai IN ('cho_nhat', 'dang_nhat')
          AND pb.loHang.id IN :loHangIds
          AND (:boQuaPhieuNhatId IS NULL OR ds.id <> :boQuaPhieuNhatId)
        GROUP BY pb.loHang.id
    """)
    List<Object[]> sumDangGiuTheoLo(@Param("khoId") Integer khoId,
                                    @Param("loHangIds") Collection<Integer> loHangIds,
                                    @Param("boQuaPhieuNhatId") Integer boQuaPhieuNhatId);
}
