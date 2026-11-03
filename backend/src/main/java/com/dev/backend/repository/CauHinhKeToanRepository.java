package com.dev.backend.repository;

import com.dev.backend.entities.CauHinhKeToan;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CauHinhKeToanRepository extends JpaRepository<CauHinhKeToan, Integer> {

    /** Khóa dòng cấu hình: hai người tạo lô xuất cùng lúc thì chạy lần lượt (người sau thấy chứng từ đã vào lô trước). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CauHinhKeToan c WHERE c.id = :id")
    Optional<CauHinhKeToan> findByIdForUpdate(@Param("id") Integer id);
}
