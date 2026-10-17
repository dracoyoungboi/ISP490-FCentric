package com.dev.backend.repository;

import com.dev.backend.entities.ViTriKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ViTriKhoRepository extends JpaRepository<ViTriKho, Integer> {
    List<ViTriKho> findByKhuVucKho_Kho_IdOrderByMaViTriAsc(Integer khoId);
    List<ViTriKho> findByKho_IdOrderByMaViTriAsc(Integer khoId);
    List<ViTriKho> findByKhuVucKho_IdOrderByMaViTriAsc(Integer khuVucKhoId);
    Optional<ViTriKho> findByKho_IdAndMaViTri(Integer khoId, String maViTri);
    Optional<ViTriKho> findByMaViTri(String maViTri);
    boolean existsByKho_IdAndMaViTri(Integer khoId, String maViTri);
    boolean existsByMaViTri(String maViTri);
    long countByKhuVucKho_Id(Integer khuVucKhoId);

    @Query("SELECT v FROM ViTriKho v WHERE v.kho.id = :khoId AND v.trangThai = 'HOAT_DONG' ORDER BY v.maViTri ASC")
    List<ViTriKho> findActiveByKhoId(@Param("khoId") Integer khoId);
}

