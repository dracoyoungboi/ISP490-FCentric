package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.multitable.NhatHangServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongConsumer;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Chạy lại một thao tác khi số chứng từ vừa cấp bị giao dịch khác dùng trước (xem {@link SoChungTu}: số lớn nhất + 1, hai
 * giao dịch cùng lúc lấy cùng số thì khóa duy nhất chặn bên sau). Mỗi lần chạy là một giao dịch mới: {@code viec} phải gọi
 * qua proxy của service @Transactional (gọi từ controller), lần trước đã rollback sạch nên lần sau đọc lại số lớn nhất
 * mới. Chỉ thử lại lỗi trùng của cột SỐ CHỨNG TỪ; trùng khác (vd. số XKNB người dùng nhập) ném nguyên.
 * Nhiều yêu cầu cùng lúc (vd. duyệt 6 phiếu một lúc) thì mỗi vòng chỉ một bên lấy được số: giữa các lần chờ một quãng
 * ngẫu nhiên tăng dần để các bên lệch nhau, và thử tối đa {@link #SO_LAN} lần.
 */
@Slf4j
public final class ThuLaiKhiTrungSo {

    static final int SO_LAN = 6;

    /** Chờ giữa hai lần thử (mili giây); test thay bằng hàm không chờ. */
    static LongConsumer cho = ms -> {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    };

    static final String LOI_HET_LAN = "Nhiều người vừa thao tác cùng lúc nên số chứng từ bị trùng. Vui lòng bấm lại.";

    /** Khóa duy nhất của cột số chứng từ (tên khóa trong câu lỗi MySQL "Duplicate entry … for key 'bảng.khóa'"). */
    static final Set<String> KHOA_SO_CHUNG_TU = Set.of(
            "uk_so_phieu_chuyen", "uk_pck_so_lenh",                 // phieu_chuyen_kho: PX-TRF, LDD
            "uk_phieu_xuat_kho_so_phieu", "so_phieu_xuat",          // phieu_xuat_kho: PX-CK
            "uk_phieu_nhap_kho_so_phieu", "so_phieu_nhap",          // phieu_nhap_kho: PN-TRF, PN-RET
            "uk_so_bien_ban",                                       // bien_ban_giao_nhan: BBGN
            "so_phieu",                                             // phieu_dieu_chinh_kho: DCK
            "uk_ma_pick_list");                                     // danh_sach_nhat_hang: PL

    private static final Pattern TRUNG = Pattern.compile("Duplicate entry '.*' for key '(?:[^'.]+\\.)?([^']+)'");

    private ThuLaiKhiTrungSo() {
    }

    public static <T> T chay(Supplier<T> viec) {
        for (int lan = 1; ; lan++) {
            try {
                return viec.get();
            } catch (RuntimeException ex) {
                if (!laTrungSoChungTu(ex)) throw ex;
                if (lan >= SO_LAN) {
                    log.warn("Số chứng từ vẫn trùng sau {} lần thử: {}", lan, ex.getMessage());
                    throw new CommonException(HttpStatus.CONFLICT, LOI_HET_LAN);
                }
                log.info("Số chứng từ bị trùng do chạy đồng thời, thử lại lần {}", lan + 1);
                cho.accept(ThreadLocalRandom.current().nextLong(20, 80) * lan);
            }
        }
    }

    /** Lỗi trùng khóa duy nhất của cột số chứng từ (tìm trong chuỗi nguyên nhân), hoặc 409 trùng mã phiếu nhặt. */
    static boolean laTrungSoChungTu(Throwable ex) {
        if (ex instanceof CommonException ce && NhatHangServiceImpl.LOI_TRUNG_MA_PHIEU_NHAT.equals(ce.getMessage())) {
            return true;
        }
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            String m = t.getMessage();
            if (m == null) continue;
            Matcher k = TRUNG.matcher(m);
            if (k.find() && KHOA_SO_CHUNG_TU.contains(k.group(1))) return true;
        }
        return false;
    }
}
