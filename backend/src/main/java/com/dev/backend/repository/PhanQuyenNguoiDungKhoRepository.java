package com.dev.backend.repository;

import com.dev.backend.dto.response.entities.KhoPhuTrachInfoDto;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PhanQuyenNguoiDungKhoRepository extends JpaRepository<PhanQuyenNguoiDungKho, Integer>, JpaSpecificationExecutor<PhanQuyenNguoiDungKho> {


    /**
     * Phân quyền kho đang có hiệu lực tại thời điểm {@code now}: đang hoạt động, đã tới ngày bắt đầu (nếu có)
     * và chưa hết hạn. So với giờ của máy chủ ứng dụng (tham số), không dùng CURRENT_TIMESTAMP của CSDL,
     * để không lệch khi phiên MySQL đặt múi giờ khác với múi giờ driver dùng khi ghi Instant.
     */
    @Query("""
            SELECT pqndk FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    List<PhanQuyenNguoiDungKho> findHieuLucTai(@Param("nguoiDungId") Integer nguoiDungId, @Param("now") Instant now);

    /** Như {@link #findHieuLucTai} tại thời điểm hiện tại. Dùng cho token đăng nhập, trang chi tiết người dùng và các màn nghiệp vụ. */
    default List<PhanQuyenNguoiDungKho> findByNguoiDungIdAndActive(Integer nguoiDungId) {
        return findHieuLucTai(nguoiDungId, Instant.now());
    }

    /**
     * Phân quyền kho đang "giữ chỗ": đang hoạt động và chưa hết hạn, KỂ CẢ phân quyền chưa tới ngày bắt đầu.
     * Dùng cho quy tắc tối đa một kho (kiểm trùng, thu hồi khi đổi kho hoặc đổi vai trò), để phân quyền
     * hẹn ngày bắt đầu ở tương lai không lọt qua rồi thành hai kho khi tới ngày.
     */
    @Query("""
            SELECT pqndk FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    List<PhanQuyenNguoiDungKho> findGiuChoByNguoiDungId(@Param("nguoiDungId") Integer nguoiDungId, @Param("now") Instant now);

    /**
     * Cặp (kho, mã quyền đang bật) của các phân quyền kho đang hiệu lực; kho chưa có quyền nào trả một dòng
     * với mã quyền null. Dùng ở AuthInterceptor để so token với CSDL trong một truy vấn.
     */
    @Query("""
            SELECT pqndk.kho.id, qh.maQuyen
            FROM PhanQuyenNguoiDungKho pqndk
            LEFT JOIN pqndk.chiTietQuyenKhos ct ON ct.trangThai = 1
            LEFT JOIN ct.quyenHan qh
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    List<Object[]> layKhoVaQuyenHieuLuc(@Param("nguoiDungId") Integer nguoiDungId, @Param("now") Instant now);

    Optional<PhanQuyenNguoiDungKho> findByNguoiDungIdAndKhoId(Integer nguoiDungId, Integer khoId);

    /**
     * Danh sách kho (chỉ mã + tên) đang phụ trách hiệu lực cho hồ sơ cá nhân:
     * trạng thái hoạt động, chưa hết hạn và đã đến ngày bắt đầu (nếu có).
     * Dùng constructor expression để không serialize toàn bộ entity graph, DISTINCT chống trùng kho.
     */
    @Query("""
            SELECT DISTINCT new com.dev.backend.dto.response.entities.KhoPhuTrachInfoDto(k.maKho, k.tenKho)
            FROM PhanQuyenNguoiDungKho pqndk
            JOIN pqndk.kho k
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
            """)
    List<KhoPhuTrachInfoDto> findActiveKhoInfoTai(@Param("nguoiDungId") Integer nguoiDungId, @Param("now") Instant now);

    default List<KhoPhuTrachInfoDto> findActiveKhoInfoByNguoiDungId(Integer nguoiDungId) {
        return findActiveKhoInfoTai(nguoiDungId, Instant.now());
    }
}