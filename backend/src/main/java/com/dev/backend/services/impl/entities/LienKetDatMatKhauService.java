package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.LienKetDatMatKhau;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.i18n.LoiTrangThaiException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.LienKetDatMatKhauRepository;
import com.dev.backend.services.email.DinhDangEmail;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Liên kết đặt mật khẩu dùng một lần (thay mật khẩu tạm gửi dạng rõ trong email E2, E3).
 * Mã gồm 32 byte ngẫu nhiên (base64url, 43 ký tự): không đoán được, không phụ thuộc khóa ký JWT nào. CSDL chỉ giữ
 * SHA-256 của mã. Các hàm ghi bắt buộc chạy trong giao dịch của nơi gọi (tạo tài khoản, cấp lại, đặt mật khẩu, đổi
 * mật khẩu): gọi ngoài giao dịch thì báo lỗi ngay thay vì ghi dở.
 */
@Service
public class LienKetDatMatKhauService {

    public static final String TAO_TAI_KHOAN = "TAO_TAI_KHOAN";
    public static final String CAP_LAI = "CAP_LAI";
    /**
     * Hạn liên kết (chốt 23/10/2026): 24 giờ cho cả tài khoản mới và cấp lại. Đổi thì sửa cả HAN_LIEN_KET_MAT_KHAU
     * trong frontend/src/utils/matKhau.js (câu nhắc ở hộp xác nhận của quản trị viên).
     */
    public static final Duration HIEU_LUC = Duration.ofHours(24);

    static final int SO_BYTE_MA = 32;
    // base64url không đệm; giới hạn độ dài để không băm chuỗi dài bất thường
    private static final Pattern DANG_MA = Pattern.compile("^[A-Za-z0-9_-]{20,100}$");
    private static final DateTimeFormatter GIO = DateTimeFormatter.ofPattern("HH:mm").withZone(DinhDangEmail.MUI_GIO);
    private static final DateTimeFormatter NGAY =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(DinhDangEmail.MUI_GIO);

    static final String LOI_KHONG_HOP_LE = ThongDiep.vi("heThong.lienKetKhongHopLe");
    static final String LOI_DA_DUNG = ThongDiep.vi("heThong.lienKetDaDung");
    static final String LOI_DA_THAY = ThongDiep.vi("heThong.lienKetDaThay");

    private final LienKetDatMatKhauRepository repository;
    private final SecureRandom random = new SecureRandom();

    public LienKetDatMatKhauService(LienKetDatMatKhauRepository repository) {
        this.repository = repository;
    }

    /** Mã gốc (chỉ để gắn vào email, không lưu) và hạn của liên kết vừa tạo. */
    public record LienKetMoi(String ma, Instant hetHanLuc) {
        @Override
        public String toString() {
            return "LienKetMoi[ma=***, hetHanLuc=" + hetHanLuc + "]";
        }
    }

    /** Tạo liên kết mới cho một người; các liên kết chưa dùng trước đó của người này hết hiệu lực. */
    @Transactional(propagation = Propagation.MANDATORY)
    public LienKetMoi tao(Integer nguoiDungId, String mucDich, Integer taoBoi, Instant luc) {
        repository.huyConMo(nguoiDungId, luc);
        byte[] bytes = new byte[SO_BYTE_MA];
        random.nextBytes(bytes);
        String ma = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant hetHan = luc.plus(HIEU_LUC);
        repository.save(LienKetDatMatKhau.builder()
                .nguoiDungId(nguoiDungId)
                .maBam(bam(ma))
                .mucDich(mucDich)
                .taoLuc(luc)
                .hetHanLuc(hetHan)
                .taoBoi(taoBoi)
                .build());
        return new LienKetMoi(ma, hetHan);
    }

    /**
     * Liên kết của mã, còn dùng được tại {@code luc} (chỉ đọc, cho trang Đặt mật khẩu mở ra). Không có, đã dùng, đã bị
     * thay hoặc hết hạn thì ném {@link LoiCoMaException} 400 với mã riêng để giao diện báo đúng việc cần làm.
     */
    public LienKetDatMatKhau timConHieuLuc(String ma, Instant luc) {
        LienKetDatMatKhau lk = repository.findByMaBam(bamNeuDungDang(ma))
                .orElseThrow(() -> loi(MaLoi.LIEN_KET_KHONG_HOP_LE, ThongDiep.of("heThong.lienKetKhongHopLe")));
        kiemConHieuLuc(lk, luc);
        return lk;
    }

    /**
     * Như {@link #timConHieuLuc} nhưng khóa dòng tới hết giao dịch của nơi gọi, để dùng liên kết: nơi gọi đặt
     * {@code daDungLuc} rồi commit. Request khác cùng mã đợi khóa xong mới đọc nên thấy "đã dùng".
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public LienKetDatMatKhau khoaDeDung(String ma, Instant luc) {
        LienKetDatMatKhau lk = repository.khoaTheoMaBam(bamNeuDungDang(ma))
                .orElseThrow(() -> loi(MaLoi.LIEN_KET_KHONG_HOP_LE, ThongDiep.of("heThong.lienKetKhongHopLe")));
        kiemConHieuLuc(lk, luc);
        return lk;
    }

    private static String bamNeuDungDang(String ma) {
        if (ma == null || !DANG_MA.matcher(ma).matches()) {
            throw loi(MaLoi.LIEN_KET_KHONG_HOP_LE, ThongDiep.of("heThong.lienKetKhongHopLe"));
        }
        return bam(ma);
    }

    static void kiemConHieuLuc(LienKetDatMatKhau lk, Instant luc) {
        if (lk.getDaDungLuc() != null) {
            throw loi(MaLoi.LIEN_KET_DA_DUNG, ThongDiep.of("heThong.lienKetDaDung"));
        }
        if (lk.getHuyLuc() != null) {
            throw loi(MaLoi.LIEN_KET_DA_THAY, ThongDiep.of("heThong.lienKetDaThay"));
        }
        if (!lk.getHetHanLuc().isAfter(luc)) {
            // Giờ và ngày tách hai tham số (bản tiếng Anh không có chữ "ngày"); tiếng Việt vẫn như DinhDangEmail.gioNgay
            throw loi(MaLoi.LIEN_KET_HET_HAN, ThongDiep.of("heThong.lienKetHetHan",
                    GIO.format(lk.getHetHanLuc()), NGAY.format(lk.getHetHanLuc())));
        }
    }

    /** Hủy mọi liên kết chưa dùng của một người (mật khẩu vừa đổi bằng cách khác, hoặc trước khi tạo liên kết mới). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void huyConMo(Integer nguoiDungId, Instant luc) {
        repository.huyConMo(nguoiDungId, luc);
    }

    static String bam(String ma) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(ma.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new LoiTrangThaiException(ThongDiep.of("heThong.jvmThieuSha256"), e);
        }
    }

    private static LoiCoMaException loi(String ma, ThongDiep thongDiep) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, ma, thongDiep);
    }
}
