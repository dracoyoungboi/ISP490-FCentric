package com.dev.backend.repository;

import com.dev.backend.entities.DanhSachNhatHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DanhSachNhatHangRepository
        extends JpaRepository<DanhSachNhatHang, Integer>, JpaSpecificationExecutor<DanhSachNhatHang> {

    Optional<DanhSachNhatHang> findByMaPickList(String maPickList);

    List<DanhSachNhatHang> findByKhoXuat_Id(Integer khoId);

    boolean existsByMaPickList(String maPickList);

    /**
     * Số đuôi lớn nhất của mã dạng `tienTo + chữ số` (PL-20261028- + 7), so theo số chứ không theo chuỗi (PL-…-1000 đứng
     * sau PL-…-999). Câu đọc KHÔNG khóa: khóa dãy mã của ngày (FOR UPDATE) giữ khóa các dòng phiếu nhặt trong ngày (và
     * khoảng trống khi ngày chưa có phiếu) tới hết giao dịch, trước khi khóa tồn — ngược thứ tự với Hoàn tất nhặt (khóa
     * tồn rồi ghi phiếu nhặt) nên kẹt chéo. Hai giao dịch cùng lấy một số thì khóa duy nhất uk_ma_pick_list chặn giao
     * dịch sau (NhatHangServiceImpl báo 409 "thử lại"). Chưa có mã nào thì null.
     */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(ma_pick_list, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM danh_sach_nhat_hang
        WHERE ma_pick_list LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(ma_pick_list, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);

    /** Phiếu nhặt của một phiếu xuất PX-CK (nhiều nhất một: phieu_xuat_kho_id là khóa duy nhất). */
    Optional<DanhSachNhatHang> findByPhieuXuatKho_Id(Integer phieuXuatKhoId);
}

