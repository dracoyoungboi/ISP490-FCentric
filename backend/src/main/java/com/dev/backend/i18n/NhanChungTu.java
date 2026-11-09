package com.dev.backend.i18n;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Nhãn chứng từ / tệp mà nơi gọi truyền vào tiện ích dùng chung bằng chữ tiếng Việt ("Phiếu nhập PN-001", "Kho Tổng",
 * "Ảnh biên bản"…) → câu theo khóa (bộ {@code nhan}), để câu lỗi tiếng Anh không lẫn chữ Việt.
 * Nhận ra theo tiền tố / nguyên văn; không nhận ra thì trả nguyên chuỗi (câu tiếng Việt vẫn đúng như cũ).
 * {@code vietThuong}: chữ đầu viết thường (nhãn đứng giữa câu), giống {@code Character.toLowerCase} cũ ở bản Việt.
 */
public final class NhanChungTu {

    private record TienTo(String tienTo, String khoa, String hauTo) {
    }

    // Tiền tố dài thử trước ("Đợt kiểm kê kho " trước "Kho ")
    private static final List<TienTo> TIEN_TO = List.of(
            new TienTo("Đợt kiểm kê kho ", "dotKiemKeKho", ""),
            new TienTo("Biên bản trả hàng ", "bienBanTraHang", ""),
            new TienTo("Phiếu điều chỉnh ", "phieuDieuChinh", ""),
            new TienTo("Phiếu chuyển ", "phieuChuyen", ""),
            new TienTo("Phiếu nhập ", "phieuNhap", ""),
            new TienTo("Sơ đồ kho ", "soDoKho", ""),
            new TienTo("Ảnh \"", "anhTen", "\""),
            new TienTo("Kho ", "kho", ""),
            new TienTo("Đơn ", "don", ""));

    private static final Map<String, String> NGUYEN_VAN = Map.ofEntries(
            Map.entry("Kho đang chọn", "khoDangChon"),
            Map.entry("Nhiệm vụ hoàn kệ", "nhiemVuHoanKe"),
            Map.entry("Tệp logo", "tepLogo"),
            Map.entry("Ảnh tải lên", "anhTaiLen"),
            Map.entry("Ảnh biên bản", "anhBienBan"),
            Map.entry("Ảnh minh chứng", "anhMinhChung"),
            Map.entry("ảnh JPEG, PNG hoặc WebP", "anhJpegPngWebp"),
            Map.entry("ảnh PNG, JPEG hoặc WebP", "anhPngJpegWebp"),
            Map.entry("Phí vận chuyển", "phiVanChuyen"));

    /** Tiền tố khóa của bộ câu nhan.properties (khóa ghép động: nhan.<ten>[Thuong]). */
    private static final String BO = "nhan.";

    private NhanChungTu() {
    }

    /** ThongDiep nếu nhận ra nhãn, ngược lại chuỗi gốc (viết thường chữ đầu nếu {@code vietThuong}). */
    public static Object theoKhoa(String nhan, boolean vietThuong) {
        if (nhan == null || nhan.isEmpty()) return nhan;
        String duoi = vietThuong ? "Thuong" : "";
        String khoa = NGUYEN_VAN.get(nhan);
        if (khoa != null) return ThongDiep.of(BO + khoa + duoi);
        for (TienTo tt : TIEN_TO) {
            if (nhan.length() > tt.tienTo().length() + tt.hauTo().length()
                    && nhan.startsWith(tt.tienTo()) && nhan.endsWith(tt.hauTo())) {
                String ma = nhan.substring(tt.tienTo().length(), nhan.length() - tt.hauTo().length());
                return ThongDiep.of(BO + tt.khoa() + duoi, ma);
            }
        }
        return vietThuong ? nhan.substring(0, 1).toLowerCase(Locale.ROOT) + nhan.substring(1) : nhan;
    }
}
