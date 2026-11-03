package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKeViTri;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DotKiemKeViTriRepository extends JpaRepository<DotKiemKeViTri, Integer> {

    @Query("SELECT v FROM DotKiemKeViTri v JOIN FETCH v.viTriKho k LEFT JOIN FETCH k.khuVucKho WHERE v.dotKiemKeId = :dotId ORDER BY k.maViTri")
    List<DotKiemKeViTri> theoDot(@Param("dotId") Integer dotId);

    Optional<DotKiemKeViTri> findByDotKiemKeIdAndViTriKho_Id(Integer dotKiemKeId, Integer viTriKhoId);

    /** Bỏ các kệ đã chọn của nháp (chưa khóa) trước khi lưu lại lựa chọn mới. */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("DELETE FROM DotKiemKeViTri v WHERE v.dotKiemKeId = :dotId AND v.trangThaiKhoa = 0")
    int xoaChuaKhoaCuaDot(@Param("dotId") Integer dotId);

    /**
     * Kệ đang có khóa (đợt 1–2) của một kho, kèm đợt sở hữu: [viTriId, dotId, maDot, trangThaiDot, cheDo]. trang_thai là
     * TINYINT(1) nên phải ép kiểu (driver MySQL trả Boolean cho TINYINT(1) ở truy vấn native).
     */
    @Query(value = """
        SELECT v.vi_tri_kho_id, d.id, d.ma_dot_kiem_ke, CAST(d.trang_thai AS SIGNED), v.che_do_khoa
        FROM dot_kiem_ke_vi_tri v JOIN dot_kiem_ke d ON d.id = v.dot_kiem_ke_id
        WHERE d.kho_id = :khoId AND d.trang_thai IN (1, 2) AND v.trang_thai_khoa = 1
        ORDER BY v.vi_tri_kho_id, d.id
    """, nativeQuery = true)
    List<Object[]> khoaDangCoCuaKho(@Param("khoId") Integer khoId);
}
