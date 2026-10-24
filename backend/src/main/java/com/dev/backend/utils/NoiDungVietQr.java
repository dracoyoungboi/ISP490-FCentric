package com.dev.backend.utils;

/**
 * Đọc nội dung chuyển khoản trong chuỗi mã VietQR (chuẩn EMVCo: các trường "mã 2 số + độ dài 2 số + giá trị";
 * trường 62 "Additional Data", mục con 08 "Purpose of Transaction" là nội dung CK app ngân hàng điền sẵn).
 *
 * payOS thêm mã nhận diện của họ vào trước nội dung mình gửi ("CST9DVDPQ93 FC2320800" thay vì "FC2320800")
 * và chỉ nhận ra khoản chuyển khi có mã đó. Hộp thoại QR phải hiện nội dung đầy đủ này, không thì khách
 * chuyển tay theo nội dung ngắn sẽ không được ghi nhận dù đúng số tiền.
 */
public final class NoiDungVietQr {

    private NoiDungVietQr() {
    }

    /** Nội dung CK trong mã QR; null nếu chuỗi không đúng định dạng hoặc không có nội dung. */
    public static String tuMaQr(String qr) {
        String additional = timTruong(qr, "62");
        String noiDung = additional == null ? null : timTruong(additional, "08");
        if (noiDung == null || noiDung.isBlank()) return null;
        // Nội dung CK của payOS chỉ gồm chữ không dấu, số, khoảng trắng; khác đi là đọc lệch -> không tin
        return noiDung.trim().matches("[A-Za-z0-9 ]+") ? noiDung.trim() : null;
    }

    private static String timTruong(String data, String ma) {
        if (data == null) return null;
        int i = 0;
        while (i + 4 <= data.length()) {
            String id = data.substring(i, i + 2);
            int doDai;
            try {
                doDai = Integer.parseInt(data.substring(i + 2, i + 4));
            } catch (NumberFormatException e) {
                return null;
            }
            int batDau = i + 4;
            if (batDau + doDai > data.length()) return null;
            if (id.equals(ma)) return data.substring(batDau, batDau + doDai);
            i = batDau + doDai;
        }
        return null;
    }
}
