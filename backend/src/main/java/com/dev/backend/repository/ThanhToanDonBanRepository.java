package com.dev.backend.repository;

import com.dev.backend.entities.ThanhToanDonBan;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ThanhToanDonBanRepository extends JpaRepository<ThanhToanDonBan, Long> {

    List<ThanhToanDonBan> findByDonBanHangIdOrderByIdAsc(Integer donBanHangId);

    /**
     * Phiếu của một đơn, đọc có khóa (FOR SHARE): thấy cả phiếu vừa ghi ở giao dịch khác dù giao dịch này đã đọc từ trước
     * (tính lại trạng thái thanh toán khi hủy / hoàn trả đơn).
     */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from ThanhToanDonBan t where t.donBanHangId = :donId order by t.id")
    List<ThanhToanDonBan> khoaDocTheoDon(@Param("donId") Integer donId);

    /** Số đã thu (thu − hoàn, phiếu còn hiệu lực) của từng đơn: [donBanHangId, số tiền]. */
    @Query("""
        select t.donBanHangId, coalesce(sum(case when t.loai = 'THU' then t.soTien else -t.soTien end), 0)
        from ThanhToanDonBan t
        where t.donBanHangId in :donIds and t.trangThai = 'HIEU_LUC'
        group by t.donBanHangId
    """)
    List<Object[]> daThuTheoDon(@Param("donIds") Collection<Integer> donIds);

    /** Phiếu ghi bằng khóa chống gửi trùng này (gửi lại cùng một lần ghi). */
    Optional<ThanhToanDonBan> findByKhoaChongTrung(String khoaChongTrung);

    /**
     * Phiếu chuyển khoản còn hiệu lực chưa đối chiếu sao kê, cũ trước. khoIds: phạm vi cửa hàng (boQuaKhoIds = mọi cửa
     * hàng).
     */
    @Query("""
        select t from ThanhToanDonBan t
        where t.phuongThuc = 'CHUYEN_KHOAN' and t.trangThai = 'HIEU_LUC' and t.doiChieuLuc is null
          and (:khoId is null or t.khoId = :khoId)
        order by t.thoiDiemThu asc, t.id asc
    """)
    Page<ThanhToanDonBan> choDoiChieu(@Param("khoId") Integer khoId, Pageable pageable);

    /** Đánh dấu đã đối chiếu; điều kiện lặp lại trong câu nên phiếu vừa hủy / đã đánh dấu không bị ghi đè. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update ThanhToanDonBan t set t.doiChieuLuc = :luc, t.nguoiDoiChieuId = :nguoi
        where t.id in :ids and t.phuongThuc = 'CHUYEN_KHOAN' and t.trangThai = 'HIEU_LUC' and t.doiChieuLuc is null
    """)
    int danhDauDoiChieu(@Param("ids") Collection<Long> ids, @Param("luc") Instant luc, @Param("nguoi") Integer nguoi);

    /** Đơn khác đã có phiếu thu chuyển khoản còn hiệu lực mang mã giao dịch này (mã so không phân biệt hoa thường). */
    @Query("""
        select distinct t.donBanHangId from ThanhToanDonBan t
        where lower(t.maThamChieu) = lower(:ma) and t.donBanHangId <> :donId
          and t.loai = 'THU' and t.phuongThuc = 'CHUYEN_KHOAN' and t.trangThai = 'HIEU_LUC'
    """)
    List<Integer> donKhacDaGhiMa(@Param("ma") String ma, @Param("donId") Integer donId, Pageable pageable);
}
