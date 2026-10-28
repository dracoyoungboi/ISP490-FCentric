package com.dev.backend.repository;

import com.dev.backend.entities.PosCheckoutRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PosCheckoutRequestRepository extends JpaRepository<PosCheckoutRequest, Long> {
    Optional<PosCheckoutRequest> findByRequestId(String requestId);

    /** Đơn được tạo bởi một lần thanh toán tại quầy (đơn POS, kể cả khi thiếu dòng sổ thu). */
    boolean existsByDonBanHangId(Integer donBanHangId);
}
