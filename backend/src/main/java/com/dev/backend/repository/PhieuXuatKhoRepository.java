package com.dev.backend.repository;

import com.dev.backend.entities.PhieuXuatKho;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PhieuXuatKhoRepository extends JpaRepository<PhieuXuatKho, Integer>, JpaSpecificationExecutor<PhieuXuatKho> {
    long countBySoPhieuXuatStartingWith(String prefix);
    List<PhieuXuatKho> findByDonBanHangId(Integer donBanHangId);
    boolean existsByDonBanHangIdAndTrangThai(Integer donBanHangId, Integer trangThai);

    boolean existsByDonBanHangIdAndTrangThaiIn(Integer donBanHangId, Collection<Integer> trangThais);

    /** Phiếu của đơn ở một trong các trạng thái cho trước (vd. phiếu đang chờ đóng gói / chờ xuất). */
    List<PhieuXuatKho> findByDonBanHangIdAndTrangThaiInOrderByIdDesc(Integer donBanHangId, Collection<Integer> trangThais);

    /**
     * Khóa dòng phiếu (SELECT ... FOR UPDATE). Phải là câu đọc phiếu ĐẦU TIÊN trong giao dịch: quét đóng gói,
     * hoàn tất đóng gói và hủy đơn từ sàn tuần tự hóa trên dòng này nên không ghi đè lẫn nhau.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PhieuXuatKho p WHERE p.id = :id")
    Optional<PhieuXuatKho> findByIdForUpdate(@Param("id") Integer id);

    /** Một phiếu xuất con của phiếu chuyển kho gốc có trạng thái khác {@code trangThai} (dùng để tìm phiếu chưa hủy). */
    Optional<PhieuXuatKho> findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(Integer phieuChuyenKhoGocId, Integer trangThai);
    Optional<PhieuXuatKho> findBySoPhieuXuat(String soPhieuXuat);
    @Query("""
SELECT COUNT(p)
FROM PhieuXuatKho p
WHERE p.trangThai IN (0, 6)
""")
    Long countPendingExports(); // phiếu chưa xuất: nháp (chờ đóng gói) và chờ xuất (đã đóng gói)
    @Query("""
SELECT COUNT(p)
FROM PhieuXuatKho p
WHERE DATE(p.ngayXuat) = CURRENT_DATE
""")
    Long countExportToday();
    @Query("SELECT p FROM PhieuXuatKho p LEFT JOIN p.donBanHang d " +
            "WHERE (:khoIds IS NULL OR p.kho.id IN :khoIds) " +
            "AND p.loaiXuat IN ('ban_hang', 'chuyen_kho') " +
            "AND (:keyword IS NULL OR LOWER(p.soPhieuXuat) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(d.soDonHang) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "AND (:trangThai IS NULL OR p.trangThai = :trangThai) " +
            "AND (:tenKho IS NULL OR LOWER(p.kho.tenKho) LIKE LOWER(CONCAT('%', :tenKho, '%')))")
    Page<PhieuXuatKho> findDanhSachThucXuat(
            @Param("khoIds") List<Integer> khoIds, // Đổi sang List
            @Param("keyword") String keyword,
            @Param("trangThai") Integer trangThai,
            @Param("tenKho") String tenKho,
            Pageable pageable
    );

    // Đã cập nhật: Chỉ lấy YÊU CẦU CHUYỂN KHO (loai_xuat = 'khac')
    @Query("SELECT p FROM PhieuXuatKho p " +
            "WHERE (:khoId IS NULL OR (p.kho.id = :khoId OR p.khoChuyenDen.id = :khoId)) " +
            "AND p.loaiXuat = 'khac' " +
            "AND (:keyword IS NULL OR LOWER(p.soPhieuXuat) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "AND (:trangThai IS NULL OR p.trangThai = :trangThai) " +
            "AND (:khoNhapTen IS NULL OR LOWER(p.khoChuyenDen.tenKho) LIKE LOWER(CONCAT('%', :khoNhapTen, '%')))")
    Page<PhieuXuatKho> findDanhSachYeuCauChuyenKho(
            @Param("khoId") Integer khoId,
            @Param("keyword") String keyword,
            @Param("trangThai") Integer trangThai,
            @Param("khoNhapTen") String khoNhapTen,
            Pageable pageable
    );
}