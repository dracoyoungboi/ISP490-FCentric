package com.dev.backend.repository;

import com.dev.backend.entities.LichSuGiaoDichKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LichSuGiaoDichKhoRepository extends JpaRepository<LichSuGiaoDichKho, Integer> {

    // ── Admin: lấy tất cả ─────────────────────────────────────────────────────
    @Query("""
        SELECT ls FROM LichSuGiaoDichKho ls
        LEFT JOIN FETCH ls.bienTheSanPham bts
        LEFT JOIN FETCH bts.sanPham
        LEFT JOIN FETCH ls.loHang
        LEFT JOIN FETCH ls.kho
        LEFT JOIN FETCH ls.khoChuyenDen
        LEFT JOIN FETCH ls.nguoiDung
        ORDER BY ls.ngayGiaoDich DESC
        """)
    List<LichSuGiaoDichKho> findAllWithDetails();

    // ── Quản lý kho: lấy theo kho được phân quyền (phan_quyen_nguoi_dung_kho, trangThai=1) ──
    @Query("""
        SELECT ls FROM LichSuGiaoDichKho ls
        LEFT JOIN FETCH ls.bienTheSanPham bts
        LEFT JOIN FETCH bts.sanPham
        LEFT JOIN FETCH ls.loHang
        LEFT JOIN FETCH ls.kho k
        LEFT JOIN FETCH ls.khoChuyenDen
        LEFT JOIN FETCH ls.nguoiDung
        WHERE k.id IN (
            SELECT pq.kho.id FROM PhanQuyenNguoiDungKho pq
            WHERE pq.nguoiDung.id = :nguoiDungId
            AND pq.trangThai = 1
        )
        ORDER BY ls.ngayGiaoDich DESC
        """)
    List<LichSuGiaoDichKho> findAllByQuanLyId(@Param("nguoiDungId") Integer nguoiDungId);

    // ── Nhân viên kho: lấy theo kho được phân công (phan_quyen_nguoi_dung_kho, trangThai=1) ──
    @Query("""
        SELECT ls FROM LichSuGiaoDichKho ls
        LEFT JOIN FETCH ls.bienTheSanPham bts
        LEFT JOIN FETCH bts.sanPham
        LEFT JOIN FETCH ls.loHang
        LEFT JOIN FETCH ls.kho k
        LEFT JOIN FETCH ls.khoChuyenDen
        LEFT JOIN FETCH ls.nguoiDung
        WHERE k.id IN (
            SELECT pq.kho.id FROM PhanQuyenNguoiDungKho pq
            WHERE pq.nguoiDung.id = :nguoiDungId
            AND pq.trangThai = 1
        )
        ORDER BY ls.ngayGiaoDich DESC
        """)
    List<LichSuGiaoDichKho> findAllByNhanVienId(@Param("nguoiDungId") Integer nguoiDungId);

    // ── Chi tiết theo id ───────────────────────────────────────────────────────
    @Query("""
        SELECT ls FROM LichSuGiaoDichKho ls
        LEFT JOIN FETCH ls.bienTheSanPham bts
        LEFT JOIN FETCH bts.sanPham
        LEFT JOIN FETCH ls.loHang
        LEFT JOIN FETCH ls.kho
        LEFT JOIN FETCH ls.khoChuyenDen
        LEFT JOIN FETCH ls.nguoiDung
        WHERE ls.id = :id
        """)
    Optional<LichSuGiaoDichKho> findByIdWithDetails(@Param("id") Integer id);

    @Query("""
        SELECT k.tenKho FROM LichSuGiaoDichKho ls JOIN ls.kho k
        WHERE ls.idThamChieu = :idPhieuNhap
        AND ls.loaiThamChieu = 'phieu_nhap_kho'
        AND ls.loaiGiaoDich = 'chuyen_kho'
        """)
    List<String> findTenKhoNguonByPhieuNhap(@Param("idPhieuNhap") Integer idPhieuNhap);

    /** Dòng sổ kho của một chứng từ (VD phiếu điều chỉnh kho), theo thứ tự ghi. */
    List<LichSuGiaoDichKho> findByLoaiThamChieuAndIdThamChieuOrderByIdAsc(String loaiThamChieu, Integer idThamChieu);
}
