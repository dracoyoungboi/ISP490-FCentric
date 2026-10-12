package com.dev.backend.repository;

import com.dev.backend.entities.Kho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KhoRepository extends JpaRepository<Kho, Integer>, JpaSpecificationExecutor<Kho> {

    Optional<Kho> findByMaKho(String maKho);

    List<Kho> findByTrangThai(Integer trangThai);
}