package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.DoanhThuTongHopDTO;
import com.dev.backend.dto.response.TienThuDTO;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFFormulaEvaluator;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tệp Excel của Báo cáo doanh thu, trình bày như báo cáo quản trị của kế toán:
 * - Đầu trang: tên đơn vị, địa chỉ, mã số thuế; tên báo cáo; kỳ báo cáo và cùng kỳ năm trước; phạm vi; đơn vị tính.
 * - Số là ô số thật (cộng, lọc, vẽ biểu đồ được), định dạng #,##0, số âm trong ngoặc, 0 hiện "-"; tỷ lệ dạng %.
 *   Dòng chênh lệch, tỷ lệ, biên lãi và dòng cộng là công thức (đã tính sẵn giá trị để xem trước không cần mở Excel).
 * - Bảng: tiêu đề cột in đậm có nền, kẻ khung mảnh; cố định dòng tiêu đề; lọc ở bảng chi tiết.
 * - In: A4, vừa một trang theo chiều ngang, lặp dòng tiêu đề bảng mỗi trang, chân trang "Trang x/y".
 * - Cuối trang tổng hợp: ngày lập, Người lập biểu / Kế toán trưởng / Giám đốc.
 * Phông Times New Roman (quen thuộc với chứng từ, sổ sách kế toán).
 */
public final class BaoCaoDoanhThuExcel {

    /** Thông tin đầu trang và người lập. */
    public record ThongTin(String tenDonVi, String diaChi, String maSoThue, String phamVi, String tenKy,
                           String nguoiLap, LocalDateTime lapLuc) {
    }

    private static final String PHONG = "Times New Roman";
    private static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String DD_TIEN = "#,##0;(#,##0);\"-\"";
    private static final String DD_TY_LE = "0.0%;(0.0%);\"-\"";
    private static final String DD_SO = "#,##0;(#,##0);\"-\"";

    private final XSSFWorkbook wb = new XSSFWorkbook();
    private final Map<String, CellStyle> kieu = new HashMap<>();

    private BaoCaoDoanhThuExcel() {
        Font macDinh = wb.getFontAt(0);
        macDinh.setFontName(PHONG);
        macDinh.setFontHeightInPoints((short) 11);
    }

    public static byte[] tao(DoanhThuTongHopDTO dt, TienThuDTO tt, ThongTin tin) {
        BaoCaoDoanhThuExcel x = new BaoCaoDoanhThuExcel();
        try (XSSFWorkbook wb = x.wb) {
            x.sheetTongHop(dt, tt, tin);
            x.sheetChiTiet(dt, tt, tin);
            wb.getProperties().getCoreProperties().setTitle("Báo cáo doanh thu");
            wb.getProperties().getCoreProperties().setCreator(tin.tenDonVi() == null ? "FCentric" : tin.tenDonVi());
            // Lưu sẵn kết quả công thức: trình xem trước (điện thoại, thư) không tự tính vẫn thấy số
            XSSFFormulaEvaluator.evaluateAllFormulaCells(wb);
            wb.setForceFormulaRecalculation(true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Không tạo được tệp Excel", e);
        }
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(DoanhThuTongHopDTO dt, TienThuDTO tt, ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        int[] rong = {6, 46, 19, 19, 19, 15};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        s.setDisplayGridlines(false);
        int r = dauTrang(s, tin, "BÁO CÁO DOANH THU", 5,
                "Kỳ báo cáo: " + tin.tenKy() + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
                "So với cùng kỳ năm trước: " + khoang(dt.getTuNgayCungKy(), dt.getDenNgayCungKy()));

        // --- I. Kết quả kinh doanh ---
        o(s, r, 0, "I. KẾT QUẢ KINH DOANH (doanh thu theo ngày giao hàng)", k("muc"));
        r++;
        int dauBang = r;
        String[] cot = {"STT", "Chỉ tiêu", "Kỳ này", "Cùng kỳ năm trước", "Chênh lệch", "Tăng / giảm"};
        Row h = s.createRow(r++);
        h.setHeightInPoints(30);
        for (int i = 0; i < cot.length; i++) o(h, i, cot[i], k("tieuDeCot"));
        DoanhThuTongHopDTO.Tong a = dt.getKyNay();
        DoanhThuTongHopDTO.Tong b = dt.getCungKy();
        int rDt = r;
        dongSoSanh(s, r++, "1", "Doanh thu bán hàng", a.getDoanhThu(), b.getDoanhThu(), true);
        dongSoSanh(s, r++, "", "   Trong đó: tiền hàng", a.getTienHang(), b.getTienHang(), false);
        dongSoSanh(s, r++, "", "   Trong đó: phí vận chuyển thu của khách", a.getPhiVanChuyen(), b.getPhiVanChuyen(), false);
        int rGv = r;
        dongSoSanh(s, r++, "2", "Giá vốn hàng bán", a.getGiaVon(), b.getGiaVon(), true);
        int rLn = r;
        Row ln = s.createRow(r++);
        o(ln, 0, "3", k("stt"));
        o(ln, 1, "Lợi nhuận gộp (3 = 1 − 2)", k("chuDam"));
        f(ln, 2, ref(rDt, 2) + "-" + ref(rGv, 2), k("tienDam"));
        f(ln, 3, ref(rDt, 3) + "-" + ref(rGv, 3), k("tienDam"));
        f(ln, 4, ref(rLn, 2) + "-" + ref(rLn, 3), k("tienDam"));
        f(ln, 5, "IF(" + ref(rLn, 3) + "=0,\"\"," + ref(rLn, 4) + "/ABS(" + ref(rLn, 3) + "))", k("tyLe"));
        Row bien = s.createRow(r);
        o(bien, 0, "4", k("stt"));
        o(bien, 1, "Biên lợi nhuận gộp (4 = 3 / 1)", k("chu"));
        f(bien, 2, "IF(" + ref(rDt, 2) + "=0,\"\"," + ref(rLn, 2) + "/" + ref(rDt, 2) + ")", k("tyLe"));
        f(bien, 3, "IF(" + ref(rDt, 3) + "=0,\"\"," + ref(rLn, 3) + "/" + ref(rDt, 3) + ")", k("tyLe"));
        f(bien, 4, "IF(OR(" + ref(r, 2) + "=\"\"," + ref(r, 3) + "=\"\"),\"\"," + ref(r, 2) + "-" + ref(r, 3) + ")", k("tyLe"));
        o(bien, 5, "điểm %", k("ghiChu"));
        r++;
        int rDon = r;
        Row don = s.createRow(r++);
        o(don, 0, "5", k("stt"));
        o(don, 1, "Số đơn đã giao (đơn)", k("chu"));
        so(don, 2, a.getSoDon(), k("so"));
        so(don, 3, b.getSoDon(), k("so"));
        f(don, 4, ref(rDon, 2) + "-" + ref(rDon, 3), k("so"));
        f(don, 5, "IF(" + ref(rDon, 3) + "=0,\"\"," + ref(rDon, 4) + "/" + ref(rDon, 3) + ")", k("tyLe"));
        Row tb = s.createRow(r);
        o(tb, 0, "6", k("stt"));
        o(tb, 1, "Giá trị trung bình một đơn (6 = 1 / 5)", k("chu"));
        f(tb, 2, "IF(" + ref(rDon, 2) + "=0,\"\"," + ref(rDt, 2) + "/" + ref(rDon, 2) + ")", k("tien"));
        f(tb, 3, "IF(" + ref(rDon, 3) + "=0,\"\"," + ref(rDt, 3) + "/" + ref(rDon, 3) + ")", k("tien"));
        f(tb, 4, "IF(OR(" + ref(r, 2) + "=\"\"," + ref(r, 3) + "=\"\"),\"\"," + ref(r, 2) + "-" + ref(r, 3) + ")", k("tien"));
        f(tb, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 3) + "=0),\"\"," + ref(r, 4) + "/" + ref(r, 3) + ")", k("tyLe"));
        r += 2;

        // --- II. Tiền thu ---
        if (tt != null) {
            o(s, r, 0, "II. TIỀN THU TRONG KỲ (theo ngày thu tiền)", k("muc"));
            r++;
            Row h2 = s.createRow(r++);
            h2.setHeightInPoints(22);
            String[] cot2 = {"STT", "Chỉ tiêu", "Số tiền", "Ghi chú", "", ""};
            for (int i = 0; i < cot2.length; i++) o(h2, i, cot2[i], k("tieuDeCot"));
            gop(s, h2.getRowNum(), 3, 5);
            int rTm = r;
            dongTien(s, r++, "1", "Tiền mặt", null, true, "");
            int rTm1 = r;
            dongTien(s, r++, "", "   Bán tại quầy", tt.getTienMatTaiQuay(), false, "Gồm phần tiền mặt khách trả trước khi quét QR");
            dongTien(s, r++, "", "   Đơn bán thường", tt.getTienMatDonThuong(), false, "Theo phiếu thu");
            f(s.getRow(rTm), 2, "SUM(" + ref(rTm1, 2) + ":" + ref(rTm1 + 1, 2) + ")", k("tienDam"));
            int rCk = r;
            dongTien(s, r++, "2", "Chuyển khoản", null, true, "");
            int rCk1 = r;
            dongTien(s, r++, "", "   QR payOS tại quầy", tt.getQrPayos(), false, "");
            dongTien(s, r++, "", "   Chuyển khoản ghi tay (đơn bán thường)", tt.getChuyenKhoanGhiTay(), false, "Theo mã giao dịch trên sao kê");
            f(s.getRow(rCk), 2, "SUM(" + ref(rCk1, 2) + ":" + ref(rCk1 + 1, 2) + ")", k("tienDam"));
            int rHoan = r;
            dongTien(s, r++, "3", "Hoàn tiền cho khách", tt.getHoan() == null ? null : tt.getHoan().negate(), true,
                    tt.getSoPhieuHoan() + " phiếu hoàn");
            Row rong2 = s.createRow(r);
            o(rong2, 0, "4", k("stt"));
            o(rong2, 1, "Thu ròng (4 = 1 + 2 + 3)", k("chuDam"));
            f(rong2, 2, ref(rTm, 2) + "+" + ref(rCk, 2) + "+" + ref(rHoan, 2), k("tienDam"));
            ghiChu(s, r++, "");
            dongTien(s, r++, "5", "Sàn thu hộ (đơn sàn đã giao)", tt.getSanThuHo(), false,
                    tt.getSoDonSan() + " đơn — đối soát với sàn, không gồm ở mục 4");
            dongTien(s, r++, "6", "Còn phải thu (tới ngày lập báo cáo)", tt.getConPhaiThu(), false,
                    tt.getSoDonConPhaiThu() + " đơn bán thường chưa thu đủ");
            if (tt.isTheoKhoPhuTrach() || dt.isTheoKhoPhuTrach()) {
                o(s, r++, 1, "Chỉ tính các cửa hàng người lập phụ trách.", k("ghiChu"));
            }
        }
        r++;
        chuKy(s, r, tin);

        s.createFreezePane(0, dauBang + 1);
        inTrang(s, false, dauBang, dauBang);
    }

    private void dongSoSanh(Sheet s, int r, String stt, String ten, BigDecimal nay, BigDecimal truoc, boolean dam) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k(dam ? "chuDam" : "chu"));
        so(row, 2, nay, k(dam ? "tienDam" : "tien"));
        so(row, 3, truoc, k(dam ? "tienDam" : "tien"));
        f(row, 4, ref(r, 2) + "-" + ref(r, 3), k(dam ? "tienDam" : "tien"));
        f(row, 5, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 4) + "/ABS(" + ref(r, 3) + "))", k("tyLe"));
    }

    private void dongTien(Sheet s, int r, String stt, String ten, BigDecimal soTien, boolean dam, String ghi) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k(dam ? "chuDam" : "chu"));
        if (soTien != null) so(row, 2, soTien, k(dam ? "tienDam" : "tien"));
        else o(row, 2, "", k("tienDam"));
        ghiChu(s, r, ghi);
    }

    private void ghiChu(Sheet s, int r, String ghi) {
        Row row = s.getRow(r);
        o(row, 3, ghi, k("ghiChuO"));
        o(row, 4, "", k("ghiChuO"));
        o(row, 5, "", k("ghiChuO"));
        gop(s, r, 3, 5);
    }

    // ================= Trang 2: Chi tiết theo kỳ =================

    private void sheetChiTiet(DoanhThuTongHopDTO dt, TienThuDTO tt, ThongTin tin) {
        Sheet s = wb.createSheet("Chi tiết theo kỳ");
        int[] rong = {6, 16, 12, 12, 17, 17, 17, 10, 9, 17, 11, 17, 17, 15};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        String don = switch (dt.getLoai()) {
            case "ngay" -> "NGÀY";
            case "nam" -> "NĂM";
            default -> "THÁNG";
        };
        int r = dauTrang(s, tin, "CHI TIẾT DOANH THU VÀ TIỀN THU THEO " + don, 13,
                "Kỳ báo cáo: " + tin.tenKy() + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
                "Doanh thu theo ngày giao hàng; tiền thu theo ngày thu tiền");

        // Tiêu đề hai tầng: nhóm cột rồi tên cột
        int h1 = r;
        Row nhom = s.createRow(r++);
        Row ten = s.createRow(r++);
        ten.setHeightInPoints(30);
        String[] tenCot = {"STT", "Kỳ", "Từ ngày", "Đến ngày", "Doanh thu", "Giá vốn", "Lợi nhuận gộp", "Biên lãi",
                "Số đơn", "Doanh thu", "Tăng / giảm", "Tiền mặt", "Chuyển khoản", "Hoàn tiền"};
        for (int i = 0; i < tenCot.length; i++) {
            o(nhom, i, "", k("tieuDeCot"));
            o(ten, i, tenCot[i], k("tieuDeCot"));
        }
        for (int i = 0; i <= 3; i++) {
            o(nhom, i, tenCot[i], k("tieuDeCot"));
            s.addMergedRegion(new CellRangeAddress(h1, h1 + 1, i, i));
        }
        o(nhom, 4, "Kỳ này", k("tieuDeCot"));
        gop(s, h1, 4, 8);
        o(nhom, 9, "Cùng kỳ năm trước", k("tieuDeCot"));
        gop(s, h1, 9, 10);
        o(nhom, 11, "Tiền thu", k("tieuDeCot"));
        gop(s, h1, 11, 13);

        Map<String, TienThuDTO.Ky> thu = new HashMap<>();
        if (tt != null && tt.getTheoKy() != null) tt.getTheoKy().forEach(t -> thu.put(t.getNhanThoiGian(), t));
        List<DoanhThuTongHopDTO.Ky> ds = dt.getTheoKy().stream().filter(k -> !k.isChuaToi()).toList();
        int dau = r;
        int stt = 1;
        for (DoanhThuTongHopDTO.Ky ky : ds) {
            Row row = s.createRow(r);
            o(row, 0, String.valueOf(stt++), k("stt"));
            o(row, 1, tenKy(dt.getLoai(), ky), k("chu"));
            ngay(row, 2, ky.getTuNgay());
            ngay(row, 3, ky.getDenNgay());
            so(row, 4, ky.getDoanhThu(), k("tien"));
            so(row, 5, ky.getGiaVon(), k("tien"));
            f(row, 6, ref(r, 4) + "-" + ref(r, 5), k("tien"));
            f(row, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("tyLe"));
            so(row, 8, ky.getSoDon(), k("so"));
            so(row, 9, ky.getDoanhThuCungKy(), k("tien"));
            f(row, 10, "IF(" + ref(r, 9) + "=0,\"\",(" + ref(r, 4) + "-" + ref(r, 9) + ")/" + ref(r, 9) + ")", k("tyLe"));
            TienThuDTO.Ky t = thu.get(ky.getNhanThoiGian());
            so(row, 11, t == null ? BigDecimal.ZERO : t.getTienMat(), k("tien"));
            so(row, 12, t == null ? BigDecimal.ZERO : t.getChuyenKhoan(), k("tien"));
            so(row, 13, t == null ? BigDecimal.ZERO : t.getHoan().negate(), k("tien"));
            r++;
        }
        int cuoi = r - 1;
        Row cong = s.createRow(r);
        o(cong, 0, "", k("congChu"));
        o(cong, 1, "Cộng", k("congChu"));
        o(cong, 2, "", k("congChu"));
        o(cong, 3, "", k("congChu"));
        for (int c : new int[]{4, 5, 6, 8, 9, 11, 12, 13}) {
            f(cong, c, ds.isEmpty() ? "0" : "SUM(" + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c == 8 ? "congSo" : "congTien"));
        }
        f(cong, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("congTyLe"));
        f(cong, 10, "IF(" + ref(r, 9) + "=0,\"\",(" + ref(r, 4) + "-" + ref(r, 9) + ")/" + ref(r, 9) + ")", k("congTyLe"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Tăng / giảm so doanh thu kỳ này với cùng kỳ năm trước. Kỳ đang chạy so với đúng số ngày đã qua của cùng kỳ năm trước.", k("ghiChu"));
        o(s, r, 1, "Lập lúc " + tin.lapLuc().format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
                + (tin.nguoiLap() == null ? "" : " — " + tin.nguoiLap()), k("ghiChu"));

        s.createFreezePane(2, h1 + 2);
        if (!ds.isEmpty()) s.setAutoFilter(new CellRangeAddress(h1 + 1, cuoi, 0, 13));
        inTrang(s, true, h1, h1 + 1);
    }

    private static String tenKy(String loai, DoanhThuTongHopDTO.Ky ky) {
        return switch (loai) {
            case "ngay" -> ky.getTuNgay().format(NGAY);
            case "nam" -> "Năm " + ky.getTuNgay().getYear();
            default -> "Tháng " + ky.getTuNgay().getMonthValue() + "/" + ky.getTuNgay().getYear();
        };
    }

    // ================= Dùng chung =================

    /** Đầu trang: đơn vị (trái), tên báo cáo, kỳ, dòng phụ, phạm vi, đơn vị tính (phải). Trả dòng kế tiếp. */
    private int dauTrang(Sheet s, ThongTin tin, String tieuDe, int cotCuoi, String dongKy, String dongPhu) {
        int r = 0;
        o(s, r++, 0, "Đơn vị: " + rong(tin.tenDonVi(), "[Tên đơn vị]"), k("donVi"));
        // Hồ sơ cửa hàng chưa điền thì bỏ dòng (không để trơ nhãn); giữ đủ 3 dòng để tiêu đề luôn ở cùng chỗ
        o(s, r++, 0, rong(tin.diaChi(), "").isEmpty() ? "" : "Địa chỉ: " + tin.diaChi().trim(), k("chuNho"));
        o(s, r++, 0, rong(tin.maSoThue(), "").isEmpty() ? "" : "Mã số thuế: " + tin.maSoThue().trim(), k("chuNho"));
        r++;
        Row t = s.createRow(r);
        t.setHeightInPoints(24);
        o(t, 0, tieuDe, k("tieuDe"));
        gop(s, r++, 0, cotCuoi);
        o(s, r, 0, dongKy, k("giuaNghieng"));
        gop(s, r++, 0, cotCuoi);
        o(s, r, 0, dongPhu, k("giuaNghieng"));
        gop(s, r++, 0, cotCuoi);
        o(s, r, 0, "Phạm vi: " + tin.phamVi(), k("giua"));
        gop(s, r++, 0, cotCuoi);
        o(s, r++, cotCuoi, "Đơn vị tính: đồng", k("dvt"));
        return r;
    }

    private void chuKy(Sheet s, int r, ThongTin tin) {
        LocalDateTime l = tin.lapLuc();
        o(s, r, 3, "Ngày " + String.format("%02d", l.getDayOfMonth()) + " tháng " + String.format("%02d", l.getMonthValue())
                + " năm " + l.getYear(), k("giuaNghieng"));
        gop(s, r++, 3, 5);
        Row vt = s.createRow(r++);
        o(vt, 1, "Người lập biểu", k("chuKy"));
        o(vt, 2, "Kế toán trưởng", k("chuKy"));
        gop(s, vt.getRowNum(), 2, 3);
        o(vt, 4, "Giám đốc", k("chuKy"));
        gop(s, vt.getRowNum(), 4, 5);
        Row ky = s.createRow(r);
        o(ky, 1, "(Ký, họ tên)", k("giuaNghieng"));
        o(ky, 2, "(Ký, họ tên)", k("giuaNghieng"));
        gop(s, r, 2, 3);
        o(ky, 4, "(Ký, họ tên, đóng dấu)", k("giuaNghieng"));
        gop(s, r, 4, 5);
        r += 5;
        if (tin.nguoiLap() != null) o(s, r, 1, tin.nguoiLap(), k("chuKy"));
    }

    /** A4, vừa một trang theo chiều ngang, lặp dòng tiêu đề bảng, chân trang "Trang x/y". */
    private static void inTrang(Sheet s, boolean ngang, int lapTu, int lapDen) {
        PrintSetup p = s.getPrintSetup();
        p.setPaperSize(PrintSetup.A4_PAPERSIZE);
        p.setLandscape(ngang);
        p.setFitWidth((short) 1);
        p.setFitHeight((short) 0);
        s.setFitToPage(true);
        s.setAutobreaks(true);
        s.setHorizontallyCenter(true);
        s.setMargin(Sheet.LeftMargin, 0.5);
        s.setMargin(Sheet.RightMargin, 0.5);
        s.setMargin(Sheet.TopMargin, 0.6);
        s.setMargin(Sheet.BottomMargin, 0.6);
        s.setRepeatingRows(new CellRangeAddress(lapTu, lapDen, -1, -1));
        s.getFooter().setCenter("Trang &P/&N");
    }

    private static String khoang(LocalDate tu, LocalDate den) {
        return "từ " + tu.format(NGAY) + " đến " + den.format(NGAY);
    }

    private static String rong(String s, String macDinh) {
        return s == null || s.isBlank() ? macDinh : s.trim();
    }

    private static String ref(int r, int c) {
        return new CellReference(r, c).formatAsString();
    }

    private static void gop(Sheet s, int r, int c1, int c2) {
        s.addMergedRegion(new CellRangeAddress(r, r, c1, c2));
    }

    private static Cell o(Row row, int c, String v, CellStyle st) {
        Cell cell = row.getCell(c) == null ? row.createCell(c) : row.getCell(c);
        cell.setCellValue(v);
        cell.setCellStyle(st);
        return cell;
    }

    private static Cell o(Sheet s, int r, int c, String v, CellStyle st) {
        Row row = s.getRow(r) == null ? s.createRow(r) : s.getRow(r);
        return o(row, c, v, st);
    }

    private static void so(Row row, int c, BigDecimal v, CellStyle st) {
        Cell cell = row.createCell(c);
        cell.setCellValue(v == null ? 0 : v.doubleValue());
        cell.setCellStyle(st);
    }

    private static void so(Row row, int c, long v, CellStyle st) {
        Cell cell = row.createCell(c);
        cell.setCellValue(v);
        cell.setCellStyle(st);
    }

    private static void f(Row row, int c, String congThuc, CellStyle st) {
        Cell cell = row.createCell(c);
        cell.setCellFormula(congThuc);
        cell.setCellStyle(st);
    }

    private void ngay(Row row, int c, LocalDate d) {
        Cell cell = row.createCell(c);
        if (d != null) cell.setCellValue(d);
        cell.setCellStyle(k("ngay"));
    }

    // ================= Kiểu ô (tạo một lần mỗi kiểu) =================

    private CellStyle k(String ten) {
        return kieu.computeIfAbsent(ten, this::taoKieu);
    }

    private CellStyle taoKieu(String ten) {
        CellStyle st = wb.createCellStyle();
        DataFormat df = wb.createDataFormat();
        boolean khung = switch (ten) {
            case "tieuDeCot", "stt", "chu", "chuDam", "tien", "tienDam", "tyLe", "so", "ngay", "ghiChuO",
                 "congChu", "congTien", "congSo", "congTyLe" -> true;
            default -> false;
        };
        if (khung) {
            st.setBorderTop(BorderStyle.THIN);
            st.setBorderBottom(BorderStyle.THIN);
            st.setBorderLeft(BorderStyle.THIN);
            st.setBorderRight(BorderStyle.THIN);
            st.setVerticalAlignment(VerticalAlignment.CENTER);
        }
        switch (ten) {
            case "donVi" -> st.setFont(font(true, false, 11));
            case "chuNho" -> st.setFont(font(false, false, 10));
            case "tieuDe" -> {
                st.setFont(font(true, false, 15));
                st.setAlignment(HorizontalAlignment.CENTER);
                st.setVerticalAlignment(VerticalAlignment.CENTER);
            }
            case "giua" -> st.setAlignment(HorizontalAlignment.CENTER);
            case "giuaNghieng" -> {
                st.setFont(font(false, true, 11));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "dvt" -> {
                st.setFont(font(false, true, 10));
                st.setAlignment(HorizontalAlignment.RIGHT);
            }
            case "muc" -> st.setFont(font(true, false, 11));
            case "chuKy" -> {
                st.setFont(font(true, false, 11));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "ghiChu" -> st.setFont(font(false, true, 10));
            case "tieuDeCot" -> {
                st.setFont(font(true, false, 11));
                st.setAlignment(HorizontalAlignment.CENTER);
                st.setWrapText(true);
                st.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
                st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            case "stt" -> st.setAlignment(HorizontalAlignment.CENTER);
            case "chuDam" -> st.setFont(font(true, false, 11));
            case "tien" -> st.setDataFormat(df.getFormat(DD_TIEN));
            case "tienDam" -> {
                st.setDataFormat(df.getFormat(DD_TIEN));
                st.setFont(font(true, false, 11));
            }
            case "tyLe" -> st.setDataFormat(df.getFormat(DD_TY_LE));
            case "so" -> st.setDataFormat(df.getFormat(DD_SO));
            case "ngay" -> {
                st.setDataFormat(df.getFormat("dd/mm/yyyy"));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "ghiChuO" -> {
                st.setFont(font(false, true, 10));
                st.setWrapText(true);
            }
            case "congChu", "congTien", "congSo", "congTyLe" -> {
                st.setFont(font(true, false, 11));
                st.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
                st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                if (ten.equals("congTien")) st.setDataFormat(df.getFormat(DD_TIEN));
                if (ten.equals("congSo")) st.setDataFormat(df.getFormat(DD_SO));
                if (ten.equals("congTyLe")) st.setDataFormat(df.getFormat(DD_TY_LE));
            }
            default -> { }
        }
        return st;
    }

    private Font font(boolean dam, boolean nghieng, int co) {
        Font f = wb.createFont();
        f.setFontName(PHONG);
        f.setFontHeightInPoints((short) co);
        f.setBold(dam);
        f.setItalic(nghieng);
        return f;
    }
}
