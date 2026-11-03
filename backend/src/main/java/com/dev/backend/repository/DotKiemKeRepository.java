// src/main/java/com/dev/backend/repository/DotKiemKeRepository.java
package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKe;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DotKiemKeRepository extends JpaRepository<DotKiemKe, Integer> {

    /** Danh sách đợt (lọc kho / trạng thái / loại khi có), mới nhất trước. */
    @Query("""
        SELECT d FROM DotKiemKe d LEFT JOIN FETCH d.kho LEFT JOIN FETCH d.nguoiChuTri
        WHERE (:khoId IS NULL OR d.kho.id = :khoId)
          AND (:trangThai IS NULL OR d.trangThai = :trangThai)
          AND (:loai IS NULL OR d.loaiKiemKe = :loai)
        ORDER BY d.ngayTao DESC, d.id DESC
    """)
    List<DotKiemKe> timKiem(@Param("khoId") Integer khoId, @Param("trangThai") Byte trangThai,
                            @Param("loai") DotKiemKe.LoaiKiemKe loai);

    /** Khóa dòng đợt (SELECT ... FOR UPDATE): các lệnh trên một đợt chạy tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DotKiemKe d WHERE d.id = :id")
    Optional<DotKiemKe> khoaTheoId(@Param("id") Integer id);

    /** Khóa chia sẻ dòng đợt: lưu số đếm chạy song song nhưng không xen với Trình duyệt / Đếm lại / Duyệt. */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("SELECT d FROM DotKiemKe d WHERE d.id = :id")
    Optional<DotKiemKe> khoaDocTheoId(@Param("id") Integer id);

    /** Số đuôi lớn nhất của mã đợt dạng `KK-yyyyMMdd-` + chữ số. */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(ma_dot_kiem_ke, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM dot_kiem_ke
        WHERE ma_dot_kiem_ke LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(ma_dot_kiem_ke, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);

    /** Số kệ phân biệt đang có ít nhất một khóa (toàn kệ hoặc khóa mịn) ở các đợt 1–2, lọc kho khi có. */
    @Query(value = """
        SELECT COUNT(DISTINCT v.vi_tri_kho_id) FROM dot_kiem_ke_vi_tri v
        JOIN dot_kiem_ke d ON d.id = v.dot_kiem_ke_id
        WHERE v.trang_thai_khoa = 1 AND d.trang_thai IN (1, 2) AND (:khoId IS NULL OR d.kho_id = :khoId)
    """, nativeQuery = true)
    long demKeCoKhoa(@Param("khoId") Integer khoId);
}
