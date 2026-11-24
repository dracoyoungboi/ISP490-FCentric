package com.dev.backend.utils;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tiện ích chuẩn hóa siêu dữ liệu vận đơn, mã chia chọn tuyến và phương thức thanh toán Shopee/sàn TMĐT
 * lưu trong ghi chú đơn bán hàng (không sửa DDL bảng).
 */
public final class ShopeeWaybillMetadataHelper {

    public static final String TAG_VAN_DON = "VẬN ĐƠN";
    public static final String TAG_DON_VI = "ĐƠN VỊ";
    public static final String TAG_TUYEN = "TUYẾN";
    public static final String TAG_TRAM = "TRẠM";
    public static final String TAG_PTTT = "PTTT";
    public static final String TAG_COD = "COD";
    public static final String TAG_KIEN = "KIỆN";

    private static final Locale VI_LOCALE = new Locale("vi", "VN");

    private ShopeeWaybillMetadataHelper() {
    }

    public record ShippingDocDataInfo(
            String trackingNumber,
            String shippingCarrier,
            String maDinhTuyen,
            String maTramPhat,
            Boolean cod,
            BigDecimal codAmount
    ) {
    }

    public record PaymentSummary(
            boolean cod,
            String phuongThuc,
            BigDecimal tienThuHoCod,
            String nhanThanhToan,
            String nhanInTem
    ) {
    }

    /** Kiểm tra mã vận đơn giả tự bịa kiểu "SPXVN" + orderSn hoặc chuỗi rỗng. */
    public static boolean isFakeShopeeTracking(String trackingNo, String orderSn) {
        if (trackingNo == null || trackingNo.isBlank()) {
            return true;
        }
        String cleanTracking = trackingNo.trim();
        if (orderSn == null || orderSn.isBlank()) {
            return false;
        }
        String cleanSn = orderSn.trim().replaceFirst("^(?i)SHP-", "").trim();
        if (cleanSn.isEmpty()) {
            return false;
        }
        return cleanTracking.equalsIgnoreCase("SPXVN" + cleanSn);
    }

    /** Trích giá trị trong thẻ `[TEN_THE: gia_tri]`; trả null nếu không thấy hoặc giá trị rỗng. */
    public static String extractTag(String ghiChu, String tagName) {
        if (ghiChu == null || ghiChu.isBlank() || tagName == null || tagName.isBlank()) {
            return null;
        }
        Pattern pattern = Pattern.compile("\\[" + Pattern.quote(tagName) + ":\\s*([^\\]]*)\\]",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        Matcher matcher = pattern.matcher(ghiChu);
        if (!matcher.find()) {
            return null;
        }
        String val = matcher.group(1) != null ? matcher.group(1).trim() : "";
        return val.isBlank() || "null".equalsIgnoreCase(val) || "N/A".equalsIgnoreCase(val) ? null : val;
    }

    /** Trích mã vận đơn thật từ ghi chú (bỏ qua mã giả `SPXVN<orderSn>` và tách phần ĐVVC nếu viết gộp). */
    public static String extractTracking(String ghiChu, String orderSn) {
        String raw = extractTag(ghiChu, TAG_VAN_DON);
        if (raw == null) {
            return null;
        }
        String candidate = raw;
        int dashIdx = raw.indexOf(" - ");
        if (dashIdx > 0) {
            String left = raw.substring(0, dashIdx).trim();
            if (!left.isEmpty() && !left.contains(" ")) {
                candidate = left;
            }
        }
        return isFakeShopeeTracking(candidate, orderSn) ? null : candidate;
    }

    /** Trích tên đơn vị vận chuyển từ `[ĐƠN VỊ: ...]` (bỏ qua rỗng) hoặc hậu tố `[VẬN ĐƠN: xxx - Carrier]`. */
    public static String extractCarrier(String ghiChu) {
        String carrier = extractTag(ghiChu, TAG_DON_VI);
        if (carrier != null) {
            return carrier;
        }
        String rawVanDon = extractTag(ghiChu, TAG_VAN_DON);
        if (rawVanDon != null) {
            int dashIdx = rawVanDon.indexOf(" - ");
            if (dashIdx > 0 && dashIdx + 3 < rawVanDon.length()) {
                String left = rawVanDon.substring(0, dashIdx).trim();
                String right = rawVanDon.substring(dashIdx + 3).trim();
                if (!left.contains(" ") && !right.isBlank() && !"Shopee".equalsIgnoreCase(right)) {
                    return right;
                }
            }
        }
        return null;
    }

    /** Cập nhật tại chỗ thẻ `[TAG: value]` (loại bỏ bản trùng lặp), hoặc xóa thẻ nếu value rỗng. */
    public static String upsertTag(String ghiChu, String tagName, String value) {
        if (tagName == null || tagName.isBlank()) {
            return ghiChu;
        }
        if (value == null || value.isBlank()) {
            return removeTag(ghiChu, tagName);
        }
        String base = ghiChu != null ? ghiChu : "";
        String newTag = "[" + tagName + ": " + value.trim() + "]";
        Pattern pattern = Pattern.compile("\\[" + Pattern.quote(tagName) + ":[^\\]]*\\]",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        Matcher matcher = pattern.matcher(base);
        if (matcher.find()) {
            StringBuffer sb = new StringBuffer();
            matcher.appendReplacement(sb, Matcher.quoteReplacement(newTag));
            while (matcher.find()) {
                matcher.appendReplacement(sb, "");
            }
            matcher.appendTail(sb);
            return cleanSeparators(sb.toString());
        }
        if (base.isBlank()) {
            return newTag;
        }
        return cleanSeparators(base + " | " + newTag);
    }

    /** Gỡ sạch thẻ `[TAG: ...]` và các dấu ngăn cách dư thừa khỏi ghi chú. */
    public static String removeTag(String ghiChu, String tagName) {
        if (ghiChu == null || ghiChu.isBlank() || tagName == null || tagName.isBlank()) {
            return ghiChu;
        }
        Pattern pattern = Pattern.compile("\\[" + Pattern.quote(tagName) + ":[^\\]]*\\]",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        String stripped = pattern.matcher(ghiChu).replaceAll("");
        return cleanSeparators(stripped);
    }

    private static String cleanSeparators(String text) {
        if (text == null) {
            return null;
        }
        String cleaned = text
                .replaceAll("\\s{2,}", " ")
                .replaceAll("(?:\\s*\\|\\s*)+", " | ")
                .replaceAll("^\\s*\\|\\s*|\\s*\\|\\s*$", "")
                .trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    /** Kiểm tra chính xác phương thức thanh toán Shopee có phải COD hay không (không dò chuỗi bừa bãi). */
    public static boolean isShopeeCodPayment(String rawPaymentMethod) {
        if (rawPaymentMethod == null || rawPaymentMethod.isBlank()) {
            return false;
        }
        String norm = rawPaymentMethod.trim().toLowerCase(Locale.ROOT);
        return norm.equals("cod")
                || norm.equals("cash_on_delivery")
                || norm.equals("cash on delivery")
                || norm.contains("cash_on_delivery")
                || norm.contains("cash on delivery")
                || norm.contains("thanh toán khi nhận")
                || norm.matches(".*\\bcod\\b.*");
    }

    /** Chuẩn hóa nhãn phương thức thanh toán Shopee: phân biệt rõ COD vs Ví ShopeePay / Thẻ / Online. */
    public static String normalizeShopeePaymentMethod(String rawPaymentMethod, Boolean codFlag) {
        if (Boolean.TRUE.equals(codFlag) || isShopeeCodPayment(rawPaymentMethod)) {
            return "COD";
        }
        if (rawPaymentMethod == null || rawPaymentMethod.isBlank()) {
            return Boolean.FALSE.equals(codFlag) ? "Thanh toán online" : null;
        }
        String trimmed = rawPaymentMethod.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.contains("shopeepay") || lower.contains("shopee pay") || lower.contains("airpay")) {
            return "Ví ShopeePay";
        }
        if (lower.contains("spaylater")) {
            return "SPayLater";
        }
        if (lower.contains("credit") || lower.contains("debit") || lower.contains("visa")
                || lower.contains("mastercard") || lower.contains("jcb")) {
            return "Thẻ tín dụng/ghi nợ";
        }
        if (lower.contains("bank") || lower.contains("ibanking") || lower.contains("napas")
                || lower.contains("cybersource") || lower.contains("vnpay") || lower.contains("chuyển khoản")) {
            return "Chuyển khoản ngân hàng";
        }
        if (lower.contains("apple")) {
            return "Apple Pay";
        }
        if (lower.contains("google")) {
            return "Google Pay";
        }
        return trimmed;
    }

    /** Bóc tách JSON trả về từ Shopee `/api/v2/logistics/get_shipping_document_data_info`. */
    public static ShippingDocDataInfo parseShippingDocDataInfo(JsonNode res) {
        if (res == null || res.isMissingNode() || res.isNull()) {
            return null;
        }
        String err = textOrNull(res.path("error"));
        if (err != null) {
            return null;
        }
        JsonNode resp = res.path("response");
        JsonNode info = resp.path("shipping_document_info");
        if (info.isMissingNode() || info.isNull()) {
            info = resp;
        }
        if (info.isMissingNode() || info.isNull()) {
            return null;
        }

        String trackingNumber = textOrNull(info.path("tracking_number"));
        String shippingCarrier = textOrNull(info.path("shipping_carrier"));

        JsonNode sortNode = info.path("recipient_sort_code");
        String firstSort = textOrNull(sortNode.path("first_recipient_sort_code"));
        if (firstSort == null) {
            firstSort = textOrNull(info.path("zone"));
        }
        if (firstSort == null) {
            firstSort = textOrNull(info.path("lane_code"));
        }

        List<String> stationParts = new ArrayList<>();
        String secondSort = textOrNull(sortNode.path("second_recipient_sort_code"));
        String thirdSort = textOrNull(sortNode.path("third_recipient_sort_code"));
        if (secondSort != null) {
            stationParts.add(secondSort);
        }
        if (thirdSort != null && !thirdSort.equalsIgnoreCase(secondSort)) {
            stationParts.add(thirdSort);
        }
        String maTramPhat = stationParts.isEmpty() ? null : String.join(" - ", stationParts);

        Boolean cod = null;
        JsonNode codNode = info.get("cod");
        if (codNode != null && !codNode.isNull()) {
            cod = codNode.asBoolean();
        }

        BigDecimal codAmount = parsePositiveDecimal(info.get("cod_amount"));
        if (trackingNumber == null && shippingCarrier == null && firstSort == null
                && maTramPhat == null && cod == null && codAmount == null) {
            return null;
        }
        return new ShippingDocDataInfo(trackingNumber, shippingCarrier, firstSort, maTramPhat, cod, codAmount);
    }

    /** Tính nhãn thanh toán & tiền thu hộ COD chuẩn xác cho cả đơn COD (kể cả khi đã COMPLETED) lẫn Ví điện tử. */
    public static PaymentSummary resolveOrderPaymentSummary(
            String ghiChu,
            String trangThaiThanhToan,
            BigDecimal tongCong,
            boolean laShopeeChoXacNhan
    ) {
        String ptttTag = extractTag(ghiChu, TAG_PTTT);
        BigDecimal codFromTag = parsePositiveDecimalString(extractTag(ghiChu, TAG_COD));
        BigDecimal effectiveTotal = (tongCong != null && tongCong.compareTo(BigDecimal.ZERO) > 0)
                ? tongCong : BigDecimal.ZERO;
        boolean paid = "da_thanh_toan".equalsIgnoreCase(trangThaiThanhToan);

        if ("COD".equalsIgnoreCase(ptttTag)) {
            BigDecimal codVal = codFromTag != null ? codFromTag : effectiveTotal;
            String fmt = formatVnd(codVal);
            String nhanInTem = "THU HỘ(COD): " + fmt + " VNĐ";
            String nhanThanhToan = paid
                    ? ("COD · Đã thu hộ (" + fmt + " ₫)")
                    : ("Thu hộ (COD): " + fmt + " ₫");
            return new PaymentSummary(true, "COD", codVal, nhanThanhToan, nhanInTem);
        }

        if (ptttTag != null && !ptttTag.isBlank()) {
            String nhanInTem = paid ? "ĐÃ THANH TOÁN (COD: 0 đ)" : "CHỜ THANH TOÁN ONLINE (COD: 0 đ)";
            String nhanThanhToan = paid
                    ? (ptttTag + " · Đã thanh toán (COD: 0 ₫)")
                    : (ptttTag + " · Chờ thanh toán (COD: 0 ₫)");
            return new PaymentSummary(false, ptttTag, BigDecimal.ZERO, nhanThanhToan, nhanInTem);
        }

        // Legacy fallback cho đơn cũ chưa lưu [PTTT:]
        if (paid) {
            return new PaymentSummary(false, null, BigDecimal.ZERO,
                    "Đã thanh toán (COD: 0 ₫)", "ĐÃ THANH TOÁN (COD: 0 đ)");
        }
        if (laShopeeChoXacNhan) {
            return new PaymentSummary(false, null, BigDecimal.ZERO,
                    "Chờ sàn xác nhận thanh toán", "CHỜ XÁC NHẬN THANH TOÁN");
        }
        String fmt = formatVnd(effectiveTotal);
        return new PaymentSummary(true, "COD", effectiveTotal,
                "Thu hộ (COD): " + fmt + " ₫",
                "THU HỘ(COD): " + fmt + " VNĐ");
    }

    public static String formatVnd(BigDecimal amount) {
        BigDecimal val = amount != null ? amount : BigDecimal.ZERO;
        return NumberFormat.getInstance(VI_LOCALE).format(val);
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText("").trim();
        return text.isBlank() || "null".equalsIgnoreCase(text) ? null : text;
    }

    private static BigDecimal parsePositiveDecimal(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            BigDecimal val = node.decimalValue();
            return val.compareTo(BigDecimal.ZERO) > 0 ? val : null;
        }
        return parsePositiveDecimalString(node.asText(""));
    }

    private static BigDecimal parsePositiveDecimalString(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal val = new BigDecimal(raw.trim().replace(",", ""));
            return val.compareTo(BigDecimal.ZERO) > 0 ? val : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
