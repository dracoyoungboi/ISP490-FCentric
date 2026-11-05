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

    /** Lịch sử của nhiều đối tượng cùng loại (vd. các biến thể khổ giấy của một mẫu in), mới nhất trước. */
    @EntityGraph(attributePaths = {"nguoiThucHien"})
    List<LichSuThayDoi> findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc(
            String loaiThamChieu, Collection<Integer> idThamChieus, String hanhDong, Pageable pageable);
}