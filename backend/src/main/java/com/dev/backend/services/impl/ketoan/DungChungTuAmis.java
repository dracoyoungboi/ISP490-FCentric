package com.dev.backend.services.impl.ketoan;

import com.dev.backend.entities.CauHinhKeToan;
import com.dev.backend.entities.ChungTuXuatKeToan;
import com.dev.backend.entities.KhachHang;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Dựng chứng từ theo mẫu AMIS Kế toán doanh nghiệp từ dữ liệu nguồn (không đọc CSDL). Mỗi dòng Excel là một dòng hàng;
 * các cột chung của chứng từ lặp lại trên mọi dòng cùng số chứng từ (luật của hộp nhập AMIS).
 *
 * <p>Giá trị chữ ("Có", "Chưa thu tiền"...) chép đúng danh sách thả xuống trong tệp mẫu thật. Chứng từ có lỗi chặn bị
 * bỏ khỏi lô (để lại lô sau, sửa rồi xuất); cảnh báo vẫn xuất. Mọi quy tắc tài khoản, cách lấy đơn giá ở đây đã nhập thử
 * vào AMIS doanh nghiệp (TT 99/2025) ngày 14/11/2026.</p>
 *
 * <p>Khách hàng: đơn sàn (Lazada, Shopee, TikTok Shop, Shopify) gom về một mã khách cho mỗi sàn, đơn tại quầy về khách lẻ
 * KHLE; chỉ khách có mã số thuế giữ mã riêng. Doanh nghiệp bán lẻ theo dõi công nợ theo sàn, không theo từng người mua bị
 * che thông tin; mỗi người mua một mã làm danh mục khách hàng trên AMIS phình hàng nghìn dòng.</p>
 */
public final class DungChungTuAmis {

    public static final ZoneId MUI_GIO = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Kho ảo giữ hàng đang trên đường chuyển kho (KhoService.laKhoAo); sang AMIS là kho "Hàng đang chuyển". */
    public static final String MA_KHO_DANG_CHUYEN = "KHO_TRANSIT";
    /** Hộp nhập AMIS: mỗi chứng từ tối đa 500 dòng chi tiết. */
    static final int SO_DONG_TOI_DA = 500;
    /** Mã kho trên AMIS tối đa 20 ký tự. */
    static final int DO_DAI_MA_KHO = 20;
    /**
     * Số dòng tối đa của một tệp Excel. Hộp nhập AMIS nhận tệp tối đa 20MB và không giới hạn số chứng từ; 30.000 dòng bán
     * hàng ghi ra khoảng 3MB nên còn dư nhiều. Quá số dòng thì chia phần, không bao giờ cắt một chứng từ ra hai tệp.
     */
    static final int SO_DONG_MOI_TEP = 30_000;

    // Danh sách thả xuống trong tệp mẫu AMIS doanh nghiệp (đọc 25/10/2026 và 14/11/2026)
    static final String CO = "Có";
    static final String KHONG = "Không";
    static final String BAN_HANG_TRONG_NUOC = "Bán hàng hóa trong nước";
    static final String CHUA_THU_TIEN = "Chưa thu tiền";
    /** phuongThucPos của đơn trả tiền mặt + QR payOS. */
    static final String KET_HOP = "KET_HOP";
    static final String THU_TIEN_MAT = "Thu tiền ngay - Tiền mặt";
    static final String THU_CHUYEN_KHOAN = "Thu tiền ngay - Chuyển khoản";
    static final String MUA_TRONG_NUOC_NHAP_KHO = "Mua hàng trong nước nhập kho";
    static final String CHUA_THANH_TOAN = "Chưa thanh toán";
    static final String NHAN_KEM_HOA_DON = "Nhận kèm hóa đơn";
    static final String KHONG_KEM_HOA_DON = "Không kèm hóa đơn";
    static final String KHONG_CO_HOA_DON = "Không có hóa đơn";
    static final String CHUYEN_KHO_NOI_BO = "Xuất chuyển kho nội bộ";
    static final String HANG_HOA = "Hàng hóa";
    static final String DICH_VU = "Dịch vụ";
    static final String TO_CHUC = "Tổ chức";
    static final String CA_NHAN = "Cá nhân";
    /** Nhóm 1: hàng hóa, dịch vụ dùng riêng cho SXKD chịu thuế GTGT, đủ điều kiện khấu trừ (mặc định của AMIS). */
    static final String NHOM_HHDV_MUA_VAO = "1";
    // Mẫu Xuất kho / Nhập kho / Hàng bán trả lại (14/11/2026)
    static final String XUAT_KHO_KHAC = "Xuất kho khác";
    static final String NHAP_KHO_KHAC = "Nhập kho khác";
    /**
     * Phiếu nhập kho khác phải ghi đơn giá: "Lấy từ đơn giá BQCK" bị AMIS từ chối với loại Nhập kho khác, "Lấy từ giá xuất
     * kho" qua được nhưng ra 0 đồng và kéo sai giá bình quân của kho (nhập thử 14/11/2026).
     */
    static final String NHAP_DON_GIA_BANG_TAY = "Nhập đơn giá bằng tay";
    static final String BAN_HANG_DV_TRONG_NUOC = "Bán hàng hóa dịch vụ trong nước";
    /**
     * Hàng bán trả lại chỉ có hai phương thức: "Trả lại tiền mặt" (TK tiền mặt) / "Giảm trừ công nợ" (TK phải thu). Hoàn
     * tiền chuyển khoản dùng giảm trừ công nợ: cột "Số TK ngân hàng" của mẫu không tự ghép được ở bước Ghép dữ liệu
     * (thử 14/11/2026), thiếu số tài khoản thì chứng từ TK 112 không ghi sổ được; kế toán lập chứng từ chi tiền gửi riêng.
     */
    static final String TRA_LAI_TIEN_MAT = "Trả lại tiền mặt";
    static final String GIAM_TRU_CONG_NO = "Giảm trừ công nợ";
    static final String DON_GIA_BINH_QUAN_CUOI_KY = "Lấy đơn giá bình quân cuối kỳ";

    /** Mã khách gom theo kênh bán: một mã cho mỗi sàn (công nợ theo dõi theo sàn). */
    static final Map<String, String> TEN_KHACH_NHOM = Map.of(
            "SAN_LAZADA", "Sàn TMĐT Lazada",
            "SAN_SHOPEE", "Sàn TMĐT Shopee",
            "SAN_TIKTOK", "Sàn TMĐT TikTok Shop",
            "SAN_SHOPIFY", "Kênh bán Shopify (website)");
    static final String MA_KHACH_LE = KhachHang.MA_KHACH_LE;
    static final String TEN_KHACH_LE = "Khách lẻ";

    /**
     * Số điện thoại / email giả do đồng bộ sàn (bản cũ) tạo cho khách thiếu thông tin: không gửi sang kế toán.
     * Backend mới không ghi các giá trị này nữa; migration-2026-11-06-bo-lien-he-gia-khach-san.sql dọn dữ liệu cũ.
     */
    static final Set<String> GIA_TRI_GIA = Set.of("0900000000", "shopify@customer.com", "lazada@customer.com");

    private static final DateTimeFormatter NGAY_TEN_TEP = DateTimeFormatter.BASIC_ISO_DATE;

    private final CauHinhKeToan cauHinh;
    private final TraThueSuat thueSuat;
    private final KetQua kq = new KetQua();

    public DungChungTuAmis(CauHinhKeToan cauHinh, TraThueSuat thueSuat) {
        this.cauHinh = cauHinh;
        this.thueSuat = thueSuat;
    }

    // ── Kết quả ────────────────────────────────────────────────────────────

    /**
     * Một chứng từ đưa vào lô (để ghi chung_tu_xuat_ke_toan và cộng tổng). maKhach: mã khách trên chứng từ (null nếu không
     * có). thueChoHoaDon: phiếu mua chưa có hóa đơn ("Không kèm hóa đơn"), phần thuế ước theo mức chung chưa ghi — kế toán
     * ghi khi Nhận hóa đơn trên AMIS; truocThue + thue + thueChoHoaDon = tongTien.
     */
    public record ChungTu(String loai, int idNguon, String soChungTu, LocalDate ngayHachToan, BigDecimal tongTien,
                          BigDecimal truocThue, BigDecimal thue, int soDong, String maKhach, BigDecimal thueChoHoaDon) {
        public ChungTu(String loai, int idNguon, String soChungTu, LocalDate ngayHachToan, BigDecimal tongTien,
                       BigDecimal truocThue, BigDecimal thue, int soDong) {
            this(loai, idNguon, soChungTu, ngayHachToan, tongTien, truocThue, thue, soDong, null, BigDecimal.ZERO);
        }

        public ChungTu(String loai, int idNguon, String soChungTu, LocalDate ngayHachToan, BigDecimal tongTien,
                       BigDecimal truocThue, BigDecimal thue, int soDong, String maKhach) {
            this(loai, idNguon, soChungTu, ngayHachToan, tongTien, truocThue, thue, soDong, maKhach, BigDecimal.ZERO);
        }
    }

    public record VanDe(String loai, Integer idNguon, String soChungTu, String noiDung) {
    }

    /** Một tệp Excel trong tệp nén: tên (không đuôi), mẫu, các dòng. */
    public record Tep(String ten, String mau, List<Map<String, Object>> dong) {
    }

    /** Các dòng của một chứng từ trong một nhóm tệp; ngay null với danh mục (không chia phần, không ghi ngày vào tên). */
    private record Khoi(List<Map<String, Object>> dong, LocalDate ngay) {
    }

    private record NhomTep(String ten, String mau, List<Khoi> khoi) {
    }

    /** Khách ghi trên chứng từ (sau khi gom theo kênh). */
    record KhachCt(String ma, String ten, String diaChi, String maSoThue) {
    }

    public static final class KetQua {
        private final Map<String, NhomTep> nhom = new TreeMap<>();
        private final List<ChungTu> chungTu = new ArrayList<>();
        private final List<VanDe> chan = new ArrayList<>();
        private final List<VanDe> canhBao = new ArrayList<>();
        /** Mã khách giữ mã riêng (đọc thông tin từ danh mục khách hàng). */
        private final Set<String> maKhachRieng = new LinkedHashSet<>();
        /** Mã khách gom (SAN_…, KHLE): dòng danh mục dựng sẵn nếu CSDL không có. */
        private final Set<String> maKhachNhom = new LinkedHashSet<>();
        private List<Tep> tepDaChia;

        /**
         * Các tệp theo tên (thứ tự nhập vào AMIS). Mỗi loại chứng từ một tệp cho cả lô, tên kèm khoảng ngày hạch toán;
         * quá {@link #SO_DONG_MOI_TEP} dòng thì chia phần theo ngày, không cắt chứng từ.
         */
        public List<Tep> tep() {
            if (tepDaChia == null) {
                tepDaChia = chiaTep(nhom.values(), SO_DONG_MOI_TEP);
            }
            return tepDaChia;
        }

        public List<ChungTu> chungTu() {
            return chungTu;
        }

        public List<VanDe> chan() {
            return chan;
        }

        public List<VanDe> canhBao() {
            return canhBao;
        }

        public Set<String> maKhachRieng() {
            return maKhachRieng;
        }

        public Set<String> maKhachNhom() {
            return maKhachNhom;
        }

        void them(String tenTep, String mau, List<Map<String, Object>> dong, LocalDate ngay) {
            tepDaChia = null;
            nhom.computeIfAbsent(tenTep, k -> new NhomTep(k, mau, new ArrayList<>())).khoi().add(new Khoi(dong, ngay));
        }
    }

    static List<Tep> chiaTep(Collection<NhomTep> dsNhom, int soDongMoiTep) {
        List<Tep> ds = new ArrayList<>();
        for (NhomTep n : dsNhom) {
            List<Khoi> khoi = new ArrayList<>(n.khoi());
            boolean coNgay = khoi.stream().anyMatch(k -> k.ngay() != null);
            if (!coNgay) {
                List<Map<String, Object>> dong = new ArrayList<>();
                khoi.forEach(k -> dong.addAll(k.dong()));
                ds.add(new Tep(n.ten(), n.mau(), dong));
                continue;
            }
            // Sắp theo ngày (giữ thứ tự gốc trong cùng ngày) để mỗi phần là một khoảng ngày liền nhau
            khoi.sort(Comparator.comparing(Khoi::ngay, Comparator.nullsFirst(Comparator.naturalOrder())));
            List<List<Khoi>> phan = new ArrayList<>();
            List<Khoi> dangGom = new ArrayList<>();
            int soDong = 0;
            for (Khoi k : khoi) {
                if (!dangGom.isEmpty() && soDong + k.dong().size() > soDongMoiTep) {
                    phan.add(dangGom);
                    dangGom = new ArrayList<>();
                    soDong = 0;
                }
                dangGom.add(k);
                soDong += k.dong().size();
            }
            if (!dangGom.isEmpty()) {
                phan.add(dangGom);
            }
            for (int i = 0; i < phan.size(); i++) {
                List<Khoi> p = phan.get(i);
                LocalDate tu = p.stream().map(Khoi::ngay).filter(Objects::nonNull).min(Comparator.naturalOrder()).orElseThrow();
                LocalDate den = p.stream().map(Khoi::ngay).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElseThrow();
                String ten = n.ten() + "_" + tu.format(NGAY_TEN_TEP) + "_" + den.format(NGAY_TEN_TEP)
                        + (phan.size() > 1 ? String.format("_phan%02d", i + 1) : "");
                List<Map<String, Object>> dong = new ArrayList<>();
                p.forEach(k -> dong.addAll(k.dong()));
                ds.add(new Tep(ten, n.mau(), dong));
            }
        }
        return ds;
    }

    public KetQua ketQua() {
        return kq;
    }

    // ── Khách hàng ─────────────────────────────────────────────────────────

    /** Mã khách gom của kênh bán (null = không gom theo kênh). Mã kênh sandbox / official cùng sàn gom chung. */
    static String maNhomKenh(String maKenh) {
        if (maKenh == null) {
            return null;
        }
        String m = maKenh.trim().toUpperCase(Locale.ROOT);
        if (m.startsWith("LAZADA")) return "SAN_LAZADA";
        if (m.startsWith("SHOPEE")) return "SAN_SHOPEE";
        if (m.startsWith("TIKTOK")) return "SAN_TIKTOK";
        if (m.startsWith("SHOPIFY")) return "SAN_SHOPIFY";
        return null;
    }

    /**
     * Khách ghi trên chứng từ: có mã số thuế (khách lấy hóa đơn công ty) giữ mã riêng; đơn sàn về mã của sàn; đơn tại quầy
     * về khách lẻ; còn lại (đơn bán thường, có thể có công nợ) giữ mã riêng.
     */
    KhachCt khach(String ma, String ten, String diaChi, String maSoThue, String maKenh, boolean laPos) {
        if (maSoThue != null && !maSoThue.isBlank()) {
            kq.maKhachRieng.add(ma);
            return new KhachCt(ma, ten, diaChi, maSoThue.trim());
        }
        String nhom = maNhomKenh(maKenh);
        if (nhom != null) {
            kq.maKhachNhom.add(nhom);
            return new KhachCt(nhom, TEN_KHACH_NHOM.get(nhom), null, null);
        }
        if (laPos) {
            kq.maKhachNhom.add(MA_KHACH_LE);
            return new KhachCt(MA_KHACH_LE, TEN_KHACH_LE, null, null);
        }
        kq.maKhachRieng.add(ma);
        return new KhachCt(ma, ten, diaChi, null);
    }

    /**
     * Khách của chứng từ trả lại khi chứng từ bán của đơn gốc đã giao kế toán: ghi đúng mã khách chứng từ bán đã ghi để
     * công nợ 131 của khách đó được giảm. maKhachBan null = chứng từ bán của bản trước 14/11/2026, khi mọi khách đều ghi
     * mã riêng (chưa gom khách sàn / khách lẻ).
     */
    KhachCt khachNhuChungTuBan(String maKhachBan, String ma, String ten, String diaChi, String maSoThue) {
        String maBan = maKhachBan == null || maKhachBan.isBlank() ? ma : maKhachBan.trim();
        if (TEN_KHACH_NHOM.containsKey(maBan)) {
            kq.maKhachNhom.add(maBan);
            return new KhachCt(maBan, TEN_KHACH_NHOM.get(maBan), null, null);
        }
        if (MA_KHACH_LE.equals(maBan) && !MA_KHACH_LE.equals(ma)) {
            kq.maKhachNhom.add(MA_KHACH_LE);
            return new KhachCt(MA_KHACH_LE, TEN_KHACH_LE, null, null);
        }
        kq.maKhachRieng.add(maBan);
        return new KhachCt(maBan, ten, diaChi, maSoThue == null || maSoThue.isBlank() ? null : maSoThue.trim());
    }

    private KhachCt khachCuaDon(NguonKeToan.DonBan don) {
        boolean laPos = don.phuongThucPos() != null || "POS".equalsIgnoreCase(don.maKenh());
        return khach(don.maKhachHang(), don.tenKhachHang(), don.diaChiKhachHang(), don.maSoThueKhachHang(), don.maKenh(), laPos);
    }

    // ── Bán hàng ───────────────────────────────────────────────────────────

    /** Một dòng tiền của chứng từ bán / trả lại (đã tách thuế). dichVu: dòng phí vận chuyển (không có kho). */
    record DongTien(String maHang, String tenHang, String donViTinh, BigDecimal soLuong, TachThue.Dong tien,
                    BigDecimal thueSuat, boolean dichVu) {
    }

    /** Kết quả tách thuế cả đơn: loi != null thì không dựng được; canhBaoGiamGia: đơn Shopify cũ phải suy giảm giá. */
    record TinhDon(List<DongTien> dong, BigDecimal truocThue, BigDecimal thue, Set<BigDecimal> thueSuatDung, String loi,
                   String canhBaoGiamGia) {
    }

    /** Tách thuế từng dòng của đơn theo thuế suất tại ngày (ngày giao hàng của đơn). */
    TinhDon tinhDon(NguonKeToan.DonBan don, List<NguonKeToan.DongBan> dong, LocalDate ngay) {
        // Giảm giá từng dòng (gồm thuế): đơn Shopify mới có sẵn; đơn Shopify cũ suy ra từ tổng dòng − tiền hàng
        List<BigDecimal> giamGia = new ArrayList<>();
        BigDecimal tongDong = BigDecimal.ZERO;
        BigDecimal tongGiamLuu = BigDecimal.ZERO;
        for (NguonKeToan.DongBan d : dong) {
            tongDong = tongDong.add(TachThue.dong(d.thanhTien()));
            tongGiamLuu = tongGiamLuu.add(TachThue.dong(d.tienGiamGia()));
            giamGia.add(TachThue.dong(d.tienGiamGia()));
        }
        BigDecimal tienHang = TachThue.dong(don.tienHang());
        String canhBaoGiam = null;
        if (tongGiamLuu.signum() == 0 && tongDong.compareTo(tienHang) > 0) {
            // Chỉ đơn Shopify đi tới đây (kiemTraDonBan chặn đơn khác lệch tổng)
            giamGia = TachThue.chiaTheoTyLe(tongDong.subtract(tienHang),
                    dong.stream().map(NguonKeToan.DongBan::thanhTien).toList());
            canhBaoGiam = "Đơn Shopify không có giảm giá từng dòng (kéo về trước khi lưu, hoặc đơn bị sửa / hoàn tiền trên"
                    + " Shopify): " + tien(tongDong.subtract(tienHang)) + " đ chênh giữa tổng dòng và tiền hàng ghi"
                    + " thành chiết khấu, chia theo tỷ lệ tiền dòng. Đơn có hoàn tiền thì kiểm lại trên Shopify.";
        }

        List<DongTien> kqDong = new ArrayList<>();
        BigDecimal truocThue = BigDecimal.ZERO;
        BigDecimal thue = BigDecimal.ZERO;
        Set<BigDecimal> thueSuatDung = new TreeSet<>();
        for (int i = 0; i < dong.size(); i++) {
            NguonKeToan.DongBan d = dong.get(i);
            BigDecimal ts = thueSuat.tra(d.danhMucId(), ngay);
            if (ts == null) {
                return new TinhDon(List.of(), BigDecimal.ZERO, BigDecimal.ZERO, thueSuatDung, "Chưa có thuế suất áp dụng ngày "
                        + ngay.format(GhiTepAmis.NGAY) + " cho mã " + d.maSku()
                        + ". Thêm mức chung hoặc mức cho danh mục ở Cấu hình › Thuế GTGT.", null);
            }
            thueSuatDung.add(ts.stripTrailingZeros());
            TachThue.Dong t = TachThue.tach(d.soLuong(), d.thanhTien(), giamGia.get(i), ts);
            kqDong.add(new DongTien(d.maSku(), d.tenHang(), d.donViTinh(), d.soLuong(), t, ts, false));
            truocThue = truocThue.add(t.sauChietKhau());
            thue = thue.add(t.tienThue());
        }
        BigDecimal phi = TachThue.dong(don.phiVanChuyen());
        if (phi.signum() > 0) {
            BigDecimal ts = thueSuat.mucChung(ngay);
            if (ts == null) {
                return new TinhDon(List.of(), BigDecimal.ZERO, BigDecimal.ZERO, thueSuatDung, "Chưa có thuế suất chung áp dụng ngày "
                        + ngay.format(GhiTepAmis.NGAY) + " cho phí vận chuyển.", null);
            }
            // Mã giảm phí ship Shopify: chiết khấu trên dòng phí (kiemTraDonBan đã giới hạn 0 < giảm ≤ phí)
            BigDecimal giamPhi = giamPhiVanChuyen(don).max(BigDecimal.ZERO);
            thueSuatDung.add(ts.stripTrailingZeros());
            TachThue.Dong t = TachThue.tach(BigDecimal.ONE, phi, giamPhi, ts);
            kqDong.add(new DongTien(cauHinh.getMaDichVuVanChuyen(), cauHinh.getTenDichVuVanChuyen(), null, BigDecimal.ONE, t,
                    ts, true));
            truocThue = truocThue.add(t.sauChietKhau());
            thue = thue.add(t.tienThue());
        }
        return new TinhDon(kqDong, truocThue, thue, thueSuatDung, null, canhBaoGiam);
    }

    public void banHang(List<NguonKeToan.DonBan> dsDon, Map<Integer, List<NguonKeToan.DongBan>> dongTheoDon) {
        for (NguonKeToan.DonBan don : dsDon) {
            List<NguonKeToan.DongBan> dong = dongTheoDon.getOrDefault(don.id(), List.of());
            String loi = kiemTraDonBan(don, dong);
            if (loi == null && "PAYOS".equalsIgnoreCase(don.phuongThucPos()) && trong(cauHinh.getSoTkNganHangNhan())) {
                loi = loiThieuTaiKhoanNganHang("Đơn trả bằng QR payOS");
            }
            if (loi != null) {
                chan(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), loi);
                continue;
            }
            LocalDate ngay = ngayVn(don.ngayGiaoHang());
            TinhDon td = tinhDon(don, dong, ngay);
            if (td.loi() != null) {
                chan(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), td.loi());
                continue;
            }
            if (td.canhBaoGiamGia() != null) {
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), td.canhBaoGiamGia());
            }
            KhachCt kh = khachCuaDon(don);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (DongTien d : td.dong()) {
                Map<String, Object> r = dauChungTuBan(don, ngay, kh);
                r.put("Mã hàng", d.maHang());
                r.put("Tên hàng", d.tenHang());
                if (!d.dichVu()) {
                    r.put("ĐVT", d.donViTinh());
                }
                r.put("Số lượng", d.soLuong());
                r.put("Đơn giá", d.tien().donGia());
                r.put("Thành tiền", d.tien().thanhTien());
                if (d.tien().chietKhau().signum() > 0) {
                    r.put("Tiền chiết khấu", d.tien().chietKhau());
                    r.put("TK chiết khấu", cauHinh.getTkChietKhau());
                }
                r.put("% thuế GTGT", phanTram(d.thueSuat()));
                r.put("Tiền thuế GTGT", d.tien().tienThue());
                r.put("TK thuế GTGT", cauHinh.getTkThueDauRa());
                if (!d.dichVu()) {
                    r.put("Mã kho", don.maKho());
                    r.put("TK giá vốn", cauHinh.getTkGiaVon());
                    r.put("TK Kho", cauHinh.getTkKho());
                }
                rows.add(r);
            }
            BigDecimal tsHoaDon = don.thueSuatHoaDon() == null ? null : don.thueSuatHoaDon().stripTrailingZeros();
            Set<BigDecimal> thueSuatDung = td.thueSuatDung();
            if (tsHoaDon != null && !(thueSuatDung.size() == 1 && thueSuatDung.contains(tsHoaDon))) {
                // Cùng một bảng thuế suất (Cấu hình › Thuế GTGT) nhưng hóa đơn chỉ in mức chung, đã ghi trên đơn; vẫn lệch
                // khi có dòng riêng cho danh mục, hoặc bảng sửa sau khi giao. Lệch thì báo để xem lại, vẫn xuất theo kế toán.
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), "Hóa đơn bán hàng in thuế GTGT "
                        + phanTram(tsHoaDon) + "% (đã ghi trên đơn), xuất kế toán tính "
                        + thueSuatDung.stream().map(DungChungTuAmis::phanTram).collect(java.util.stream.Collectors.joining("%, "))
                        + "% theo ngày giao hàng " + ngay.format(GhiTepAmis.NGAY)
                        + ". Thường do dòng thuế riêng cho danh mục, hoặc bảng thuế suất đã sửa sau khi giao: xem lại ở Cấu hình › Thuế GTGT.");
            }
            if (KET_HOP.equalsIgnoreCase(don.phuongThucPos())) {
                // Mẫu Bán hàng AMIS chỉ mang một phương thức thanh toán: tạm ghi phải thu, kế toán lập phiếu thu tách
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), "Khách trả kết hợp tại quầy: xuất dạng \""
                        + CHUA_THU_TIEN + "\" (" + cauHinh.getTkPhaiThu() + "). Lập phiếu thu trên AMIS: tiền mặt "
                        + tien(TachThue.dong(don.tienMatDaThu())) + " đ vào " + cauHinh.getTkTienMat() + ", QR payOS "
                        + tien(TachThue.dong(don.nganHangDaThu())) + " đ vào " + cauHinh.getTkNganHang() + ".");
            }
            kq.them("30_BanHang", HoSoAmis.BAN_HANG, rows, ngay);
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), ngay,
                    TachThue.dong(don.tongCong()), td.truocThue(), td.thue(), rows.size(), kh.ma()));
        }
    }

    /** Lỗi chặn của một đơn bán (null = xuất được). */
    String kiemTraDonBan(NguonKeToan.DonBan don, List<NguonKeToan.DongBan> dong) {
        if (dong.isEmpty()) {
            return "Đơn không có dòng hàng (đơn sàn có dòng chưa khớp mã SKU khi kéo về). Xem lại đơn trên kênh bán.";
        }
        if (don.maKho() == null) {
            return "Không xác định được kho xuất của đơn.";
        }
        if (don.maKho().length() > DO_DAI_MA_KHO) {
            return "Mã kho " + don.maKho() + " dài hơn 20 ký tự, AMIS không nhận. Đổi mã kho trước.";
        }
        if (dong.size() + 1 > SO_DONG_TOI_DA) {
            return "Đơn có " + dong.size() + " dòng, vượt giới hạn 500 dòng mỗi chứng từ của AMIS.";
        }
        for (NguonKeToan.DongBan d : dong) {
            if (d.soLuong().signum() <= 0 || d.thanhTien().signum() < 0 || d.tienGiamGia().signum() < 0
                    || d.tienGiamGia().compareTo(d.thanhTien()) > 0) {
                return "Dòng " + d.maSku() + " có số lượng hoặc tiền không hợp lệ.";
            }
        }
        BigDecimal tongDong = dong.stream().map(d -> TachThue.dong(d.thanhTien())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tongGiam = dong.stream().map(d -> TachThue.dong(d.tienGiamGia())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tienHang = TachThue.dong(don.tienHang());
        BigDecimal phi = TachThue.dong(don.phiVanChuyen());
        if (phi.signum() < 0) {
            return "Phí vận chuyển âm.";
        }
        BigDecimal giamPhi = giamPhiVanChuyen(don);
        boolean giamPhiShopify = don.laShopify() && giamPhi.signum() > 0 && giamPhi.compareTo(phi) <= 0;
        if (giamPhi.signum() != 0 && !giamPhiShopify) {
            return "Tổng cộng " + tien(don.tongCong()) + " đ khác tiền hàng " + tien(tienHang) + " đ cộng phí vận chuyển "
                    + tien(phi) + " đ (đơn sàn có thuế hoặc phí khác, hoặc đơn cũ bị sửa phí). Xem tay.";
        }
        BigDecimal sauGiam = tongDong.subtract(tongGiam);
        if (sauGiam.compareTo(tienHang) == 0) {
            return null;
        }
        if (don.laShopify() && tongGiam.signum() == 0 && tongDong.compareTo(tienHang) > 0) {
            return null;  // đơn Shopify cũ: suy giảm giá ở tinhDon
        }
        return "Tổng các dòng " + tien(sauGiam) + " đ khác tiền hàng " + tien(tienHang)
                + " đ (đơn sàn có dòng bị bỏ qua khi kéo về, có voucher / giảm giá của sàn, hoặc đơn bị sửa). Xem tay.";
    }

    /**
     * Tiền hàng + phí vận chuyển − tổng cộng. Khác 0 ở đơn Shopify dùng mã giảm phí ship: phí lưu là phí trước giảm
     * (total_shipping_price_set), tổng cộng là số khách trả sau giảm (total_price). kiemTraDonBan chỉ cho đơn Shopify có
     * phần giảm trong khoảng (0, phí]; tinhDon ghi phần này thành chiết khấu của dòng phí vận chuyển.
     */
    static BigDecimal giamPhiVanChuyen(NguonKeToan.DonBan don) {
        return TachThue.dong(don.tienHang()).add(TachThue.dong(don.phiVanChuyen())).subtract(TachThue.dong(don.tongCong()));
    }

    private Map<String, Object> dauChungTuBan(NguonKeToan.DonBan don, LocalDate ngay, KhachCt kh) {
        Map<String, Object> r = new LinkedHashMap<>();
        String phuongThuc;
        String tkNo;
        if ("CASH".equalsIgnoreCase(don.phuongThucPos())) {
            phuongThuc = THU_TIEN_MAT;
            tkNo = cauHinh.getTkTienMat();
        } else if ("PAYOS".equalsIgnoreCase(don.phuongThucPos())) {
            phuongThuc = THU_CHUYEN_KHOAN;
            tkNo = cauHinh.getTkNganHang();
        } else {
            phuongThuc = CHUA_THU_TIEN;
            tkNo = cauHinh.getTkPhaiThu();
        }
        r.put("Hình thức bán hàng", BAN_HANG_TRONG_NUOC);
        r.put("Phương thức thanh toán", phuongThuc);
        r.put("Kiêm phiếu xuất kho", CO);
        r.put("Ngày hạch toán", ngay);
        r.put("Ngày chứng từ", ngay);
        r.put("Số chứng từ", don.soDon());
        r.put("Số phiếu xuất", phieuXuatCuoi(don));
        r.put("Mã khách hàng", kh.ma());
        r.put("Tên khách hàng", kh.ten());
        r.put("Địa chỉ", kh.diaChi());
        r.put("Mã số thuế", kh.maSoThue());
        if (THU_CHUYEN_KHOAN.equals(phuongThuc)) {
            // TK ngân hàng trên AMIS chi tiết theo tài khoản ngân hàng: thiếu số tài khoản thì không ghi sổ được
            r.put("Nộp vào TK", cauHinh.getSoTkNganHangNhan());
        }
        r.put("Diễn giải/Lý do nộp", dienGiaiBan(don));
        r.put("Lý do xuất", "Xuất kho bán hàng theo đơn " + don.soDon()
                + (don.soPhieuXuat() == null ? "" : " (phiếu " + don.soPhieuXuat() + ")"));
        r.put("TK Tiền/Chi phí/Nợ", tkNo);
        r.put("TK Doanh thu/Có", cauHinh.getTkDoanhThu());
        return r;
    }

    private static String phieuXuatCuoi(NguonKeToan.DonBan don) {
        if (don.soPhieuXuat() == null || don.soPhieuXuat().isBlank()) {
            return don.soDon();
        }
        String[] ds = don.soPhieuXuat().split(",");
        return ds[ds.length - 1].trim();
    }

    private static String dienGiaiBan(NguonKeToan.DonBan don) {
        if (don.phuongThucPos() != null) {
            return "Bán hàng tại quầy theo đơn " + don.soDon();
        }
        if (don.maDonKenh() != null && !don.maDonKenh().isBlank()) {
            return "Bán hàng " + (don.tenKenh() == null ? "kênh online" : don.tenKenh()) + " đơn " + don.soDon()
                    + " (mã kênh " + don.maDonKenh() + ")";
        }
        return "Bán hàng theo đơn " + don.soDon();
    }

    private String loiThieuTaiKhoanNganHang(String truongHop) {
        return truongHop + " ghi vào TK " + cauHinh.getTkNganHang() + ": AMIS bắt buộc chọn tài khoản ngân hàng, không thì"
                + " không ghi sổ được. Nhập số tài khoản ngân hàng nhận ở Cấu hình › Xuất kế toán (đúng tài khoản đã khai"
                + " báo trên AMIS) rồi kiểm tra lại.";
    }

    // ── Hàng bán trả lại ───────────────────────────────────────────────────

    /** Phần đầu chứng từ Hàng bán trả lại (cột chung lặp trên mọi dòng). */
    private Map<String, Object> dauTraLai(String soChungTu, LocalDate ngay, KhachCt kh, String phuongThuc, String tkTien,
                                          boolean kiemNhapKho, String soPhieuNhap, String dienGiai) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("Hình thức bán hàng", BAN_HANG_DV_TRONG_NUOC);
        r.put("Phương thức thanh toán", phuongThuc);
        r.put("Kiêm phiếu nhập kho", kiemNhapKho ? CO : KHONG);
        r.put("Ngày hạch toán", ngay);
        r.put("Ngày chứng từ", ngay);
        r.put("Số chứng từ", soChungTu);
        if (kiemNhapKho) {
            r.put("Ngày phiếu nhập", ngay);
            r.put("Số phiếu nhập", soPhieuNhap == null ? soChungTu : soPhieuNhap);
            r.put("Diễn giải phiếu nhập", "Nhập kho hàng bán trả lại theo " + soChungTu);
            r.put("Cách lấy đơn giá nhập", DON_GIA_BINH_QUAN_CUOI_KY);
        }
        r.put("Phương thức lập hóa đơn", KHONG_CO_HOA_DON);
        r.put("Mã khách hàng", kh.ma());
        r.put("Tên khách hàng", kh.ten());
        r.put("Địa chỉ", kh.diaChi());
        r.put("Mã số thuế", kh.maSoThue());
        r.put("Diễn giải/Lý do chi", dienGiai);
        r.put("TK trả lại", cauHinh.getTkTraLai());
        r.put("TK Công nợ/TK Tiền", tkTien);
        return r;
    }

    /**
     * Phiếu trả hàng tại quầy. Hàng đạt (nhập lại kho cửa hàng nhận trả) và hàng lỗi (để riêng, không vào tồn) là hai chứng
     * từ: AMIS chỉ cho cả chứng từ kèm hoặc không kèm phiếu nhập kho. Chứng từ hàng lỗi mang số phiếu + "-L". Thuế suất lấy
     * theo ngày giao của đơn gốc (đúng thuế đã tính lúc bán), tiền hoàn đã gồm thuế.
     *
     * @param donTrongLo đơn bán vào lô này (đơn gốc chưa khóa nhưng đang xuất cùng lô thì vẫn xuất phiếu trả)
     * @param ngayMoc    ngày mốc: đơn gốc bán trước mốc không có chứng từ bán trên AMIS, vẫn ghi trả lại (kèm cảnh báo)
     */
    public void traLaiQuay(List<NguonKeToan.PhieuTraQuay> dsPhieu, Map<Integer, List<NguonKeToan.DongTraQuay>> dongTheoPhieu,
                           Set<Integer> donTrongLo, LocalDate ngayMoc) {
        for (NguonKeToan.PhieuTraQuay p : dsPhieu) {
            List<NguonKeToan.DongTraQuay> dong = dongTheoPhieu.getOrDefault(p.id(), List.of());
            LocalDate ngay = ngayVn(p.ngay());
            LocalDate ngayGiao = p.ngayGiaoDon() == null ? null : ngayVn(p.ngayGiaoDon());
            boolean donBanTruocMoc = ngayGiao != null && ngayGiao.isBefore(ngayMoc);
            String loi = null;
            if (dong.isEmpty()) {
                loi = "Phiếu trả hàng không có dòng hàng.";
            } else if (!p.donDaGiao() && !donTrongLo.contains(p.donId()) && !donBanTruocMoc) {
                loi = "Đơn gốc " + p.soDon() + " chưa giao kế toán (đang bị chặn hoặc chưa tới ngày xuất). Phiếu trả để lại"
                        + " lô sau, xuất sau đơn gốc.";
            } else if (p.maKhoNhan() == null || p.maKhoNhan().length() > DO_DAI_MA_KHO) {
                loi = "Mã kho nhận trả trống hoặc dài hơn 20 ký tự.";
            }
            List<NguonKeToan.DongTraQuay> dat = dong.stream().filter(d -> !"loi".equals(d.tinhTrang())).toList();
            List<NguonKeToan.DongTraQuay> hong = dong.stream().filter(d -> "loi".equals(d.tinhTrang())).toList();
            if (loi == null && (dat.size() > SO_DONG_TOI_DA || hong.size() > SO_DONG_TOI_DA)) {
                loi = "Phiếu có quá 500 dòng mỗi chứng từ của AMIS.";
            }
            if (loi == null) {
                for (NguonKeToan.DongTraQuay d : dong) {
                    if (d.soLuong().signum() <= 0 || d.thanhTienHoan().signum() < 0) {
                        loi = "Dòng " + d.maSku() + " có số lượng hoặc tiền hoàn không hợp lệ.";
                        break;
                    }
                }
            }
            if (loi != null) {
                chan(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), loi);
                continue;
            }
            LocalDate ngayThue = ngayGiao == null ? ngay : ngayGiao;
            // Đơn gốc đã giao kế toán: theo mã khách của chứng từ bán; đơn gốc cùng lô / trước mốc: theo luật gom như chứng từ bán
            KhachCt kh = p.donDaGiao()
                    ? khachNhuChungTuBan(p.maKhachBan(), p.maKhachHang(), p.tenKhachHang(), p.diaChiKhachHang(), p.maSoThueKhachHang())
                    : khach(p.maKhachHang(), p.tenKhachHang(), p.diaChiKhachHang(), p.maSoThueKhachHang(), p.maKenh(), p.laPos());
            boolean chuyenKhoan = "chuyen_khoan".equals(p.phuongThucHoan());
            String phuongThuc = chuyenKhoan ? GIAM_TRU_CONG_NO : TRA_LAI_TIEN_MAT;
            String tkTien = chuyenKhoan ? cauHinh.getTkPhaiThu() : cauHinh.getTkTienMat();

            List<Map<String, Object>> rowsDat = new ArrayList<>();
            List<Map<String, Object>> rowsHong = new ArrayList<>();
            BigDecimal truocThue = BigDecimal.ZERO;
            BigDecimal thue = BigDecimal.ZERO;
            BigDecimal tong = BigDecimal.ZERO;
            String loiThue = null;
            for (NguonKeToan.DongTraQuay d : dong) {
                BigDecimal ts = thueSuat.tra(d.danhMucId(), ngayThue);
                if (ts == null) {
                    loiThue = "Chưa có thuế suất áp dụng ngày " + ngayThue.format(GhiTepAmis.NGAY) + " cho mã " + d.maSku()
                            + ". Thêm mức chung hoặc mức cho danh mục ở Cấu hình › Thuế GTGT.";
                    break;
                }
                boolean laDat = !"loi".equals(d.tinhTrang());
                TachThue.Dong t = TachThue.tach(d.soLuong(), d.thanhTienHoan(), BigDecimal.ZERO, ts);
                String so = laDat ? p.soPhieu() : p.soPhieu() + "-L";
                String dienGiai = (laDat ? "Khách trả hàng theo phiếu " : "Khách trả hàng lỗi theo phiếu ") + p.soPhieu()
                        + " (đơn " + p.soDon() + ")";
                Map<String, Object> r = dauTraLai(so, ngay, kh, phuongThuc, tkTien, laDat, p.soPhieuNhap(), dienGiai);
                r.put("Mã hàng", d.maSku());
                r.put("Tên hàng", d.tenHang());
                r.put("ĐVT", d.donViTinh());
                r.put("Số lượng", d.soLuong());
                r.put("Đơn giá", t.donGia());
                r.put("Thành tiền", t.thanhTien());
                r.put("% thuế GTGT", phanTram(ts));
                r.put("Tiền thuế GTGT", t.tienThue());
                r.put("TK thuế GTGT", cauHinh.getTkThueDauRa());
                if (laDat) {
                    r.put("Mã kho", p.maKhoNhan());
                    r.put("TK Kho", cauHinh.getTkKho());
                    r.put("TK giá vốn", cauHinh.getTkGiaVon());
                    rowsDat.add(r);
                } else {
                    rowsHong.add(r);
                }
                truocThue = truocThue.add(t.thanhTien());
                thue = thue.add(t.tienThue());
                tong = tong.add(t.tongCong());
            }
            if (loiThue != null) {
                chan(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), loiThue);
                continue;
            }
            if (!p.donDaGiao() && !donTrongLo.contains(p.donId())) {
                canhBao(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), "Đơn gốc " + p.soDon()
                        + " bán trước ngày mốc nên không có chứng từ bán trên AMIS; phiếu trả vẫn ghi giảm doanh thu kỳ này.");
            }
            if (tong.compareTo(TachThue.dong(p.tongTienHoan())) != 0) {
                canhBao(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), "Tổng tiền các dòng " + tien(tong)
                        + " đ khác tổng tiền hoàn ghi trên phiếu " + tien(p.tongTienHoan()) + " đ. Xem lại phiếu trả.");
            }
            if (chuyenKhoan) {
                canhBao(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), "Hoàn tiền chuyển khoản " + tien(tong)
                        + " đ: chứng từ trả lại ghi giảm trừ công nợ (" + cauHinh.getTkPhaiThu() + "). Lập chứng từ chi tiền gửi"
                        + " (" + cauHinh.getTkNganHang() + ") trả khách trên AMIS cùng số tiền.");
            }
            if (!rowsHong.isEmpty()) {
                canhBao(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), "Hàng lỗi (" + rowsHong.size()
                        + " dòng) ghi thành chứng từ " + p.soPhieu() + "-L không kèm phiếu nhập kho: hàng lỗi không vào tồn,"
                        + " giá vốn đã ghi lúc bán giữ nguyên. Xử lý hàng lỗi (trả nhà cung cấp, hủy) theo quy định của công ty.");
            }
            if (!rowsDat.isEmpty()) {
                kq.them("31_HangTraLai", HoSoAmis.TRA_LAI, rowsDat, ngay);
            }
            if (!rowsHong.isEmpty()) {
                kq.them("31_HangTraLai", HoSoAmis.TRA_LAI, rowsHong, ngay);
            }
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY, p.id(), p.soPhieu(), ngay, tong, truocThue, thue,
                    rowsDat.size() + rowsHong.size(), kh.ma()));
        }
    }

    /**
     * Đơn đã giao kế toán rồi bị hoàn trả: chứng từ Hàng bán trả lại ngược đúng chứng từ bán (cùng dòng, cùng chiết khấu,
     * cùng thuế suất theo ngày giao), giảm trừ công nợ (TK phải thu), không kèm phiếu nhập kho — hàng hoàn về kho lúc nào
     * thì phiếu nhập hoàn trả (PN-RET) nằm ở danh sách biến động kho để kế toán lập phiếu nhập. Số chứng từ = số đơn + "-TL".
     */
    public void traLaiDon(List<NguonKeToan.DonHoan> dsDon, Map<Integer, List<NguonKeToan.DongBan>> dongTheoDon) {
        for (NguonKeToan.DonHoan h : dsDon) {
            NguonKeToan.DonBan don = h.don();
            List<NguonKeToan.DongBan> dong = dongTheoDon.getOrDefault(don.id(), List.of());
            String so = don.soDon() + "-TL";
            String loi = kiemTraDonBan(don, dong);
            LocalDate ngayBan = ngayVn(don.ngayGiaoHang());
            TinhDon td = loi == null ? tinhDon(don, dong, ngayBan) : null;
            if (loi == null) {
                loi = td.loi();
            }
            if (loi != null) {
                chan(ChungTuXuatKeToan.LOAI_TRA_LAI_DON, don.id(), so, "Đơn đã giao kế toán rồi bị hoàn trả nhưng không dựng"
                        + " được chứng từ trả lại: " + loi + " Lập Hàng bán trả lại trên AMIS theo chứng từ bán đã giao.");
                continue;
            }
            LocalDate ngay = ngayVn(h.ngayHoan());
            if (ngay.isBefore(ngayBan)) {
                ngay = ngayBan;
            }
            KhachCt kh = khachNhuChungTuBan(h.maKhachBan(), don.maKhachHang(), don.tenKhachHang(), don.diaChiKhachHang(),
                    don.maSoThueKhachHang());
            List<Map<String, Object>> rows = new ArrayList<>();
            for (DongTien d : td.dong()) {
                Map<String, Object> r = dauTraLai(so, ngay, kh, GIAM_TRU_CONG_NO, cauHinh.getTkPhaiThu(), false, null,
                        "Đơn " + don.soDon() + " bị hoàn trả sau khi đã giao kế toán: ghi giảm doanh thu và công nợ");
                r.put("Mã hàng", d.maHang());
                r.put("Tên hàng", d.tenHang());
                if (!d.dichVu()) {
                    r.put("ĐVT", d.donViTinh());
                }
                r.put("Số lượng", d.soLuong());
                r.put("Đơn giá", d.tien().donGia());
                r.put("Thành tiền", d.tien().thanhTien());
                if (d.tien().chietKhau().signum() > 0) {
                    r.put("Tiền chiết khấu", d.tien().chietKhau());
                    r.put("TK chiết khấu", cauHinh.getTkChietKhau());
                }
                r.put("% thuế GTGT", phanTram(d.thueSuat()));
                r.put("Tiền thuế GTGT", d.tien().tienThue());
                r.put("TK thuế GTGT", cauHinh.getTkThueDauRa());
                rows.add(r);
            }
            canhBao(ChungTuXuatKeToan.LOAI_TRA_LAI_DON, don.id(), so, "Đơn " + don.soDon() + " bị hoàn trả: chứng từ trả lại"
                    + " giảm trừ công nợ, không kèm phiếu nhập kho. Hàng về kho (phiếu nhập hoàn trả PN-RET) thì lập phiếu nhập"
                    + " kho loại \"Nhập kho hàng bán trả lại\" trên AMIS; tiền đã thu của khách thì lập phiếu chi khi hoàn tiền.");
            kq.them("31_HangTraLai", HoSoAmis.TRA_LAI, rows, ngay);
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_TRA_LAI_DON, don.id(), so, ngay, TachThue.dong(don.tongCong()),
                    td.truocThue(), td.thue(), rows.size(), kh.ma()));
        }
    }

    // ── Nhập / xuất kho khác ───────────────────────────────────────────────

    /** Loại chứng từ khóa của phiếu kho khác theo chiều và bảng nguồn. */
    static String loaiKhoKhac(String huong, String loaiThamChieu) {
        boolean tang = "tang".equals(huong);
        return switch (loaiThamChieu) {
            case "phieu_dieu_chinh_kho" -> tang ? ChungTuXuatKeToan.LOAI_NHAP_KHAC_DCK : ChungTuXuatKeToan.LOAI_XUAT_KHAC_DCK;
            case "phieu_xuat_kho" -> tang ? ChungTuXuatKeToan.LOAI_NHAP_KHAC_PXK : ChungTuXuatKeToan.LOAI_XUAT_KHAC_PXK;
            case "phieu_nhap_kho" -> tang ? ChungTuXuatKeToan.LOAI_NHAP_KHAC_PNK : ChungTuXuatKeToan.LOAI_XUAT_KHAC_PNK;
            default -> throw new IllegalArgumentException(loaiThamChieu);
        };
    }

    /**
     * Biến động kho không có chứng từ mua / bán / chuyển kho (kiểm kê, hao hụt chuyển kho, xuất khác, nhập khác) thành phiếu
     * xuất kho khác (giảm: Nợ TK hàng thiếu / Có TK kho, AMIS tự tính giá xuất) hoặc nhập kho khác (tăng: Nợ TK kho / Có TK
     * hàng thừa, đơn giá ghi tay = giá vốn lô trừ thuế theo mức chung, cùng cách với tồn đầu kỳ và mua hàng chưa có hóa đơn).
     * Một chứng từ gốc có cả tăng lẫn giảm (đợt kiểm kê) thì thành hai phiếu, số chứng từ thêm "-T" / "-G".
     */
    public void khoKhac(List<NguonKeToan.DongKhoKhac> ds) {
        Map<String, List<NguonKeToan.DongKhoKhac>> theoPhieu = new LinkedHashMap<>();
        Set<String> coHaiChieu = new HashSet<>();
        Map<String, String> chieuCuaGoc = new HashMap<>();
        for (NguonKeToan.DongKhoKhac d : ds) {
            String goc = d.loaiThamChieu() + ":" + d.idThamChieu();
            String chieu = chieuCuaGoc.putIfAbsent(goc, d.huong());
            if (chieu != null && !chieu.equals(d.huong())) {
                coHaiChieu.add(goc);
            }
            theoPhieu.computeIfAbsent(loaiKhoKhac(d.huong(), d.loaiThamChieu()) + ":" + d.idThamChieu(), k -> new ArrayList<>()).add(d);
        }
        for (List<NguonKeToan.DongKhoKhac> dong : theoPhieu.values()) {
            NguonKeToan.DongKhoKhac dau = dong.get(0);
            boolean tang = "tang".equals(dau.huong());
            String loai = loaiKhoKhac(dau.huong(), dau.loaiThamChieu());
            String goc = dau.loaiThamChieu() + ":" + dau.idThamChieu();
            String soGoc = dau.soChungTu() == null || dau.soChungTu().isBlank()
                    ? "KK" + dau.idThamChieu() : dau.soChungTu();
            String so = soGoc + (coHaiChieu.contains(goc) ? (tang ? "-T" : "-G") : "");
            LocalDate ngay = dong.stream().map(NguonKeToan.DongKhoKhac::ngay).filter(Objects::nonNull)
                    .min(Comparator.naturalOrder()).map(DungChungTuAmis::ngayVn).orElse(null);
            String loi = null;
            if (ngay == null) {
                loi = "Biến động kho không có ngày giao dịch.";
            } else if (dong.size() > SO_DONG_TOI_DA) {
                loi = "Phiếu có " + dong.size() + " dòng, vượt giới hạn 500 dòng mỗi chứng từ của AMIS.";
            } else if (dong.stream().anyMatch(d -> d.maKho() == null || d.maKho().length() > DO_DAI_MA_KHO)) {
                loi = "Mã kho trống hoặc dài hơn 20 ký tự, AMIS không nhận.";
            } else if (tang && dong.stream().anyMatch(d -> d.thieuGia() > 0)) {
                loi = "Có lô hàng chưa có giá vốn: phiếu nhập kho khác phải ghi đơn giá. Cập nhật giá vốn lô rồi kiểm tra lại.";
            }
            BigDecimal heSo = BigDecimal.ONE;
            if (loi == null && tang) {
                BigDecimal ts = thueSuat.mucChung(ngay);
                if (ts == null) {
                    loi = "Chưa có thuế suất chung ngày " + ngay.format(GhiTepAmis.NGAY) + " để tách thuế khỏi giá vốn lô.";
                } else {
                    heSo = BigDecimal.ONE.add(ts.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
                }
            }
            if (loi != null) {
                chan(loai, dau.idThamChieu(), so, loi);
                continue;
            }
            String dienGiai = dienGiaiKhoKhac(dau, tang);
            List<Map<String, Object>> rows = new ArrayList<>();
            BigDecimal tongGiaTri = BigDecimal.ZERO;
            for (NguonKeToan.DongKhoKhac d : dong) {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put(tang ? "Loại nhập kho" : "Loại xuất kho", tang ? NHAP_KHO_KHAC : XUAT_KHO_KHAC);
                r.put("Ngày hạch toán", ngay);
                r.put("Ngày chứng từ", ngay);
                r.put("Số chứng từ", so);
                r.put(tang ? "Diễn giải" : "Lý do xuất", dienGiai);
                r.put("Mã hàng", d.maSku());
                r.put("Tên hàng", d.tenHang());
                r.put("Mã kho", d.maKho());
                r.put("ĐVT", d.donViTinh());
                r.put("Số lượng", d.soLuong());
                if (tang) {
                    BigDecimal thanhTien = d.giaTri().divide(heSo, 0, RoundingMode.HALF_UP);
                    r.put("Phương thức nhập/tính đơn giá nhập", NHAP_DON_GIA_BANG_TAY);
                    r.put("TK Nợ", cauHinh.getTkKho());
                    r.put("TK Có", cauHinh.getTkHangThua());
                    r.put("Đơn giá", donGia(thanhTien, d.soLuong()));
                    r.put("Thành tiền", thanhTien);
                    tongGiaTri = tongGiaTri.add(thanhTien);
                } else {
                    r.put("TK Nợ", cauHinh.getTkHangThieu());
                    r.put("TK Có", cauHinh.getTkKho());
                }
                rows.add(r);
            }
            kq.them(tang ? "22_NhapKhoKhac" : "25_XuatKhoKhac", tang ? HoSoAmis.NHAP_KHO : HoSoAmis.XUAT_KHO, rows, ngay);
            kq.chungTu.add(new ChungTu(loai, dau.idThamChieu(), so, ngay, tongGiaTri, tongGiaTri, BigDecimal.ZERO, rows.size()));
        }
    }

    private static String dienGiaiKhoKhac(NguonKeToan.DongKhoKhac d, boolean tang) {
        String ghiChu = d.ghiChu() == null || d.ghiChu().isBlank() ? "" : " — " + d.ghiChu().trim();
        String so = d.soChungTu() == null ? "" : " " + d.soChungTu();
        String cau = switch (d.nhom()) {
            case "kiem_ke" -> (tang ? "Điều chỉnh tăng theo kiểm kê" : "Điều chỉnh giảm theo kiểm kê") + so;
            case "ghi_giam_chuyen_kho" -> "Ghi giảm hao hụt chuyển kho" + so;
            case "xuat_khac" -> (tang ? "Nhập lại hàng của phiếu xuất khác" : "Xuất kho khác theo phiếu") + so;
            case "nhap_khac" -> (tang ? "Nhập kho khác theo phiếu" : "Ghi giảm hàng của phiếu nhập khác") + so;
            default -> "Biến động kho" + so;
        };
        String kq = cau + ghiChu;
        return kq.length() > 255 ? kq.substring(0, 255) : kq;
    }

    private static BigDecimal donGia(BigDecimal thanhTien, BigDecimal soLuong) {
        BigDecimal dg = thanhTien.divide(soLuong, TachThue.SO_LE_DON_GIA, RoundingMode.HALF_UP).stripTrailingZeros();
        return dg.scale() < 0 ? dg.setScale(0) : dg;
    }

    // ── Mua hàng ───────────────────────────────────────────────────────────

    public void muaHang(List<NguonKeToan.PhieuMua> dsPhieu, Map<Integer, List<NguonKeToan.DongMua>> dongTheoPhieu) {
        for (NguonKeToan.PhieuMua p : dsPhieu) {
            List<NguonKeToan.DongMua> dong = dongTheoPhieu.getOrDefault(p.id(), List.of());
            LocalDate ngay = ngayVn(p.ngayNhap());
            String loi = null;
            if (dong.isEmpty()) {
                loi = "Phiếu nhập không có dòng hàng đạt kiểm tra.";
            } else if (p.maNhaCungCap() == null) {
                loi = "Phiếu nhập chưa gắn nhà cung cấp.";
            } else if (p.maKho() == null || p.maKho().length() > DO_DAI_MA_KHO) {
                loi = "Mã kho nhập trống hoặc dài hơn 20 ký tự.";
            } else if (dong.size() > SO_DONG_TOI_DA) {
                loi = "Phiếu có " + dong.size() + " dòng, vượt giới hạn 500 dòng mỗi chứng từ của AMIS.";
            }
            BigDecimal tsTach;
            boolean ghiThue;
            String nhanHoaDon;
            if (Boolean.TRUE.equals(p.coHoaDon())) {
                tsTach = p.thueSuat();
                ghiThue = true;
                nhanHoaDon = NHAN_KEM_HOA_DON;
            } else if (Boolean.FALSE.equals(p.coHoaDon())) {
                tsTach = BigDecimal.ZERO;
                ghiThue = false;
                nhanHoaDon = KHONG_CO_HOA_DON;
            } else {
                tsTach = thueSuat.mucChung(ngay);
                ghiThue = false;
                nhanHoaDon = KHONG_KEM_HOA_DON;
                if (loi == null && tsTach == null) {
                    loi = "Chưa nhập hóa đơn nhà cung cấp và chưa có thuế suất chung ngày "
                            + ngay.format(GhiTepAmis.NGAY) + " để tách thuế khỏi đơn giá.";
                }
            }
            if (loi == null && tsTach == null) {
                loi = "Hóa đơn nhà cung cấp chưa có thuế suất.";
            }
            if (loi != null) {
                chan(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(), loi);
                continue;
            }
            if (Boolean.TRUE.equals(p.coHoaDon()) && (p.maSoThueNhaCungCap() == null || p.maSoThueNhaCungCap().isBlank())) {
                canhBao(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(),
                        "Nhà cung cấp " + p.maNhaCungCap() + " chưa có mã số thuế (cần cho hóa đơn đầu vào).");
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            BigDecimal tong = BigDecimal.ZERO;
            BigDecimal truocThue = BigDecimal.ZERO;
            BigDecimal thue = BigDecimal.ZERO;
            for (NguonKeToan.DongMua d : dong) {
                BigDecimal gop = TachThue.dong(d.soLuong().multiply(d.donGia()));
                TachThue.Dong t = TachThue.tach(d.soLuong(), gop, BigDecimal.ZERO, tsTach);
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("Hình thức mua hàng", MUA_TRONG_NUOC_NHAP_KHO);
                r.put("Phương thức thanh toán", CHUA_THANH_TOAN);
                r.put("Nhận kèm hóa đơn", nhanHoaDon);
                r.put("Ngày hạch toán", ngay);
                r.put("Ngày chứng từ", ngay);
                r.put("Số phiếu nhập", p.soPhieu());
                if (Boolean.TRUE.equals(p.coHoaDon())) {
                    r.put("Mẫu số HĐ", p.mauSo());
                    r.put("Ký hiệu HĐ", p.kyHieu());
                    r.put("Số hóa đơn", p.soHoaDon());
                    r.put("Ngày hóa đơn", p.ngayHoaDon());
                }
                r.put("Mã nhà cung cấp", p.maNhaCungCap());
                r.put("Tên nhà cung cấp", p.tenNhaCungCap());
                r.put("Địa chỉ", p.diaChiNhaCungCap());
                r.put("Mã số thuế", p.maSoThueNhaCungCap());
                r.put("Diễn giải", "Mua hàng của " + p.tenNhaCungCap()
                        + (p.soDonMua() == null ? "" : " theo đơn mua " + p.soDonMua()));
                r.put("Mã hàng", d.maSku());
                r.put("Tên hàng", d.tenHang());
                r.put("Mã kho", p.maKho());
                r.put("TK kho/TK chi phí", cauHinh.getTkKho());
                r.put("TK công nợ/TK tiền", cauHinh.getTkPhaiTra());
                r.put("ĐVT", d.donViTinh());
                r.put("Số lượng", d.soLuong());
                if (ghiThue) {
                    r.put("Đơn giá", t.donGia());
                    r.put("Thành tiền", t.thanhTien());
                    r.put("% thuế GTGT", phanTram(tsTach));
                    r.put("Tiền thuế GTGT", t.tienThue());
                    r.put("TK thuế GTGT", cauHinh.getTkThueDauVao());
                    r.put("Nhóm HHDV mua vào", NHOM_HHDV_MUA_VAO);
                    truocThue = truocThue.add(t.thanhTien());
                    thue = thue.add(t.tienThue());
                } else {
                    // Không có hóa đơn: cả đơn giá là giá nhập. Chưa có hóa đơn: giá nhập là phần trước thuế ước theo
                    // mức chung, thuế ghi khi kế toán nhận hóa đơn trên AMIS.
                    r.put("Đơn giá", t.donGia());
                    r.put("Thành tiền", t.thanhTien());
                    truocThue = truocThue.add(t.thanhTien());
                }
                rows.add(r);
                tong = tong.add(gop);
            }
            // Chưa có hóa đơn: AMIS ghi giá trị hàng (phần trước thuế ước theo mức chung); thuế còn lại ghi khi kế toán Nhận
            // hóa đơn trên AMIS (Mua hàng › Nhận hóa đơn tự điền thuế theo % — đã thử trên AMIS 14/11/2026)
            BigDecimal thueCho = p.coHoaDon() == null ? tong.subtract(truocThue) : BigDecimal.ZERO;
            if (p.coHoaDon() == null) {
                canhBao(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(), "Chưa nhập hóa đơn nhà cung cấp: xuất dạng \""
                        + KHONG_KEM_HOA_DON + "\", AMIS ghi giá trị hàng " + tien(truocThue) + " đ (tách thuế "
                        + phanTram(tsTach) + "%), thuế " + tien(thueCho) + " đ chờ hóa đơn. Khi nhận hóa đơn, kế toán vào Mua hàng"
                        + " › Nhận hóa đơn trên AMIS và chọn phiếu này; đã có hóa đơn thì nên nhập ở phiếu nhập trước khi xuất.");
            }
            kq.them("10_MuaHang", HoSoAmis.MUA_HANG, rows, ngay);
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(), ngay, tong,
                    truocThue, thue, rows.size(), null, thueCho));
        }
    }

    // ── Chuyển kho ─────────────────────────────────────────────────────────

    public void chuyenKho(List<NguonKeToan.PhieuChuyen> dsPhieu, Map<String, List<NguonKeToan.DongChuyen>> dongTheoPhieu) {
        for (NguonKeToan.PhieuChuyen p : dsPhieu) {
            List<NguonKeToan.DongChuyen> dong = dongTheoPhieu.getOrDefault(khoaChuyen(p.loai(), p.id()), List.of());
            boolean laXuat = ChungTuXuatKeToan.LOAI_CHUYEN_KHO_XUAT.equals(p.loai());
            String khoXuat = laXuat ? p.maKhoXuat() : MA_KHO_DANG_CHUYEN;
            String khoNhap = laXuat ? MA_KHO_DANG_CHUYEN : p.maKhoNhap();
            String loi = null;
            if (dong.isEmpty()) {
                loi = "Phiếu không có dòng hàng theo lô.";
            } else if (khoXuat == null || khoNhap == null) {
                loi = "Thiếu kho xuất hoặc kho nhận.";
            } else if (khoXuat.length() > DO_DAI_MA_KHO || khoNhap.length() > DO_DAI_MA_KHO) {
                loi = "Mã kho dài hơn 20 ký tự, AMIS không nhận.";
            } else if (dong.size() > SO_DONG_TOI_DA) {
                loi = "Phiếu có " + dong.size() + " dòng, vượt giới hạn 500 dòng mỗi chứng từ của AMIS.";
            }
            if (loi != null) {
                chan(p.loai(), p.id(), p.soChungTu(), loi);
                continue;
            }
            LocalDate ngay = ngayVn(p.ngay());
            String dienGiai;
            if (laXuat) {
                dienGiai = "Chuyển hàng từ " + p.tenKhoXuat() + " đến " + (p.tenKhoNhap() == null ? "kho nhận" : p.tenKhoNhap())
                        + " theo lệnh " + p.soLenh() + " (hàng đi đường)";
            } else if (p.laHoanVe()) {
                dienGiai = "Hủy chuyển kho giữa đường, nhập lại " + p.tenKhoNhap() + " theo lệnh " + p.soLenh();
            } else {
                dienGiai = "Nhận hàng chuyển đến " + p.tenKhoNhap() + " theo lệnh " + p.soLenh();
            }
            List<Map<String, Object>> rows = new ArrayList<>();
            for (NguonKeToan.DongChuyen d : dong) {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("Hình thức chuyển kho", laXuat ? cauHinh.getHinhThucChuyenKho() : CHUYEN_KHO_NOI_BO);
                r.put("Ngày hạch toán", ngay);
                r.put("Ngày chứng từ", ngay);
                r.put("Số chứng từ", p.soChungTu());
                r.put("Hợp đồng KT số/Lệnh điều động số", p.soLenh());
                if (p.ngayLenh() != null) {
                    r.put("Ngày", ngayVn(p.ngayLenh()));
                }
                r.put("Về việc/Diễn giải", dienGiai);
                r.put("Mã hàng", d.maSku());
                r.put("Tên hàng", d.tenHang());
                r.put("Xuất tại kho", khoXuat);
                r.put("Nhập tại kho", khoNhap);
                r.put("TK Nợ", cauHinh.getTkKho());
                r.put("TK Có", cauHinh.getTkKho());
                r.put("ĐVT", d.donViTinh());
                r.put("Số lượng", d.soLuong());
                rows.add(r);
            }
            if (laXuat && !CHUYEN_KHO_NOI_BO.equals(cauHinh.getHinhThucChuyenKho())) {
                canhBao(p.loai(), p.id(), p.soChungTu(), "Hình thức \"" + cauHinh.getHinhThucChuyenKho() + "\": AMIS coi phiếu"
                        + " là hóa đơn điện tử, bỏ trống số chứng từ khi nhập và chờ phát hành trên meInvoice. Đối chiếu theo lệnh "
                        + p.soLenh() + ".");
            }
            kq.them("20_ChuyenKho", HoSoAmis.CHUYEN_KHO, rows, ngay);
            kq.chungTu.add(new ChungTu(p.loai(), p.id(), p.soChungTu(), ngay, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, rows.size()));
        }
    }

    public static String khoaChuyen(String loai, int id) {
        return loai + ":" + id;
    }

    // ── Tồn đầu kỳ ─────────────────────────────────────────────────────────

    /**
     * Tồn mỗi mã hàng ở mỗi kho tại đầu ngày mốc (cộng các lô). Giá trị = số lượng × giá vốn lô; giá vốn lô là đơn giá
     * đơn mua (đã gồm thuế) nên trừ thuế theo mức chung của ngày trước mốc, cùng cách với chứng từ mua hàng.
     * Một lô âm (sổ kho lệch tồn) thì cả phần tồn đầu kỳ bị chặn.
     */
    public void tonDauKy(List<NguonKeToan.TonLo> dsLo, LocalDate ngayMoc) {
        LocalDate ngayTinh = ngayMoc.minusDays(1);
        // Báo hết các lô âm (không dừng ở lô đầu) để sửa dữ liệu một lượt
        boolean coLoAm = false;
        for (NguonKeToan.TonLo lo : dsLo) {
            if (lo.soLuong().signum() >= 0) continue;
            coLoAm = true;
            String am = lo.soLuong().negate().stripTrailingZeros().toPlainString();
            chan(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ", MA_KHO_DANG_CHUYEN.equals(lo.maKho())
                    ? "Lô " + lo.loHangId() + " (" + lo.maSku() + ") ở kho hàng đang chuyển âm " + am + " tại ngày mốc: số đã nhận"
                            + " về nhiều hơn số đã xuất đi, thường do một phiếu chuyển bị nhận hai lần. Sửa dữ liệu chuyển kho"
                            + " rồi kiểm tra lại."
                    : "Lô " + lo.loHangId() + " (" + lo.maSku() + ") ở kho " + lo.maKho() + " âm " + am
                            + " tại ngày mốc theo sổ kho. Kiểm lại sổ kho của lô.");
        }
        if (coLoAm) {
            return;
        }
        BigDecimal ts = thueSuat.mucChung(ngayTinh);
        if (ts == null) {
            ts = BigDecimal.ZERO;
            canhBao(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ",
                    "Không có thuế suất chung ngày " + ngayTinh.format(GhiTepAmis.NGAY) + ": giá trị tồn giữ nguyên giá vốn lô.");
        }
        BigDecimal heSo = BigDecimal.ONE.add(ts.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        Map<String, Map<String, Object>> gop = new LinkedHashMap<>();
        Map<String, BigDecimal> giaTriGop = new HashMap<>();
        for (NguonKeToan.TonLo lo : dsLo) {
            if (lo.soLuong().signum() == 0) continue;
            String khoa = lo.maKho() + "\u0000" + lo.maSku();
            Map<String, Object> r = gop.computeIfAbsent(khoa, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("Mã kho", lo.maKho());
                m.put("Mã hàng", lo.maSku());
                m.put("Đơn vị tính", lo.donViTinh());
                m.put("Số lượng", BigDecimal.ZERO);
                return m;
            });
            r.put("Số lượng", ((BigDecimal) r.get("Số lượng")).add(lo.soLuong()));
            giaTriGop.merge(khoa, lo.soLuong().multiply(lo.giaVon()), BigDecimal::add);
        }
        BigDecimal tong = BigDecimal.ZERO;
        for (Map.Entry<String, Map<String, Object>> e : gop.entrySet()) {
            BigDecimal giaTri = giaTriGop.get(e.getKey()).divide(heSo, 0, RoundingMode.HALF_UP);
            e.getValue().put("Giá trị", giaTri);
            tong = tong.add(giaTri);
        }
        // Ghi nhận tồn đầu kỳ đã giao kể cả khi bằng 0 (không tính lại ở lô sau); tồn 0 thì không có tệp số dư
        kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ " + ngayMoc.format(GhiTepAmis.NGAY),
                ngayMoc, tong, tong, BigDecimal.ZERO, gop.size()));
        if (gop.isEmpty()) {
            canhBao(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ", "Không có hàng tồn ở đầu ngày mốc "
                    + ngayMoc.format(GhiTepAmis.NGAY) + " nên không có tệp số dư ban đầu.");
            return;
        }
        kq.them("05_TonDauKy", HoSoAmis.TON_DAU_KY, new ArrayList<>(gop.values()), null);
        canhBao(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ", "Giá trị tồn tính từ giá vốn lô (đơn giá đơn mua đã gồm thuế) trừ thuế theo mức chung "
                + phanTram(ts) + "%. Kế toán kiểm lại trước khi nhập số dư.");
    }

    // ── Danh mục ───────────────────────────────────────────────────────────

    /**
     * Danh mục kèm lô. khach: dòng danh mục khách hàng đọc từ CSDL theo {@link KetQua#maKhachRieng()} và mã gom (KHLE nếu
     * CSDL có); mã gom nào CSDL không có (SAN_…) thì dựng dòng sẵn.
     */
    public void danhMuc(List<NguonKeToan.KhoKt> kho, List<NguonKeToan.KhachHangKt> khach,
                        List<NguonKeToan.NhaCungCapKt> ncc, List<NguonKeToan.HangHoa> hang, LocalDate ngay) {
        List<Map<String, Object>> dongKho = new ArrayList<>();
        for (NguonKeToan.KhoKt k : kho) {
            if (k.ma().length() > DO_DAI_MA_KHO) {
                canhBao("danh_muc", null, k.ma(), "Mã kho " + k.ma() + " dài hơn 20 ký tự, AMIS không nhận.");
                continue;
            }
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("Mã kho", k.ma());
            r.put("Tên kho", MA_KHO_DANG_CHUYEN.equals(k.ma()) ? "Hàng đang chuyển" : k.ten());
            r.put("Địa chỉ", k.diaChi());
            r.put("Tài khoản kho", cauHinh.getTkKho());
            dongKho.add(r);
        }
        kq.them("01_Kho", HoSoAmis.KHO, dongKho, null);

        List<Map<String, Object>> dongKh = new ArrayList<>();
        Set<String> daCo = new HashSet<>();
        for (NguonKeToan.KhachHangKt k : khach) {
            if (!daCo.add(k.ma())) continue;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("Mã khách hàng", k.ma());
            r.put("Tên khách hàng", k.ten());
            r.put("Địa chỉ", k.diaChi());
            r.put("Mã số thuế", k.maSoThue());
            r.put("Điện thoại", that(k.soDienThoai()));
            r.put("Là tổ chức/cá nhân", "doanh_nghiep".equals(k.loai()) ? TO_CHUC : CA_NHAN);
            r.put("Họ và tên người liên hệ", k.nguoiLienHe());
            r.put("Email", that(k.email()));
            dongKh.add(r);
        }
        for (String ma : kq.maKhachNhom) {
            if (!daCo.add(ma)) continue;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("Mã khách hàng", ma);
            r.put("Tên khách hàng", MA_KHACH_LE.equals(ma) ? TEN_KHACH_LE : TEN_KHACH_NHOM.get(ma));
            r.put("Là tổ chức/cá nhân", MA_KHACH_LE.equals(ma) ? CA_NHAN : TO_CHUC);
            dongKh.add(r);
        }
        if (!dongKh.isEmpty()) {
            kq.them("02_KhachHang", HoSoAmis.KHACH_HANG, dongKh, null);
        }

        List<Map<String, Object>> dongNcc = new ArrayList<>();
        for (NguonKeToan.NhaCungCapKt n : ncc) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("Mã nhà cung cấp", n.ma());
            r.put("Tên nhà cung cấp", n.ten());
            r.put("Địa chỉ", n.diaChi());
            r.put("Mã số thuế", n.maSoThue());
            r.put("Điện thoại", n.soDienThoai());
            r.put("Là tổ chức/cá nhân", TO_CHUC);
            r.put("Họ và tên người liên hệ", n.nguoiLienHe());
            r.put("Email", n.email());
            dongNcc.add(r);
        }
        kq.them("03_NhaCungCap", HoSoAmis.NHA_CUNG_CAP, dongNcc, null);

        List<Map<String, Object>> dongHang = new ArrayList<>();
        for (NguonKeToan.HangHoa h : hang) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("Mã hàng", h.maSku());
            r.put("Tên hàng", h.tenHang());
            r.put("Tính chất", HANG_HOA);
            r.put("Đơn vị tính chính", h.donViTinh());
            BigDecimal ts = thueSuat.tra(h.danhMucId(), ngay);
            if (ts != null) {
                r.put("Thuế suất GTGT (%)", phanTram(ts));
            }
            if (h.giaBan() != null && h.giaBan().signum() > 0) {
                r.put("Đơn giá bán", h.giaBan());
                r.put("Là đơn giá bán sau thuế", CO);
            }
            dongHang.add(r);
        }
        Map<String, Object> phi = new LinkedHashMap<>();
        phi.put("Mã hàng", cauHinh.getMaDichVuVanChuyen());
        phi.put("Tên hàng", cauHinh.getTenDichVuVanChuyen());
        phi.put("Tính chất", DICH_VU);
        BigDecimal tsChung = thueSuat.mucChung(ngay);
        if (tsChung != null) {
            phi.put("Thuế suất GTGT (%)", phanTram(tsChung));
        }
        dongHang.add(phi);
        kq.them("04_VatTuHangHoa", HoSoAmis.VAT_TU_HANG_HOA, dongHang, null);
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────

    public static LocalDate ngayVn(Instant t) {
        return LocalDate.ofInstant(t, MUI_GIO);
    }

    /** "8", "10", "5", "0" — đúng giá trị trong danh sách % thuế GTGT của AMIS. */
    static String phanTram(BigDecimal ts) {
        return ts.stripTrailingZeros().toPlainString();
    }

    private static boolean trong(String s) {
        return s == null || s.isBlank();
    }

    private static String that(String giaTri) {
        return giaTri == null || GIA_TRI_GIA.contains(giaTri.trim()) ? null : giaTri;
    }

    private static String tien(BigDecimal so) {
        return String.format(Locale.GERMANY, "%,d", TachThue.dong(so).longValueExact());
    }

    private void chan(String loai, Integer id, String so, String noiDung) {
        kq.chan.add(new VanDe(loai, id, so, noiDung));
    }

    private void canhBao(String loai, Integer id, String so, String noiDung) {
        kq.canhBao.add(new VanDe(loai, id, so, noiDung));
    }
}
