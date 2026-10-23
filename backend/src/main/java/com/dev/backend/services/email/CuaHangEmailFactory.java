package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.repository.email.CuaHangEmailRepository;
import com.dev.backend.utils.PublicAssetUrl;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Dựng {@link CuaHangEmail} từ Thông tin cửa hàng (entity, không qua ThongTinCongTyDto vì DTO tự thêm tên
 * "FCentric" và logo mặc định khi chưa có hồ sơ). Gọi ở luồng gửi email, không gọi trong request Quên mật khẩu
 * (giữ thời gian phản hồi như nhau dù tài khoản có hay không).
 */
@Component
public class CuaHangEmailFactory {

    /** Hồ sơ cửa hàng là bảng một dòng, id = 1 (như ThongTinCongTyService). */
    static final int ID_HO_SO = 1;
    /** Email không hiện được SVG: chỉ nhận ảnh PNG, JPG. */
    static final Set<String> DUOI_LOGO = Set.of("png", "jpg", "jpeg");

    private final CuaHangEmailRepository repository;

    public CuaHangEmailFactory(CuaHangEmailRepository repository) {
        this.repository = repository;
    }

    public CuaHangEmail hienTai() {
        return repository.timKemLogo(ID_HO_SO).map(CuaHangEmailFactory::tu).orElse(CuaHangEmail.TRONG);
    }

    static CuaHangEmail tu(ThongTinCongTy t) {
        return new CuaHangEmail(
                sach(t.getTenCongTy()),
                sach(t.getTenDangKyKinhDoanh()),
                sach(t.getMaSoThue()),
                sach(t.getDiaChi()),
                DinhDangEmail.dienThoai(t.getSoDienThoai()),
                sach(t.getEmail()),
                logo(t));
    }

    /**
     * Logo cho email: chỉ nhận ảnh PNG/JPG qua https:// (email không hiện được SVG; http bị chặn). Có tệp tải lên
     * (tep_tin) thì xét {@code tep_tin.duoi_tep}, KHÔNG xét đuôi URL: đường dẫn MinIO thật có dạng
     * "…logo.png1791231557679". Chỉ cột cũ logo_duong_dan (không có tep_tin) mới xét đuôi trong đường dẫn.
     */
    static String logo(ThongTinCongTy t) {
        TepTin tep = t.getTepTin();
        if (tep != null && sach(tep.getDuongDan()) != null) {
            String url = PublicAssetUrl.toHttps(tep.getDuongDan().trim());
            return hopLe(url, tep.getDuoiTep()) ? url : null;
        }
        String cu = sach(t.getLogoDuongDan());
        if (cu == null) {
            return null;
        }
        String url = PublicAssetUrl.toHttps(cu);
        return hopLe(url, duoiTrongDuongDan(url)) ? url : null;
    }

    private static boolean hopLe(String url, String duoi) {
        if (url == null || !url.regionMatches(true, 0, "https://", 0, "https://".length())) {
            return false;
        }
        if (duoi == null) {
            return false;
        }
        String d = duoi.trim().toLowerCase(Locale.ROOT);
        if (d.startsWith(".")) {
            d = d.substring(1);
        }
        return DUOI_LOGO.contains(d);
    }

    static String duoiTrongDuongDan(String url) {
        if (url == null) {
            return null;
        }
        String duongDan = url;
        int cat = duongDan.indexOf('?');
        if (cat >= 0) {
            duongDan = duongDan.substring(0, cat);
        }
        cat = duongDan.indexOf('#');
        if (cat >= 0) {
            duongDan = duongDan.substring(0, cat);
        }
        int cham = duongDan.lastIndexOf('.');
        int gach = duongDan.lastIndexOf('/');
        return cham > gach && cham >= 0 ? duongDan.substring(cham + 1) : null;
    }

    private static String sach(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
