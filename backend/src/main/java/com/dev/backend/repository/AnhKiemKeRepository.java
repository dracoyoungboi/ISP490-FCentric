package com.dev.backend.repository;

import com.dev.backend.entities.AnhKiemKe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AnhKiemKeRepository extends JpaRepository<AnhKiemKe, Integer> {

    @Query("""
        SELECT a FROM AnhKiemKe a JOIN FETCH a.tepTin LEFT JOIN FETCH a.nguoiChup
        WHERE a.chiTietKiemKe.id IN :dongIds ORDER BY a.id
    """)
    List<AnhKiemKe> theoDong(@Param("dongIds") Collection<Integer> dongIds);

    @Query("SELECT a.id FROM AnhKiemKe a WHERE a.chiTietKiemKe.id = :dongId ORDER BY a.id")
    List<Integer> idTheoDong(@Param("dongId") Integer dongId);
}
