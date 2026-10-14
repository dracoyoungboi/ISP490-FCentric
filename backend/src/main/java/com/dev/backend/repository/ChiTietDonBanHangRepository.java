package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietDonBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface ChiTietDonBanHangRepository extends JpaRepository<ChiTietDonBanHang, Integer>, JpaSpecificationExecutor<ChiTietDonBanHang> {
    List<ChiTietDonBanHang> findByDonBanHangId(Integer donBanHangId);

    /**
     * Số lượng ĐẶT của đơn bán đang giữ hàng (chỉ đơn bán, không tính báo giá) gom theo (biến thể, kho xuất).
     * Trừ đi số đã xuất thật ({@code ChiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho}) mới ra lượng chờ xuất.
     */
    @Query("""
        SELECT ctdbh.bienTheSanPham.id, ctdbh.donBanHang.khoXuat.id, COALESCE(SUM(ctdbh.soLuongDat), 0)
        FROM ChiTietDonBanHang ctdbh
        WHERE ctdbh.donBanHang.khoXuat IS NOT NULL
          AND ctdbh.donBanHang.loaiChungTu = 'don_ban_hang'
          AND ctdbh.donBanHang.trangThai IN :trangThais
          AND ctdbh.bienTheSanPham.id IN :bienTheIds
          AND (:boQuaDonId IS NULL OR ctdbh.donBanHang.id <> :boQuaDonId)
        GROUP BY ctdbh.bienTheSanPham.id, ctdbh.donBanHang.khoXuat.id
    """)
    List<Object[]> sumDatDonGiuHangTheoKho(
            @Param("bienTheIds") List<Integer> bienTheIds,
            @Param("boQuaDonId") Integer boQuaDonId,
            @Param("trangThais") List<Integer> trangThais
    );
}