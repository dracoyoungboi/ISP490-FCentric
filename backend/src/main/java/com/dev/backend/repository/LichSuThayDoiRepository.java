package com.dev.backend.repository;

import com.dev.backend.entities.LichSuThayDoi;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}