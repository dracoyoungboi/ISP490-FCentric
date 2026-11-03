package com.dev.backend.repository;

import com.dev.backend.entities.KiemKeLanDem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface KiemKeLanDemRepository extends JpaRepository<KiemKeLanDem, Long> {

    @Query("""
        SELECT l FROM KiemKeLanDem l LEFT JOIN FETCH l.nguoiKiemDem LEFT JOIN FETCH l.nguoiYeuCau
        WHERE l.chiTietKiemKeId IN :dongIds ORDER BY l.chiTietKiemKeId, l.lanKiemDem
    """)
    List<KiemKeLanDem> theoDong(@Param("dongIds") Collection<Integer> dongIds);
}
