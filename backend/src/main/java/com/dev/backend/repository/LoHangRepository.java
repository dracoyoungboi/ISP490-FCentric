package com.dev.backend.repository;

import com.dev.backend.entities.LoHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LoHangRepository extends JpaRepository<LoHang, Integer>, JpaSpecificationExecutor<LoHang> {
    boolean existsByMaLoAndBienTheSanPham_Id(String maLo, Integer bienTheSanPhamId);

    java.util.Optional<LoHang> findFirstByMaLo(String maLo);

    /** Các lô cùng mã của một biến thể (khóa duy nhất của bảng là biến thể + mã lô + ngày sản xuất). */
    java.util.List<LoHang> findByBienTheSanPham_IdAndMaLo(Integer bienTheSanPhamId, String maLo);

    /** Số lô hàng ghi nhận nhà cung cấp này — dùng khi kiểm tra xóa nhà cung cấp. */
    long countByNhaCungCap_Id(Integer nhaCungCapId);

    /** Id các lô đang trỏ tới một kệ (đọc thường, không khóa). */
    @Query("select l.id from LoHang l where l.viTriKho.id = :viTriKhoId")
    java.util.List<Integer> idLoTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);

    /**
     * Gỡ kệ khỏi các lô trước khi xóa kệ (cột kệ của lô không có khóa ngoại, không gỡ thì lô trỏ tới kệ không còn).
     * Lọc theo khóa chính để chỉ khóa đúng các dòng lô đó.
     */
    @Modifying(flushAutomatically = true)
    @Query("update LoHang l set l.viTriKho = null where l.id in :ids")
    int goViTriKho(@Param("ids") java.util.Collection<Integer> ids);
}