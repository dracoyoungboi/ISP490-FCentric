package com.dev.backend.repository;

import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.entities.BienTheSanPham;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BienTheSanPhamRepository extends JpaRepository<BienTheSanPham, Integer>, JpaSpecificationExecutor<BienTheSanPham> {


    @Query(
            """
                    SELECT btsp FROM BienTheSanPham btsp
                                        WHERE (btsp.sanPham.id = :sanPhamId AND btsp.mauSac.id = :mauSacId AND btsp.size.id = :sizeId)
                                                            OR btsp.maSku = :maSku
                                                                                OR btsp.maVachSku = :maVachSku
                    """
    )
    Optional<BienTheSanPham> checkExist(
            @Param("sanPhamId") Integer sanPhamId,
            @Param("mauSacId") Integer mauSacId,
            @Param("sizeId") Integer sizeId,
            @Param("maSku") String maSku,
            @Param("maVachSku") String maVachSku
    );
    List<BienTheSanPham> findByTrangThai(Integer trangThai);

    /**
     * Catalog POS phân trang: chỉ SKU hoạt động (trangThai=1) thuộc sản phẩm đang bán (trangThai=1),
     * tồn khả dụng SUM(ton - daDat) của ĐÚNG kho truy vấn (LEFT JOIN + GROUP BY — không N+1).
     */
    @Query(value = """
            SELECT new com.dev.backend.dto.response.customize.PosCatalogItemDto(
                bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu,
                bt.giaBan, CAST(COALESCE(SUM(tk.soLuongTon - tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                dm.id, dm.tenDanhMuc)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            JOIN sp.danhMuc dm
            JOIN bt.mauSac ms
            JOIN bt.size s
            JOIN bt.chatLieu cl
            LEFT JOIN TonKhoTheoLo tk ON tk.loHang.bienTheSanPham.id = bt.id AND tk.kho.id = :khoId
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (:q IS NULL OR :q = ''
                   OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(sp.maSanPham) LIKE LOWER(CONCAT('%', :q, '%')))
            GROUP BY bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                     ms.tenMau, ms.maMauHex, s.tenSize, s.thuTuSapXep, cl.tenChatLieu,
                     bt.giaBan, dm.id, dm.tenDanhMuc
            ORDER BY sp.tenSanPham, ms.tenMau, s.thuTuSapXep
            """,
            countQuery = """
            SELECT COUNT(DISTINCT bt.id)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (:q IS NULL OR :q = ''
                   OR LOWER(bt.maSku) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(sp.tenSanPham) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(sp.maSanPham) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<PosCatalogItemDto> findPosCatalog(
            @Param("khoId") Integer khoId,
            @Param("q") String q,
            Pageable pageable
    );

    /**
     * Phím tắt Enter (SKU-only): kết quả đầu tiên của toàn bộ truy vấn (server-side),
     * chỉ khớp mã SKU/mã vạch SKU bắt đầu bằng từ khóa — không khớp theo tên.
     */
    @Query(value = """
            SELECT new com.dev.backend.dto.response.customize.PosCatalogItemDto(
                bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu,
                bt.giaBan, CAST(COALESCE(SUM(tk.soLuongTon - tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                dm.id, dm.tenDanhMuc)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            JOIN sp.danhMuc dm
            JOIN bt.mauSac ms
            JOIN bt.size s
            JOIN bt.chatLieu cl
            LEFT JOIN TonKhoTheoLo tk ON tk.loHang.bienTheSanPham.id = bt.id AND tk.kho.id = :khoId
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (LOWER(bt.maSku) LIKE LOWER(CONCAT(:skuPrefix, '%'))
                   OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT(:skuPrefix, '%')))
            GROUP BY bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                     ms.tenMau, ms.maMauHex, s.tenSize, s.thuTuSapXep, cl.tenChatLieu,
                     bt.giaBan, dm.id, dm.tenDanhMuc
            ORDER BY bt.maSku, bt.id
            """,
            countQuery = """
            SELECT COUNT(DISTINCT bt.id)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (LOWER(bt.maSku) LIKE LOWER(CONCAT(:skuPrefix, '%'))
                   OR LOWER(bt.maVachSku) LIKE LOWER(CONCAT(:skuPrefix, '%')))
            """)
    Page<PosCatalogItemDto> findPosCatalogBySkuPrefix(
            @Param("khoId") Integer khoId,
            @Param("skuPrefix") String skuPrefix,
            Pageable pageable
    );

    /**
     * Quét mã vạch: chỉ khớp CHÍNH XÁC (không phân biệt hoa thường) với maSku/maVachSku.
     * Mã vạch cấp sản phẩm cha không khớp — client không được tự chọn biến thể bất kỳ.
     */
    @Query(value = """
            SELECT new com.dev.backend.dto.response.customize.PosCatalogItemDto(
                bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                ms.tenMau, ms.maMauHex, s.tenSize, cl.tenChatLieu,
                bt.giaBan, CAST(COALESCE(SUM(tk.soLuongTon - tk.soLuongDaDat), CAST(0 AS BIGDECIMAL)) AS BIGDECIMAL),
                dm.id, dm.tenDanhMuc)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            JOIN sp.danhMuc dm
            JOIN bt.mauSac ms
            JOIN bt.size s
            JOIN bt.chatLieu cl
            LEFT JOIN TonKhoTheoLo tk ON tk.loHang.bienTheSanPham.id = bt.id AND tk.kho.id = :khoId
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (LOWER(bt.maSku) = LOWER(:barcode) OR LOWER(bt.maVachSku) = LOWER(:barcode))
            GROUP BY bt.id, sp.id, sp.tenSanPham, bt.maSku, bt.maVachSku,
                     ms.tenMau, ms.maMauHex, s.tenSize, s.thuTuSapXep, cl.tenChatLieu,
                     bt.giaBan, dm.id, dm.tenDanhMuc
            ORDER BY bt.maSku, bt.id
            """,
            countQuery = """
            SELECT COUNT(DISTINCT bt.id)
            FROM BienTheSanPham bt
            JOIN bt.sanPham sp
            WHERE bt.trangThai = 1 AND sp.trangThai = 1
              AND (LOWER(bt.maSku) = LOWER(:barcode) OR LOWER(bt.maVachSku) = LOWER(:barcode))
            """)
    Page<PosCatalogItemDto> findPosCatalogByBarcode(
            @Param("khoId") Integer khoId,
            @Param("barcode") String barcode,
            Pageable pageable
    );
}
