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
                l.tongCong, l.tenTep, l.kichThuoc, l.maBam, l.ghiChu, n.hoTen, l.ngayTao, l.trangThai, h.hoTen, l.huyLuc,
                l.lyDoHuy)
            FROM LoXuatKeToan l JOIN l.nguoiTao n LEFT JOIN l.nguoiHuy h
            ORDER BY l.id DESC
            """)
    List<LoXuatKeToanDto> danhSach();

    @Query("""
            SELECT new com.dev.backend.dto.response.ketoan.LoXuatKeToanDto(
                l.id, l.soLo, l.hoSo, l.tuNgay, l.denNgay, l.coTonDauKy, l.soChungTu, l.tongTruocThue, l.tongThue,
                l.tongCong, l.tenTep, l.kichThuoc, l.maBam, l.ghiChu, n.hoTen, l.ngayTao, l.trangThai, h.hoTen, l.huyLuc,
                l.lyDoHuy)
            FROM LoXuatKeToan l JOIN l.nguoiTao n LEFT JOIN l.nguoiHuy h
            WHERE l.id = :id
            """)
    java.util.Optional<LoXuatKeToanDto> tomTat(@Param("id") Integer id);

    /** Ngày "xuất đến hết" muộn nhất của các lô còn hiệu lực (null = chưa có lô). */
    @Query("SELECT MAX(l.denNgay) FROM LoXuatKeToan l WHERE l.trangThai = 'hieu_luc'")
    java.time.LocalDate denNgayMuonNhat();

    /** Lúc tạo lô còn hiệu lực có ngày "xuất đến hết" muộn nhất (null = chưa có lô). Không đọc cột tệp. */
    @Query("""
            SELECT MAX(l.ngayTao) FROM LoXuatKeToan l
            WHERE l.trangThai = 'hieu_luc'
              AND l.denNgay = (SELECT MAX(l2.denNgay) FROM LoXuatKeToan l2 WHERE l2.trangThai = 'hieu_luc')
            """)
    java.time.Instant ngayTaoLoDenMuonNhat();

    /** Lúc tạo lô còn hiệu lực mới nhất (null = chưa có lô). */
    @Query("SELECT MAX(l.ngayTao) FROM LoXuatKeToan l WHERE l.trangThai = 'hieu_luc'")
    java.time.Instant ngayTaoMoiNhat();

    /** Lô còn hiệu lực mới nhất (chỉ lô này được hủy: các lô sau dựa vào chứng từ của lô trước trên AMIS). */
    @Query("SELECT MAX(l.id) FROM LoXuatKeToan l WHERE l.trangThai = 'hieu_luc'")
    Integer idLoHieuLucMoiNhat();

    /** Hủy lô (không nạp cột tệp): chỉ đổi khi lô còn hiệu lực; trả số dòng đã đổi. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE LoXuatKeToan l SET l.trangThai = 'da_huy', l.nguoiHuy = :nguoi, l.huyLuc = :luc, l.lyDoHuy = :lyDo
            WHERE l.id = :id AND l.trangThai = 'hieu_luc'
            """)
    int huy(@Param("id") Integer id, @Param("nguoi") com.dev.backend.entities.NguoiDung nguoi,
            @Param("luc") java.time.Instant luc, @Param("lyDo") String lyDo);

    /** Số đuôi lớn nhất của số lô cùng tiền tố KT-yyyyMMdd- (SoChungTu.tiepTheo). */
    @Query(value = "SELECT MAX(CAST(SUBSTRING(so_lo, LENGTH(:tienTo) + 1) AS UNSIGNED)) FROM lo_xuat_ke_toan WHERE so_lo LIKE CONCAT(:tienTo, '%')",
            nativeQuery = true)
    Long soDuoiLonNhat(@Param("tienTo") String tienTo);
}
