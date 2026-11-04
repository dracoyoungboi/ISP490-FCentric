package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.ThueSuatGtgt;
import com.dev.backend.repository.ThueSuatGtgtRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;

/**
 * Thuế GTGT trên hóa đơn bán hàng. Thuế suất lấy từ mức chung của bảng thue_suat_gtgt (Cấu hình › Thuế GTGT) — cùng
 * bảng xuất kế toán dùng, nên hóa đơn in và chứng từ kế toán chung một nguồn.
 * Chụp vào đơn lúc chốt (bán tại quầy, tạo đơn bán, chuyển báo giá thành đơn) khi bật "In thuế GTGT"; đơn bán thường
 * chụp lại theo ngày giao hàng khi xuất đủ hàng (thuế suất tính theo lúc giao hàng, giống xuất kế toán). Giá đã gồm
 * thuế: tiền thuế tách ngược từ tổng cộng, số khách trả không đổi. Không có mức chung ở ngày đó thì đơn không mang thuế.
 */
@Slf4j
@Service
public class ThueGtgtService {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final DieuHanhHeThongService cauHinh;
    private final ThueSuatGtgtRepository thueSuatRepository;

    public ThueGtgtService(DieuHanhHeThongService cauHinh, ThueSuatGtgtRepository thueSuatRepository) {
        this.cauHinh = cauHinh;
        this.thueSuatRepository = thueSuatRepository;
    }

    /** Ghi thuế suất và tiền thuế vào đơn (chưa lưu — bên gọi lưu). luc: thời điểm chốt (null = bây giờ). */
    public void chup(DonBanHang don, Instant luc) {
        don.setThueSuatGtgt(null);
        don.setTienThueGtgt(null);
        if (!cauHinh.getCauHinhBoolean(DieuHanhHeThongServiceImpl.CAU_HINH_VAT_BAT, false)) return;
        LocalDate ngay = (luc == null ? Instant.now() : luc).atZone(VN).toLocalDate();
        BigDecimal ts = mucChung(ngay);
        if (ts == null) {
            log.warn("[ThueGtgt] Chưa có mức chung ngày {}: đơn {} không mang thuế", ngay, don.getSoDonHang());
            return;
        }
        don.setThueSuatGtgt(ts);
        don.setTienThueGtgt(ThueGtgt.tienThue(don.getTongCong(), ts));
    }

    /**
     * Đơn đã mang thuế lúc chốt: tính lại theo ngày giao hàng (gọi ngay sau khi ghi ngày giao). Đơn chốt trước ngày đổi
     * thuế suất mà giao sau đó thì hóa đơn in theo mức lúc giao, khớp xuất kế toán. Đơn không mang thuế (tắt in thuế lúc
     * chốt, đơn sàn) giữ nguyên; ngày giao chưa có mức chung thì giữ mức đã chụp.
     */
    public void chupLaiTheoNgayGiao(DonBanHang don) {
        if (don.getThueSuatGtgt() == null || don.getNgayGiaoHang() == null) return;
        LocalDate ngay = don.getNgayGiaoHang().atZone(VN).toLocalDate();
        BigDecimal ts = mucChung(ngay);
        if (ts == null) {
            log.warn("[ThueGtgt] Chưa có mức chung ngày giao {}: đơn {} giữ thuế {}% lúc chốt", ngay, don.getSoDonHang(),
                    don.getThueSuatGtgt().stripTrailingZeros().toPlainString());
            return;
        }
        if (ts.compareTo(don.getThueSuatGtgt()) == 0) return;
        don.setThueSuatGtgt(ts);
        don.setTienThueGtgt(ThueGtgt.tienThue(don.getTongCong(), ts));
    }

    /** Mức chung (dòng không danh mục) có hiệu lực vào ngày cho trước; null = chưa có. */
    BigDecimal mucChung(LocalDate ngay) {
        return thueSuatRepository.findByDanhMucIsNull().stream()
                .filter(t -> !t.getHieuLucTu().isAfter(ngay) && (t.getHieuLucDen() == null || !t.getHieuLucDen().isBefore(ngay)))
                .max(Comparator.comparing(ThueSuatGtgt::getHieuLucTu))
                .map(ThueSuatGtgt::getTyLe)
                .orElse(null);
    }
}
