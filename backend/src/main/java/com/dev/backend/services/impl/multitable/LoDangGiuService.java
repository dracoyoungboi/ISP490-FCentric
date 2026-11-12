package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.PhanBoLoNhatHangRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Số còn lại của một lô dùng chung cho phân bổ lô ở phiếu nhặt, chọn lô chuyển kho / sửa lô phiếu xuất và POS:
 * <pre>còn lại = tồn − đang giữ (so_luong_da_dat) − phân bổ của phiếu nhặt đang mở − dòng lô của phiếu xuất bán chưa xuất</pre>
 * Phần giữ của phiếu nhặt / phiếu xuất bán KHÔNG cộng vào so_luong_da_dat: tồn đẩy lên sàn đã trừ theo đơn đang
 * giữ hàng (TonKhoTongHopRepository.sumTongFreeToUseToanChuoi), cộng nữa là trừ hai lần.
 */
@Service
public class LoDangGiuService {

    /** Thứ tự FIFO: lô nhập vào kho sớm nhất trước, cùng ngày thì lô tạo trước. */
    public static final Comparator<TonKhoTheoLo> FIFO = Comparator
            .comparing((TonKhoTheoLo t) -> t.getNgayNhapGanNhat() == null ? Instant.MAX : t.getNgayNhapGanNhat())
            .thenComparing(t -> t.getLoHang().getId());

    @Autowired
    private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;

    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private EntityManager entityManager;

    /** Null khi unit test dựng tay. */
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;

    /**
     * Lượng đang bị phiếu nhặt đang mở và phiếu xuất bán chưa xuất giữ trên từng lô của một kho.
     *
     * @param boQuaPhieuNhatId phiếu nhặt không tính (phiếu đang sửa phân bổ của chính nó), có thể null
     * @param boQuaPhieuXuatId phiếu xuất không tính (phiếu đang sửa lô của chính nó), có thể null
     */
    public Map<Integer, BigDecimal> dangGiuTheoLo(Integer khoId, Collection<Integer> loHangIds,
                                                  Integer boQuaPhieuNhatId, Integer boQuaPhieuXuatId) {
        Map<Integer, BigDecimal> ketQua = dangGiuPhieu(khoId, loHangIds, boQuaPhieuNhatId, boQuaPhieuXuatId);
        if (khoId == null || loHangIds == null || loHangIds.isEmpty()) {
            return ketQua;
        }
        // Phần đang kiểm kê (kệ đang khóa, danh mục đang kiểm, kho kiểm toàn bộ) không được lấy: POS, phân bổ nhặt FIFO và
        // chọn lô tự lấy ở kệ tự do (đặc tả kiểm kê khoanh vùng AC-22)
        if (khoaKiemKeGuard != null) {
            khoaKiemKeGuard.luongDangKiemKe(khoId, loHangIds).forEach((lo, sl) -> ketQua.merge(lo, sl, BigDecimal::add));
        }
        return ketQua;
    }

    /** Phần phiếu nhặt đang mở + phiếu xuất bán chưa xuất giữ theo lô (chưa gồm phần đang kiểm kê). */
    private Map<Integer, BigDecimal> dangGiuPhieu(Integer khoId, Collection<Integer> loHangIds,
                                                  Integer boQuaPhieuNhatId, Integer boQuaPhieuXuatId) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || loHangIds == null || loHangIds.isEmpty()) {
            return ketQua;
        }
        cong(ketQua, phanBoLoNhatHangRepository.sumDangGiuTheoLo(khoId, loHangIds, boQuaPhieuNhatId));
        cong(ketQua, chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(khoId, loHangIds, boQuaPhieuXuatId));
        return ketQua;
    }

    /** Phần đang giữ theo lô tách hai vế: phiếu (nhặt / xuất bán) và đang kiểm kê. {@link #tong()} = dangGiuTheoLo. */
    public record DangGiuTach(Map<Integer, BigDecimal> phieu, Map<Integer, BigDecimal> kiemKe) {
        public Map<Integer, BigDecimal> tong() {
            Map<Integer, BigDecimal> ketQua = new HashMap<>(phieu);
            kiemKe.forEach((lo, sl) -> ketQua.merge(lo, sl, BigDecimal::add));
            return ketQua;
        }
    }

    /**
     * Như dangGiuTheoLo (không bỏ qua phiếu nào) nhưng trả riêng phần đang kiểm kê: quầy biết mã nào bị kiểm kê làm
     * giảm số bán được mà không phải đọc chốt chặn kiểm kê lần hai.
     */
    public DangGiuTach dangGiuTachKiemKe(Integer khoId, Collection<Integer> loHangIds) {
        Map<Integer, BigDecimal> phieu = dangGiuPhieu(khoId, loHangIds, null, null);
        Map<Integer, BigDecimal> kiemKe = khoaKiemKeGuard == null || khoId == null || loHangIds == null || loHangIds.isEmpty()
                ? new HashMap<>() : khoaKiemKeGuard.luongDangKiemKe(khoId, loHangIds);
        return new DangGiuTach(phieu, kiemKe);
    }

    /**
     * Biến thể có lô đang bị phiếu nhặt đang mở / phiếu xuất bán chưa xuất giữ ở một kho (cùng điều kiện với
     * dangGiuTheoLo, không cần danh sách lô). Mã ngoài tập này có phần giữ theo lô bằng 0 ở kho đó.
     */
    public Set<Integer> bienTheDangGiuTaiKho(Integer khoId) {
        Set<Integer> ketQua = new HashSet<>();
        if (khoId == null) {
            return ketQua;
        }
        ketQua.addAll(phanBoLoNhatHangRepository.bienTheDangGiuTaiKho(khoId));
        ketQua.addAll(chiTietPhieuXuatKhoRepository.bienTheDangGiuPhieuBanChuaXuat(khoId));
        return ketQua;
    }

    /**
     * Còn lại theo biến thể ở một kho (chỉ đọc, không khóa): Σ theo lô max(0, còn lại). Đúng phép phân bổ lô khi tạo
     * phiếu nhặt, nên dùng cho cờ "Đủ hàng" ở màn Đơn chờ xuất. Lô âm (dữ liệu lệch) tính 0, không bù cho lô khác.
     * Không trừ lượng chờ xuất của các đơn chưa vào phiếu nhặt: các đơn đó chưa giữ lô nào.
     */
    public Map<Integer, BigDecimal> conLaiTheoBienThe(Integer khoId, Collection<Integer> bienTheIds) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return ketQua;
        }
        List<TonKhoTheoLo> tonList = tonKhoTheoLoRepository.findByKhoAndBienTheIds(khoId, bienTheIds);
        Map<Integer, BigDecimal> dangGiu = dangGiuTheoLo(khoId,
                tonList.stream().map(t -> t.getLoHang().getId()).toList(), null, null);
        for (TonKhoTheoLo t : tonList) {
            ketQua.merge(t.getLoHang().getBienTheSanPham().getId(), conLai(t, dangGiu).max(BigDecimal.ZERO), BigDecimal::add);
        }
        return ketQua;
    }

    /** Còn lại của lô sau khi trừ đang giữ (so_luong_da_dat) và phần phiếu nhặt / phiếu xuất bán giữ. */
    public static BigDecimal conLai(TonKhoTheoLo t, Map<Integer, BigDecimal> dangGiu) {
        BigDecimal ton = t.getSoLuongTon() != null ? t.getSoLuongTon() : BigDecimal.ZERO;
        BigDecimal dat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
        BigDecimal giu = dangGiu.getOrDefault(t.getLoHang().getId(), BigDecimal.ZERO);
        return ton.subtract(dat).subtract(giu);
    }

    /**
     * Khóa (PESSIMISTIC_WRITE, theo PK tăng dần như mọi luồng ghi tồn) các dòng tồn của kho + biến thể rồi nạp lại
     * số mới nhất: với open-in-view, dòng đã nạp trước đó trong request vẫn là bản cũ.
     */
    public List<TonKhoTheoLo> khoaTonTheoBienThe(Integer khoId, Collection<Integer> bienTheIds) {
        if (bienTheIds == null || bienTheIds.isEmpty()) {
            return List.of();
        }
        // Đ5: giữ mutex kho (chia sẻ) trước khi khóa tồn, để không chen giữa lúc một đợt kiểm kê đang bắt đầu / duyệt
        if (khoaKiemKeGuard != null) khoaKiemKeGuard.giuKho(khoId);
        List<TonKhoTheoLo> rows = tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(khoId, bienTheIds);
        for (TonKhoTheoLo t : rows) {
            entityManager.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        }
        return rows;
    }

    private static void cong(Map<Integer, BigDecimal> dich, List<Object[]> rows) {
        for (Object[] row : rows) {
            Integer loHangId = (Integer) row[0];
            BigDecimal soLuong = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            dich.merge(loHangId, soLuong, BigDecimal::add);
        }
    }
}
