package com.dev.backend.repository.email;

import com.dev.backend.entities.DonMuaHang;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Truy vấn riêng của luồng gửi email cho đơn mua. Gọi từ luồng gửi (không có transaction của nghiệp vụ).
 */
public interface DonMuaHangEmailRepository extends Repository<DonMuaHang, Integer> {

    /**
     * Ghi lúc email Yêu cầu báo giá (E4) gửi được, trong transaction riêng. Câu native giữ nguyên ngay_cap_nhat (cột
     * có ON UPDATE) và không merge cả entity, nên không ghi đè đơn giá nhà cung cấp vừa gửi.
     */
    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query(value = "UPDATE don_mua_hang SET ngay_gui_yeu_cau = :luc, ngay_cap_nhat = ngay_cap_nhat WHERE id = :id",
            nativeQuery = true)
    int ghiNgayGuiYeuCau(@Param("id") Integer id, @Param("luc") Instant luc);

    /** Trạng thái hiện tại (kiểm trước mỗi lần gửi / thử lại: đơn đã đổi trạng thái thì không gửi thư cũ). */
    @Transactional(readOnly = true)
    @Query("select d.trangThai from DonMuaHang d where d.id = :id")
    Optional<Integer> trangThai(@Param("id") Integer id);

    /** Lần báo giá hiện tại (null: chưa báo giá). */
    @Transactional(readOnly = true)
    @Query("select d.ngayBaoGia from DonMuaHang d where d.id = :id")
    Optional<Instant> ngayBaoGia(@Param("id") Integer id);
}
