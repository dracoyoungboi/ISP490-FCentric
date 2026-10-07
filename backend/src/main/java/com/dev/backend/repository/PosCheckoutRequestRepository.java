package com.dev.backend.repository;

import com.dev.backend.entities.PosCheckoutRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PosCheckoutRequestRepository extends JpaRepository<PosCheckoutRequest, Long> {
    Optional<PosCheckoutRequest> findByRequestId(String requestId);
}
