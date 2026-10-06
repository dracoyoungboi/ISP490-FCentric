package com.dev.backend.repository;

import com.dev.backend.entities.PosPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PosPaymentRepository extends JpaRepository<PosPayment, Long> {
    Optional<PosPayment> findByRequestId(String requestId);
}
