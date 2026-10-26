package com.dev.backend.repository;

import com.dev.backend.entities.PosPayosPayment;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PosPayosPaymentRepository extends JpaRepository<PosPayosPayment, Long> {

    Optional<PosPayosPayment> findByOrderCode(Long orderCode);

    /** Khóa dòng giao dịch để webhook, polling và job hết hạn không xử lý chồng nhau. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PosPayosPayment p where p.orderCode = :orderCode")
    Optional<PosPayosPayment> lockByOrderCode(@Param("orderCode") Long orderCode);

    Optional<PosPayosPayment> findFirstByRequestIdAndTrangThaiOrderByIdDesc(String requestId, String trangThai);

    boolean existsByOrderCode(Long orderCode);

    List<PosPayosPayment> findTop50ByTrangThaiAndHetHanLucBeforeOrderByIdAsc(String trangThai, Instant before);

    /**
     * Danh sách cho màn Đối soát chuyển khoản; tham số null = không lọc. Mới nhất trước.
     * chiQuanLyDaXuLy: chỉ giao dịch quản lý đã xử lý (tạo đơn / trả lại tiền).
     */
    @Query("""
        select p from PosPayosPayment p
        where (:trangThai is null or p.trangThai = :trangThai)
          and (:chiQuanLyDaXuLy = false or p.nguoiXuLyId is not null)
          and (:khoId is null or p.khoId = :khoId)
          and (:tu is null or p.ngayTao >= :tu)
          and (:den is null or p.ngayTao < :den)
        order by p.id desc
    """)
    Page<PosPayosPayment> timKiem(@Param("trangThai") String trangThai, @Param("chiQuanLyDaXuLy") boolean chiQuanLyDaXuLy,
                                  @Param("khoId") Integer khoId, @Param("tu") Instant tu, @Param("den") Instant den,
                                  Pageable pageable);

    long countByTrangThai(String trangThai);
}
