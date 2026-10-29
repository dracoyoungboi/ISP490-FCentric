package com.dev.backend.repository;

import com.dev.backend.entities.CanhBao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface CanhBaoRepository extends JpaRepository<CanhBao, Integer>, JpaSpecificationExecutor<CanhBao> {
    List<CanhBao> findByKhoIdAndLoaiCanhBaoAndTrangThai(Integer khoId, String loaiCanhBao, Integer trangThai);

    /**
     * Đánh dấu lệnh hoàn kệ đã cất kệ (trang_thai 0 → 1) trong một câu, chỉ khi lệnh còn chờ. Trả số dòng đổi: 0 = lệnh đã
     * được xác nhận (lần bấm thứ hai, hoặc hai người bấm cùng lúc: bên sau chờ khóa dòng rồi không còn khớp điều kiện).
     * Không qua save(): cột trang_thai map @Generated(INSERT) nên Hibernate không ghi cột này khi UPDATE.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "UPDATE canh_bao SET trang_thai = 1, ngay_xu_ly = :ngay, nguoi_xu_ly_id = :nguoiId "
            + "WHERE id = :id AND loai_canh_bao = 'HOAN_KE_CHO_CAT' AND trang_thai = 0", nativeQuery = true)
    int danhDauDaCatKe(@Param("id") Integer id, @Param("ngay") Instant ngay, @Param("nguoiId") Integer nguoiId);
}