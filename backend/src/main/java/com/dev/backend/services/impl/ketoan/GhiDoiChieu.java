package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.ThongDiep;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Tệp 90_DoiChieu.xlsx đi kèm mỗi lô: tổng theo loại, danh sách chứng từ, vấn đề (chặn, cảnh báo, phát sinh sau khi
 * xuất) và đối chiếu doanh thu — để kế toán so với AMIS sau khi nhập.
 */
final class GhiDoiChieu {

    private GhiDoiChieu() {
    }

    record DongTongHop(String ten, int soChungTu, int soDong, BigDecimal truocThue, BigDecimal thue, BigDecimal tongCong) {
    }

    record DongVanDe(String muc, String loai, String soChungTu, String noiDung) {
    }

    static byte[] ghi(String soLo, LocalDate ngayMoc, LocalDate denNgay, List<DongTongHop> tongHop,
                      List<DungChungTuAmis.ChungTu> chungTu, List<DongVanDe> vanDe,
                      List<String[]> doiChieu) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream ra = new ByteArrayOutputStream()) {
            Font dam = wb.createFont();
            dam.setBold(true);
            CellStyle kieuDam = wb.createCellStyle();
            kieuDam.setFont(dam);
            CellStyle kieuSo = wb.createCellStyle();
            kieuSo.setDataFormat(wb.createDataFormat().getFormat("#,##0"));

            Sheet s1 = wb.createSheet("Tổng hợp");
            o(s1, 0, 0, "ĐỐI CHIẾU LÔ " + soLo, kieuDam);
            o(s1, 1, 0, "Chứng từ có ngày hạch toán từ " + ngayMoc.format(GhiTepAmis.NGAY) + " đến hết "
                    + denNgay.format(GhiTepAmis.NGAY) + " chưa giao ở lô trước", null);
            String[] tieuDe = {"Loại", "Số chứng từ", "Số dòng", "Trước thuế (sau chiết khấu)", "Thuế GTGT", "Tổng cộng"};
            dongTieuDe(s1, 3, tieuDe, kieuDam);
            int r = 4;
            for (DongTongHop t : tongHop) {
                Row row = s1.createRow(r++);
                row.createCell(0).setCellValue(t.ten());
                row.createCell(1).setCellValue(t.soChungTu());
                row.createCell(2).setCellValue(t.soDong());
                so(row, 3, t.truocThue(), kieuSo);
                so(row, 4, t.thue(), kieuSo);
                so(row, 5, t.tongCong(), kieuSo);
            }
            r++;
            o(s1, r++, 0, "Đối chiếu doanh thu với Báo cáo doanh thu", kieuDam);
            for (String[] d : doiChieu) {
                Row row = s1.createRow(r++);
                row.createCell(0).setCellValue(d[0]);
                so(row, 1, new BigDecimal(d[1]), kieuSo);
            }
            for (int c = 0; c < tieuDe.length; c++) s1.setColumnWidth(c, c == 0 ? 48 * 256 : 22 * 256);

            Sheet s2 = wb.createSheet("Chứng từ");
            dongTieuDe(s2, 0, new String[]{"Loại", "Số chứng từ", "Ngày hạch toán", "Số dòng", "Trước thuế", "Thuế GTGT", "Tổng tiền"}, kieuDam);
            r = 1;
            for (DungChungTuAmis.ChungTu ct : chungTu) {
                Row row = s2.createRow(r++);
                row.createCell(0).setCellValue(XuatKeToanService.tenLoai(ct.loai()));
                row.createCell(1).setCellValue(ct.soChungTu());
                row.createCell(2).setCellValue(ct.ngayHachToan().format(GhiTepAmis.NGAY));
                row.createCell(3).setCellValue(ct.soDong());
                so(row, 4, ct.truocThue(), kieuSo);
                so(row, 5, ct.thue(), kieuSo);
                so(row, 6, ct.tongTien(), kieuSo);
            }
            for (int c = 0; c < 7; c++) s2.setColumnWidth(c, (c == 0 ? 24 : 18) * 256);

            Sheet s3 = wb.createSheet("Vấn đề");
            dongTieuDe(s3, 0, new String[]{"Mức", "Loại", "Số chứng từ", "Nội dung"}, kieuDam);
            r = 1;
            for (DongVanDe v : vanDe) {
                Row row = s3.createRow(r++);
                row.createCell(0).setCellValue(v.muc());
                row.createCell(1).setCellValue(v.loai());
                row.createCell(2).setCellValue(v.soChungTu() == null ? "" : v.soChungTu());
                row.createCell(3).setCellValue(v.noiDung());
            }
            s3.setColumnWidth(0, 18 * 256);
            s3.setColumnWidth(1, 22 * 256);
            s3.setColumnWidth(2, 22 * 256);
            s3.setColumnWidth(3, 110 * 256);

            wb.write(ra);
            return ra.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(ThongDiep.vi("keToanDuLieuVao.khongGhiDuocTepDoiChieu"), e);
        }
    }

    private static void o(Sheet s, int r, int c, String giaTri, CellStyle kieu) {
        Row row = s.getRow(r) == null ? s.createRow(r) : s.getRow(r);
        Cell cell = row.createCell(c);
        cell.setCellValue(giaTri);
        if (kieu != null) cell.setCellStyle(kieu);
    }

    private static void dongTieuDe(Sheet s, int r, String[] ten, CellStyle kieu) {
        Row row = s.createRow(r);
        for (int i = 0; i < ten.length; i++) {
            Cell c = row.createCell(i);
            c.setCellValue(ten[i]);
            c.setCellStyle(kieu);
        }
    }

    private static void so(Row row, int c, BigDecimal v, CellStyle kieu) {
        Cell cell = row.createCell(c);
        cell.setCellValue(v == null ? 0 : v.doubleValue());
        cell.setCellStyle(kieu);
    }
}
