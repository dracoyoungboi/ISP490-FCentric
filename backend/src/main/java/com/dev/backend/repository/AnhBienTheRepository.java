package com.dev.backend.repository;

import com.dev.backend.entities.AnhBienThe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AnhBienTheRepository extends JpaRepository<AnhBienThe, Integer>, JpaSpecificationExecutor<AnhBienThe> {

    /** Ảnh biến thể đang hoạt động cho một trang catalog — 1 query batch, không N+1. */
    @Query("select ab from AnhBienThe ab join fetch ab.tepTin " +
            "where ab.bienThe.id in :bienTheIds and ab.trangThai = 1 " +
            "order by ab.bienThe.id, ab.id")
    List<AnhBienThe> findActiveByBienTheIds(@Param("bienTheIds") Collection<Integer> bienTheIds);
}
