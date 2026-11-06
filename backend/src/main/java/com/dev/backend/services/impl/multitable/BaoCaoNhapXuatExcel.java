package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.NhapXuatTongHopDTO;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Dong;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Ky;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Loai;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.GiaoDich;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tệp Excel của Báo cáo nhập xuất theo khuôn chung (KhuonExcelBaoCao), cùng số với màn:
 * - Tổng hợp: I. Tồn đầu + Nhập − Xuất = Tồn cuối; II. Nhập từ đâu, xuất đi đâu; III. Theo kho; chữ ký.
 * - Theo kỳ, Theo sản phẩm: bảng nhập xuất tồn hai tầng Số lượng / Giá trị.
 * - Chi tiết giao dịch: từng dòng sổ kho kèm số chứng từ, kho, mã SKU, lô (kỳ tối đa 1 năm, tối đa 100.000 dòng).
 */
public final class BaoCaoNhapXuatExcel extends KhuonExcelBaoCao {

    /** Số liệu của tệp. chiTiet null khi kỳ dài hơn 1 năm (không dựng trang chi tiết). */
    public record DuLieu(NhapXuatTongHopDTO bc, String tenKy, String dongPhu, List<GiaoDich> chiTiet) {
    }

    private final DuLieu d;
    private final NhapXuatTongHopDTO bc;
    private final String dongKy;
    /** Đang lọc một nhóm: bảng theo kỳ, kho, sản phẩm chỉ có nhập / xuất của nhóm đó, không có cột tồn. */
    private final boolean dangLoc;

    private BaoCaoNhapXuatExcel(DuLieu d) {
        this.d = d;
        this.bc = d.bc();
        this.dongKy = "Kỳ báo cáo: " + d.tenKy() + " (" + khoang(bc.tuNgay(), bc.denNgay()) + ")";
        this.dangLoc = bc.nhom() != null;
    }

    public static byte[] tao(DuLieu d, ThongTin tin) {
        BaoCaoNhapXuatExcel x = new BaoCaoNhapXuatExcel(d);
        x.sheetTongHop(tin);
        x.sheetBang(tin, "Theo kỳ", "NHẬP XUẤT TỒN THEO KỲ", "Kỳ", true);
        x.sheetBang(tin, "Theo sản phẩm", "NHẬP XUẤT TỒN THEO SẢN PHẨM", "Sản phẩm", false);
        // Trang chi tiết có thể tới hàng chục nghìn dòng: ghi dần ra đĩa
        return x.xuat("Báo cáo nhập xuất kho", tin, sx -> x.sheetChiTiet(sx, tin));
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        doRongCot(s, 6, 34, 14, 14, 14, 14, 17, 17, 17, 17);
        s.setDisplayGridlines(false);
        int cuoiCot = 9;
        // Đang lọc một loại: mục I, II vẫn là số mọi loại (để đối chiếu tồn), chỉ mục III theo loại đang lọc
        String phu = dangLoc ? "Mục I, II: mọi loại nhập, xuất; mục III: " + d.dongPhu().toLowerCase() : d.dongPhu();
        int r = dauTrang(s, tin, "BÁO CÁO NHẬP XUẤT TỒN KHO", cuoiCot, dongKy, phu);

        // --- I. Nhập xuất tồn: tồn cuối = tồn đầu + nhập − xuất (công thức) ---
        o(s, r++, 0, "I. NHẬP XUẤT TỒN TRONG KỲ", k("muc"));
        tieuDe(s, r++, 22, "STT", "Chỉ tiêu", "Số lượng", "Giá trị", "Số phiếu");
        int rDau = r;
        dongChiTieu(s, r++, "1", "Tồn đầu kỳ", bc.dauKy().soLuong(), bc.dauKy().giaTri(), null);
        int rNhap = r;
        dongChiTieu(s, r++, "2", "Nhập trong kỳ", bc.nhap().soLuong(), bc.nhap().giaTri(), bc.nhap().soPhieu());
        int rXuat = r;
        dongChiTieu(s, r++, "3", "Xuất trong kỳ", bc.xuat().soLuong(), bc.xuat().giaTri(), bc.xuat().soPhieu());
        Row cuoi = s.createRow(r++);
        o(cuoi, 0, "4", k("stt"));
        o(cuoi, 1, "Tồn cuối kỳ (4 = 1 + 2 − 3)", k("chuDam"));
        for (int c = 2; c <= 3; c++) {
            f(cuoi, c, ref(rDau, c) + "+" + ref(rNhap, c) + "-" + ref(rXuat, c), k(c == 2 ? "soDam" : "tienDam"));
        }
        o(cuoi, 4, "", k("chu"));
        r++;

        // --- II. Nhập từ đâu, xuất đi đâu ---
        o(s, r++, 0, "II. NHẬP TỪ ĐÂU, XUẤT ĐI ĐÂU", k("muc"));
        tieuDe(s, r++, 22, "STT", "Loại", "Số lượng", "Giá trị", "Số phiếu");
        for (String chieu : List.of("nhap", "xuat")) {
            Row nh = s.createRow(r++);
            o(nh, 0, "nhap".equals(chieu) ? "A" : "B", k("stt"));
            o(nh, 1, "nhap".equals(chieu) ? "Nhập" : "Xuất", k("chuDam"));
            int dau = r;
            int stt = 1;
            for (Loai l : bc.theoLoai()) {
                if (!chieu.equals(l.chieu())) continue;
                Row row = s.createRow(r++);
                o(row, 0, String.valueOf(stt++), k("stt"));
                o(row, 1, l.ten(), k("chu"));
                so(row, 2, l.soLuong(), k("so"));
                so(row, 3, l.giaTri(), k("tien"));
                so(row, 4, l.soPhieu(), k("so"));
            }
            f(nh, 2, tongCot(dau, r - 1, 2, false), k("soDam"));
            f(nh, 3, tongCot(dau, r - 1, 3, false), k("tienDam"));
            o(nh, 4, "", k("chu"));
        }
        r++;

        // --- III. Theo kho ---
        if (bc.theoKho().size() > 1) {
            o(s, r++, 0, dangLoc ? "III. THEO KHO (" + d.dongPhu().toLowerCase() + ")" : "III. THEO KHO", k("muc"));
            r = bang(s, r, "Kho", bc.theoKho(), false, false);
            r++;
        }

        String[] ghi = {
                "Ghi chú:",
                "- Tồn cuối kỳ khớp tồn kho thật tại thời điểm cuối kỳ; tồn đầu kỳ = tồn cuối kỳ − nhập + xuất trong kỳ.",
                "- Không tính Kho Trung Chuyển (hàng đang trên đường khi chuyển kho).",
                "- Xem tất cả kho thì hàng chuyển giữa các kho có ở cả Nhận chuyển kho và Chuyển kho đi; phần lớn bù trừ nhau; chênh lệch là hàng còn đang chuyển hoặc hao hụt khi chuyển.",
                "- Điều chỉnh tăng tính vào nhập, điều chỉnh giảm tính vào xuất. Giá trị theo giá vốn của lô.",
        };
        for (String g : ghi) o(s, r++, 0, g, k(g.equals("Ghi chú:") ? "ghiChuDam" : "ghiChu"));
        r++;
        chuKy(s, r, tin, cuoiCot);
        inTrang(s, false, -1, -1);
        s.getPrintSetup().setFitHeight((short) 1);
    }

    private void dongChiTieu(Sheet s, int r, String stt, String ten, BigDecimal sl, BigDecimal gt, Long phieu) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k("chu"));
        so(row, 2, sl, k("so"));
        so(row, 3, gt, k("tien"));
        if (phieu == null) o(row, 4, "", k("chu")); else so(row, 4, phieu, k("so"));
    }

    // ================= Trang 2, 3: Theo kỳ, Theo sản phẩm =================

    private void sheetBang(ThongTin tin, String tenTrang, String tieuDe, String cot1, boolean theoKy) {
        Sheet s = wb.createSheet(tenTrang);
        doRongCot(s, 6, theoKy ? 26 : 40, 13, 13, 13, 13, 17, 17, 17, 17, 11, 11);
        int cuoiCot = dangLoc ? (theoKy ? 7 : 5) : (theoKy ? 11 : 9);
        int r = dauTrang(s, tin, tieuDe, cuoiCot, dongKy, d.dongPhu());
        int h = r;
        if (theoKy) {
            List<Dong> dong = bc.theoKy().stream().filter(k0 -> !k0.chuaToi()).map(BaoCaoNhapXuatExcel::dongKy).toList();
            r = bang(s, r, cot1, dong, true, true);
        } else {
            r = bang(s, r, cot1, bc.theoSanPham(), true, false);
        }
        r++;
        if (dangLoc) o(s, r++, 1, "Đang lọc một loại nhập xuất: bảng không có cột tồn.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(2, h + 2);
        inTrang(s, true, h, h + 1);
    }

    private static Dong dongKy(Ky k0) {
        return new Dong(0, k0.nhanDay(), null, null, null, null, k0.dauSl(), k0.dauGt(), k0.nhapSl(), k0.nhapGt(),
                k0.xuatSl(), k0.xuatGt(), k0.cuoiSl(), k0.cuoiGt());
    }

    /**
     * Bảng nhập xuất tồn hai tầng tiêu đề (Số lượng | Giá trị), dòng Cộng ở cuối; đang lọc nhóm thì bỏ cột tồn.
     * theoKy: ds là các kỳ theo thứ tự (thêm cột Số phiếu; dòng Cộng lấy tồn đầu của kỳ đầu, tồn cuối của kỳ cuối);
     * ngược lại dòng Cộng cộng tồn các dòng. coLoc: có nút lọc, dòng Cộng tính theo dòng đang hiện. Trả dòng kế tiếp.
     */
    private int bang(Sheet s, int r, String cot1, List<Dong> ds, boolean coLoc, boolean theoKy) {
        String[] slCot = dangLoc ? new String[]{"Nhập", "Xuất"} : new String[]{"Tồn đầu", "Nhập", "Xuất", "Tồn cuối"};
        int nSl = slCot.length;
        int cuoiCot = 1 + nSl * 2 + (theoKy ? 2 : 0);
        Row h1 = s.createRow(r);
        h1.setHeightInPoints(20);
        for (int c = 0; c <= cuoiCot; c++) o(h1, c, "", k("tieuDeCot"));
        o(h1, 0, "STT", k("tieuDeCot"));
        o(h1, 1, cot1, k("tieuDeCot"));
        o(h1, 2, "Số lượng", k("tieuDeCot"));
        o(h1, 2 + nSl, "Giá trị (đồng)", k("tieuDeCot"));
        if (theoKy) {
            o(h1, 2 + nSl * 2, "Số phiếu", k("tieuDeCot"));
            gop(s, r, 2 + nSl * 2, cuoiCot);
        }
        gop(s, r, 2, 1 + nSl);
        gop(s, r, 2 + nSl, 1 + nSl * 2);
        Row h2 = s.createRow(r + 1);
        h2.setHeightInPoints(20);
        for (int c = 0; c <= cuoiCot; c++) o(h2, c, "", k("tieuDeCot"));
        for (int i = 0; i < nSl; i++) {
            o(h2, 2 + i, slCot[i], k("tieuDeCot"));
            o(h2, 2 + nSl + i, slCot[i], k("tieuDeCot"));
        }
        if (theoKy) {
            o(h2, 2 + nSl * 2, "Nhập", k("tieuDeCot"));
            o(h2, 3 + nSl * 2, "Xuất", k("tieuDeCot"));
        }
        s.addMergedRegion(new CellRangeAddress(r, r + 1, 0, 0));
        s.addMergedRegion(new CellRangeAddress(r, r + 1, 1, 1));
        int h = r;
        r += 2;
        int dau = r;
        List<Ky> ky = bc.theoKy().stream().filter(k0 -> !k0.chuaToi()).toList();
        int stt = 1;
        for (int i = 0; i < ds.size(); i++) {
            Dong x = ds.get(i);
            Row row = s.createRow(r++);
            so(row, 0, stt++, k("soGiua"));
            o(row, 1, x.ma() == null ? x.ten() : x.ten() + " (" + x.ma() + ")", k("chuXuong"));
            BigDecimal[] sl = dangLoc ? new BigDecimal[]{x.nhapSl(), x.xuatSl()}
                    : new BigDecimal[]{x.dauSl(), x.nhapSl(), x.xuatSl(), x.cuoiSl()};
            BigDecimal[] gt = dangLoc ? new BigDecimal[]{x.nhapGt(), x.xuatGt()}
                    : new BigDecimal[]{x.dauGt(), x.nhapGt(), x.xuatGt(), x.cuoiGt()};
            for (int j = 0; j < nSl; j++) {
                so(row, 2 + j, sl[j], k("so"));
                so(row, 2 + nSl + j, gt[j], k("tien"));
            }
            if (theoKy && i < ky.size()) {
                so(row, 2 + nSl * 2, ky.get(i).phieuNhap(), k("so"));
                so(row, 3 + nSl * 2, ky.get(i).phieuXuat(), k("so"));
            }
        }
        int cuoi = r - 1;
        Row cong = dongCong(s, r, cuoiCot, 1, "Cộng");
        for (int j = 0; j < nSl; j++) {
            boolean ton = !dangLoc && (j == 0 || j == nSl - 1);
            for (int c : new int[]{2 + j, 2 + nSl + j}) {
                String kieu = c < 2 + nSl ? "congSo" : "congTien";
                if (ton && theoKy && cuoi >= dau) f(cong, c, ref(j == 0 ? dau : cuoi, c), k(kieu));
                else f(cong, c, tongCot(dau, cuoi, c, coLoc), k(kieu));
            }
        }
        if (theoKy) {
            for (int c = 2 + nSl * 2; c <= cuoiCot; c++) f(cong, c, tongCot(dau, cuoi, c, coLoc), k("congSo"));
        }
        if (coLoc && !theoKy && cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h + 1, cuoi, 0, cuoiCot));
        return r + 1;
    }

    // ================= Trang 4: Chi tiết giao dịch =================

    private void sheetChiTiet(SXSSFWorkbook sx, ThongTin tin) {
        Sheet s = sx.createSheet("Chi tiết giao dịch");
        //         STT Giờ Số CT Loại Kho KĐến MãSP Tên SKU Lô  Nhập Xuất GV  GTN GTX Diễn giải
        doRongCot(s, 6, 16, 20, 24, 18, 18, 13, 30, 22, 16, 10, 10, 13, 15, 15, 36);
        int cuoiCot = 15;
        int r = dauTrang(s, tin, "CHI TIẾT GIAO DỊCH NHẬP XUẤT KHO", cuoiCot, dongKy, d.dongPhu());
        if (d.chiTiet() == null) {
            o(s, r + 1, 1, "Kỳ dài hơn 1 năm: chọn kỳ ngắn hơn (theo ngày, tuần hoặc tháng) để có chi tiết từng giao dịch.", k("ghiChu"));
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
            BaoCaoNhapXuatService.Nhom n = BaoCaoNhapXuatService.THEO_MA.get(g.nhom());
            so(row, 0, stt++, k("soGiua"));
            ngayGio(row, 1, g.ngay());
            o(row, 2, g.soChungTu(), k("chu"));
            o(row, 3, n == null ? g.nhom() : n.ten(), k("chuXuong"));
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
}
