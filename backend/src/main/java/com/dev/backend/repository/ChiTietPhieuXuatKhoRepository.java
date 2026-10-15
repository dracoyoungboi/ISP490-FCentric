package com.dev.backend.repository;

import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.entities.ChiTietPhieuXuatKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ChiTietPhieuXuatKhoRepository extends JpaRepository<ChiTietPhieuXuatKho, Integer>, JpaSpecificationExecutor<ChiTietPhieuXuatKho> {
    List<ChiTietPhieuXuatKho> findByPhieuXuatKhoIdAndLoHangIsNull(Integer phieuXuatKhoId);
    List<ChiTietPhieuXuatKho> findByPhieuXuatKhoIdAndLoHangIsNotNull(Integer phieuXuatKhoId);
    List<ChiTietPhieuXuatKho> findByPhieuXuatKhoIdAndBienTheSanPhamIdAndLoHangIsNotNull(
            Integer phieuXuatKhoId,
            Integer bienTheSanPhamId
    );
    @Query("""
        select coalesce(sum(ct.soLuongXuat), 0)
        from ChiTietPhieuXuatKho ct
        where ct.phieuXuatKho.id = :phieuId
          and ct.bienTheSanPham.id = :bienTheId
          and ct.loHang is not null
    """)
    BigDecimal sumSoLuongDaPick(
            @Param("phieuId") Integer phieuId,
            @Param("bienTheId") Integer bienTheId
    );
    @Query("""
        select new com.dev.backend.dto.response.customize.PickedLotDto(
            ct.loHang.id,
            sum(ct.soLuongXuat)
        )
        from ChiTietPhieuXuatKho ct
        where ct.phieuXuatKho.id = :phieuXuatKhoId
          and ct.bienTheSanPham.id = :bienTheSanPhamId
          and ct.loHang is not null
        group by ct.loHang.id
    """)
    List<PickedLotDto> findPickedLots(
            Integer phieuXuatKhoId,
            Integer bienTheSanPhamId
    );
    @Modifying
    @Query("""
        delete from ChiTietPhieuXuatKho ct
        where ct.phieuXuatKho.id = :phieuXuatKhoId
          and ct.bienTheSanPham.id = :bienTheSanPhamId
          and ct.loHang is not null
    """)
    void deletePickedByPhieuAndBienThe(
            @Param("phieuXuatKhoId") Integer phieuXuatKhoId,
            @Param("bienTheSanPhamId") Integer bienTheSanPhamId
    );
    @Query("""
    SELECT bt.sanPham.id
    FROM ChiTietPhieuXuatKho ct
    JOIN ct.phieuXuatKho px
    JOIN ct.bienTheSanPham bt
    WHERE px.loaiXuat = 'ban_hang'
      AND px.trangThai = 1
    GROUP BY bt.sanPham.id
    ORDER BY SUM(ct.soLuongXuat) DESC
    LIMIT :top
    """)
    List<Integer> findTopSanPham(@Param("top") Integer top);

    /**
     * Số lượng đã xuất thật (dòng lô của phiếu đã xuất) của các đơn bán đang giữ hàng, gom theo (biến thể, kho xuất
     * của đơn). Lượng chờ xuất = đặt − đã xuất; không dùng soLuongDaGiao (chỉ ghi khi giao thành công).
     */
    @Query("""
        SELECT ct.bienTheSanPham.id, d.khoXuat.id, COALESCE(SUM(ct.soLuongXuat), 0)
        FROM ChiTietPhieuXuatKho ct
        JOIN ct.phieuXuatKho p
        JOIN p.donBanHang d
        WHERE ct.loHang IS NOT NULL
          AND p.trangThai = 3
          AND d.khoXuat IS NOT NULL
          AND d.loaiChungTu = 'don_ban_hang'
          AND d.trangThai IN :trangThais
          AND ct.bienTheSanPham.id IN :bienTheIds
          AND (:boQuaDonId IS NULL OR d.id <> :boQuaDonId)
        GROUP BY ct.bienTheSanPham.id, d.khoXuat.id
    """)
    List<Object[]> sumDaXuatDonGiuHangTheoKho(
            @Param("bienTheIds") List<Integer> bienTheIds,
            @Param("boQuaDonId") Integer boQuaDonId,
            @Param("trangThais") List<Integer> trangThais
    );

    @Query("SELECT SUM(ct.soLuongXuat) FROM ChiTietPhieuXuatKho ct " +
            "JOIN ct.phieuXuatKho p " +
            "WHERE p.donBanHang.id = :donBanHangId " +
            "AND ct.bienTheSanPham.id = :bienTheSanPhamId " +
            "AND p.trangThai = 3 " +
            "AND ct.loHang IS NOT NULL")
    BigDecimal sumSoLuongDaXuatThucTe(@Param("donBanHangId") Integer donBanHangId,
                                      @Param("bienTheSanPhamId") Integer bienTheSanPhamId);
}