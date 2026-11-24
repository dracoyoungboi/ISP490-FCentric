package com.dev.backend.websocket;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Vé kết nối kênh realtime ({@code /ws-pos}, {@code /ws-outbound}).
 * <p>
 * Trình duyệt không gửi được header Authorization khi mở WebSocket, còn đặt token đăng nhập lên đường dẫn thì token lọt
 * vào log máy chủ và proxy. Nên màn hình xin vé qua một API có đăng nhập (API đó kiểm người dùng xem được đơn / phiếu),
 * rồi mở kết nối với {@code ?ve=}. Vé gắn đúng một thứ được nghe, dùng một lần, sống {@link #THOI_HAN}: lọt ra ngoài cũng
 * chỉ mở được đúng kết nối đó, trong vài giây.
 */
@Component
public class VeKetNoiRealtime {

    /** Thứ một kết nối được nghe: kênh và mã của nó (orderCode thanh toán, id phiếu nhặt). */
    public record DangKy(Kenh kenh, long ma) {
    }

    public enum Kenh {
        THANH_TOAN_POS,
        PHIEU_NHAT
    }

    static final Duration THOI_HAN = Duration.ofSeconds(60);
    /** Trần số vé chưa dùng của cả hệ thống, chặn phình bộ nhớ. */
    static final int TOI_DA_VE = 10_000;
    /**
     * Trần vé chưa dùng của một người: một màn POS theo dõi vài đơn cùng lúc là nhiều nhất. Không có trần này thì một
     * tài khoản gọi dồn làm cạn trần chung, mọi người khác mất tin tức thời.
     */
    static final int TOI_DA_VE_MOI_NGUOI = 30;
    private static final int SO_BYTE_VE = 32;
    private static final SecureRandom NGAU_NHIEN = new SecureRandom();

    private record VeCon(DangKy dangKy, Integer nguoiDungId, Instant hetHan) {
    }

    private final Map<String, VeCon> dsVe = new ConcurrentHashMap<>();
    private Clock dongHo = Clock.systemUTC();

    void setDongHo(Clock dongHo) {
        this.dongHo = dongHo;
    }

    /**
     * Cấp vé cho một đăng ký đã được kiểm quyền. Người này hoặc cả hệ thống đã có quá nhiều vé chưa dùng thì trả rỗng
     * (màn vẫn chạy, chỉ không nhận tin tức thời).
     */
    public synchronized Optional<String> cap(DangKy dangKy, Integer nguoiDungId) {
        Instant bayGio = dongHo.instant();
        dsVe.values().removeIf(ve -> ve.hetHan().isBefore(bayGio));
        if (dsVe.size() >= TOI_DA_VE) return Optional.empty();
        long cuaNguoiNay = dsVe.values().stream().filter(ve -> Objects.equals(ve.nguoiDungId(), nguoiDungId)).count();
        if (cuaNguoiNay >= TOI_DA_VE_MOI_NGUOI) return Optional.empty();
        byte[] b = new byte[SO_BYTE_VE];
        NGAU_NHIEN.nextBytes(b);
        String ve = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        dsVe.put(ve, new VeCon(dangKy, nguoiDungId, bayGio.plus(THOI_HAN)));
        return Optional.of(ve);
    }

    /** Dùng vé: lấy ra và xóa luôn (một lần). Vé lạ, đã dùng hoặc hết hạn thì rỗng. */
    public Optional<DangKy> dung(String ve) {
        if (ve == null || ve.isBlank()) return Optional.empty();
        VeCon con = dsVe.remove(ve);
        if (con == null || con.hetHan().isBefore(dongHo.instant())) return Optional.empty();
        return Optional.of(con.dangKy());
    }
}
