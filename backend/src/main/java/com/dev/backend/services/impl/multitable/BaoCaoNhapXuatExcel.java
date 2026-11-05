package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.NhatKyNhapXuatDTO;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.GiaoDich;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.TheoLoai;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * Tệp Excel của Nhật ký nhập xuất theo khuôn chung (KhuonExcelBaoCao):
 * - Tổng hợp: chỉ tiêu nhập, xuất của kỳ, theo loại giao dịch, theo kho; chữ ký.
 * - Theo kỳ / Theo kho: đúng bảng trên màn (không có ở kiểu Chi tiết giao dịch).
 * - Chi tiết giao dịch: từng dòng sổ kho kèm số chứng từ, kho, mã SKU, lô (kỳ tối đa 1 năm, tối đa 100.000 dòng).
 */
public final class BaoCaoNhapXuatExcel extends KhuonExcelBaoCao {

    /**
     * Số liệu của tệp. theoKho rỗng khi đang lọc một kho; chiTiet null khi kỳ dài hơn 1 năm (không dựng trang chi tiết).
     */
    public record DuLieu(String loai, String tenKy, LocalDate tu, LocalDate den, String dongPhu,
                         List<NhatKyNhapXuatDTO> theoKy, List<TheoLoai> theoLoai, List<NhatKyNhapXuatDTO> theoKho,
                         List<GiaoDich> chiTiet) {
    }

    private final DuLieu d;
    private final String dongKy;

    private BaoCaoNhapXuatExcel(DuLieu d) {
        this.d = d;
        this.dongKy = "Kỳ báo cáo: " + d.tenKy() + " (" + khoang(d.tu(), d.den()) + ")";
    }

    public static byte[] tao(DuLieu d, ThongTin tin) {
        BaoCaoNhapXuatExcel x = new BaoCaoNhapXuatExcel(d);
        x.sheetTongHop(tin);
        if (!"chi_tiet".equals(d.loai())) x.sheetTheoKy(tin);
        // Trang chi tiết có thể tới hàng chục nghìn dòng: ghi dần ra đĩa
        return x.xuat("Nhật ký nhập xuất kho", tin, sx -> x.sheetChiTiet(sx, tin));
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        doRongCot(s, 6, 34, 13, 15, 15, 18, 18, 14);
        s.setDisplayGridlines(false);
        int r = dauTrang(s, tin, "BÁO CÁO NHẬP XUẤT KHO", 7, dongKy, d.dongPhu());

        // --- I. Chỉ tiêu: cộng theo loại giao dịch (cùng nguồn, cùng điều kiện nên bằng tổng các dòng của bảng trên màn) ---
        o(s, r++, 0, "I. CHỈ TIÊU NHẬP XUẤT TRONG KỲ", k("muc"));
        int hI = r;
        tieuDe(s, r++, 22, "STT", "Chỉ tiêu", "Đơn vị", "Số liệu", "", "", "", "");
        gop(s, hI, 3, 7);
        int rNhap = r;
        chiTieu(s, r++, "1", "Số lượng nhập", "sản phẩm", congLoai(TheoLoai::tongNhap), "so");
        int rXuat = r;
        chiTieu(s, r++, "2", "Số lượng xuất", "sản phẩm", congLoai(TheoLoai::tongXuat), "so");
        Row cl = s.createRow(r);
        o(cl, 0, "3", k("stt"));
        o(cl, 1, "Chênh lệch tồn (3 = 1 − 2)", k("chuDam"));
        o(cl, 2, "sản phẩm", k("dvO"));
        f(cl, 3, ref(rNhap, 3) + "-" + ref(rXuat, 3), k("soDam"));
        oTrong(s, r++);
        chiTieu(s, r++, "4", "Giá trị nhập (theo giá vốn)", "đồng", congLoai(TheoLoai::giaTriNhap), "tien");
        chiTieu(s, r++, "5", "Giá trị xuất (theo giá vốn)", "đồng", congLoai(TheoLoai::giaTriXuat), "tien");
        r++;

        // --- II. Theo loại giao dịch ---
        o(s, r++, 0, "II. THEO LOẠI GIAO DỊCH", k("muc"));
        tieuDe(s, r++, 30, "STT", "Loại giao dịch", "Số chứng từ", "Số lượng nhập", "Số lượng xuất", "Giá trị nhập",
                "Giá trị xuất", "");
        int dauII = r;
        int stt = 1;
        for (TheoLoai l : d.theoLoai()) {
            Row row = s.createRow(r++);
            o(row, 0, String.valueOf(stt++), k("stt"));
            o(row, 1, BaoCaoNhapXuatService.TEN_LOAI.getOrDefault(l.loai(), l.loai()), k("chu"));
            so(row, 2, l.soChungTu(), k("so"));
            so(row, 3, l.tongNhap(), k("so"));
            so(row, 4, l.tongXuat(), k("so"));
            so(row, 5, l.giaTriNhap(), k("tien"));
            so(row, 6, l.giaTriXuat(), k("tien"));
        }
        Row congII = dongCong(s, r, 6, 1, "Cộng");
        for (int c = 2; c <= 6; c++) f(congII, c, tongCot(dauII, r - 1, c, false), k(c >= 5 ? "congTien" : "congSo"));
        r += 2;

        // --- III. Theo kho (khi xem tất cả kho, không phải kiểu Theo kho) ---
        if (!d.theoKho().isEmpty() && !"theo_kho".equals(d.loai())) {
            o(s, r++, 0, "III. THEO KHO", k("muc"));
            tieuDe(s, r++, 30, "STT", "Kho", "Số lượng nhập", "Số lượng xuất", "Chênh lệch", "Giá trị nhập", "Giá trị xuất", "");
            int dauIII = r;
            stt = 1;
            for (NhatKyNhapXuatDTO kh : d.theoKho()) dongSo(s, r++, stt++, kh, false);
            Row congIII = dongCong(s, r, 6, 1, "Cộng");
            for (int c = 2; c <= 6; c++) f(congIII, c, tongCot(dauIII, r - 1, c, false), k(c >= 5 ? "congTien" : "congSo"));
            r += 2;
        }

        String[] ghi = {
                "Ghi chú:",
                "- Đọc từ sổ giao dịch kho theo ngày giao dịch; số lượng xuất ghi số dương.",
                "- Không tính Kho Trung Chuyển (hàng đang đi đường khi chuyển kho), để hàng chuyển kho không bị cộng nhập hai lần.",
                "- Điều chỉnh kiểm kê tăng tính vào nhập, giảm tính vào xuất. Giá trị theo giá vốn của lô.",
                "- Số chứng từ ở mục II là số phiếu nhập, phiếu xuất, phiếu điều chỉnh khác nhau.",
        };
        for (String g : ghi) o(s, r++, 0, g, k(g.equals("Ghi chú:") ? "ghiChuDam" : "ghiChu"));
        r++;
        chuKy(s, r, tin, 7);
        inTrang(s, false, -1, -1);
        s.getPrintSetup().setFitHeight((short) 1);
    }

    private void chiTieu(Sheet s, int r, String stt, String ten, String dv, BigDecimal v, String kieu) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k("chu"));
        o(row, 2, dv, k("dvO"));
        so(row, 3, v, k(kieu));
        oTrong(s, r);
    }

    /** Ô số liệu của mục I trải từ cột D tới H. */
    private void oTrong(Sheet s, int r) {
        Row row = s.getRow(r);
        for (int c = 4; c <= 7; c++) o(row, c, "", k("chu"));
        gop(s, r, 3, 7);
    }

    /** Một dòng bảng kỳ / kho: STT, nhãn, SL nhập, SL xuất, chênh lệch (công thức), giá trị nhập, giá trị xuất. */
    private void dongSo(Sheet s, int r, int stt, NhatKyNhapXuatDTO k0, boolean soGiua) {
        Row row = s.createRow(r);
        if (soGiua) so(row, 0, stt, k("soGiua")); else o(row, 0, String.valueOf(stt), k("stt"));
        o(row, 1, k0.getNhanThoiGian(), k("chu"));
        so(row, 2, k0.getTongNhap(), k("so"));
        so(row, 3, k0.getTongXuat(), k("so"));
        f(row, 4, ref(r, 2) + "-" + ref(r, 3), k("so"));
        so(row, 5, k0.getTongGiaTriNhap(), k("tien"));
        so(row, 6, k0.getTongGiaTriXuat(), k("tien"));
    }

    // ================= Trang 2: Theo kỳ / Theo kho =================

    private void sheetTheoKy(ThongTin tin) {
        boolean theoKho = "theo_kho".equals(d.loai());
        Sheet s = wb.createSheet(theoKho ? "Theo kho" : "Theo kỳ");
        doRongCot(s, 6, 30, 15, 15, 15, 18, 18);
        int r = dauTrang(s, tin, theoKho ? "NHẬP XUẤT THEO KHO" : "NHẬP XUẤT THEO KỲ", 6, dongKy, d.dongPhu());
        int h = r;
        tieuDe(s, r++, 30, "STT", theoKho ? "Kho" : "Thời kỳ", "Số lượng nhập", "Số lượng xuất", "Chênh lệch",
                "Giá trị nhập", "Giá trị xuất");
        int dau = r;
        int stt = 1;
        for (NhatKyNhapXuatDTO k0 : d.theoKy()) dongSo(s, r++, stt++, k0, true);
        Row cong = dongCong(s, r, 6, 1, "Cộng");
        for (int c = 2; c <= 6; c++) f(cong, c, tongCot(dau, r - 1, c, true), k(c >= 5 ? "congTien" : "congSo"));
        r += 2;
        if ("so_sanh".equals(d.loai())) o(s, r++, 1, "Ghi chú: Dòng Cộng là tổng của cả hai tháng.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(0, h + 1);
        if (!d.theoKy().isEmpty()) s.setAutoFilter(new CellRangeAddress(h, dau + d.theoKy().size() - 1, 0, 6));
        inTrang(s, false, h, h);
    }

    // ================= Trang 3: Chi tiết giao dịch =================

    private void sheetChiTiet(SXSSFWorkbook sx, ThongTin tin) {
        Sheet s = sx.createSheet("Chi tiết giao dịch");
        //         STT Giờ Số CT Loại Kho KĐến MãSP Tên SKU Lô  Nhập Xuất GV  GTN GTX Diễn giải
        doRongCot(s, 6, 16, 20, 12, 18, 18, 13, 30, 22, 16, 10, 10, 13, 15, 15, 36);
        int cuoiCot = 15;
        int r = dauTrang(s, tin, "CHI TIẾT GIAO DỊCH NHẬP XUẤT KHO", cuoiCot, dongKy, d.dongPhu());
        if (d.chiTiet() == null) {
            o(s, r + 1, 1, "Kỳ dài hơn 1 năm: chọn kỳ ngắn hơn (theo ngày, theo tháng hoặc so sánh) để có chi tiết từng giao dịch.", k("ghiChu"));
            inTrang(s, true, -1, -1);
            return;
        }
        boolean cat = d.chiTiet().size() > BaoCaoNhapXuatService.TOI_DA_DONG_CHI_TIET;
        List<GiaoDich> ds = cat ? d.chiTiet().subList(0, BaoCaoNhapXuatService.TOI_DA_DONG_CHI_TIET) : d.chiTiet();
        int h = r;
        tieuDe(s, r++, 30, "STT", "Ngày giờ", "Số chứng từ", "Loại", "Kho", "Kho chuyển đến", "Mã sản phẩm",
                "Tên sản phẩm", "Mã SKU", "Mã lô", "Số lượng nhập", "Số lượng xuất", "Giá vốn", "Giá trị nhập",
                "Giá trị xuất", "Diễn giải");
        int dau = r;
        int stt = 1;
        double[] tong = new double[16];
        for (GiaoDich g : ds) {
            Row row = s.createRow(r++);
            BigDecimal sl = g.soLuong() == null ? BigDecimal.ZERO : g.soLuong();
            BigDecimal gv = g.giaVon() == null ? BigDecimal.ZERO : g.giaVon();
            BigDecimal nhap = sl.signum() > 0 ? sl : BigDecimal.ZERO;
            BigDecimal xuat = sl.signum() < 0 ? sl.negate() : BigDecimal.ZERO;
            so(row, 0, stt++, k("soGiua"));
            ngayGio(row, 1, g.ngay());
            o(row, 2, g.soChungTu(), k("chu"));
            o(row, 3, BaoCaoNhapXuatService.TEN_LOAI.getOrDefault(g.loai(), g.loai()), k("chu"));
            o(row, 4, g.kho(), k("chuXuong"));
            o(row, 5, g.khoDen(), k("chuXuong"));
            o(row, 6, g.maSanPham(), k("chu"));
            o(row, 7, g.tenSanPham(), k("chuXuong"));
            o(row, 8, g.maSku(), k("chuXuong"));
            o(row, 9, g.maLo(), k("chu"));
            so(row, 10, nhap, k("so"));
            so(row, 11, xuat, k("so"));
            so(row, 12, gv, k("tien"));
            so(row, 13, nhap.multiply(gv), k("tien"));
            so(row, 14, xuat.multiply(gv), k("tien"));
            tong[10] += nhap.doubleValue();
            tong[11] += xuat.doubleValue();
            tong[13] += nhap.multiply(gv).doubleValue();
            tong[14] += xuat.multiply(gv).doubleValue();
            o(row, 15, g.ghiChu(), k("chuXuong"));
        }
        int cuoi = r - 1;
        Row cong = dongCong(s, r, cuoiCot, 2, "Cộng (" + ds.size() + " dòng)");
        for (int c : new int[]{10, 11, 13, 14}) fCo(cong, c, tongCot(dau, cuoi, c, true), tong[c], k(c >= 13 ? "congTien" : "congSo"));
        r += 2;
        if (cat) {
            o(s, r++, 1, "Kỳ có hơn " + String.format("%,d", BaoCaoNhapXuatService.TOI_DA_DONG_CHI_TIET).replace(',', '.')
                    + " giao dịch: trang này chỉ ghi các giao dịch đầu tiên của kỳ; số ở trang Tổng hợp vẫn đủ cả kỳ. Hãy chọn kỳ ngắn hơn.", k("ghiChuDam"));
        }
        if (ds.isEmpty()) o(s, r++, 1, "Không có giao dịch nào trong kỳ.", k("ghiChu"));
        o(s, r++, 1, "Ghi chú: Dòng Cộng tự tính lại khi lọc. Giá trị = số lượng × giá vốn của lô.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(3, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, cuoiCot));
        inTrang(s, true, h, h);
    }

    private BigDecimal congLoai(Function<TheoLoai, BigDecimal> f) {
        return d.theoLoai().stream().map(f).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
