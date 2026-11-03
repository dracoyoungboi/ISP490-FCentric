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
}
