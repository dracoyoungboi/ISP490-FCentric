package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.KhachHangTangTruongDTO;
import com.dev.backend.repository.BaoCaoKhachHangRepository.KhachMua;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Tệp Excel của Báo cáo khách hàng theo khuôn chung (KhuonExcelBaoCao):
 * - Tổng hợp: chỉ tiêu cả kỳ (mỗi khách đếm một lần), 10 khách mua nhiều nhất, chữ ký.
 * - Theo kỳ: đúng bảng trên màn (khách mới, quay lại, tổng khách mua, tích lũy, tăng trưởng).
 * - Khách mua trong kỳ: mỗi khách một dòng (mã, tên, điện thoại, email, mới / quay lại, số đơn, doanh thu).
 */
public final class BaoCaoKhachHangExcel extends KhuonExcelBaoCao {

    public record DuLieu(String loai, String tenKy, LocalDate tu, LocalDate den, List<KhachHangTangTruongDTO> theoKy,
                         List<KhachMua> khach) {
    }

    private static final int SO_KHACH_NOI_BAT = 10;

    private final DuLieu d;
    private final String dongKy;

    private BaoCaoKhachHangExcel(DuLieu d) {
        this.d = d;
        this.dongKy = "Kỳ báo cáo: " + d.tenKy() + " (" + khoang(d.tu(), d.den()) + ")";
    }

    public static byte[] tao(DuLieu d, ThongTin tin) {
        BaoCaoKhachHangExcel x = new BaoCaoKhachHangExcel(d);
        x.sheetTongHop(tin);
        x.sheetTheoKy(tin);
        // Danh sách khách có thể dài (kỳ nhiều năm): ghi dần ra đĩa
        return x.xuat("Báo cáo khách hàng", tin, sx -> x.sheetKhach(sx, tin));
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        doRongCot(s, 6, 40, 12, 18, 18, 14, 14);
        s.setDisplayGridlines(false);
        int r = dauTrang(s, tin, "BÁO CÁO KHÁCH HÀNG", 6, dongKy, "Theo đơn bán đã giao trong kỳ");

        long soKhach = d.khach().size();
        long khachMoi = d.khach().stream().filter(KhachMua::khachMoi).count();
        long soDon = d.khach().stream().mapToLong(KhachMua::soDon).sum();
        BigDecimal doanhThu = d.khach().stream().map(KhachMua::doanhThu).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        o(s, r++, 0, "I. CHỈ TIÊU CẢ KỲ (mỗi khách đếm một lần)", k("muc"));
        int hI = r;
        tieuDe(s, r++, 22, "STT", "Chỉ tiêu", "Đơn vị", "Số liệu", "", "", "");
        gop(s, hI, 3, 6);
        int r1 = r;
        chiTieu(s, r++, "1", "Số khách mua", "khách", soKhach, true);
        chiTieu(s, r++, "2", "   Trong đó: khách mới", "khách", khachMoi, false);
        int r3 = r;
        chiTieu(s, r++, "3", "   Trong đó: khách quay lại", "khách", soKhach - khachMoi, false);
        int r4 = r;
        chiTieu(s, r++, "4", "Số đơn đã giao", "đơn", soDon, false);
        int r5 = r;
        Row dt = s.createRow(r++);
        o(dt, 0, "5", k("stt"));
        o(dt, 1, "Doanh thu", k("chuDam"));
        o(dt, 2, "đồng", k("dvO"));
        so(dt, 3, doanhThu, k("tienDam"));
        traiO(s, r5);
        congThuc(s, r++, "6", "Doanh thu bình quân một khách (6 = 5 / 1)", "đồng",
                "IF(" + ref(r1, 3) + "=0,\"\"," + ref(r5, 3) + "/" + ref(r1, 3) + ")", "tien");
        congThuc(s, r++, "7", "Số đơn bình quân một khách (7 = 4 / 1)", "đơn",
                "IF(" + ref(r1, 3) + "=0,\"\"," + ref(r4, 3) + "/" + ref(r1, 3) + ")", "thapPhan");
        congThuc(s, r++, "8", "Tỷ lệ khách quay lại (8 = 3 / 1)", "%",
                "IF(" + ref(r1, 3) + "=0,\"\"," + ref(r3, 3) + "/" + ref(r1, 3) + ")", "tyLe");
        r++;

        o(s, r++, 0, "II. " + SO_KHACH_NOI_BAT + " KHÁCH MUA NHIỀU NHẤT (theo doanh thu)", k("muc"));
        tieuDe(s, r++, 30, "STT", "Khách hàng", "Mã khách", "Số đơn", "Doanh thu", "Tỷ trọng doanh thu", "Khách");
        int stt = 1;
        for (KhachMua kh : d.khach().subList(0, Math.min(SO_KHACH_NOI_BAT, d.khach().size()))) {
            Row row = s.createRow(r);
            o(row, 0, String.valueOf(stt++), k("stt"));
            o(row, 1, kh.ten(), k("chuXuong"));
            o(row, 2, kh.ma(), k("chu"));
            so(row, 3, kh.soDon(), k("so"));
            so(row, 4, kh.doanhThu(), k("tien"));
            f(row, 5, "IF(" + ref(r5, 3) + "=0,\"\"," + ref(r, 4) + "/" + ref(r5, 3) + ")", k("tyLe"));
            o(row, 6, kh.khachMoi() ? "Mới" : "Quay lại", k("stt"));
            r++;
        }
        if (d.khach().isEmpty()) o(s, r++, 1, "Không có khách mua trong kỳ.", k("ghiChu"));
        r++;

        String[] ghi = {
                "Ghi chú:",
                "- Chỉ tính đơn bán đã giao (đã xuất kho toàn bộ hoặc hoàn thành), theo ngày giao hàng; lọc kho theo kho xuất của đơn.",
                "- Khách mới: chưa có đơn đã giao nào trước ngày đầu kỳ (ở mọi kho). Khách quay lại: đã từng mua trước kỳ.",
                "- Doanh thu = tổng cộng của đơn (gồm phí vận chuyển). Danh sách đầy đủ ở trang \"Khách mua trong kỳ\".",
                "- Trang \"Theo kỳ\" đếm khách theo từng kỳ: một khách mua ở nhiều kỳ được đếm ở mỗi kỳ.",
        };
        for (String g : ghi) o(s, r++, 0, g, k(g.equals("Ghi chú:") ? "ghiChuDam" : "ghiChu"));
        r++;
        chuKy(s, r, tin, 4, 2, 3, 4, 6);
        inTrang(s, false, -1, -1);
        s.getPrintSetup().setFitHeight((short) 1);
    }

    private void chiTieu(Sheet s, int r, String stt, String ten, String dv, long v, boolean dam) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k(dam ? "chuDam" : "chu"));
        o(row, 2, dv, k("dvO"));
        so(row, 3, v, k(dam ? "soDam" : "so"));
        traiO(s, r);
    }

    private void congThuc(Sheet s, int r, String stt, String ten, String dv, String ct, String kieu) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k("chu"));
        o(row, 2, dv, k("dvO"));
        f(row, 3, ct, k(kieu));
        traiO(s, r);
    }

    /** Ô số liệu của mục I trải từ cột D tới G. */
    private void traiO(Sheet s, int r) {
        Row row = s.getRow(r);
        for (int c = 4; c <= 6; c++) o(row, c, "", k("chu"));
        gop(s, r, 3, 6);
    }

    // ================= Trang 2: Theo kỳ =================

    private void sheetTheoKy(ThongTin tin) {
        Sheet s = wb.createSheet("Theo kỳ");
        doRongCot(s, 6, 18, 14, 16, 16, 18, 18);
        int r = dauTrang(s, tin, "KHÁCH HÀNG THEO KỲ", 6, dongKy, "Mỗi kỳ đếm khách có đơn đã giao trong kỳ đó", false);
        int h = r;
        tieuDe(s, r++, 30, "STT", "Kỳ", "Khách mới", "Khách quay lại", "Tổng khách mua", "Tích lũy khách mới",
                "Tăng trưởng khách mới");
        int dau = r;
        int stt = 1;
        for (KhachHangTangTruongDTO k0 : d.theoKy()) {
            Row row = s.createRow(r++);
            so(row, 0, stt++, k("soGiua"));
            o(row, 1, k0.getNhanThoiGian(), k("chu"));
            so(row, 2, soLong(k0.getSoKhachMoi()), k("so"));
            so(row, 3, soLong(k0.getSoKhachQuayLai()), k("so"));
            so(row, 4, soLong(k0.getTongKhachMua()), k("so"));
            so(row, 5, soLong(k0.getTichLuyKhachMoi()), k("so"));
            // Máy chủ trả phần trăm (12.5 = 12,5%); ô Excel lưu dạng tỷ lệ
            if (k0.getTyLeTangTruong() != null) {
                so(row, 6, k0.getTyLeTangTruong().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP), k("tyLe"));
            } else {
                o(row, 6, "", k("tyLe"));
            }
        }
        int cuoi = r - 1;
        // Không có dòng Cộng: như trên màn, khách mua ở nhiều kỳ được đếm ở mỗi kỳ (kể cả cột Khách mới), cộng dọc sẽ trùng
        r++;
        o(s, r++, 1, "Ghi chú: Số đếm như trên màn: một khách mua ở nhiều kỳ được đếm ở mỗi kỳ (khách mới trong kỳ báo cáo là khách mới ở mọi kỳ mua),", k("ghiChu"));
        o(s, r++, 1, "nên các cột không cộng dọc được. Số khách cả kỳ, mỗi khách đếm một lần, ở trang Tổng hợp.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(0, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, 6));
        inTrang(s, false, h, h);
    }

    // ================= Trang 3: Khách mua trong kỳ =================

    private void sheetKhach(SXSSFWorkbook sx, ThongTin tin) {
        Sheet s = sx.createSheet("Khách mua trong kỳ");
        //         STT Mã  Tên SĐT Email Loại Đơn DT  TT  Đầu Gần
        doRongCot(s, 6, 14, 30, 15, 26, 11, 9, 16, 11, 13, 13);
        int cuoiCot = 10;
        int r = dauTrang(s, tin, "DANH SÁCH KHÁCH MUA TRONG KỲ", cuoiCot, dongKy, "Xếp theo doanh thu, lớn trước");
        int h = r;
        tieuDe(s, r++, 45, "STT", "Mã khách hàng", "Tên khách hàng", "Số điện thoại", "Email", "Khách", "Số đơn",
                "Doanh thu", "Tỷ trọng doanh thu", "Mua lần đầu", "Mua gần nhất trong kỳ");
        int dau = r;
        int cuoi = dau + d.khach().size() - 1;
        int rCong = cuoi + 1;
        double tongDt = d.khach().stream().mapToDouble(kh -> kh.doanhThu() == null ? 0 : kh.doanhThu().doubleValue()).sum();
        long tongDon = d.khach().stream().mapToLong(KhachMua::soDon).sum();
        int stt = 1;
        for (KhachMua kh : d.khach()) {
            Row row = s.createRow(r);
            so(row, 0, stt++, k("soGiua"));
            o(row, 1, kh.ma(), k("chu"));
            o(row, 2, kh.ten(), k("chuXuong"));
            o(row, 3, kh.soDienThoai(), k("chu"));
            o(row, 4, kh.email(), k("chuXuong"));
            o(row, 5, kh.khachMoi() ? "Mới" : "Quay lại", k("stt"));
            so(row, 6, kh.soDon(), k("so"));
            so(row, 7, kh.doanhThu(), k("tien"));
            fCo(row, 8, "IF($H$" + (rCong + 1) + "=0,\"\"," + ref(r, 7) + "/$H$" + (rCong + 1) + ")",
                    tongDt == 0 ? null : (kh.doanhThu() == null ? 0 : kh.doanhThu().doubleValue()) / tongDt, k("tyLe"));
            ngay(row, 9, kh.lanDauMua() == null ? null : kh.lanDauMua().toLocalDate());
            ngay(row, 10, kh.muaGanNhat() == null ? null : kh.muaGanNhat().toLocalDate());
            r++;
        }
        Row cong = dongCong(s, r, cuoiCot, 2, "Cộng (" + d.khach().size() + " khách)");
        fCo(cong, 6, tongCot(dau, cuoi, 6, true), (double) tongDon, k("congSo"));
        fCo(cong, 7, tongCot(dau, cuoi, 7, true), tongDt, k("congTien"));
        fCo(cong, 8, "IF(" + ref(r, 7) + "=0,\"\",1)", tongDt == 0 ? null : 1.0, k("congTyLe"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Dòng Cộng tự tính lại khi lọc; tỷ trọng so với doanh thu của cả danh sách.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(3, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, cuoiCot));
        inTrang(s, true, h, h);
    }

    private static long soLong(Long v) {
        return v == null ? 0 : v;
    }
}
