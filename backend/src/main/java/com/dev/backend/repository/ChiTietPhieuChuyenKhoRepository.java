package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuChuyenKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ChiTietPhieuChuyenKhoRepository extends JpaRepository<ChiTietPhieuChuyenKho, Integer> {

    List<ChiTietPhieuChuyenKho> findByPhieuChuyenKho_IdOrderByIdAsc(Integer phieuChuyenKhoId);

    List<ChiTietPhieuChuyenKho> findByPhieuChuyenKho_IdIn(Collection<Integer> phieuChuyenKhoIds);

    /**
     * Hàng phiếu chuyển đang giữ chỗ ở kho nguồn (BA, ma trận 3.2: giữ chỗ khi tạo, khóa cứng khi duyệt), theo
     * [biến thể, kho nguồn, số lượng]. Phần đã chọn lô trên phiếu xuất con còn nháp đã nằm trong so_luong_da_dat của lô
     * nên được trừ ra, không giữ hai lần. {@code khoId} null = mọi kho; {@code boQua} = phiếu không tính (phiếu đang duyệt).
     * <p>
     * {@code truPhanBoNhat} = true: trừ thêm phân bổ lô của phiếu nhặt CÒN MỞ (cho_nhat / dang_nhat) gắn với PX-CK nháp của
     * phiếu — dùng ở nơi đã trừ phần đó theo lô (LoDangGiuService.dangGiuTheoLo: số bán tại quầy, thanh toán POS), để
     * không trừ hai lần. Nơi không trừ phân bổ phiếu nhặt (tồn đẩy sàn, khả dụng chuyển kho, gợi ý kho đơn bán) dùng
     * false: giữ chỗ đủ.
     * <pre>giữ chỗ = Σ max(0, số chuyển − lô đã ghi trên PX-CK nháp [− phân bổ phiếu nhặt mở của PX-CK])</pre>
     */
    @Query(value = """
        SELECT ct.bien_the_san_pham_id, p.kho_xuat_id,
               SUM(GREATEST(ct.so_luong_chuyen - COALESCE((
                   SELECT SUM(c.so_luong_xuat)
                   FROM phieu_xuat_kho px
                   JOIN chi_tiet_phieu_xuat_kho c ON c.phieu_xuat_kho_id = px.id AND c.lo_hang_id IS NOT NULL
                   WHERE px.phieu_chuyen_kho_id = p.id AND px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 0
                     AND c.bien_the_san_pham_id = ct.bien_the_san_pham_id), 0)
                 - CASE WHEN :truPhanBoNhat THEN COALESCE((
                   SELECT SUM(pb.so_luong)
                   FROM phieu_xuat_kho px2
                   JOIN danh_sach_nhat_hang ds ON ds.phieu_xuat_kho_id = px2.id AND ds.trang_thai IN ('cho_nhat', 'dang_nhat')
                   JOIN chi_tiet_nhat_hang cn ON cn.danh_sach_nhat_hang_id = ds.id
                                              AND cn.bien_the_san_pham_id = ct.bien_the_san_pham_id
                   JOIN phan_bo_lo_nhat_hang pb ON pb.chi_tiet_nhat_hang_id = cn.id
                   WHERE px2.phieu_chuyen_kho_id = p.id AND px2.loai_xuat = 'chuyen_kho' AND px2.trang_thai = 0), 0)
                   ELSE 0 END, 0))
        FROM chi_tiet_phieu_chuyen_kho ct
        JOIN phieu_chuyen_kho p ON p.id = ct.phieu_chuyen_kho_id
        WHERE p.trang_thai IN ('CHO_DUYET', 'DA_DUYET')
          AND ct.bien_the_san_pham_id IN (:ids)
          AND (:khoId IS NULL OR p.kho_xuat_id = :khoId)
          AND (:boQua IS NULL OR p.id <> :boQua)
        GROUP BY ct.bien_the_san_pham_id, p.kho_xuat_id
    """, nativeQuery = true)
    List<Object[]> giuChoTheoBienTheVaKho(@Param("ids") Collection<Integer> ids,
                                          @Param("khoId") Integer khoId,
                                          @Param("boQua") Integer boQua,
                                          @Param("truPhanBoNhat") boolean truPhanBoNhat);

    /** Giữ chỗ đủ (không trừ phân bổ phiếu nhặt): xem {@link #giuChoTheoBienTheVaKho(Collection, Integer, Integer, boolean)}. */
    default List<Object[]> giuChoTheoBienTheVaKho(Collection<Integer> ids, Integer khoId, Integer boQua) {
        return giuChoTheoBienTheVaKho(ids, khoId, boQua, false);
    }

    /**
     * Biến thể nằm trên phiếu chuyển Chờ duyệt / Đã duyệt xuất từ một kho (cùng điều kiện với giuChoTheoBienTheVaKho,
     * không cần danh sách mã). Có thể thừa mã đã chọn lô hết (giữ chỗ thực = 0): chỉ dùng để biết mã nào cần tính lại.
     */
    @Query("""
        SELECT DISTINCT ct.bienTheSanPham.id
        FROM ChiTietPhieuChuyenKho ct
        JOIN ct.phieuChuyenKho p
        WHERE p.khoXuat.id = :khoId
          AND p.trangThai IN ('CHO_DUYET', 'DA_DUYET')
    """)
    List<Integer> bienTheGiuChoTaiKho(@Param("khoId") Integer khoId);

    /** Tổng số lượng chuyển của mỗi phiếu (cột Số lượng ở danh sách). */
    @Query("""
        SELECT ct.phieuChuyenKho.id, SUM(ct.soLuongChuyen)
        FROM ChiTietPhieuChuyenKho ct
        WHERE ct.phieuChuyenKho.id IN :ids
        GROUP BY ct.phieuChuyenKho.id
    """)
    List<Object[]> tongSoLuongTheoPhieu(@Param("ids") Collection<Integer> ids);
}
