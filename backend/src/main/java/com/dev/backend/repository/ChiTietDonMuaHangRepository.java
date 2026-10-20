package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietDonMuaHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import java.util.List;

@Repository
public interface ChiTietDonMuaHangRepository extends JpaRepository<ChiTietDonMuaHang, Integer>, JpaSpecificationExecutor<ChiTietDonMuaHang> {
    /** Khóa các dòng của đơn mua (SELECT ... FOR UPDATE, theo thứ tự id) khi tạo phiếu nhập / nhập kho: số "đã nhận" không bị ghi đè. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChiTietDonMuaHang c WHERE c.donMuaHang.id = :donMuaHangId ORDER BY c.id")
    List<ChiTietDonMuaHang> khoaTheoDonMua(@Param("donMuaHangId") Integer donMuaHangId);

}