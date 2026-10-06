package com.dev.backend.repository;

import com.dev.backend.entities.DanhSachNhatHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DanhSachNhatHangRepository
        extends JpaRepository<DanhSachNhatHang, Integer>, JpaSpecificationExecutor<DanhSachNhatHang> {

    Optional<DanhSachNhatHang> findByMaPickList(String maPickList);

    List<DanhSachNhatHang> findByKhoXuat_Id(Integer khoId);

    @Query("SELECT d.maPickList FROM DanhSachNhatHang d WHERE d.maPickList LIKE :prefix% ORDER BY d.maPickList DESC")
    List<String> findMaPickListByPrefix(@Param("prefix") String prefix);
}

