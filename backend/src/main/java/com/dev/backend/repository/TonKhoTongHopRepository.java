package com.dev.backend.repository;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.entities.BienTheSanPham;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TonKhoTongHopRepository extends JpaRepository<BienTheSanPham, Integer> {

    /**
     * Lấy thông tin tồn kho tổng hợp theo từng biến thể sản phẩm và kho.
     * Bao gồm cả những biến thể chưa có dữ liệu tồn kho (số lượng = 0).
     * * Điều kiện lọc:
     * - Sản phẩm cha đang hoạt động (trangThai IN (0, 1))
     * - Biến thể đang hoạt động (trangThai = 1)
     */
    @Query("""
    SELECT
        bt.id                                                          AS bienTheId,
        bt.maSku                                                       AS maSku,
        sp.maSanPham                                                   AS maSanPham,
        sp.tenSanPham                                                  AS tenSanPham,
        ms.tenMau                                                      AS tenMau,
        sz.maSize                                                      AS maSize,
        cl.tenChatLieu                                                 AS tenChatLieu,
        sp.mucTonToiThieu                                              AS mucTonToiThieu,
        k.id                                                           AS khoId,
        k.tenKho                                                       AS tenKho,
        COALESCE(SUM(tkl.soLuongTon), 0)                               AS onHand,
        COALESCE(
            (
                SELECT SUM(ctdmh.soLuongDat - ctdmh.soLuongDaNhan)
                FROM ChiTietDonMuaHang ctdmh
                WHERE ctdmh.bienTheSanPham = bt
                  AND ctdmh.donMuaHang.khoNhap = k
                  AND ctdmh.donMuaHang.trangThai IN (3, 5)
                  AND (ctdmh.soLuongDat - ctdmh.soLuongDaNhan) > 0
            ), 0
        )                                                              AS incoming,
        COALESCE(
            (
                SELECT SUM(ctdbh.soLuongDat - ctdbh.soLuongDaGiao)
                FROM ChiTietDonBanHang ctdbh
                WHERE ctdbh.bienTheSanPham = bt
                  AND ctdbh.donBanHang.khoXuat = k
                  AND ctdbh.donBanHang.trangThai IN (1, 2, 3) 
                  AND (ctdbh.soLuongDat - ctdbh.soLuongDaGiao) > 0
            ), 0
        )                                                              AS outgoing,
        (
                COALESCE(SUM(tkl.soLuongTon), 0)\s
                + COALESCE(
                    (
                        SELECT SUM(ctdmh2.soLuongDat - ctdmh2.soLuongDaNhan)
                        FROM ChiTietDonMuaHang ctdmh2
                        WHERE ctdmh2.bienTheSanPham = bt
                          AND ctdmh2.donMuaHang.khoNhap = k
                          AND ctdmh2.donMuaHang.trangThai IN (3, 5)
                          AND (ctdmh2.soLuongDat - ctdmh2.soLuongDaNhan) > 0
                    ), 0
                )
                - COALESCE(
                    (
                        SELECT SUM(ctdbh2.soLuongDat - ctdbh2.soLuongDaGiao)
                        FROM ChiTietDonBanHang ctdbh2
                        WHERE ctdbh2.bienTheSanPham = bt
                          AND ctdbh2.donBanHang.khoXuat = k
                          AND ctdbh2.donBanHang.trangThai IN (1, 2)
                          AND (ctdbh2.soLuongDat - ctdbh2.soLuongDaGiao) > 0
                    ), 0
                )
            )                                                              AS freeToUse,
        COALESCE(SUM(tkl.soLuongTon * lh.giaVon), 0)                   AS tongGiaTri
    
    FROM BienTheSanPham bt
    JOIN bt.sanPham                  sp
    JOIN bt.mauSac                   ms
    JOIN bt.size                     sz
    JOIN bt.chatLieu                 cl
    JOIN sp.danhMuc                  dm
    LEFT JOIN LoHang lh              ON lh.bienTheSanPham = bt
    JOIN Kho k                       ON k.trangThai = 1
    LEFT JOIN TonKhoTheoLo tkl       ON tkl.loHang = lh AND tkl.kho = k
    
    WHERE bt.trangThai = 1
      AND sp.trangThai IN (0, 1)
      AND (:khoId IS NULL OR k.id = :khoId)
      AND (:keyword IS NULL
           OR LOWER(bt.maSku)       LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(sp.tenSanPham)  LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(sp.maSanPham)   LIKE LOWER(CONCAT('%', :keyword, '%'))
      )
    
    GROUP BY
        bt.id,
        bt.maSku,
        sp.maSanPham,
        sp.tenSanPham,
        ms.tenMau,
        sz.maSize,
        cl.tenChatLieu,
        sp.mucTonToiThieu,
        k.id,
        k.tenKho
    
    ORDER BY sp.maSanPham ASC, bt.maSku ASC, k.tenKho ASC
    """)
    List<TonKhoProjection> findTonKhoTongHop(
            @Param("khoId")   Integer khoId,
            @Param("keyword") String  keyword
    );



    /**
     * Overload tiện lợi: lấy tất cả kho, không lọc keyword.
     */
    default List<TonKhoProjection> findTonKhoTongHop() {
        return findTonKhoTongHop(null, null);
    }

    /**
     * Lấy tồn kho của một kho cụ thể.
     */
    default List<TonKhoProjection> findTonKhoByKho(Integer khoId) {
        return findTonKhoTongHop(khoId, null);
    }

    /**
     * Tìm kiếm tồn kho theo từ khoá (SKU / tên sản phẩm) trên tất cả kho.
     */
    default List<TonKhoProjection> searchTonKho(String keyword) {
        return findTonKhoTongHop(null, keyword);
    }

    /**
     * Tìm kiếm tồn kho theo từ khoá trong một kho cụ thể.
     */
    default List<TonKhoProjection> searchTonKhoByKho(Integer khoId, String keyword) {
        return findTonKhoTongHop(khoId, keyword);
    }
}