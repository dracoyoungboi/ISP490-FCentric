package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.DonBanHang;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Chụp thuế GTGT vào đơn lúc chốt (bán tại quầy, tạo đơn bán, chuyển báo giá thành đơn): bật "In thuế GTGT" thì đơn
 * mang thuế suất có hiệu lực vào ngày chốt và tiền thuế tách ngược từ tổng cộng. Đổi cấu hình sau đó không đổi hóa đơn
 * đã bán. Tắt, hoặc lịch thuế suất hỏng (không chặn bán hàng), thì đơn không mang thuế.
 */
@Slf4j
@Service
public class ThueGtgtService {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final DieuHanhHeThongService cauHinh;

    public ThueGtgtService(DieuHanhHeThongService cauHinh) {
        this.cauHinh = cauHinh;
    }

    /** Ghi thuế suất và tiền thuế vào đơn (chưa lưu — bên gọi lưu). luc: thời điểm chốt (null = bây giờ). */
    public void chup(DonBanHang don, Instant luc) {
        don.setThueSuatGtgt(null);
        don.setTienThueGtgt(null);
        if (!cauHinh.getCauHinhBoolean(DieuHanhHeThongServiceImpl.CAU_HINH_VAT_BAT, false)) return;
        BigDecimal ts;
        try {
            List<ThueGtgt.Muc> lich = ThueGtgt.docLich(cauHinh.getCauHinhString(
                    DieuHanhHeThongServiceImpl.CAU_HINH_VAT_LICH, ThueGtgt.LICH_MAC_DINH));
            ts = ThueGtgt.thueSuatTai(lich, (luc == null ? Instant.now() : luc).atZone(VN).toLocalDate());
        } catch (RuntimeException e) {
            log.warn("[ThueGtgt] Lịch thuế suất hỏng, đơn {} không mang thuế: {}", don.getSoDonHang(), e.getMessage());
            return;
        }
        if (ts == null) return;
        don.setThueSuatGtgt(ts);
        don.setTienThueGtgt(ThueGtgt.tienThue(don.getTongCong(), ts));
    }

    /** Thuế suất đang áp dụng hôm nay (null = không in thuế), cho màn cấu hình. */
    public BigDecimal thueSuatHomNay() {
        if (!cauHinh.getCauHinhBoolean(DieuHanhHeThongServiceImpl.CAU_HINH_VAT_BAT, false)) return null;
        try {
            return ThueGtgt.thueSuatTai(ThueGtgt.docLich(cauHinh.getCauHinhString(
                    DieuHanhHeThongServiceImpl.CAU_HINH_VAT_LICH, ThueGtgt.LICH_MAC_DINH)), LocalDate.now(VN));
        } catch (RuntimeException e) {
            return null;
        }
    }
}
