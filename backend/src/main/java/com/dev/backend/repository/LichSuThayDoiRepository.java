package com.dev.backend.repository;

import com.dev.backend.entities.LichSuThayDoi;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LichSuThayDoiRepository extends JpaRepository<LichSuThayDoi, Integer>, JpaSpecificationExecutor<LichSuThayDoi> {

    /** Bản ghi lịch sử mới nhất của một chứng từ theo các hành động cho trước. */
    Optional<LichSuThayDoi> findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
            String loaiThamChieu, Integer idThamChieu, Collection<String> hanhDongs);

    /** Lịch sử của một đối tượng theo các hành động cho trước, mới nhất trước; lấy kèm người thực hiện và kho. */
    @EntityGraph(attributePaths = {"nguoiThucHien", "kho"})
    List<LichSuThayDoi> findByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
            String loaiThamChieu, Integer idThamChieu, Collection<String> hanhDongs, Pageable pageable);

    /** Trong các đối tượng cho trước, những id đã có bản ghi với hành động này (vd. phiếu chuyển bị từ chối ở danh sách). */
    @Query("SELECT DISTINCT l.idThamChieu FROM LichSuThayDoi l "
            + "WHERE l.loaiThamChieu = :loai AND l.hanhDong = :hanhDong AND l.idThamChieu IN :ids")
    List<Integer> idCoHanhDong(@Param("loai") String loaiThamChieu, @Param("ids") Collection<Integer> idThamChieus,
                               @Param("hanhDong") String hanhDong);

    /** Mọi dòng lịch sử của một đối tượng, mới nhất trước (thẻ Lịch sử ở trang chi tiết). */
    @EntityGraph(attributePaths = {"nguoiThucHien", "kho"})
    List<LichSuThayDoi> findByLoaiThamChieuAndIdThamChieuOrderByNgayThucHienDescIdDesc(
            String loaiThamChieu, Integer idThamChieu, Pageable pageable);

    /** Lịch sử một đối tượng trừ các hành động cho trước (quét mã, đăng nhập…); giữ cả dòng không có hành động. */
    @EntityGraph(attributePaths = {"nguoiThucHien", "kho"})
    @Query("SELECT l FROM LichSuThayDoi l WHERE l.loaiThamChieu = :loai AND l.idThamChieu = :id"
            + " AND (l.hanhDong IS NULL OR l.hanhDong NOT IN :boQua) ORDER BY l.ngayThucHien DESC, l.id DESC")
    List<LichSuThayDoi> lichSuTruHanhDong(@Param("loai") String loaiThamChieu, @Param("id") Integer idThamChieu,
                                          @Param("boQua") Collection<String> hanhDongBoQua, Pageable pageable);

    /**
     * Lịch sử sản phẩm: dòng của chính sản phẩm + các dòng một hành động (đổi giá bán) trên các biến thể của nó, mới
     * nhất trước. bienTheIds không được rỗng (truyền [-1] khi không có biến thể). Dòng của sản phẩm bỏ các hành động
     * trong boQua (lượt in cũ, quét mã…), giữ dòng không có hành động.
     */
    @EntityGraph(attributePaths = {"nguoiThucHien", "kho"})
    @Query("SELECT l FROM LichSuThayDoi l WHERE (l.loaiThamChieu = :loaiSp AND l.idThamChieu = :spId"
            + " AND (l.hanhDong IS NULL OR l.hanhDong NOT IN :boQua))"
            + " OR (l.loaiThamChieu = :loaiBt AND l.idThamChieu IN :bienTheIds AND l.hanhDong = :hanhDongBt)"
            + " ORDER BY l.ngayThucHien DESC, l.id DESC")
    List<LichSuThayDoi> lichSuSanPham(@Param("loaiSp") String loaiSanPham, @Param("spId") Integer sanPhamId,
                                      @Param("boQua") Collection<String> hanhDongBoQua,
                                      @Param("loaiBt") String loaiBienThe,
                                      @Param("bienTheIds") Collection<Integer> bienTheIds,
                                      @Param("hanhDongBt") String hanhDongBienThe, Pageable pageable);

    /** Lịch sử của nhiều đối tượng cùng loại (vd. các biến thể khổ giấy của một mẫu in), mới nhất trước. */
    @EntityGraph(attributePaths = {"nguoiThucHien"})
    List<LichSuThayDoi> findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc(
            String loaiThamChieu, Collection<Integer> idThamChieus, String hanhDong, Pageable pageable);

    /** Mọi dòng của nhiều đối tượng cùng loại, cũ trước (nhật ký biên bản trả hàng nhà cung cấp: dựng lại từng việc). */
    @EntityGraph(attributePaths = {"nguoiThucHien"})
    List<LichSuThayDoi> findByLoaiThamChieuAndIdThamChieuInOrderByIdAsc(String loaiThamChieu, Collection<Integer> idThamChieus);

    // ── Nhật ký đăng nhập (tab Đăng nhập + màn Nhật ký đăng nhập), dựng từ dữ liệu sẵn có ──

    /** (idThamChieu, ghiChu) của các dòng một hành động, trong nhiều đối tượng, từ thời điểm cho trước (đánh dấu bất thường). */
    @Query("SELECT l.idThamChieu, l.ghiChu FROM LichSuThayDoi l WHERE l.loaiThamChieu = :loai"
            + " AND l.hanhDong = :hanhDong AND l.idThamChieu IN :ids AND l.ngayThucHien >= :tu")
    List<Object[]> idVaGhiChuTheoHanhDongTuNgay(@Param("loai") String loaiThamChieu, @Param("hanhDong") String hanhDong,
                                                @Param("ids") Collection<Integer> ids, @Param("tu") Instant tu);

    /** (idThamChieu, lần cuối) của một hành động trong nhiều đối tượng (đăng nhập gần nhất của danh sách người dùng). */
    @Query("SELECT l.idThamChieu, MAX(l.ngayThucHien) FROM LichSuThayDoi l WHERE l.loaiThamChieu = :loai"
            + " AND l.hanhDong = :hanhDong AND l.idThamChieu IN :ids GROUP BY l.idThamChieu")
    List<Object[]> lanCuoiTheoHanhDong(@Param("loai") String loaiThamChieu, @Param("hanhDong") String hanhDong,
                                       @Param("ids") Collection<Integer> ids);

    /** Mọi dòng của một hành động trên toàn hệ thống từ thời điểm cho trước, kèm người (khung "Cần chú ý" màn nhật ký). */
    @EntityGraph(attributePaths = {"nguoiThucHien"})
    @Query("SELECT l FROM LichSuThayDoi l WHERE l.loaiThamChieu = :loai AND l.hanhDong = :hanhDong"
            + " AND l.ngayThucHien >= :tu ORDER BY l.ngayThucHien DESC, l.id DESC")
    List<LichSuThayDoi> toanHeThongTheoHanhDongTuNgay(@Param("loai") String loaiThamChieu,
                                                      @Param("hanhDong") String hanhDong, @Param("tu") Instant tu);

    /**
     * Nhật ký đăng nhập toàn hệ thống (màn Nhật ký đăng nhập): các hành động cho trước từ thời điểm cho trước, lọc theo
     * từ khóa (họ tên / tên đăng nhập / ghi chú chứa IP). q đã là "%tu_khoa%" chữ thường, hoặc null để không lọc.
     * Thứ tự do Pageable (mới nhất trước).
     */
    @EntityGraph(attributePaths = {"nguoiThucHien"})
    @Query("SELECT l FROM LichSuThayDoi l WHERE l.loaiThamChieu = :loai AND l.hanhDong IN :hanhDongs"
            + " AND l.ngayThucHien >= :tu AND (:q IS NULL"
            + " OR LOWER(COALESCE(l.nguoiThucHien.hoTen, '')) LIKE :q"
            + " OR LOWER(COALESCE(l.nguoiThucHien.tenDangNhap, '')) LIKE :q"
            + " OR LOWER(COALESCE(l.ghiChu, '')) LIKE :q)")
    Page<LichSuThayDoi> nhatKyDangNhapHeThong(@Param("loai") String loaiThamChieu,
                                              @Param("hanhDongs") Collection<String> hanhDongs,
                                              @Param("tu") Instant tu, @Param("q") String q, Pageable pageable);
}