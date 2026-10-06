package com.dev.backend.repository;

import com.dev.backend.dto.response.customize.LoHangTonKhoDTO;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.dto.response.customize.TonKhoTongHopDTO;
import com.dev.backend.entities.TonKhoTheoLo;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface TonKhoTheoLoRepository extends JpaRepository<TonKhoTheoLo, Integer>, JpaSpecificationExecutor<TonKhoTheoLo> {

    // FIX: Thêm method tìm tất cả lô theo kho (dùng trong PhieuKiemKeService.create)
    List<TonKhoTheoLo> findByKho_Id(Integer khoId);

    // FIX: Thêm method tìm tồn kho theo kho + lô (dùng trong PhieuKiemKeService.complete)
    Optional<TonKhoTheoLo> findByKho_IdAndLoHang_Id(Integer khoId, Integer loHangId);

    // FIX: Thêm method tìm chi tiết kiểm kê theo phiếu (dùng trong ChiTietKiemKeRepository nếu cần)
    // (giữ nguyên các method cũ bên dưới)

    @Query("""
        SELECT tk.loHang.bienTheSanPham.id, COALESCE(SUM(tk.soLuongKhaDung), 0)
        FROM TonKhoTheoLo tk
        WHERE tk.kho.id = :khoId AND tk.loHang.bienTheSanPham.id IN :bienTheIds
        GROUP BY tk.loHang.bienTheSanPham.id
    """)
    List<Object[]> sumSoLuongKhaDungByKhoAndBienTheIds(@Param("khoId") Integer khoId, @Param("bienTheIds") List<Integer> bienTheIds);

    @Query("""
        select count(t)
        from TonKhoTheoLo t
        join t.loHang l
        join l.bienTheSanPham bt
        join bt.sanPham sp
        where t.soLuongKhaDung <= sp.mucTonToiThieu
    """)
    Long countLowStockWarnings();

    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoChiTietDTO(
                    bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                    ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho,
                    CAST(COALESCE(SUM(tk.soLuongTon), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    CAST(COALESCE(SUM(tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    bt.giaVon, bt.giaBan, MAX(tk.ngayNhapGanNhat), MAX(tk.ngayXuatGanNhat)
                )
                FROM BienTheSanPham bt
                INNER JOIN bt.sanPham sp INNER JOIN sp.danhMuc dm INNER JOIN bt.mauSac ms
                INNER JOIN bt.size s INNER JOIN bt.chatLieu cl
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                INNER JOIN tk.kho k
                WHERE k.id = :khoId AND bt.trangThai = 1
                GROUP BY bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                         ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho, bt.giaVon, bt.giaBan
                ORDER BY sp.tenSanPham, ms.tenMau, s.thuTuSapXep
            """)
    List<TonKhoChiTietDTO> findTonKhoChiTietByKho(@Param("khoId") Integer khoId);

    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoChiTietDTO(
                    bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                    ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho,
                    CAST(COALESCE(SUM(tk.soLuongTon), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    CAST(COALESCE(SUM(tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    bt.giaVon, bt.giaBan, MAX(tk.ngayNhapGanNhat), MAX(tk.ngayXuatGanNhat)
                )
                FROM BienTheSanPham bt
                INNER JOIN bt.sanPham sp INNER JOIN sp.danhMuc dm INNER JOIN bt.mauSac ms
                INNER JOIN bt.size s INNER JOIN bt.chatLieu cl
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                INNER JOIN tk.kho k
                WHERE k.id = :khoId AND bt.trangThai = 1
                AND (:danhMucId IS NULL OR dm.id = :danhMucId)
                AND (:searchText IS NULL OR 
                     LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :searchText, '%')) OR
                     LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :searchText, '%')) OR
                     LOWER(sp.maSanPham) LIKE LOWER(CONCAT('%', :searchText, '%')))
                AND (:coTonKho IS NULL OR 
                     (:coTonKho = true AND SUM(tk.soLuongTon) > 0) OR
                     (:coTonKho = false AND SUM(tk.soLuongTon) = 0))
                GROUP BY bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                         ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho, bt.giaVon, bt.giaBan
                ORDER BY sp.tenSanPham, ms.tenMau, s.thuTuSapXep
            """)
    List<TonKhoChiTietDTO> findTonKhoChiTietByKhoWithFilter(
            @Param("khoId") Integer khoId,
            @Param("danhMucId") Integer danhMucId,
            @Param("searchText") String searchText,
            @Param("coTonKho") Boolean coTonKho
    );

    @Query("""
                SELECT new com.dev.backend.dto.response.customize.LoHangTonKhoDTO(
                    lh.id, lh.maLo, lh.ngaySanXuat, ncc.tenNhaCungCap, lh.giaVon,
                    tk.soLuongTon, tk.soLuongDaDat, tk.ngayNhapGanNhat
                )
                FROM LoHang lh
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                LEFT JOIN lh.nhaCungCap ncc
                WHERE lh.bienTheSanPham.id = :bienTheId AND tk.kho.id = :khoId AND tk.soLuongTon > 0
                ORDER BY lh.ngaySanXuat DESC, lh.maLo
            """)
    List<LoHangTonKhoDTO> findLoHangByBienTheAndKho(
            @Param("bienTheId") Integer bienTheId,
            @Param("khoId") Integer khoId
    );

    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoTongHopDTO(
                    sp.tenSanPham, sp.maSanPham, COUNT(DISTINCT bt.id),
                    CAST(COALESCE(SUM(tk.soLuongTon), 0) AS BIGDECIMAL),
                    CAST(COALESCE(SUM(tk.soLuongTon * lh.giaVon), 0) AS BIGDECIMAL),
                    COUNT(DISTINCT lh.id)
                )
                FROM SanPhamQuanAo sp
                INNER JOIN BienTheSanPham bt ON bt.sanPham.id = sp.id
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                WHERE tk.kho.id = :khoId AND bt.trangThai = 1 AND tk.soLuongTon > 0
                GROUP BY sp.id, sp.tenSanPham, sp.maSanPham
                ORDER BY sp.tenSanPham
            """)
    List<TonKhoTongHopDTO> findTonKhoTongHopByKho(@Param("khoId") Integer khoId);

    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoChiTietDTO(
                    bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                    ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho,
                    CAST(COALESCE(SUM(tk.soLuongTon), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    CAST(COALESCE(SUM(tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                    bt.giaVon, bt.giaBan, MAX(tk.ngayNhapGanNhat), MAX(tk.ngayXuatGanNhat)
                )
                FROM BienTheSanPham bt
                INNER JOIN bt.sanPham sp INNER JOIN sp.danhMuc dm INNER JOIN bt.mauSac ms
                INNER JOIN bt.size s INNER JOIN bt.chatLieu cl
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                INNER JOIN tk.kho k
                WHERE k.id = :khoId AND bt.trangThai = 1
                GROUP BY bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                         ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu, k.id, k.tenKho,
                         bt.giaVon, bt.giaBan, sp.mucTonToiThieu
                HAVING COALESCE(SUM(tk.soLuongTon), 0) <= sp.mucTonToiThieu
                ORDER BY COALESCE(SUM(tk.soLuongTon), 0)
            """)
    List<TonKhoChiTietDTO> findTonKhoThapByKho(@Param("khoId") Integer khoId);

    @Query("""
        select t from TonKhoTheoLo t
        where t.kho.id = :khoId
          and t.loHang.bienTheSanPham.id = :bienTheSanPhamId
          and (
            t.soLuongKhaDung > 0
            or exists (
                select 1 from ChiTietPhieuXuatKho ct
                where ct.phieuXuatKho.id = :phieuId
                and ct.loHang.id = t.loHang.id
            )
          )
        order by t.ngayNhapGanNhat asc
    """)
    List<TonKhoTheoLo> findAvailableLots(
            @Param("khoId") Integer khoId,
            @Param("bienTheSanPhamId") Integer bienTheSanPhamId,
            @Param("phieuId") Integer phieuId
    );

    /**
     * Khóa các dòng tồn của kho + các biến thể cần bán (PESSIMISTIC_WRITE),
     * sắp theo PK (t.id) — thứ tự khóa ổn định chung cho MỌI luồng ghi tồn
     * (POS checkout + xuất kho + nhập kho + kiểm kê) để tránh deadlock và
     * lost update. Chỉ dùng trong transaction ghi.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select t from TonKhoTheoLo t
        where t.kho.id = :khoId
          and t.loHang.bienTheSanPham.id in :variantIds
        order by t.id
    """)
    List<TonKhoTheoLo> lockLotsForUpdateByKhoAndVariants(
            @Param("khoId") Integer khoId,
            @Param("variantIds") java.util.Collection<Integer> variantIds
    );

    /**
     * Khóa các dòng tồn theo lô (dùng cho luồng nhập/kiểm kê ghi cùng các dòng này),
     * sắp theo PK (t.id) — cùng thứ tự khóa toàn cục.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select t from TonKhoTheoLo t
        where t.loHang.id in :lotIds
        order by t.id
    """)
    List<TonKhoTheoLo> lockLotsForUpdateByLotIds(
            @Param("lotIds") java.util.Collection<Integer> lotIds
    );

    @Query("""
    SELECT COALESCE(SUM(t.soLuongTon - t.soLuongDaDat), 0)
    FROM TonKhoTheoLo t
    WHERE t.kho.id = :khoId 
    AND t.loHang.bienTheSanPham.id = :bienTheId
""")
    BigDecimal sumSoLuongKhaDungByKhoAndBienThe(
            @Param("khoId") Integer khoId,
            @Param("bienTheId") Integer bienTheId
    );

    /**
     * Lấy danh sách tồn kho chi tiết theo kho
     * Tổng hợp từ tất cả các lô
     */
    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoChiTietDTO(
                    bt.id,
                    bt.maSku,
                    sp.tenSanPham,
                    sp.maSanPham,
                    dm.tenDanhMuc,
                    ms.tenMau,
                    ms.maMauHex,
                    s.tenSize,
                    cl.tenChatLieu,
                    k.id,
                    k.tenKho,
                    CAST(
                                COALESCE(SUM(tk.soLuongTon), CAST(0 AS BIGDECIMAL )) AS BIGDECIMAL
                                            ),
                    CAST(
                                COALESCE(SUM(tk.soLuongDaDat), CAST(0 AS BIGDECIMAL )) AS BIGDECIMAL
                                ),
                    bt.giaVon,
                    bt.giaBan,
                    MAX(tk.ngayNhapGanNhat),
                    MAX(tk.ngayXuatGanNhat)
                )
                FROM BienTheSanPham bt
                INNER JOIN bt.sanPham sp
                INNER JOIN sp.danhMuc dm
                INNER JOIN bt.mauSac ms
                INNER JOIN bt.size s
                INNER JOIN bt.chatLieu cl
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                INNER JOIN tk.kho k
                WHERE bt.id = :bienTheId
                AND bt.trangThai = 1
                GROUP BY bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                         ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu,
                         k.id, k.tenKho, bt.giaVon, bt.giaBan
                ORDER BY sp.tenSanPham, ms.tenMau, s.thuTuSapXep
            """)
    List<TonKhoChiTietDTO> findTonKhoChiTietByBienThe(@Param("bienTheId") Integer bienTheId);


    @Query("""
                SELECT new com.dev.backend.dto.response.customize.TonKhoChiTietDTO(
                    bt.id,
                    bt.maSku,
                    sp.tenSanPham,
                    sp.maSanPham,
                    dm.tenDanhMuc,
                    ms.tenMau,
                    ms.maMauHex,
                    s.tenSize,
                    cl.tenChatLieu,
                    k.id,
                    k.tenKho,
                    CAST(
                                COALESCE(SUM(tk.soLuongTon), CAST(0 AS BIGDECIMAL )) AS BIGDECIMAL
                                            ),
                    CAST(
                                COALESCE(SUM(tk.soLuongDaDat), CAST(0 AS BIGDECIMAL )) AS BIGDECIMAL
                                ),
                    bt.giaVon,
                    bt.giaBan,
                    MAX(tk.ngayNhapGanNhat),
                    MAX(tk.ngayXuatGanNhat)
                )
                FROM BienTheSanPham bt
                INNER JOIN bt.sanPham sp
                INNER JOIN sp.danhMuc dm
                INNER JOIN bt.mauSac ms
                INNER JOIN bt.size s
                INNER JOIN bt.chatLieu cl
                INNER JOIN LoHang lh ON lh.bienTheSanPham.id = bt.id
                INNER JOIN TonKhoTheoLo tk ON tk.loHang.id = lh.id
                INNER JOIN tk.kho k
                WHERE bt.id = :bienTheId
                AND k.id = :khoId
                AND bt.trangThai = 1
                GROUP BY bt.id, bt.maSku, sp.tenSanPham, sp.maSanPham, dm.tenDanhMuc,
                         ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu,
                         k.id, k.tenKho, bt.giaVon, bt.giaBan
                ORDER BY sp.tenSanPham, ms.tenMau, s.thuTuSapXep
            """)
    List<TonKhoChiTietDTO> findTonKhoChiTietByBienTheAndKho(
            @Param("bienTheId") Integer bienTheId,
            @Param("khoId") Integer khoId
    );
}
