package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.TonKhoTongQuanDong;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService.KhaDungChuyen;
import com.dev.backend.services.impl.entities.TonKhoTheoLoService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ThongKeHeThongServiceImpl implements ThongKeHeThongService {

    @Autowired
    private TonKhoTheoLoService tonKhoTheoLoService;
    @Autowired
    private TonKhoTongHopRepository tonKhoTongHopRepository;
    @Autowired
    private TongQuanAdminRepository tongQuanAdminRepository;
    @Autowired
    private KhaDungChuyenKhoService khaDungChuyenKhoService;


    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByKho(Integer khoId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByKho(khoId))
                        .message("Success")
                        .build()
        );
    }

    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienThe(Integer bienTheId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByBienThe(bienTheId))
                        .message("Success")
                        .build()
        );
    }

    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienTheAndKho(Integer bienTheId, Integer khoId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByBienTheAndKho(bienTheId, khoId))
                        .message("Success")
                        .build()
        );
    }

    //dùng dể search theo SKU, mã SP, tên sản phẩm (truyền ID kho vào)
    @Override
    public ResponseEntity<ResponseData<List<TonKhoTongQuanDong>>> tonKhoTongHop(Integer khoId, String keyword) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoTongQuanDong>>builder()
                        .status(HttpStatus.OK.value())
                        .data(getTonKhoTongHop(khoId, keyword))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * Toàn bộ biến thể × kho của Báo cáo tồn kho, kèm mức tồn và đề xuất bổ sung tính như Tổng quan:
     * - mức tồn theo khả dụng (tồn − đang giữ), ngưỡng mặc định DEFAULT_MIN_STOCK_ALERT khi sản phẩm chưa đặt mức,
     *   hệ số dư SURPLUS_STOCK_RATIO; cặp chưa từng có lô và kho trung chuyển không xếp mức (Tổng quan cũng không đếm);
     * - đề xuất (chuyển từ Kho tổng hoặc yêu cầu nhập, kèm số lượng) cho dòng Hết hàng / Thiếu hàng, số Kho tổng có thể
     *   chuyển lấy từ KhaDungChuyenKhoService như khi tạo yêu cầu chuyển kho.
     */
    @Override
    public List<TonKhoTongQuanDong> getTonKhoTongHop(Integer khoId, String keyword) {
        List<TonKhoProjection> rows = tonKhoTongHopRepository.findTonKhoTongHop(khoId, keyword);
        int nguongMacDinh = cauHinh("DEFAULT_MIN_STOCK_ALERT", TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH);
        int heSoDu = cauHinh("SURPLUS_STOCK_RATIO", TongQuanAdminServiceImpl.HE_SO_DU_MAC_DINH);
        // Cùng thứ tự với Tổng quan (Kho tổng trước, rồi theo id): nhiều Kho tổng thì cùng chọn kho đầu tiên làm nơi chuyển
        Map<Integer, KhoDong> khoTheoId = new LinkedHashMap<>();
        boolean loiKho = false;
        try {
            tongQuanAdminRepository.danhSachKho().forEach(k -> khoTheoId.put(k.id(), k));
        } catch (RuntimeException e) {
            loiKho = true;
        }
        KhoDong khoTong = khoTheoId.values().stream().filter(KhoDong::laKhoTong).findFirst().orElse(null);

        List<String> tinhTrang = new ArrayList<>(rows.size());
        Set<Integer> canSoKhoTong = new LinkedHashSet<>();
        for (TonKhoProjection r : rows) {
            // Kho trung chuyển và cặp chưa từng có lô không xếp mức (truy vấn đã chỉ lấy kho đang hoạt động)
            boolean xepMuc = !MA_KHO_TRUNG_CHUYEN.equals(r.getMaKho()) && r.getSoDongTon() != null && r.getSoDongTon() > 0;
            String tt = xepMuc
                    ? TongQuanAdminServiceImpl.tinhTrangTon(r.getKhaDung(), TongQuanAdminServiceImpl.nguongDung(r.getMucTonToiThieu(), nguongMacDinh), heSoDu)
                    : null;
            tinhTrang.add(tt);
            if (canBoSung(tt) && khoTong != null && !laKhoTong(khoTheoId, r.getKhoId())) canSoKhoTong.add(r.getBienTheId());
        }
        // Không tra được số Kho tổng có thể chuyển (hoặc danh sách kho) thì bỏ đề xuất, vẫn giữ mức tồn: báo cáo không vì
        // phần phụ này mà lỗi cả trang, và không đề xuất "Yêu cầu nhập" sai khi lẽ ra chuyển được
        Map<Integer, KhaDungChuyen> khoTongCoTheChuyen = Map.of();
        boolean loiKhoTong = loiKho;
        if (khoTong != null && !canSoKhoTong.isEmpty()) {
            try {
                khoTongCoTheChuyen = khaDungChuyenKhoService.theoBienThe(khoTong.id(), List.copyOf(canSoKhoTong));
            } catch (RuntimeException e) {
                loiKhoTong = true;
            }
        }

        List<TonKhoTongQuanDong> ketQua = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            TonKhoProjection r = rows.get(i);
            String tt = tinhTrang.get(i);
            int nguong = TongQuanAdminServiceImpl.nguongDung(r.getMucTonToiThieu(), nguongMacDinh);
            boolean laKhoTong = laKhoTong(khoTheoId, r.getKhoId());
            String deXuat = null;
            Long soLuongDeXuat = null, khaDungKhoTong = null, choXuatKhoTong = null;
            if (canBoSung(tt) && !(loiKhoTong && !laKhoTong)) {
                KhaDungChuyen kt = laKhoTong ? null : khoTongCoTheChuyen.get(r.getBienTheId());
                // Làm tròn xuống như khối Cần bổ sung của Tổng quan: số điền sẵn luôn tạo được phiếu chuyển
                khaDungKhoTong = kt == null ? null : kt.khaDung().setScale(0, RoundingMode.FLOOR).longValue();
                choXuatKhoTong = kt == null ? null : TongQuanAdminServiceImpl.so(kt.choXuat());
                long n = TongQuanAdminServiceImpl.soLuongDeXuat(TongQuanAdminServiceImpl.so(r.getKhaDung()), nguong);
                soLuongDeXuat = n;
                deXuat = TongQuanAdminServiceImpl.deXuat(laKhoTong, khaDungKhoTong, n);
            }
            ketQua.add(new TonKhoTongQuanDong(r.getBienTheId(), r.getMaSku(), r.getMaSanPham(), r.getTenSanPham(),
                    r.getTenMau(), r.getMaSize(), r.getTenChatLieu(), r.getMucTonToiThieu(), r.getKhoId(), r.getTenKho(),
                    r.getOnHand(), r.getIncoming(), r.getOutgoing(), r.getFreeToUse(), r.getTongGiaTri(),
                    r.getKhaDung(), nguong, r.getMucTonToiThieu() == null || r.getMucTonToiThieu() <= 0, tt, laKhoTong,
                    deXuat, soLuongDeXuat, khaDungKhoTong, choXuatKhoTong));
        }
        return ketQua;
    }

    private static final String MA_KHO_TRUNG_CHUYEN = "KHO_TRANSIT";

    /** Kho là Kho tổng theo danh sách kho của Tổng quan (như dashboard dùng KhoDong.laKhoTong, kể cả khi có nhiều Kho tổng). */
    private static boolean laKhoTong(Map<Integer, KhoDong> khoTheoId, Integer khoId) {
        KhoDong k = khoTheoId.get(khoId);
        return k != null && k.laKhoTong();
    }

    private static boolean canBoSung(String tinhTrang) {
        return TongQuanAdminServiceImpl.TINH_TRANG_HET_HANG.equals(tinhTrang)
                || TongQuanAdminServiceImpl.TINH_TRANG_THIEU_HANG.equals(tinhTrang);
    }

    /** Cấu hình số của hệ thống; chưa có, không hợp lệ hoặc đọc lỗi thì dùng mặc định (báo cáo vẫn hiện). */
    private int cauHinh(String ma, int macDinh) {
        try {
            return TongQuanAdminServiceImpl.macDinhNeuKhongHopLe(tongQuanAdminRepository.cauHinhSo(ma), macDinh);
        } catch (RuntimeException e) {
            return macDinh;
        }
    }
}
