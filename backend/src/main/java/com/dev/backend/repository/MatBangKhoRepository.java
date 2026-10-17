package com.dev.backend.repository;

import com.dev.backend.entities.MatBangKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MatBangKhoRepository extends JpaRepository<MatBangKho, Integer> {
    Optional<MatBangKho> findByKho_Id(Integer khoId);
}

