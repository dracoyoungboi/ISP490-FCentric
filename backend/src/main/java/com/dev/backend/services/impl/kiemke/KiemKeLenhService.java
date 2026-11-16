package com.dev.backend.services.impl.kiemke;

import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.entities.KiemKeLenh;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.KiemKeLenhRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiTrangThaiException;

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

    @PersistenceContext
    private EntityManager em;

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
                    ThongDiep.of("khoVanHanh.idempotencyKeyKhongHopLe"));
        }
        return k;
    }

    public String bam(String loaiLenh, Object noiDung) {
        try {
            String json = loaiLenh + ":" + objectMapper.writeValueAsString(noiDung);
            byte[] h = MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new LoiTrangThaiException(ThongDiep.of("khoVanHanh.khongBamDuocLenh"), e);
        }
    }

    public Optional<KiemKeDto.KetQuaLenh> daXuLy(Integer khoId, String khoa, String loaiLenh, String hash) {
        return daXuLy(khoId, khoa, loaiLenh, hash, KiemKeDto.KetQuaLenh.class);
    }

    /** Như {@link #daXuLy(Integer, String, String, String)} cho lệnh không phải kiểm kê (vd. chuyển kệ): kết quả kiểu {@code kieu}. */
    public <T> Optional<T> daXuLy(Integer khoId, String khoa, String loaiLenh, String hash, Class<T> kieu) {
        if (khoa == null) return Optional.empty();
        Optional<KiemKeLenh> co = repository.findByKhoIdAndIdempotencyKey(khoId, khoa);
        if (co.isEmpty()) return Optional.empty();
        KiemKeLenh l = co.get();
        return Optional.of(docKetQua(l.getLoaiLenh(), l.getPayloadHash(), l.getKetQua(), loaiLenh, hash, kieu));
    }

    /**
     * Như {@link #daXuLy(Integer, String, String, String, Class)} nhưng đọc có khóa (FOR SHARE) nên thấy dòng của lần gửi
     * song song vừa commit, kể cả khi giao dịch này đã đọc ảnh chụp cũ (REPEATABLE READ). Gọi sau khi đã khóa các dòng mà
     * lần gửi cùng nội dung cũng phải khóa (vd. dòng tồn lô): tới lúc đó lần kia đã commit xong.
     */
    public <T> Optional<T> daXuLyMoiNhat(Integer khoId, String khoa, String loaiLenh, String hash, Class<T> kieu) {
        if (khoa == null) return Optional.empty();
        List<?> ds = em.createNativeQuery("""
                        SELECT loai_lenh, payload_hash, CAST(ket_qua AS CHAR) FROM kiem_ke_lenh
                        WHERE kho_id = :kho AND idempotency_key = :khoa FOR SHARE""")
                .setParameter("kho", khoId)
                .setParameter("khoa", khoa)
                .getResultList();
        if (ds.isEmpty()) return Optional.empty();
        Object[] r = (Object[]) ds.get(0);
        return Optional.of(docKetQua(String.valueOf(r[0]), String.valueOf(r[1]), String.valueOf(r[2]), loaiLenh, hash, kieu));
    }

    private <T> T docKetQua(String loaiLuu, String hashLuu, String ketQua, String loaiLenh, String hash, Class<T> kieu) {
        if (!loaiLenh.equals(loaiLuu) || !hash.equals(hashLuu)) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_VERSION_CONFLICT,
                    ThongDiep.of("khoVanHanh.maYeuCauDaDung"));
        }
        try {
            return objectMapper.readValue(ketQua, kieu);
        } catch (JsonProcessingException e) {
            throw new LoiTrangThaiException(ThongDiep.of("khoVanHanh.ketQuaLenhKhongDocDuoc"), e);
        }
    }

    public void ghi(Integer khoId, String khoa, String loaiLenh, String hash, KiemKeDto.KetQuaLenh ketQua) {
        ghi(khoId, khoa, loaiLenh, hash, ketQua, ketQua.dotKiemKeId());
    }

    /** Ghi kết quả lệnh kiểu bất kỳ (vd. chuyển kệ, {@code dotKiemKeId} null) trong cùng giao dịch trước khi commit. */
    public void ghi(Integer khoId, String khoa, String loaiLenh, String hash, Object ketQua, Integer dotKiemKeId) {
        if (khoa == null) return;
        try {
            repository.save(KiemKeLenh.builder()
                    .khoId(khoId)
                    .idempotencyKey(khoa)
                    .loaiLenh(loaiLenh)
                    .payloadHash(hash)
                    .dotKiemKeId(dotKiemKeId)
                    .ketQua(objectMapper.writeValueAsString(ketQua))
                    .ngayTao(Instant.now())
                    .build());
        } catch (JsonProcessingException e) {
            throw new LoiTrangThaiException(ThongDiep.of("khoVanHanh.khongLuuDuocKetQuaLenh"), e);
        }
    }
}
