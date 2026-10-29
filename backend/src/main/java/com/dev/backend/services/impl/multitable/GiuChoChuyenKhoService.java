package com.dev.backend.services.impl.multitable;

import com.dev.backend.repository.ChiTietPhieuChuyenKhoRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Hàng phiếu chuyển kho đang giữ chỗ ở kho nguồn (đặc tả BA, ma trận 3.2): phiếu Chờ duyệt / Đã duyệt giữ chỗ số lượng
 * yêu cầu chưa chọn lô. Giữ ở mức biến thể vì lúc tạo chưa có lô; phần đã chọn lô nằm trong so_luong_da_dat của lô.
 * Dùng chung cho mọi nơi tính khả dụng của một kho: kiểm tồn khi tạo / duyệt phiếu chuyển, số đẩy lên sàn, gợi ý kho
 * cho đơn bán, thanh toán POS. Chỉ đọc, không khóa.
 */
@Service
public class GiuChoChuyenKhoService {

    private final ChiTietPhieuChuyenKhoRepository chiTietPhieuChuyenKhoRepository;

    public GiuChoChuyenKhoService(ChiTietPhieuChuyenKhoRepository chiTietPhieuChuyenKhoRepository) {
        this.chiTietPhieuChuyenKhoRepository = chiTietPhieuChuyenKhoRepository;
    }

    /**
     * Đang giữ chỗ ở một kho, theo biến thể (mã không có ra 0 khi đọc bằng getOrDefault). Giữ đủ, kể cả phần phiếu nhặt
     * của PX-CK đang giữ theo lô: dùng ở nơi không trừ phân bổ phiếu nhặt (xem {@link #taiKhoNgoaiPhieuNhat}).
     */
    public Map<Integer, BigDecimal> taiKho(Integer khoId, Collection<Integer> bienTheIds) {
        return taiKho(khoId, bienTheIds, null);
    }

    /** Như {@link #taiKho(Integer, Collection)} nhưng không tính phiếu {@code boQuaPhieuId} (phiếu đang xét). */
    public Map<Integer, BigDecimal> taiKho(Integer khoId, Collection<Integer> bienTheIds, Integer boQuaPhieuId) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        for (Object[] row : chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(ids(bienTheIds), khoId, boQuaPhieuId)) {
            ketQua.merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
        }
        return ketQua;
    }

    /**
     * Phần giữ chỗ ở một kho CHƯA nằm trong phân bổ lô của phiếu nhặt đang mở (phiếu nhặt của PX-CK, đặc tả bước 8):
     * giữ chỗ = max(0, số chuyển − lô đã ghi trên PX-CK − phân bổ phiếu nhặt mở). Chỉ dùng ở nơi đã trừ phân bổ phiếu nhặt
     * theo lô (LoDangGiuService.dangGiuTheoLo): số bán tại quầy, thanh toán POS — trừ đủ ở đó nữa là trừ hai lần. Nơi
     * không trừ phân bổ phiếu nhặt (khả dụng chuyển kho, gợi ý kho đơn bán, tồn đẩy sàn) dùng {@link #taiKho}.
     */
    public Map<Integer, BigDecimal> taiKhoNgoaiPhieuNhat(Integer khoId, Collection<Integer> bienTheIds) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (khoId == null || bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        for (Object[] row : chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(ids(bienTheIds), khoId, null, true)) {
            ketQua.merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
        }
        return ketQua;
    }

    /** Biến thể đang nằm trên phiếu chuyển giữ chỗ ở một kho (có thể thừa mã đã chọn lô hết, giữ chỗ thực = 0). */
    public Set<Integer> bienTheGiuChoTaiKho(Integer khoId) {
        if (khoId == null) return new HashSet<>();
        return new HashSet<>(chiTietPhieuChuyenKhoRepository.bienTheGiuChoTaiKho(khoId));
    }

    /** Đang giữ chỗ theo [biến thể → [kho nguồn → số lượng]] ở mọi kho. */
    public Map<Integer, Map<Integer, BigDecimal>> theoKho(Collection<Integer> bienTheIds) {
        Map<Integer, Map<Integer, BigDecimal>> ketQua = new HashMap<>();
        if (bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        for (Object[] row : chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(ids(bienTheIds), null, null)) {
            ketQua.computeIfAbsent((Integer) row[0], k -> new HashMap<>())
                    .merge((Integer) row[1], soLuong(row[2]), BigDecimal::add);
        }
        return ketQua;
    }

    /** Tổng đang giữ chỗ của mỗi biến thể trên toàn chuỗi (mọi kho nguồn). */
    public Map<Integer, BigDecimal> toanChuoi(Collection<Integer> bienTheIds) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (bienTheIds == null || bienTheIds.isEmpty()) return ketQua;
        for (Object[] row : chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(ids(bienTheIds), null, null)) {
            ketQua.merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
        }
        return ketQua;
    }

    private static List<Integer> ids(Collection<Integer> bienTheIds) {
        return new ArrayList<>(new LinkedHashSet<>(bienTheIds));
    }

    private static BigDecimal soLuong(Object value) {
        if (value == null) return BigDecimal.ZERO;
        return value instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) value).doubleValue());
    }
}
