package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.PhanBoLoNhatHangRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * Lượng đang bị phiếu nhặt đang mở và phiếu xuất bán chưa xuất giữ trên từng lô của một kho.
     *
     * @param boQuaPhieuNhatId phiếu nhặt không tính (phiếu đang sửa phân bổ của chính nó), có thể null
     * @param boQuaPhieuXuatId phiếu xuất không tính (phiếu đang sửa lô của chính nó), có thể null
     */
    public Map<Integer, BigDecimal> dangGiuTheoLo(Integer khoId, Collection<Integer> loHangIds,
                                                  Integer boQuaPhieuNhatId, Integer boQuaPhieuXuatId) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || loHangIds == null || loHangIds.isEmpty()) {
            return ketQua;
        }
        cong(ketQua, phanBoLoNhatHangRepository.sumDangGiuTheoLo(khoId, loHangIds, boQuaPhieuNhatId));
        cong(ketQua, chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(khoId, loHangIds, boQuaPhieuXuatId));
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
