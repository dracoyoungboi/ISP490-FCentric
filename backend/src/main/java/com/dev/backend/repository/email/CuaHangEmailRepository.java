package com.dev.backend.repository.email;

import com.dev.backend.entities.ThongTinCongTy;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Đọc Thông tin cửa hàng cho email, nạp luôn tệp logo (tep_tin LAZY) để dựng được ở luồng gửi email không có
 * transaction. Chỉ đọc; sửa hồ sơ đi qua ThongTinCongTyRepository / ThongTinCongTyService.
 */
public interface CuaHangEmailRepository extends Repository<ThongTinCongTy, Integer> {

    @Transactional(readOnly = true)
    @Query("select t from ThongTinCongTy t left join fetch t.tepTin where t.id = :id")
    Optional<ThongTinCongTy> timKemLogo(@Param("id") Integer id);
}
