package com.dev.backend.repository;

import com.dev.backend.entities.CanhBao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CanhBaoRepository extends JpaRepository<CanhBao, Integer>, JpaSpecificationExecutor<CanhBao> {
    List<CanhBao> findByKhoIdAndLoaiCanhBaoAndTrangThai(Integer khoId, String loaiCanhBao, Integer trangThai);
}