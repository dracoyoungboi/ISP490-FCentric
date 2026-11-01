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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
 *   <li>Dòng tóm tắt ({@link #capNhatTomTatSauCommit}): một dòng cố định cho mỗi người và khóa (vd. DCX:5 "7 đơn chờ xuất ở
 *   Kho tổng"), số đếm tính lại từ dữ liệu thật mỗi lần nên hai máy chạy song song vẫn ra đúng; hết việc thì đánh dấu đã
 *   đọc.</li>
 *   <li>Thao tác thất bại ({@link #guiSauRollback}): báo sau khi giao dịch nghiệp vụ hoàn tác, không ghi lúc còn giữ khóa.</li>
 *   <li>Việc đã có người xử lý ({@link #daXuLySauCommit}, {@link #daXuLyTheoTienToSauCommit}): đánh dấu đã đọc thông báo
 *   của mọi người cùng khóa sự kiện.</li>
 *   <li>Đọc / đánh dấu đã đọc: chỉ thông báo của chính người đang đăng nhập (API /api/v1/thong-bao).</li>
 * </ul>
 * Luật ai nhận thông báo nằm ở service của từng nghiệp vụ (ThongBaoChuyenKhoService, ThongBaoMuaHangService,
 * ThongBaoXuatKhoService, ThongBaoKiemKeService, ThongBaoThanhToanService, ThongBaoHeThongService); cách tìm người theo kho /
 * vai trò dùng chung ở NguoiNhanThongBao.
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

    /**
     * Mã loại = tên bảng của chứng từ gây ra thông báo (cũng là loai_tham_chieu), khớp LOAI_THONG_BAO trong
     * NotificationBell.jsx (chọn biểu tượng).
     */
    public static final String LOAI_PHIEU_CHUYEN_KHO = "phieu_chuyen_kho",
            LOAI_YEU_CAU_NHAP_HANG = "yeu_cau_mua_hang",
            LOAI_DON_MUA_HANG = "don_mua_hang",
            LOAI_PHIEU_NHAT_HANG = "danh_sach_nhat_hang",
            LOAI_DON_BAN_HANG = "don_ban_hang",
            LOAI_DOT_KIEM_KE = "dot_kiem_ke",
            LOAI_PHIEU_XUAT_KHO = "phieu_xuat_kho",
            LOAI_THANH_TOAN_QR = "pos_payos_payment",
            LOAI_PHIEU_THU = "thanh_toan_don_ban",
            LOAI_KENH_BAN_HANG = "kenh_ban_hang",
            LOAI_NGUOI_DUNG = "nguoi_dung";
    /** Tên nhóm hiển thị dưới mỗi thông báo theo loại; loại không có ở đây thì không ghi nhóm. */
    static final Map<String, String> NHOM_THEO_LOAI = Map.ofEntries(
            Map.entry(LOAI_PHIEU_CHUYEN_KHO, "Chuyển kho"),
            Map.entry(LOAI_YEU_CAU_NHAP_HANG, "Mua hàng"),
            Map.entry(LOAI_DON_MUA_HANG, "Mua hàng"),
            Map.entry(LOAI_PHIEU_NHAT_HANG, "Nhặt hàng"),
            Map.entry(LOAI_DON_BAN_HANG, "Bán hàng"),
            Map.entry(LOAI_DOT_KIEM_KE, "Kiểm kê"),
            Map.entry(LOAI_PHIEU_XUAT_KHO, "Xuất kho"),
            Map.entry(LOAI_THANH_TOAN_QR, "Thanh toán"),
            Map.entry(LOAI_PHIEU_THU, "Thanh toán"),
            Map.entry(LOAI_KENH_BAN_HANG, "Kênh bán hàng"),
            Map.entry(LOAI_NGUOI_DUNG, "Tài khoản"));
    /** Cột loai_thong_bao của lược đồ gốc chỉ nhận các giá trị này; mã loại khác được quy về nhóm gần nhất. */
    static final Set<String> LOAI_LUOC_DO = Set.of("don_hang", "ton_kho", "he_thong", "phe_duyet", "khac");
    static final Map<String, String> LOAI_LUOC_DO_THEO_MA = Map.ofEntries(
            Map.entry(LOAI_PHIEU_CHUYEN_KHO, "phe_duyet"),
            Map.entry(LOAI_YEU_CAU_NHAP_HANG, "phe_duyet"),
            Map.entry(LOAI_DON_MUA_HANG, "phe_duyet"),
            Map.entry(LOAI_PHIEU_NHAT_HANG, "don_hang"),
            Map.entry(LOAI_DON_BAN_HANG, "don_hang"),
            Map.entry(LOAI_DOT_KIEM_KE, "ton_kho"),
            Map.entry(LOAI_PHIEU_XUAT_KHO, "don_hang"),
            Map.entry(LOAI_THANH_TOAN_QR, "don_hang"),
            Map.entry(LOAI_PHIEU_THU, "don_hang"),
            Map.entry(LOAI_KENH_BAN_HANG, "he_thong"),
            Map.entry(LOAI_NGUOI_DUNG, "he_thong"));

    /** Số thứ tự trong một mili giây cho {@link #mocDuyNhat()}. */
    private static final java.util.concurrent.atomic.AtomicLong SO_THU_TU_MOC = new java.util.concurrent.atomic.AtomicLong();

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

    /**
     * Một lần cập nhật dòng tóm tắt khóa {@code khoa} (cố định, vd. DCX:5). {@code noiDung} null = hết việc: đánh dấu đã đọc
     * mọi dòng của khóa. {@code baoMoi} = có việc mới: người nhận (trừ người thao tác) thấy dòng hiện lại chưa đọc, lên
     * đầu; không thì chỉ sửa chữ. Chữ luôn được sửa ở mọi dòng của khóa, kể cả người thao tác (thấy số mới nhất).
     */
    public record TomTat(String khoa, Collection<Integer> nguoiNhan, Integer nguoiThaoTac, NoiDung noiDung,
                         boolean baoMoi, boolean hetViec) {
        public TomTat(String khoa, Collection<Integer> nguoiNhan, Integer nguoiThaoTac, NoiDung noiDung, boolean baoMoi) {
            this(khoa, nguoiNhan, nguoiThaoTac, noiDung, baoMoi, false);
        }

        /** Hết việc: sửa chữ mọi dòng của khóa thành {@code noiDungHet} (vd. "Không còn đơn chờ xuất…") rồi đánh dấu đã đọc. */
        public static TomTat hetViec(String khoa, NoiDung noiDungHet) {
            return new TomTat(khoa, List.of(), null, noiDungHet, false, true);
        }

        boolean laHet() {
            return hetViec || noiDung == null;
        }
    }

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
     * Thao tác nghiệp vụ sắp ném lỗi (giao dịch sẽ hoàn tác) mà vẫn cần báo người khác (vd. nhặt xong nhưng thiếu tồn theo
     * lô): đăng ký gửi SAU KHI giao dịch hoàn tác, lúc khóa tồn / phiếu đã nhả, nên không làm chậm người khác. Giao dịch
     * commit bình thường thì không gửi; không có giao dịch thì gửi ngay. {@code lap} chỉ được dùng giá trị đã chụp sẵn (thực
     * thể của giao dịch đã hoàn tác không đọc thêm được). Không bao giờ ném lỗi.
     */
    public void guiSauRollback(String moTa, Supplier<List<GuiDi>> lap) {
        try {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status == STATUS_ROLLED_BACK) chayTrongGiaoDichRieng(moTa, lap);
                    }
                });
            } else {
                chayTrongGiaoDichRieng(moTa, lap);
            }
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đăng ký được {}: {}", moTa, e.getMessage());
        }
    }

    /**
     * Cập nhật dòng tóm tắt sau commit ({@link TomTat}). {@code lap} chạy trong giao dịch mới: đếm lại số việc từ dữ liệu
     * thật rồi soạn câu. Mỗi người nhận ghi trong giao dịch riêng (tìm theo khóa duy nhất (người, khóa) rồi sửa, chưa có thì
     * thêm; hai máy cùng thêm thì máy sau sửa lại). Không bao giờ ném lỗi.
     */
    public void capNhatTomTatSauCommit(String moTa, Supplier<TomTat> lap) {
        try {
            SauCommit.chay(moTa, () -> ghiTomTat(moTa, lap));
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đăng ký được {}: {}", moTa, e.getMessage());
        }
    }

    /** Số lần ghi lại tối đa khi đếm lại thấy số đã đổi (máy khác chen vào giữa lúc đếm và lúc ghi). */
    static final int SO_LAN_GHI_TOM_TAT = 3;

    /**
     * Ghi dòng tóm tắt rồi ĐẾM LẠI trong giao dịch mới: số đã khác (máy khác vừa thêm / bớt việc giữa lúc đếm và lúc ghi)
     * thì ghi lại theo số mới; vừa đánh dấu hết việc mà đếm lại vẫn còn việc thì báo lại chưa đọc (không làm mất cảnh
     * báo). Tối đa {@link #SO_LAN_GHI_TOM_TAT} lượt; không khóa bảng (đếm và ghi là các câu thường, ghi theo id).
     */
    void ghiTomTat(String moTa, Supplier<TomTat> lap) {
        TomTat t;
        try {
            t = giaoDichRieng.execute(s -> lap.get());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] {} thất bại: {}", moTa, e.getMessage());
            return;
        }
        if (t == null || chuoiHoacNull(t.khoa()) == null) return;
        String khoa = cat(t.khoa().trim(), 100);
        try {
            for (int lan = 0; lan < SO_LAN_GHI_TOM_TAT && t != null; lan++) {
                boolean het = t.laHet();
                if (het) {
                    TomTat daGhi = t;
                    giaoDichRieng.executeWithoutResult(s -> {
                        if (noiDungHopLe(daGhi.noiDung())) capNhatChuTheoKhoa(khoa, daGhi.noiDung());
                        danhDauDaDocCacDong(thongBaoRepository.idChuaDocTheoKhoa(khoa));
                    });
                } else {
                    if (!noiDungHopLe(t.noiDung())) return;
                    ghiTomTatCoViec(moTa, khoa, t);
                }
                TomTat kiem = giaoDichRieng.execute(s -> lap.get());
                if (kiem == null || ketQuaGiongNhau(t, kiem)) return;
                // Số đã đổi: ghi lại theo số mới. Vừa đánh dấu hết mà giờ còn việc → báo lại chưa đọc
                t = het && !kiem.laHet()
                        ? new TomTat(kiem.khoa(), kiem.nguoiNhan(), kiem.nguoiThaoTac(), kiem.noiDung(), true, false)
                        : kiem;
            }
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] {} thất bại: {}", moTa, e.getMessage());
        }
    }

    /** Có việc: bump người nhận (trừ người thao tác) nếu có việc mới, rồi sửa chữ mọi dòng của khóa. */
    private void ghiTomTatCoViec(String moTa, String khoa, TomTat t) {
        NoiDung nd = t.noiDung();
        if (t.baoMoi() && t.nguoiNhan() != null) {
            Set<Integer> nguoiNhan = new LinkedHashSet<>();
            for (Integer id : t.nguoiNhan()) {
                if (id != null && !id.equals(t.nguoiThaoTac())) nguoiNhan.add(id);
            }
            for (Integer id : nguoiNhan) baoMoiTomTat(moTa, id, khoa, nd);
        }
        // Sửa chữ mọi dòng của khóa (cả người thao tác, người không được bump): ai mở chuông cũng thấy số mới nhất
        giaoDichRieng.executeWithoutResult(s -> capNhatChuTheoKhoa(khoa, nd));
    }

    /** Hai lần soạn cùng một kết quả: cùng hết việc, hoặc cùng tiêu đề và mô tả. */
    private static boolean ketQuaGiongNhau(TomTat a, TomTat b) {
        if (a.laHet() || b.laHet()) return a.laHet() && b.laHet();
        return Objects.equals(a.noiDung().tieuDe(), b.noiDung().tieuDe())
                && Objects.equals(a.noiDung().moTa(), b.noiDung().moTa());
    }

    private static boolean noiDungHopLe(NoiDung nd) {
        return nd != null && chuoiHoacNull(nd.loai()) != null && chuoiHoacNull(nd.tieuDe()) != null;
    }

    /** Sửa chữ mọi dòng của khóa (tìm id trước, không khóa bảng); giữ trạng thái đọc và giờ. */
    private void capNhatChuTheoKhoa(String khoa, NoiDung nd) {
        List<Long> ids = thongBaoRepository.idTheoKhoa(khoa);
        if (ids != null && !ids.isEmpty()) {
            thongBaoRepository.capNhatChuCacDong(ids, toneHopLe(nd.tone()), cat(nd.tieuDe().trim(), 255),
                    nd.moTa() == null ? "" : cat(nd.moTa().trim(), 500), cat(chuoiHoacNull(nd.duongDan()), 255));
        }
    }

    /**
     * Gửi ngay trong giao dịch riêng, không chờ giao dịch đang chạy (vd. sàn từ chối khóa: sự thật đó không phụ thuộc giao
     * dịch của người gọi, có thể hoàn tác hoặc đang ở bước sau commit). Không bao giờ ném lỗi.
     */
    public void guiNgay(String moTa, Supplier<List<GuiDi>> lap) {
        try {
            chayTrongGiaoDichRieng(moTa, lap);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] {} thất bại: {}", moTa, e.getMessage());
        }
    }

    /** Một người: có dòng của khóa thì sửa + chưa đọc + lên đầu; chưa có thì thêm; vướng khóa duy nhất thì thử sửa lại. */
    private void baoMoiTomTat(String moTa, Integer nguoiId, String khoa, NoiDung nd) {
        for (int lan = 0; lan < 2; lan++) {
            try {
                giaoDichRieng.executeWithoutResult(s -> {
                    ThongBao t = thongBaoRepository.findByNguoiNhanIdAndKhoaSuKien(nguoiId, khoa)
                            .orElseGet(() -> ThongBao.builder().nguoiNhanId(nguoiId).khoaSuKien(khoa).build());
                    t.setLoai(loaiLuocDo(nd.loai().trim()));
                    t.setTone(toneHopLe(nd.tone()));
                    t.setTieuDe(cat(nd.tieuDe().trim(), 255));
                    t.setMoTa(nd.moTa() == null ? "" : cat(nd.moTa().trim(), 500));
                    t.setDuongDan(cat(chuoiHoacNull(nd.duongDan()), 255));
                    t.setLoaiThamChieu(cat(chuoiHoacNull(nd.loaiThamChieu()), 50));
                    t.setIdThamChieu(nd.idThamChieu());
                    t.setKhoId(nd.khoId());
                    t.setDaDoc(false);
                    t.setNgayTao(Instant.now());
                    thongBaoRepository.save(t);
                });
                return;
            } catch (RuntimeException e) {
                if (lan == 1) log.warn("[THONG-BAO] {}: không ghi được tóm tắt cho người {}: {}", moTa, nguoiId, e.getMessage());
            }
        }
    }

    /** Sau commit: đánh dấu đã đọc thông báo của mọi người có đúng khóa sự kiện này (việc đã có người làm). */
    public void daXuLySauCommit(String khoa) {
        String k = chuoiHoacNull(khoa);
        if (k == null) return;
        sauCommitAnToan("Đánh dấu đã xử lý " + k,
                () -> danhDauDaDocCacDong(thongBaoRepository.idChuaDocTheoKhoa(cat(k, 100))));
    }

    /** Như {@link #daXuLySauCommit} cho mọi khóa bắt đầu bằng {@code tienTo} (vd. "PL:12:THIEU_LO:"; nên kết thúc bằng ":"). */
    public void daXuLyTheoTienToSauCommit(String tienTo) {
        String p = chuoiHoacNull(tienTo);
        if (p == null) return;
        String mau = mauBatDauBang(p);
        sauCommitAnToan("Đánh dấu đã xử lý " + p,
                () -> danhDauDaDocCacDong(thongBaoRepository.idChuaDocTheoTienTo(mau)));
    }

    /**
     * Mốc cho khóa sự kiện của việc lặp lại được (giao phiếu nhặt, đổi quyền…): mili giây kèm số thứ tự, hai lần trong cùng
     * mili giây vẫn ra hai khóa khác nhau (khóa trùng thì lần sau bị coi là đã gửi).
     */
    public static String mocDuyNhat() {
        return Instant.now().toEpochMilli() + "." + (SO_THU_TU_MOC.incrementAndGet() % 1000);
    }

    /** Mẫu LIKE "bắt đầu bằng": thoát \, %, _ trong tiền tố. */
    static String mauBatDauBang(String tienTo) {
        return tienTo.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private void sauCommitAnToan(String moTa, Runnable viec) {
        try {
            SauCommit.chay(moTa, () -> {
                try {
                    giaoDichRieng.executeWithoutResult(s -> viec.run());
                } catch (RuntimeException e) {
                    log.warn("[THONG-BAO] {} thất bại: {}", moTa, e.getMessage());
                }
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đăng ký được {}: {}", moTa, e.getMessage());
        }
    }

    /**
     * Đánh dấu đã đọc theo id (đã tìm trước bằng câu SELECT không khóa): không UPDATE thẳng theo khoa_su_kien vì cột đó không
     * có chỉ mục riêng, câu UPDATE sẽ khóa cả bảng.
     */
    private void danhDauDaDocCacDong(List<Long> ids) {
        if (ids != null && !ids.isEmpty()) thongBaoRepository.danhDauDaDocTheoIds(ids);
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
        int den = doDai - 1;
        // Không cắt giữa một cặp surrogate (emoji trong lý do hủy của sàn, tên nhà cung cấp): nửa ký tự làm hỏng câu
        if (Character.isHighSurrogate(s.charAt(den - 1))) den--;
        return s.substring(0, den) + "…";
    }
}
