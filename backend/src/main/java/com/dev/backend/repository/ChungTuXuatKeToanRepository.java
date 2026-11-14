package com.dev.backend.repository;

import com.dev.backend.entities.ChungTuXuatKeToan;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChungTuXuatKeToanRepository extends JpaRepository<ChungTuXuatKeToan, Integer> {

    /** Có chứng từ nào ở trạng thái này (da_xuat = đang khóa trong một lô). */
    boolean existsByTrangThai(String trangThai);

    /** Chứng từ nguồn đang bị khóa (đã vào một lô còn hiệu lực). */
    boolean existsByLoaiAndIdNguonAndTrangThai(String loai, Integer idNguon, String trangThai);

    /**
     * Số lô đang khóa chứng từ nguồn (rỗng = chưa khóa). Chỉ đọc cột số lô: chạm vào c.loXuat sẽ nạp cả tệp nén (longblob)
     * của lô. Tối đa một dòng nhờ khóa duy nhất khoa_hieu_luc.
     */
    @Query("SELECT l.soLo FROM ChungTuXuatKeToan c JOIN c.loXuat l WHERE c.loai = :loai AND c.idNguon = :idNguon AND c.trangThai = 'da_xuat'")
    Optional<String> soLoDangKhoa(@Param("loai") String loai, @Param("idNguon") Integer idNguon);

    @Query("SELECT l.soLo FROM ChungTuXuatKeToan c JOIN c.loXuat l WHERE c.id = :id")
    Optional<String> soLoCua(@Param("id") Integer id);

    @Query("SELECT c FROM ChungTuXuatKeToan c LEFT JOIN FETCH c.nguoiMoKhoa WHERE c.loXuat.id = :loId ORDER BY c.loai, c.ngayHachToan, c.soChungTu")
    List<ChungTuXuatKeToan> findByLoXuatId(@Param("loId") Integer loId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChungTuXuatKeToan c WHERE c.id = :id")
    Optional<ChungTuXuatKeToan> findByIdForUpdate(@Param("id") Integer id);

    /** Hủy lô: chứng từ còn khóa của lô quay về "chưa xuất" (khoa_hieu_luc thành NULL); chứng từ đã mở khóa giữ nguyên. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ChungTuXuatKeToan c SET c.trangThai = 'da_huy_lo' WHERE c.loXuat.id = :loId AND c.trangThai = 'da_xuat'")
    int huyTheoLo(@Param("loId") Integer loId);
}
