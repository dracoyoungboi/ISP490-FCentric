package com.dev.backend.repository;

import com.dev.backend.entities.BienBanTraHangNcc;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BienBanTraHangNccRepository extends JpaRepository<BienBanTraHangNcc, Integer> {
    Optional<BienBanTraHangNcc> findByPhieuNhapKho_Id(Integer phieuNhapKhoId);

    boolean existsByPhieuNhapKho_Id(Integer phieuNhapKhoId);

    @Query("SELECT b FROM BienBanTraHangNcc b JOIN FETCH b.phieuNhapKho JOIN FETCH b.nhaCungCap WHERE b.phieuNhapKho.id = :phieuNhapKhoId")
    Optional<BienBanTraHangNcc> findDetailByPhieuNhapKhoId(@Param("phieuNhapKhoId") Integer phieuNhapKhoId);

    List<BienBanTraHangNcc> findByNhaCungCap_IdOrderByNgayTaoDesc(Integer nhaCungCapId);
}

