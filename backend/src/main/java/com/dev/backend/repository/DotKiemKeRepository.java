// src/main/java/com/dev/backend/repository/DotKiemKeRepository.java
package com.dev.backend.repository;

import com.dev.backend.entities.DotKiemKe;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DotKiemKeRepository extends JpaRepository<DotKiemKe, Integer> {

    @Query("SELECT d FROM DotKiemKe d LEFT JOIN FETCH d.kho LEFT JOIN FETCH d.nguoiChuTri ORDER BY d.ngayTao DESC")
    List<DotKiemKe> findAllWithDetails();

    @Query("SELECT d FROM DotKiemKe d LEFT JOIN FETCH d.kho WHERE d.kho.id = :khoId ORDER BY d.ngayTao DESC")
    List<DotKiemKe> findByKhoId(@Param("khoId") Integer khoId);

    /** Khóa dòng đợt (SELECT ... FOR UPDATE): hoàn thành kiểm kê cùng lúc chạy tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DotKiemKe d WHERE d.id = :id")
    Optional<DotKiemKe> khoaTheoId(@Param("id") Integer id);
}