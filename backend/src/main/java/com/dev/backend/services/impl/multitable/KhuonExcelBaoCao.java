package com.dev.backend.services.impl.multitable;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
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
import java.util.Map;
import java.util.function.Consumer;
import com.dev.backend.i18n.ThongDiep;

/**
 * Khuôn chung của các tệp Excel báo cáo (doanh thu, sản phẩm, tồn kho, nhập xuất, khách hàng), trình bày như báo cáo
 * quản trị của kế toán:
 * - Đầu trang: tên đơn vị, địa chỉ, mã số thuế; tên báo cáo; dòng kỳ, dòng phụ; phạm vi; đơn vị tính.
 * - Số là ô số thật (cộng, lọc, vẽ biểu đồ được), #,##0, số âm trong ngoặc, 0 hiện "-"; tỷ lệ dạng %.
 * - Bảng: tiêu đề cột in đậm có nền, kẻ khung mảnh. Dòng Cộng của bảng chi tiết dùng SUBTOTAL để tự tính lại khi lọc.
 * - In: A4, vừa chiều ngang một trang, lặp dòng tiêu đề bảng mỗi trang, chân trang "Trang x/y".
 * - Công thức được tính sẵn trước khi ghi tệp: trình xem trước (điện thoại, thư) không tự tính vẫn thấy số.
 * Phông Times New Roman như chứng từ, sổ sách kế toán.
 * Lớp con dựng các trang tính rồi gọi {@link #xuat(String, ThongTin)}; mỗi tệp dùng một đối tượng mới.
 * Trang có thể rất dài (chi tiết giao dịch, tồn từng mã, danh sách khách) dựng sau cùng qua
 * {@link #xuat(String, ThongTin, Consumer)}: ghi dần ra đĩa (SXSSF), bộ nhớ không tăng theo số dòng.
 */
abstract class KhuonExcelBaoCao {

    /** Thông tin đầu trang và người lập. */
    public record ThongTin(String tenDonVi, String diaChi, String maSoThue, String phamVi, String nguoiLap,
                           LocalDateTime lapLuc) {
    }

    protected static final String PHONG = "Times New Roman";
    protected static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    protected static final String DD_TIEN = "#,##0;(#,##0);\"-\"";
    protected static final String DD_TY_LE = "0.0%;(0.0%);\"-\"";
    protected static final String DD_SO = "#,##0;(#,##0);\"-\"";
    protected static final String DD_NGAY_BAN = "#,##0.0;(#,##0.0);\"0\"";

    protected final XSSFWorkbook wb = new XSSFWorkbook();
    private final Map<String, CellStyle> kieu = new HashMap<>();
    private Font thuong;

    protected KhuonExcelBaoCao() {
        Font macDinh = wb.getFontAt(0);
        macDinh.setFontName(PHONG);
        macDinh.setFontHeightInPoints((short) 11);
    }

    /** Tính sẵn công thức, ghi tệp ra mảng byte rồi đóng sổ. */
    protected byte[] xuat(String tieuDeTep, ThongTin tin) {
        return xuat(tieuDeTep, tin, null);
    }

    /**
     * Như trên, kèm các trang dài dựng bằng trangDai trên sổ ghi dần (SXSSF, giữ 200 dòng trong bộ nhớ): các trang đã dựng
     * trước đó được tính sẵn công thức như thường; ở trang ghi dần, công thức ghi kèm giá trị tính trong Java (fCo) vì
     * không tính lại được dòng đã ghi ra đĩa. Trang ghi dần chỉ ghi tới, không quay lại dòng đã ghi quá 200 dòng.
     */
    protected byte[] xuat(String tieuDeTep, ThongTin tin, Consumer<SXSSFWorkbook> trangDai) {
        if (trangDai == null) return ghi(tieuDeTep, tin, null);
        XSSFFormulaEvaluator.evaluateAllFormulaCells(wb);
        SXSSFWorkbook sx = new SXSSFWorkbook(wb, 200);
        sx.setCompressTempFiles(true);
        try {
            trangDai.accept(sx);
            return ghi(tieuDeTep, tin, sx);
        } finally {
            sx.dispose();
        }
    }

    private byte[] ghi(String tieuDeTep, ThongTin tin, SXSSFWorkbook sx) {
        try (XSSFWorkbook w = wb) {
            w.getProperties().getCoreProperties().setTitle(tieuDeTep);
            w.getProperties().getCoreProperties().setCreator(tin.tenDonVi() == null ? "FCentric" : tin.tenDonVi());
            if (sx == null) XSSFFormulaEvaluator.evaluateAllFormulaCells(w);
            w.setForceFormulaRecalculation(true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (sx == null) w.write(out); else sx.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            // Giữ kiểu UncheckedIOException; câu tiếng Việt lấy từ kho câu để bộ xử lý lỗi chung dịch được theo câu
            throw new UncheckedIOException(ThongDiep.vi("khoVanHanh.khongTaoDuocTepExcel"), e);
        }
    }

    // ================= Khung trang =================

    protected static void doRongCot(Sheet s, int... rong) {
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
    }

    /** Một dòng tiêu đề cột (in đậm, có nền, xuống dòng). */
    protected void tieuDe(Sheet s, int r, float cao, String... cot) {
        Row h = s.createRow(r);
        h.setHeightInPoints(cao);
        for (int i = 0; i < cot.length; i++) o(h, i, cot[i], k("tieuDeCot"));
    }

    /**
     * Đầu trang: đơn vị (trái), tên báo cáo, dòng kỳ, dòng phụ, phạm vi (giữa), đơn vị tính (phải). Trả dòng kế tiếp.
     * Hồ sơ cửa hàng chưa điền thì để trống dòng (không để trơ nhãn); luôn đủ 3 dòng để tiêu đề ở cùng chỗ.
     */
    protected int dauTrang(Sheet s, ThongTin tin, String tieuDe, int cotCuoi, String dongKy, String dongPhu) {
        return dauTrang(s, tin, tieuDe, cotCuoi, dongKy, dongPhu, true);
    }

    /** coTien = false: trang không có cột tiền, bỏ dòng "Đơn vị tính: đồng" (vẫn chừa dòng để bảng ở cùng chỗ). */
    protected int dauTrang(Sheet s, ThongTin tin, String tieuDe, int cotCuoi, String dongKy, String dongPhu, boolean coTien) {
        int r = 0;
        o(s, r++, 0, "Đơn vị: " + rong(tin.tenDonVi(), "[Tên đơn vị]"), k("donVi"));
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
        o(s, r++, cotCuoi, coTien ? "Đơn vị tính: đồng" : "", k("dvt"));
        return r;
    }

    /**
     * Ngày lập và ba chỗ ký. Người lập biểu ở cột B, Kế toán trưởng gộp [kttTu, kttDen], Giám đốc gộp [gdTu, gdDen];
     * dòng ngày lập gộp từ ngayTu tới gdDen.
     */
    protected void chuKy(Sheet s, int r, ThongTin tin, int ngayTu, int kttTu, int kttDen, int gdTu, int gdDen) {
        LocalDateTime l = tin.lapLuc();
        o(s, r, ngayTu, "Ngày " + String.format("%02d", l.getDayOfMonth()) + " tháng " + String.format("%02d", l.getMonthValue())
                + " năm " + l.getYear(), k("giuaNghieng"));
        gopNeuCan(s, r++, ngayTu, gdDen);
        Row vt = s.createRow(r++);
        o(vt, 1, "Người lập biểu", k("chuKy"));
        o(vt, kttTu, "Kế toán trưởng", k("chuKy"));
        gopNeuCan(s, vt.getRowNum(), kttTu, kttDen);
        o(vt, gdTu, "Giám đốc", k("chuKy"));
        gopNeuCan(s, vt.getRowNum(), gdTu, gdDen);
        Row ky = s.createRow(r);
        o(ky, 1, "(Ký, họ tên)", k("giuaNghieng"));
        o(ky, kttTu, "(Ký, họ tên)", k("giuaNghieng"));
        gopNeuCan(s, r, kttTu, kttDen);
        o(ky, gdTu, "(Ký, họ tên, đóng dấu)", k("giuaNghieng"));
        gopNeuCan(s, r, gdTu, gdDen);
        r += 5;
        if (tin.nguoiLap() != null) o(s, r, 1, tin.nguoiLap(), k("chuKy"));
    }

    /** Ba chỗ ký cho trang rộng tới cột c2: Kế toán trưởng C:E, Giám đốc và ngày lập từ cột F tới c2. */
    protected void chuKy(Sheet s, int r, ThongTin tin, int c2) {
        chuKy(s, r, tin, 5, 2, 4, 5, c2);
    }

    protected static String lapLuc(ThongTin tin) {
        return "Lập lúc " + tin.lapLuc().format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
                + (tin.nguoiLap() == null ? "" : " — " + tin.nguoiLap());
    }

    /** A4, vừa một trang theo chiều ngang, lặp dòng tiêu đề bảng [lapTu, lapDen] (âm: không lặp), chân trang "Trang x/y". */
    protected static void inTrang(Sheet s, boolean ngang, int lapTu, int lapDen) {
        PrintSetup p = s.getPrintSetup();
        p.setPaperSize(PrintSetup.A4_PAPERSIZE);
        p.setLandscape(ngang);
        p.setFitWidth((short) 1);
        p.setFitHeight((short) 0);
        s.setFitToPage(true);
        s.setAutobreaks(true);
        s.setHorizontallyCenter(true);
        s.setMargin(Sheet.LeftMargin, 0.4);
        s.setMargin(Sheet.RightMargin, 0.4);
        s.setMargin(Sheet.TopMargin, 0.6);
        s.setMargin(Sheet.BottomMargin, 0.6);
        if (lapTu >= 0) s.setRepeatingRows(new CellRangeAddress(lapTu, lapDen, -1, -1));
        s.getFooter().setCenter("&\"Times New Roman,Regular\"Trang &P/&N");
    }

    // ================= Ô =================

    protected static String khoang(LocalDate tu, LocalDate den) {
        return "từ " + tu.format(NGAY) + " đến " + den.format(NGAY);
    }

    protected static String rong(String s, String macDinh) {
        return s == null || s.isBlank() ? macDinh : s.trim();
    }

    protected static String ref(int r, int c) {
        return new CellReference(r, c).formatAsString();
    }

    /** Công thức cộng cột c từ dòng dau tới cuoi; bảng rỗng thì 0. SUBTOTAL(109) bỏ qua dòng đang bị lọc ẩn. */
    protected static String tongCot(int dau, int cuoi, int c, boolean theoLoc) {
        if (cuoi < dau) return "0";
        return (theoLoc ? "SUBTOTAL(109," : "SUM(") + ref(dau, c) + ":" + ref(cuoi, c) + ")";
    }

    protected static void gop(Sheet s, int r, int c1, int c2) {
        s.addMergedRegion(new CellRangeAddress(r, r, c1, c2));
    }

    private static void gopNeuCan(Sheet s, int r, int c1, int c2) {
        if (c2 > c1) gop(s, r, c1, c2);
    }

    protected static Cell o(Row row, int c, String v, CellStyle st) {
        Cell cell = row.getCell(c) == null ? row.createCell(c) : row.getCell(c);
        // null: để ô trống (không ghi chuỗi rỗng), như trước khi tách khuôn
        if (v == null) cell.setBlank(); else cell.setCellValue(v);
        cell.setCellStyle(st);
        return cell;
    }

    protected static Cell o(Sheet s, int r, int c, String v, CellStyle st) {
        Row row = s.getRow(r) == null ? s.createRow(r) : s.getRow(r);
        return o(row, c, v, st);
    }

    protected static void so(Row row, int c, BigDecimal v, CellStyle st) {
        Cell cell = row.getCell(c) == null ? row.createCell(c) : row.getCell(c);
        cell.setCellValue(v == null ? 0 : v.doubleValue());
        cell.setCellStyle(st);
    }

    protected static void so(Row row, int c, long v, CellStyle st) {
        Cell cell = row.getCell(c) == null ? row.createCell(c) : row.getCell(c);
        cell.setCellValue(v);
        cell.setCellStyle(st);
    }

    protected static void f(Row row, int c, String congThuc, CellStyle st) {
        Cell cell = row.getCell(c) == null ? row.createCell(c) : row.getCell(c);
        cell.setCellFormula(congThuc);
        cell.setCellStyle(st);
    }

    /**
     * Công thức kèm giá trị đã tính trong Java (null = công thức ra chuỗi rỗng ""), cho trang ghi dần (SXSSF) nơi không
     * chạy được bộ tính công thức.
     */
    protected static void fCo(Row row, int c, String congThuc, Double giaTri, CellStyle st) {
        f(row, c, congThuc, st);
        if (giaTri == null || giaTri.isNaN() || giaTri.isInfinite()) row.getCell(c).setCellValue("");
        else row.getCell(c).setCellValue(giaTri);
    }

    protected void ngay(Row row, int c, LocalDate d) {
        Cell cell = row.createCell(c);
        if (d != null) cell.setCellValue(d);
        cell.setCellStyle(k("ngay"));
    }

    protected void ngayGio(Row row, int c, LocalDateTime d) {
        Cell cell = row.createCell(c);
        if (d != null) cell.setCellValue(d);
        cell.setCellStyle(k("ngayGio"));
    }

    /** Dòng Cộng: tô nền mọi ô từ cột 0 tới cotCuoi, ghi nhãn ở cột cotNhan. */
    protected Row dongCong(Sheet s, int r, int cotCuoi, int cotNhan, String nhan) {
        Row cong = s.createRow(r);
        for (int c = 0; c <= cotCuoi; c++) o(cong, c, "", k("congChu"));
        o(cong, cotNhan, nhan, k("congChu"));
        return cong;
    }

    // ================= Kiểu ô (tạo một lần mỗi kiểu) =================

    protected CellStyle k(String ten) {
        return kieu.computeIfAbsent(ten, this::taoKieu);
    }

    private CellStyle taoKieu(String ten) {
        CellStyle st = wb.createCellStyle();
        DataFormat df = wb.createDataFormat();
        // Phông mặc định của tệp mới là Calibri: gán Times New Roman cho mọi kiểu, kiểu riêng ghi đè bên dưới
        st.setFont(fontThuong());
        boolean khung = switch (ten) {
            case "tieuDeCot", "stt", "chu", "chuDam", "chuDo", "chuXuong", "dvO", "tien", "tienDam", "tyLe", "so", "soDam",
                 "soGiua", "thapPhan", "ngayBan", "ngay", "ngayGio", "ghiChuO", "congChu", "congTien", "congSo", "congTyLe",
                 "congNgayBan" -> true;
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
            case "donVi" -> st.setFont(font(true, false, 11, false));
            case "chuNho" -> st.setFont(font(false, false, 10, false));
            case "tieuDe" -> {
                st.setFont(font(true, false, 15, false));
                st.setAlignment(HorizontalAlignment.CENTER);
                st.setVerticalAlignment(VerticalAlignment.CENTER);
            }
            case "giua" -> st.setAlignment(HorizontalAlignment.CENTER);
            case "giuaNghieng" -> {
                st.setFont(font(false, true, 11, false));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "dvt" -> {
                st.setFont(font(false, true, 10, false));
                st.setAlignment(HorizontalAlignment.RIGHT);
            }
            case "muc" -> st.setFont(font(true, false, 11, false));
            case "chuKy" -> {
                st.setFont(font(true, false, 11, false));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "ghiChu" -> st.setFont(font(false, true, 10, false));
            case "ghiChuDam" -> st.setFont(font(true, true, 10, false));
            case "tieuDeCot" -> {
                st.setFont(font(true, false, 11, false));
                st.setAlignment(HorizontalAlignment.CENTER);
                st.setWrapText(true);
                st.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
                st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            case "stt", "dvO" -> st.setAlignment(HorizontalAlignment.CENTER);
            case "chuDam" -> st.setFont(font(true, false, 11, false));
            case "chuDo" -> {
                st.setFont(font(true, false, 11, true));
                st.setWrapText(true);
            }
            case "chuXuong" -> st.setWrapText(true);
            case "tien" -> st.setDataFormat(df.getFormat(DD_TIEN));
            case "tienDam" -> {
                st.setDataFormat(df.getFormat(DD_TIEN));
                st.setFont(font(true, false, 11, false));
            }
            case "tyLe" -> st.setDataFormat(df.getFormat(DD_TY_LE));
            case "so" -> st.setDataFormat(df.getFormat(DD_SO));
            case "soDam" -> {
                st.setDataFormat(df.getFormat(DD_SO));
                st.setFont(font(true, false, 11, false));
            }
            case "soGiua" -> {
                st.setDataFormat(df.getFormat(DD_SO));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "thapPhan" -> st.setDataFormat(df.getFormat("#,##0.0;(#,##0.0);\"-\""));
            case "ngayBan" -> st.setDataFormat(df.getFormat(DD_NGAY_BAN));
            case "ngay" -> {
                st.setDataFormat(df.getFormat("dd/mm/yyyy"));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "ngayGio" -> {
                st.setDataFormat(df.getFormat("dd/mm/yyyy hh:mm"));
                st.setAlignment(HorizontalAlignment.CENTER);
            }
            case "ghiChuO" -> {
                st.setFont(font(false, true, 10, false));
                st.setWrapText(true);
            }
            case "congChu", "congTien", "congSo", "congTyLe", "congNgayBan" -> {
                st.setFont(font(true, false, 11, false));
                st.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
                st.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                if (ten.equals("congTien")) st.setDataFormat(df.getFormat(DD_TIEN));
                if (ten.equals("congSo")) st.setDataFormat(df.getFormat(DD_SO));
                if (ten.equals("congTyLe")) st.setDataFormat(df.getFormat(DD_TY_LE));
                if (ten.equals("congNgayBan")) st.setDataFormat(df.getFormat(DD_NGAY_BAN));
            }
            default -> { }
        }
        return st;
    }

    private Font fontThuong() {
        if (thuong == null) thuong = font(false, false, 11, false);
        return thuong;
    }

    private Font font(boolean dam, boolean nghieng, int co, boolean do_) {
        Font f = wb.createFont();
        f.setFontName(PHONG);
        f.setFontHeightInPoints((short) co);
        f.setBold(dam);
        f.setItalic(nghieng);
        if (do_) f.setColor(IndexedColors.DARK_RED.getIndex());
        return f;
    }
}
