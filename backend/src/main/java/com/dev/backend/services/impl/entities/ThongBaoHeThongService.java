package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.TenVaiTro;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.QuyenHan;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.QuyenHanRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thông báo hệ thống: kết nối kênh bán (chỉ quản trị viên vào được màn Kênh bán hàng) và quyền của người dùng.
 * <pre>
 *   Sự kiện                                                  Người nhận         Khóa
 *   H1 Kênh cần ủy quyền lại (làm mới thất bại khi ủy quyền     Quản trị viên      KENH:{ma}:TOKEN:{ngày}
 *      còn ≤ 48 giờ / đã hết; sàn từ chối khóa)
 *   H2 Không đẩy được tồn lên kênh (lỗi cả kênh 2 lượt liền)   Quản trị viên      KENH:{ma}:DAY_TON:{ngày}
 *   H3 Quyền của bạn vừa thay đổi                            Người bị đổi quyền PQ:{id}:{epochMs}
 *   H4 Nhà cung cấp đổi MST                                    Quản trị viên      NCC:{id}:NHAY_CAM:{epochMs}
 *   H5 Email đăng nhập của một tài khoản bị quản trị đổi      Quản trị viên      ND:{id}:EMAIL:{epochMs}
 * </pre>
 * Kênh giả lập (shop cipher "mock_") không báo H1, H2: khóa giả không làm mới / đẩy tồn được, báo mỗi ngày
 * chỉ là nhiễu. Câu thông báo không chứa lỗi thô (lỗi kết nối của sàn có thể kèm đường dẫn mang khóa truy cập), chỉ ghi
 * nhóm lỗi cố định; chi tiết nằm trong log. Không bao giờ ném lỗi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoHeThongService {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final DateTimeFormatter NGAY_KHOA = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(VN);
    static final DateTimeFormatter GIO_NGAY = DateTimeFormatter.ofPattern("HH:mm dd/MM").withZone(VN);
    static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(VN);
    /** H1 chỉ báo khi ủy quyền còn dưới mức này (job làm mới thử từ 7 ngày trước hạn, mỗi 12 giờ). */
    static final Duration BAO_TRUOC_HET_HAN = Duration.ofHours(48);
    /** H2: số lượt đẩy tồn lỗi cả kênh liên tiếp mới báo (một lần chập mạng không báo). */
    static final int SO_LUOT_LOI_DE_BAO = 2;
    /** H3: số tên quyền ghi tối đa mỗi vế, còn lại ghi "và N quyền khác". */
    static final int SO_TEN_QUYEN_TOI_DA = 3;

    /** Nhóm lỗi đẩy tồn cả kênh. */
    enum NhomLoiDayTon { BO_QUA, XAC_THUC, THIEU_CAU_HINH, MAT_KET_NOI }

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final QuyenHanRepository quyenHanRepository;

    /** Số lượt đẩy tồn lỗi cả kênh liên tiếp theo mã kênh (trong bộ nhớ: khởi động lại thì đếm lại). */
    private final Map<String, Integer> soLuotLoiDayTon = new ConcurrentHashMap<>();

    // ─────────────────────────── H4, H5 thay đổi nhạy cảm ───────────────────────────

    /**
     * H4: mã số thuế của nhà cung cấp vừa đổi. Báo mọi quản trị viên, trừ người vừa sửa. Chi tiết cũ / mới xem ở thẻ
     * Lịch sử nhà cung cấp.
     */
    public void nhaCungCapDoiThongTinNhayCam(Integer nhaCungCapId, String maNcc, String tenNcc, List<String> tenTruong,
                                            Integer nguoiThaoTacId) {
        try {
            if (nhaCungCapId == null || tenTruong == null || tenTruong.isEmpty()) return;
            String moc = Instant.now().toEpochMilli() + "." + ThongBaoService.mocDuyNhat();
            String ten = (tenNcc == null || tenNcc.isBlank() ? "" : tenNcc.trim())
                    + (maNcc == null || maNcc.isBlank() ? "" : " (" + maNcc.trim() + ")");
            String moTa = ThongDiep.vi("thongBaoHeThong.nccDoiTruong", String.join(", ", tenTruong), ten.trim()) + " "
                    + ThongDiep.vi("thongBaoHeThong.kiemTraLaiLichSu");
            thongBaoService.guiSauCommit("Thông báo đổi thông tin nhạy cảm NCC " + nhaCungCapId, () ->
                    List.of(new GuiDi(nguoiNhan.quanTriVien(), nguoiThaoTacId, new NoiDung(ThongBaoService.LOAI_NHA_CUNG_CAP,
                            ThongBaoService.TONE_WARNING, ThongDiep.vi("thongBaoHeThong.nccDoiMstTieuDe"), moTa,
                            "/supplier/" + nhaCungCapId, ThongBaoService.LOAI_NHA_CUNG_CAP, nhaCungCapId, null,
                            "NCC:" + nhaCungCapId + ":NHAY_CAM:" + moc))));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đổi thông tin NCC: {}", e.getMessage());
        }
    }

    /**
     * H5: quản trị viên đổi email của tài khoản người khác (email nhận liên kết đặt lại mật khẩu). Báo mọi quản trị viên,
     * trừ người vừa đổi. Không gửi email.
     */
    public void emailTaiKhoanDaDoi(Integer nguoiDungId, String tenDangNhap, Integer nguoiThaoTacId) {
        try {
            if (nguoiDungId == null) return;
            String moc = Instant.now().toEpochMilli() + "." + ThongBaoService.mocDuyNhat();
            String ten = tenDangNhap == null || tenDangNhap.isBlank() ? "#" + nguoiDungId : tenDangNhap.trim();
            thongBaoService.guiSauCommit("Thông báo đổi email tài khoản " + nguoiDungId, () ->
                    List.of(new GuiDi(nguoiNhan.quanTriVien(), nguoiThaoTacId, new NoiDung(ThongBaoService.LOAI_NGUOI_DUNG,
                            ThongBaoService.TONE_WARNING, ThongDiep.vi("thongBaoHeThong.emailDoiTieuDe"),
                            ThongDiep.vi("thongBaoHeThong.emailDoiNoiDung", ten) + " "
                                    + ThongDiep.vi("thongBaoHeThong.kiemTraLaiLichSu"),
                            "/users/" + nguoiDungId, ThongBaoService.LOAI_NGUOI_DUNG, nguoiDungId, null,
                            "ND:" + nguoiDungId + ":EMAIL:" + moc))));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đổi email: {}", e.getMessage());
        }
    }

    // ─────────────────────────────── H1 ủy quyền kênh ───────────────────────────────

    /**
     * H1: job làm mới ủy quyền thất bại. Còn hơn 48 giờ thì thôi (job tự thử lại mỗi 12 giờ, không cần ai làm gì); còn
     * ≤ 48 giờ hoặc đã hết hạn thì báo cần ủy quyền lại.
     */
    public void lamMoiUyQuyenThatBai(KenhBanHang kenh) {
        try {
            if (kenh == null || laKenhGiaLap(kenh)) return;
            Instant hetHan = kenh.getTokenExpiresAt();
            Instant bayGio = Instant.now();
            if (hetHan != null && hetHan.isAfter(bayGio.plus(BAO_TRUOC_HET_HAN))) return;
            String moTa = hetHan == null || !hetHan.isAfter(bayGio)
                    ? ThongDiep.vi("thongBaoHeThong.uyQuyenHetHan")
                    : ThongDiep.vi("thongBaoHeThong.uyQuyenSapHetHan", GIO_NGAY.format(hetHan));
            baoUyQuyen(kenh.getMaKenh(), kenh.getTenKenh(), kenh.getId(), moTa, false);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo ủy quyền kênh: {}", e.getMessage());
        }
    }

    /** H1: sàn từ chối khóa kết nối (Shopify trả 401 khi lấy đơn…): báo cần ủy quyền lại. */
    public void kenhCanUyQuyenLai(KenhBanHang kenh) {
        try {
            if (kenh == null || laKenhGiaLap(kenh)) return;
            baoUyQuyen(kenh.getMaKenh(), kenh.getTenKenh(), kenh.getId(), ThongDiep.vi("thongBaoHeThong.sanKhongChapNhan"), false);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo ủy quyền kênh: {}", e.getMessage());
        }
    }

    /**
     * H1 khi chỉ biết mã kênh (Shopify từ chối làm mới khóa, KenhBanHangServiceImpl). Gửi NGAY trong giao dịch riêng: lỗi
     * này được ném lên cho người gọi (giao dịch của họ hoàn tác, hoặc đang ở bước sau commit) và máy chủ không gọi lại
     * Shopify nữa, chờ sau commit thì có thể mất hẳn.
     */
    public void kenhCanUyQuyenLai(String maKenh, String tenKenh, Integer kenhId) {
        kenhCanUyQuyenLai(maKenh, tenKenh, kenhId, null);
    }

    /**
     * Như trên, kèm hạn khóa truy cập hiện tại: còn hơn 48 giờ thì không báo (khóa vẫn dùng được tới hạn; người bấm Cấp
     * lại khóa đã thấy lỗi trên màn).
     */
    public void kenhCanUyQuyenLai(String maKenh, String tenKenh, Integer kenhId, Instant hetHanKhoa) {
        try {
            if (hetHanKhoa != null && hetHanKhoa.isAfter(Instant.now().plus(BAO_TRUOC_HET_HAN))) return;
            baoUyQuyen(maKenh, tenKenh, kenhId, ThongDiep.vi("thongBaoHeThong.sanKhongChapNhan"), true);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo ủy quyền kênh: {}", e.getMessage());
        }
    }

    /** Ngắt kết nối kênh: thông báo ủy quyền (H1) và đẩy tồn (H2) của kênh không còn việc gì để làm. */
    public void kenhDaNgat(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) return;
        String ma = maKenh.trim().toUpperCase(Locale.ROOT);
        soLuotLoiDayTon.remove(ma);
        thongBaoService.daXuLyTheoTienToSauCommit("KENH:" + ma + ":TOKEN:");
        thongBaoService.daXuLyTheoTienToSauCommit("KENH:" + ma + ":DAY_TON:");
    }

    /** Làm mới / ủy quyền lại thành công: thông báo H1 của kênh (mọi ngày) chuyển thành đã đọc. */
    public void uyQuyenDaOn(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) return;
        thongBaoService.daXuLyTheoTienToSauCommit("KENH:" + maKenh.trim().toUpperCase(Locale.ROOT) + ":TOKEN:");
    }

    private void baoUyQuyen(String maKenh, String tenKenh, Integer kenhId, String nguyenNhan, boolean guiNgay) {
        if (maKenh == null || maKenh.isBlank()) return;
        String ma = maKenh.trim().toUpperCase(Locale.ROOT);
        String ten = tenHienThi(ma, tenKenh);
        String ngay = NGAY_KHOA.format(Instant.now());
        // Shopify dùng khóa truy cập (không có nút ủy quyền lại): cập nhật khóa ở Cấu hình kênh
        boolean shopify = "SHOPIFY".equals(ma);
        String tieuDe = shopify ? ThongDiep.vi("thongBaoHeThong.khoaShopifyHong") : ThongDiep.vi("thongBaoHeThong.canUyQuyenLai", ten);
        String moTa = nguyenNhan + " " + (shopify ? ThongDiep.vi("thongBaoHeThong.capNhatKhoaTruyCap")
                : ThongDiep.vi("thongBaoHeThong.uyQuyenLaiDeLayDon"));
        java.util.function.Supplier<List<GuiDi>> lap = () ->
                List.of(new GuiDi(nguoiNhan.quanTriVien(), null, new NoiDung(ThongBaoService.LOAI_KENH_BAN_HANG,
                        ThongBaoService.TONE_DANGER, tieuDe, moTa, duongDanCauHinhKenh(ma),
                        ThongBaoService.LOAI_KENH_BAN_HANG, kenhId, null, "KENH:" + ma + ":TOKEN:" + ngay)));
        if (guiNgay) thongBaoService.guiNgay("Thông báo kênh " + ma + " cần ủy quyền lại", lap);
        else thongBaoService.guiSauCommit("Thông báo kênh " + ma + " cần ủy quyền lại", lap);
    }

    // ─────────────────────────────── H2 đẩy tồn ───────────────────────────────

    /**
     * H2: kết quả một lượt đẩy tồn định kỳ của kênh ({@code loiKenh} = DayTonResultDto.loiKenh; null = cả kênh ổn). Lỗi
     * "đang có đợt đẩy tồn khác" và "giới hạn tần suất" bỏ qua (không tính, không xóa đếm). Lỗi cả kênh 2 lượt liền thì báo
     * (tối đa một lần mỗi ngày); lượt ổn thì xóa đếm và đánh dấu đã đọc thông báo cũ.
     */
    public void ketQuaDayTon(KenhBanHang kenh, String loiKenh) {
        try {
            if (kenh == null || kenh.getMaKenh() == null || laKenhGiaLap(kenh) || !laSanDayTon(kenh)) return;
            String ma = kenh.getMaKenh().trim().toUpperCase(Locale.ROOT);
            if (loiKenh == null) {
                // Luôn đánh dấu (không chỉ khi máy này đang đếm): bộ đếm nằm trong bộ nhớ từng máy, khởi động lại là mất
                soLuotLoiDayTon.remove(ma);
                thongBaoService.daXuLyTheoTienToSauCommit("KENH:" + ma + ":DAY_TON:");
                return;
            }
            NhomLoiDayTon nhom = phanLoaiLoiDayTon(loiKenh);
            // Kênh chưa kết nối xong (thiếu khóa / cấu hình) không phải sự cố đẩy tồn: không báo mỗi ngày
            if (nhom == NhomLoiDayTon.BO_QUA || nhom == NhomLoiDayTon.THIEU_CAU_HINH) return;
            ghiLuotLoi(kenh, ma, nhom);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đẩy tồn: {}", e.getMessage());
        }
    }

    /**
     * H2: lượt đẩy tồn của kênh ném lỗi (không có kết quả). {@code loiXacThuc}: lỗi có mã (vd. Shopify từ chối làm mới
     * khóa) → nhóm xác thực; còn lại tính như mất kết nối.
     */
    public void dayTonLoi(KenhBanHang kenh, boolean loiXacThuc) {
        try {
            if (kenh == null || kenh.getMaKenh() == null || laKenhGiaLap(kenh) || !laSanDayTon(kenh)) return;
            ghiLuotLoi(kenh, kenh.getMaKenh().trim().toUpperCase(Locale.ROOT),
                    loiXacThuc ? NhomLoiDayTon.XAC_THUC : NhomLoiDayTon.MAT_KET_NOI);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đẩy tồn: {}", e.getMessage());
        }
    }

    private void ghiLuotLoi(KenhBanHang kenh, String ma, NhomLoiDayTon nhom) {
        int lan = soLuotLoiDayTon.merge(ma, 1, Integer::sum);
        if (lan < SO_LUOT_LOI_DE_BAO) return;
        String ten = tenHienThi(ma, kenh.getTenKenh());
        String moTa = switch (nhom) {
            case XAC_THUC -> ThongDiep.vi("thongBaoHeThong.sanKhongChapNhan") + " " + ThongDiep.vi("thongBaoHeThong.kiemTraKetNoi");
            case THIEU_CAU_HINH -> ThongDiep.vi("thongBaoHeThong.kenhThieuThongTin") + " " + ThongDiep.vi("thongBaoHeThong.hoanTatKetNoi");
            default -> ThongDiep.vi("thongBaoHeThong.haiLanDayTonLoi") + " " + ThongDiep.vi("thongBaoHeThong.heThongTuThuLai");
        };
        Integer kenhId = kenh.getId();
        String ngay = NGAY_KHOA.format(Instant.now());
        thongBaoService.guiSauCommit("Thông báo kênh " + ma + " đẩy tồn lỗi", () ->
                List.of(new GuiDi(nguoiNhan.quanTriVien(), null, new NoiDung(ThongBaoService.LOAI_KENH_BAN_HANG,
                        ThongBaoService.TONE_DANGER, ThongDiep.vi("thongBaoHeThong.dayTonLoiTieuDe", ten), moTa, duongDanCauHinhKenh(ma),
                        ThongBaoService.LOAI_KENH_BAN_HANG, kenhId, null, "KENH:" + ma + ":DAY_TON:" + ngay))));
    }

    /**
     * Nhóm lỗi đẩy tồn cả kênh theo câu lỗi của KenhBanHangDongBoServiceImpl (LOI_KENH_DANG_DAY_TON, phanLoaiLoiShopify,
     * "Chưa có … cấu hình / Access Token", "Lazada giới hạn tần suất", lỗi kết nối). Chỉ dùng để chọn câu cố định.
     */
    static NhomLoiDayTon phanLoaiLoiDayTon(String loiKenh) {
        String s = loiKenh == null ? "" : loiKenh.toLowerCase(Locale.ROOT);
        if (s.isBlank() || s.contains("đợt đẩy tồn khác") || s.contains("giới hạn")) return NhomLoiDayTon.BO_QUA;
        if (s.startsWith("chưa có") || s.contains("thiếu thông tin") || s.contains("shop cipher")) return NhomLoiDayTon.THIEU_CAU_HINH;
        // Mã HTTP đứng riêng (không khớp nhầm số trong "40135 ms" hay mã yêu cầu)
        if (s.contains("không hợp lệ") || s.contains("thiếu quyền") || s.contains("xác thực")
                || s.matches("(?s).*(http|status|mã|code)\\W{0,3}40[13]\\b.*")
                || s.matches("(?s).*\\b40[13]\\s*(unauthorized|forbidden).*")) return NhomLoiDayTon.XAC_THUC;
        return NhomLoiDayTon.MAT_KET_NOI;
    }

    // ─────────────────────────────── H3 quyền ───────────────────────────────

    /**
     * Ảnh chụp phân quyền trước / sau (chỉ giá trị, chụp trong giao dịch nghiệp vụ): vai trò, tên kho, hạn, mã quyền.
     */
    public record AnhQuyen(String vaiTro, Integer khoId, String tenKho, Instant ngayKetThuc, Set<String> quyen) {}

    /**
     * H3: phân quyền của {@code nguoiDungId} vừa đổi (PhanQuyenNguoiDungServiceImpl ghi lịch sử phân quyền). Báo chính người
     * đó (người thao tác không nhận). Có thêm quyền / vai trò / kho thì nhắc đăng nhập lại để dùng (quyền mới chỉ có sau
     * khi đăng nhập lại); chỉ bị bớt thì hệ thống tự yêu cầu đăng nhập lại.
     */
    public void quyenDaDoi(Integer nguoiDungId, Integer nguoiThaoTacId, AnhQuyen truoc, AnhQuyen sau, Instant luc) {
        try {
            if (nguoiDungId == null || truoc == null || sau == null) return;
            // Mốc kèm số thứ tự: hai lần đổi quyền trong cùng mili giây vẫn là hai thông báo
            String moc = (luc == null ? Instant.now() : luc).toEpochMilli() + "." + ThongBaoService.mocDuyNhat();
            Integer khoId = sau.khoId() != null ? sau.khoId() : truoc.khoId();
            thongBaoService.guiSauCommit("Thông báo quyền của người " + nguoiDungId + " đã đổi", () -> {
                Map<String, String> tenQuyen = new HashMap<>();
                for (QuyenHan q : quyenHanRepository.findAll()) {
                    if (q != null && q.getMaQuyen() != null) tenQuyen.put(q.getMaQuyen(), q.getTenQuyen());
                }
                String moTa = moTaDoiQuyen(truoc, sau, tenQuyen);
                return List.of(new GuiDi(List.of(nguoiDungId), nguoiThaoTacId, new NoiDung(ThongBaoService.LOAI_NGUOI_DUNG,
                        ThongBaoService.TONE_INFO, ThongDiep.vi("thongBaoHeThong.quyenTieuDe"), moTa, "/profile",
                        ThongBaoService.LOAI_NGUOI_DUNG, nguoiDungId, khoId, "PQ:" + nguoiDungId + ":" + moc)));
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo đổi quyền: {}", e.getMessage());
        }
    }

    /** Câu mô tả thay đổi: vai trò, kho, hạn, quyền thêm / bỏ; có thêm gì thì kèm câu nhắc đăng nhập lại. */
    static String moTaDoiQuyen(AnhQuyen truoc, AnhQuyen sau, Map<String, String> tenQuyen) {
        // Lên quản trị viên: có toàn quyền, câu "không còn làm việc ở kho / bỏ quyền" dễ đọc thành bị hạ quyền
        if (IRoleType.quan_tri_vien.equals(sau.vaiTro()) && !IRoleType.quan_tri_vien.equals(truoc.vaiTro())) {
            return ThongDiep.vi("thongBaoHeThong.dangNhapLaiQuyenMoi") + " "
                    + ThongDiep.vi("thongBaoHeThong.vaiTroToanQuyen", tenVaiTro(truoc.vaiTro()), tenVaiTro(sau.vaiTro()));
        }
        List<String> cau = new ArrayList<>();
        boolean coThem = false;
        if (!Objects.equals(truoc.vaiTro(), sau.vaiTro())) {
            cau.add(ThongDiep.vi("thongBaoHeThong.vaiTroDoi", tenVaiTro(truoc.vaiTro()), tenVaiTro(sau.vaiTro())));
        }
        if (!Objects.equals(truoc.khoId(), sau.khoId())) {
            if (sau.khoId() == null) {
                cau.add(ThongDiep.vi("thongBaoHeThong.khongConLamViec", tenKho(truoc)));
            } else {
                cau.add(truoc.khoId() == null ? ThongDiep.vi("thongBaoHeThong.lamViecO", tenKho(sau)) : ThongDiep.vi("thongBaoHeThong.chuyenSang", tenKho(sau)));
                coThem = true;
            }
        }
        if (sau.khoId() != null && !Objects.equals(truoc.ngayKetThuc(), sau.ngayKetThuc())) {
            cau.add(sau.ngayKetThuc() == null ? ThongDiep.vi("thongBaoHeThong.phanQuyenKhongHan")
                    : ThongDiep.vi("thongBaoHeThong.phanQuyenDenHet", NGAY.format(sau.ngayKetThuc())));
        }
        Set<String> cu = truoc.quyen() == null ? Set.of() : truoc.quyen();
        Set<String> moi = sau.quyen() == null ? Set.of() : sau.quyen();
        List<String> them = moi.stream().filter(q -> !cu.contains(q)).sorted().toList();
        List<String> bo = cu.stream().filter(q -> !moi.contains(q)).sorted().toList();
        if (!them.isEmpty()) {
            cau.add(cauQuyen("themQuyen", "themQuyenVaKhac", them, tenQuyen));
            coThem = true;
        }
        if (!bo.isEmpty()) cau.add(cauQuyen("boQuyen", "boQuyenVaKhac", bo, tenQuyen));
        if (cau.isEmpty()) cau.add(ThongDiep.vi("thongBaoHeThong.capNhatPhanQuyen"));
        // Câu nhắc đứng đầu: mô tả bị cắt còn 2 dòng trên chuông
        if (coThem) cau.add(0, ThongDiep.vi("thongBaoHeThong.dangNhapLaiQuyenMoi"));
        return String.join(" ", cau);
    }

    /**
     * Một câu liệt kê quyền: tối đa {@link #SO_TEN_QUYEN_TOI_DA} tên, còn lại ghi "và N quyền khác" (hai khóa riêng để
     * mẫu dò ngược khớp trọn câu).
     */
    private static String cauQuyen(String khoaDon, String khoaVaKhac, List<String> ma, Map<String, String> tenQuyen) {
        List<String> ten = new ArrayList<>();
        for (int i = 0; i < ma.size() && i < SO_TEN_QUYEN_TOI_DA; i++) {
            String t = tenQuyen.get(ma.get(i));
            ten.add(t == null || t.isBlank() ? ma.get(i) : t.trim());
        }
        String s = String.join(", ", ten);
        return ma.size() > SO_TEN_QUYEN_TOI_DA
                ? ThongDiep.vi("thongBaoHeThong." + khoaVaKhac, s, ma.size() - SO_TEN_QUYEN_TOI_DA)
                : ThongDiep.vi("thongBaoHeThong." + khoaDon, s);
    }

    private static String tenVaiTro(String ma) {
        String t = TenVaiTro.cua(ma);
        return t != null ? t : (ma == null || ma.isBlank() ? ThongDiep.vi("thongBaoHeThong.chuaCo") : ma);
    }

    private static String tenKho(AnhQuyen a) {
        return a.tenKho() != null && !a.tenKho().isBlank() ? a.tenKho().trim() : ThongDiep.vi("thongBaoChung.khoSoThuong", a.khoId());
    }

    // ─────────────────────────────── chung ───────────────────────────────

    /**
     * Sàn có đẩy tồn qua API (Shopify, Lazada, TikTok). Kênh khác (Bán hàng tại quầy, Shopee chờ cấp API) cũng nằm trong
     * danh sách kênh đang bật nhưng không có gì để đẩy: không báo H2.
     */
    static boolean laSanDayTon(KenhBanHang kenh) {
        String ma = kenh.getMaKenh() == null ? "" : kenh.getMaKenh().trim().toUpperCase(Locale.ROOT);
        return Set.of("SHOPIFY", "TIKTOK", "SHOPEE", "SHOPEE_SANDBOX").contains(ma);
    }

    /** Kênh giả lập thử nghiệm mang shop cipher "mock_". */
    static boolean laKenhGiaLap(KenhBanHang kenh) {
        String cipher = kenh.getShopCipher();
        return cipher != null && cipher.startsWith("mock_");
    }

    /** Tên sàn như giao diện ghi; tên tự đặt trong CSDL chỉ dùng cho kênh lạ. */
    private static String tenHienThi(String ma, String tenKenh) {
        return switch (ma) {
            case "SHOPIFY" -> "Shopify";
            case "LAZADA" -> "Lazada";
            case "LAZADA_SANDBOX" -> "Lazada Sandbox";
            case "TIKTOK" -> "TikTok Shop";
            case "SHOPEE" -> "Shopee";
            case "SHOPEE_SANDBOX" -> "Shopee Sandbox";
            default -> tenKenh != null && !tenKenh.isBlank() ? tenKenh.trim() : ma;
        };
    }

    /**
     * Cấu hình kênh (/channels/shopify/settings): nơi cập nhật khóa truy cập / ủy quyền lại. Mã chữ thường (chữ hoa vẫn được
     * chuyển hướng nhưng thêm một bước).
     */
    private static String duongDanCauHinhKenh(String ma) {
        return "/channels/" + ma.toLowerCase(Locale.ROOT) + "/settings";
    }
}
