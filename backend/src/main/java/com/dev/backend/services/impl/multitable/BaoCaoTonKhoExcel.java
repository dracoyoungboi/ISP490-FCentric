package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.TonKhoProjection;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

import static com.dev.backend.services.impl.multitable.BaoCaoTonKhoService.*;

/**
 * Tệp Excel của Báo cáo tồn kho theo khuôn chung (KhuonExcelBaoCao). Ba trang:
 * - Tổng hợp: tồn theo kho, theo tình trạng, ghi chú cách tính, chữ ký.
 * - Chi tiết: mỗi dòng một mã SKU ở một kho (như bảng trên màn), dòng Cộng tự tính lại khi lọc.
 * - Cần nhập: các mã hết hàng / sắp hết hàng (không tính Kho Trung Chuyển), để lập yêu cầu nhập hàng.
 * Số là số tại thời điểm lập báo cáo.
 * <p>
 * Người tải không được xem giá vốn (nhân viên bán hàng — SRS 2.4.1, XemGiaVon) thì tệp bỏ hẳn giá trị tồn và giá vốn
 * bình quân, như API của màn Báo cáo tồn kho (không gửi giá trị tồn, giá vốn lô) và màn (ẩn các ô đó).
 */
public final class BaoCaoTonKhoExcel extends KhuonExcelBaoCao {

    private static final List<String> THU_TU_TINH_TRANG = List.of(HET_HANG, SAP_HET, BINH_THUONG, DU_HANG, DANG_VAN_CHUYEN);

    private final List<BaoCaoTonKhoService.Dong> ds;
    private final Set<Integer> khoAo;
    private final String dongKy;
    private final String boLoc;
    private final boolean gv;

    private BaoCaoTonKhoExcel(List<BaoCaoTonKhoService.Dong> ds, Set<Integer> khoAo, String boLoc, ThongTin tin, boolean gv) {
        this.gv = gv;
        this.ds = ds;
        this.khoAo = khoAo;
        this.boLoc = boLoc;
        this.dongKy = "Số liệu tại thời điểm " + tin.lapLuc().format(DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy"));
    }

    /** gv: người tải được xem giá vốn (XemGiaVon); không thì tệp không có cột giá trị tồn, giá vốn bình quân. */
    public static byte[] tao(List<BaoCaoTonKhoService.Dong> ds, Set<Integer> khoAo, String boLoc, ThongTin tin, boolean gv) {
        BaoCaoTonKhoExcel x = new BaoCaoTonKhoExcel(ds, khoAo, boLoc, tin, gv);
        x.sheetTongHop(tin);
        // Chi tiết, Cần nhập: mỗi mã SKU ở mỗi kho một dòng, có thể rất dài — ghi dần ra đĩa
        return x.xuat("Báo cáo tồn kho", tin, sx -> {
            x.sheetChiTiet(sx, tin);
            x.sheetCanNhap(sx, tin);
        });
    }

    // ================= Trang 1: Tổng hợp =================

    private void sheetTongHop(ThongTin tin) {
        Sheet s = wb.createSheet("Tổng hợp");
        // Không có giá vốn: bỏ cột Giá trị tồn (cột 4), các cột sau dồn sang trái
        int lui = gv ? 0 : 1;
        int cuoiCot = 7 - lui;
        if (gv) doRongCot(s, 6, 34, 10, 14, 18, 12, 12, 12);
        else doRongCot(s, 6, 34, 10, 14, 12, 12, 12);
        s.setDisplayGridlines(false);
        // Không có giá vốn thì trang không còn cột tiền: bỏ dòng "Đơn vị tính: đồng"
        int r = dauTrang(s, tin, "BÁO CÁO TỒN KHO", cuoiCot, dongKy, boLoc, gv);

        // --- I. Theo kho (Kho Trung Chuyển xếp cuối) ---
        o(s, r++, 0, "I. TỒN KHO THEO KHO", k("muc"));
        if (gv) tieuDe(s, r++, 30, "STT", "Kho", "Số mã", "Tồn thực tế", "Giá trị tồn", "Đang về", "Đang xuất", "Khả dụng");
        else tieuDe(s, r++, 30, "STT", "Kho", "Số mã", "Tồn thực tế", "Đang về", "Đang xuất", "Khả dụng");
        // Gộp theo mã kho (hai kho trùng tên vẫn là hai dòng); Kho Trung Chuyển xếp cuối
        Map<Integer, List<BaoCaoTonKhoService.Dong>> theoKho = new LinkedHashMap<>();
        ds.stream()
                .sorted(Comparator.comparing((BaoCaoTonKhoService.Dong d) -> khoAo.contains(d.so().getKhoId()))
                        .thenComparing(d -> tenKho(d.so())))
                .forEach(d -> theoKho.computeIfAbsent(d.so().getKhoId(), x -> new ArrayList<>()).add(d));
        int dau = r;
        int stt = 1;
        for (List<BaoCaoTonKhoService.Dong> nhom : theoKho.values()) {
            Row row = s.createRow(r++);
            o(row, 0, String.valueOf(stt++), k("stt"));
            boolean trungChuyen = khoAo.contains(nhom.get(0).so().getKhoId());
            o(row, 1, tenKho(nhom.get(0).so()) + (trungChuyen ? " (hàng đang đi đường)" : ""), k("chuXuong"));
            so(row, 2, nhom.size(), k("so"));
            so(row, 3, cong(nhom, TonKhoProjection::getOnHand), k("so"));
            if (gv) so(row, 4, cong(nhom, TonKhoProjection::getTongGiaTri), k("tien"));
            so(row, 5 - lui, cong(nhom, TonKhoProjection::getIncoming), k("so"));
            so(row, 6 - lui, cong(nhom, TonKhoProjection::getOutgoing), k("so"));
            so(row, 7 - lui, cong(nhom, TonKhoProjection::getFreeToUse), k("so"));
        }
        int cuoi = r - 1;
        Row cong = dongCong(s, r++, cuoiCot, 1, "Cộng");
        for (int c = 2; c <= cuoiCot; c++) f(cong, c, tongCot(dau, cuoi, c, false), k(gv && c == 4 ? "congTien" : "congSo"));
        r++;

        // --- II. Theo tình trạng ---
        o(s, r++, 0, "II. TỒN KHO THEO TÌNH TRẠNG", k("muc"));
        int hII = r;
        int cCach = 5 - lui;
        if (gv) tieuDe(s, r++, 30, "STT", "Tình trạng", "Số mã", "Tồn thực tế", "Giá trị tồn", "Cách xác định", "", "");
        else tieuDe(s, r++, 30, "STT", "Tình trạng", "Số mã", "Tồn thực tế", "Cách xác định", "", "");
        gop(s, hII, cCach, cuoiCot);
        Map<String, String> cachXacDinh = Map.of(
                HET_HANG, "Tồn thực tế bằng 0 (hoặc âm)",
                SAP_HET, "Tồn thực tế không quá tồn tối thiểu của mã",
                BINH_THUONG, "Trên tồn tối thiểu, không quá 1,5 lần tồn tối thiểu",
                DU_HANG, "Trên 1,5 lần tồn tối thiểu, hoặc mã chưa đặt tồn tối thiểu",
                DANG_VAN_CHUYEN, "Hàng ở Kho Trung Chuyển (đang đi đường giữa hai kho)");
        int dauII = r;
        stt = 1;
        for (String tt : THU_TU_TINH_TRANG) {
            List<BaoCaoTonKhoService.Dong> nhom = ds.stream().filter(d -> tt.equals(d.tinhTrang())).toList();
            if (tt.equals(DANG_VAN_CHUYEN) && nhom.isEmpty()) continue;
            Row row = s.createRow(r);
            row.setHeightInPoints(30);
            o(row, 0, String.valueOf(stt++), k("stt"));
            o(row, 1, TEN_TINH_TRANG.get(tt), k(tt.equals(HET_HANG) || tt.equals(SAP_HET) ? "chuDo" : "chu"));
            so(row, 2, nhom.size(), k("so"));
            so(row, 3, cong(nhom, TonKhoProjection::getOnHand), k("so"));
            if (gv) so(row, 4, cong(nhom, TonKhoProjection::getTongGiaTri), k("tien"));
            o(row, cCach, cachXacDinh.get(tt), k("ghiChuO"));
            for (int c = cCach + 1; c <= cuoiCot; c++) o(row, c, "", k("ghiChuO"));
            gop(s, r, cCach, cuoiCot);
            r++;
        }
        int cuoiII = r - 1;
        Row congII = dongCong(s, r, cuoiCot, 1, "Cộng");
        for (int c = 2; c <= cCach - 1; c++) f(congII, c, tongCot(dauII, cuoiII, c, false), k(gv && c == 4 ? "congTien" : "congSo"));
        gop(s, r, cCach, cuoiCot);
        r += 2;

        List<String> ghi = new ArrayList<>(List.of(
                "Ghi chú:",
                "- Tồn thực tế: số đang nằm trong kho. Đang về: đơn mua đã gửi, đã duyệt hoặc nhận một phần mà chưa nhận đủ.",
                "- Đang xuất: hàng đang giữ cho đơn bán chưa xuất kho. Khả dụng = tồn thực tế − đang xuất."));
        if (gv) ghi.add("- Giá trị tồn tính theo giá vốn của từng lô còn trong kho.");
        ghi.add("- Mỗi mã SKU ở mỗi kho là một dòng; cùng một mã ở hai kho được đếm hai lần ở cột Số mã.");
        for (String g : ghi) o(s, r++, 0, g, k(g.equals("Ghi chú:") ? "ghiChuDam" : "ghiChu"));
        long trungChuyenHet = ds.stream().filter(d -> d.tinhTrang() == null).count();
        if (trungChuyenHet > 0) {
            o(s, r++, 0, "- " + trungChuyenHet + " dòng Kho Trung Chuyển đã hết hàng không có tình trạng nên không tính ở mục II.", k("ghiChu"));
        }
        if (ds.isEmpty()) o(s, r++, 0, "- Không có mã hàng nào khớp bộ lọc đang chọn.", k("ghiChu"));
        r++;
        chuKy(s, r, tin, cuoiCot);
        inTrang(s, false, -1, -1);
        if (theoKho.size() <= 20) s.getPrintSetup().setFitHeight((short) 1);
    }

    // ================= Trang 2: Chi tiết =================

    private void sheetChiTiet(SXSSFWorkbook sx, ThongTin tin) {
        Sheet s = sx.createSheet("Chi tiết");
        //         STT Mã SP Tên SKU Màu Size CL  Kho Tồn Về  Xuất KD  Min GVBQ GT  TT
        // Không có giá vốn: bỏ cột Giá vốn bình quân, Giá trị tồn (13, 14); Tình trạng lùi về cột 13
        if (gv) doRongCot(s, 6, 13, 32, 22, 11, 7, 12, 20, 10, 9, 9, 10, 9, 13, 15, 15);
        else doRongCot(s, 6, 13, 32, 22, 11, 7, 12, 20, 10, 9, 9, 10, 9, 15);
        int cuoiCot = gv ? 15 : 13;
        int r = dauTrang(s, tin, "CHI TIẾT TỒN KHO THEO MÃ SKU", cuoiCot, dongKy, boLoc, gv);
        int h = r;
        if (gv) {
            tieuDe(s, r++, 45, "STT", "Mã sản phẩm", "Tên sản phẩm", "Mã SKU", "Màu", "Size", "Chất liệu", "Kho",
                    "Tồn thực tế", "Đang về", "Đang xuất", "Khả dụng", "Tồn tối thiểu", "Giá vốn bình quân", "Giá trị tồn",
                    "Tình trạng");
        } else {
            tieuDe(s, r++, 45, "STT", "Mã sản phẩm", "Tên sản phẩm", "Mã SKU", "Màu", "Size", "Chất liệu", "Kho",
                    "Tồn thực tế", "Đang về", "Đang xuất", "Khả dụng", "Tồn tối thiểu", "Tình trạng");
        }
        int dau = r;
        int stt = 1;
        for (BaoCaoTonKhoService.Dong d : ds) {
            TonKhoProjection p = d.so();
            Row row = s.createRow(r);
            so(row, 0, stt++, k("soGiua"));
            o(row, 1, p.getMaSanPham(), k("chu"));
            o(row, 2, p.getTenSanPham(), k("chuXuong"));
            o(row, 3, p.getMaSku(), k("chuXuong"));
            o(row, 4, p.getTenMau(), k("chu"));
            o(row, 5, p.getMaSize(), k("stt"));
            o(row, 6, p.getTenChatLieu(), k("chuXuong"));
            o(row, 7, p.getTenKho(), k("chuXuong"));
            so(row, 8, p.getOnHand(), k("so"));
            so(row, 9, p.getIncoming(), k("so"));
            so(row, 10, p.getOutgoing(), k("so"));
            so(row, 11, p.getFreeToUse(), k("so"));
            if (p.getMucTonToiThieu() != null && !khoAo.contains(p.getKhoId())) so(row, 12, p.getMucTonToiThieu(), k("so"));
            else o(row, 12, "", k("so"));
            if (gv) {
                double ton = soThuc(p.getOnHand());
                fCo(row, 13, "IF(" + ref(r, 8) + "<=0,\"\"," + ref(r, 14) + "/" + ref(r, 8) + ")",
                        ton <= 0 ? null : soThuc(p.getTongGiaTri()) / ton, k("tien"));
                so(row, 14, p.getTongGiaTri(), k("tien"));
            }
            String tt = d.tinhTrang() == null ? "" : TEN_TINH_TRANG.get(d.tinhTrang());
            o(row, cuoiCot, tt, k(HET_HANG.equals(d.tinhTrang()) || SAP_HET.equals(d.tinhTrang()) ? "chuDo" : "chuXuong"));
            r++;
        }
        int cuoi = r - 1;
        Row cong = dongCong(s, r, cuoiCot, 2, "Cộng (" + ds.size() + " dòng)");
        double tongTon = soThuc(cong(ds, TonKhoProjection::getOnHand));
        double tongGt = gv ? soThuc(cong(ds, TonKhoProjection::getTongGiaTri)) : 0;
        fCo(cong, 8, tongCot(dau, cuoi, 8, true), tongTon, k("congSo"));
        fCo(cong, 9, tongCot(dau, cuoi, 9, true), soThuc(cong(ds, TonKhoProjection::getIncoming)), k("congSo"));
        fCo(cong, 10, tongCot(dau, cuoi, 10, true), soThuc(cong(ds, TonKhoProjection::getOutgoing)), k("congSo"));
        fCo(cong, 11, tongCot(dau, cuoi, 11, true), soThuc(cong(ds, TonKhoProjection::getFreeToUse)), k("congSo"));
        if (gv) {
            fCo(cong, 14, tongCot(dau, cuoi, 14, true), tongGt, k("congTien"));
            fCo(cong, 13, "IF(" + ref(r, 8) + "<=0,\"\"," + ref(r, 14) + "/" + ref(r, 8) + ")", tongTon <= 0 ? null : tongGt / tongTon, k("congTien"));
        }
        r += 2;
        o(s, r++, 1, gv ? "Ghi chú: Dòng Cộng tự tính lại khi lọc. Giá vốn bình quân = giá trị tồn / tồn thực tế."
                : "Ghi chú: Dòng Cộng tự tính lại khi lọc.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(3, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, cuoiCot));
        inTrang(s, true, h, h);
    }

    // ================= Trang 3: Cần nhập =================

    private void sheetCanNhap(SXSSFWorkbook sx, ThongTin tin) {
        Sheet s = sx.createSheet("Cần nhập");
        //         STT Mã SP Tên SKU Màu Size Kho Tồn Về  Min TT
        doRongCot(s, 6, 13, 32, 22, 11, 7, 20, 10, 9, 10, 15);
        int cuoiCot = 10;
        int r = dauTrang(s, tin, "DANH SÁCH MÃ HẾT HÀNG VÀ SẮP HẾT HÀNG", cuoiCot, dongKy, boLoc, false);
        List<BaoCaoTonKhoService.Dong> can = ds.stream()
                .filter(d -> HET_HANG.equals(d.tinhTrang()) || SAP_HET.equals(d.tinhTrang()))
                .sorted(Comparator.comparing((BaoCaoTonKhoService.Dong d) -> !HET_HANG.equals(d.tinhTrang()))
                        .thenComparing(d -> Objects.toString(d.so().getTenKho(), ""))
                        .thenComparing(d -> Objects.toString(d.so().getMaSku(), "")))
                .toList();
        int h = r;
        tieuDe(s, r++, 45, "STT", "Mã sản phẩm", "Tên sản phẩm", "Mã SKU", "Màu", "Size", "Kho", "Tồn thực tế",
                "Đang về", "Tồn tối thiểu", "Tình trạng");
        int dau = r;
        int stt = 1;
        for (BaoCaoTonKhoService.Dong d : can) {
            TonKhoProjection p = d.so();
            Row row = s.createRow(r++);
            so(row, 0, stt++, k("soGiua"));
            o(row, 1, p.getMaSanPham(), k("chu"));
            o(row, 2, p.getTenSanPham(), k("chuXuong"));
            o(row, 3, p.getMaSku(), k("chuXuong"));
            o(row, 4, p.getTenMau(), k("chu"));
            o(row, 5, p.getMaSize(), k("stt"));
            o(row, 6, p.getTenKho(), k("chuXuong"));
            so(row, 7, p.getOnHand(), k("so"));
            so(row, 8, p.getIncoming(), k("so"));
            if (p.getMucTonToiThieu() != null) so(row, 9, p.getMucTonToiThieu(), k("so"));
            else o(row, 9, "", k("so"));
            o(row, 10, TEN_TINH_TRANG.get(d.tinhTrang()), k("chuDo"));
        }
        int cuoi = r - 1;
        Row cong = dongCong(s, r, cuoiCot, 2, "Cộng (" + can.size() + " mã)");
        fCo(cong, 7, tongCot(dau, cuoi, 7, true), soThuc(cong(can, TonKhoProjection::getOnHand)), k("congSo"));
        fCo(cong, 8, tongCot(dau, cuoi, 8, true), soThuc(cong(can, TonKhoProjection::getIncoming)), k("congSo"));
        r += 2;
        if (can.isEmpty()) o(s, r++, 1, "Không có mã hết hàng hoặc sắp hết hàng trong phạm vi đang xem.", k("ghiChu"));
        o(s, r++, 1, "Ghi chú: Hết hàng xếp trước. Cột Đang về là hàng đã đặt nhà cung cấp, chưa nhận; cân nhắc trước khi đặt thêm.", k("ghiChu"));
        o(s, r, 1, lapLuc(tin), k("ghiChu"));

        s.createFreezePane(3, h + 1);
        if (cuoi >= dau) s.setAutoFilter(new CellRangeAddress(h, cuoi, 0, cuoiCot));
        inTrang(s, true, h, h);
    }

    private static String tenKho(TonKhoProjection p) {
        return p.getTenKho() == null ? "Kho #" + p.getKhoId() : p.getTenKho();
    }

    private static double soThuc(BigDecimal v) {
        return v == null ? 0 : v.doubleValue();
    }

    private static BigDecimal cong(List<BaoCaoTonKhoService.Dong> ds, Function<TonKhoProjection, BigDecimal> f) {
        return ds.stream().map(d -> f.apply(d.so())).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
