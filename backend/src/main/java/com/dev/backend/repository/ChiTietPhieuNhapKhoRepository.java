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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    /**
     * Số phiếu của các phiếu Nháp cùng đơn mua đang giữ biến thể (như {@link #sumDuKienPhieuNhapCungDon}), để câu báo chỉ ra
     * phiếu. Phiếu tạo trước đứng trước (số phiếu không đệm số 0 nên không xếp theo chữ được).
     */
    @Query("""
    SELECT p.soPhieuNhap
    FROM ChiTietPhieuNhapKho ct
    JOIN ct.phieuNhapKho p
    WHERE ct.loHang IS NULL
      AND p.donMuaHang.id = :donMuaHangId
      AND ct.bienTheSanPham.id = :bienTheSanPhamId
      AND p.trangThai = 0
    GROUP BY p.soPhieuNhap
    ORDER BY MIN(p.id)
    """)
    List<String> soPhieuNhapGiuCungDon(@Param("donMuaHangId") Integer donMuaHangId, @Param("bienTheSanPhamId") Integer bienTheSanPhamId);

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

    // ── Hàng đạt "chờ nhập" trên kệ: lô đã khóa của phiếu Nháp, chưa vào tồn nhưng đã giữ chỗ trên kệ ──
    // Lô một kệ: cả số đạt của lô nằm ở lo_hang.vi_tri_kho_id. Lô nhiều kệ: từng phần ở bảng lo_hang_ke_nhap
    // (lo_hang.vi_tri_kho_id chỉ là kệ chính). Mỗi số gồm hai truy vấn, lô không có dòng lo_hang_ke_nhap và dòng của lô
    // nhiều kệ; ba hàm mặc định bên dưới cộng hai phần cho nơi gọi.

    /**
     * Hàng đạt chờ nhập trên một kệ. Cộng với tồn thực tế trên kệ để không cho khóa lô vượt sức chứa.
     * {@code boQuaLoId}: lô đang được sửa.
     */
    default Long sumChoNhapTheoViTri(Integer viTriKhoId, Integer boQuaLoId) {
        Long motKe = sumChoNhapMotKeTheoViTri(viTriKhoId, boQuaLoId);
        Long nhieuKe = sumChoNhapNhieuKeTheoViTri(viTriKhoId, boQuaLoId);
        return (motKe != null ? motKe : 0L) + (nhieuKe != null ? nhieuKe : 0L);
    }

    @Query("""
        select coalesce(sum(l.soLuongNhap), 0)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.id = :viTriKhoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
          and (:boQuaLoId is null or l.id <> :boQuaLoId)
          and not exists (select 1 from LoHangKeNhap k where k.loHang.id = l.id)
    """)
    Long sumChoNhapMotKeTheoViTri(@Param("viTriKhoId") Integer viTriKhoId, @Param("boQuaLoId") Integer boQuaLoId);

    @Query("""
        select coalesce(sum(k.soLuong), 0)
        from LoHangKeNhap k
        join ChiTietPhieuNhapKho ct on ct.loHang.id = k.loHang.id
        where k.viTriKho.id = :viTriKhoId
          and k.loHang.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
          and (:boQuaLoId is null or k.loHang.id <> :boQuaLoId)
    """)
    Long sumChoNhapNhieuKeTheoViTri(@Param("viTriKhoId") Integer viTriKhoId, @Param("boQuaLoId") Integer boQuaLoId);

    /**
     * Lô đã khóa của các phiếu Nháp đang gắn một kệ, gom theo phiếu: mỗi dòng {soPhieuNhap, soLo, soLuongDat}, phiếu
     * lập trước đứng trước. Đếm cả lô chỉ có hàng không đạt (số đạt 0) vì lô đó vẫn trỏ tới kệ. Lô nhiều kệ tính phần
     * xếp vào kệ này.
     */
    default List<Object[]> loChoNhapTheoViTri(Integer viTriKhoId) {
        // Mỗi phần {soPhieuNhap, soLo, soLuong, idPhieuNhoNhat}: gộp theo phiếu rồi xếp theo id phiếu
        Map<String, Object[]> theoPhieu = new LinkedHashMap<>();
        for (List<Object[]> phan : Arrays.asList(loChoNhapMotKeTheoViTri(viTriKhoId), loChoNhapNhieuKeTheoViTri(viTriKhoId))) {
            if (phan == null) continue;
            for (Object[] d : phan) {
                long soLo = ((Number) d[1]).longValue();
                long soLuong = d[2] != null ? ((Number) d[2]).longValue() : 0L;
                long idPhieu = ((Number) d[3]).longValue();
                Object[] cu = theoPhieu.get(String.valueOf(d[0]));
                if (cu == null) {
                    theoPhieu.put(String.valueOf(d[0]), new Object[]{d[0], soLo, soLuong, idPhieu});
                } else {
                    cu[1] = (Long) cu[1] + soLo;
                    cu[2] = (Long) cu[2] + soLuong;
                    cu[3] = Math.min((Long) cu[3], idPhieu);
                }
            }
        }
        return theoPhieu.values().stream()
                .sorted(Comparator.comparingLong(d -> (Long) d[3]))
                .map(d -> new Object[]{d[0], d[1], d[2]})
                .toList();
    }

    @Query("""
        select ct.phieuNhapKho.soPhieuNhap, count(l.id), coalesce(sum(l.soLuongNhap), 0), min(ct.phieuNhapKho.id)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.id = :viTriKhoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
          and not exists (select 1 from LoHangKeNhap k where k.loHang.id = l.id)
        group by ct.phieuNhapKho.soPhieuNhap
    """)
    List<Object[]> loChoNhapMotKeTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);

    @Query("""
        select ct.phieuNhapKho.soPhieuNhap, count(k.id), coalesce(sum(k.soLuong), 0), min(ct.phieuNhapKho.id)
        from LoHangKeNhap k
        join ChiTietPhieuNhapKho ct on ct.loHang.id = k.loHang.id
        where k.viTriKho.id = :viTriKhoId
          and k.loHang.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
        group by ct.phieuNhapKho.soPhieuNhap
    """)
    List<Object[]> loChoNhapNhieuKeTheoViTri(@Param("viTriKhoId") Integer viTriKhoId);

    /**
     * Như {@link #sumChoNhapTheoViTri} nhưng cho mọi kệ của một kho: mỗi dòng {viTriKhoId, soLuong, soLo}.
     * {@code soLo} đếm cả lô chỉ có hàng không đạt (số đạt 0) vẫn gắn kệ.
     */
    default List<Object[]> sumChoNhapTheoKho(Integer khoId) {
        Map<Integer, Object[]> theoKe = new LinkedHashMap<>();
        for (List<Object[]> phan : Arrays.asList(sumChoNhapMotKeTheoKho(khoId), sumChoNhapNhieuKeTheoKho(khoId))) {
            if (phan == null) continue;
            for (Object[] d : phan) {
                if (d[0] == null) continue;
                Integer keId = ((Number) d[0]).intValue();
                long soLuong = d[1] != null ? ((Number) d[1]).longValue() : 0L;
                long soLo = d[2] != null ? ((Number) d[2]).longValue() : 0L;
                Object[] cu = theoKe.get(keId);
                if (cu == null) {
                    theoKe.put(keId, new Object[]{keId, soLuong, soLo});
                } else {
                    cu[1] = (Long) cu[1] + soLuong;
                    cu[2] = (Long) cu[2] + soLo;
                }
            }
        }
        return new ArrayList<>(theoKe.values());
    }

    @Query("""
        select l.viTriKho.id, coalesce(sum(l.soLuongNhap), 0), count(l.id)
        from ChiTietPhieuNhapKho ct
        join ct.loHang l
        where l.viTriKho.khuVucKho.kho.id = :khoId
          and l.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
          and not exists (select 1 from LoHangKeNhap k where k.loHang.id = l.id)
        group by l.viTriKho.id
    """)
    List<Object[]> sumChoNhapMotKeTheoKho(@Param("khoId") Integer khoId);

    @Query("""
        select k.viTriKho.id, coalesce(sum(k.soLuong), 0), count(k.id)
        from LoHangKeNhap k
        join ChiTietPhieuNhapKho ct on ct.loHang.id = k.loHang.id
        where k.viTriKho.khuVucKho.kho.id = :khoId
          and k.loHang.trangThai = 'TAM_KHOA'
          and ct.phieuNhapKho.trangThai = 0
        group by k.viTriKho.id
    """)
    List<Object[]> sumChoNhapNhieuKeTheoKho(@Param("khoId") Integer khoId);



    /**
     * Số lỗi theo (phiếu, biến thể) của các lô đã khóa: [phieuNhapKhoId, bienTheSanPhamId, tổng số lỗi]. Biên bản trả hàng
     * lấy số lỗi từ đây (lô của phiếu là nơi lưu chuẩn, đã khóa sau khi nhập kho).
     */
    @Query("""
    SELECT ct.phieuNhapKho.id, ct.bienTheSanPham.id, SUM(ct.loHang.soLuongLoi)
    FROM ChiTietPhieuNhapKho ct
    WHERE ct.phieuNhapKho.id IN :phieuIds AND ct.loHang IS NOT NULL AND ct.loHang.soLuongLoi > 0
    GROUP BY ct.phieuNhapKho.id, ct.bienTheSanPham.id
    """)
    java.util.List<Object[]> soLoiTheoBienThe(@Param("phieuIds") java.util.Collection<Integer> phieuIds);

    /**
     * Số hàng đạt của các biến thể nhập ở phiếu hoàn tất của cùng đơn mua SAU một thời điểm (hàng về sau biên bản: có thể
     * là hàng bù). Dùng để chặn đổi giao bù sang trừ tiền khi đã có hàng về.
     */
    @Query("""
    SELECT COALESCE(SUM(ct.loHang.soLuongNhap), 0)
    FROM ChiTietPhieuNhapKho ct
    WHERE ct.phieuNhapKho.donMuaHang.id = :donId AND ct.phieuNhapKho.trangThai = 3
      AND ct.phieuNhapKho.ngayNhap > :sau AND ct.loHang IS NOT NULL
      AND ct.bienTheSanPham.id IN :bienTheIds
    """)
    Long datNhapSau(@Param("donId") Integer donId, @Param("sau") java.time.Instant sau,
                    @Param("bienTheIds") java.util.Collection<Integer> bienTheIds);
}
