package com.dev.backend.repository;

import com.dev.backend.entities.YeuCauDuyetTraHangMa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface YeuCauDuyetTraHangMaRepository extends JpaRepository<YeuCauDuyetTraHangMa, Integer> {
    List<YeuCauDuyetTraHangMa> findByYeuCauDuyetTraHangId(Integer yeuCauDuyetTraHangId);
}
