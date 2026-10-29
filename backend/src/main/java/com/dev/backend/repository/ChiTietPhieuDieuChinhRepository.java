package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuDieuChinh;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietPhieuDieuChinhRepository extends JpaRepository<ChiTietPhieuDieuChinh, Integer> {

    List<ChiTietPhieuDieuChinh> findByPhieuDieuChinhKho_IdOrderByIdAsc(Integer phieuDieuChinhKhoId);
}
