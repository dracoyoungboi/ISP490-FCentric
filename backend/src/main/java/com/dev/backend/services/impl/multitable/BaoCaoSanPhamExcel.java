package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.BaoCaoSanPhamDTO;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellReference;

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
 *   hoàn, tăng / giảm) và dòng Cộng là công thức, đã tính sẵn giá trị để xem trước không cần mở Excel. Đủ bán từng dòng
 *   là số máy chủ tính (số bán mọi kênh, số ngày bán), như màn hình.
 * - Bảng: tiêu đề cột in đậm có nền, kẻ khung mảnh; cố định dòng tiêu đề và cột tên; lọc ở các bảng chi tiết.
 * - In: A4, vừa chiều ngang một trang, lặp dòng tiêu đề bảng mỗi trang, chân trang "Trang x/y".
 * - Bốn trang: Tổng hợp (kèm chữ ký), Theo sản phẩm, Theo mã SKU, Theo ngày.
 * Phông Times New Roman như sổ sách kế toán.
 * <p>
 * Báo cáo đã bỏ giá vốn ({@code coGiaVon = false}, người tải là nhân viên bán hàng — SRS 2.4.1) thì tệp bỏ hẳn giá vốn,
 * lợi nhuận gộp, biên lãi, giá trị tồn (cột, dòng, ghi chú): để trống sẽ khiến công thức lợi nhuận ra bằng doanh thu.
 */
public final class BaoCaoSanPhamExcel extends KhuonExcelBaoCao {

    private static final Map<String, String> TINH_TRANG = Map.of(
            "BAN_CHAY_SAP_HET", "Sắp hết hàng",
            "DU_HANG", "Dư hàng",
            "KHONG_BAN", "Không bán trong kỳ",
            "HET_HANG", "Hết hàng",
            "BINH_THUONG", "Bình thường");

    private final boolean gv;

    private BaoCaoSanPhamExcel(boolean gv) {
        this.gv = gv;
    }

    public static byte[] tao(BaoCaoSanPhamDTO bc, ThongTin tin) {
        BaoCaoSanPhamExcel x = new BaoCaoSanPhamExcel(bc.isCoGiaVon());
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
        if (gv) {
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
        }
        // Không có giá vốn: bỏ mục 3–5, các mục sau đánh lại số (số đơn 3, bình quân 4, hoàn 5, tỷ lệ hoàn 6, có bán 7)
        String sDon = gv ? "6" : "3";
        String sTb = gv ? "7" : "4";
        String sHoan = gv ? "8" : "5";
        String sTl = gv ? "9" : "6";
        String sCoBan = gv ? "10" : "7";
        int rDon = r;
        dongSoSanh(s, r++, sDon, "Số đơn đã giao", "đơn", BigDecimal.valueOf(t.getSoDon()), BigDecimal.valueOf(t.getSoDonTruoc()), false, "so");
        Row tb = s.createRow(r);
        o(tb, 0, sTb, k("stt"));
        o(tb, 1, "Số sản phẩm bình quân một đơn (" + sTb + " = 1 / " + sDon + ")", k("chu"));
        o(tb, 2, "sản phẩm", k("dvO"));
        f(tb, 3, "IF(" + ref(rDon, 3) + "=0,\"\"," + ref(rSl, 3) + "/" + ref(rDon, 3) + ")", k("thapPhan"));
        f(tb, 4, "IF(" + ref(rDon, 4) + "=0,\"\"," + ref(rSl, 4) + "/" + ref(rDon, 4) + ")", k("thapPhan"));
        f(tb, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 4) + "=\"\"),\"\"," + ref(r, 3) + "-" + ref(r, 4) + ")", k("thapPhan"));
        f(tb, 6, "IF(OR(" + ref(r, 4) + "=\"\"," + ref(r, 4) + "=0),\"\"," + ref(r, 5) + "/" + ref(r, 4) + ")", k("tyLe"));
        r++;
        int rHoan = r;
        dongSoSanh(s, r++, sHoan, "Số lượng bị hoàn trả", "sản phẩm", t.getSoLuongHoan(), t.getSoLuongHoanTruoc(), false, "so");
        Row tl = s.createRow(r);
        o(tl, 0, sTl, k("stt"));
        o(tl, 1, "Tỷ lệ hoàn (" + sTl + " = " + sHoan + " / (1 + " + sHoan + "))", k("chu"));
        o(tl, 2, "%", k("dvO"));
        f(tl, 3, "IF(" + ref(rSl, 3) + "+" + ref(rHoan, 3) + "=0,\"\"," + ref(rHoan, 3) + "/(" + ref(rSl, 3) + "+" + ref(rHoan, 3) + "))", k("tyLe"));
        f(tl, 4, "IF(" + ref(rSl, 4) + "+" + ref(rHoan, 4) + "=0,\"\"," + ref(rHoan, 4) + "/(" + ref(rSl, 4) + "+" + ref(rHoan, 4) + "))", k("tyLe"));
        f(tl, 5, "IF(OR(" + ref(r, 3) + "=\"\"," + ref(r, 4) + "=\"\"),\"\"," + ref(r, 3) + "-" + ref(r, 4) + ")", k("tyLe"));
        o(tl, 6, "điểm %", k("ghiChuO"));
        r++;
        dongSoSanh(s, r++, sCoBan, "Số sản phẩm có bán", "sản phẩm", BigDecimal.valueOf(t.getSoSanPhamCoBan()),
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
        tieuDeNhom(s, r++, "Nhóm");
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
        // Không có giá vốn: bỏ cột Giá trị tồn, "Cách xác định" lùi về cột 4
        int cCach = gv ? 5 : 4;
        if (gv) tieuDe(s, r++, 30, "STT", "Tình trạng", "Số sản phẩm", "Khả dụng", "Giá trị tồn", "Cách xác định", "", "");
        else tieuDe(s, r++, 30, "STT", "Tình trạng", "Số sản phẩm", "Khả dụng", "Cách xác định", "", "", "");
        gop(s, hV, cCach, 7);
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
            if (gv) so(row, 4, cong(ds, BaoCaoSanPhamDTO.SanPham::getGiaTriTon), k("tien"));
            o(row, cCach, tt[i][1], k("ghiChuO"));
            for (int c = cCach + 1; c <= 7; c++) o(row, c, "", k("ghiChuO"));
            gop(s, r, cCach, 7);
            r++;
        }
        Row ctt = s.createRow(r);
        o(ctt, 0, "", k("congChu"));
        o(ctt, 1, "Cộng", k("congChu"));
        f(ctt, 2, "SUM(" + ref(dauTt, 2) + ":" + ref(r - 1, 2) + ")", k("congSo"));
        f(ctt, 3, "SUM(" + ref(dauTt, 3) + ":" + ref(r - 1, 3) + ")", k("congSo"));
        if (gv) f(ctt, 4, "SUM(" + ref(dauTt, 4) + ":" + ref(r - 1, 4) + ")", k("congTien"));
        for (int c = cCach; c <= 7; c++) o(ctt, c, "", k("congChu"));
        gop(s, r, cCach, 7);
        r += 2;

        // --- Ghi chú cách tính ---
        List<String> ghi = new ArrayList<>(List.of(
                "Ghi chú:",
                "- Chỉ tính đơn bán đã xuất kho toàn bộ hoặc hoàn thành, theo ngày giao hàng; đơn bị hoàn trả chỉ tính vào mục " + sHoan + ".",
                "- Hàng khách trả tại quầy trừ khỏi số lượng bán, doanh thu hàng" + (gv ? ", giá vốn (phần hàng Đạt nhập lại kho)" : "")
                        + " ở kỳ chứa ngày trả và tính vào mục " + sHoan + ".",
                "- Doanh thu hàng = thành tiền trên dòng đơn trừ giảm giá dòng, đã gồm thuế GTGT, chưa gồm phí vận chuyển.",
                "  Doanh thu hàng thường bằng doanh thu của Báo cáo doanh thu trừ phí vận chuyển; đơn sàn có tổng tiền hàng khác tổng các dòng thì lệch đúng phần chênh đó."));
        if (gv) ghi.add("- Giá vốn tính theo lô đã xuất trên phiếu xuất kho hoàn tất của các đơn trên.");
        ghi.add("- Khả dụng, đang về" + (gv ? ", giá trị tồn" : "")
                + " là số tại thời điểm lập báo cáo, không theo kỳ. Khả dụng đã trừ hàng đang giữ cho đơn chưa xuất và phiếu chuyển kho.");
        ghi.add("- Đủ bán = khả dụng / (số lượng bán mọi kênh / số ngày bán). Số ngày bán là số ngày của kỳ; hàng về kho lần đầu giữa kỳ thì tính từ ngày hàng về.");
        ghi.add("- Kỳ trước là khoảng ngày liền trước kỳ báo cáo, cùng số ngày.");
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
        tieuDeNhom(s, r++, tenCot);
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
        if (gv) {
            so(row, 6, cong(ds, BaoCaoSanPhamDTO.SanPham::getLoiNhuan), k("tien"));
            f(row, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("tyLe"));
        }
    }

    private void congNhom(Sheet s, int r, int dau, int cuoi) {
        Row cong = s.createRow(r);
        o(cong, 0, "", k("congChu"));
        o(cong, 1, "Cộng", k("congChu"));
        for (int c : gv ? new int[]{2, 3, 4, 6} : new int[]{2, 3, 4}) {
            f(cong, c, cuoi < dau ? "0" : "SUM(" + ref(dau, c) + ":" + ref(cuoi, c) + ")", k(c == 4 || c == 6 ? "congTien" : "congSo"));
        }
        f(cong, 5, "IF(" + ref(r, 4) + "=0,\"\",1)", k("congTyLe"));
        if (gv) f(cong, 7, "IF(" + ref(r, 4) + "=0,\"\"," + ref(r, 6) + "/" + ref(r, 4) + ")", k("congTyLe"));
    }

    /** Tiêu đề bảng nhóm (danh mục, thương hiệu, ABC); không có giá vốn thì bỏ hai cột lợi nhuận gộp, biên lãi. */
    private void tieuDeNhom(Sheet s, int r, String tenCot) {
        if (gv) tieuDe(s, r, 30, "STT", tenCot, "Số sản phẩm", "Số lượng bán", "Doanh thu", "Tỷ trọng doanh thu", "Lợi nhuận gộp", "Biên lãi");
        else tieuDe(s, r, 30, "STT", tenCot, "Số sản phẩm", "Số lượng bán", "Doanh thu", "Tỷ trọng doanh thu");
    }

    /**
     * Danh sách cột của một trang theo khóa: cột bị bỏ (khối {@code neu(false) … het()}) không chiếm chỗ, các cột sau tự
     * dồn sang trái, công thức lấy vị trí qua {@link #i(String)} nên không phải tính tay.
     */
    private static final class BoCot {
        private final List<String> khoa = new ArrayList<>();
        private final List<String> ten = new ArrayList<>();
        private final List<Integer> rong = new ArrayList<>();
        private boolean bo;

        BoCot them(String k, String t, int r) {
            if (bo) return this;
            khoa.add(k);
            ten.add(t);
            rong.add(r);
            return this;
        }

        BoCot neu(boolean co) {
            bo = !co;
            return this;
        }

        BoCot het() {
            bo = false;
            return this;
        }

        boolean co(String k) {
            return khoa.contains(k);
        }

        int i(String k) {
            int i = khoa.indexOf(k);
            if (i < 0) throw new IllegalStateException("Không có cột " + k);
            return i;
        }

        String ten(int i) {
            return ten.get(i);
        }

        String[] tatCaTen() {
            return ten.toArray(new String[0]);
        }

        int cuoi() {
            return khoa.size() - 1;
        }

        void datRong(Sheet s) {
            for (int i = 0; i < rong.size(); i++) s.setColumnWidth(i, rong.get(i) * 256);
        }
    }

    // ================= Trang 2: Theo sản phẩm =================

    private void sheetSanPham(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Theo sản phẩm");
        BoCot c = new BoCot()
                .them("stt", "STT", 5).them("hang", "Hạng", 6).them("ma", "Mã sản phẩm", 12)
                .them("ten", "Tên sản phẩm", 30).them("dm", "Danh mục", 11).them("th", "Thương hiệu", 10)
                .them("dvt", "Đơn vị tính", 6).them("sl", "Số lượng bán", 9).them("don", "Số đơn", 7)
                .them("dt", "Doanh thu hàng", 13).them("tt", "Tỷ trọng doanh thu", 9)
                .neu(gv).them("gv", "Giá vốn", 13).them("ln", "Lợi nhuận gộp", 13).them("bien", "Biên lãi", 8).het()
                .them("hoan", "Số lượng hoàn", 8).them("tlh", "Tỷ lệ hoàn", 8)
                .them("slt", "Số lượng bán kỳ trước", 9).them("tg", "Tăng / giảm số lượng", 9).them("hangt", "Hạng kỳ trước", 6)
                .them("kd", "Khả dụng", 9).them("ve", "Đang về", 9)
                .neu(gv).them("gtt", "Giá trị tồn", 13).het()
                .them("du", "Đủ bán (ngày)", 8).them("abc", "Nhóm ABC", 6).them("tinh", "Tình trạng", 13)
                .them("ban", "Bán gần nhất", 11);
        c.datRong(s);
        int cuoiCot = c.cuoi();
        int r = dauTrang(s, tin, "CHI TIẾT BÁN HÀNG THEO SẢN PHẨM", cuoiCot, dongKy(bc), dongSoSanh(bc));

        int h1 = r;
        Row nhom = s.createRow(r++);
        Row ten = s.createRow(r++);
        ten.setHeightInPoints(45);
        for (int i = 0; i <= cuoiCot; i++) {
            o(nhom, i, "", k("tieuDeCot"));
            o(ten, i, c.ten(i), k("tieuDeCot"));
        }
        for (String khoa : new String[]{"stt", "hang", "ma", "ten", "dm", "th", "dvt", "abc", "tinh", "ban"}) {
            int i = c.i(khoa);
            o(nhom, i, c.ten(i), k("tieuDeCot"));
            s.addMergedRegion(new CellRangeAddress(h1, h1 + 1, i, i));
        }
        o(nhom, c.i("sl"), "Kỳ này", k("tieuDeCot"));
        gop(s, h1, c.i("sl"), c.i("tlh"));
        o(nhom, c.i("slt"), "Kỳ trước", k("tieuDeCot"));
        gop(s, h1, c.i("slt"), c.i("hangt"));
        o(nhom, c.i("kd"), "Tồn kho hiện tại", k("tieuDeCot"));
        gop(s, h1, c.i("kd"), c.i("du"));

        List<BaoCaoSanPhamDTO.SanPham> ds = bc.getSanPham();
        int dau = r;
        int cuoi = dau + ds.size() - 1;
        int dongCong = cuoi + 1;
        int sl = c.i("sl");
        int dt = c.i("dt");
        int hoan = c.i("hoan");
        int slt = c.i("slt");
        int kd = c.i("kd");
        String tongDt = new CellReference(dongCong, dt, true, true).formatAsString();
        int stt = 1;
        for (BaoCaoSanPhamDTO.SanPham p : ds) {
            Row row = s.createRow(r);
            so(row, c.i("stt"), BigDecimal.valueOf(stt++), k("soGiua"));
            if (p.getHang() != null) so(row, c.i("hang"), BigDecimal.valueOf(p.getHang()), k("soGiua")); else o(row, c.i("hang"), "", k("stt"));
            o(row, c.i("ma"), p.getMaSanPham(), k("chu"));
            o(row, c.i("ten"), p.getTenSanPham(), k("chuXuong"));
            o(row, c.i("dm"), p.getDanhMuc(), k("chuXuong"));
            o(row, c.i("th"), p.getThuongHieu(), k("chuXuong"));
            o(row, c.i("dvt"), p.getDonViTinh(), k("stt"));
            so(row, sl, p.getSoLuong(), k("so"));
            so(row, c.i("don"), BigDecimal.valueOf(p.getSoDon()), k("so"));
            so(row, dt, p.getDoanhThu(), k("tien"));
            f(row, c.i("tt"), "IF(" + tongDt + "=0,\"\"," + ref(r, dt) + "/" + tongDt + ")", k("tyLe"));
            if (gv) {
                so(row, c.i("gv"), p.getGiaVon(), k("tien"));
                f(row, c.i("ln"), ref(r, dt) + "-" + ref(r, c.i("gv")), k("tien"));
                f(row, c.i("bien"), "IF(" + ref(r, dt) + "=0,\"\"," + ref(r, c.i("ln")) + "/" + ref(r, dt) + ")", k("tyLe"));
            }
            so(row, hoan, p.getSoLuongHoan(), k("so"));
            f(row, c.i("tlh"), "IF(" + ref(r, sl) + "+" + ref(r, hoan) + "=0,\"\"," + ref(r, hoan) + "/(" + ref(r, sl) + "+" + ref(r, hoan) + "))", k("tyLe"));
            so(row, slt, p.getSoLuongTruoc(), k("so"));
            f(row, c.i("tg"), "IF(" + ref(r, slt) + "=0,IF(" + ref(r, sl) + ">0,\"Mới\",\"\"),(" + ref(r, sl) + "-" + ref(r, slt) + ")/" + ref(r, slt) + ")", k("tyLe"));
            if (p.getHangTruoc() != null) so(row, c.i("hangt"), BigDecimal.valueOf(p.getHangTruoc()), k("soGiua")); else o(row, c.i("hangt"), "", k("stt"));
            so(row, kd, p.getKhaDung(), k("so"));
            so(row, c.i("ve"), p.getDangVe(), k("so"));
            if (gv) so(row, c.i("gtt"), p.getGiaTriTon(), k("tien"));
            // Đủ bán lấy số máy chủ đã tính (số bán mọi kênh, số ngày bán) như màn hình và cột Tình trạng, không tự chia lại
            // theo cột số bán (đang lọc kênh thì cột đó chỉ là số của kênh)
            soHoacTrong(row, c.i("du"), p.getDuBanNgay(), k("ngayBan"));
            o(row, c.i("abc"), p.getNhomAbc() == null ? "" : p.getNhomAbc(), k("stt"));
            String tt = TINH_TRANG.getOrDefault(p.getTinhTrang(), "");
            o(row, c.i("tinh"), tt, k("BAN_CHAY_SAP_HET".equals(p.getTinhTrang()) ? "chuDo" : "chuXuong"));
            ngay(row, c.i("ban"), p.getNgayBanCuoi());
            r++;
        }
        Row cong = s.createRow(r);
        for (int i = 0; i <= cuoiCot; i++) o(cong, i, "", k("congChu"));
        o(cong, c.i("ten"), "Cộng (" + ds.size() + " sản phẩm)", k("congChu"));
        for (String khoa : new String[]{"sl", "dt", "gv", "ln", "hoan", "slt", "kd", "ve", "gtt"}) {
            if (!c.co(khoa)) continue;
            int i = c.i(khoa);
            boolean tien = khoa.equals("dt") || khoa.equals("gv") || khoa.equals("ln") || khoa.equals("gtt");
            f(cong, i, ds.isEmpty() ? "0" : "SUBTOTAL(109," + ref(dau, i) + ":" + ref(cuoi, i) + ")", k(tien ? "congTien" : "congSo"));
        }
        so(cong, c.i("don"), BigDecimal.valueOf(bc.getTong().getSoDon()), k("congSo"));
        f(cong, c.i("tt"), "IF(" + ref(r, dt) + "=0,\"\",1)", k("congTyLe"));
        if (gv) f(cong, c.i("bien"), "IF(" + ref(r, dt) + "=0,\"\"," + ref(r, c.i("ln")) + "/" + ref(r, dt) + ")", k("congTyLe"));
        f(cong, c.i("tlh"), "IF(" + ref(r, sl) + "+" + ref(r, hoan) + "=0,\"\"," + ref(r, hoan) + "/(" + ref(r, sl) + "+" + ref(r, hoan) + "))", k("congTyLe"));
        f(cong, c.i("tg"), "IF(" + ref(r, slt) + "=0,\"\",(" + ref(r, sl) + "-" + ref(r, slt) + ")/" + ref(r, slt) + ")", k("congTyLe"));
        f(cong, c.i("du"), ds.isEmpty() ? "\"\"" : "IF(" + ref(r, sl) + "=0,\"\",SUMIF(" + ref(dau, sl) + ":" + ref(cuoi, sl) + ",\">0\"," + ref(dau, kd) + ":" + ref(cuoi, kd) + ")/(" + ref(r, sl) + "/" + bc.getSoNgay() + "))", k("congNgayBan"));
        r += 2;
        int cGhi = c.i("ma");
        o(s, r++, cGhi, "Ghi chú: Dòng Cộng tự tính lại khi lọc. Số đơn ở dòng Cộng là số đơn khác nhau của cả kỳ (đơn có nhiều sản phẩm chỉ đếm một lần).", k("ghiChu"));
        o(s, r++, cGhi, "Hạng xếp theo số lượng bán; bằng nhau thì xếp theo doanh thu. Nhóm ABC theo doanh thu cộng dồn: A tới 80%, B tới 95%, C phần còn lại.", k("ghiChu"));
        o(s, r++, cGhi, "Đủ bán = khả dụng hiện tại / (số lượng bán mọi kênh / số ngày bán: " + bc.getSoNgay() + " ngày, hàng mới về giữa kỳ thì từ ngày về);"
                + " dòng Cộng = khả dụng các dòng có bán / (cột số lượng bán / " + bc.getSoNgay() + " ngày). Sắp hết hàng: dưới "
                + BaoCaoSanPhamService.SAP_HET_DUOI_NGAY + " ngày; dư hàng: trên " + BaoCaoSanPhamService.DU_HANG_TREN_NGAY + " ngày.", k("ghiChu"));
        o(s, r, cGhi, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(c.i("dm"), h1 + 2);
        if (!ds.isEmpty()) s.setAutoFilter(new CellRangeAddress(h1 + 1, cuoi, 0, cuoiCot));
        inTrang(s, true, h1, h1 + 1);
    }

    // ================= Trang 3: Theo mã SKU =================

    private void sheetSku(BaoCaoSanPhamDTO bc, ThongTin tin) {
        Sheet s = wb.createSheet("Theo mã SKU");
        BoCot c = new BoCot()
                .them("stt", "STT", 6).them("ma", "Mã sản phẩm", 13).them("ten", "Tên sản phẩm", 34)
                .them("sku", "Mã SKU", 30).them("mau", "Màu", 12).them("size", "Size", 8)
                .them("gia", "Giá bán hiện tại", 13).them("sl", "Số lượng bán", 10).them("dt", "Doanh thu hàng", 14)
                .neu(gv).them("gv", "Giá vốn", 14).them("ln", "Lợi nhuận gộp", 14).them("bien", "Biên lãi", 9).het()
                .them("hoan", "Số lượng hoàn", 9).them("kd", "Khả dụng", 10).them("ve", "Đang về", 9)
                .them("du", "Đủ bán (ngày)", 10);
        c.datRong(s);
        int cuoiCot = c.cuoi();
        int r = dauTrang(s, tin, "CHI TIẾT BÁN HÀNG THEO MÃ SKU", cuoiCot, dongKy(bc), "Khả dụng, đang về: số tại thời điểm lập báo cáo");
        int h = r;
        tieuDe(s, r++, 45, c.tatCaTen());
        int sl = c.i("sl");
        int dt = c.i("dt");
        int kd = c.i("kd");
        int dau = r;
        int stt = 1;
        for (BaoCaoSanPhamDTO.SanPham p : bc.getSanPham()) {
            for (BaoCaoSanPhamDTO.BienThe b : p.getBienThe()) {
                Row row = s.createRow(r);
                so(row, c.i("stt"), BigDecimal.valueOf(stt++), k("soGiua"));
                o(row, c.i("ma"), p.getMaSanPham(), k("chu"));
                o(row, c.i("ten"), p.getTenSanPham(), k("chuXuong"));
                o(row, c.i("sku"), b.getMaSku(), k("chuXuong"));
                o(row, c.i("mau"), b.getMau() == null ? "" : b.getMau(), k("chu"));
                o(row, c.i("size"), b.getSize() == null ? "" : b.getSize(), k("stt"));
                so(row, c.i("gia"), b.getGiaBan(), k("tien"));
                so(row, sl, b.getSoLuong(), k("so"));
                so(row, dt, b.getDoanhThu(), k("tien"));
                if (gv) {
                    so(row, c.i("gv"), b.getGiaVon(), k("tien"));
                    f(row, c.i("ln"), ref(r, dt) + "-" + ref(r, c.i("gv")), k("tien"));
                    f(row, c.i("bien"), "IF(" + ref(r, dt) + "=0,\"\"," + ref(r, c.i("ln")) + "/" + ref(r, dt) + ")", k("tyLe"));
                }
                so(row, c.i("hoan"), b.getSoLuongHoan(), k("so"));
                so(row, kd, b.getKhaDung(), k("so"));
                so(row, c.i("ve"), b.getDangVe(), k("so"));
                soHoacTrong(row, c.i("du"), b.getDuBanNgay(), k("ngayBan"));
                r++;
            }
        }
        int cuoi = r - 1;
        Row cong = s.createRow(r);
        for (int i = 0; i <= cuoiCot; i++) o(cong, i, "", k("congChu"));
        o(cong, c.i("ten"), "Cộng (" + (stt - 1) + " mã)", k("congChu"));
        for (String khoa : new String[]{"sl", "dt", "gv", "ln", "hoan", "kd", "ve"}) {
            if (!c.co(khoa)) continue;
            int i = c.i(khoa);
            boolean tien = khoa.equals("dt") || khoa.equals("gv") || khoa.equals("ln");
            f(cong, i, cuoi < dau ? "0" : "SUBTOTAL(109," + ref(dau, i) + ":" + ref(cuoi, i) + ")", k(tien ? "congTien" : "congSo"));
        }
        if (gv) f(cong, c.i("bien"), "IF(" + ref(r, dt) + "=0,\"\"," + ref(r, c.i("ln")) + "/" + ref(r, dt) + ")", k("congTyLe"));
        f(cong, c.i("du"), cuoi < dau ? "\"\"" : "IF(" + ref(r, sl) + "=0,\"\",SUMIF(" + ref(dau, sl) + ":" + ref(cuoi, sl) + ",\">0\"," + ref(dau, kd) + ":" + ref(cuoi, kd) + ")/(" + ref(r, sl) + "/" + bc.getSoNgay() + "))", k("congNgayBan"));
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

    /** Ô số; không có số (vd. đủ bán của mã không bán) thì để trống, không ghi 0 (0 hiện "-" như số thật). */
    private static void soHoacTrong(Row row, int c, BigDecimal v, CellStyle st) {
        if (v == null) o(row, c, "", st);
        else so(row, c, v, st);
    }
}
