package com.dev.backend.repository;

import com.dev.backend.entities.LienKetDatMatKhau;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface LienKetDatMatKhauRepository extends JpaRepository<LienKetDatMatKhau, Integer> {

    Optional<LienKetDatMatKhau> findByMaBam(String maBam);

    // Đọc và khóa dòng (SELECT … FOR UPDATE) để dùng liên kết: request khác cùng mã chờ tới khi giao dịch này xong,
    // rồi đọc dữ liệu mới nhất (đã dùng / đã thay)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from LienKetDatMatKhau l where l.maBam = :maBam")
    Optional<LienKetDatMatKhau> khoaTheoMaBam(@Param("maBam") String maBam);

    // Hủy các liên kết chưa dùng của một người (trước khi tạo liên kết mới, hoặc sau khi đã đặt mật khẩu)
    @Modifying
    @Query("update LienKetDatMatKhau l set l.huyLuc = :luc "
            + "where l.nguoiDungId = :nguoiDungId and l.daDungLuc is null and l.huyLuc is null")
    int huyConMo(@Param("nguoiDungId") Integer nguoiDungId, @Param("luc") Instant luc);
}
