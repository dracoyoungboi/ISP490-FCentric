package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKePhamVi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Tập danh mục (gốc + hậu duệ) chốt lúc bắt đầu đợt theo danh mục (dot_kiem_ke_danh_muc). */
@Repository
public interface DotKiemKeDanhMucRepository extends JpaRepository<DotKiemKePhamVi.DanhMuc, DotKiemKePhamVi.DanhMucId> {

    @Query("SELECT d.danhMucId FROM DotKiemKeDanhMuc d WHERE d.dotKiemKeId = :dotId ORDER BY d.danhMucId")
    List<Integer> idCuaDot(@Param("dotId") Integer dotId);
}
