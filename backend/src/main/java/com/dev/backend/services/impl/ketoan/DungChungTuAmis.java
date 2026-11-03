package com.dev.backend.services.impl.ketoan;

import com.dev.backend.entities.CauHinhKeToan;
import com.dev.backend.entities.ChungTuXuatKeToan;

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
 * bỏ khỏi lô (để lại lô sau, sửa rồi xuất); cảnh báo vẫn xuất. Quy tắc từng loại: xem đề xuất đợt 1 (mục 5).</p>
 */
public final class DungChungTuAmis {

    public static final ZoneId MUI_GIO = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Kho ảo giữ hàng đang trên đường chuyển kho (KhoService.laKhoAo); sang AMIS là kho "Hàng đang chuyển". */
    public static final String MA_KHO_DANG_CHUYEN = "KHO_TRANSIT";
    /** Hộp nhập AMIS: mỗi chứng từ tối đa 500 dòng chi tiết. */
    static final int SO_DONG_TOI_DA = 500;
    /** Mã kho trên AMIS tối đa 20 ký tự. */
    static final int DO_DAI_MA_KHO = 20;

    // Danh sách thả xuống trong tệp mẫu AMIS doanh nghiệp (đọc 25/10/2026)
    static final String CO = "Có";
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

    /** Số điện thoại / email giả do đồng bộ Shopify tạo cho khách thiếu thông tin: không gửi sang kế toán. */
    static final Set<String> GIA_TRI_GIA = Set.of("0900000000", "shopify@customer.com");

    private static final DateTimeFormatter THANG = DateTimeFormatter.ofPattern("yyyy-MM");

    private final CauHinhKeToan cauHinh;
    private final TraThueSuat thueSuat;
    private final KetQua kq = new KetQua();

    public DungChungTuAmis(CauHinhKeToan cauHinh, TraThueSuat thueSuat) {
        this.cauHinh = cauHinh;
        this.thueSuat = thueSuat;
    }

    // ── Kết quả ────────────────────────────────────────────────────────────

    /** Một chứng từ đưa vào lô (để ghi chung_tu_xuat_ke_toan và cộng tổng). */
    public record ChungTu(String loai, int idNguon, String soChungTu, LocalDate ngayHachToan, BigDecimal tongTien,
                          BigDecimal truocThue, BigDecimal thue, int soDong) {
    }

    public record VanDe(String loai, Integer idNguon, String soChungTu, String noiDung) {
    }

    /** Một tệp Excel trong tệp nén: tên (không đuôi), mẫu, các dòng. */
    public record Tep(String ten, String mau, List<Map<String, Object>> dong) {
    }

    public static final class KetQua {
        private final Map<String, Tep> tep = new LinkedHashMap<>();
        private final List<ChungTu> chungTu = new ArrayList<>();
        private final List<VanDe> chan = new ArrayList<>();
        private final List<VanDe> canhBao = new ArrayList<>();

        public List<Tep> tep() {
            List<Tep> ds = new ArrayList<>(tep.values());
            ds.sort(Comparator.comparing(Tep::ten));
            return ds;
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

        void them(String tenTep, String mau, List<Map<String, Object>> dong) {
            tep.computeIfAbsent(tenTep, k -> new Tep(k, mau, new ArrayList<>())).dong().addAll(dong);
        }
    }

    public KetQua ketQua() {
        return kq;
    }

    // ── Bán hàng ───────────────────────────────────────────────────────────

    public void banHang(List<NguonKeToan.DonBan> dsDon, Map<Integer, List<NguonKeToan.DongBan>> dongTheoDon) {
        for (NguonKeToan.DonBan don : dsDon) {
            List<NguonKeToan.DongBan> dong = dongTheoDon.getOrDefault(don.id(), List.of());
            String loi = kiemTraDonBan(don, dong);
            if (loi != null) {
                chan(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), loi);
                continue;
            }
            LocalDate ngay = ngayVn(don.ngayGiaoHang());

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
            if (tongGiamLuu.signum() == 0 && tongDong.compareTo(tienHang) > 0) {
                // Chỉ đơn Shopify đi tới đây (kiemTraDonBan chặn đơn khác lệch tổng)
                giamGia = TachThue.chiaTheoTyLe(tongDong.subtract(tienHang),
                        dong.stream().map(NguonKeToan.DongBan::thanhTien).toList());
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(),
                        "Đơn Shopify không có giảm giá từng dòng (kéo về trước khi lưu, hoặc đơn bị sửa / hoàn tiền trên"
                                + " Shopify): " + tien(tongDong.subtract(tienHang)) + " đ chênh giữa tổng dòng và tiền hàng ghi"
                                + " thành chiết khấu, chia theo tỷ lệ tiền dòng. Đơn có hoàn tiền thì kiểm lại trên Shopify.");
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            BigDecimal truocThue = BigDecimal.ZERO;
            BigDecimal thue = BigDecimal.ZERO;
            String loiThue = null;
            // Thuế suất kế toán đã dùng cho đơn, để so với thuế suất in trên hóa đơn bán hàng
            Set<BigDecimal> thueSuatDung = new TreeSet<>();
            for (int i = 0; i < dong.size(); i++) {
                NguonKeToan.DongBan d = dong.get(i);
                BigDecimal ts = thueSuat.tra(d.danhMucId(), ngay);
                if (ts == null) {
                    loiThue = "Chưa có thuế suất áp dụng ngày " + ngay.format(GhiTepAmis.NGAY) + " cho mã " + d.maSku()
                            + ". Thêm mức chung hoặc mức cho danh mục ở Cấu hình › Xuất kế toán.";
                    break;
                }
                thueSuatDung.add(ts.stripTrailingZeros());
                TachThue.Dong t = TachThue.tach(d.soLuong(), d.thanhTien(), giamGia.get(i), ts);
                Map<String, Object> r = dauChungTuBan(don, ngay);
                r.put("Mã hàng", d.maSku());
                r.put("Tên hàng", d.tenHang());
                r.put("ĐVT", d.donViTinh());
                r.put("Số lượng", d.soLuong());
                r.put("Đơn giá", t.donGia());
                r.put("Thành tiền", t.thanhTien());
                if (t.chietKhau().signum() > 0) {
                    r.put("Tiền chiết khấu", t.chietKhau());
                    r.put("TK chiết khấu", cauHinh.getTkChietKhau());
                }
                r.put("% thuế GTGT", phanTram(ts));
                r.put("Tiền thuế GTGT", t.tienThue());
                r.put("TK thuế GTGT", cauHinh.getTkThueDauRa());
                r.put("Mã kho", don.maKho());
                r.put("TK giá vốn", cauHinh.getTkGiaVon());
                r.put("TK Kho", cauHinh.getTkKho());
                rows.add(r);
                truocThue = truocThue.add(t.sauChietKhau());
                thue = thue.add(t.tienThue());
            }
            BigDecimal phi = TachThue.dong(don.phiVanChuyen());
            if (loiThue == null && phi.signum() > 0) {
                BigDecimal ts = thueSuat.mucChung(ngay);
                if (ts == null) {
                    loiThue = "Chưa có thuế suất chung áp dụng ngày " + ngay.format(GhiTepAmis.NGAY) + " cho phí vận chuyển.";
                } else {
                    // Mã giảm phí ship Shopify: chiết khấu trên dòng phí (kiemTraDonBan đã giới hạn 0 < giảm ≤ phí)
                    BigDecimal giamPhi = giamPhiVanChuyen(don).max(BigDecimal.ZERO);
                    thueSuatDung.add(ts.stripTrailingZeros());
                    TachThue.Dong t = TachThue.tach(BigDecimal.ONE, phi, giamPhi, ts);
                    Map<String, Object> r = dauChungTuBan(don, ngay);
                    r.put("Mã hàng", cauHinh.getMaDichVuVanChuyen());
                    r.put("Tên hàng", cauHinh.getTenDichVuVanChuyen());
                    r.put("Số lượng", BigDecimal.ONE);
                    r.put("Đơn giá", t.donGia());
                    r.put("Thành tiền", t.thanhTien());
                    if (t.chietKhau().signum() > 0) {
                        r.put("Tiền chiết khấu", t.chietKhau());
                        r.put("TK chiết khấu", cauHinh.getTkChietKhau());
                    }
                    r.put("% thuế GTGT", phanTram(ts));
                    r.put("Tiền thuế GTGT", t.tienThue());
                    r.put("TK thuế GTGT", cauHinh.getTkThueDauRa());
                    rows.add(r);
                    truocThue = truocThue.add(t.sauChietKhau());
                    thue = thue.add(t.tienThue());
                }
            }
            if (loiThue != null) {
                chan(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), loiThue);
                continue;
            }
            BigDecimal tsHoaDon = don.thueSuatHoaDon() == null ? null : don.thueSuatHoaDon().stripTrailingZeros();
            if (tsHoaDon != null && !(thueSuatDung.size() == 1 && thueSuatDung.contains(tsHoaDon))) {
                // Hai lịch thuế độc lập: Cấu hình › Thuế GTGT (in hóa đơn, chụp lúc chốt đơn) và Cấu hình › Xuất kế toán
                // (theo ngày giao hàng, có mức riêng theo danh mục). Lệch thì báo để xem lại, vẫn xuất theo kế toán.
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), "Hóa đơn bán hàng in thuế GTGT "
                        + phanTram(tsHoaDon) + "% (lúc chốt đơn), xuất kế toán tính "
                        + thueSuatDung.stream().map(DungChungTuAmis::phanTram).collect(java.util.stream.Collectors.joining("%, "))
                        + "% theo ngày giao hàng " + ngay.format(GhiTepAmis.NGAY)
                        + ". Xem lại lịch thuế ở Cấu hình › Thuế GTGT và Cấu hình › Xuất kế toán.");
            }
            if (KET_HOP.equalsIgnoreCase(don.phuongThucPos())) {
                // Mẫu Bán hàng AMIS chỉ mang một phương thức thanh toán: tạm ghi phải thu, kế toán lập phiếu thu tách
                canhBao(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), "Khách trả kết hợp tại quầy: xuất dạng \""
                        + CHUA_THU_TIEN + "\" (" + cauHinh.getTkPhaiThu() + "). Lập phiếu thu trên AMIS: tiền mặt "
                        + tien(TachThue.dong(don.tienMatDaThu())) + " đ vào " + cauHinh.getTkTienMat() + ", QR payOS "
                        + tien(TachThue.dong(don.nganHangDaThu())) + " đ vào " + cauHinh.getTkNganHang() + ".");
            }
            kq.them("30_BanHang_" + ngay, HoSoAmis.BAN_HANG, rows);
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_BAN_HANG, don.id(), don.soDon(), ngay,
                    TachThue.dong(don.tongCong()), truocThue, thue, rows.size()));
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
            return null;  // đơn Shopify cũ: suy giảm giá ở banHang
        }
        return "Tổng các dòng " + tien(sauGiam) + " đ khác tiền hàng " + tien(tienHang)
                + " đ (đơn sàn có dòng bị bỏ qua khi kéo về, có voucher / giảm giá của sàn, hoặc đơn bị sửa). Xem tay.";
    }

    /**
     * Tiền hàng + phí vận chuyển − tổng cộng. Khác 0 ở đơn Shopify dùng mã giảm phí ship: phí lưu là phí trước giảm
     * (total_shipping_price_set), tổng cộng là số khách trả sau giảm (total_price). kiemTraDonBan chỉ cho đơn Shopify có
     * phần giảm trong khoảng (0, phí]; banHang ghi phần này thành chiết khấu của dòng phí vận chuyển.
     */
    static BigDecimal giamPhiVanChuyen(NguonKeToan.DonBan don) {
        return TachThue.dong(don.tienHang()).add(TachThue.dong(don.phiVanChuyen())).subtract(TachThue.dong(don.tongCong()));
    }

    private Map<String, Object> dauChungTuBan(NguonKeToan.DonBan don, LocalDate ngay) {
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
        r.put("Mã khách hàng", don.maKhachHang());
        r.put("Tên khách hàng", don.tenKhachHang());
        r.put("Địa chỉ", don.diaChiKhachHang());
        r.put("Mã số thuế", don.maSoThueKhachHang());
        if (THU_CHUYEN_KHOAN.equals(phuongThuc) && cauHinh.getSoTkNganHangNhan() != null) {
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
            if (p.coHoaDon() == null) {
                canhBao(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(), "Chưa nhập hóa đơn nhà cung cấp: xuất dạng \""
                        + KHONG_KEM_HOA_DON + "\", giá nhập tách thuế theo mức chung " + phanTram(tsTach)
                        + "%. Nên nhập hóa đơn ở phiếu nhập trước khi xuất.");
            } else if (Boolean.TRUE.equals(p.coHoaDon()) && (p.maSoThueNhaCungCap() == null || p.maSoThueNhaCungCap().isBlank())) {
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
            kq.them("10_MuaHang_" + ngay.format(THANG), HoSoAmis.MUA_HANG, rows);
            kq.chungTu.add(new ChungTu(ChungTuXuatKeToan.LOAI_MUA_HANG, p.id(), p.soPhieu(), ngay, tong,
                    truocThue, thue, rows.size()));
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
            kq.them("20_ChuyenKho_" + ngay.format(THANG), HoSoAmis.CHUYEN_KHO, rows);
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
        kq.them("05_TonDauKy", HoSoAmis.TON_DAU_KY, new ArrayList<>(gop.values()));
        canhBao(ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, "Tồn đầu kỳ", "Giá trị tồn tính từ giá vốn lô (đơn giá đơn mua đã gồm thuế) trừ thuế theo mức chung "
                + phanTram(ts) + "%. Kế toán kiểm lại trước khi nhập số dư.");
    }

    // ── Danh mục ───────────────────────────────────────────────────────────

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
        kq.them("01_Kho", HoSoAmis.KHO, dongKho);

        List<Map<String, Object>> dongKh = new ArrayList<>();
        for (NguonKeToan.KhachHangKt k : khach) {
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
        kq.them("02_KhachHang", HoSoAmis.KHACH_HANG, dongKh);

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
        kq.them("03_NhaCungCap", HoSoAmis.NHA_CUNG_CAP, dongNcc);

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
        kq.them("04_VatTuHangHoa", HoSoAmis.VAT_TU_HANG_HOA, dongHang);
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────

    public static LocalDate ngayVn(Instant t) {
        return LocalDate.ofInstant(t, MUI_GIO);
    }

    /** "8", "10", "5", "0" — đúng giá trị trong danh sách % thuế GTGT của AMIS. */
    static String phanTram(BigDecimal ts) {
        return ts.stripTrailingZeros().toPlainString();
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
