package com.dev.backend.repository;

import com.dev.backend.entities.PhieuNhapKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PhieuNhapKhoRepository extends JpaRepository<PhieuNhapKho, Integer>, JpaSpecificationExecutor<PhieuNhapKho> {
    /** Khóa dòng phiếu (SELECT ... FOR UPDATE): xác nhận nhập kho / hủy phiếu cùng lúc chạy tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PhieuNhapKho p WHERE p.id = :id")
    Optional<PhieuNhapKho> khoaTheoId(@Param("id") Integer id);

    /** Một phiếu nhập của phiếu chuyển kho gốc có trạng thái khác {@code trangThai} (dùng để tìm phiếu chưa hủy). */
    Optional<PhieuNhapKho> findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(Integer phieuChuyenKhoGocId, Integer trangThai);

    @Query("SELECT COUNT(p) FROM PhieuNhapKho p WHERE p.soPhieuNhap LIKE :prefix%")
    long countBySoPhieuPrefix(@Param("prefix") String prefix);
    Optional<PhieuNhapKho> findByGhiChuContaining(String ghiChu);
    /** Số phiếu nhập kho (mọi trạng thái) của một nhà cung cấp — dùng khi kiểm tra xóa nhà cung cấp. */
    long countByNhaCungCap_Id(Integer nhaCungCapId);
    @Query("""
SELECT COUNT(p)
FROM PhieuNhapKho p
WHERE p.trangThai = 0
""")
    Long countPendingImports();
    @Query("""
SELECT COUNT(p)
FROM PhieuNhapKho p
WHERE DATE(p.ngayNhap) = CURRENT_DATE
""")
    Long countImportToday();

    /**
     * Phiếu nhập ở trạng thái {@code trangThai} (hoàn tất) mới nhất, cho hộp "In tem theo phiếu nhập":
     * [id, số phiếu, ngày nhập, tên kho, tên nhà cung cấp, số SKU thực nhận, tổng số lượng thực nhận].
     * Số thực nhận lấy ở các dòng có lô còn số (số đạt kiểm đếm đã vào tồn); phiếu không có lô (dữ liệu cũ) ra 0, service tính
     * lại từ dòng dự kiến. {@code khoIds} không được rỗng (truyền [-1]).
     */
    @Query("""
            SELECT p.id, p.soPhieuNhap, p.ngayNhap, k.tenKho, ncc.tenNhaCungCap,
                   COUNT(DISTINCT ct.bienTheSanPham.id), COALESCE(SUM(ct.soLuongNhap), 0)
            FROM PhieuNhapKho p JOIN p.kho k LEFT JOIN p.nhaCungCap ncc
            LEFT JOIN ChiTietPhieuNhapKho ct ON ct.phieuNhapKho = p AND ct.loHang IS NOT NULL AND ct.soLuongNhap > 0
            WHERE p.trangThai = :trangThai AND (:tatCaKho = true OR k.id IN :khoIds)
            GROUP BY p.id, p.soPhieuNhap, p.ngayNhap, k.tenKho, ncc.tenNhaCungCap
            ORDER BY p.ngayNhap DESC, p.id DESC
            """)
    java.util.List<Object[]> phieuDaHoanTatInTem(@Param("trangThai") Integer trangThai,
                                                 @Param("tatCaKho") boolean tatCaKho,
                                                 @Param("khoIds") java.util.Collection<Integer> khoIds,
                                                 org.springframework.data.domain.Pageable pageable);
}