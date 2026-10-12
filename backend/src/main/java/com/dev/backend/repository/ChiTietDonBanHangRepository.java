package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietDonBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface ChiTietDonBanHangRepository extends JpaRepository<ChiTietDonBanHang, Integer>, JpaSpecificationExecutor<ChiTietDonBanHang> {
    List<ChiTietDonBanHang> findByDonBanHangId(Integer donBanHangId);

    @Query("""
        SELECT ctdbh.bienTheSanPham.id, ctdbh.donBanHang.khoXuat.id, COALESCE(SUM(ctdbh.soLuongDat - ctdbh.soLuongDaGiao), 0)
        FROM ChiTietDonBanHang ctdbh
        WHERE ctdbh.donBanHang.khoXuat IS NOT NULL
          AND ctdbh.donBanHang.khoXuat.trangThai = 1
          AND ctdbh.donBanHang.trangThai IN (0, 1, 2)
          AND (ctdbh.soLuongDat - ctdbh.soLuongDaGiao) > 0
          AND ctdbh.bienTheSanPham.id IN :bienTheIds
          AND (:currentDonHangId IS NULL OR ctdbh.donBanHang.id != :currentDonHangId)
        GROUP BY ctdbh.bienTheSanPham.id, ctdbh.donBanHang.khoXuat.id
    """)
    List<Object[]> sumOutgoingByKhoAndBienTheIdsExcludingOrder(
            @Param("bienTheIds") List<Integer> bienTheIds,
            @Param("currentDonHangId") Integer currentDonHangId
    );
}