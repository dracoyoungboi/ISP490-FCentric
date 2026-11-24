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
 * Vé kết nối kênh realtime ({@code /ws-pos}, {@code /ws-outbound}). Đây là chỗ bắt đầu đọc cả luồng vé.
 *
 * <h2>Vì sao cần vé</h2>
 * Kênh realtime đẩy tin ngay cho màn hình: kết quả chuyển khoản QR ở POS, đơn bị hủy khi đang nhặt. Trình duyệt không
 * gửi được header Authorization khi mở WebSocket, nên trước đây kênh không biết ai đang nối: ai biết địa chỉ là nghe
 * được. Đặt token đăng nhập lên đường dẫn ({@code ?token=}) thì token (sống 24 giờ) lọt vào log máy chủ và proxy.
 * Cách làm ở đây giống "private channel" của Pusher / Ably: xin quyền nghe qua một API có đăng nhập, quyền cấp cho
 * từng đơn / phiếu.
 *
 * <h2>Luồng (theo thứ tự chạy)</h2>
 * <ol>
 *   <li><b>Giao diện xin vé</b> — {@code frontend/src/services/realtimeService.js} ({@code moKenhRealtime}) gọi
 *   {@code POST /api/v1/realtime/ve/thanh-toan/{orderCode}} hoặc {@code /phieu-nhat/{id}} kèm token như mọi API.</li>
 *   <li><b>Máy chủ kiểm quyền rồi cấp vé</b> — {@link com.dev.backend.controller.RealtimeController}: kiểm đúng luật của
 *   màn tương ứng (hỏi trạng thái thanh toán / xem phiếu nhặt), rồi gọi {@link #cap} lấy một chuỗi ngẫu nhiên.</li>
 *   <li><b>Giao diện mở kênh kèm vé</b> — {@code wss://.../ws-pos?ve=<vé>}.</li>
 *   <li><b>Máy chủ soát vé lúc bắt tay</b> — {@link KiemVeKetNoi} (gắn vào kênh ở
 *   {@link com.dev.backend.config.WebSocketConfig}) gọi {@link #dung}: vé sai, đã dùng, hết hạn hoặc của kênh khác thì
 *   trả 403, không mở kết nối.</li>
 *   <li><b>Kênh chỉ gửi tin của đúng đơn / phiếu ghi trên vé</b> — {@link PosWebSocketHandler},
 *   {@link OutboundWebSocketHandler} lấy mã từ vé qua {@link KiemVeKetNoi#maDangKy}, không đọc mã trên đường dẫn.</li>
 * </ol>
 *
 * <h2>Giới hạn của vé</h2>
 * Gắn đúng một đơn / phiếu, dùng một lần, sống {@link #THOI_HAN}, mỗi người tối đa {@link #TOI_DA_VE_MOI_NGUOI} vé chưa
 * dùng. Vé lọt ra ngoài cũng chỉ mở được đúng một kết nối đó, trong vài giây. Vé giữ trong bộ nhớ (mất khi khởi động lại
 * máy chủ là không sao: màn hình xin vé mới lần mở sau). Không xin được vé thì màn hình vẫn chạy, chỉ không nhận tin
 * tức thời (POS vẫn tự hỏi trạng thái định kỳ).
 */
@Component
public class VeKetNoiRealtime {

    /** Thứ một kết nối được nghe: kênh và mã của nó (orderCode thanh toán, id phiếu nhặt). */
    public record DangKy(Kenh kenh, long ma) {
    }

    /** Kênh của vé. Vé xin cho kênh này không mở được kênh kia (KiemVeKetNoi so kênh). */
    public enum Kenh {
        /** {@code /ws-pos}: kết quả chuyển khoản QR của một đơn POS; mã = orderCode payOS. */
        THANH_TOAN_POS,
        /** {@code /ws-outbound}: đơn bị hủy khi đang nhặt / đóng gói của một phiếu nhặt; mã = id phiếu nhặt. */
        PHIEU_NHAT
    }

    /** Vé chỉ cần sống đủ cho màn hình nối ngay sau khi xin (thường dưới 1 giây); 60 giây chừa cho mạng chậm. */
    static final Duration THOI_HAN = Duration.ofSeconds(60);
    /** Trần số vé chưa dùng của cả hệ thống, chặn phình bộ nhớ. */
    static final int TOI_DA_VE = 10_000;
    /**
     * Trần vé chưa dùng của một người: một màn POS theo dõi vài đơn cùng lúc là nhiều nhất. Không có trần này thì một
     * tài khoản gọi dồn làm cạn trần chung, mọi người khác mất tin tức thời.
     */
    static final int TOI_DA_VE_MOI_NGUOI = 30;
    /** 32 byte ngẫu nhiên an toàn (256 bit): không đoán được vé của người khác. */
    private static final int SO_BYTE_VE = 32;
    private static final SecureRandom NGAU_NHIEN = new SecureRandom();

    /** Vé đang chờ dùng: nghe gì, ai xin (để đếm trần mỗi người), hết hạn lúc nào. */
    private record VeCon(DangKy dangKy, Integer nguoiDungId, Instant hetHan) {
    }

    /** Chuỗi vé → vé đang chờ dùng. */
    private final Map<String, VeCon> dsVe = new ConcurrentHashMap<>();
    private Clock dongHo = Clock.systemUTC();

    /** Chỉ cho test đổi giờ. */
    void setDongHo(Clock dongHo) {
        this.dongHo = dongHo;
    }

    /**
     * Cấp vé cho một đăng ký <b>đã được kiểm quyền</b> (nơi gọi tự kiểm, lớp này không biết luật quyền). Người này hoặc cả
     * hệ thống đã có quá nhiều vé chưa dùng thì trả rỗng (màn vẫn chạy, chỉ không nhận tin tức thời).
     * <p>
     * {@code synchronized}: đếm vé rồi thêm vé phải đi liền nhau, không thì nhiều yêu cầu cùng lúc cùng đếm thấy còn chỗ
     * và vượt trần. Mỗi lần cấp dọn luôn vé hết hạn nên không cần job dọn riêng.
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

    /**
     * Dùng vé (soát vé lúc mở kết nối): lấy ra và xóa luôn trong một bước, nên hai kết nối cùng mang một vé thì chỉ một
     * cái qua. Xóa trước rồi mới xét hạn: vé hết hạn cũng bị dọn luôn. Vé lạ, đã dùng hoặc hết hạn thì rỗng.
     */
    public Optional<DangKy> dung(String ve) {
        if (ve == null || ve.isBlank()) return Optional.empty();
        VeCon con = dsVe.remove(ve);
        if (con == null || con.hetHan().isBefore(dongHo.instant())) return Optional.empty();
        return Optional.of(con.dangKy());
    }
}
