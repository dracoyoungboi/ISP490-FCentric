package com.dev.backend.repository;

import com.dev.backend.entities.KenhBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KenhBanHangRepository
        extends JpaRepository<KenhBanHang, Integer>, JpaSpecificationExecutor<KenhBanHang> {

    Optional<KenhBanHang> findByMaKenh(String maKenh);
}

