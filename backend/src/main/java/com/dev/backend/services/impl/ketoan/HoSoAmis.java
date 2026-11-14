package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.LoiTrangThaiException;
import com.dev.backend.i18n.ThongDiep;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.Normalizer;
import java.util.*;

/**
 * Hồ sơ AMIS Kế toán doanh nghiệp: dòng tiêu đề và tên cột (đúng nguyên văn) của từng tệp mẫu nhập khẩu, trích từ tệp
 * mẫu nâng cao tải từ chính phần mềm (ke-toan/amis-doanh-nghiep.json). Repo chỉ giữ tên cột, không giữ tệp của MISA.
 *
 * <p>Bộ dựng chứng từ gọi cột bằng tên gọn (bỏ "(*)", gộp khoảng trắng, không phân biệt hoa thường), vd. "Ngày hạch
 * toán" khớp "Ngày hạch toán (*)", "Đơn vị tính chính" khớp "Đơn vị tính \nchính". Gọi tên không có trong mẫu là lỗi lập
 * trình: ném ngay để test bắt được.</p>
 */
public final class HoSoAmis {

    public static final String KHO = "KHO";
    public static final String KHACH_HANG = "KHACH_HANG";
    public static final String NHA_CUNG_CAP = "NHA_CUNG_CAP";
    public static final String VAT_TU_HANG_HOA = "VAT_TU_HANG_HOA";
    public static final String TON_DAU_KY = "TON_DAU_KY";
    public static final String MUA_HANG = "MUA_HANG";
    public static final String CHUYEN_KHO = "CHUYEN_KHO";
    public static final String BAN_HANG = "BAN_HANG";
    /** Phiếu xuất kho (dùng loại "Xuất kho khác"). */
    public static final String XUAT_KHO = "XUAT_KHO";
    /** Phiếu nhập kho (dùng loại "Nhập kho khác"). */
    public static final String NHAP_KHO = "NHAP_KHO";
    /** Chứng từ hàng bán trả lại. */
    public static final String TRA_LAI = "TRA_LAI";

    private static final String TAI_NGUYEN = "/ke-toan/amis-doanh-nghiep.json";
    private static final Map<String, Mau> MAU = docTaiNguyen();

    private HoSoAmis() {
    }

    /** Một tệp mẫu: dongTieuDe, dongNhom tính từ 1 như trong Excel (dongNhom = 0: không có dòng nhóm). */
    public record Mau(String khoa, String tieuDe, String sheet, int dongTieuDe, int dongNhom,
                      Map<Integer, String> nhom, List<String> cot, Map<String, Integer> viTriTheoTenGon) {

        /** Vị trí cột (từ 0) theo tên gọn; tên không có trong mẫu thì ném lỗi. */
        public int viTri(String ten) {
            Integer v = viTriTheoTenGon.get(tenGon(ten));
            if (v == null) {
                throw new LoiThamSoException(ThongDiep.of("keToanDuLieuVao.mauKhongCoCot", khoa, ten));
            }
            return v;
        }

        public boolean coCot(String ten) {
            return viTriTheoTenGon.containsKey(tenGon(ten));
        }
    }

    public static Mau mau(String khoa) {
        Mau m = MAU.get(khoa);
        if (m == null) {
            throw new LoiThamSoException(ThongDiep.of("keToanDuLieuVao.khongCoMau", khoa));
        }
        return m;
    }

    public static Set<String> danhSachMau() {
        return MAU.keySet();
    }

    /** Bỏ "(*)", gộp mọi khoảng trắng (kể cả xuống dòng), chuẩn hóa Unicode NFC, chữ thường. */
    public static String tenGon(String ten) {
        String s = Normalizer.normalize(ten, Normalizer.Form.NFC).replace("(*)", " ");
        return s.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    private static Map<String, Mau> docTaiNguyen() {
        try (InputStream in = HoSoAmis.class.getResourceAsStream(TAI_NGUYEN)) {
            if (in == null) {
                throw new LoiTrangThaiException(ThongDiep.of("keToanDuLieuVao.thieuTaiNguyen", TAI_NGUYEN));
            }
            JsonNode goc = new ObjectMapper().readTree(in).path("mau");
            Map<String, Mau> kq = new LinkedHashMap<>();
            Iterator<Map.Entry<String, JsonNode>> it = goc.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                JsonNode n = e.getValue();
                List<String> cot = new ArrayList<>();
                Map<String, Integer> viTri = new HashMap<>();
                for (JsonNode c : n.path("cot")) {
                    String ten = c.asText();
                    String gon = tenGon(ten);
                    if (!gon.isEmpty()) {
                        viTri.putIfAbsent(gon, cot.size());
                    }
                    cot.add(ten);
                }
                Map<Integer, String> nhom = new TreeMap<>();
                n.path("nhom").fields().forEachRemaining(g -> nhom.put(Integer.parseInt(g.getKey()), g.getValue().asText()));
                kq.put(e.getKey(), new Mau(e.getKey(), n.path("tieuDe").asText(), n.path("sheet").asText(),
                        n.path("dongTieuDe").asInt(), n.path("dongNhom").asInt(), Collections.unmodifiableMap(nhom),
                        Collections.unmodifiableList(cot), Collections.unmodifiableMap(viTri)));
            }
            return Collections.unmodifiableMap(kq);
        } catch (IOException e) {
            throw new UncheckedIOException(ThongDiep.vi("keToanDuLieuVao.khongDocDuoc", TAI_NGUYEN), e);
        }
    }
}
