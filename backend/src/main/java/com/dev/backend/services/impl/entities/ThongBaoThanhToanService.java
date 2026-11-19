package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import com.dev.backend.services.impl.entities.ThongBaoService.TomTat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Thông báo về tiền ở quầy, chỉ quản trị viên xử lý được (xử lý giao dịch QR lỗi là quyền quản trị). Service nghiệp vụ
 * gọi ngay sau khi ghi; ở đây chụp giá trị đã có, soạn và ghi sau commit. Không bao giờ ném lỗi.
 * <pre>
 *   Sự kiện                                                Người nhận      Khóa
 *   T1 Đã nhận tiền QR ở quầy nhưng chưa tạo được đơn       Quản trị viên   PAYOS:{orderCode}:PAID_ERROR (một lần mỗi giao dịch)
 * </pre>
 * Câu thông báo không bao giờ chứa lỗi thô của hệ thống (có thể lộ thông tin kỹ thuật).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoThanhToanService {

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;

    /**
     * T1: giao dịch QR vừa chuyển sang PAID_ERROR LẦN ĐẦU (PosPayosTransaction.markPaidError). {@code lyDo}: mã lý do của
     * PosPayosService.lyDo (CHUYEN_THIEU, CHUYEN_DU, TIEN_VE_MUON, CHUA_RO_SO_TIEN, LOI_TAO_DON).
     */
    public void qrDaNhanTienChuaTaoDon(PosPayosPayment row, String lyDo, boolean lanDau) {
        try {
            Long orderCode = row.getOrderCode();
            Integer khoId = row.getKhoId();
            Integer thuNganId = row.getNguoiThuNganId();
            BigDecimal soTien = row.getSoTien();
            BigDecimal daNhan = row.getSoTienDaNhan();
            Integer id = row.getId() == null ? null : Math.toIntExact(row.getId());
            // Dòng tóm tắt theo giao dịch: lần đầu báo; khách chuyển thêm / lý do đổi thì chỉ sửa chữ (không báo lại)
            thongBaoService.capNhatTomTatSauCommit("Thông báo QR " + orderCode + " chưa tạo được đơn", () -> {
                String tenKho = tenKho(khoId);
                String thuNgan = thuNganId == null ? null : nguoiDungRepository.findById(thuNganId)
                        .map(NguoiDung::getHoTen).filter(t -> t != null && !t.isBlank()).map(String::trim).orElse(null);
                // Mã orderCode không hiện ở màn Đối soát nên không ghi; nút ở đó là "Bán cho khách" / "Trả lại tiền"
                // Câu lưu bằng tiếng Việt (ThongDiep.vi); dịch lúc đọc ở DichThongBao theo nhóm thongBaoThanhToan
                String tieuDe;
                String moTa;
                switch (lyDo == null ? "" : lyDo) {
                    case "CHUYEN_THIEU" -> {
                        tieuDe = ThongDiep.vi("thongBaoThanhToan.qrChuyenThieu");
                        moTa = daNhanTrenTong(daNhan, soTien, tenKho, thuNgan);
                    }
                    case "CHUYEN_DU" -> {
                        tieuDe = ThongDiep.vi("thongBaoThanhToan.qrChuyenDu");
                        moTa = daNhanTrenTong(daNhan, soTien, tenKho, thuNgan);
                    }
                    case "TIEN_VE_MUON" -> {
                        tieuDe = ThongDiep.vi("thongBaoThanhToan.qrTienVeMuon");
                        moTa = daNhanSoTien(daNhan != null ? daNhan : soTien, tenKho, thuNgan);
                    }
                    default -> {
                        tieuDe = ThongDiep.vi("thongBaoThanhToan.qrDaNhanTien");
                        moTa = daNhan != null ? daNhanSoTien(daNhan, tenKho, thuNgan) : daNhanTienChuaRo(tenKho, thuNgan);
                    }
                }
                // Chuyển thiếu: nút Bán cho khách bị khóa, chỉ trả lại tiền được
                moTa += " " + ThongDiep.vi("CHUYEN_THIEU".equals(lyDo)
                        ? "thongBaoThanhToan.traLaiTienChoKhach" : "thongBaoThanhToan.banChoKhachHoacTraTien");
                String khoa = "PAYOS:" + orderCode + ":PAID_ERROR";
                return new TomTat(khoa, nguoiNhan.quanTriVien(), null, new NoiDung(ThongBaoService.LOAI_THANH_TOAN_QR,
                        ThongBaoService.TONE_DANGER, tieuDe, moTa, "/pos-transfers", ThongBaoService.LOAI_THANH_TOAN_QR,
                        id, khoId, khoa), lanDau);
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo QR lỗi: {}", e.getMessage());
        }
    }

    /** T1 đã xử lý (quản trị viên tạo đơn hoặc ghi đã hoàn tiền): thông báo của mọi quản trị viên thành đã đọc. */
    public void qrDaXuLy(Long orderCode) {
        if (orderCode == null) return;
        try {
            thongBaoService.daXuLySauCommit("PAYOS:" + orderCode + ":PAID_ERROR");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được QR đã xử lý: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────

    private String tenKho(Integer khoId) {
        if (khoId == null) return ThongDiep.vi("thongBaoThanhToan.quay");
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse(ThongDiep.vi("thongBaoChung.khoSo", khoId));
    }

    /** "Đã nhận {đã nhận} / {cần thu} ở {kho}[ (thu ngân {tên})]." */
    private static String daNhanTrenTong(BigDecimal daNhan, BigDecimal soTien, String tenKho, String thuNgan) {
        return thuNgan == null
                ? ThongDiep.vi("thongBaoThanhToan.daNhanTrenTong", tien(daNhan), tien(soTien), tenKho)
                : ThongDiep.vi("thongBaoThanhToan.daNhanTrenTongThuNgan", tien(daNhan), tien(soTien), tenKho, thuNgan);
    }

    /** "Đã nhận {số tiền} ở {kho}[ (thu ngân {tên})]." */
    private static String daNhanSoTien(BigDecimal soTien, String tenKho, String thuNgan) {
        return thuNgan == null
                ? ThongDiep.vi("thongBaoThanhToan.daNhanSoTien", tien(soTien), tenKho)
                : ThongDiep.vi("thongBaoThanhToan.daNhanSoTienThuNgan", tien(soTien), tenKho, thuNgan);
    }

    /** "Đã nhận tiền ở {kho}[ (thu ngân {tên})]." — chưa rõ số tiền. */
    private static String daNhanTienChuaRo(String tenKho, String thuNgan) {
        return thuNgan == null
                ? ThongDiep.vi("thongBaoThanhToan.daNhanTienOKho", tenKho)
                : ThongDiep.vi("thongBaoThanhToan.daNhanTienOKhoThuNgan", tenKho, thuNgan);
    }

    private static String tien(BigDecimal soTien) {
        return soTien == null ? "?" : ThongBaoMuaHangService.tien(soTien);
    }
}
