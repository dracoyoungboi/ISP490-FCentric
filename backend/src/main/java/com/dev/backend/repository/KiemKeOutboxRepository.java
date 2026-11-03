package com.dev.backend.repository;

import com.dev.backend.entities.KiemKeOutbox;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface KiemKeOutboxRepository extends JpaRepository<KiemKeOutbox, Long> {

    /** Sự kiện tới lượt gửi: chờ gửi / lỗi đã tới giờ thử lại, hoặc đang gửi mà lease đã hết (worker trước dừng giữa chừng). */
    @Query("""
        SELECT o.id FROM KiemKeOutbox o
        WHERE ((o.trangThai = 'cho_gui' OR o.trangThai = 'loi') AND o.thuLaiLuc <= :bayGio)
           OR (o.trangThai = 'dang_gui' AND o.leaseDen < :bayGio)
        ORDER BY o.uuTien DESC, o.thuLaiLuc, o.id
    """)
    List<Long> toiLuot(@Param("bayGio") Instant bayGio, Pageable trang);

    /** Giành lease một sự kiện; trả 1 khi giành được (hai worker không gửi trùng). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        UPDATE KiemKeOutbox o SET o.trangThai = 'dang_gui', o.leaseToken = :token, o.leaseDen = :leaseDen
        WHERE o.id = :id AND (((o.trangThai = 'cho_gui' OR o.trangThai = 'loi') AND o.thuLaiLuc <= :bayGio)
                           OR (o.trangThai = 'dang_gui' AND o.leaseDen < :bayGio))
    """)
    int gianhLease(@Param("id") Long id, @Param("token") String token, @Param("leaseDen") Instant leaseDen,
                   @Param("bayGio") Instant bayGio);

    List<KiemKeOutbox> findByDotKiemKeIdOrderById(Integer dotKiemKeId);
}
