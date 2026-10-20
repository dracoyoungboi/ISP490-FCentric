package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietLoiLoHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ChiTietLoiLoHangRepository extends JpaRepository<ChiTietLoiLoHang, Integer> {

    /** Chi tiết lỗi của nhiều lô trong một lần đọc, theo thứ tự ghi. */
    @Query("select c from ChiTietLoiLoHang c where c.loHang.id in :loHangIds order by c.loHang.id asc, c.id asc")
    List<ChiTietLoiLoHang> findByLoHangIds(@Param("loHangIds") Collection<Integer> loHangIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("delete from ChiTietLoiLoHang c where c.loHang.id = :loHangId")
    int deleteByLoHangId(@Param("loHangId") Integer loHangId);
}
