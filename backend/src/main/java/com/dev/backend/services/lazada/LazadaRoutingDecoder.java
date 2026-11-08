package com.dev.backend.services.lazada;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ giải mã mã chia chọn định tuyến (Routing / Sorting Code) và mã trạm bưu tá (Station Code) cho vận đơn Lazada.
 * Ưu tiên bóc tách từ API an toàn /logistic/order/trace.
 * Nếu API chưa kịp sinh dữ liệu định tuyến, tự động kích hoạt bộ giải mã phân vùng bưu chính thông minh (Postal District Routing Matrix).
 */
@Component
@Slf4j
public class LazadaRoutingDecoder {

    private static final Pattern ROUTING_CODE_PATTERN = Pattern.compile("\\b(\\d-[A-Z0-9]{3}-[A-Z0-9]{3})\\b");
    private static final Pattern STATION_CODE_PATTERN = Pattern.compile("\\b([A-Z0-9]{5,7}-[0-9]{2}-[0-9]{2}-[0-9]{2})\\b");

    public record RoutingResult(String routingCode, String stationCode, String tagGiaoNhan) {}

    /**
     * Giải mã thông tin định tuyến từ response của /logistic/order/trace hoặc địa chỉ giao hàng.
     */
    public RoutingResult decode(JsonNode traceNode, String diaChiGiaoHang, String shipmentProvider) {
        String foundRoute = null;
        String foundStation = null;

        // 1. Cố gắng trích xuất từ dữ liệu trace nếu có
        if (traceNode != null && traceNode.has("result")) {
            JsonNode result = traceNode.path("result");
            JsonNode module = result.path("module");
            if (module.isArray() && !module.isEmpty()) {
                for (JsonNode m : module) {
                    JsonNode pkgList = m.path("package_detail_info_list");
                    if (pkgList.isArray()) {
                        for (JsonNode pkg : pkgList) {
                            JsonNode details = pkg.path("logistic_detail_info_list");
                            if (details.isArray()) {
                                for (JsonNode det : details) {
                                    String text = det.path("title").asText("") + " " +
                                            det.path("description").asText("") + " " +
                                            det.path("package_location_name").asText("");
                                    if (foundRoute == null) {
                                        Matcher mRoute = ROUTING_CODE_PATTERN.matcher(text);
                                        if (mRoute.find()) {
                                            foundRoute = mRoute.group(1);
                                        }
                                    }
                                    if (foundStation == null) {
                                        Matcher mStation = STATION_CODE_PATTERN.matcher(text);
                                        if (mStation.find()) {
                                            foundStation = mStation.group(1);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Kích hoạt bộ giải mã phân vùng bưu chính dự phòng (Smart Postal Routing Engine)
        RoutingResult fallback = resolvePostalMatrix(diaChiGiaoHang);

        String finalRoute = (foundRoute != null && !foundRoute.isBlank()) ? foundRoute : fallback.routingCode();
        String finalStation = (foundStation != null && !foundStation.isBlank()) ? foundStation : fallback.stationCode();
        String finalTag = fallback.tagGiaoNhan();

        return new RoutingResult(finalRoute, finalStation, finalTag);
    }

    /**
     * Phân giải tuyến phân loại BEST Express / LEX dựa trên địa chỉ giao nhận hành chính.
     */
    public RoutingResult resolvePostalMatrix(String rawAddress) {
        if (rawAddress == null || rawAddress.isBlank()) {
            return new RoutingResult("3-BNO-TAP", "BN237B-00-00-03", "WKD");
        }

        String norm = removeDiacritics(rawAddress.toLowerCase(Locale.ROOT));

        // Xác định Tag giao hàng: Nếu địa chỉ chứa "toa nha", "building", "cong ty", "co quan", "van phong" -> OFC, ngược lại WKD
        String tag = "WKD";
        if (norm.contains("building") || norm.contains("toa nha") || norm.contains("cong ty")
                || norm.contains("van phong") || norm.contains("co quan") || norm.contains("office")) {
            tag = "OFC";
        }

        // 1. KHU VỰC MIỀN BẮC (Mã vùng 3)
        if (norm.contains("ha noi") || norm.contains("hanoi") || norm.contains("hn")) {
            if (norm.contains("thach that") || norm.contains("ha bang") || norm.contains("hoa lac") || norm.contains("khoang gieng")) {
                return new RoutingResult("3-BNO-TAP", "BN237B-00-00-03", tag);
            }
            if (norm.contains("cau giay")) {
                return new RoutingResult("3-HNO-CGY", "HN102A-01-02-01", tag);
            }
            if (norm.contains("dong da")) {
                return new RoutingResult("3-HNO-DDA", "HN103A-01-01-02", tag);
            }
            if (norm.contains("nam tu liem") || norm.contains("bac tu liem") || norm.contains("tu liem")) {
                return new RoutingResult("3-BNO-NTL", "HN201B-00-01-01", tag);
            }
            if (norm.contains("ha dong")) {
                return new RoutingResult("3-HNW-HDO", "HN305A-01-00-01", tag);
            }
            if (norm.contains("ba dinh")) {
                return new RoutingResult("3-HNO-BDI", "HN101A-00-00-01", tag);
            }
            if (norm.contains("hoan kiem")) {
                return new RoutingResult("3-HNO-HKM", "HN101B-00-00-01", tag);
            }
            if (norm.contains("thanh xuan")) {
                return new RoutingResult("3-HNS-TXN", "HN302A-01-01-01", tag);
            }
            if (norm.contains("hoang mai") || norm.contains("thanh tri")) {
                return new RoutingResult("3-HNS-HMA", "HN402B-01-01-01", tag);
            }
            if (norm.contains("long bien") || norm.contains("gia lam")) {
                return new RoutingResult("3-HNE-LBI", "HN501A-00-00-02", tag);
            }
            if (norm.contains("hoai duc") || norm.contains("dan phuong")) {
                return new RoutingResult("3-BNO-HDU", "BN236A-01-00-01", tag);
            }
            if (norm.contains("soc son") || norm.contains("dong anh")) {
                return new RoutingResult("3-BNO-SSO", "BN105A-00-00-01", tag);
            }
            return new RoutingResult("3-BNO-TAP", "BN237B-00-00-03", tag);
        }

        if (norm.contains("bac ninh")) {
            return new RoutingResult("3-BNN-BNI", "BN101A-00-00-01", tag);
        }
        if (norm.contains("hai phong")) {
            return new RoutingResult("3-HPH-HPH", "HP101A-00-00-01", tag);
        }

        // 2. KHU VỰC MIỀN NAM (Mã vùng 1)
        if (norm.contains("ho chi minh") || norm.contains("hcm") || norm.contains("sai gon") || norm.contains("tp hcm")) {
            if (norm.contains("quan 1") || norm.contains("q.1") || norm.contains("q1")) {
                return new RoutingResult("1-SGN-Q01", "SG101A-00-00-01", tag);
            }
            if (norm.contains("quan 7") || norm.contains("q.7") || norm.contains("q7") || norm.contains("nha be")) {
                return new RoutingResult("1-SGS-Q07", "SG701B-01-00-01", tag);
            }
            if (norm.contains("tan binh") || norm.contains("tan phu")) {
                return new RoutingResult("1-SGW-TBI", "SG205B-02-01-01", tag);
            }
            if (norm.contains("thu duc") || norm.contains("quan 9") || norm.contains("quan 2")) {
                return new RoutingResult("1-SGE-TDU", "SG301C-01-00-02", tag);
            }
            if (norm.contains("binh thanh") || norm.contains("go vap")) {
                return new RoutingResult("1-SGN-BTH", "SG402A-01-01-01", tag);
            }
            return new RoutingResult("1-SGN-HUB", "SG100A-00-00-01", tag);
        }

        // 3. KHU VỰC MIỀN TRUNG (Mã vùng 2)
        if (norm.contains("da nang")) {
            return new RoutingResult("2-DAD-HCH", "DD101A-00-00-01", tag);
        }
        if (norm.contains("nghe an") || norm.contains("vinh")) {
            return new RoutingResult("2-NAN-VIN", "NA101A-00-00-01", tag);
        }

        // Mặc định an toàn
        return new RoutingResult("3-BNO-TAP", "BN237B-00-00-03", tag);
    }

    private static String removeDiacritics(String str) {
        if (str == null) return "";
        String nfd = Normalizer.normalize(str, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "").replace("đ", "d").replace("Đ", "D");
    }
}

