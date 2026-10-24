package com.dev.backend.services.impl.utils;

import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.utils.SauCommit;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Nhật ký kiểm toán bảo mật, ghi vào bảng lich_su_thay_doi có sẵn (hành động trong IHanhDong, job dọn 90 ngày không
 * xóa — xem IHanhDong.KHONG_TU_DON).
 * <ul>
 *   <li>Không bao giờ ghi mật khẩu, mã xác nhận hay khóa: chỉ ghi việc gì đã xảy ra, ai làm, từ IP nào.</li>
 *   <li>Ghi trên MỘT luồng nền, hàng đợi có giới hạn: request đang giữ một kết nối CSDL (open-in-view) không phải
 *   chờ kết nối thứ hai — 10 lượt đăng nhập cùng lúc với pool 10 kết nối sẽ treo cả ứng dụng nếu ghi đồng bộ trong
 *   giao dịch riêng. Hàng đợi đầy thì bỏ bản ghi và ghi log, không chặn request.</li>
 *   <li>Ghi nhật ký lỗi thì chỉ ghi log ứng dụng, không làm hỏng thao tác chính.</li>
 *   <li>Cột người thực hiện bắt buộc: không xác định được người (vd. đăng nhập tên không tồn tại) thì không ghi.</li>
 * </ul>
 */
@Service
@Slf4j
public class NhatKyBaoMatService {

    static final int TOI_DA_GHI_CHU = 500;
    static final int TOI_DA_HANG_DOI = 1000;
    static final int TOI_DA_KHOA_GIOI_HAN = 10_000;

    private final LichSuThayDoiService lichSuThayDoiService;
    private final NguoiDungRepository nguoiDungRepository;
    private final Executor luongGhi;
    private final AtomicLong soBanGhiBo = new AtomicLong();
    // ghiNgayGioiHan: lần ghi gần nhất của từng (hành động, đối tượng)
    private final Map<String, Instant> lanGhiCuoi = new ConcurrentHashMap<>();

    @Autowired
    public NhatKyBaoMatService(LichSuThayDoiService lichSuThayDoiService, NguoiDungRepository nguoiDungRepository) {
        this(lichSuThayDoiService, nguoiDungRepository, null);
    }

    /** test: truyền Executor chạy ngay (Runnable::run) để kiểm tra đồng bộ. */
    NhatKyBaoMatService(LichSuThayDoiService lichSuThayDoiService, NguoiDungRepository nguoiDungRepository,
                        Executor luongGhi) {
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
        this.luongGhi = luongGhi != null ? luongGhi : taoLuongGhi();
    }

    private ThreadPoolExecutor taoLuongGhi() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(TOI_DA_HANG_DOI),
                viec -> {
                    Thread t = new Thread(viec, "nhat-ky-bao-mat");
                    t.setDaemon(true);
                    return t;
                },
                (viec, executor) -> {
                    long bo = soBanGhiBo.incrementAndGet();
                    if (bo == 1 || bo % 100 == 0) {
                        log.warn("[NHAT-KY-BAO-MAT] Hàng đợi đầy, đã bỏ {} bản ghi", bo);
                    }
                });
    }

    @PreDestroy
    void dung() throws InterruptedException {
        if (luongGhi instanceof ExecutorService es) {
            es.shutdown();
            es.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    /** Thao tác thành công: xếp hàng ghi SAU KHI giao dịch hiện tại commit (rollback thì không có bản ghi sai). */
    public void ghiSauCommit(String hanhDong, String loaiThamChieu, Integer idThamChieu, Integer nguoiThucHienId,
                             String ghiChu) {
        SauCommit.chay("Ghi nhật ký bảo mật " + hanhDong,
                () -> ghiNgay(hanhDong, loaiThamChieu, idThamChieu, nguoiThucHienId, ghiChu));
    }

    /**
     * Xếp hàng ghi ngay, không phụ thuộc giao dịch đang chạy: dùng cho sự kiện mà giao dịch chính sẽ rollback (đăng
     * nhập sai ném lỗi ngay sau đó, ghi sau commit sẽ mất).
     */
    public void ghiNgay(String hanhDong, String loaiThamChieu, Integer idThamChieu, Integer nguoiThucHienId,
                        String ghiChu) {
        if (nguoiThucHienId == null) return;
        Instant luc = Instant.now();
        String ghiChuGon = gon(ghiChu);
        try {
            luongGhi.execute(() -> ghi(hanhDong, loaiThamChieu, idThamChieu, nguoiThucHienId, ghiChuGon, luc));
        } catch (RuntimeException e) {
            log.warn("[NHAT-KY-BAO-MAT] Không xếp hàng được {}: {}", hanhDong, e.getMessage());
        }
    }

    /**
     * Như {@link #ghiNgay} nhưng mỗi (hành động, đối tượng) tối đa một dòng trong {@code khoang}: sự kiện có thể bị
     * lặp vô hạn mà không qua bộ giới hạn đăng nhập (vd. đúng mật khẩu của tài khoản đã khóa) không làm phình bảng.
     */
    public void ghiNgayGioiHan(String hanhDong, String loaiThamChieu, Integer idThamChieu, Integer nguoiThucHienId,
                               String ghiChu, Duration khoang) {
        String khoa = hanhDong + ":" + loaiThamChieu + ":" + idThamChieu;
        Instant bayGio = Instant.now();
        boolean[] duocGhi = {false};
        lanGhiCuoi.compute(khoa, (k, cu) -> {
            if (cu == null || !bayGio.isBefore(cu.plus(khoang))) {
                duocGhi[0] = true;
                return bayGio;
            }
            return cu;
        });
        if (lanGhiCuoi.size() > TOI_DA_KHOA_GIOI_HAN) {
            // Trần bộ nhớ: dọn mốc đã quá 1 ngày (khoảng giới hạn dùng thực tế chỉ vài phút)
            Instant moc = bayGio.minus(Duration.ofDays(1));
            lanGhiCuoi.values().removeIf(t -> t.isBefore(moc));
        }
        if (duocGhi[0]) {
            ghiNgay(hanhDong, loaiThamChieu, idThamChieu, nguoiThucHienId, ghiChu);
        }
    }

    private void ghi(String hanhDong, String loaiThamChieu, Integer idThamChieu, Integer nguoiThucHienId,
                     String ghiChu, Instant luc) {
        try {
            NguoiDung nguoiThucHien = nguoiDungRepository.findById(nguoiThucHienId).orElse(null);
            if (nguoiThucHien == null) return;
            lichSuThayDoiService.createGiaoDichRieng(LichSuThayDoi.builder()
                    .loaiThamChieu(loaiThamChieu)
                    .idThamChieu(idThamChieu)
                    .hanhDong(hanhDong)
                    .nguoiThucHien(nguoiThucHien)
                    .ngayThucHien(luc)
                    .ghiChu(ghiChu)
                    .build());
        } catch (RuntimeException e) {
            log.warn("[NHAT-KY-BAO-MAT] Không ghi được {} (đối tượng {} #{}): {}", hanhDong, loaiThamChieu,
                    idThamChieu, e.getMessage());
        }
    }

    /** "IP 1.2.3.4" hoặc null khi không biết IP. */
    public static String ip(String clientIp) {
        return clientIp == null || clientIp.isBlank() ? null : "IP " + gon(clientIp.trim());
    }

    static String gon(String s) {
        if (s == null) return null;
        // Cc: điều khiển ASCII + C1; Cf: định dạng (U+202E đảo chiều); Zl/Zp: U+2028/U+2029 xuống dòng
        String t = s.replaceAll("[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]", " ");
        return t.length() > TOI_DA_GHI_CHU ? t.substring(0, TOI_DA_GHI_CHU) : t;
    }
}
