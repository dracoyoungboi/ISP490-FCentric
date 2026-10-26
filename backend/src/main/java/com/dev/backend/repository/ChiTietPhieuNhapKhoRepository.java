package com.dev.backend.repository;

import com.dev.backend.entities.ChiTietPhieuNhapKho;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChiTietPhieuNhapKhoRepository extends JpaRepository<ChiTietPhieuNhapKho, Integer>, JpaSpecificationExecutor<ChiTietPhieuNhapKho> {
    /**
     * Khóa dòng dự kiến của biến thể trong phiếu (SELECT ... FOR UPDATE): khóa lô cùng biến thể chạy tuần tự,
     * nên hai người khóa lô cùng lúc không vượt được số cần nhập.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ct FROM ChiTietPhieuNhapKho ct WHERE ct.phieuNhapKho.id = :phieuNhapKhoId AND ct.bienTheSanPham.id = :bienTheSanPhamId AND ct.loHang IS NULL ORDER BY ct.id")
    List<ChiTietPhieuNhapKho> khoaDongDuKien(@Param("phieuNhapKhoId") Integer phieuNhapKhoId, @Param("bienTheSanPhamId") Integer bienTheSanPhamId);

    /** Tổng số dự kiến nhập của biến thể ở các phiếu Nháp khác cùng đơn mua (chưa nhập kho nên chưa vào "đã nhận"). */
    @Query("""
    SELECT COALESCE(SUM(ct.soLuongNhap), 0)
    FROM ChiTietPhieuNhapKho ct
    WHERE ct.loHang IS NULL
      AND ct.phieuNhapKho.donMuaHang.id = :donMuaHangId
      AND ct.bienTheSanPham.id = :bienTheSanPhamId
      AND ct.phieuNhapKho.trangThai = 0
    """)
    BigDecimal sumDuKienPhieuNhapCungDon(@Param("donMuaHangId") Integer donMuaHangId, @Param("bienTheSanPhamId") Integer bienTheSanPhamId);

    @Query("""
    SELECT COALESCE(SUM(ct.soLuongNhap), 0)
    FROM ChiTietPhieuNhapKho ct
    WHERE ct.phieuNhapKho.id = :phieuNhapKhoId
      AND ct.bienTheSanPham.id = :bienTheSanPhamId
      AND ct.loHang IS NOT NULL
""")
    BigDecimal sumSoLuongDaKhaiBao(
            @Param("phieuNhapKhoId") Integer phieuNhapKhoId,
            @Param("bienTheSanPhamId") Integer bienTheSanPhamId
    );
    Optional<ChiTietPhieuNhapKho>
    findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(
            Integer phieuNhapKhoId,
            Integer bienTheSanPhamId
    );
    Optional<ChiTietPhieuNhapKho>
    findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(
            Integer phieuNhapKhoId,
            Integer bienTheSanPhamId,
            String maLo
    );
    Optional<ChiTietPhieuNhapKho> findByIdAndPhieuNhapKho_Id(
            Integer id,
            Integer phieuNhapKhoId
    );

    @Query("""
    select ct
    from ChiTietPhieuNhapKho ct
    where ct.phieuNhapKho.id = :phieuId
      and ct.bienTheSanPham.id = :bienTheId
      and ct.loHang is not null
    order by ct.id asc
""")
    List<ChiTietPhieuNhapKho> findDeclaredLots(
            @Param("phieuId") Integer phieuId,
            @Param("bienTheId") Integer bienTheId
    );

    @Query("""
        select ct
        from ChiTietPhieuNhapKho ct
        where ct.phieuNhapKho.id = :phieuId
          and ct.loHang is not null
    """)
    List<ChiTietPhieuNhapKho> findAllByPhieuNhapKhoIdAndCoLo(Integer phieuId);

    @Query("""
    select count(ctDraft)
    from ChiTietPhieuNhapKho ctDraft
    where ctDraft.phieuNhapKho.id = :phieuId
      and ctDraft.loHang is null
      and (
        select coalesce(sum(ct.soLuongNhap), 0)
        from ChiTietPhieuNhapKho ct
        where ct.phieuNhapKho.id = :phieuId
          and ct.bienTheSanPham.id = ctDraft.bienTheSanPham.id
          and ct.loHang is not null
      ) < ctDraft.soLuongNhap
""")
    long countBienTheChuaDuLo(@Param("phieuId") Integer phieuId);

    /**
     * Hàng đạt của các lô đã khóa nhưng phiếu chưa nhập kho (lô TAM_KHOA của phiếu Nháp) đang chờ lên một kệ.
     * Cộng với tồn thực tế trên kệ để không cho khóa lô vượt sức chứa. {@code boQuaLoId}: lô đang được sửa.
     */
    @Query("""
        select coalesce(sum(l.soLuongNhap), 0)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.id = :viTriKhoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
          and (:boQuaLoId is null or l.id <> :boQuaLoId)
    """)
    Long sumChoNhapTheoViTri(@Param("viTriKhoId") Integer viTriKhoId, @Param("boQuaLoId") Integer boQuaLoId);

    /**
     * Lô đã khóa của các phiếu Nháp đang gắn một kệ, gom theo phiếu: mỗi dòng {soPhieuNhap, soLo, soLuongDat}.
     * Đếm cả lô chỉ có hàng không đạt (số đạt 0) vì lô đó vẫn trỏ tới kệ.
     */
    @Query("""
        select ct.phieuNhapKho.soPhieuNhap, count(l.id), coalesce(sum(l.soLuongNhap), 0)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.id = :viTriKhoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
        group by ct.phieuNhapKho.soPhieuNhap
        order by min(ct.phieuNhapKho.id)
    """)
    List<Object[]> loChoNhapTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);

    /**
     * Như {@link #sumChoNhapTheoViTri} nhưng cho mọi kệ của một kho: mỗi dòng {viTriKhoId, soLuong, soLo}.
     * {@code soLo} đếm cả lô chỉ có hàng không đạt (số đạt 0) vẫn gắn kệ.
     */
    @Query("""
        select l.viTriKho.id, coalesce(sum(l.soLuongNhap), 0), count(l.id)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.khuVucKho.kho.id = :khoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
        group by l.viTriKho.id
    """)
    List<Object[]> sumChoNhapTheoKho(@Param("khoId") Integer khoId);


}