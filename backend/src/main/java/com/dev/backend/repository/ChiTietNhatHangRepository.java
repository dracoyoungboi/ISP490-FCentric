package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietNhatHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChiTietNhatHangRepository
        extends JpaRepository<ChiTietNhatHang, Integer>, JpaSpecificationExecutor<ChiTietNhatHang> {

    List<ChiTietNhatHang> findByDanhSachNhatHang_Id(Integer danhSachNhatHangId);
}

