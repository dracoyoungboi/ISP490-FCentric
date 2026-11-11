package com.dev.backend.repository;

import com.dev.backend.entities.YeuCauDuyetTraHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface YeuCauDuyetTraHangRepository extends JpaRepository<YeuCauDuyetTraHang, Integer> {
    List<YeuCauDuyetTraHang> findByDonBanHangIdAndTrangThaiIn(Integer donBanHangId, List<String> trangThai);

    /** Số yêu cầu duyệt của đơn từ một mốc (giới hạn gửi mã: chống dò mã và gửi tràn email quản lý). */
    long countByDonBanHangIdAndNgayTaoAfter(Integer donBanHangId, java.time.Instant tu);
}
