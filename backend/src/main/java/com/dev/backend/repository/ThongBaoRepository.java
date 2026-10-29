package com.dev.backend.repository;

import com.dev.backend.entities.ThongBao;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/** Thông báo trong ứng dụng. Mọi truy vấn đọc / sửa đều lọc theo người nhận: không ai đụng được thông báo của người khác. */
@Repository
public interface ThongBaoRepository extends JpaRepository<ThongBao, Long> {

    /** Trong các người nhận, ai đã có thông báo của sự kiện này (gọi lặp không tạo trùng). */
    @Query("SELECT t.nguoiNhanId FROM ThongBao t WHERE t.khoaSuKien = :khoaSuKien AND t.nguoiNhanId IN :nguoiNhanIds")
    List<Integer> nguoiDaCoSuKien(@Param("khoaSuKien") String khoaSuKien,
                                  @Param("nguoiNhanIds") Collection<Integer> nguoiNhanIds);

    /** Thông báo của một người, mới nhất trước; chiChuaDoc = true thì chỉ thông báo chưa đọc. */
    @Query(value = """
            SELECT t FROM ThongBao t
            WHERE t.nguoiNhanId = :nguoiNhanId AND t.khoaSuKien IS NOT NULL AND (:chiChuaDoc = false OR t.daDoc = false)
            ORDER BY t.ngayTao DESC, t.id DESC
            """,
            countQuery = """
            SELECT COUNT(t) FROM ThongBao t
            WHERE t.nguoiNhanId = :nguoiNhanId AND t.khoaSuKien IS NOT NULL AND (:chiChuaDoc = false OR t.daDoc = false)
            """)
    Page<ThongBao> danhSachCuaNguoi(@Param("nguoiNhanId") Integer nguoiNhanId,
                                    @Param("chiChuaDoc") boolean chiChuaDoc, Pageable pageable);

    @Query("SELECT COUNT(t) FROM ThongBao t WHERE t.nguoiNhanId = :nguoiNhanId AND t.khoaSuKien IS NOT NULL AND t.daDoc = false")
    long demChuaDoc(@Param("nguoiNhanId") Integer nguoiNhanId);

    /** Thông báo có thật, của người này và hiện ở chuông (dòng có sẵn từ trước, khoa_su_kien trống, coi như không có). */
    boolean existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(Long id, Integer nguoiNhanId);

    /** Đánh dấu một thông báo đã đọc, chỉ khi đúng người nhận và chưa đọc; trả số dòng đổi (0 hoặc 1). */
    @Modifying
    @Query("UPDATE ThongBao t SET t.daDoc = true WHERE t.id = :id AND t.nguoiNhanId = :nguoiNhanId AND t.khoaSuKien IS NOT NULL AND t.daDoc = false")
    int danhDauDaDoc(@Param("id") Long id, @Param("nguoiNhanId") Integer nguoiNhanId);

    /** Đánh dấu mọi thông báo chưa đọc của một người đã đọc; trả số dòng đổi. */
    @Modifying
    @Query("UPDATE ThongBao t SET t.daDoc = true WHERE t.nguoiNhanId = :nguoiNhanId AND t.khoaSuKien IS NOT NULL AND t.daDoc = false")
    int danhDauTatCaDaDoc(@Param("nguoiNhanId") Integer nguoiNhanId);
}
