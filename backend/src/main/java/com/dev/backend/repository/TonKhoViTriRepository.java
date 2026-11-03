package com.dev.backend.repository;

import com.dev.backend.entities.TonKhoViTri;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TonKhoViTriRepository extends JpaRepository<TonKhoViTri, Integer> {
    Optional<TonKhoViTri> findByViTriKho_IdAndLoHang_Id(Integer viTriKhoId, Integer loHangId);

    List<TonKhoViTri> findByViTriKho_Id(Integer viTriKhoId);

    @Query("SELECT t FROM TonKhoViTri t JOIN FETCH t.loHang JOIN FETCH t.bienTheSanPham WHERE t.viTriKho.id = :viTriKhoId AND t.soLuong > 0")
    List<TonKhoViTri> findActiveLotsByViTriId(@Param("viTriKhoId") Integer viTriKhoId);

    @Query("SELECT COALESCE(SUM(t.soLuong), 0) FROM TonKhoViTri t WHERE t.viTriKho.id = :viTriKhoId")
    Integer sumDangChuaByViTriId(@Param("viTriKhoId") Integer viTriKhoId);

    @Query("SELECT t.viTriKho.id, COALESCE(SUM(t.soLuong), 0) FROM TonKhoViTri t WHERE t.viTriKho.khuVucKho.kho.id = :khoId GROUP BY t.viTriKho.id")
    List<Object[]> sumDangChuaByKhoIdGroupByViTriId(@Param("khoId") Integer khoId);

    /**
     * Khóa (FOR UPDATE) các dòng sổ kệ của một lô ở các kệ thuộc một kho, kệ tăng dần. Sổ kệ trừ / cộng / xếp kệ và kiểm
     * kê chốt số dùng cùng thứ tự.
     */
    default List<TonKhoViTri> khoaTheoKhoVaLo(Integer khoId, Integer loHangId) {
        List<Integer> ids = idsTheoKhoVaLo(khoId, loHangId);
        return ids.isEmpty() ? List.of() : khoaTheoIds(ids);
    }

    /** Hai bước như TonKhoTheoLoRepository: lấy id (không khóa, có JOIN kệ) rồi khóa theo PK, không khóa dòng kệ. */
    @Query("SELECT t.id FROM TonKhoViTri t WHERE t.loHang.id = :loHangId AND t.viTriKho.kho.id = :khoId ORDER BY t.id")
    List<Integer> idsTheoKhoVaLo(@Param("khoId") Integer khoId, @Param("loHangId") Integer loHangId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TonKhoViTri t WHERE t.id IN :ids ORDER BY t.id")
    List<TonKhoViTri> khoaTheoIds(@Param("ids") java.util.Collection<Integer> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TonKhoViTri t WHERE t.viTriKho.id = :viTriKhoId AND t.loHang.id = :loHangId")
    Optional<TonKhoViTri> khoaTheoKeVaLo(@Param("viTriKhoId") Integer viTriKhoId, @Param("loHangId") Integer loHangId);

    /** Tổng số trên kệ của các lô ở một kho: [loHangId, tổng]. */
    @Query("SELECT t.loHang.id, COALESCE(SUM(t.soLuong), 0) FROM TonKhoViTri t "
            + "WHERE t.viTriKho.kho.id = :khoId AND t.loHang.id IN :loHangIds GROUP BY t.loHang.id")
    List<Object[]> tongTrenKeTheoLo(@Param("khoId") Integer khoId, @Param("loHangIds") java.util.Collection<Integer> loHangIds);

    /** Kệ còn dòng tồn dương (kiểm thêm khi tổng tồn kệ về 0 vì có dòng âm bù). */
    boolean existsByViTriKho_IdAndSoLuongGreaterThan(Integer viTriKhoId, Integer soLuong);

    /** Xóa các dòng tồn không dương còn lại của một kệ trước khi xóa kệ (bảng không có khóa ngoại tới kệ). */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM TonKhoViTri t WHERE t.viTriKho.id = :viTriKhoId AND t.soLuong <= 0")
    int xoaDongSoKhongTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);
}

