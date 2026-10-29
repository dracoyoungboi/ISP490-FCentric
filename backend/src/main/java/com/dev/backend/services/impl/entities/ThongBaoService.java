package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.customize.ThongBaoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.ThongBao;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ThongBaoRepository;
import com.dev.backend.utils.SauCommit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

/**
 * Thông báo trong ứng dụng (chuông trên thanh trên cùng), dùng chung cho mọi nghiệp vụ.
 * <ul>
 *   <li>Ghi: {@link #guiSauCommit} chạy SAU KHI giao dịch nghiệp vụ commit, trong giao dịch MỚI. Mọi lỗi (kể cả khi
 *   chưa chạy migration-2026-10-28-thong-bao.sql) chỉ ghi log, không bao giờ làm hỏng thao tác nghiệp vụ. Bỏ người vừa thao tác, bỏ người
 *   nhận trùng, người đã có thông báo cùng khóa sự kiện thì bỏ qua (gọi lặp không tạo trùng). Mỗi người nhận ghi trong
 *   một giao dịch riêng: lỗi của một người không làm mất thông báo của người khác.</li>
 *   <li>Đọc / đánh dấu đã đọc: chỉ thông báo của chính người đang đăng nhập (API /api/v1/thong-bao).</li>
 * </ul>
 * Luật ai nhận thông báo nằm ở service của từng nghiệp vụ (vd. ThongBaoChuyenKhoService).
 */
@Slf4j
@Service
public class ThongBaoService {

    public static final String TONE_INFO = "info",
            TONE_WARNING = "warning",
            TONE_DANGER = "danger",
            TONE_SUCCESS = "success";
    /** Các màu ô biểu tượng NotificationBell.jsx hỗ trợ (MAU_O_BIEU_TUONG). */
    static final Set<String> TONE = Set.of(TONE_INFO, TONE_WARNING, TONE_DANGER, TONE_SUCCESS);

    /** Mã loại (khớp LOAI_THONG_BAO trong NotificationBell.jsx). */
    public static final String LOAI_PHIEU_CHUYEN_KHO = "phieu_chuyen_kho";
    /** Tên nhóm hiển thị dưới mỗi thông báo theo loại; loại không có ở đây thì không ghi nhóm. */
    static final Map<String, String> NHOM_THEO_LOAI = Map.of(LOAI_PHIEU_CHUYEN_KHO, "Chuyển kho");
    /** Cột loai_thong_bao của lược đồ gốc chỉ nhận các giá trị này; mã loại khác được quy về nhóm gần nhất. */
    static final Set<String> LOAI_LUOC_DO = Set.of("don_hang", "ton_kho", "he_thong", "phe_duyet", "khac");
    static final Map<String, String> LOAI_LUOC_DO_THEO_MA = Map.of(LOAI_PHIEU_CHUYEN_KHO, "phe_duyet");

    static final int SO_DONG_MAC_DINH = 30;
    static final int SO_DONG_TOI_DA = 100;

    private final ThongBaoRepository thongBaoRepository;
    private final TransactionTemplate giaoDichRieng;

    public ThongBaoService(ThongBaoRepository thongBaoRepository, PlatformTransactionManager transactionManager) {
        this.thongBaoRepository = thongBaoRepository;
        TransactionTemplate t = new TransactionTemplate(transactionManager);
        // Lúc afterCommit giao dịch nghiệp vụ đã commit nhưng vẫn gắn với luồng: phải mở giao dịch riêng mới ghi được
        t.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.giaoDichRieng = t;
    }

    /** Nội dung một thông báo, giống nhau cho mọi người nhận của cùng một sự kiện. */
    public record NoiDung(String loai, String tone, String tieuDe, String moTa, String duongDan,
                          String loaiThamChieu, Integer idThamChieu, Integer khoId, String khoaSuKien) {}

    /** Một lần gửi: danh sách người nhận (được trùng, được có null), người vừa thao tác (không nhận), nội dung. */
    public record GuiDi(Collection<Integer> nguoiNhan, Integer nguoiThaoTac, NoiDung noiDung) {}

    // ─────────────────────────────────────────────────────────────
    // GHI
    // ─────────────────────────────────────────────────────────────

    /**
     * Đăng ký gửi thông báo sau khi giao dịch hiện tại commit (rollback thì không gửi; không có giao dịch thì gửi
     * ngay). {@code lap} chạy trong giao dịch mới, lúc đó mới tìm người nhận và soạn câu, nên được đọc CSDL thoải mái
     * mà không ảnh hưởng giao dịch nghiệp vụ. Không bao giờ ném lỗi.
     */
    public void guiSauCommit(String moTa, Supplier<List<GuiDi>> lap) {
        try {
            SauCommit.chay(moTa, () -> chayTrongGiaoDichRieng(moTa, lap));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đăng ký được {}: {}", moTa, e.getMessage());
        }
    }

    /**
     * Tìm người nhận + soạn trong một giao dịch mới, rồi ghi từng người trong giao dịch mới riêng ({@link #ghiTungNguoi});
     * lỗi chỉ ghi log (giao dịch thông báo hoàn tác, nghiệp vụ giữ nguyên).
     */
    void chayTrongGiaoDichRieng(String moTa, Supplier<List<GuiDi>> lap) {
        List<ThongBao> moi;
        try {
            moi = giaoDichRieng.execute(s -> {
                List<ThongBao> ds = new ArrayList<>();
                List<GuiDi> gui = lap.get();
                if (gui != null) {
                    for (GuiDi g : gui) ds.addAll(soan(g));
                }
                return ds;
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] {} thất bại: {}", moTa, e.getMessage());
            return;
        }
        int soMoi = ghiTungNguoi(moTa, moi);
        log.debug("[THONG-BAO] {}: {} thông báo mới", moTa, soMoi);
    }

    /**
     * Ghi mỗi thông báo trong một giao dịch mới riêng: một người lỗi (vd. lần gửi khác cùng sự kiện vừa ghi trước, vướng
     * khóa duy nhất (nguoi_dung_id, khoa_su_kien)) chỉ hoàn tác dòng của người đó, không làm mất thông báo của người khác.
     * Trả số thông báo ghi được.
     */
    int ghiTungNguoi(String moTa, List<ThongBao> moi) {
        if (moi == null) return 0;
        int n = 0;
        for (ThongBao t : moi) {
            try {
                giaoDichRieng.executeWithoutResult(s -> thongBaoRepository.save(t));
                n++;
            } catch (RuntimeException e) {
                log.warn("[THONG-BAO] {}: không ghi được cho người {}: {}", moTa, t.getNguoiNhanId(), e.getMessage());
            }
        }
        return n;
    }

    /**
     * Soạn các thông báo mới của một lần gửi (đọc trong giao dịch đang có, chưa ghi): bỏ null, người thao tác, người trùng
     * và người đã có thông báo cùng khóa sự kiện.
     */
    List<ThongBao> soan(GuiDi g) {
        NoiDung nd = g == null ? null : g.noiDung();
        if (nd == null || chuoiHoacNull(nd.loai()) == null || chuoiHoacNull(nd.tieuDe()) == null
                || chuoiHoacNull(nd.khoaSuKien()) == null) {
            log.warn("[THONG-BAO] Bỏ qua thông báo thiếu loại, tiêu đề hoặc khóa sự kiện");
            return List.of();
        }
        Set<Integer> nguoiNhan = new LinkedHashSet<>();
        if (g.nguoiNhan() != null) {
            for (Integer id : g.nguoiNhan()) {
                if (id != null && !id.equals(g.nguoiThaoTac())) nguoiNhan.add(id);
            }
        }
        if (nguoiNhan.isEmpty()) return List.of();
        String khoa = cat(nd.khoaSuKien().trim(), 100);
        List<Integer> daCo = thongBaoRepository.nguoiDaCoSuKien(khoa, nguoiNhan);
        if (daCo != null) daCo.forEach(nguoiNhan::remove);
        if (nguoiNhan.isEmpty()) return List.of();

        Instant bayGio = Instant.now();
        String tone = toneHopLe(nd.tone());
        List<ThongBao> moi = new ArrayList<>();
        for (Integer id : nguoiNhan) {
            moi.add(ThongBao.builder()
                    .nguoiNhanId(id)
                    .loai(loaiLuocDo(nd.loai().trim()))
                    .tone(tone)
                    .tieuDe(cat(nd.tieuDe().trim(), 255))
                    .moTa(nd.moTa() == null ? "" : cat(nd.moTa().trim(), 500))
                    .duongDan(cat(chuoiHoacNull(nd.duongDan()), 255))
                    .loaiThamChieu(cat(chuoiHoacNull(nd.loaiThamChieu()), 50))
                    .idThamChieu(nd.idThamChieu())
                    .khoId(nd.khoId())
                    .khoaSuKien(khoa)
                    .ngayTao(bayGio)
                    .build());
        }
        return moi;
    }

    // ─────────────────────────────────────────────────────────────
    // ĐỌC / ĐÁNH DẤU ĐÃ ĐỌC (chỉ thông báo của người đang đăng nhập)
    // ─────────────────────────────────────────────────────────────

    /** Một trang thông báo của người đang đăng nhập, mới nhất trước, kèm tổng số chưa đọc. */
    @Transactional(readOnly = true)
    public ThongBaoDto.DanhSach danhSach(int trang, int soDong, boolean chiChuaDoc) {
        Integer nguoiDungId = nguoiDangNhap();
        int size = soDong <= 0 ? SO_DONG_MAC_DINH : Math.min(soDong, SO_DONG_TOI_DA);
        Page<ThongBao> page = thongBaoRepository.danhSachCuaNguoi(nguoiDungId, chiChuaDoc,
                PageRequest.of(Math.max(trang, 0), size));
        return ThongBaoDto.DanhSach.builder()
                .content(page.getContent().stream().map(ThongBaoService::dong).toList())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .soChuaDoc(thongBaoRepository.demChuaDoc(nguoiDungId))
                .build();
    }

    /**
     * Đánh dấu một thông báo của chính mình đã đọc (đã đọc rồi thì thôi); thông báo không có, của người khác hoặc dòng
     * có sẵn từ trước (khoa_su_kien trống, không hiện ở chuông) → 404 (không cho biết thông báo đó có tồn tại). Trả số
     * chưa đọc còn lại.
     */
    @Transactional
    public long danhDauDaDoc(Long id) {
        Integer nguoiDungId = nguoiDangNhap();
        if (id == null || (thongBaoRepository.danhDauDaDoc(id, nguoiDungId) == 0
                && !thongBaoRepository.existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(id, nguoiDungId))) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo");
        }
        return thongBaoRepository.demChuaDoc(nguoiDungId);
    }

    /** Đánh dấu mọi thông báo chưa đọc của chính mình đã đọc; trả số thông báo vừa đánh dấu. */
    @Transactional
    public int danhDauTatCaDaDoc() {
        return thongBaoRepository.danhDauTatCaDaDoc(nguoiDangNhap());
    }

    static ThongBaoDto.Dong dong(ThongBao t) {
        // Biểu tượng chọn theo chứng từ gây ra thông báo (vd. phieu_chuyen_kho); không có thì theo nhóm của lược đồ gốc
        String maLoai = t.getLoaiThamChieu() != null ? t.getLoaiThamChieu() : t.getLoai();
        return ThongBaoDto.Dong.builder()
                .id(t.getId())
                .loai(maLoai)
                .tone(toneHopLe(t.getTone()))
                .nhom(maLoai == null ? null : NHOM_THEO_LOAI.get(maLoai))
                .tieuDe(t.getTieuDe())
                .moTa(t.getMoTa())
                .duongDan(t.getDuongDan())
                .thoiGian(t.getNgayTao() == null ? null : t.getNgayTao().toString())
                .daDoc(Boolean.TRUE.equals(t.getDaDoc()))
                .loaiThamChieu(t.getLoaiThamChieu())
                .idThamChieu(t.getIdThamChieu())
                .build();
    }

    private static Integer nguoiDangNhap() {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user == null || user.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn");
        }
        return user.getId();
    }

    /** Tone hỗ trợ thì giữ; trống hoặc lạ thì info (Set.of không nhận contains(null)). */
    private static String toneHopLe(String tone) {
        return tone != null && TONE.contains(tone) ? tone : TONE_INFO;
    }

    private static String loaiLuocDo(String ma) {
        if (LOAI_LUOC_DO.contains(ma)) return ma;
        return LOAI_LUOC_DO_THEO_MA.getOrDefault(ma, "khac");
    }

    private static String chuoiHoacNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Cắt cho vừa cột (câu thông báo không được làm hỏng việc ghi vì dài quá). */
    private static String cat(String s, int doDai) {
        if (s == null || s.length() <= doDai) return s;
        return s.substring(0, doDai - 1) + "…";
    }
}
