package com.dev.backend.repository;

import com.dev.backend.entities.LichSuDongBoMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LichSuDongBoMetricRepository extends JpaRepository<LichSuDongBoMetric, Long> {

    List<LichSuDongBoMetric> findByCreatedAtGreaterThanEqualOrderByCreatedAtAsc(Instant since);

    @Query("""
            SELECT m FROM LichSuDongBoMetric m
            WHERE m.createdAt >= :since
              AND (:channel IS NULL OR UPPER(m.channel) = UPPER(:channel))
            ORDER BY m.createdAt ASC
            """)
    List<LichSuDongBoMetric> findInWindow(@Param("since") Instant since, @Param("channel") String channel);

    @Modifying
    @Query("DELETE FROM LichSuDongBoMetric m WHERE m.createdAt < :cutoff")
    int xoaMetricCuTruoc(@Param("cutoff") Instant cutoff);
}

