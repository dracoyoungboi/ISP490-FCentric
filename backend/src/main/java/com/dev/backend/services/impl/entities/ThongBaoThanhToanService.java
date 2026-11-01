package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.ThanhToanDonBanRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import com.dev.backend.services.impl.entities.ThongBaoService.TomTat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

/**
 * Thông báo về tiền, chỉ quản trị viên xử lý được (hoàn tiền, đối chiếu, xử lý giao dịch QR lỗi đều là quyền quản trị).
 * Service nghiệp vụ gọi ngay sau khi ghi; ở đây chụp giá trị đã có, soạn và ghi sau commit. Không bao giờ ném lỗi.
 * <pre>
 *   Sự kiện                                                Người nhận      Khóa
 *   T1 Đã nhận tiền QR ở quầy nhưng chưa tạo được đơn       Quản trị viên   PAYOS:{orderCode}:PAID_ERROR (một lần mỗi giao dịch)
 *   T2 Đơn thường chuyển sang Cần hoàn tiền                 Quản trị viên   DBH:{id}:CAN_HOAN_TIEN:{ngày}
 *   T3 Có phiếu chuyển khoản chờ đối chiếu (dòng tóm tắt)   Quản trị viên   TT:CHO_DOI_CHIEU (cố định, số đếm tính lại)
 * </pre>
 * Câu thông báo không bao giờ chứa lỗi thô của hệ thống (có thể lộ thông tin kỹ thuật).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoThanhToanService {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final DateTimeFormatter NGAY_KHOA = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(VN);
    static final String KHOA_CHO_DOI_CHIEU = "TT:CHO_DOI_CHIEU";

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final ThanhToanDonBanRepository thanhToanDonBanRepository;

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
                String noi = " ở " + tenKho + (thuNgan == null ? "" : " (thu ngân " + thuNgan + ")");
                String tieuDe;
                String moTa;
                switch (lyDo == null ? "" : lyDo) {
                    case "CHUYEN_THIEU" -> {
                        tieuDe = "QR chuyển thiếu, chưa tạo được đơn";
                        moTa = "Đã nhận " + tien(daNhan) + " / " + tien(soTien) + noi + ".";
                    }
                    case "CHUYEN_DU" -> {
                        tieuDe = "QR chuyển dư, chưa tạo được đơn";
                        moTa = "Đã nhận " + tien(daNhan) + " / " + tien(soTien) + noi + ".";
                    }
                    case "TIEN_VE_MUON" -> {
                        tieuDe = "Tiền QR về sau khi mã đã hủy";
                        moTa = "Đã nhận " + tien(daNhan != null ? daNhan : soTien) + noi + ".";
                    }
                    default -> {
                        tieuDe = "Đã nhận tiền QR, chưa tạo được đơn";
                        moTa = (daNhan != null ? "Đã nhận " + tien(daNhan) : "Đã nhận tiền") + noi + ".";
                    }
                }
                // Chuyển thiếu: nút Bán cho khách bị khóa, chỉ trả lại tiền được
                moTa += "CHUYEN_THIEU".equals(lyDo) ? " Trả lại tiền cho khách ở Đối soát chuyển khoản."
                        : " Bán cho khách hoặc trả lại tiền ở Đối soát chuyển khoản.";
                String khoa = "PAYOS:" + orderCode + ":PAID_ERROR";
                return new TomTat(khoa, nguoiNhan.quanTriVien(), null, new NoiDung(ThongBaoService.LOAI_THANH_TOAN_QR,
                        ThongBaoService.TONE_DANGER, tieuDe, moTa, "/pos-transfers", ThongBaoService.LOAI_THANH_TOAN_QR,
                        id, khoId, khoa), lanDau);
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo QR lỗi: {}", e.getMessage());
        }
    }

    /**
     * T2: đơn bán thường vừa chuyển VÀO trạng thái Cần hoàn tiền (ThanhToanDonBanService.capNhatTrangThai). Câu theo tình
     * huống: đơn đã hủy / bị trả hàng sau khi thu tiền, hoặc khách trả thừa. Khóa theo ngày: đơn ra khỏi trạng thái rồi
     * quay lại hôm khác thì báo lại.
     */
    public void canHoanTien(DonBanHang don, BigDecimal soTienHoan, boolean vuaVao) {
        try {
            Integer donId = don.getId();
            String soDon = don.getSoDonHang() == null || don.getSoDonHang().isBlank() ? "#" + donId : don.getSoDonHang().trim();
            Integer trangThai = don.getTrangThai();
            Integer khoId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            Integer nguoiThaoTac = nguoiDangThaoTac();
            // Dòng tóm tắt theo đơn: vừa vào Cần hoàn tiền thì báo; còn ở đó mà số tiền / tình huống đổi thì sửa chữ
            String khoa = "DBH:" + donId + ":CAN_HOAN_TIEN";
            thongBaoService.capNhatTomTatSauCommit("Thông báo đơn " + soDon + " cần hoàn tiền", () -> {
                String tinhHuong;
                if (Objects.equals(trangThai, ITrangThaiDonBanHang.DA_HUY)) tinhHuong = "Đơn đã hủy sau khi thu tiền.";
                else if (Objects.equals(trangThai, ITrangThaiDonBanHang.BI_HOAN_TRA)) tinhHuong = "Khách trả hàng sau khi thu tiền.";
                else tinhHuong = "Khách trả dư.";
                String tieuDe = soTienHoan != null && soTienHoan.signum() > 0
                        ? "Đơn " + soDon + " cần hoàn " + tien(soTienHoan)
                        : "Đơn " + soDon + " cần hoàn tiền";
                return new TomTat(khoa, nguoiNhan.quanTriVien(), nguoiThaoTac, new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG,
                        ThongBaoService.TONE_WARNING, tieuDe, tinhHuong + " Trả lại khách rồi bấm Ghi nhận hoàn tiền.",
                        "/sales-orders/" + donId, ThongBaoService.LOAI_DON_BAN_HANG, donId, khoId, khoa), vuaVao);
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo cần hoàn tiền: {}", e.getMessage());
        }
    }

    /**
     * T3: số phiếu chuyển khoản chờ đối chiếu vừa đổi. {@code baoMoi} = vừa có phiếu mới (nhân viên ghi chuyển khoản):
     * dòng tóm tắt hiện lại chưa đọc; false = vừa đối chiếu / hủy phiếu: chỉ sửa số, hết phiếu thì đánh dấu đã đọc.
     */
    public void choDoiChieu(boolean baoMoi) {
        try {
            Integer nguoiThaoTac = nguoiDangThaoTac();
            thongBaoService.capNhatTomTatSauCommit("Thông báo phiếu chuyển khoản chờ đối chiếu", () -> {
                long n = thanhToanDonBanRepository.choDoiChieu(null, PageRequest.of(0, 1)).getTotalElements();
                if (n <= 0) {
                    return TomTat.hetViec(KHOA_CHO_DOI_CHIEU, new NoiDung(ThongBaoService.LOAI_PHIEU_THU,
                            ThongBaoService.TONE_INFO, "Không còn phiếu chuyển khoản chưa đối chiếu",
                            "Mọi phiếu đã đối chiếu với sao kê.", "/reports/revenue", ThongBaoService.LOAI_PHIEU_THU,
                            null, null, KHOA_CHO_DOI_CHIEU));
                }
                return new TomTat(KHOA_CHO_DOI_CHIEU, nguoiNhan.quanTriVien(), nguoiThaoTac,
                        new NoiDung(ThongBaoService.LOAI_PHIEU_THU, ThongBaoService.TONE_INFO,
                                n + " phiếu chuyển khoản chưa đối chiếu",
                                "Đối chiếu với sao kê ngân hàng ở Báo cáo doanh thu.", "/reports/revenue",
                                ThongBaoService.LOAI_PHIEU_THU, null, null, KHOA_CHO_DOI_CHIEU),
                        baoMoi);
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo chờ đối chiếu: {}", e.getMessage());
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

    /** T2 đã xong (đơn ra khỏi Cần hoàn tiền: đã ghi hoàn tiền…): thông báo của mọi quản trị viên thành đã đọc. */
    public void daHoanTien(Integer donId) {
        if (donId == null) return;
        try {
            thongBaoService.daXuLySauCommit("DBH:" + donId + ":CAN_HOAN_TIEN");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn đã hoàn tiền: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────

    /** Người đang đăng nhập (job / webhook không có người thì null). */
    private static Integer nguoiDangThaoTac() {
        try {
            NguoiDungAuthInfo u = SecurityContextHolder.getUser();
            return u == null ? null : u.getId();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String tenKho(Integer khoId) {
        if (khoId == null) return "Quầy";
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse("Kho #" + khoId);
    }

    private static String tien(BigDecimal soTien) {
        return soTien == null ? "?" : ThongBaoMuaHangService.tien(soTien);
    }
}
