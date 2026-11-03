package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietKiemKe;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChiTietKiemKeRepository extends JpaRepository<ChiTietKiemKe, Integer> {

    List<ChiTietKiemKe> findByDotKiemKeId(Integer dotKiemKeId);

    /** Dòng của đợt nạp sẵn lô, biến thể, sản phẩm, kệ, người đếm (màn kiểm đếm). */
    @Query("""
        SELECT c FROM ChiTietKiemKe c
        LEFT JOIN FETCH c.loHang LEFT JOIN FETCH c.bienTheSanPham bt LEFT JOIN FETCH bt.sanPham
        LEFT JOIN FETCH c.viTriKe LEFT JOIN FETCH c.nguoiKiemDem
        WHERE c.dotKiemKeId = :dotId ORDER BY c.id
    """)
    List<ChiTietKiemKe> dongCuaDot(@Param("dotId") Integer dotId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChiTietKiemKe c WHERE c.id = :id")
    Optional<ChiTietKiemKe> khoaTheoId(@Param("id") Integer id);

    /** Khóa mọi dòng của đợt theo PK tăng dần (Trình duyệt, Đếm lại, Phê duyệt). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChiTietKiemKe c WHERE c.dotKiemKeId = :dotId ORDER BY c.id")
    List<ChiTietKiemKe> khoaTheoDot(@Param("dotId") Integer dotId);

    boolean existsByDotKiemKeIdAndViTriKe_IdAndLoHang_Id(Integer dotKiemKeId, Integer viTriKhoId, Integer loHangId);

    /**
     * Đếm nhanh nhiều đợt một lần: [dotId, tổng, đã đếm, chưa kiểm, cần kiểm lại, lệch, giá trị thiếu (âm), giá trị thừa].
     */
    @Query("""
        SELECT c.dotKiemKeId, COUNT(c),
               SUM(CASE WHEN c.soLuongThucTe IS NOT NULL THEN 1 ELSE 0 END),
               SUM(CASE WHEN c.trangThai = 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN c.trangThai = 2 THEN 1 ELSE 0 END),
               SUM(CASE WHEN c.soLuongThucTe IS NOT NULL AND c.chenhLechSoLuong <> 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN c.soLuongThucTe IS NOT NULL AND c.giaTriChenhLech < 0 THEN c.giaTriChenhLech ELSE 0 END),
               SUM(CASE WHEN c.soLuongThucTe IS NOT NULL AND c.giaTriChenhLech > 0 THEN c.giaTriChenhLech ELSE 0 END)
        FROM ChiTietKiemKe c WHERE c.dotKiemKeId IN :dotIds GROUP BY c.dotKiemKeId
    """)
    List<Object[]> demTheoDot(@Param("dotIds") Collection<Integer> dotIds);
}
