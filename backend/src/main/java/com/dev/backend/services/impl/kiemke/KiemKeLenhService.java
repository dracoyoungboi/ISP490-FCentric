package com.dev.backend.services.impl.kiemke;

import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.entities.KiemKeLenh;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.KiemKeLenhRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Idempotency-Key của các lệnh kiểm kê (BR-STK-12, AC-16). Lệnh gọi {@link #daXuLy} SAU khi đã giữ mutex kho / khóa dòng
 * đợt (lần gửi lặp chờ lần đầu commit rồi mới đọc), và {@link #ghi} trong cùng giao dịch trước khi commit.
 * <ul>
 *   <li>Cùng khóa, cùng loại lệnh, cùng nội dung → trả kết quả đã lưu, không làm lại.</li>
 *   <li>Cùng khóa mà khác loại lệnh hoặc nội dung → 409 STK_VERSION_CONFLICT.</li>
 *   <li>Không gửi khóa → lệnh vẫn chạy (chỉ còn expectedVersion chặn gửi lặp).</li>
 * </ul>
 */
@Service
public class KiemKeLenhService {

    private static final Pattern KHOA_HOP_LE = Pattern.compile("^[A-Za-z0-9._:-]{8,100}$");

    private final KiemKeLenhRepository repository;
    private final ObjectMapper objectMapper;

    public KiemKeLenhService(KiemKeLenhRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /** Khóa đã chuẩn hóa, hoặc null khi không gửi. Sai định dạng → 400. */
    public String chuanHoa(String khoa) {
        if (khoa == null || khoa.isBlank()) return null;
        String k = khoa.trim();
        if (!KHOA_HOP_LE.matcher(k).matches()) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_VERSION_CONFLICT,
                    "Idempotency-Key phải dài 8–100 ký tự, chỉ gồm chữ, số và . _ : -");
        }
        return k;
    }

    public String bam(String loaiLenh, Object noiDung) {
        try {
            String json = loaiLenh + ":" + objectMapper.writeValueAsString(noiDung);
            byte[] h = MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("Không băm được nội dung lệnh kiểm kê", e);
        }
    }

    public Optional<KiemKeDto.KetQuaLenh> daXuLy(Integer khoId, String khoa, String loaiLenh, String hash) {
        if (khoa == null) return Optional.empty();
        Optional<KiemKeLenh> co = repository.findByKhoIdAndIdempotencyKey(khoId, khoa);
        if (co.isEmpty()) return Optional.empty();
        KiemKeLenh l = co.get();
        if (!loaiLenh.equals(l.getLoaiLenh()) || !hash.equals(l.getPayloadHash())) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_VERSION_CONFLICT,
                    "Mã yêu cầu này đã dùng cho một thao tác khác. Tải lại trang rồi thử lại.");
        }
        try {
            return Optional.of(objectMapper.readValue(l.getKetQua(), KiemKeDto.KetQuaLenh.class));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Kết quả lệnh kiểm kê đã lưu không đọc được", e);
        }
    }

    public void ghi(Integer khoId, String khoa, String loaiLenh, String hash, KiemKeDto.KetQuaLenh ketQua) {
        if (khoa == null) return;
        try {
            repository.save(KiemKeLenh.builder()
                    .khoId(khoId)
                    .idempotencyKey(khoa)
                    .loaiLenh(loaiLenh)
                    .payloadHash(hash)
                    .dotKiemKeId(ketQua.dotKiemKeId())
                    .ketQua(objectMapper.writeValueAsString(ketQua))
                    .ngayTao(Instant.now())
                    .build());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Không lưu được kết quả lệnh kiểm kê", e);
        }
    }
}
