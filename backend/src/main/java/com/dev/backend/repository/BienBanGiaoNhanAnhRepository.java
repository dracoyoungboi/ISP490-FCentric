package com.dev.backend.repository;

import com.dev.backend.entities.BienBanGiaoNhanAnh;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BienBanGiaoNhanAnhRepository extends JpaRepository<BienBanGiaoNhanAnh, Integer> {

    /** Ảnh của một biên bản theo thứ tự thêm, nạp kèm tệp và người chụp trong một câu truy vấn. */
    @Query("""
        SELECT a FROM BienBanGiaoNhanAnh a
        JOIN FETCH a.tepTin
        JOIN FETCH a.nguoiChup
        WHERE a.bienBan.id = :bienBanId
        ORDER BY a.id
    """)
    List<BienBanGiaoNhanAnh> danhSachTheoBienBan(@Param("bienBanId") Integer bienBanId);

    long countByBienBan_Id(Integer bienBanId);
}
