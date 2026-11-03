package com.dev.backend.utils;

import java.util.ArrayList;
import java.util.List;

/**
 * Tiện ích sinh mã vạch Barcode Code 128 (Subset B) dạng SVG thuần cho chứng từ và tem vận đơn.
 * Không phụ thuộc thư viện ngoài, tương thích 100% với mọi máy quét mã vạch và máy in tem nhiệt.
 */
public final class BarcodeHelper {

    private BarcodeHelper() {}

    private static final int[] PATTERNS = {
            212222, 222122, 222221, 121223, 121322, 131222, 122213, 122312, 132212, 221213, // 0-9
            221312, 231212, 112232, 122132, 122231, 113222, 123122, 123221, 223211, 221132, // 10-19
            221231, 213212, 223112, 312131, 311222, 321122, 321221, 312212, 322112, 322211, // 20-29
            212123, 212321, 232121, 111323, 131123, 131321, 112313, 132113, 132311, 211313, // 30-39
            231113, 231311, 112133, 112331, 132131, 113123, 113321, 133121, 313121, 211331, // 40-49
            231131, 213113, 213311, 213131, 311123, 311321, 331121, 312113, 312311, 332111, // 50-59
            314111, 221411, 431111, 111224, 111422, 121124, 121421, 141122, 141221, 112214, // 60-69
            112412, 122114, 122411, 142112, 142211, 241211, 221114, 413111, 241112, 134111, // 70-79
            111242, 121142, 121241, 114212, 124112, 124211, 411212, 421112, 421211, 212141, // 80-89
            214121, 412121, 111143, 111341, 131141, 114113, 114311, 411113, 411311, 113141, // 90-99
            114131, 311141, 411131, 211412, 211214, 211232, 2331112 // 100-106 (104=StartB, 106=Stop)
    };

    /**
     * Tạo chuỗi SVG mã vạch Code 128 từ văn bản ASCII.
     * @param rawText Chuỗi cần mã hóa (mã vận đơn, số đơn hàng...)
     * @param heightPx Chiều cao mã vạch (ví dụ: 50, 60)
     * @return Chuỗi XML SVG hiển thị mã vạch
     */
    public static String generateCode128Svg(String rawText, int heightPx) {
        if (rawText == null || rawText.isBlank()) return "";
        String text = rawText.trim();

        List<Integer> codes = new ArrayList<>();
        codes.add(104); // Start Code B

        int checksum = 104;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            int code = (ch >= 32 && ch <= 126) ? (ch - 32) : 0;
            codes.add(code);
            checksum += (i + 1) * code;
        }
        codes.add(checksum % 103);
        codes.add(106); // Stop

        StringBuilder svgRects = new StringBuilder();
        int currentX = 10; // Quiet zone 10 units
        int totalUnits = 20; // 10 units left + 10 units right

        for (int idx = 0; idx < codes.size(); idx++) {
            int codeVal = codes.get(idx);
            int pattern = PATTERNS[codeVal];
            String patStr = String.valueOf(pattern);
            for (int p = 0; p < patStr.length(); p++) {
                int width = patStr.charAt(p) - '0';
                boolean isBar = (p % 2 == 0);
                if (isBar) {
                    svgRects.append("<rect x=\"").append(currentX)
                            .append("\" y=\"0\" width=\"").append(width)
                            .append("\" height=\"").append(heightPx)
                            .append("\" fill=\"#000000\"/>");
                }
                currentX += width;
                totalUnits += width;
            }
        }

        totalUnits = currentX + 10;

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + totalUnits + " " + heightPx + "\" "
                + "width=\"100%\" height=\"" + heightPx + "px\" preserveAspectRatio=\"none\" style=\"display:block;\">"
                + svgRects
                + "</svg>";
    }
}

