package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.ThongDiep;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Ghi một tệp .xlsx theo bố cục tệp mẫu AMIS: các dòng hướng dẫn ở trên, dòng nhóm cột, dòng tiêu đề đúng số dòng của
 * mẫu (kế toán chọn "Dòng tiêu đề là dòng số N" như khi dùng tệp mẫu), dữ liệu ngay dưới. Tên cột chép nguyên văn từ mẫu
 * thật nên AMIS tự ghép cột.
 *
 * <p>Ngày ghi dạng chữ dd/MM/yyyy như dòng ví dụ trong tệp mẫu; mã (SKU, mã số thuế, tài khoản) ghi dạng chữ để giữ số 0
 * ở đầu; tiền và số lượng ghi dạng số. Ghi kiểu luồng (SXSSF) để tệp bán hàng một ngày vài nghìn dòng không tốn bộ nhớ.</p>
 */
public final class GhiTepAmis {

    static final DateTimeFormatter NGAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int DO_RONG_COT = 18 * 256;

    private GhiTepAmis() {
    }

    /**
     * @param mau     mẫu AMIS
     * @param dong    các dòng dữ liệu: tên cột gọn → giá trị (String, BigDecimal, Integer, LocalDate; null = để trống)
     * @param huongDan các câu hướng dẫn in phía trên (tối đa đủ chỗ trước dòng nhóm / dòng tiêu đề)
     */
    public static byte[] ghi(HoSoAmis.Mau mau, List<Map<String, Object>> dong, List<String> huongDan) {
        SXSSFWorkbook wb = new SXSSFWorkbook(200);
        try (wb; ByteArrayOutputStream ra = new ByteArrayOutputStream()) {
            wb.setCompressTempFiles(true);
            SXSSFSheet sh = wb.createSheet(mau.sheet());
            Font dam = wb.createFont();
            dam.setBold(true);
            CellStyle kieuTieuDe = wb.createCellStyle();
            kieuTieuDe.setFont(dam);
            kieuTieuDe.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            kieuTieuDe.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            kieuTieuDe.setWrapText(true);
            kieuTieuDe.setBorderBottom(BorderStyle.THIN);
            CellStyle kieuDam = wb.createCellStyle();
            kieuDam.setFont(dam);
            CellStyle kieuChu = wb.createCellStyle();
            kieuChu.setDataFormat(wb.createDataFormat().getFormat("@"));

            int dongDauTien = mau.dongNhom() > 0 ? mau.dongNhom() : mau.dongTieuDe();
            // Hướng dẫn chiếm các dòng 1 .. (dòng nhóm hoặc dòng tiêu đề) - 2, chừa một dòng trống
            int soDongHuongDan = Math.max(0, dongDauTien - 2);
            for (int i = 0; i < Math.min(soDongHuongDan, huongDan.size()); i++) {
                Cell c = sh.createRow(i).createCell(0);
                c.setCellValue(huongDan.get(i));
                if (i == 0) {
                    c.setCellStyle(kieuDam);
                }
            }
            if (mau.dongNhom() > 0 && !mau.nhom().isEmpty()) {
                Row r = sh.createRow(mau.dongNhom() - 1);
                mau.nhom().forEach((cot, ten) -> {
                    Cell c = r.createCell(cot);
                    c.setCellValue(ten);
                    c.setCellStyle(kieuDam);
                });
            }
            Row tieuDe = sh.createRow(mau.dongTieuDe() - 1);
            for (int i = 0; i < mau.cot().size(); i++) {
                Cell c = tieuDe.createCell(i);
                c.setCellValue(mau.cot().get(i));
                c.setCellStyle(kieuTieuDe);
                sh.setColumnWidth(i, DO_RONG_COT);
            }

            int r = mau.dongTieuDe();
            for (Map<String, Object> d : dong) {
                Row row = sh.createRow(r++);
                for (Map.Entry<String, Object> e : d.entrySet()) {
                    Object v = e.getValue();
                    if (v == null) continue;
                    Cell c = row.createCell(mau.viTri(e.getKey()));
                    if (v instanceof BigDecimal so) {
                        c.setCellValue(so.doubleValue());
                    } else if (v instanceof Integer so) {
                        c.setCellValue(so);
                    } else if (v instanceof LocalDate ngay) {
                        c.setCellValue(ngay.format(NGAY));
                        c.setCellStyle(kieuChu);
                    } else {
                        String chu = v.toString();
                        if (chu.isEmpty()) continue;
                        c.setCellValue(chu);
                        c.setCellStyle(kieuChu);
                    }
                }
            }
            wb.write(ra);
            return ra.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(ThongDiep.vi("keToanDuLieuVao.khongGhiDuocTep", mau.khoa()), e);
        } finally {
            // Xóa tệp tạm của SXSSF cả khi ghi lỗi giữa chừng
            wb.dispose();
        }
    }
}
