package com.dev.backend.repository;

import com.dev.backend.entities.CauHinhThanhToan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CauHinhThanhToanRepository extends JpaRepository<CauHinhThanhToan, Integer> {
    Optional<CauHinhThanhToan> findByNhaCungCap(String nhaCungCap);
}
