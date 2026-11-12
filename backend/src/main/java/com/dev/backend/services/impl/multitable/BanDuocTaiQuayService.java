package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Số bán được tại quầy của một mã ở một kho — MỘT công thức cho danh mục POS (lưới hàng, ô cỡ, tra tồn giỏ, quét mã),
 * thẻ "Tra tồn" ở Tổng quan và bước thanh toán (PosCheckoutTransaction.allocateFifo):
 * <pre>bán được = Σ theo lô max(0, tồn − đã đặt − phần phiếu nhặt mở / phiếu xuất bán chưa xuất giữ) − giữ chỗ phiếu chuyển, cắt về 0</pre>
 * Giữ chỗ phiếu chuyển ở đây là phần CHƯA nằm trong phân bổ lô của phiếu nhặt chuyển kho đang mở
 * (GiuChoChuyenKhoService.taiKhoNgoaiPhieuNhat): phân bổ đó đã bị trừ theo lô ở vế trước.
 * Không trừ lượng chờ xuất của đơn bán chưa vào phiếu nhặt (đơn đó chưa giữ lô nào), giống thanh toán.
 * Danh mục đọc số từ SQL (Σ theo lô max(0, tồn − đã đặt)), đúng bằng công thức khi mã không bị giữ; chỉ các mã đang bị
 * giữ ở kho mới tính lại theo lô ở đây ({@link #banDuocCuaMaDangGiu}), để không phải nạp lô của mọi mã. Chỉ đọc, không khóa.
 */
@Service
public class BanDuocTaiQuayService {

    /** Số mã tối đa mỗi lần nạp lô (giữ mệnh đề IN gọn). */
    private static final int KICH_THUOC_LO_IN = 500;

    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final LoDangGiuService loDangGiuService;
    private final GiuChoChuyenKhoService giuChoChuyenKhoService;

    /** Null khi unit test dựng tay. */
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;

    public BanDuocTaiQuayService(TonKhoTheoLoRepository tonKhoTheoLoRepository, LoDangGiuService loDangGiuService,
                                 GiuChoChuyenKhoService giuChoChuyenKhoService) {
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.loDangGiuService = loDangGiuService;
        this.giuChoChuyenKhoService = giuChoChuyenKhoService;
    }

    /**
     * Công thức dùng chung cho danh mục và thanh toán. {@code loCuaMa}: mọi dòng tồn theo lô của mã ở kho;
     * {@code dangGiuTheoLo}: phần phiếu nhặt / phiếu xuất bán giữ theo lô (LoDangGiuService.dangGiuTheoLo);
     * {@code giuChoChuyen}: giữ chỗ phiếu chuyển của mã ở kho (null = 0). Lô âm (dữ liệu lệch) tính 0, không bù cho lô khác.
     */
    public static BigDecimal banDuoc(Collection<TonKhoTheoLo> loCuaMa, Map<Integer, BigDecimal> dangGiuTheoLo,
                                     BigDecimal giuChoChuyen) {
        Map<Integer, BigDecimal> dangGiu = dangGiuTheoLo == null ? Map.of() : dangGiuTheoLo;
        BigDecimal tong = BigDecimal.ZERO;
        if (loCuaMa != null) {
            for (TonKhoTheoLo t : loCuaMa) {
                tong = tong.add(LoDangGiuService.conLai(t, dangGiu).max(BigDecimal.ZERO));
            }
        }
        return tong.subtract(giuChoChuyen == null ? BigDecimal.ZERO : giuChoChuyen).max(BigDecimal.ZERO);
    }

    /** Bán được tại quầy của các mã ở một kho. Mọi mã truyền vào đều có trong kết quả (chưa có lô nào → 0). */
    public Map<Integer, BigDecimal> banDuocTaiQuay(Integer khoId, Collection<Integer> bienTheIds) {
        return banDuocTaiQuay(khoId, bienTheIds, false).soLuong();
    }

    /**
     * Số bán được kèm tập mã mà phần đang kiểm kê làm giảm số bán được: quầy hiện "Đang kiểm kê" thay cho "Hết" và
     * giải thích vì sao không bán được (AC-22: chỉ lấy ở kệ tự do).
     */
    public record BanDuocKemKiemKe(Map<Integer, BigDecimal> soLuong, Set<Integer> dangKiemKe) {
    }

    private BanDuocKemKiemKe banDuocTaiQuay(Integer khoId, Collection<Integer> bienTheIds, boolean xetKiemKe) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        Set<Integer> dangKiemKe = new HashSet<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return new BanDuocKemKiemKe(ketQua, dangKiemKe);
        }
        List<Integer> ids = bienTheIds.stream().filter(Objects::nonNull).distinct().toList();
        for (int i = 0; i < ids.size(); i += KICH_THUOC_LO_IN) {
            List<Integer> lo = ids.subList(i, Math.min(i + KICH_THUOC_LO_IN, ids.size()));
            List<TonKhoTheoLo> tonList = tonKhoTheoLoRepository.findByKhoAndBienTheIds(khoId, lo);
            Map<Integer, BigDecimal> dangGiu;
            Map<Integer, BigDecimal> khongKiemKe = null;
            if (xetKiemKe) {
                // Đọc một lần, tách vế phiếu và vế đang kiểm kê: biết mã nào bị kiểm kê làm giảm số bán được
                LoDangGiuService.DangGiuTach tach = dangGiuTachCuaLoConHang(khoId, tonList);
                dangGiu = tach.tong();
                khongKiemKe = tach.kiemKe().isEmpty() ? null : tach.phieu();
            } else {
                dangGiu = dangGiuCuaLoConHang(khoId, tonList);
            }
            // Phân bổ lô của phiếu nhặt chuyển kho đang mở đã nằm trong dangGiu: giữ chỗ chỉ tính phần còn lại
            Map<Integer, BigDecimal> giuCho = giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(khoId, lo);
            Map<Integer, List<TonKhoTheoLo>> theoMa = tonList.stream()
                    .collect(Collectors.groupingBy(t -> t.getLoHang().getBienTheSanPham().getId()));
            for (Integer id : lo) {
                BigDecimal so = banDuoc(theoMa.get(id), dangGiu, giuCho.get(id));
                ketQua.put(id, so);
                if (khongKiemKe != null && banDuoc(theoMa.get(id), khongKiemKe, giuCho.get(id)).compareTo(so) > 0) {
                    dangKiemKe.add(id);
                }
            }
        }
        return new BanDuocKemKiemKe(ketQua, dangKiemKe);
    }

    /** Như dangGiuCuaLoConHang nhưng tách vế phiếu và vế đang kiểm kê (LoDangGiuService.dangGiuTachKiemKe). */
    private LoDangGiuService.DangGiuTach dangGiuTachCuaLoConHang(Integer khoId, List<TonKhoTheoLo> tonList) {
        List<Integer> loConHang = tonList.stream()
                .filter(t -> LoDangGiuService.conLai(t, Map.of()).signum() > 0)
                .map(t -> t.getLoHang().getId())
                .distinct()
                .toList();
        Map<Integer, BigDecimal> phieu = new HashMap<>();
        Map<Integer, BigDecimal> kiemKe = new HashMap<>();
        for (int i = 0; i < loConHang.size(); i += KICH_THUOC_LO_IN) {
            LoDangGiuService.DangGiuTach phan = loDangGiuService.dangGiuTachKiemKe(khoId,
                    loConHang.subList(i, Math.min(i + KICH_THUOC_LO_IN, loConHang.size())));
            phieu.putAll(phan.phieu());
            kiemKe.putAll(phan.kiemKe());
        }
        return new LoDangGiuService.DangGiuTach(phieu, kiemKe);
    }

    /**
     * Kho đang kiểm toàn bộ: mọi lô đều thuộc phạm vi (phần đang kiểm = cả tồn) nên số bán được của mọi mã là 0 — không
     * cần tính theo lô. Mã còn hàng (tồn − đã đặt &gt; 0 ở một lô nào đó) mang cờ đang kiểm kê để quầy ghi "Kiểm" thay
     * cho "Hết". Một truy vấn cho mỗi {@link #KICH_THUOC_LO_IN} mã.
     */
    private BanDuocKemKiemKe kiemToanKho(Integer khoId, Collection<Integer> bienTheIds) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        Set<Integer> dangKiemKe = new HashSet<>();
        List<Integer> ids = bienTheIds.stream().filter(Objects::nonNull).distinct().toList();
        for (int i = 0; i < ids.size(); i += KICH_THUOC_LO_IN) {
            List<Integer> lo = ids.subList(i, Math.min(i + KICH_THUOC_LO_IN, ids.size()));
            for (TonKhoTheoLo t : tonKhoTheoLoRepository.findByKhoAndBienTheIds(khoId, lo)) {
                if (LoDangGiuService.conLai(t, Map.of()).signum() > 0) {
                    dangKiemKe.add(t.getLoHang().getBienTheSanPham().getId());
                }
            }
            lo.forEach(id -> ketQua.put(id, BigDecimal.ZERO));
        }
        return new BanDuocKemKiemKe(ketQua, dangKiemKe);
    }

    /**
     * Phần phiếu nhặt / phiếu xuất bán đang giữ theo lô, chỉ hỏi cho lô còn hàng (tồn − đã đặt &gt; 0): lô còn lại ≤ 0 thì
     * công thức đằng nào cũng ra 0, không cần đưa vào mệnh đề IN. Danh sách lô dài thì chia từng phần {@link #KICH_THUOC_LO_IN}.
     */
    private Map<Integer, BigDecimal> dangGiuCuaLoConHang(Integer khoId, List<TonKhoTheoLo> tonList) {
        List<Integer> loConHang = tonList.stream()
                .filter(t -> LoDangGiuService.conLai(t, Map.of()).signum() > 0)
                .map(t -> t.getLoHang().getId())
                .distinct()
                .toList();
        Map<Integer, BigDecimal> dangGiu = new HashMap<>();
        for (int i = 0; i < loConHang.size(); i += KICH_THUOC_LO_IN) {
            dangGiu.putAll(loDangGiuService.dangGiuTheoLo(khoId,
                    loConHang.subList(i, Math.min(i + KICH_THUOC_LO_IN, loConHang.size())), null, null));
        }
        return dangGiu;
    }

    /**
     * Trong số {@code bienTheIds}, chỉ các mã đang bị giữ ở kho (lô bị phiếu nhặt mở / phiếu xuất bán chưa xuất giữ, hoặc
     * nằm trên phiếu chuyển giữ chỗ) kèm số bán được tính lại theo lô. Mã không có trong kết quả thì số SQL của danh mục
     * (Σ theo lô max(0, tồn − đã đặt)) đã đúng bằng công thức. Tập mã bị giữ lấy theo kho (3 truy vấn nhỏ), không theo
     * danh sách mã, nên danh mục nhiều nghìn mã vẫn chỉ nạp lô của vài mã.
     */
    public Map<Integer, BigDecimal> banDuocCuaMaDangGiu(Integer khoId, Collection<Integer> bienTheIds) {
        return banDuocCuaMaDangGiuKemKiemKe(khoId, bienTheIds).soLuong();
    }

    /**
     * Như {@link #banDuocCuaMaDangGiu}, kèm tập mã đang bị kiểm kê làm giảm số bán được. Kho đang có đợt kiểm kê (đang
     * kiểm / chờ duyệt) thì tính lại MỌI mã truyền vào: phần đang kiểm kê không có trong số SQL của danh mục, bỏ qua thì
     * danh mục hiện "Còn 48" mà thanh toán báo còn 0.
     */
    public BanDuocKemKiemKe banDuocCuaMaDangGiuKemKiemKe(Integer khoId, Collection<Integer> bienTheIds) {
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return new BanDuocKemKiemKe(new HashMap<>(), new HashSet<>());
        }
        List<KhoaKiemKeGuard.DotDangKiem> dots = khoaKiemKeGuard == null ? List.of() : khoaKiemKeGuard.dotDangKiem(khoId);
        if (!dots.isEmpty()) {
            return dots.stream().anyMatch(d -> IKiemKe.TOAN_BO.equals(d.loai()))
                    ? kiemToanKho(khoId, bienTheIds) : banDuocTaiQuay(khoId, bienTheIds, true);
        }
        Set<Integer> dangGiu = new HashSet<>(loDangGiuService.bienTheDangGiuTaiKho(khoId));
        dangGiu.addAll(giuChoChuyenKhoService.bienTheGiuChoTaiKho(khoId));
        if (dangGiu.isEmpty()) {
            return new BanDuocKemKiemKe(new HashMap<>(), new HashSet<>());
        }
        List<Integer> canTinh = bienTheIds.stream().filter(Objects::nonNull).filter(dangGiu::contains).distinct().toList();
        return canTinh.isEmpty() ? new BanDuocKemKiemKe(new HashMap<>(), new HashSet<>())
                : banDuocTaiQuay(khoId, canTinh, false);
    }
}
