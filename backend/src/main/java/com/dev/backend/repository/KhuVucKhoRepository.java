package com.dev.backend.repository;

import com.dev.backend.entities.KhuVucKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KhuVucKhoRepository extends JpaRepository<KhuVucKho, Integer> {
    List<KhuVucKho> findByKho_IdAndTrangThaiOrderByMaKhuVucAsc(Integer khoId, Integer trangThai);
    List<KhuVucKho> findByKho_IdOrderByMaKhuVucAsc(Integer khoId);
    Optional<KhuVucKho> findByKho_IdAndMaKhuVuc(Integer khoId, String maKhuVuc);
    boolean existsByKho_IdAndMaKhuVuc(Integer khoId, String maKhuVuc);
}

