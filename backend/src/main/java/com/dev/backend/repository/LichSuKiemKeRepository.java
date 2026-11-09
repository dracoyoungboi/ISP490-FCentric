package com.dev.backend.repository;

import com.dev.backend.entities.LichSuKiemKe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LichSuKiemKeRepository extends JpaRepository<LichSuKiemKe, Integer> {

    @Query("SELECT l FROM LichSuKiemKe l LEFT JOIN FETCH l.nguoiThucHien WHERE l.dotKiemKe.id = :dotId ORDER BY l.ngayThucHien DESC, l.id DESC")
    List<LichSuKiemKe> theoDot(@Param("dotId") Integer dotId);

    /** Người làm một hành động của đợt, cũ nhất trước (vd. "Tạo đợt" → người lập đợt). */
    @Query("SELECT l.nguoiThucHien.id FROM LichSuKiemKe l WHERE l.dotKiemKe.id = :dotId AND l.hanhDong = :hanhDong ORDER BY l.id ASC")
    List<Integer> nguoiThucHienTheoHanhDong(@Param("dotId") Integer dotId, @Param("hanhDong") String hanhDong);
}
