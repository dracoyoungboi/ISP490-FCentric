package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.TonKhoTheoLoRepository;
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
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return ketQua;
        }
        List<Integer> ids = bienTheIds.stream().filter(Objects::nonNull).distinct().toList();
        for (int i = 0; i < ids.size(); i += KICH_THUOC_LO_IN) {
            List<Integer> lo = ids.subList(i, Math.min(i + KICH_THUOC_LO_IN, ids.size()));
            List<TonKhoTheoLo> tonList = tonKhoTheoLoRepository.findByKhoAndBienTheIds(khoId, lo);
            Map<Integer, BigDecimal> dangGiu = dangGiuCuaLoConHang(khoId, tonList);
            // Phân bổ lô của phiếu nhặt chuyển kho đang mở đã nằm trong dangGiu: giữ chỗ chỉ tính phần còn lại
            Map<Integer, BigDecimal> giuCho = giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(khoId, lo);
            Map<Integer, List<TonKhoTheoLo>> theoMa = tonList.stream()
                    .collect(Collectors.groupingBy(t -> t.getLoHang().getBienTheSanPham().getId()));
            for (Integer id : lo) {
                ketQua.put(id, banDuoc(theoMa.get(id), dangGiu, giuCho.get(id)));
            }
        }
        return ketQua;
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
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return new HashMap<>();
        }
        Set<Integer> dangGiu = new HashSet<>(loDangGiuService.bienTheDangGiuTaiKho(khoId));
        dangGiu.addAll(giuChoChuyenKhoService.bienTheGiuChoTaiKho(khoId));
        if (dangGiu.isEmpty()) {
            return new HashMap<>();
        }
        List<Integer> canTinh = bienTheIds.stream().filter(Objects::nonNull).filter(dangGiu::contains).distinct().toList();
        return canTinh.isEmpty() ? new HashMap<>() : banDuocTaiQuay(khoId, canTinh);
    }
}
