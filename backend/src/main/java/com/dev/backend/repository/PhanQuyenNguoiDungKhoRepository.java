package com.dev.backend.repository;

import com.dev.backend.dto.response.entities.KhoPhuTrachInfoDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PhanQuyenNguoiDungKhoRepository extends JpaRepository<PhanQuyenNguoiDungKho, Integer>, JpaSpecificationExecutor<PhanQuyenNguoiDungKho> {


    /**
     * Phân quyền kho đang có hiệu lực tại thời điểm {@code now}: đang hoạt động, đã tới ngày bắt đầu (nếu có)
     * và chưa hết hạn. So với giờ của máy chủ ứng dụng (tham số), không dùng CURRENT_TIMESTAMP của CSDL,
     * để không lệch khi phiên MySQL đặt múi giờ khác với múi giờ driver dùng khi ghi Instant.
     * Xếp theo id để dữ liệu cũ còn nhiều kho luôn cho cùng "dòng đầu" (khớp danh sách Người dùng).
     */
    @Query("""
            SELECT pqndk FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            ORDER BY pqndk.id
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
     * Bỏ dấu "người quản lý chính" (la_quan_ly_kho) ở mọi dòng phân quyền của kho, kể cả dòng đã thu hồi hay hết hạn.
     * Câu UPDATE thẳng, không cập nhật thực thể đang nạp trong phiên: nơi gọi phải nạp lại (refresh) kho / dòng phân quyền
     * nếu còn đọc hoặc ghi chúng sau đó, kẻo lần lưu thực thể cũ ghi đè dấu.
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE PhanQuyenNguoiDungKho pq SET pq.laQuanLyKho = 0 WHERE pq.kho.id = :khoId AND pq.laQuanLyKho <> 0")
    int boDauQuanLyChinhCuaKho(@Param("khoId") Integer khoId);

    /** Gắn dấu người quản lý chính cho một dòng phân quyền (gọi sau {@link #boDauQuanLyChinhCuaKho}). */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE PhanQuyenNguoiDungKho pq SET pq.laQuanLyKho = 1 WHERE pq.id = :id")
    int datDauQuanLyChinh(@Param("id") Integer id);

    /**
     * Dòng phân quyền mang dấu người quản lý chính ở kho {@code khoId}, còn hiệu lực tại {@code now}: mỗi dòng
     * {id phân quyền, id người dùng}, xếp theo id. Nơi gọi tự lọc tài khoản hoạt động + vai trò quản lý kho (như
     * Kho.SQL_QUAN_LY_CHINH).
     * Đọc BẢN MỚI NHẤT (FOR SHARE): gọi sau khi khóa dòng kho để thấy dấu giao dịch khác vừa ghi — đọc thường trong
     * REPEATABLE READ chỉ thấy ảnh chụp lúc giao dịch bắt đầu. Chỉ khóa dòng phân quyền, không khóa người dùng.
     */
    @Query(value = """
            SELECT pq.id, pq.nguoi_dung_id FROM phan_quyen_nguoi_dung_kho pq
            WHERE pq.kho_id = :khoId
              AND pq.la_quan_ly_kho = 1
              AND pq.trang_thai = 1
              AND (pq.ngay_bat_dau IS NULL OR pq.ngay_bat_dau <= :now)
              AND (pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > :now)
            ORDER BY pq.id
            FOR SHARE
            """, nativeQuery = true)
    List<Object[]> dauQuanLyChinhMoiNhat(@Param("khoId") Integer khoId, @Param("now") Instant now);

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

    /**
     * Kho đang hiệu lực của nhiều người dùng trong một truy vấn (danh sách Người dùng): mỗi dòng
     * {nguoiDungId, maKho, tenKho, ngayKetThuc}, cùng điều kiện với {@link #findHieuLucTai}.
     * Xếp theo id phân quyền để dữ liệu cũ còn nhiều kho thì lấy dòng đầu, như trang chi tiết.
     */
    @Query("""
            SELECT pqndk.nguoiDung.id, k.maKho, k.tenKho, pqndk.ngayKetThuc
            FROM PhanQuyenNguoiDungKho pqndk
            JOIN pqndk.kho k
            WHERE pqndk.nguoiDung.id IN :nguoiDungIds
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            ORDER BY pqndk.id
            """)
    List<Object[]> layKhoHieuLucTheoNguoiDung(@Param("nguoiDungIds") Collection<Integer> nguoiDungIds,
                                              @Param("now") Instant now);

    /**
     * Id người dùng mang vai trò {@code vaiTro}, tài khoản đang hoạt động, có phân quyền hiệu lực tại {@code now} (cùng
     * điều kiện với {@link #findHieuLucTai}) ở một trong các kho. Dùng tìm người nhận thông báo, vd. quản lý kho xuất.
     */
    @Query("""
            SELECT DISTINCT pqndk.nguoiDung.id FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.kho.id IN :khoIds
              AND pqndk.nguoiDung.vaiTro = :vaiTro
              AND pqndk.nguoiDung.trangThai = 1
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    List<Integer> nguoiDungTheoKhoTai(@Param("khoIds") Collection<Integer> khoIds, @Param("vaiTro") String vaiTro,
                                      @Param("now") Instant now);

    /** Người dùng có phân quyền hiệu lực tại {@code now} ở kho {@code khoId} không (cùng điều kiện với {@link #findHieuLucTai}). */
    @Query("""
            SELECT COUNT(pqndk) > 0 FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.nguoiDung.id = :nguoiDungId
              AND pqndk.kho.id = :khoId
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    boolean coHieuLucTaiKho(@Param("nguoiDungId") Integer nguoiDungId, @Param("khoId") Integer khoId,
                            @Param("now") Instant now);

    /**
     * Người dùng mang một trong các vai trò {@code vaiTros}, tài khoản đang hoạt động, có phân quyền hiệu lực tại
     * {@code now} ở kho {@code khoId}; xếp theo họ tên. Dùng cho danh sách người nhặt của phiếu nhặt hàng.
     */
    @Query("""
            SELECT nd FROM NguoiDung nd
            WHERE nd.vaiTro IN :vaiTros
              AND nd.trangThai = 1
              AND EXISTS (
                  SELECT 1 FROM PhanQuyenNguoiDungKho pqndk
                  WHERE pqndk.nguoiDung = nd
                    AND pqndk.kho.id = :khoId
                    AND pqndk.trangThai = 1
                    AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
                    AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now))
            ORDER BY nd.hoTen, nd.id
            """)
    List<NguoiDung> nguoiDungTheoKhoVaVaiTroTai(@Param("khoId") Integer khoId, @Param("vaiTros") Collection<String> vaiTros,
                                                @Param("now") Instant now);

    /**
     * Quản lý kho (tài khoản hoạt động) có phân quyền hiệu lực tại {@code now} ở các kho {@code khoIds}, trong một truy vấn
     * cho cả trang danh sách kho: mỗi dòng {khoId, NguoiDung}, xếp theo họ tên. Cùng điều kiện với
     * {@link #nguoiDungTheoKhoVaVaiTroTai} (danh sách chọn người quản lý ở form Sửa kho).
     */
    @Query("""
            SELECT pqndk.kho.id, nd FROM PhanQuyenNguoiDungKho pqndk
            JOIN pqndk.nguoiDung nd
            WHERE pqndk.kho.id IN :khoIds
              AND nd.vaiTro = 'quan_ly_kho'
              AND nd.trangThai = 1
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            ORDER BY nd.hoTen, nd.id
            """)
    List<Object[]> quanLyKhoTheoKhoTai(@Param("khoIds") Collection<Integer> khoIds, @Param("now") Instant now);

    /**
     * Như {@link #nguoiDungTheoKhoTai} nhưng theo loại kho (vd. kho_tong): quản lý Kho tổng = quản lý kho đang được phân
     * công ở một kho loại kho_tong (cùng luật với PhieuChuyenKhoService.laQuanLyKhoTong).
     */
    @Query("""
            SELECT DISTINCT pqndk.nguoiDung.id FROM PhanQuyenNguoiDungKho pqndk
            WHERE pqndk.kho.loaiKho = :loaiKho
              AND pqndk.nguoiDung.vaiTro = :vaiTro
              AND pqndk.nguoiDung.trangThai = 1
              AND pqndk.trangThai = 1
              AND (pqndk.ngayBatDau IS NULL OR pqndk.ngayBatDau <= :now)
              AND (pqndk.ngayKetThuc IS NULL OR pqndk.ngayKetThuc > :now)
            """)
    List<Integer> nguoiDungTheoLoaiKhoTai(@Param("loaiKho") String loaiKho, @Param("vaiTro") String vaiTro,
                                          @Param("now") Instant now);
}