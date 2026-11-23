package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Nhật ký của biên bản trả hàng nhà cung cấp trong lich_su_thay_doi. Bảng biên bản chỉ có trạng thái hàng lỗi và phương
 * án (BA chốt không thêm cột), nên mọi chi tiết của từng việc nằm ở đây và được dựng lại khi đọc:
 * <ul>
 *   <li>lập / lập lại: cách xử lý hàng lỗi lúc lập, ai ký biên bản bên giao hàng (đại diện nhà cung cấp hoặc người
 *   của bên vận chuyển);</li>
 *   <li>người giao hàng đã ký biên bản giấy;</li>
 *   <li>gửi email biên bản, email nhắc hạn trả lời (ghi sau khi gửi được);</li>
 *   <li>cách bù và hàng lỗi nhà cung cấp chọn trên cổng, cách bù đổi do đóng đơn / quá hạn, số trừ tiền theo biến thể;</li>
 *   <li>trừ tiền áp vào đơn mua lúc nhập kho (nhà cung cấp chọn trừ tiền trước khi nhập kho);</li>
 *   <li>giao trả, tiêu hủy, hủy biên bản.</li>
 * </ul>
 * Ghi trong giao dịch của thao tác (cùng commit / rollback), trừ việc gửi email (luồng gửi thư, giao dịch riêng).
 */
@Service
@Slf4j
public class NhatKyTraHangNcc {

    /** Nguồn của một lần ghi cách bù / hàng lỗi. */
    public static final String NGUON_CONG_NCC = "CONG_NCC";
    /** Mua hàng đóng đơn nhận thiếu: hàng lỗi chưa bù chuyển sang trừ tiền. */
    public static final String NGUON_DONG_DON = "DONG_DON";
    /** Quá hạn trả lời: cách bù tự chuyển sang trừ tiền (bên mua từ chối nhận hàng lỗi). */
    public static final String NGUON_TU_DONG = "TU_DONG";
    /** Nhập kho không áp được trừ tiền nhà cung cấp đã chọn (vượt phần còn thiếu): quay về chờ chọn. */
    public static final String NGUON_NHAP_KHO = "NHAP_KHO";
    /** Biên bản lập trước khi có nhật ký. */
    public static final String NGUON_DU_LIEU_CU = "DU_LIEU_CU";

    /** Loại email biên bản đã gửi. */
    public static final String EMAIL_GUI = "GUI";
    public static final String EMAIL_CAP_NHAT = "CAP_NHAT";
    public static final String EMAIL_NHAC = "NHAC";

    /** Việc ký biên bản giấy của lần lập cuối ({@link NhatKy#kyBienBan()}). */
    public static final String KY_CHO = "CHO_KY";
    public static final String KY_DA_KY = "DA_KY";

    private static final String LOAI = ITable.bien_ban_tra_hang_ncc;
    private static final TypeReference<Map<String, Object>> KIEU_MAP = new TypeReference<>() {
    };

    private final NhatKyNghiepVu nhatKy;
    private final LichSuThayDoiRepository repository;
    private final ObjectMapper objectMapper;

    public NhatKyTraHangNcc(NhatKyNghiepVu nhatKy, LichSuThayDoiRepository repository, ObjectMapper objectMapper) {
        this.nhatKy = nhatKy;
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    // ─────────────────────────────────────────────────────────────
    // GHI
    // ─────────────────────────────────────────────────────────────

    /**
     * Lập (hoặc lập lại) biên bản: cách xử lý hàng lỗi và ai ký bên giao hàng ({@code nguoiKy}; trả ngay thì người ký
     * cũng là người nhận hàng lỗi). Biên bản chờ ghi đã ký; id dòng này là "phiên bản" nhà cung cấp trả lời theo
     * ({@link #idLapCuoi}).
     */
    public void ghiLap(BienBanTraHangNcc bb, String cachXuLy, NguoiKy nguoiKy, boolean lapLai) {
        Map<String, Object> moi = new LinkedHashMap<>();
        moi.put("cachXuLy", cachXuLy);
        moi.put("tongSoLuongLoi", bb.getTongSoLuongLoi());
        moi.put("lapLai", lapLai);
        moi.put("benKy", nguoiKy.ben());
        if (nguoiKy.hoTen() != null) moi.put("nguoiNhan", nguoiKy.hoTen());
        if (nguoiKy.bienSoXe() != null) moi.put("bienSoXe", nguoiKy.bienSoXe());
        if (nguoiKy.donViVanChuyen() != null) moi.put("donViVanChuyen", nguoiKy.donViVanChuyen());
        nhatKy.ghi(dong(bb, IHanhDong.lap_bien_ban_tra_hang).moi(moi).ghiChu(bb.getGhiChu()));
    }

    /** Kho ghi người giao hàng đã ký biên bản giấy của lần lập cuối. */
    public void ghiKy(BienBanTraHangNcc bb) {
        nhatKy.ghi(dong(bb, IHanhDong.ky_bien_ban_tra_hang));
    }

    /** Id dòng nhật ký của lần lập cuối, hoặc null (biên bản lập trước khi có nhật ký). */
    @Transactional(readOnly = true)
    public Integer idLapCuoi(Integer bienBanId) {
        return repository.findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        LOAI, bienBanId, List.of(IHanhDong.lap_bien_ban_tra_hang))
                .map(LichSuThayDoi::getId).orElse(null);
    }

    /**
     * Một lần ghi cách bù và / hoặc hàng lỗi. Nhà cung cấp trả lời trên cổng thì ghi nguồn nhà cung cấp (không có người
     * đăng nhập); quá hạn thì nguồn hệ thống.
     */
    public void ghiTraLoi(BienBanTraHangNcc bb, TraLoi t) {
        Map<String, Object> moi = new LinkedHashMap<>();
        moi.put("phuongAn", t.phuongAn());
        moi.put("phuongAnCu", t.phuongAnCu());
        if (t.hangLoi() != null) moi.put("hangLoi", t.hangLoi());
        moi.put("nguon", t.nguon());
        if (t.nguoiXacNhan() != null) moi.put("nguoiXacNhan", t.nguoiXacNhan());
        moi.put("truTheoBienThe", t.truTheoBienThe() == null ? Map.of() : t.truTheoBienThe());
        moi.put("tienTru", t.tienTru() == null ? BigDecimal.ZERO : t.tienTru());
        NhatKyNghiepVu.Dong d = dong(bb, IHanhDong.chot_tra_hang_ncc).moi(moi).ghiChu(t.ghiChu());
        if (NGUON_CONG_NCC.equals(t.nguon())) d.nguon(INguonNhatKy.nha_cung_cap);
        else if (NGUON_TU_DONG.equals(t.nguon())) d.nguon(INguonNhatKy.he_thong);
        nhatKy.ghi(d);
    }

    /** Trừ tiền nhà cung cấp đã chọn trước khi nhập kho, áp vào đơn mua lúc nhập kho. */
    public void ghiTruTien(BienBanTraHangNcc bb, Map<Integer, Integer> truTheoBienThe, BigDecimal tienTru) {
        Map<String, Object> moi = new LinkedHashMap<>();
        moi.put("truTheoBienThe", truTheoBienThe);
        moi.put("tienTru", tienTru);
        nhatKy.ghi(dong(bb, IHanhDong.tru_tien_tra_hang_ncc).moi(moi));
    }

    public void ghiGiaoTra(BienBanTraHangNcc bb, String cachGiao, String nguoiNhan, String maVanDon, Instant thoiDiem, String ghiChu) {
        Map<String, Object> moi = new LinkedHashMap<>();
        moi.put("cachGiao", cachGiao);
        moi.put("nguoiNhan", nguoiNhan);
        if (maVanDon != null) moi.put("maVanDon", maVanDon);
        moi.put("thoiDiem", thoiDiem.toString());
        nhatKy.ghi(dong(bb, IHanhDong.giao_tra_hang_loi).moi(moi).ghiChu(ghiChu));
    }

    /** Tiêu hủy theo đồng ý của nhà cung cấp trên cổng ({@code nguoiDongY}: người xác nhận bên nhà cung cấp). */
    public void ghiTieuHuy(BienBanTraHangNcc bb, String nguoiDongY, Instant thoiDiem, String ghiChu) {
        Map<String, Object> moi = new LinkedHashMap<>();
        if (nguoiDongY != null) moi.put("nguoiDongY", nguoiDongY);
        moi.put("thoiDiem", thoiDiem.toString());
        nhatKy.ghi(dong(bb, IHanhDong.tieu_huy_hang_loi).moi(moi).ghiChu(ghiChu));
    }

    public void ghiHuy(BienBanTraHangNcc bb, String lyDo) {
        nhatKy.ghi(dong(bb, IHanhDong.huy_bien_ban_tra_hang).ghiChu(lyDo));
    }

    /**
     * Đã gửi được email biên bản (gọi từ luồng gửi thư sau commit: giao dịch riêng, không có người đăng nhập).
     * {@code loai}: GUI | CAP_NHAT | NHAC.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ghiDaGuiEmail(Integer bienBanId, String maBienBan, Integer khoId, String loai, String email) {
        nhatKy.ghi(NhatKyNghiepVu.dong(LOAI, bienBanId, IHanhDong.gui_email_bien_ban_tra_hang)
                .ma(maBienBan).kho(khoId)
                .moi(Map.of("loai", loai, "email", email))
                .nguon(INguonNhatKy.he_thong));
    }

    private static NhatKyNghiepVu.Dong dong(BienBanTraHangNcc bb, String hanhDong) {
        Integer khoId = bb.getPhieuNhapKho() == null || bb.getPhieuNhapKho().getKho() == null ? null
                : bb.getPhieuNhapKho().getKho().getId();
        return NhatKyNghiepVu.dong(LOAI, bb.getId(), hanhDong).ma(bb.getMaBienBan()).kho(khoId);
    }

    // ─────────────────────────────────────────────────────────────
    // ĐỌC
    // ─────────────────────────────────────────────────────────────

    /** Nhật ký của nhiều biên bản (một truy vấn). Biên bản chưa có dòng nào: {@link NhatKy#TRONG}. */
    @Transactional(readOnly = true)
    public Map<Integer, NhatKy> doc(Collection<Integer> bienBanIds) {
        Map<Integer, List<LichSuThayDoi>> theoBienBan = new HashMap<>();
        if (!bienBanIds.isEmpty()) {
            for (LichSuThayDoi d : repository.findByLoaiThamChieuAndIdThamChieuInOrderByIdAsc(LOAI, bienBanIds)) {
                theoBienBan.computeIfAbsent(d.getIdThamChieu(), k -> new ArrayList<>()).add(d);
            }
        }
        Map<Integer, NhatKy> kq = new HashMap<>();
        for (Integer id : bienBanIds) kq.put(id, dung(theoBienBan.getOrDefault(id, List.of())));
        return kq;
    }

    @Transactional(readOnly = true)
    public NhatKy doc(Integer bienBanId) {
        return doc(List.of(bienBanId)).get(bienBanId);
    }

    /**
     * Dựng nhật ký từ các dòng cũ trước. Trả lời, email, trừ tiền chỉ tính từ lần lập cuối (lập lại trước nhập kho là
     * biên bản mới với nhà cung cấp); giao trả / tiêu hủy lấy lần cuối.
     */
    private NhatKy dung(List<LichSuThayDoi> dong) {
        Lap lap = null;
        Ky ky = null;
        TraLoi cachBu = null;
        TraLoi hangLoi = null;
        GiaoTra giaoTra = null;
        Instant emailDau = null;
        Instant emailCuoi = null;
        boolean daNhac = false;
        boolean daTungGuiEmail = false;
        Map<Integer, Integer> tru = new LinkedHashMap<>();
        BigDecimal tienTru = BigDecimal.ZERO;
        for (LichSuThayDoi d : dong) {
            Map<String, Object> m = map(d.getGiaTriMoi());
            String nguoi = d.getNguoiThucHien() == null ? null : d.getNguoiThucHien().getHoTen();
            switch (d.getHanhDong()) {
                case IHanhDong.lap_bien_ban_tra_hang -> {
                    lap = new Lap(chuoi(m, "cachXuLy"), new NguoiKy(chuoi(m, "benKy"), chuoi(m, "nguoiNhan"),
                            chuoi(m, "bienSoXe"), chuoi(m, "donViVanChuyen")), d.getNgayThucHien(), nguoi);
                    ky = null;
                    cachBu = null;
                    hangLoi = null;
                    emailDau = null;
                    emailCuoi = null;
                    daNhac = false;
                    tru = new LinkedHashMap<>();
                    tienTru = BigDecimal.ZERO;
                }
                case IHanhDong.ky_bien_ban_tra_hang -> ky = new Ky(d.getNgayThucHien(), nguoi);
                case IHanhDong.chot_tra_hang_ncc -> {
                    TraLoi t = new TraLoi(chuoi(m, "phuongAn"), chuoi(m, "phuongAnCu"), chuoi(m, "hangLoi"),
                            chuoi(m, "nguon"), chuoi(m, "nguoiXacNhan"), null, null, d.getGhiChu(), d.getNgayThucHien(), nguoi);
                    if (!Objects.equals(t.phuongAn(), t.phuongAnCu())) cachBu = t;
                    if (t.hangLoi() != null) hangLoi = t;
                    congTru(tru, m.get("truTheoBienThe"));
                    tienTru = tienTru.add(so(m.get("tienTru")));
                }
                case IHanhDong.tru_tien_tra_hang_ncc -> {
                    congTru(tru, m.get("truTheoBienThe"));
                    tienTru = tienTru.add(so(m.get("tienTru")));
                }
                case IHanhDong.gui_email_bien_ban_tra_hang -> {
                    String loai = chuoi(m, "loai");
                    if (EMAIL_GUI.equals(loai) || EMAIL_CAP_NHAT.equals(loai)) {
                        if (emailDau == null) emailDau = d.getNgayThucHien();
                        emailCuoi = d.getNgayThucHien();
                        daTungGuiEmail = true;
                    } else if (EMAIL_NHAC.equals(loai)) {
                        daNhac = true;
                    }
                }
                case IHanhDong.giao_tra_hang_loi -> giaoTra = new GiaoTra(false, chuoi(m, "cachGiao"), chuoi(m, "nguoiNhan"),
                        chuoi(m, "maVanDon"), thoiDiem(m, d), d.getGhiChu(), nguoi);
                case IHanhDong.tieu_huy_hang_loi -> giaoTra = new GiaoTra(true, null, chuoi(m, "nguoiDongY"), null,
                        thoiDiem(m, d), d.getGhiChu(), nguoi);
                default -> {
                    // hủy biên bản: trạng thái đã ở bảng biên bản
                }
            }
        }
        int soTru = tru.values().stream().mapToInt(Integer::intValue).sum();
        return new NhatKy(lap, ky, cachBu, hangLoi, giaoTra, emailDau, emailCuoi, daNhac, daTungGuiEmail,
                Collections.unmodifiableMap(tru), soTru, tienTru);
    }

    private Map<String, Object> map(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            Map<String, Object> m = objectMapper.readValue(json, KIEU_MAP);
            return m == null ? Map.of() : m;
        } catch (Exception e) {
            log.warn("[RTV-NHAT-KY] Không đọc được dòng nhật ký: {}", e.getMessage());
            return Map.of();
        }
    }

    private static String chuoi(Map<String, Object> m, String khoa) {
        Object v = m.get(khoa);
        return v == null ? null : v.toString();
    }

    private static BigDecimal so(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(v.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static Instant thoiDiem(Map<String, Object> m, LichSuThayDoi d) {
        String s = chuoi(m, "thoiDiem");
        try {
            return s == null ? d.getNgayThucHien() : Instant.parse(s);
        } catch (Exception e) {
            return d.getNgayThucHien();
        }
    }

    private static void congTru(Map<Integer, Integer> tong, Object truTheoBienThe) {
        if (!(truTheoBienThe instanceof Map<?, ?> m)) return;
        for (Map.Entry<?, ?> e : m.entrySet()) {
            try {
                tong.merge(Integer.valueOf(e.getKey().toString()), so(e.getValue()).intValue(), Integer::sum);
            } catch (NumberFormatException ignored) {
                // khóa không phải id biến thể: bỏ qua
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // KIỂU DỮ LIỆU
    // ─────────────────────────────────────────────────────────────

    /**
     * Ai ký biên bản bên giao hàng: {@code ben} DAI_DIEN_NCC | VAN_CHUYEN (null: biên bản lập trước khi có bước ký), họ
     * tên, biển số xe, đơn vị vận chuyển (khi VAN_CHUYEN).
     */
    public record NguoiKy(String ben, String hoTen, String bienSoXe, String donViVanChuyen) {
        /** Có người ký biên bản giấy: biên bản chờ kho ghi đã ký rồi mới gửi nhà cung cấp. */
        public boolean canKy() {
            return BienBanTraHangNcc.BEN_KY_NCC.equals(ben) || BienBanTraHangNcc.BEN_KY_VAN_CHUYEN.equals(ben);
        }
    }

    /** Lần lập cuối: cách xử lý hàng lỗi, ai ký bên giao hàng, lúc và người lập. */
    public record Lap(String cachXuLy, NguoiKy nguoiKy, Instant luc, String nguoi) {
    }

    /** Người giao hàng đã ký biên bản giấy của lần lập cuối: lúc kho ghi, người ghi. */
    public record Ky(Instant luc, String nguoi) {
    }

    /**
     * Một lần ghi cách bù / hàng lỗi. {@code phuongAn} = {@code phuongAnCu} khi lần này chỉ đổi hàng lỗi; {@code hangLoi}
     * null khi không đổi hàng lỗi. Khi ghi: {@code truTheoBienThe}, {@code tienTru} là số áp vào đơn mua lần này. Khi đọc:
     * hai trường này null (số cộng dồn ở {@link NhatKy}), {@code luc} / {@code nguoi} lấy từ dòng nhật ký.
     */
    public record TraLoi(String phuongAn, String phuongAnCu, String hangLoi, String nguon, String nguoiXacNhan,
                         Map<Integer, Integer> truTheoBienThe, BigDecimal tienTru, String ghiChu, Instant luc,
                         String nguoi) {

        public static TraLoi ghi(String phuongAn, String phuongAnCu, String hangLoi, String nguon, String nguoiXacNhan,
                                 Map<Integer, Integer> truTheoBienThe, BigDecimal tienTru, String ghiChu) {
            return new TraLoi(phuongAn, phuongAnCu, hangLoi, nguon, nguoiXacNhan, truTheoBienThe, tienTru, ghiChu, null, null);
        }
    }

    /** Hàng lỗi rời kho: giao trả ({@code tieuHuy} false: cách giao, người nhận, mã vận đơn) hoặc tiêu hủy (người đồng ý). */
    public record GiaoTra(boolean tieuHuy, String cachGiao, String nguoiNhan, String maVanDon, Instant thoiDiem,
                          String ghiChu, String nguoiGhi) {
    }

    /**
     * Nhật ký dựng lại của một biên bản, tính từ lần lập cuối.
     * <ul>
     *   <li>{@code cachBu}: lần đổi cách bù gần nhất; {@code hangLoi}: lần nhà cung cấp chọn nhận lại / tiêu hủy gần nhất.</li>
     *   <li>{@code emailDauLuc}: email biên bản đầu tiên gửi được (mốc tính hạn trả lời); {@code emailGuiLuc}: lần gần
     *   nhất; {@code daNhac}: đã gửi email nhắc hạn; {@code daTungGuiEmail}: kể cả các lần lập trước.</li>
     *   <li>{@code truTheoBienThe} / {@code soTru} / {@code tienTru}: tổng số lỗi đã trừ tiền (đã cộng vào "đã nhận").</li>
     * </ul>
     */
    public record NhatKy(Lap lap, Ky ky, TraLoi cachBu, TraLoi hangLoi, GiaoTra giaoTra, Instant emailDauLuc,
                         Instant emailGuiLuc, boolean daNhac, boolean daTungGuiEmail,
                         Map<Integer, Integer> truTheoBienThe, int soTru, BigDecimal tienTru) {
        public static final NhatKy TRONG = new NhatKy(null, null, null, null, null, null, null, false, false, Map.of(), 0,
                BigDecimal.ZERO);

        /** Biên bản đã lập, có người ký mà kho chưa ghi đã ký: chưa gửi nhà cung cấp. */
        public boolean choKy() {
            return lap != null && lap.nguoiKy().canKy() && ky == null;
        }

        /** CHO_KY | DA_KY; null với biên bản lập trước khi có bước ký. */
        public String kyBienBan() {
            if (lap == null || !lap.nguoiKy().canKy()) return null;
            if (ky == null) return KY_CHO;
            return KY_DA_KY;
        }

        /** Nhà cung cấp đã chọn gì cho hàng lỗi còn ở kho: NHAN_LAI | TIEU_HUY | null (chưa chọn). */
        public String luaChonHangLoi() {
            return hangLoi == null ? null : hangLoi.hangLoi();
        }
    }
}
