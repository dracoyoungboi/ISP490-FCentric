package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.dto.response.customize.DongBoNgayDto;
import com.dev.backend.dto.response.customize.LayDonResultDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.services.KenhBanHangDongBoService;
import jakarta.annotation.PreDestroy;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * "Đồng bộ ngay" của một kênh chạy nền: đẩy tồn theo quy tắc đã lưu rồi lấy đơn 24 giờ qua.
 * Giao diện hỏi tiến độ mỗi giây thay vì giữ một request 30–45 giây.
 * Tiến độ giữ trong bộ nhớ theo kênh (khởi động lại máy chủ thì mất, SKU đã đẩy vẫn lưu);
 * mỗi kênh chỉ một đợt chạy cùng lúc, bấm lần nữa trả về đợt đang chạy.
 */
@Service
@Slf4j
public class DongBoNgayService {

    public static final String DANG_CHAY = "dang_chay";
    public static final String XONG = "xong";
    public static final String LOI = "loi";
    public static final String DA_DUNG = "da_dung";

    public static final String DOC_SAN_PHAM = "doc_san_pham";
    public static final String DAY_TON = "day_ton";
    public static final String LAY_DON = "lay_don";

    /** Danh sách SKU lỗi trả về giao diện tối đa bấy nhiêu dòng; đủ số đếm nằm ở soLoi */
    static final int TOI_DA_DS_LOI = 50;
    /** Khoảng lấy đơn của đồng bộ tay, giống nút cũ */
    static final Duration KHOANG_LAY_DON = Duration.ofHours(24);
    /** Lý do hiện cho người dùng khi lỗi không rõ (không lộ chi tiết kỹ thuật) */
    static final String LOI_MAY_CHU = "Máy chủ gặp lỗi khi đồng bộ, vui lòng thử lại";
    /** Kênh đang có đợt đẩy tồn khác (thường là JOB-03 tự động) thì chờ tối đa bấy lâu rồi mới đẩy */
    static final Duration CHO_KENH_RANH_TOI_DA = Duration.ofMinutes(5);

    private final KenhBanHangDongBoService dongBoService;
    private final Executor luong;
    private final Clock dongHo;
    /** Bọc cả đợt trong một phiên JPA (như request HTTP có open-in-view) để đọc được quan hệ LAZY của dòng liên kết */
    private final Consumer<Runnable> phienJpa;
    private final Map<String, Phien> phienTheoKenh = new ConcurrentHashMap<>();

    @Autowired
    public DongBoNgayService(KenhBanHangDongBoService dongBoService, EntityManagerFactory emf) {
        this(dongBoService, taoLuong(), Clock.systemUTC(), viec -> chayTrongPhienJpa(emf, viec));
    }

    DongBoNgayService(KenhBanHangDongBoService dongBoService, Executor luong, Clock dongHo, Consumer<Runnable> phienJpa) {
        this.dongBoService = dongBoService;
        this.luong = luong;
        this.dongHo = dongHo;
        this.phienJpa = phienJpa;
    }

    /** Bắt đầu một đợt; kênh đang có đợt chạy thì trả đợt đó, không tạo đợt thứ hai. */
    public DongBoNgayDto batDau(String maKenh) {
        String ma = chuanHoaMa(maKenh);
        // Kiểm tra trước khi lập phiếu theo dõi, để mã kênh không có thật không nằm lại trong bộ nhớ
        if (!dongBoService.coKenh(ma)) {
            throw new CommonException("Không tìm thấy kênh bán hàng: " + ma, HttpStatus.NOT_FOUND, null);
        }
        // Kênh chưa kết nối (hoặc vừa ngắt) thì báo ngay, không mở đợt chỉ để thất bại ở bước đầu
        dongBoService.kiemTraDaKetNoi(ma);
        NguoiDungAuthInfo nguoi = SecurityContextHolder.getUser();
        Integer khoId = SecurityContextHolder.getKhoId();
        Phien moi = new Phien(ma, nguoi != null ? nguoi.getHoTen() : null, dongHo);
        Phien phien = phienTheoKenh.compute(ma, (k, cu) -> cu != null && cu.dangChay() ? cu : moi);
        if (phien != moi) {
            return phien.chup();
        }
        try {
            luong.execute(() -> chay(moi, nguoi, khoId));
        } catch (RejectedExecutionException e) {
            moi.ketThuc(LOI, "Máy chủ đang tắt, chưa chạy được đồng bộ", null);
        }
        return moi.chup();
    }

    /** Đợt gần nhất của kênh (đang chạy hoặc đã xong); null nếu chưa có đợt nào từ khi máy chủ khởi động. */
    public DongBoNgayDto hienTai(String maKenh) {
        Phien phien = phienTheoKenh.get(chuanHoaMa(maKenh));
        return phien != null ? phien.chup() : null;
    }

    /** Yêu cầu dừng: đợt dừng sau SKU đang đẩy và bỏ bước lấy đơn. */
    public DongBoNgayDto dung(String maKenh) {
        Phien phien = phienTheoKenh.get(chuanHoaMa(maKenh));
        if (phien == null) {
            return null;
        }
        phien.yeuCauDung();
        return phien.chup();
    }

    @PreDestroy
    void dungKhiTatMay() {
        phienTheoKenh.values().forEach(Phien::yeuCauDung);
        if (luong instanceof ExecutorService es) {
            es.shutdown();
        }
    }

    void chay(Phien phien, NguoiDungAuthInfo nguoi, Integer khoId) {
        // Nhật ký kênh ghi đúng người bấm
        SecurityContextHolder.setUser(nguoi);
        SecurityContextHolder.setKhoId(khoId);
        try {
            phienJpa.accept(() -> chayCacBuoc(phien));
        } catch (Exception e) {
            log.warn("[Đồng bộ ngay] Kênh {} dừng vì lỗi: {}", phien.maKenh, e.getMessage(), e);
            phien.ketThuc(LOI, thongDiepLoi(e), null);
        } finally {
            // Lỗi nặng (Error) không vào catch trên và vẫn được ném tiếp; đợt phải kết thúc ở đây,
            // nếu không sẽ kẹt "đang chạy" và mọi lần bấm sau chỉ trả lại đợt kẹt tới khi khởi động lại máy chủ.
            phien.ketThuc(LOI, LOI_MAY_CHU, null);
            SecurityContextHolder.clear();
        }
    }

    private void chayCacBuoc(Phien phien) {
        DayTonResultDto ton = dongBoService.dayTonTheoQuyTacDaLuu(phien.maKenh, phien);
        if (ton.getLoiKenh() != null) {
            phien.ketThuc(LOI, ton.getLoiKenh(), ton.getSoChuaDay());
            return;
        }
        if (phien.canDung()) {
            phien.ketThuc(DA_DUNG, null, ton.getSoChuaDay());
            return;
        }
        phien.sangLayDon();
        Instant den = dongHo.instant();
        LayDonResultDto don = dongBoService.layDonHang(phien.maKenh,
                new LayDonHangKenhRequest(den.minus(KHOANG_LAY_DON).toString(), den.toString()));
        phien.xong(don != null ? don.getSoDonMoi() : 0);
    }

    private static String thongDiepLoi(Exception e) {
        // Lỗi nghiệp vụ (kể cả lỗi có mã, vd. không cấp lại được khóa) có câu viết cho người dùng
        boolean loiNghiepVu = e instanceof CommonException || e instanceof LoiCoMaException;
        if (loiNghiepVu && e.getMessage() != null && !e.getMessage().isBlank()) {
            return e.getMessage();
        }
        return LOI_MAY_CHU;
    }

    private static String chuanHoaMa(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            throw new CommonException("Mã kênh không được để trống", HttpStatus.BAD_REQUEST, null);
        }
        return maKenh.trim().toUpperCase(Locale.ROOT);
    }

    private static ExecutorService taoLuong() {
        AtomicInteger dem = new AtomicInteger();
        return Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "dong-bo-ngay-" + dem.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
    }

    /** Mở một EntityManager cho luồng nền suốt đợt, giống OpenEntityManagerInViewInterceptor của request HTTP. */
    public static void chayTrongPhienJpa(EntityManagerFactory emf, Runnable viec) {
        if (TransactionSynchronizationManager.hasResource(emf)) {
            viec.run();
            return;
        }
        EntityManager em = emf.createEntityManager();
        TransactionSynchronizationManager.bindResource(emf, new EntityManagerHolder(em));
        try {
            viec.run();
        } finally {
            TransactionSynchronizationManager.unbindResource(emf);
            EntityManagerFactoryUtils.closeEntityManager(em);
        }
    }

    /** Một đợt đồng bộ tay; nhận tiến độ từ vòng đẩy tồn và chụp lại cho giao diện. */
    static final class Phien implements KenhBanHangDongBoService.TheoDoiDayTon {
        final String maPhien = UUID.randomUUID().toString();
        final String maKenh;
        final String nguoiBam;
        private final Clock dongHo;
        private final Instant batDau;

        private String trangThai = DANG_CHAY;
        private String giaiDoan = DOC_SAN_PHAM;
        private Integer tongSku;
        private int daXuLy;
        private int soThanhCong;
        private int soLoi;
        private Integer soChuaDay;
        private String skuDangDay;
        private Integer soDonMoi;
        private String loi;
        private volatile boolean yeuCauDung;
        private Instant batDauDayTon;
        private Instant ketThucDayTon;
        private Instant thoiDiemKetThuc;
        private final List<DongBoNgayDto.LoiSkuDto> dsLoi = new ArrayList<>();

        Phien(String maKenh, String nguoiBam, Clock dongHo) {
            this.maKenh = maKenh;
            this.nguoiBam = nguoiBam;
            this.dongHo = dongHo;
            this.batDau = dongHo.instant();
        }

        @Override
        public synchronized void batDauDay(int tong) {
            giaiDoan = DAY_TON;
            tongSku = tong;
            batDauDayTon = dongHo.instant();
        }

        @Override
        public synchronized void dangDay(String maSku) {
            skuDangDay = maSku;
        }

        @Override
        public synchronized void daDay(String maSku, String tenSku, boolean thanhCong, String lyDo) {
            daXuLy++;
            if (thanhCong) {
                soThanhCong++;
                return;
            }
            soLoi++;
            if (dsLoi.size() < TOI_DA_DS_LOI) {
                dsLoi.add(DongBoNgayDto.LoiSkuDto.builder().maSku(maSku).tenSku(tenSku).lyDo(lyDo).build());
            }
        }

        @Override
        public boolean canDung() {
            return yeuCauDung;
        }

        /** Người bấm đang chờ kết quả: chờ đợt đẩy tồn khác của kênh xong thay vì báo lỗi ngay */
        @Override
        public Duration choKenhRanhToiDa() {
            return CHO_KENH_RANH_TOI_DA;
        }

        synchronized void yeuCauDung() {
            if (DANG_CHAY.equals(trangThai)) {
                yeuCauDung = true;
            }
        }

        synchronized boolean dangChay() {
            return DANG_CHAY.equals(trangThai);
        }

        synchronized void sangLayDon() {
            dongBuocDayTon();
            giaiDoan = LAY_DON;
            skuDangDay = null;
        }

        synchronized void xong(int soDon) {
            if (!dangChay()) return;
            soDonMoi = soDon;
            ketThuc(XONG, null, 0);
        }

        /** Chỉ đợt đang chạy mới kết thúc được; gọi lần hai không đổi kết quả. */
        synchronized void ketThuc(String ketQua, String lyDo, Integer chuaDay) {
            if (!dangChay()) return;
            dongBuocDayTon();
            trangThai = ketQua;
            loi = lyDo;
            soChuaDay = chuaDay;
            skuDangDay = null;
            thoiDiemKetThuc = dongHo.instant();
        }

        private void dongBuocDayTon() {
            if (batDauDayTon != null && ketThucDayTon == null) {
                ketThucDayTon = dongHo.instant();
            }
        }

        synchronized DongBoNgayDto chup() {
            Instant bayGio = dongHo.instant();
            Instant mocCuoi = thoiDiemKetThuc != null ? thoiDiemKetThuc : bayGio;
            Long dayTonMs = batDauDayTon == null ? null
                    : Duration.between(batDauDayTon, ketThucDayTon != null ? ketThucDayTon : bayGio).toMillis();
            return DongBoNgayDto.builder()
                    .maPhien(maPhien)
                    .maKenh(maKenh)
                    .trangThai(trangThai)
                    .giaiDoan(giaiDoan)
                    .tongSku(tongSku)
                    .daXuLy(daXuLy)
                    .soThanhCong(soThanhCong)
                    .soLoi(soLoi)
                    .soChuaDay(soChuaDay)
                    .skuDangDay(skuDangDay)
                    .soDonMoi(soDonMoi)
                    .loi(loi)
                    .yeuCauDung(yeuCauDung)
                    .nguoiBam(nguoiBam)
                    .batDau(batDau)
                    .ketThuc(thoiDiemKetThuc)
                    .daChayMs(Duration.between(batDau, mocCuoi).toMillis())
                    .dayTonDaChayMs(dayTonMs)
                    .dsLoi(List.copyOf(dsLoi))
                    .build();
        }
    }
}
