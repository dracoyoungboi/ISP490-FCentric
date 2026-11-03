package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.entities.KiemKeOutbox;
import com.dev.backend.repository.KiemKeOutboxRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Gửi sự kiện đẩy tồn sau duyệt kiểm kê (kiem_ke_outbox, BR-STK-14). Chạy NGOÀI giao dịch duyệt: lỗi mạng tới kênh
 * không làm hỏng đợt đã duyệt (AC-23).
 * <ul>
 *   <li>Sau commit của lần duyệt có biến thể xuống dưới REALTIME_SYNC_THRESHOLD: gửi ngay ({@link #guiCuaDot}).</li>
 *   <li>Còn lại: chạy mỗi phút, gửi sự kiện đã tới giờ (thu_lai_luc = lúc duyệt + OMNI_SYNC_INTERVAL_MINS).</li>
 *   <li>Giành lease bằng UPDATE có điều kiện (hai backend cùng CSDL không gửi trùng); lease hết hạn thì worker khác gửi lại.</li>
 *   <li>Lỗi: thử lại sau 1, 2, 4… phút (tối đa 60 phút).</li>
 * </ul>
 * Gửi bằng {@link KenhBanHangDongBoService#dayTonKhoKhanCap}: hàm này luôn đọc tồn khả dụng toàn chuỗi mới nhất và tự bỏ
 * qua kênh tắt tự động đẩy tồn; lỗi riêng từng kênh hàm chỉ ghi log, nên sự kiện được đánh dấu đã gửi khi lời gọi xong.
 */
@Slf4j
@Component
public class KiemKeOutboxWorker {

    static final long LEASE_GIAY = 120;
    static final int MOT_LAN_TOI_DA = 50;

    private final KiemKeOutboxRepository repo;
    private final KenhBanHangDongBoService kenh;
    private final KiemKeSanSang sanSang;
    private final TransactionTemplate giaoDich;

    public KiemKeOutboxWorker(KiemKeOutboxRepository repo, KenhBanHangDongBoService kenh, KiemKeSanSang sanSang,
                              PlatformTransactionManager transactionManager) {
        this.repo = repo;
        this.kenh = kenh;
        this.sanSang = sanSang;
        this.giaoDich = new TransactionTemplate(transactionManager);
        this.giaoDich.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Một luồng nền cho lần gửi ngay sau duyệt; lượt định kỳ và lượt này không gửi trùng nhờ lease. */
    private final ExecutorService luongGui = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "kiem-ke-day-ton");
        t.setDaemon(true);
        return t;
    });

    @PreDestroy
    void dung() {
        luongGui.shutdownNow();
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 90_000)
    public void chayDinhKy() {
        if (!sanSang.sanSang()) return;
        guiToiLuot();
    }

    /** Gọi sau commit của lần duyệt: gửi các sự kiện đã tới giờ (sự kiện ưu tiên của đợt vừa duyệt có giờ = lúc duyệt). */
    public void guiCuaDot(Integer dotId) {
        try {
            luongGui.execute(() -> {
                try {
                    guiToiLuot();
                } catch (RuntimeException e) {
                    log.warn("[KIEM-KE] Đẩy tồn sau duyệt đợt {} lỗi, để lượt định kỳ gửi: {}", dotId, e.getMessage());
                }
            });
        } catch (RuntimeException e) {
            log.warn("[KIEM-KE] Không xếp được lượt đẩy tồn sau duyệt đợt {}: {}", dotId, e.getMessage());
        }
    }

    private void guiToiLuot() {
        List<Long> ids;
        try {
            ids = giaoDich.execute(s -> repo.toiLuot(Instant.now(), PageRequest.of(0, MOT_LAN_TOI_DA)));
        } catch (RuntimeException e) {
            log.warn("[KIEM-KE] Không đọc được hàng đợi đẩy tồn: {}", e.getMessage());
            return;
        }
        if (ids == null) return;
        for (Long id : ids) gui(id);
    }

    void gui(Long id) {
        String token = UUID.randomUUID().toString();
        Instant bayGio = Instant.now();
        Integer duoc = giaoDich.execute(s -> repo.gianhLease(id, token, bayGio.plusSeconds(LEASE_GIAY), bayGio));
        if (duoc == null || duoc == 0) return;
        KiemKeOutbox o = giaoDich.execute(s -> repo.findById(id).orElse(null));
        if (o == null || !token.equals(o.getLeaseToken())) return;
        try {
            kenh.dayTonKhoKhanCap(o.getBienTheSanPhamId());
            giaoDich.executeWithoutResult(s -> repo.findById(id).ifPresent(x -> {
                if (!token.equals(x.getLeaseToken())) return;
                x.setTrangThai(IKiemKe.OUTBOX_DA_GUI);
                x.setNgayGui(Instant.now());
                x.setLeaseToken(null);
                x.setLeaseDen(null);
                x.setSoLanThu(x.getSoLanThu() + 1);
                x.setKetQuaKenh("{\"ketQua\":\"da_goi_day_ton\"}");
                x.setLoiCuoi(null);
                repo.save(x);
            }));
        } catch (RuntimeException e) {
            log.warn("[KIEM-KE] Đẩy tồn biến thể {} sau kiểm kê lỗi, sẽ thử lại: {}", o.getBienTheSanPhamId(), e.getMessage());
            giaoDich.executeWithoutResult(s -> repo.findById(id).ifPresent(x -> {
                int lan = x.getSoLanThu() + 1;
                x.setTrangThai(IKiemKe.OUTBOX_LOI);
                x.setSoLanThu(lan);
                x.setThuLaiLuc(Instant.now().plusSeconds(60L * Math.min(60, 1L << Math.min(6, lan - 1))));
                x.setLeaseToken(null);
                x.setLeaseDen(null);
                String loi = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                x.setLoiCuoi(loi.length() > 1000 ? loi.substring(0, 1000) : loi);
                repo.save(x);
            }));
        }
    }
}
