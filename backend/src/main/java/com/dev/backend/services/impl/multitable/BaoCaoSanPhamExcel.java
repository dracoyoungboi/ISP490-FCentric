package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.BaoCaoSanPhamDTO;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Tệp Excel của Báo cáo sản phẩm theo khuôn chung (KhuonExcelBaoCao), như tệp Báo cáo doanh thu:
 * - Đầu trang: tên đơn vị, địa chỉ, mã số thuế; tên báo cáo; kỳ báo cáo, kỳ so sánh; phạm vi (kho, kênh); đơn vị tính.
 * - Số là ô số thật, #,##0, số âm trong ngoặc, 0 hiện "-"; tỷ lệ dạng %. Cột tính (lợi nhuận, biên lãi, tỷ trọng, tỷ lệ
 *   hoàn, tăng / giảm, đủ bán) và dòng Cộng là công thức, đã tính sẵn giá trị để xem trước không cần mở Excel.
 * - Bảng: tiêu đề cột in đậm có nền, kẻ khung mảnh; cố định dòng tiêu đề và cột tên; lọc ở các bảng chi tiết.
 * - In: A4, vừa chiều ngang một trang, lặp dòng tiêu đề bảng mỗi trang, chân trang "Trang x/y".
 * - Bốn trang: Tổng hợp (kèm chữ ký), Theo sản phẩm, Theo mã SKU, Theo ngày.
 * Phông Times New Roman như sổ sách kế toán.
 */
public final class BaoCaoSanPhamExcel extends KhuonExcelBaoCao {

    private static final Map<String, String> TINH_TRANG = Map.of(
            "BAN_CHAY_SAP_HET", "Sắp hết hàng",
            "DU_HANG", "Dư hàng",
            "KHONG_BAN", "Không bán trong kỳ",
            "HET_HANG", "Hết hàng",
            "BINH_THUONG", "Bình thường");

    private BaoCaoSanPhamExcel() {
    }

    public static byte[] tao(BaoCaoSanPhamDTO bc, ThongTin tin) {
        BaoCaoSanPhamExcel x = new BaoCaoSanPhamExcel();
        x.sheetTongHop(bc, tin);
        x.sheetSanPham(bc, tin);
        x.sheetSku(bc, tin);
        x.sheetNgay(bc, tin);
        return x.xuat("Báo cáo bán hàng theo sản phẩm", tin);
    }

    private static String dongKy(BaoCaoSanPhamDTO bc) {
        return "Kỳ báo cáo: " + khoang(bc.getTuNgay(), bc.getDenNgay()) + " (" + bc.getSoNgay() + " ngày)";
    }

    private static String dongSoSanh(BaoCaoSanPhamDTO bc) {
        return "So với kỳ trước: " + khoang(bc.getTuNgayTruoc(), bc.getDenNgayTruoc());
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        int[] rong = {6, 38, 12, 17, 17, 16, 17, 12};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        s.setDisplayGridlines(false);
        int r = dauTrang(s, tin, "BÁO CÁO BÁN HÀNG THEO SẢN PHẨM", 7, dongKy(bc), dongSoSanh(bc));
        BaoCaoSanPhamDTO.Tong t = bc.getTong();

        // --- I. Kết quả bán hàng ---
        o(s, r++, 0, "I. KẾT QUẢ BÁN HÀNG (theo ngày giao hàng)", k("muc"));
        tieuDe(s, r, 30, "STT", "Chỉ tiêu", "Đơn vị", "Kỳ này", "Kỳ trước", "Chênh lệch", "Tăng / giảm", "");
        gop(s, r++, 6, 7);
        int dauI = r;
        int rSl = r;
        dongSoSanh(s, r++, "1", "Số lượng bán", "sản phẩm", t.getSoLuong(), t.getSoLuongTruoc(), true, "so");
        int rDt = r;
        dongSoSanh(s, r++, "2", "Doanh thu hàng", "đồng", t.getDoanhThu(), t.getDoanhThuTruoc(), true, "tien");
        int rGv = r;
        dongSoSanh(s, r++, "3", "Giá vốn hàng bán", "đồng", t.getGiaVon(), t.getGiaVonTruoc(), false, "tien");
        int rLn = r;
        Row ln = s.createRow(r++);
        o(ln, 0, "4", k("stt"));
        o(ln, 1, "Lợi nhuận gộp (4 = 2 − 3)", k("chuDam"));
        o(ln, 2, "đồng", k("dvO"));
        f(ln, 3, ref(rDt, 3) + "-" + ref(rGv, 3), k("tienDam"));
        f(ln, 4, ref(rDt, 4) + "-" + ref(rGv, 4), k("tienDam"));
        f(ln, 5, ref(rLn, 3) + "-" + ref(rLn, 4), k("tienDam"));
        f(ln, 6, "IF(" + ref(rLn, 4) + "=0,\"\"," + ref(rLn, 5) + "/ABS(" + ref(rLn, 4) + "))", k("tyLe"));
        Row bien = s.createRow(r);
        o(bien, 0, "5", k("stt"));
        o(bien, 1, "Biên lợi nhuận gộp (5 = 4 / 2)", k("chu"));
        o(bien, 2, "%", k("dvO"));
        f(bien, 3, "IF(" + ref(rDt, 3) + "=0,\"\"," + ref(rLn, 3) + "/" + ref(rDt, 3) + ")", k("tyLe"));
        f(bien, 4, "IF(" + ref(rDt, 4) + "=0,\"\"," + ref(rLn, 4) + "/" + ref(rDt, 4) + ")", k("tyLe"));
        f(bien, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 4) + "=\"\"),\"\"," + ref(r, 3) + "-" + ref(r, 4) + ")", k("tyLe"));
        o(bien, 6, "điểm %", k("ghiChuO"));
        r++;
        int rDon = r;
        dongSoSanh(s, r++, "6", "Số đơn đã giao", "đơn", BigDecimal.valueOf(t.getSoDon()), BigDecimal.valueOf(t.getSoDonTruoc()), false, "so");
        Row tb = s.createRow(r);
        o(tb, 0, "7", k("stt"));
        o(tb, 1, "Số sản phẩm bình quân một đơn (7 = 1 / 6)", k("chu"));
        o(tb, 2, "sản phẩm", k("dvO"));
        f(tb, 3, "IF(" + ref(rDon, 3) + "=0,\"\"," + ref(rSl, 3) + "/" + ref(rDon, 3) + ")", k("thapPhan"));
        f(tb, 4, "IF(" + ref(rDon, 4) + "=0,\"\"," + ref(rSl, 4) + "/" + ref(rDon, 4) + ")", k("thapPhan"));
        f(tb, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 4) + "=\"\"),\"\"," + ref(r, 3) + "-" + ref(r, 4) + ")", k("thapPhan"));
        f(tb, 6, "IF(OR(" + ref(r, 4) + "=\"\"," + ref(r, 4) + "=0),\"\"," + ref(r, 5) + "/" + ref(r, 4) + ")", k("tyLe"));
        r++;
        int rHoan = r;
        dongSoSanh(s, r++, "8", "Số lượng bị hoàn trả", "sản phẩm", t.getSoLuongHoan(), t.getSoLuongHoanTruoc(), false, "so");
        Row tl = s.createRow(r);
        o(tl, 0, "9", k("stt"));
        o(tl, 1, "Tỷ lệ hoàn (9 = 8 / (1 + 8))", k("chu"));
        o(tl, 2, "%", k("dvO"));
        f(tl, 3, "IF(" + ref(rSl, 3) + "+" + ref(rHoan, 3) + "=0,\"\"," + ref(rHoan, 3) + "/(" + ref(rSl, 3) + "+" + ref(rHoan, 3) + "))", k("tyLe"));
        f(tl, 4, "IF(" + ref(rSl, 4) + "+" + ref(rHoan, 4) + "=0,\"\"," + ref(rHoan, 4) + "/(" + ref(rSl, 4) + "+" + ref(rHoan, 4) + "))", k("tyLe"));
        f(tl, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 4) + "=\"\"),\"\"," + ref(r, 3) + "-" + ref(r, 4) + ")", k("tyLe"));
        o(tl, 6, "điểm %", k("ghiChuO"));
        r++;
        dongSoSanh(s, r++, "10", "Số sản phẩm có bán", "sản phẩm", BigDecimal.valueOf(t.getSoSanPhamCoBan()),
                BigDecimal.valueOf(t.getSoSanPhamCoBanTruoc()), false, "so");
        for (int i = dauI; i < r; i++) {
            Row row = s.getRow(i);
            CellStyle st = row.getCell(6) == null ? k("tyLe") : row.getCell(6).getCellStyle();
            Cell c7 = row.createCell(7);
            c7.setCellStyle(st);
            gop(s, i, 6, 7);
        }
        r++;

        // --- II, III. Theo danh mục, theo thương hiệu ---
        r = bangNhom(s, r, "II. THEO DANH MỤC", "Danh mục", bc, BaoCaoSanPhamDTO.SanPham::getDanhMuc);
        r = bangNhom(s, r, "III. THEO THƯƠNG HIỆU", "Thương hiệu", bc, BaoCaoSanPhamDTO.SanPham::getThuongHieu);

        // --- IV. Phân nhóm A, B, C ---
        o(s, r++, 0, "IV. PHÂN NHÓM THEO DOANH THU CỘNG DỒN", k("muc"));
        tieuDe(s, r++, 30, "STT", "Nhóm", "Số sản phẩm", "Số lượng bán", "Doanh thu", "Tỷ trọng doanh thu", "Lợi nhuận gộp", "Biên lãi");
        int dauAbc = r;
        String[][] nhom = {{"A", "Nhóm A (cộng dồn tới 80% doanh thu)"}, {"B", "Nhóm B (từ 80% tới 95%)"}, {"C", "Nhóm C (5% còn lại)"}};
        for (int i = 0; i < nhom.length; i++) {
            String n = nhom[i][0];
            List<BaoCaoSanPhamDTO.SanPham> ds = bc.getSanPham().stream().filter(p -> n.equals(p.getNhomAbc())).toList();
            dongNhom(s, r++, String.valueOf(i + 1), nhom[i][1], ds, dauAbc, dauAbc + 2);
        }
        congNhom(s, r++, dauAbc, r - 2);
        r++;

        // --- V. Tình trạng hàng ---
        o(s, r++, 0, "V. TÌNH TRẠNG HÀNG (khả dụng hiện tại so với tốc độ bán trong kỳ)", k("muc"));
        int hV = r;
        tieuDe(s, r++, 30, "STT", "Tình trạng", "Số sản phẩm", "Khả dụng", "Giá trị tồn", "Cách xác định", "", "");
        gop(s, hV, 5, 7);
        String[][] tt = {
                {"BAN_CHAY_SAP_HET", "Có bán, còn hàng, khả dụng đủ bán dưới " + BaoCaoSanPhamService.SAP_HET_DUOI_NGAY + " ngày"},
                {"DU_HANG", "Có bán, khả dụng đủ bán trên " + BaoCaoSanPhamService.DU_HANG_TREN_NGAY + " ngày"},
                {"KHONG_BAN", "Còn hàng nhưng không phát sinh bán trong kỳ; không tính sản phẩm mới về kho trong kỳ"},
                {"HET_HANG", "Khả dụng bằng 0 (kể cả sản phẩm đang bán)"},
                {"BINH_THUONG", "Còn lại"}};
        int dauTt = r;
        for (int i = 0; i < tt.length; i++) {
            String ma = tt[i][0];
            List<BaoCaoSanPhamDTO.SanPham> ds = bc.getSanPham().stream().filter(p -> ma.equals(p.getTinhTrang())).toList();
            Row row = s.createRow(r);
            row.setHeightInPoints(30);
            o(row, 0, String.valueOf(i + 1), k("stt"));
            o(row, 1, TINH_TRANG.get(ma), k(ma.equals("BAN_CHAY_SAP_HET") ? "chuDo" : "chu"));
            so(row, 2, BigDecimal.valueOf(ds.size()), k("so"));
            so(row, 3, cong(ds, BaoCaoSanPhamDTO.SanPham::getKhaDung), k("so"));
            so(row, 4, cong(ds, BaoCaoSanPhamDTO.SanPham::getGiaTriTon), k("tien"));
            o(row, 5, tt[i][1], k("ghiChuO"));
            o(row, 6, "", k("ghiChuO"));
            o(row, 7, "", k("ghiChuO"));
            gop(s, r, 5, 7);
            r++;
        }
        Row ctt = s.createRow(r);
        o(ctt, 0, "", k("congChu"));
        o(ctt, 1, "Cộng", k("congChu"));
        f(ctt, 2, "SUM(" + ref(dauTt, 2) + ":" + ref(r - 1, 2) + ")", k("congSo"));
        f(ctt, 3, "SUM(" + ref(dauTt, 3) + ":" + ref(r - 1, 3) + ")", k("congSo"));
        f(ctt, 4, "SUM(" + ref(dauTt, 4) + ":" + ref(r - 1, 4) + ")", k("congTien"));
        for (int c = 5; c <= 7; c++) o(ctt, c, "", k("congChu"));
        gop(s, r, 5, 7);
        r += 2;

        // --- Ghi chú cách tính ---
        String[] ghi = {
                "Ghi chú:",
                "- Chỉ tính đơn bán đã xuất kho toàn bộ hoặc hoàn thành, theo ngày giao hàng; đơn bị hoàn trả chỉ tính vào mục 8.",
                "- Doanh thu hàng = thành tiền trên dòng đơn trừ giảm giá dòng, đã gồm thuế GTGT, chưa gồm phí vận chuyển.",
                "  Doanh thu hàng thường bằng doanh thu của Báo cáo doanh thu trừ phí vận chuyển; đơn sàn có tổng tiền hàng khác tổng các dòng thì lệch đúng phần chênh đó.",
                "- Giá vốn tính theo lô đã xuất trên phiếu xuất kho hoàn tất của các đơn trên.",
                "- Khả dụng, đang về, giá trị tồn là số tại thời điểm lập báo cáo, không theo kỳ. Đủ bán = khả dụng / (số lượng bán / số ngày của kỳ).",
                "- Kỳ trước là khoảng ngày liền trước kỳ báo cáo, cùng số ngày.",
        };
        for (String g : ghi) o(s, r++, 0, g, k(g.equals("Ghi chú:") ? "ghiChuDam" : "ghiChu"));
        if (bc.isTheoKhoPhuTrach()) o(s, r++, 0, "- Chỉ tính các cửa hàng người lập phụ trách.", k("ghiChu"));
        r++;
        chuKy(s, r, tin, 7);

        inTrang(s, false, -1, -1);
        long soNhom = bc.getSanPham().stream().map(BaoCaoSanPhamDTO.SanPham::getDanhMuc).distinct().count()
                + bc.getSanPham().stream().map(BaoCaoSanPhamDTO.SanPham::getThuongHieu).distinct().count();
        if (soNhom <= 24) s.getPrintSetup().setFitHeight((short) 1);
    }

    private void dongSoSanh(Sheet s, int r, String stt, String ten, String dv, BigDecimal nay, BigDecimal truoc,
                            boolean dam, String loai) {
        Row row = s.createRow(r);
        String st = loai + (dam ? "Dam" : "");
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k(dam ? "chuDam" : "chu"));
        o(row, 2, dv, k("dvO"));
        so(row, 3, nay, k(st));
        so(row, 4, truoc, k(st));
        f(row, 5, ref(r, 3) + "-" + ref(r, 4), k(st));
        f(row, 6, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 5) + "/ABS(" + ref(r, 4) + "))", k("tyLe"));
    }

    /** Bảng gộp theo danh mục / thương hiệu (doanh thu lớn trước), kèm dòng Cộng. Trả dòng kế tiếp (đã chừa một dòng). */
    private int bangNhom(Sheet s, int r, String tieuDeMuc, String tenCot, BaoCaoSanPhamDTO bc,
                         Function<BaoCaoSanPhamDTO.SanPham, String> khoa) {
        o(s, r++, 0, tieuDeMuc, k("muc"));
        tieuDe(s, r++, 30, "STT", tenCot, "Số sản phẩm", "Số lượng bán", "Doanh thu", "Tỷ trọng doanh thu", "Lợi nhuận gộp", "Biên lãi");
        Map<String, List<BaoCaoSanPhamDTO.SanPham>> m = new LinkedHashMap<>();
        bc.getSanPham().forEach(p -> m.computeIfAbsent(khoa.apply(p), x -> new ArrayList<>()).add(p));
        List<Map.Entry<String, List<BaoCaoSanPhamDTO.SanPham>>> ds = new ArrayList<>(m.entrySet());
        ds.sort((a, b) -> cong(b.getValue(), BaoCaoSanPhamDTO.SanPham::getDoanhThu).compareTo(cong(a.getValue(), BaoCaoSanPhamDTO.SanPham::getDoanhThu)));
        int dau = r;
        int cuoi = dau + ds.size() - 1;
        int stt = 1;
        for (Map.Entry<String, List<BaoCaoSanPhamDTO.SanPham>> e : ds) dongNhom(s, r++, String.valueOf(stt++), e.getKey(), e.getValue(), dau, cuoi);
        congNhom(s, r++, dau, r - 2);
        return r + 1;
    }

    private void dongNhom(Sheet s, int r, String stt, String ten, List<BaoCaoSanPhamDTO.SanPham> ds, int dau, int cuoi) {
        Row row = s.createRow(r);
        o(row, 0, stt, k("stt"));
        o(row, 1, ten, k("chu"));
        so(row, 2, BigDecimal.valueOf(ds.size()), k("so"));
        so(row, 3, cong(ds, BaoCaoSanPhamDTO.SanPham::getSoLuong), k("so"));
        so(row, 4, cong(ds, BaoCaoSanPhamDTO.SanPham::getDoanhThu), k("tien"));
        // Tỷ trọng so với dòng Cộng ngay dưới bảng
        String tongDt = "$E$" + (cuoi + 2);
        f(row, 5, "IF(" + tongDt + "=0,\"\"," + ref(r, 4) + "/" + tongDt + ")", k("tyLe"));
        so(row, 6, cong(ds, BaoCaoSanPhamDTO.SanPham::getLoiNhuan), k("tien"));
        f(row, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("tyLe"));
    }

    private void congNhom(Sheet s, int r, int dau, int cuoi) {
        Row cong = s.createRow(r);
        o(cong, 0, "", k("congChu"));
        o(cong, 1, "Cộng", k("congChu"));
        for (int c : new int[]{2, 3, 4, 6}) {
            f(cong, c, cuoi < dau ? "0" : "SUM(" + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c == 4 || c == 6 ? "congTien" : "congSo"));
        }
        f(cong, 5, "IF(" + ref(r, 4) + "=0,\"\",1)", k("congTyLe"));
        f(cong, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("congTyLe"));
    }

    // ================= Trang 2: Theo sản phẩm =================

    private void sheetSanPham(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Theo sản phẩm");
        //            STT Hạng Mã  Tên Dm  TH  ĐVT SL  Đơn DT  TT  GV  LN  Biên Hoàn TLH SLT TG  HạngT KD VềTồn Đủ  ABC TT  Bán cuối
        int[] rong = {5, 6, 12, 30, 11, 10, 6, 9, 7, 13, 9, 13, 13, 8, 8, 8, 9, 9, 6, 9, 9, 13, 8, 6, 13, 11};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        int cuoiCot = rong.length - 1;
        int r = dauTrang(s, tin, "CHI TIẾT BÁN HÀNG THEO SẢN PHẨM", cuoiCot, dongKy(bc), dongSoSanh(bc));

        int h1 = r;
        Row nhom = s.createRow(r++);
        Row ten = s.createRow(r++);
        ten.setHeightInPoints(45);
        String[] tenCot = {"STT", "Hạng", "Mã sản phẩm", "Tên sản phẩm", "Danh mục", "Thương hiệu", "Đơn vị tính",
                "Số lượng bán", "Số đơn", "Doanh thu hàng", "Tỷ trọng doanh thu", "Giá vốn", "Lợi nhuận gộp", "Biên lãi",
                "Số lượng hoàn", "Tỷ lệ hoàn",
                "Số lượng bán kỳ trước", "Tăng / giảm số lượng", "Hạng kỳ trước",
                "Khả dụng", "Đang về", "Giá trị tồn", "Đủ bán (ngày)",
                "Nhóm ABC", "Tình trạng", "Bán gần nhất"};
        for (int i = 0; i < tenCot.length; i++) {
            o(nhom, i, "", k("tieuDeCot"));
            o(ten, i, tenCot[i], k("tieuDeCot"));
        }
        for (int i : new int[]{0, 1, 2, 3, 4, 5, 6, 23, 24, 25}) {
            o(nhom, i, tenCot[i], k("tieuDeCot"));
            s.addMergedRegion(new CellRangeAddress(h1, h1 + 1, i, i));
        }
        o(nhom, 7, "Kỳ này", k("tieuDeCot"));
        gop(s, h1, 7, 15);
        o(nhom, 16, "Kỳ trước", k("tieuDeCot"));
        gop(s, h1, 16, 18);
        o(nhom, 19, "Tồn kho hiện tại", k("tieuDeCot"));
        gop(s, h1, 19, 22);

        List<BaoCaoSanPhamDTO.SanPham> ds = bc.getSanPham();
        int dau = r;
        int cuoi = dau + ds.size() - 1;
        int dongCong = cuoi + 1;
        int stt = 1;
        for (BaoCaoSanPhamDTO.SanPham p : ds) {
            Row row = s.createRow(r);
            so(row, 0, BigDecimal.valueOf(stt++), k("soGiua"));
            if (p.getHang() != null) so(row, 1, BigDecimal.valueOf(p.getHang()), k("soGiua")); else o(row, 1, "", k("stt"));
            o(row, 2, p.getMaSanPham(), k("chu"));
            o(row, 3, p.getTenSanPham(), k("chuXuong"));
            o(row, 4, p.getDanhMuc(), k("chuXuong"));
            o(row, 5, p.getThuongHieu(), k("chuXuong"));
            o(row, 6, p.getDonViTinh(), k("stt"));
            so(row, 7, p.getSoLuong(), k("so"));
            so(row, 8, BigDecimal.valueOf(p.getSoDon()), k("so"));
            so(row, 9, p.getDoanhThu(), k("tien"));
            f(row, 10, "IF($J$" + (dongCong + 1) + "=0,\"\"," + ref(r, 9) + "/$J$" + (dongCong + 1) + ")", k("tyLe"));
            so(row, 11, p.getGiaVon(), k("tien"));
            f(row, 12, ref(r, 9) + "-" + ref(r, 11), k("tien"));
            f(row, 13, "IF(" + ref(r, 9) + "=0,\"\"," + ref(r, 12) + "/" + ref(r, 9) + ")", k("tyLe"));
            so(row, 14, p.getSoLuongHoan(), k("so"));
            f(row, 15, "IF(" + ref(r, 7) + "+" + ref(r, 14) + "=0,\"\"," + ref(r, 14) + "/(" + ref(r, 7) + "+" + ref(r, 14) + "))", k("tyLe"));
            so(row, 16, p.getSoLuongTruoc(), k("so"));
            f(row, 17, "IF(" + ref(r, 16) + "=0,IF(" + ref(r, 7) + ">0,\"Mới\",\"\"),(" + ref(r, 7) + "-" + ref(r, 16) + ")/" + ref(r, 16) + ")", k("tyLe"));
            if (p.getHangTruoc() != null) so(row, 18, BigDecimal.valueOf(p.getHangTruoc()), k("soGiua")); else o(row, 18, "", k("stt"));
            so(row, 19, p.getKhaDung(), k("so"));
            so(row, 20, p.getDangVe(), k("so"));
            so(row, 21, p.getGiaTriTon(), k("tien"));
            f(row, 22, "IF(" + ref(r, 7) + "=0,\"\"," + ref(r, 19) + "/(" + ref(r, 7) + "/" + bc.getSoNgay() + "))", k("ngayBan"));
            o(row, 23, p.getNhomAbc() == null ? "" : p.getNhomAbc(), k("stt"));
            String tt = TINH_TRANG.getOrDefault(p.getTinhTrang(), "");
            o(row, 24, tt, k("BAN_CHAY_SAP_HET".equals(p.getTinhTrang()) ? "chuDo" : "chuXuong"));
            ngay(row, 25, p.getNgayBanCuoi());
            r++;
        }
        Row cong = s.createRow(r);
        for (int c = 0; c <= cuoiCot; c++) o(cong, c, "", k("congChu"));
        o(cong, 3, "Cộng (" + ds.size() + " sản phẩm)", k("congChu"));
        for (int c : new int[]{7, 9, 11, 12, 14, 16, 19, 20, 21}) {
            f(cong, c, ds.isEmpty() ? "0" : "SUBTOTAL(109," + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c == 9 || c == 11 || c == 12 || c == 21 ? "congTien" : "congSo"));
        }
        so(cong, 8, BigDecimal.valueOf(bc.getTong().getSoDon()), k("congSo"));
        f(cong, 10, "IF(" + ref(r, 9) + "=0,\"\",1)", k("congTyLe"));
        f(cong, 13, "IF(" + ref(r, 9) + "=0,\"\"," + ref(r, 12) + "/" + ref(r, 9) + ")", k("congTyLe"));
        f(cong, 15, "IF(" + ref(r, 7) + "+" + ref(r, 14) + "=0,\"\"," + ref(r, 14) + "/(" + ref(r, 7) + "+" + ref(r, 14) + "))", k("congTyLe"));
        f(cong, 17, "IF(" + ref(r, 16) + "=0,\"\",(" + ref(r, 7) + "-" + ref(r, 16) + ")/" + ref(r, 16) + ")", k("congTyLe"));
        f(cong, 22, ds.isEmpty() ? "\"\"" : "IF(" + ref(r, 7) + "=0,\"\",SUMIF(" + ref(dau, 7) + ":" + ref(cuoi, 7) + ",\">0\"," + ref(dau, 19) + ":" + ref(cuoi, 19) + ")/(" + ref(r, 7) + "/" + bc.getSoNgay() + "))", k("congNgayBan"));
        r += 2;
        o(s, r++, 2, "Ghi chú: Dòng Cộng tự tính lại khi lọc. Số đơn ở dòng Cộng là số đơn khác nhau của cả kỳ (đơn có nhiều sản phẩm chỉ đếm một lần).", k("ghiChu"));
        o(s, r++, 2, "Hạng xếp theo số lượng bán; bằng nhau thì xếp theo doanh thu. Nhóm ABC theo doanh thu cộng dồn: A tới 80%, B tới 95%, C phần còn lại.", k("ghiChu"));
        o(s, r++, 2, "Đủ bán = khả dụng hiện tại / (số lượng bán / " + bc.getSoNgay() + " ngày); ở dòng Cộng chỉ tính sản phẩm có bán. Sắp hết hàng: dưới "
                + BaoCaoSanPhamService.SAP_HET_DUOI_NGAY + " ngày; dư hàng: trên " + BaoCaoSanPhamService.DU_HANG_TREN_NGAY + " ngày.", k("ghiChu"));
        o(s, r, 2, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(4, h1 + 2);
        if (!ds.isEmpty()) s.setAutoFilter(new CellRangeAddress(h1 + 1, cuoi, 0, cuoiCot));
        inTrang(s, true, h1, h1 + 1);
    }

    // ================= Trang 3: Theo mã SKU =================

    private void sheetSku(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Theo mã SKU");
        //            STT Mã SP Tên Mã SKU Màu Size Giá SL  DT  GV  LN  Biên Hoàn KD  Về  Đủ
        int[] rong = {6, 13, 34, 30, 12, 8, 13, 10, 14, 14, 14, 9, 9, 10, 9, 10};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        int cuoiCot = rong.length - 1;
        int r = dauTrang(s, tin, "CHI TIẾT BÁN HÀNG THEO MÃ SKU", cuoiCot, dongKy(bc), "Khả dụng, đang về: số tại thời điểm lập báo cáo");
        int h = r;
        tieuDe(s, r++, 45, "STT", "Mã sản phẩm", "Tên sản phẩm", "Mã SKU", "Màu", "Size", "Giá bán hiện tại",
                "Số lượng bán", "Doanh thu hàng", "Giá vốn", "Lợi nhuận gộp", "Biên lãi", "Số lượng hoàn", "Khả dụng", "Đang về",
                "Đủ bán (ngày)");
        int dau = r;
        int stt = 1;
        for (BaoCaoSanPhamDTO.SanPham p : bc.getSanPham()) {
            for (BaoCaoSanPhamDTO.BienThe b : p.getBienThe()) {
                Row row = s.createRow(r);
                so(row, 0, BigDecimal.valueOf(stt++), k("soGiua"));
                o(row, 1, p.getMaSanPham(), k("chu"));
                o(row, 2, p.getTenSanPham(), k("chuXuong"));
                o(row, 3, b.getMaSku(), k("chuXuong"));
                o(row, 4, b.getMau() == null ? "" : b.getMau(), k("chu"));
                o(row, 5, b.getSize() == null ? "" : b.getSize(), k("stt"));
                so(row, 6, b.getGiaBan(), k("tien"));
                so(row, 7, b.getSoLuong(), k("so"));
                so(row, 8, b.getDoanhThu(), k("tien"));
                so(row, 9, b.getGiaVon(), k("tien"));
                f(row, 10, ref(r, 8) + "-" + ref(r, 9), k("tien"));
                f(row, 11, "IF(" + ref(r, 8) + "=0,\"\"," + ref(r, 10) + "/" + ref(r, 8) + ")", k("tyLe"));
                so(row, 12, b.getSoLuongHoan(), k("so"));
                so(row, 13, b.getKhaDung(), k("so"));
                so(row, 14, b.getDangVe(), k("so"));
                f(row, 15, "IF(" + ref(r, 7) + "=0,\"\"," + ref(r, 13) + "/(" + ref(r, 7) + "/" + bc.getSoNgay() + "))", k("ngayBan"));
                r++;
            }
        }
        int cuoi = r - 1;
        Row cong = s.createRow(r);
        for (int c = 0; c <= cuoiCot; c++) o(cong, c, "", k("congChu"));
        o(cong, 2, "Cộng (" + (stt - 1) + " mã)", k("congChu"));
        for (int c : new int[]{7, 8, 9, 10, 12, 13, 14}) {
            f(cong, c, cuoi < dau ? "0" : "SUBTOTAL(109," + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c >= 8 && c <= 10 ? "congTien" : "congSo"));
        }
        f(cong, 11, "IF(" + ref(r, 8) + "=0,\"\"," + ref(r, 10) + "/" + ref(r, 8) + ")", k("congTyLe"));
        f(cong, 15, cuoi < dau ? "\"\"" : "IF(" + ref(r, 7) + "=0,\"\",SUMIF(" + ref(dau, 7) + ":" + ref(cuoi, 7) + ",\">0\"," + ref(dau, 13) + ":" + ref(cuoi, 13) + ")/(" + ref(r, 7) + "/" + bc.getSoNgay() + "))", k("congNgayBan"));
        r += 2;
        o(s, r++, 1, "Ghi chú: Giá bán hiện tại là giá đang cài cho mã; doanh thu theo giá thực bán trên từng đơn.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(3, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, cuoiCot));
        inTrang(s, true, h, h);
    }

    // ================= Trang 4: Theo ngày =================

    private void sheetNgay(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Theo ngày");
        int[] rong = {6, 14, 12, 16, 18, 18};
        for (int i = 0; i < rong.length; i++) s.setColumnWidth(i, rong[i] * 256);
        int r = dauTrang(s, tin, "SỐ LƯỢNG BÁN VÀ DOANH THU HÀNG THEO NGÀY", 5, dongKy(bc), "Theo ngày giao hàng");
        int h = r;
        tieuDe(s, r++, 30, "STT", "Ngày", "Thứ", "Số lượng bán", "Doanh thu hàng", "Giá bán bình quân");
        int dau = r;
        int stt = 1;
        for (BaoCaoSanPhamDTO.Ngay n : bc.getTheoNgay()) {
            Row row = s.createRow(r);
            so(row, 0, BigDecimal.valueOf(stt++), k("soGiua"));
            ngay(row, 1, n.getNgay());
            o(row, 2, thu(n.getNgay().getDayOfWeek()), k("stt"));
            so(row, 3, n.getSoLuong(), k("so"));
            so(row, 4, n.getDoanhThu(), k("tien"));
            f(row, 5, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 4) + "/" + ref(r, 3) + ")", k("tien"));
            r++;
        }
        int cuoi = r - 1;
        Row cong = s.createRow(r);
        o(cong, 0, "", k("congChu"));
        o(cong, 1, "Cộng", k("congChu"));
        o(cong, 2, "", k("congChu"));
        f(cong, 3, cuoi < dau ? "0" : "SUBTOTAL(109," + ref(dau, 3) + ":" + ref(cuoi, 3) + ")", k("congSo"));
        f(cong, 4, cuoi < dau ? "0" : "SUBTOTAL(109," + ref(dau, 4) + ":" + ref(cuoi, 4) + ")", k("congTien"));
        f(cong, 5, "IF(" + ref(r, 3) + "=0,\"\"," + ref(r, 4) + "/" + ref(r, 3) + ")", k("congTien"));
        r += 2;
        o(s, r, 1, lapLuc(tin), k("ghiChu"));
        s.createFreezePane(0, h + 1);
        inTrang(s, false, h, h);
    }

    private static String thu(DayOfWeek d) {
        return d == DayOfWeek.SUNDAY ? "Chủ nhật" : "Thứ " + (d.getValue() + 1);
    }

    // ================= Dùng chung =================

    private static BigDecimal cong(List<BaoCaoSanPhamDTO.SanPham> ds, Function<BaoCaoSanPhamDTO.SanPham, BigDecimal> f) {
        return ds.stream().map(f).map(x -> x == null ? BigDecimal.ZERO : x).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
