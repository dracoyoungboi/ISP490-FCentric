package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Lượng có thể chuyển đi của từng mã ở một kho gửi (chỉ đọc, không khóa, không giữ hàng):
 * <pre>có thể chuyển = max(0, (tồn − đang giữ) − max(0, chờ xuất) − phiếu chuyển khác đang giữ chỗ)</pre>
 * Chờ xuất = đặt − đã xuất thật của đơn bán đang giữ hàng (ITrangThaiDonBanHang.DANG_GIU_HANG) có kho xuất là kho gửi,
 * không gồm báo giá: đúng phần của một kho trong tồn đẩy lên sàn (TonKhoTongHopRepository.sumTongFreeToUseToanChuoi),
 * giống gợi ý kho cho đơn bán. Không trừ thêm phần lô phiếu nhặt / phiếu xuất bán đang giữ: phần đó thuộc chính các
 * đơn ấy, đã nằm trong chờ xuất; phân bổ của phiếu nhặt chuyển kho nằm trong giữ chỗ phiếu chuyển (giữ đủ,
 * GiuChoChuyenKhoService.taiKho).
 * Dùng chung cho kiểm tồn khi tạo yêu cầu chuyển kho và đề xuất "Chuyển từ Kho tổng" ở Tổng quan, để hai nơi luôn ra
 * cùng một số. Phiếu chuyển Chờ duyệt / Đã duyệt giữ chỗ ở kho nguồn (đặc tả BA, ma trận 3.2): xem GiuChoChuyenKhoService.
 */
@Service
public class KhaDungChuyenKhoService {

    /**
     * @param tonTruGiu tồn − đang giữ (so_luong_da_dat), chưa cắt về 0
     * @param choXuat   chờ xuất của đơn bán ở kho gửi, âm (dữ liệu lệch) tính 0
     * @param khaDung   lượng có thể chuyển, không âm
     * @param giuChoChuyen phiếu chuyển khác đang giữ chỗ ở kho gửi
     */
    public record KhaDungChuyen(BigDecimal tonTruGiu, BigDecimal choXuat, BigDecimal khaDung, BigDecimal giuChoChuyen) {
        public KhaDungChuyen(BigDecimal tonTruGiu, BigDecimal choXuat, BigDecimal khaDung) {
            this(tonTruGiu, choXuat, khaDung, BigDecimal.ZERO);
        }
    }

    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    private final ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    private final GiuChoChuyenKhoService giuChoChuyenKhoService;

    public KhaDungChuyenKhoService(TonKhoTheoLoRepository tonKhoTheoLoRepository,
                                   ChiTietDonBanHangRepository chiTietDonBanHangRepository,
                                   ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository,
                                   GiuChoChuyenKhoService giuChoChuyenKhoService) {
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.chiTietDonBanHangRepository = chiTietDonBanHangRepository;
        this.chiTietPhieuXuatKhoRepository = chiTietPhieuXuatKhoRepository;
        this.giuChoChuyenKhoService = giuChoChuyenKhoService;
    }

    /**
     * Theo từng mã được hỏi (mã chưa có dòng tồn ở kho gửi ra 0), ba truy vấn cho cả danh sách.
     * Kho hoặc danh sách rỗng thì không truy vấn.
     */
    public Map<Integer, KhaDungChuyen> theoBienThe(Integer khoGuiId, Collection<Integer> bienTheIds) {
        return theoBienThe(khoGuiId, bienTheIds, null);
    }

    /** Như trên nhưng không tính phần giữ chỗ của phiếu chuyển {@code boQuaPhieuChuyenId} (phiếu đang được duyệt). */
    public Map<Integer, KhaDungChuyen> theoBienThe(Integer khoGuiId, Collection<Integer> bienTheIds, Integer boQuaPhieuChuyenId) {
        Map<Integer, KhaDungChuyen> ketQua = new LinkedHashMap<>();
        if (khoGuiId == null || bienTheIds == null || bienTheIds.isEmpty()) {
            return ketQua;
        }
        List<Integer> ids = new ArrayList<>(new LinkedHashSet<>(bienTheIds));
        Map<Integer, BigDecimal> tonTruGiu = new HashMap<>();
        for (Object[] row : tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(khoGuiId, ids)) {
            tonTruGiu.put((Integer) row[0], soLuong(row[1]));
        }
        Map<Integer, BigDecimal> choXuat = new HashMap<>();
        for (Object[] row : chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            if (khoGuiId.equals(row[1])) {
                choXuat.merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
            }
        }
        for (Object[] row : chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            if (khoGuiId.equals(row[1])) {
                choXuat.merge((Integer) row[0], soLuong(row[2]).negate(), BigDecimal::add);
            }
        }
        Map<Integer, BigDecimal> giuCho = giuChoChuyenKhoService.taiKho(khoGuiId, ids, boQuaPhieuChuyenId);
        for (Integer id : ids) {
            BigDecimal ton = tonTruGiu.getOrDefault(id, BigDecimal.ZERO);
            BigDecimal cho = choXuat.getOrDefault(id, BigDecimal.ZERO).max(BigDecimal.ZERO);
            BigDecimal chuyen = giuCho.getOrDefault(id, BigDecimal.ZERO);
            ketQua.put(id, new KhaDungChuyen(ton, cho, ton.subtract(cho).subtract(chuyen).max(BigDecimal.ZERO), chuyen));
        }
        return ketQua;
    }

    private static BigDecimal soLuong(Object value) {
        if (value == null) return BigDecimal.ZERO;
        return value instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) value).doubleValue());
    }
}
