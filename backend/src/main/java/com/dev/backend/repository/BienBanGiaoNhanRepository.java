package com.dev.backend.repository;

import com.dev.backend.entities.BienBanGiaoNhan;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BienBanGiaoNhanRepository extends JpaRepository<BienBanGiaoNhan, Integer> {

    /** Mỗi phiếu chuyển tối đa một biên bản (nhận hàng một lần). */
    Optional<BienBanGiaoNhan> findFirstByPhieuChuyenKho_IdOrderByIdDesc(Integer phieuChuyenKhoId);

    /** Khóa dòng biên bản (SELECT ... FOR UPDATE): thêm / xóa ảnh của cùng biên bản chạy lần lượt (đếm tối đa 6 ảnh). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BienBanGiaoNhan b WHERE b.id = :id")
    Optional<BienBanGiaoNhan> khoaTheoId(@Param("id") Integer id);

    /**
     * Phương án xử lý đọc thẳng từ CSDL. Không đọc qua thực thể: open-in-view giữ thực thể đã nạp đầu yêu cầu (trước khi
     * tải ảnh lên MinIO), nên khóa lại dòng vẫn trả giá trị cũ.
     */
    @Query("SELECT b.phuongAnXuLy FROM BienBanGiaoNhan b WHERE b.id = :id")
    String docPhuongAnXuLy(@Param("id") Integer id);

    java.util.List<BienBanGiaoNhan> findByPhieuChuyenKho_IdIn(java.util.Collection<Integer> phieuChuyenKhoIds);

    /** Số đuôi lớn nhất của số biên bản dạng `BBGN-yyyyMMdd-` + chữ số. */
    @Query(value = """
        SELECT MAX(CAST(SUBSTRING(so_bien_ban, CHAR_LENGTH(:tienTo) + 1) AS UNSIGNED))
        FROM bien_ban_giao_nhan
        WHERE so_bien_ban LIKE CONCAT(:tienTo, '%')
          AND SUBSTRING(so_bien_ban, CHAR_LENGTH(:tienTo) + 1) REGEXP '^[0-9]+$'
    """, nativeQuery = true)
    Number soDuoiLonNhat(@Param("tienTo") String tienTo);
}
