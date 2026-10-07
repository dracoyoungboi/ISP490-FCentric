package com.dev.backend.repository;

import com.dev.backend.entities.KhachHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KhachHangRepository extends JpaRepository<KhachHang, Integer>, JpaSpecificationExecutor<KhachHang> {

    Optional<KhachHang> findByMaKhachHangOrEmailOrSoDienThoai(String maKhachHang, String email, String soDienThoai);

    Optional<KhachHang> findFirstBySoDienThoai(String soDienThoai);

    boolean existsByMaKhachHang(String maKhachHang);
}