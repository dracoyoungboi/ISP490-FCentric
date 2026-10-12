package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietNhatHang;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChiTietNhatHangRepository
        extends JpaRepository<ChiTietNhatHang, Integer>, JpaSpecificationExecutor<ChiTietNhatHang> {

    List<ChiTietNhatHang> findByDanhSachNhatHang_Id(Integer danhSachNhatHangId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChiTietNhatHang c WHERE c.id = :id")
    Optional<ChiTietNhatHang> findByIdWithLock(@Param("id") Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChiTietNhatHang c WHERE c.danhSachNhatHang.id = :danhSachNhatHangId ORDER BY c.id ASC")
    List<ChiTietNhatHang> findByDanhSachNhatHangIdWithLockOrderByIdAsc(@Param("danhSachNhatHangId") Integer danhSachNhatHangId);
}

