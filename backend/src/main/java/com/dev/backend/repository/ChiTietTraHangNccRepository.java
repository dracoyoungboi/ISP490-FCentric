package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietTraHangNcc;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietTraHangNccRepository extends JpaRepository<ChiTietTraHangNcc, Integer> {
    List<ChiTietTraHangNcc> findByBienBanTraHangNcc_Id(Integer bienBanId);

    @Query("SELECT c FROM ChiTietTraHangNcc c JOIN FETCH c.bienTheSanPham bt JOIN FETCH bt.sanPham WHERE c.bienBanTraHangNcc.id = :bienBanId")
    List<ChiTietTraHangNcc> findDetailByBienBanId(@Param("bienBanId") Integer bienBanId);
}

