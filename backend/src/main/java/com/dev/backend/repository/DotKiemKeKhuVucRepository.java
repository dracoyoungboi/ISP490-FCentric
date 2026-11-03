package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKePhamVi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Khu vực của đợt theo khu vực (dot_kiem_ke_khu_vuc). */
@Repository
public interface DotKiemKeKhuVucRepository extends JpaRepository<DotKiemKePhamVi.KhuVuc, DotKiemKePhamVi.KhuVucId> {

    @Query("SELECT k.khuVucKhoId FROM DotKiemKeKhuVuc k WHERE k.dotKiemKeId = :dotId ORDER BY k.khuVucKhoId")
    List<Integer> idCuaDot(@Param("dotId") Integer dotId);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("DELETE FROM DotKiemKeKhuVuc k WHERE k.dotKiemKeId = :dotId")
    int xoaCuaDot(@Param("dotId") Integer dotId);
}
