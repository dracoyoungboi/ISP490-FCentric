package com.dev.backend.repository;

import com.dev.backend.entities.HoaDonDauVao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HoaDonDauVaoRepository extends JpaRepository<HoaDonDauVao, Integer> {

    Optional<HoaDonDauVao> findByPhieuNhapKho_Id(Integer phieuNhapKhoId);
}
