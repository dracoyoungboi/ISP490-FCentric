package com.dev.backend.repository;

import com.dev.backend.entities.KiemKeLenh;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KiemKeLenhRepository extends JpaRepository<KiemKeLenh, Long> {

    Optional<KiemKeLenh> findByKhoIdAndIdempotencyKey(Integer khoId, String idempotencyKey);
}
