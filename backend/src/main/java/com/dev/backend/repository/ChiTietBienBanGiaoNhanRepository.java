package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietBienBanGiaoNhan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietBienBanGiaoNhanRepository extends JpaRepository<ChiTietBienBanGiaoNhan, Integer> {

    List<ChiTietBienBanGiaoNhan> findByBienBan_IdOrderByIdAsc(Integer bienBanId);
}
