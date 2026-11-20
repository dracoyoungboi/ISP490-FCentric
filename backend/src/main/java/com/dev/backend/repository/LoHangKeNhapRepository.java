package com.dev.backend.repository;

import com.dev.backend.entities.LoHangKeNhap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface LoHangKeNhapRepository extends JpaRepository<LoHangKeNhap, Integer> {

    /** Các kệ của những lô xếp nhiều kệ, theo thứ tự đã quét (kệ chính trước). Lô một kệ không có dòng. */
    @Query("""
        select k from LoHangKeNhap k
        join fetch k.viTriKho
        where k.loHang.id in :loIds
        order by k.loHang.id, k.id
    """)
    List<LoHangKeNhap> theoLo(@Param("loIds") Collection<Integer> loIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("delete from LoHangKeNhap k where k.loHang.id = :loId")
    int xoaCuaLo(@Param("loId") Integer loId);
}
