package com.dev.backend.repository;

import com.dev.backend.dto.response.ketoan.LoXuatKeToanDto;
import com.dev.backend.entities.LoXuatKeToan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoXuatKeToanRepository extends JpaRepository<LoXuatKeToan, Integer> {

    /** Danh sách lô, mới nhất trước — chọn cột, không kéo cột tệp (longblob). */
    @Query("""
            SELECT new com.dev.backend.dto.response.ketoan.LoXuatKeToanDto(
                l.id, l.soLo, l.hoSo, l.tuNgay, l.denNgay, l.coTonDauKy, l.soChungTu, l.tongTruocThue, l.tongThue,
                l.tongCong, l.tenTep, l.kichThuoc, l.maBam, l.ghiChu, n.hoTen, l.ngayTao)
            FROM LoXuatKeToan l JOIN l.nguoiTao n
            ORDER BY l.id DESC
            """)
    List<LoXuatKeToanDto> danhSach();

    @Query("""
            SELECT new com.dev.backend.dto.response.ketoan.LoXuatKeToanDto(
                l.id, l.soLo, l.hoSo, l.tuNgay, l.denNgay, l.coTonDauKy, l.soChungTu, l.tongTruocThue, l.tongThue,
                l.tongCong, l.tenTep, l.kichThuoc, l.maBam, l.ghiChu, n.hoTen, l.ngayTao)
            FROM LoXuatKeToan l JOIN l.nguoiTao n
            WHERE l.id = :id
            """)
    java.util.Optional<LoXuatKeToanDto> tomTat(@Param("id") Integer id);

    /** Ngày "xuất đến hết" muộn nhất của các lô đã tạo (null = chưa có lô). */
    @Query("SELECT MAX(l.denNgay) FROM LoXuatKeToan l")
    java.time.LocalDate denNgayMuonNhat();

    /** Lúc tạo lô có ngày "xuất đến hết" muộn nhất (null = chưa có lô). Không đọc cột tệp. */
    @Query("SELECT MAX(l.ngayTao) FROM LoXuatKeToan l WHERE l.denNgay = (SELECT MAX(l2.denNgay) FROM LoXuatKeToan l2)")
    java.time.Instant ngayTaoLoDenMuonNhat();

    /** Số đuôi lớn nhất của số lô cùng tiền tố KT-yyyyMMdd- (SoChungTu.tiepTheo). */
    @Query(value = "SELECT MAX(CAST(SUBSTRING(so_lo, LENGTH(:tienTo) + 1) AS UNSIGNED)) FROM lo_xuat_ke_toan WHERE so_lo LIKE CONCAT(:tienTo, '%')",
            nativeQuery = true)
    Long soDuoiLonNhat(@Param("tienTo") String tienTo);
}
