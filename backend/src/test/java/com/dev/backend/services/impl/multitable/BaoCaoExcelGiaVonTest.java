package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.BaoCaoSanPhamDTO;
import com.dev.backend.dto.response.DoanhThuTongHopDTO;
import com.dev.backend.dto.response.TienThuDTO;
import com.dev.backend.repository.BaoCaoSanPhamRepository;
import com.dev.backend.repository.BaoCaoSanPhamRepository.*;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.CellValue;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tệp Excel báo cáo doanh thu, sản phẩm, tồn kho khi người tải không được xem giá vốn (nhân viên bán hàng — SRS 2.4.1,
 * SRS 4.4 bản 20/11 cho nhân viên bán hàng xuất Excel): không còn chữ, số giá vốn / lợi nhuận / biên lãi / giá trị tồn,
 * các cột sau dồn đúng chỗ và mọi công thức vẫn tính được (không lỗi #REF!). Bản có giá vốn giữ nguyên như trước.
 */
class BaoCaoExcelGiaVonTest {

    static final KhuonExcelBaoCao.ThongTin TIN =
            new KhuonExcelBaoCao.ThongTin("Cửa hàng", "", "", "Tất cả", "Thử", LocalDateTime.now());
    static final List<String> CHU_GIA_VON = List.of("Giá vốn", "giá vốn", "Lợi nhuận", "lợi nhuận", "Biên lãi",
            "Biên lợi nhuận", "Giá trị tồn", "giá trị tồn");

    static BigDecimal bd(long v) {
        return BigDecimal.valueOf(v);
    }

    // ================= Báo cáo doanh thu =================

    static DoanhThuTongHopDTO doanhThu(boolean gv) {
        LocalDate tu = LocalDate.of(2026, 11, 1);
        LocalDate den = LocalDate.of(2026, 11, 30);
        BigDecimal giaVon = gv ? bd(600_000) : null;
        return DoanhThuTongHopDTO.builder()
                .loai("thang").tuNgay(tu).denNgay(den)
                .tuNgayCungKy(tu.minusYears(1)).denNgayCungKy(den.minusYears(1))
                .coGiaVon(gv)
                .kyNay(DoanhThuTongHopDTO.Tong.builder().doanhThu(bd(1_000_000)).tienHang(bd(950_000))
                        .phiVanChuyen(bd(50_000)).giaVon(giaVon).soDon(4).build())
                .cungKy(DoanhThuTongHopDTO.Tong.builder().doanhThu(bd(800_000)).tienHang(bd(800_000))
                        .phiVanChuyen(BigDecimal.ZERO).giaVon(gv ? bd(500_000) : null).soDon(3).build())
                .theoKy(List.of(DoanhThuTongHopDTO.Ky.builder().nhanThoiGian("T11").tuNgay(tu).denNgay(den)
                        .doanhThu(bd(1_000_000)).giaVon(giaVon).soDon(4).doanhThuCungKy(bd(800_000)).build()))
                .theoKenh(List.of(DoanhThuTongHopDTO.Kenh.builder().ma("POS").ten("Bán tại quầy")
                        .doanhThu(bd(1_000_000)).giaVon(giaVon).soDon(4).soDonHoan(1).doanhThuCungKy(bd(800_000)).build()))
                .theoNhanVien(List.of(DoanhThuTongHopDTO.NhanVien.builder().loai(DoanhThuReportService.NV_NHAN_VIEN)
                        .ten("Thu ngân").doanhThu(bd(1_000_000)).giaVon(giaVon).soDon(4).build()))
                .build();
    }

    static TienThuDTO tienThu() {
        return TienThuDTO.builder().tienMat(bd(700_000)).chuyenKhoan(bd(300_000)).hoan(bd(20_000)).soPhieuHoan(1)
                .sanThuHo(BigDecimal.ZERO).soDonSan(0)
                .theoKy(List.of(TienThuDTO.Ky.builder().nhanThoiGian("T11").tienMat(bd(700_000))
                        .chuyenKhoan(bd(300_000)).hoan(bd(20_000)).build()))
                .build();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void doanhThu_congThucTinhDuoc(boolean gv) throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoDoanhThuExcel.tao(doanhThu(gv), tienThu(), TIN, "Tháng 11/2026"))) {
            khongLoiCongThuc(wb);
            assertEquals(gv, coChuGiaVon(wb), "giá vốn trong tệp phải theo quyền xem giá vốn");
        }
    }

    @Test
    void doanhThu_khongGiaVon_cotSauDonSangTrai() throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoDoanhThuExcel.tao(doanhThu(false), tienThu(), TIN, "Tháng 11/2026"))) {
            FormulaEvaluator ev = wb.getCreationHelper().createFormulaEvaluator();
            // Theo kênh: STT, Kênh, Số đơn, Doanh thu, Tỷ trọng, Doanh thu cùng kỳ, Tăng / giảm, Đơn bị hoàn
            Row kenh = dongCo(wb.getSheet("Theo kênh"), 1, "Bán tại quầy");
            assertEquals(800_000, kenh.getCell(5).getNumericCellValue(), 1e-9);
            assertEquals(0.25, ev.evaluate(kenh.getCell(6)).getNumberValue(), 1e-9);
            assertEquals(1, kenh.getCell(7).getNumericCellValue(), 1e-9);
            // Chi tiết theo kỳ: Doanh thu, Số đơn, Doanh thu cùng kỳ, Tăng / giảm, Tiền mặt, Chuyển khoản, Hoàn tiền
            Row ky = dongCo(wb.getSheet("Chi tiết theo kỳ"), 1, "Tháng 11/2026");
            assertEquals(4, ky.getCell(5).getNumericCellValue(), 1e-9);
            assertEquals(800_000, ky.getCell(6).getNumericCellValue(), 1e-9);
            assertEquals(700_000, ky.getCell(8).getNumericCellValue(), 1e-9);
            assertEquals(-20_000, ky.getCell(10).getNumericCellValue(), 1e-9);
            // Tổng hợp: mục 2 là số đơn, mục 3 là giá trị trung bình một đơn = 1 / 2
            Sheet th = wb.getSheet("Tổng hợp");
            Row don = dongCo(th, 1, "Số đơn đã giao (đơn)");
            assertEquals("2", don.getCell(0).getStringCellValue());
            Row tb = dongCo(th, 1, "Giá trị trung bình một đơn (3 = 1 / 2)");
            assertEquals(250_000, ev.evaluate(tb.getCell(2)).getNumberValue(), 1e-9);
        }
    }

    // ================= Báo cáo sản phẩm =================

    static final LocalDate HOM_NAY = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
    static final LocalDate TU = HOM_NAY.minusDays(29); // kỳ 30 ngày

    /** Repository giả (không CSDL): chỉ trả các danh sách được nạp, kỳ trước để trống. */
    static class RepoGia extends BaoCaoSanPhamRepository {
        final List<BienTheDong> bienThe = new ArrayList<>();
        final List<BanBienThe> ban = new ArrayList<>();
        final List<GiaVonBienThe> gv = new ArrayList<>();
        final List<TonBienThe> ton = new ArrayList<>();

        RepoGia() {
            super(null);
        }

        boolean nay(LocalDate tu) {
            return TU.equals(tu);
        }

        @Override public List<BanBienThe> banTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) { return nay(tu) ? ban : List.of(); }
        @Override public List<TraQuay> traQuayTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) { return List.of(); }
        @Override public List<GiaVonBienThe> giaVonTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) { return nay(tu) ? gv : List.of(); }
        @Override public List<TonBienThe> tonTheoBienThe(PhamVi pv) { return ton; }
        @Override public List<GiuBienThe> giuHangTheoBienThe(PhamVi pv, List<Integer> tt) { return List.of(); }
        @Override public List<DangVeBienThe> dangVeTheoBienThe(PhamVi pv) { return List.of(); }
        @Override public List<SoDonSanPham> soDonTheoSanPham(PhamVi pv, LocalDate tu, LocalDate den) { return List.of(); }
        @Override public long tongSoDon(PhamVi pv, LocalDate tu, LocalDate den) { return 0; }
        @Override public List<BanNgay> banTheoNgay(PhamVi pv, LocalDate tu, LocalDate den) { return List.of(); }
        @Override public List<BanKenh> banTheoKenh(PhamVi pv, LocalDate tu, LocalDate den) { return List.of(); }
        @Override public List<NgaySanPham> ngayBanCuoi(PhamVi pv, LocalDate den) { return List.of(); }
        @Override public List<NgaySanPham> ngayNhapDau(PhamVi pv) { return List.of(); }
        @Override public List<BienTheDong> bienThe() { return bienThe; }
        @Override public Map<Integer, String> anhTheoSanPham() { return new HashMap<>(); }
        @Override public List<KenhDong> kenhBan() { return List.of(); }

        void them(int btId, int spId, String ma, Integer trangThaiSp) {
            bienThe.add(new BienTheDong(btId, "SKU-" + btId, new BigDecimal("300000"), 1, "Đen", "#000", "M", 2,
                    spId, ma, "Sản phẩm " + ma, "Cái", trangThaiSp, "Áo", "FC", null));
        }
    }

    static BaoCaoSanPhamDTO sanPham(boolean gv) {
        RepoGia repo = new RepoGia();
        repo.them(1, 10, "A", 1);
        repo.ban.add(new BanBienThe(1, bd(15), bd(4_500_000), BigDecimal.ZERO));
        repo.gv.add(new GiaVonBienThe(1, bd(1_800_000)));
        repo.ton.add(new TonBienThe(1, bd(12), bd(1_440_000)));
        BaoCaoSanPhamDTO bc = new BaoCaoSanPhamService(repo, null)
                .layBaoCao(TU, HOM_NAY, null, null);
        if (!gv) BaoCaoSanPhamService.anGiaVon(bc);
        return bc;
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void sanPham_congThucTinhDuoc(boolean gv) throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoSanPhamExcel.tao(sanPham(gv), TIN))) {
            khongLoiCongThuc(wb);
            assertEquals(gv, coChuGiaVon(wb), "giá vốn trong tệp phải theo quyền xem giá vốn");
        }
    }

    @Test
    void sanPham_khongGiaVon_cotSauDonSangTrai() throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoSanPhamExcel.tao(sanPham(false), TIN))) {
            // Theo sản phẩm: bỏ 4 cột (giá vốn, lợi nhuận, biên lãi, giá trị tồn) nên Đủ bán từ cột 22 về 18
            Row a = dongCo(wb.getSheet("Theo sản phẩm"), 3, "Sản phẩm A");
            assertEquals("Đủ bán (ngày)", dongCo(wb.getSheet("Theo sản phẩm"), 18, "Đủ bán (ngày)").getCell(18).getStringCellValue());
            assertEquals(CellType.NUMERIC, a.getCell(18).getCellType());
            // Theo mã SKU: bỏ 3 cột nên Đủ bán từ cột 15 về 12
            Row sku = dongCo(wb.getSheet("Theo mã SKU"), 3, "SKU-1");
            assertEquals(CellType.NUMERIC, sku.getCell(12).getCellType());
            // Tổng hợp: số thứ tự đánh lại, ghi chú trỏ đúng mục hoàn trả
            Sheet th = wb.getSheet("Tổng hợp");
            assertEquals("5", dongCo(th, 1, "Số lượng bị hoàn trả").getCell(0).getStringCellValue());
            dongCo(th, 1, "Tỷ lệ hoàn (6 = 5 / (1 + 5))");
        }
    }

    // ================= Báo cáo tồn kho =================

    static TonKhoProjection ton(int khoId, String tenKho, long onHand, long giaTri, Integer min) {
        Map<String, Object> v = new java.util.HashMap<>();
        v.put("getBienTheId", 1);
        v.put("getMaSku", "SKU-1");
        v.put("getMaSanPham", "SP-1");
        v.put("getTenSanPham", "Áo");
        v.put("getTenMau", "Đen");
        v.put("getMaSize", "M");
        v.put("getTenChatLieu", "Cotton");
        v.put("getMucTonToiThieu", min);
        v.put("getKhoId", khoId);
        v.put("getTenKho", tenKho);
        v.put("getOnHand", bd(onHand));
        v.put("getIncoming", bd(2));
        v.put("getOutgoing", bd(1));
        v.put("getFreeToUse", bd(onHand - 1));
        v.put("getTongGiaTri", bd(giaTri));
        return (TonKhoProjection) Proxy.newProxyInstance(TonKhoProjection.class.getClassLoader(),
                new Class<?>[]{TonKhoProjection.class}, (p, m, a) -> v.get(m.getName()));
    }

    static List<BaoCaoTonKhoService.Dong> dongTon() {
        List<BaoCaoTonKhoService.Dong> ds = new ArrayList<>();
        ds.add(new BaoCaoTonKhoService.Dong(ton(1, "Kho tổng", 10, 1_200_000, 3), BaoCaoTonKhoService.DU_HANG));
        ds.add(new BaoCaoTonKhoService.Dong(ton(2, "Cửa hàng", 2, 240_000, 5), BaoCaoTonKhoService.SAP_HET));
        return ds;
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void tonKho_congThucTinhDuoc(boolean gv) throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoTonKhoExcel.tao(dongTon(), Set.of(), "Tình trạng: Tất cả", TIN, gv))) {
            khongLoiCongThuc(wb);
            assertEquals(gv, coChuGiaVon(wb), "giá vốn trong tệp phải theo quyền xem giá vốn");
        }
    }

    @Test
    void tonKho_khongGiaVon_cotSauDonSangTrai() throws Exception {
        try (XSSFWorkbook wb = mo(BaoCaoTonKhoExcel.tao(dongTon(), Set.of(), "Tình trạng: Tất cả", TIN, false))) {
            // Tổng hợp I: STT, Kho, Số mã, Tồn thực tế, Đang về, Đang xuất, Khả dụng
            Row kho = dongCo(wb.getSheet("Tổng hợp"), 1, "Kho tổng");
            assertEquals(2, kho.getCell(4).getNumericCellValue(), 1e-9);
            assertEquals(9, kho.getCell(6).getNumericCellValue(), 1e-9);
            // Chi tiết: Tình trạng lùi từ cột 15 về 13
            Row ct = dongCo(wb.getSheet("Chi tiết"), 7, "Cửa hàng");
            assertEquals(5, ct.getCell(12).getNumericCellValue(), 1e-9);
            assertEquals(BaoCaoTonKhoService.TEN_TINH_TRANG.get(BaoCaoTonKhoService.SAP_HET), ct.getCell(13).getStringCellValue());
            assertNull(ct.getCell(14));
        }
    }

    // ================= Dùng chung =================

    static XSSFWorkbook mo(byte[] tep) throws Exception {
        return new XSSFWorkbook(new ByteArrayInputStream(tep));
    }

    /** Tính lại mọi công thức: cột bị bỏ mà công thức còn trỏ sai chỗ thì ra lỗi (#REF!, #VALUE!...). */
    static void khongLoiCongThuc(XSSFWorkbook wb) {
        FormulaEvaluator ev = wb.getCreationHelper().createFormulaEvaluator();
        for (Sheet s : wb) {
            for (Row r : s) {
                for (Cell c : r) {
                    if (c.getCellType() != CellType.FORMULA) continue;
                    CellValue v = ev.evaluate(c);
                    assertNotEquals(CellType.ERROR, v.getCellType(),
                            s.getSheetName() + "!" + c.getAddress() + " = " + c.getCellFormula());
                }
            }
        }
    }

    static boolean coChuGiaVon(XSSFWorkbook wb) {
        for (Sheet s : wb) {
            for (Row r : s) {
                for (Cell c : r) {
                    if (c.getCellType() != CellType.STRING) continue;
                    String chu = c.getStringCellValue();
                    if (CHU_GIA_VON.stream().anyMatch(chu::contains)) return true;
                }
            }
        }
        return false;
    }

    static Row dongCo(Sheet s, int cot, String chu) {
        for (Row r : s) {
            Cell c = r.getCell(cot);
            if (c != null && c.getCellType() == CellType.STRING && chu.equals(c.getStringCellValue())) return r;
        }
        fail("Không thấy dòng " + chu + " ở cột " + cot + " trang " + s.getSheetName());
        return null;
    }
}
