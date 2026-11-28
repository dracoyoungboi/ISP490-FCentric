package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.DoanhThuTongHopDTO;
import com.dev.backend.dto.response.TienThuDTO;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tệp Excel của Báo cáo doanh thu theo khuôn chung (KhuonExcelBaoCao): trang Tổng hợp (kết quả kinh doanh so với cùng
 * kỳ năm trước, tiền thu trong kỳ, chữ ký), Chi tiết theo kỳ, Theo kênh, Theo nhân viên. Dòng chênh lệch, tỷ lệ, biên lãi
 * và dòng cộng là công thức.
 * <p>
 * Báo cáo đã bỏ giá vốn ({@code coGiaVon = false}, người tải là nhân viên bán hàng — SRS 2.4.1) thì tệp bỏ hẳn cột, dòng
 * giá vốn, lợi nhuận gộp, biên lãi: để trống sẽ khiến công thức lợi nhuận ra đúng bằng doanh thu.
 */
public final class BaoCaoDoanhThuExcel extends KhuonExcelBaoCao {

    /** Tệp có giá vốn (DoanhThuTongHopDTO.coGiaVon); false thì mọi trang bỏ cột, dòng giá vốn, lợi nhuận gộp, biên lãi. */
    private final boolean gv;

    private BaoCaoDoanhThuExcel(boolean gv) {
        this.gv = gv;
    }

    /** tenKy: tên kỳ trên dòng "Kỳ báo cáo" (vd. "Năm 2026", "Theo ngày"). */
    public static byte[] tao(DoanhThuTongHopDTO dt, TienThuDTO tt, ThongTin tin, String tenKy) {
        BaoCaoDoanhThuExcel x = new BaoCaoDoanhThuExcel(dt.isCoGiaVon());
        x.sheetTongHop(dt, tt, tin, tenKy);
        x.sheetChiTiet(dt, tin, tenKy, tt);
        x.sheetTheoKenh(dt, tin, tenKy);
        x.sheetTheoNhanVien(dt, tin, tenKy);
        return x.xuat("Báo cáo doanh thu", tin);
    }

    // ================= Trang 3: Theo kênh =================

    private void sheetTheoKenh(DoanhThuTongHopDTO dt, ThongTin tin, String tenKy) {
        Sheet s = wb.createSheet("Theo kênh");
        // Bỏ giá vốn: ba cột 5–7 (giá vốn, lợi nhuận gộp, biên lãi) mất, các cột sau dồn sang trái
        int lui = gv ? 0 : 3;
        int cCk = 8 - lui;
        int cTang = 9 - lui;
        int cHoan = 10 - lui;
        if (gv) doRongCot(s, 6, 30, 10, 18, 11, 18, 18, 10, 18, 12, 12);
        else doRongCot(s, 6, 30, 10, 18, 11, 18, 12, 12);
        int r = dauTrang(s, tin, "DOANH THU THEO KÊNH BÁN", cHoan,
                "Kỳ báo cáo: " + tenKy + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
                "So với cùng kỳ năm trước: " + khoang(dt.getTuNgayCungKy(), dt.getDenNgayCungKy()));
        int h = r;
        if (gv) {
            tieuDe(s, r++, 30, "STT", "Kênh bán", "Số đơn", "Doanh thu", "Tỷ trọng", "Giá vốn", "Lợi nhuận gộp", "Biên lãi",
                    "Doanh thu cùng kỳ năm trước", "Tăng / giảm", "Đơn bị hoàn");
        } else {
            tieuDe(s, r++, 30, "STT", "Kênh bán", "Số đơn", "Doanh thu", "Tỷ trọng",
                    "Doanh thu cùng kỳ năm trước", "Tăng / giảm", "Đơn bị hoàn");
        }
        List<DoanhThuTongHopDTO.Kenh> ds = dt.getTheoKenh() == null ? List.of() : dt.getTheoKenh();
        int dau = r;
        int cuoi = dau + ds.size() - 1;
        int rCong = cuoi + 1;
        int stt = 1;
        for (DoanhThuTongHopDTO.Kenh kn : ds) {
            Row row = s.createRow(r);
            o(row, 0, String.valueOf(stt++), k("stt"));
            o(row, 1, kn.getTen(), k("chu"));
            so(row, 2, kn.getSoDon(), k("so"));
            so(row, 3, kn.getDoanhThu(), k("tien"));
            f(row, 4, "IF(" + ref(rCong, 3) + "=0,\"\"," + ref(r, 3) + "/" + ref(rCong, 3) + ")", k("tyLe"));
            if (gv) {
                so(row, 5, kn.getGiaVon(), k("tien"));
                f(row, 6, ref(r, 3) + "-" + ref(r, 5), k("tien"));
                f(row, 7, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 3) + ")", k("tyLe"));
            }
            so(row, cCk, kn.getDoanhThuCungKy(), k("tien"));
            f(row, cTang, "IF(" + ref(r, cCk) + "=0,\"\",(" + ref(r, 3) + "-" + ref(r, cCk) + ")/" + ref(r, cCk) + ")", k("tyLe"));
            so(row, cHoan, kn.getSoDonHoan(), k("so"));
            r++;
        }
        r = rCong;
        Row cong = dongCong(s, r, cHoan, 1, "Cộng");
        int[] cotCong = gv ? new int[]{2, 3, 5, 6, cCk, cHoan} : new int[]{2, 3, cCk, cHoan};
        for (int c : cotCong) {
            f(cong, c, tongCot(dau, cuoi, c, false), k(c == 2 || c == cHoan ? "congSo" : "congTien"));
        }
        f(cong, 4, "IF(" + ref(r, 3) + "=0,\"\",1)", k("congTyLe"));
        if (gv) f(cong, 7, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 3) + ")", k("congTyLe"));
        f(cong, cTang, "IF(" + ref(r, cCk) + "=0,\"\",(" + ref(r, 3) + "-" + ref(r, cCk) + ")/" + ref(r, cCk) + ")", k("congTyLe"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Bán tại quầy gồm đơn tạo từ màn bán tại quầy; Đơn bán trực tiếp là đơn bán thường (không bán tại quầy, không từ sàn);"
                + " các kênh còn lại là đơn đồng bộ từ sàn / web. Đơn bị hoàn chỉ đếm, không cộng vào doanh thu.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(2, h + 1);
        inTrang(s, true, h, h);
    }

    // ================= Trang 4: Theo nhân viên =================

    private void sheetTheoNhanVien(DoanhThuTongHopDTO dt, ThongTin tin, String tenKy) {
        Sheet s = wb.createSheet("Theo nhân viên");
        if (gv) doRongCot(s, 6, 30, 10, 18, 11, 16, 18, 18, 10);
        else doRongCot(s, 6, 30, 10, 18, 11, 16);
        int r = dauTrang(s, tin, "DOANH THU THEO NHÂN VIÊN", gv ? 8 : 5,
                "Kỳ báo cáo: " + tenKy + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
                "Nhân viên là người lập đơn: thu ngân với đơn bán tại quầy, người lập đơn với đơn bán thường");
        int h = r;
        if (gv) {
            tieuDe(s, r++, 30, "STT", "Nhân viên", "Số đơn", "Doanh thu", "Tỷ trọng", "Trung bình một đơn", "Giá vốn",
                    "Lợi nhuận gộp", "Biên lãi");
        } else {
            tieuDe(s, r++, 30, "STT", "Nhân viên", "Số đơn", "Doanh thu", "Tỷ trọng", "Trung bình một đơn");
        }
        List<DoanhThuTongHopDTO.NhanVien> ds = dt.getTheoNhanVien() == null ? List.of() : dt.getTheoNhanVien();
        int dau = r;
        int cuoi = dau + ds.size() - 1;
        int rCong = cuoi + 1;
        int stt = 1;
        for (DoanhThuTongHopDTO.NhanVien nv : ds) {
            Row row = s.createRow(r);
            boolean laNguoi = DoanhThuReportService.NV_NHAN_VIEN.equals(nv.getLoai());
            o(row, 0, laNguoi ? String.valueOf(stt++) : "", k("stt"));
            o(row, 1, DoanhThuReportService.NV_DON_SAN.equals(nv.getLoai()) ? "Đơn sàn (không gắn nhân viên)" : nv.getTen(), k("chu"));
            so(row, 2, nv.getSoDon(), k("so"));
            so(row, 3, nv.getDoanhThu(), k("tien"));
            f(row, 4, "IF(" + ref(rCong, 3) + "=0,\"\"," + ref(r, 3) + "/" + ref(rCong, 3) + ")", k("tyLe"));
            f(row, 5, "IF(" + ref(r, 2) + "=0,\"\"," + ref(r, 3) + "/" + ref(r, 2) + ")", k("tien"));
            if (gv) {
                so(row, 6, nv.getGiaVon(), k("tien"));
                f(row, 7, ref(r, 3) + "-" + ref(r, 6), k("tien"));
                f(row, 8, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 7) + "/" + ref(r, 3) + ")", k("tyLe"));
            }
            r++;
        }
        r = rCong;
        Row cong = dongCong(s, r, gv ? 8 : 5, 1, "Cộng");
        for (int c : gv ? new int[]{2, 3, 6, 7} : new int[]{2, 3}) {
            f(cong, c, tongCot(dau, cuoi, c, false), k(c == 2 ? "congSo" : "congTien"));
        }
        f(cong, 4, "IF(" + ref(r, 3) + "=0,\"\",1)", k("congTyLe"));
        f(cong, 5, "IF(" + ref(r, 2) + "=0,\"\"," + ref(r, 3) + "/" + ref(r, 2) + ")", k("congTien"));
        if (gv) f(cong, 8, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 7) + "/" + ref(r, 3) + ")", k("congTyLe"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Đơn sàn đồng bộ tự động từ sàn / web nên không có người lập, tách thành dòng riêng.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(2, h + 1);
        inTrang(s, false, h, h);
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(DoanhThuTongHopDTO dt, TienThuDTO tt, ThongTin tin, String tenKy) {
        Sheet s = wb.createSheet("Tổng hợp");
        int[] rong = {6, 46, 19, 19, 19, 15};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        s.setDisplayGridlines(false);
        int r = dauTrang(s, tin, "BÁO CÁO DOANH THU", 5,
                "Kỳ báo cáo: " + tenKy + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
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
        dongSoSanh(s, r++, "1", "Doanh thu bán hàng (chưa gồm thuế GTGT, phí vận chuyển)", a.getDoanhThu(), b.getDoanhThu(), true);
        dongSoSanh(s, r++, "", "   Tiền hàng khách trả (gồm thuế GTGT, đã trừ hàng trả)", a.getTienHang(), b.getTienHang(), false);
        dongSoSanh(s, r++, "", "   Phí vận chuyển thu của khách (không tính doanh thu)", a.getPhiVanChuyen(), b.getPhiVanChuyen(), false);
        if (gv) {
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
        }
        // Không có giá vốn: bỏ mục 2–4, số đơn và giá trị trung bình đánh lại là 2, 3
        String sttDon = gv ? "5" : "2";
        int rDon = r;
        Row don = s.createRow(r++);
        o(don, 0, sttDon, k("stt"));
        o(don, 1, "Số đơn đã giao (đơn)", k("chu"));
        so(don, 2, a.getSoDon(), k("so"));
        so(don, 3, b.getSoDon(), k("so"));
        f(don, 4, ref(rDon, 2) + "-" + ref(rDon, 3), k("so"));
        f(don, 5, "IF(" + ref(rDon, 3) + "=0,\"\"," + ref(rDon, 4) + "/" + ref(rDon, 3) + ")", k("tyLe"));
        Row tb = s.createRow(r);
        o(tb, 0, gv ? "6" : "3", k("stt"));
        o(tb, 1, "Giá trị trung bình một đơn (" + (gv ? "6" : "3") + " = 1 / " + sttDon + ")", k("chu"));
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
            dongTien(s, r++, "1", "Tiền mặt tại quầy", tt.getTienMat(), true, "Gồm phần tiền mặt khách trả trước khi quét QR");
            int rCk = r;
            dongTien(s, r++, "2", "Chuyển khoản (QR payOS tại quầy)", tt.getChuyenKhoan(), true, "");
            int rHoan = r;
            dongTien(s, r++, "3", "Hoàn tiền cho khách", tt.getHoan() == null ? null : tt.getHoan().negate(), true,
                    tt.getSoPhieuHoan() + " phiếu trả hàng tại quầy");
            Row rong2 = s.createRow(r);
            o(rong2, 0, "4", k("stt"));
            o(rong2, 1, "Thu ròng (4 = 1 + 2 + 3)", k("chuDam"));
            f(rong2, 2, ref(rTm, 2) + "+" + ref(rCk, 2) + "+" + ref(rHoan, 2), k("tienDam"));
            ghiChu(s, r++, "");
            dongTien(s, r++, "5", "Sàn thu hộ (đơn sàn đã giao)", tt.getSanThuHo(), false,
                    tt.getSoDonSan() + " đơn — đối soát với sàn, không gồm ở mục 4");
            if (tt.isTheoKhoPhuTrach() || dt.isTheoKhoPhuTrach()) {
                o(s, r++, 1, "Chỉ tính các cửa hàng người lập phụ trách.", k("ghiChu"));
            }
        }
        r++;
        chuKy(s, r, tin, 3, 2, 3, 4, 5);

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

    private void sheetChiTiet(DoanhThuTongHopDTO dt, ThongTin tin, String tenKy, TienThuDTO tt) {
        Sheet s = wb.createSheet("Chi tiết theo kỳ");
        // Bỏ giá vốn: cột 5–7 mất, cột từ "Số đơn" trở đi dồn sang trái 3 cột
        int lui = gv ? 0 : 3;
        int cSd = 8 - lui;
        int cCk = 9 - lui;
        int cTang = 10 - lui;
        int cTm = 11 - lui;
        int cChuyen = 12 - lui;
        int cHoan = 13 - lui;
        int[] rong = gv ? new int[]{6, 16, 12, 12, 17, 17, 17, 10, 9, 17, 11, 17, 17, 15}
                : new int[]{6, 16, 12, 12, 17, 9, 17, 11, 17, 17, 15};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        String don = switch (dt.getLoai()) {
            case "ngay" -> "NGÀY";
            case "nam" -> "NĂM";
            default -> "THÁNG";
        };
        int r = dauTrang(s, tin, "CHI TIẾT DOANH THU VÀ TIỀN THU THEO " + don, cHoan,
                "Kỳ báo cáo: " + tenKy + " (" + khoang(dt.getTuNgay(), dt.getDenNgay()) + ")",
                "Doanh thu theo ngày giao hàng; tiền thu theo ngày thu tiền");

        // Tiêu đề hai tầng: nhóm cột rồi tên cột
        int h1 = r;
        Row nhom = s.createRow(r++);
        Row ten = s.createRow(r++);
        ten.setHeightInPoints(30);
        String[] tenCot = gv
                ? new String[]{"STT", "Kỳ", "Từ ngày", "Đến ngày", "Doanh thu", "Giá vốn", "Lợi nhuận gộp", "Biên lãi",
                        "Số đơn", "Doanh thu", "Tăng / giảm", "Tiền mặt", "Chuyển khoản", "Hoàn tiền"}
                : new String[]{"STT", "Kỳ", "Từ ngày", "Đến ngày", "Doanh thu",
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
        gop(s, h1, 4, cSd);
        o(nhom, cCk, "Cùng kỳ năm trước", k("tieuDeCot"));
        gop(s, h1, cCk, cTang);
        o(nhom, cTm, "Tiền thu", k("tieuDeCot"));
        gop(s, h1, cTm, cHoan);

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
            if (gv) {
                so(row, 5, ky.getGiaVon(), k("tien"));
                f(row, 6, ref(r, 4) + "-" + ref(r, 5), k("tien"));
                f(row, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("tyLe"));
            }
            so(row, cSd, ky.getSoDon(), k("so"));
            so(row, cCk, ky.getDoanhThuCungKy(), k("tien"));
            f(row, cTang, "IF(" + ref(r, cCk) + "=0,\"\",(" + ref(r, 4) + "-" + ref(r, cCk) + ")/" + ref(r, cCk) + ")", k("tyLe"));
            TienThuDTO.Ky t = thu.get(ky.getNhanThoiGian());
            so(row, cTm, t == null ? BigDecimal.ZERO : t.getTienMat(), k("tien"));
            so(row, cChuyen, t == null ? BigDecimal.ZERO : t.getChuyenKhoan(), k("tien"));
            so(row, cHoan, t == null ? BigDecimal.ZERO : t.getHoan().negate(), k("tien"));
            r++;
        }
        int cuoi = r - 1;
        Row cong = s.createRow(r);
        o(cong, 0, "", k("congChu"));
        o(cong, 1, "Cộng", k("congChu"));
        o(cong, 2, "", k("congChu"));
        o(cong, 3, "", k("congChu"));
        int[] cotCong = gv ? new int[]{4, 5, 6, cSd, cCk, cTm, cChuyen, cHoan} : new int[]{4, cSd, cCk, cTm, cChuyen, cHoan};
        for (int c : cotCong) {
            f(cong, c, ds.isEmpty() ? "0" : "SUM(" + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c == cSd ? "congSo" : "congTien"));
        }
        if (gv) f(cong, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("congTyLe"));
        f(cong, cTang, "IF(" + ref(r, cCk) + "=0,\"\",(" + ref(r, 4) + "-" + ref(r, cCk) + ")/" + ref(r, cCk) + ")", k("congTyLe"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Tăng / giảm so doanh thu kỳ này với cùng kỳ năm trước. Kỳ đang chạy so với đúng số ngày đã qua của cùng kỳ năm trước.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(2, h1 + 2);
        if (!ds.isEmpty()) s.setAutoFilter(new CellRangeAddress(h1 + 1, cuoi, 0, cHoan));
        inTrang(s, true, h1, h1 + 1);
    }

    private static String tenKy(String loai, DoanhThuTongHopDTO.Ky ky) {
        return switch (loai) {
            case "ngay" -> ky.getTuNgay().format(NGAY);
            case "nam" -> "Năm " + ky.getTuNgay().getYear();
            default -> "Tháng " + ky.getTuNgay().getMonthValue() + "/" + ky.getTuNgay().getYear();
        };
    }
}
