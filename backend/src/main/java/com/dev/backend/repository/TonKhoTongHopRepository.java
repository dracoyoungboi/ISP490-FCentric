package com.dev.backend.repository;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.entities.BienTheSanPham;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public interface TonKhoTongHopRepository extends JpaRepository<BienTheSanPham, Integer> {

    /**
     * Lấy thông tin tồn kho tổng hợp theo từng biến thể sản phẩm và kho.
     * Bao gồm cả những biến thể chưa có dữ liệu tồn kho (số lượng = 0).
     * Chờ xuất (outgoing) = đặt − đã xuất thật của đơn bán đang giữ hàng (ITrangThaiDonBanHang.DANG_GIU_HANG),
     * không tính báo giá; không dùng soLuongDaGiao (chỉ ghi khi giao thành công nên xuất một phần bị trừ hai lần).
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
        (
        COALESCE(
            (
                SELECT SUM(ctdbh.soLuongDat)
                FROM ChiTietDonBanHang ctdbh
                WHERE ctdbh.bienTheSanPham = bt
                  AND ctdbh.donBanHang.khoXuat = k
                  AND ctdbh.donBanHang.loaiChungTu = 'don_ban_hang'
                  AND ctdbh.donBanHang.trangThai IN :trangThaiGiuHang
            ), 0
        )
        - COALESCE(
            (
                SELECT SUM(ctpx.soLuongXuat)
                FROM ChiTietPhieuXuatKho ctpx
                WHERE ctpx.bienTheSanPham = bt
                  AND ctpx.loHang IS NOT NULL
                  AND ctpx.phieuXuatKho.trangThai = 3
                  AND ctpx.phieuXuatKho.donBanHang.khoXuat = k
                  AND ctpx.phieuXuatKho.donBanHang.loaiChungTu = 'don_ban_hang'
                  AND ctpx.phieuXuatKho.donBanHang.trangThai IN :trangThaiGiuHang
            ), 0
        )
        )                                                              AS outgoing,
        (
                COALESCE(SUM(tkl.soLuongTon), 0)
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
                - (
        COALESCE(
            (
                SELECT SUM(ctdbh2.soLuongDat)
                FROM ChiTietDonBanHang ctdbh2
                WHERE ctdbh2.bienTheSanPham = bt
                  AND ctdbh2.donBanHang.khoXuat = k
                  AND ctdbh2.donBanHang.loaiChungTu = 'don_ban_hang'
                  AND ctdbh2.donBanHang.trangThai IN :trangThaiGiuHang
            ), 0
        )
        - COALESCE(
            (
                SELECT SUM(ctpx2.soLuongXuat)
                FROM ChiTietPhieuXuatKho ctpx2
                WHERE ctpx2.bienTheSanPham = bt
                  AND ctpx2.loHang IS NOT NULL
                  AND ctpx2.phieuXuatKho.trangThai = 3
                  AND ctpx2.phieuXuatKho.donBanHang.khoXuat = k
                  AND ctpx2.phieuXuatKho.donBanHang.loaiChungTu = 'don_ban_hang'
                  AND ctpx2.phieuXuatKho.donBanHang.trangThai IN :trangThaiGiuHang
            ), 0
        )
                )
            )                                                              AS freeToUse,
        COALESCE(SUM(tkl.soLuongTon * lh.giaVon), 0)                   AS tongGiaTri,
        COALESCE(SUM(tkl.soLuongKhaDung), 0)                           AS khaDung,
        COUNT(tkl.id)                                                  AS soDongTon,
        k.maKho                                                        AS maKho

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
        k.tenKho,
        k.maKho

    ORDER BY sp.maSanPham ASC, bt.maSku ASC, k.tenKho ASC
    """)
    List<TonKhoProjection> findTonKhoTongHopTheoTrangThai(
            @Param("khoId")   Integer khoId,
            @Param("keyword") String  keyword,
            @Param("trangThaiGiuHang") List<Integer> trangThaiGiuHang
    );

    default List<TonKhoProjection> findTonKhoTongHop(Integer khoId, String keyword) {
        return findTonKhoTongHopTheoTrangThai(khoId, keyword, ITrangThaiDonBanHang.DANG_GIU_HANG);
    }

    /**
     * Tồn khả dụng toàn chuỗi (Free to Use) đẩy lên sàn, không âm:
     *   Σ (tồn − đang giữ) ở các kho bán được (đang hoạt động, không phải Kho Trung Chuyển)
     *   − lượng chờ xuất (đặt − đã xuất thật) của MỌI đơn bán đang giữ hàng (không tính báo giá).
     * "Đang giữ" (so_luong_da_dat) là hàng POS payOS / phiếu xuất chuyển kho đã giữ; đơn bán giữ hàng qua lượng chờ xuất
     * nên không bị trừ hai lần.
     */
    @Query("""
        SELECT bt.id,
               CAST(GREATEST(
                   COALESCE(
                       (SELECT SUM(tkl.soLuongKhaDung)
                        FROM TonKhoTheoLo tkl
                        JOIN tkl.kho k
                        WHERE tkl.loHang.bienTheSanPham = bt
                          AND k.trangThai = 1
                          AND k.maKho <> 'KHO_TRANSIT'), 0
                   )
                   -
                   COALESCE(
                       (SELECT SUM(ctdbh.soLuongDat)
                        FROM ChiTietDonBanHang ctdbh
                        WHERE ctdbh.bienTheSanPham = bt
                          AND ctdbh.donBanHang.loaiChungTu = 'don_ban_hang'
                          AND ctdbh.donBanHang.trangThai IN :trangThaiGiuHang), 0
                   )
                   +
                   COALESCE(
                       (SELECT SUM(ctpx.soLuongXuat)
                        FROM ChiTietPhieuXuatKho ctpx
                        WHERE ctpx.bienTheSanPham = bt
                          AND ctpx.loHang IS NOT NULL
                          AND ctpx.phieuXuatKho.trangThai = 3
                          AND ctpx.phieuXuatKho.donBanHang.loaiChungTu = 'don_ban_hang'
                          AND ctpx.phieuXuatKho.donBanHang.trangThai IN :trangThaiGiuHang), 0
                   ),
                   0
               ) AS BigDecimal)
        FROM BienTheSanPham bt
        WHERE bt.id IN :bienTheIds
    """)
    List<Object[]> sumTongFreeToUseToanChuoi(
            @Param("bienTheIds") List<Integer> bienTheIds,
            @Param("trangThaiGiuHang") List<Integer> trangThaiGiuHang
    );

    /**
     * Hàng phiếu chuyển kho đang giữ chỗ ở các kho bán được, cộng mọi kho nguồn: [biến thể, số lượng]. Cùng công thức
     * ChiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho: phiếu Chờ duyệt / Đã duyệt, trừ phần đã chọn lô trên phiếu
     * xuất con còn nháp (phần đó đã nằm trong so_luong_da_dat của lô). Giữ ĐỦ, không trừ phân bổ của phiếu nhặt chuyển kho
     * đang mở: tồn đẩy sàn không trừ phân bổ phiếu nhặt nên phần đó chỉ được giữ ở đây.
     */
    @Query(value = """
        SELECT ct.bien_the_san_pham_id,
               SUM(GREATEST(ct.so_luong_chuyen - COALESCE((
                   SELECT SUM(c.so_luong_xuat)
                   FROM phieu_xuat_kho px
                   JOIN chi_tiet_phieu_xuat_kho c ON c.phieu_xuat_kho_id = px.id AND c.lo_hang_id IS NOT NULL
                   WHERE px.phieu_chuyen_kho_id = p.id AND px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 0
                     AND c.bien_the_san_pham_id = ct.bien_the_san_pham_id), 0), 0))
        FROM chi_tiet_phieu_chuyen_kho ct
        JOIN phieu_chuyen_kho p ON p.id = ct.phieu_chuyen_kho_id
        JOIN kho k ON k.id = p.kho_xuat_id
        WHERE p.trang_thai IN ('CHO_DUYET', 'DA_DUYET')
          AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
          AND ct.bien_the_san_pham_id IN (:bienTheIds)
        GROUP BY ct.bien_the_san_pham_id
    """, nativeQuery = true)
    List<Object[]> giuChoChuyenKhoToanChuoi(@Param("bienTheIds") List<Integer> bienTheIds);

    /**
     * Tồn khả dụng toàn chuỗi theo đơn bán đang giữ hàng chuẩn, trừ hàng phiếu chuyển kho đang giữ chỗ ở kho nguồn
     * (đặc tả BA, ma trận 3.2), không âm. Giữ tên cũ cho các chỗ đẩy tồn sàn; dòng trả về [biến thể, BigDecimal].
     */
    default List<Object[]> sumTongFreeToUseToanHeThongByBienTheIds(List<Integer> bienTheIds) {
        List<Object[]> ketQua = sumTongFreeToUseToanChuoi(bienTheIds, ITrangThaiDonBanHang.DANG_GIU_HANG);
        if (ketQua.isEmpty()) return ketQua;
        Map<Integer, BigDecimal> giuCho = new HashMap<>();
        for (Object[] row : giuChoChuyenKhoToanChuoi(bienTheIds)) {
            if (row[0] != null && row[1] != null) giuCho.put(((Number) row[0]).intValue(), new BigDecimal(row[1].toString()));
        }
        if (giuCho.isEmpty()) return ketQua;
        List<Object[]> daTru = new ArrayList<>(ketQua.size());
        for (Object[] row : ketQua) {
            BigDecimal tru = row[0] == null ? null : giuCho.get(((Number) row[0]).intValue());
            if (tru == null || row[1] == null) {
                daTru.add(row);
                continue;
            }
            BigDecimal khaDung = row[1] instanceof BigDecimal bd ? bd : new BigDecimal(row[1].toString());
            daTru.add(new Object[]{row[0], khaDung.subtract(tru).max(BigDecimal.ZERO)});
        }
        return daTru;
    }

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