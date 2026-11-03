package com.dev.backend.repository;

import com.dev.backend.entities.PhanBoLoNhatHangViTri;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PhanBoLoNhatHangViTriRepository extends JpaRepository<PhanBoLoNhatHangViTri, Long> {

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("DELETE FROM PhanBoLoNhatHangViTri p WHERE p.phanBoLoNhatHangId = :phanBoId")
    int xoaCuaPhanBo(@Param("phanBoId") Integer phanBoId);
}
