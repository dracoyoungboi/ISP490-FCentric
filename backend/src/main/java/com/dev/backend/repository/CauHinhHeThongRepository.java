package com.dev.backend.repository;

import com.dev.backend.entities.CauHinhHeThong;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CauHinhHeThongRepository extends JpaRepository<CauHinhHeThong, String> {

    // Lấy kèm người cập nhật trong cùng một truy vấn (LEFT JOIN), để mapper đọc nguoiCapNhat.hoTen
    // không phát sinh thêm truy vấn LAZY. Dữ liệu trả về giống findAll().
    @EntityGraph(attributePaths = "nguoiCapNhat")
    @Query("SELECT c FROM CauHinhHeThong c")
    List<CauHinhHeThong> findAllWithNguoiCapNhat();
}
