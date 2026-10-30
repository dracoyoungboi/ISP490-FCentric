package com.dev.backend.repository;

import com.dev.backend.entities.PhienDangNhap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PhienDangNhapRepository extends JpaRepository<PhienDangNhap, Integer> {

    // Tra theo mã phiên trong JWT (AuthInterceptor gọi mỗi request khi token có claim "sid")
    Optional<PhienDangNhap> findByPhienId(String phienId);

    // Danh sách phiên còn hiệu lực (chưa thu hồi, chưa hết hạn) của một người, mới hoạt động xếp trước
    List<PhienDangNhap> findByNguoiDungIdAndThuHoiLucIsNullAndHetHanLucAfterOrderByTruyCapCuoiDesc(
            Integer nguoiDungId, Instant moc);

    @Modifying
    @Query("update PhienDangNhap p set p.thuHoiLuc = :luc where p.phienId = :sid and p.thuHoiLuc is null")
    void thuHoiTheoSid(@Param("sid") String sid, @Param("luc") Instant luc);

    @Modifying
    @Query("update PhienDangNhap p set p.thuHoiLuc = :luc "
            + "where p.nguoiDungId = :nguoiDungId and p.phienId <> :truSid and p.thuHoiLuc is null")
    void thuHoiCacPhienKhac(@Param("nguoiDungId") Integer nguoiDungId,
                            @Param("truSid") String truSid,
                            @Param("luc") Instant luc);

    @Modifying
    @Query("update PhienDangNhap p set p.thuHoiLuc = :luc where p.nguoiDungId = :nguoiDungId and p.thuHoiLuc is null")
    void thuHoiTatCa(@Param("nguoiDungId") Integer nguoiDungId, @Param("luc") Instant luc);

    // Thu hồi MỘT phiên nhưng chỉ khi nó thuộc về đúng người này (chặn đăng xuất phiên của người khác). Trả số dòng đổi.
    @Modifying
    @Query("update PhienDangNhap p set p.thuHoiLuc = :luc "
            + "where p.id = :id and p.nguoiDungId = :nguoiDungId and p.thuHoiLuc is null")
    int thuHoiTheoIdCuaNguoiDung(@Param("id") Integer id,
                                 @Param("nguoiDungId") Integer nguoiDungId,
                                 @Param("luc") Instant luc);

    // Cập nhật "hoạt động cuối" (gọi có tiết chế ở AuthInterceptor, không ghi mỗi request)
    @Modifying
    @Query("update PhienDangNhap p set p.truyCapCuoi = :luc where p.phienId = :sid and p.thuHoiLuc is null")
    void chamTruyCap(@Param("sid") String sid, @Param("luc") Instant luc);

    // Gia hạn phiên hiện tại sau khi đổi mật khẩu: khớp hạn với token mới (cùng cập nhật hoạt động cuối)
    @Modifying
    @Query("update PhienDangNhap p set p.truyCapCuoi = :luc, p.hetHanLuc = :hetHan "
            + "where p.phienId = :sid and p.thuHoiLuc is null")
    void giaHan(@Param("sid") String sid, @Param("luc") Instant luc, @Param("hetHan") Instant hetHan);
}
