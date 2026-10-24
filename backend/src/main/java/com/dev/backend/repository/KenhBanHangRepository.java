package com.dev.backend.repository;

import com.dev.backend.entities.KenhBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface KenhBanHangRepository
        extends JpaRepository<KenhBanHang, Integer>, JpaSpecificationExecutor<KenhBanHang> {

    Optional<KenhBanHang> findByMaKenh(String maKenh);

    java.util.List<KenhBanHang> findByTrangThai(Integer trangThai);

    /** Các cột khóa của một kênh, đọc thẳng từ CSDL (không qua entity đã nạp trong phiên). */
    interface KhoaKenh {
        Integer getId();

        String getApiUrl();

        String getApiKey();

        String getApiSecret();

        String getClientId();

        String getRefreshToken();

        Instant getTokenExpiresAt();
    }

    /**
     * Khóa đang lưu của kênh. Truy vấn chọn cột nên luôn đọc giá trị mới nhất trong CSDL: entity đã nạp từ đầu
     * giao dịch (hoặc từ đầu một đợt Đồng bộ ngay) có thể vẫn giữ khóa vừa bị ngắt kết nối xóa.
     */
    @Query("""
        SELECT k.id AS id, k.apiUrl AS apiUrl, k.apiKey AS apiKey, k.apiSecret AS apiSecret,
               k.clientId AS clientId, k.refreshToken AS refreshToken, k.tokenExpiresAt AS tokenExpiresAt
        FROM KenhBanHang k WHERE k.maKenh = :maKenh
    """)
    Optional<KhoaKenh> docKhoaTheoMaKenh(@Param("maKenh") String maKenh);

    /**
     * Ghi khóa mới sau khi làm mới OAuth, chỉ khi khóa làm mới trong CSDL vẫn là khóa đã dùng để xin.
     * Trả 0 khi kênh vừa bị ngắt kết nối hoặc vừa đổi khóa: kết quả làm mới phải bỏ, không ghi khóa trở lại.
     * Không xóa phiên JPA của nơi gọi (thường đang giữ entity khác); khóa luôn được đọc lại bằng {@link #docKhoaTheoMaKenh}.
     */
    @Transactional
    @Modifying
    @Query("""
        UPDATE KenhBanHang k SET k.apiKey = :apiKey, k.refreshToken = :refreshToken, k.tokenExpiresAt = :hetHan
        WHERE k.id = :id AND k.refreshToken = :refreshTokenCu
    """)
    int ghiKhoaSauLamMoi(@Param("id") Integer id,
                         @Param("apiKey") String apiKey,
                         @Param("refreshToken") String refreshToken,
                         @Param("hetHan") Instant hetHan,
                         @Param("refreshTokenCu") String refreshTokenCu);

    /** Ngắt kết nối: xóa mọi khóa, đặt trạng thái 0 (job lấy đơn, đẩy tồn bỏ qua kênh); giữ tên miền (api_url). */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        UPDATE KenhBanHang k SET k.apiKey = NULL, k.apiSecret = NULL, k.clientId = NULL, k.refreshToken = NULL,
               k.tokenExpiresAt = NULL, k.trangThai = 0
        WHERE k.id = :id
    """)
    int xoaKhoaVaNgatKetNoi(@Param("id") Integer id);
}

