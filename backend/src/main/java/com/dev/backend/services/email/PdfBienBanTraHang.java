package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Bản PDF của biên bản trả hàng nhà cung cấp, đính kèm email biên bản (gửi sau khi kho ghi người giao hàng đã ký, cập nhật,
 * gửi lại, nhắc hạn): nhà cung cấp lưu được đúng biên bản để đối chiếu, điều chỉnh hóa đơn / công nợ. Cùng bố cục và nội
 * dung giấy in ở màn nội bộ (frontend/src/pages/supplier-returns/GiayBienBanTraHang.jsx, khung GiayChungTu): chỉ ghi điều
 * hai bên kiểm lúc nhận hàng, thêm dòng người giao hàng đã ký vì đây là bản gửi đi sau khi ký. Câu trả lời của nhà cung cấp
 * và việc giao trả hay tiêu hủy về sau không in vào biên bản.
 *
 * <p>Mẫu XHTML ở classpath {@code templates/pdf/} (Thymeleaf chế độ XML: đầu ra luôn đúng cú pháp cho bộ dựng PDF). Phông
 * có chân Noto Serif (SIL OFL 1.1, {@code fonts/}) như chứng từ in, nhúng một phần vào tệp: đủ dấu tiếng Việt trên mọi
 * máy, kể cả máy chủ Linux không cài phông.
 */
@Component
public class PdfBienBanTraHang {

    static final String THU_MUC_MAU = "templates/pdf/";
    static final String MAU = "bien-ban-tra-hang";
    static final String PHONG = "Noto Serif";
    public static final String LOAI_PDF = "application/pdf";

    private final SpringTemplateEngine engine = taoEngine();

    /** Tệp "Bien-ban-tra-hang-RTV-….pdf" của biên bản. */
    public TepDinhKem tao(BienBanTraHangDto bb, CuaHangEmail cuaHang) {
        Context ctx = new Context(DinhDangEmail.TIENG_VIET);
        ctx.setVariable("b", banIn(bb, cuaHang == null ? CuaHangEmail.TRONG : cuaHang));
        String ten = bb.getSoBienBan() == null ? "Bien-ban-tra-hang.pdf" : "Bien-ban-tra-hang-" + bb.getSoBienBan() + ".pdf";
        return new TepDinhKem(ten, LOAI_PDF, pdf(engine.process(MAU, ctx)));
    }

    static byte[] pdf(String xhtml) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.useFont(() -> phong("NotoSerif-Regular.ttf"), PHONG, 400, BaseRendererBuilder.FontStyle.NORMAL, true);
            builder.useFont(() -> phong("NotoSerif-Bold.ttf"), PHONG, 700, BaseRendererBuilder.FontStyle.NORMAL, true);
            builder.useFont(() -> phong("NotoSerif-Italic.ttf"), PHONG, 400, BaseRendererBuilder.FontStyle.ITALIC, true);
            builder.withHtmlContent(xhtml, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Không dựng được PDF biên bản trả hàng", e);
        }
    }

    private static InputStream phong(String tep) {
        InputStream in = PdfBienBanTraHang.class.getClassLoader().getResourceAsStream("fonts/" + tep);
        if (in == null) throw new IllegalStateException("Thiếu phông fonts/" + tep);
        return in;
    }

    private static SpringTemplateEngine taoEngine() {
        ClassLoaderTemplateResolver r = new ClassLoaderTemplateResolver();
        r.setPrefix(THU_MUC_MAU);
        r.setSuffix(".html");
        r.setTemplateMode(TemplateMode.XML);
        r.setCharacterEncoding(StandardCharsets.UTF_8.name());
        r.setCacheable(true);
        r.setCheckExistence(true);
        SpringTemplateEngine e = new SpringTemplateEngine();
        e.setTemplateResolver(r);
        return e;
    }

    // ─────────────────────────────────────────────────────────────
    // Dữ liệu in (chuỗi đã định dạng; ô thiếu dữ liệu in dòng chấm như giấy in)
    // ─────────────────────────────────────────────────────────────

    /** Ô thiếu dữ liệu trên giấy in. */
    static final String CHAM = "……………………";

    public record Dong(int stt, String sku, String ten, String mauCo, String maLo, String lyDo, String soLuong,
                       String donGia, String thanhTien) {
    }

    /**
     * @param tenCongTy     tên bên mua viết hoa ở đầu giấy
     * @param cauDan        câu dẫn trước bảng: hai bên cùng kiểm / bên mua và người giao hàng
     * @param traNgay       hàng lỗi trả ngay cho người giao hàng
     * @param giuKho        hàng lỗi giữ ở kho bên mua
     * @param nguoiGiao     "Lê Văn Tài, Nhà xe Phương Trang, biển số 29C-123.45"; null khi biên bản cũ
     * @param tenNguoiKy    họ tên in dưới ô ký người giao hàng
     * @param ghiDuoiTenKy  "(đại diện nhà cung cấp, đã ký bản giấy)", "(bên vận chuyển: …, đã ký bản giấy)"
     * @param cauKy         câu người giao hàng đã ký; null khi chưa ghi đã ký (biên bản cũ)
     */
    public record BanIn(String tenCongTy, String benMua, String diaChi, String maSoThue, String soBienBan,
                        String ngayLap, String soPhieuNhap, String soDonMua, String tenKho,
                        String nguoiLap, String tenNcc, String maNcc, String lienHeNcc, String emailNcc, String cauDan,
                        List<Dong> dong, String tongSoLuong, String tongTien, boolean traNgay, boolean giuKho,
                        String nguoiGiao, String tenNguoiKy, String ghiDuoiTenKy, String cauKy, String ghiChu,
                        String taoLuc) {
    }

    static BanIn banIn(BienBanTraHangDto bb, CuaHangEmail ch) {
        Map<Integer, BigDecimal> gia = new HashMap<>();
        for (BienBanTraHangDto.TheoBienTheDto t : danhSach(bb.getTheoBienThe())) {
            if (t.getDonGia() != null) gia.put(t.getBienTheSanPhamId(), t.getDonGia());
        }
        List<Dong> dong = new ArrayList<>();
        long tongSl = 0;
        BigDecimal tongTien = BigDecimal.ZERO;
        boolean duGia = true;
        for (BienBanTraHangDto.ChiTietItemDto it : danhSach(bb.getItems())) {
            int sl = it.getSoLuong() == null ? 0 : it.getSoLuong();
            BigDecimal donGia = gia.get(it.getBienTheSanPhamId());
            BigDecimal thanhTien = donGia == null ? null : donGia.multiply(BigDecimal.valueOf(sl));
            tongSl += sl;
            if (thanhTien == null) duGia = false;
            else tongTien = tongTien.add(thanhTien);
            dong.add(new Dong(dong.size() + 1, it.getSku(), it.getTenBienThe(), noi(" / ", it.getMauSac(), it.getKichCo()),
                    it.getMaLo(), it.getLyDo(), String.valueOf(sl), tien(donGia), tien(thanhTien)));
        }

        String ten = sach(ch.tenDangKy()) != null ? ch.tenDangKy().trim() : sach(ch.tenHienThi());
        return new BanIn(
                ten == null ? CHAM : ten.toUpperCase(DinhDangEmail.TIENG_VIET), ten == null ? CHAM : ten,
                nvl(ch.diaChiDangKy()), nvl(ch.maSoThue()),
                bb.getSoBienBan(), DinhDangEmail.ngay(bb.getNgayLap()),
                nvl(bb.getSoPhieuNhap()), sach(bb.getSoDonMua()), nvl(bb.getTenKho()), nvl(bb.getNguoiLap()),
                nvl(bb.getTenNhaCungCap()), sach(bb.getMaNhaCungCap()),
                nvl(noi(", ", bb.getNguoiLienHeNcc(), bb.getDienThoaiNcc())), sach(bb.getEmailNcc()), cauDan(bb),
                dong, String.valueOf(tongSl), duGia && !dong.isEmpty() ? DinhDangEmail.tien(tongTien) : null,
                BienBanTraHangNcc.TRA_NGAY.equals(bb.getCachXuLyHang()), BienBanTraHangNcc.GIU_KHO.equals(bb.getCachXuLyHang()),
                nguoiGiao(bb), sach(bb.getNguoiGiao()), ghiDuoiTenKy(bb), cauKy(bb, false), sach(bb.getGhiChu()),
                DinhDangEmail.gioNgay(Instant.now()));
    }

    static final String KY_DA_KY = "DA_KY";

    private static boolean benVanChuyen(BienBanTraHangDto bb) {
        return BienBanTraHangNcc.BEN_KY_VAN_CHUYEN.equals(bb.getBenKy());
    }

    /** "Lê Văn Tài, Nhà xe Phương Trang, biển số 29C-123.45"; null với biên bản cũ. */
    private static String nguoiGiao(BienBanTraHangDto bb) {
        if (sach(bb.getNguoiGiao()) == null) return null;
        return noi(", ", bb.getNguoiGiao(), benVanChuyen(bb) ? bb.getDonViVanChuyen() : null,
                sach(bb.getBienSoXe()) == null ? null : "biển số " + bb.getBienSoXe().trim());
    }

    /** Ai cùng kiểm số hàng lỗi: chữ ký của bên vận chuyển không phải xác nhận của nhà cung cấp. */
    private static String cauDan(BienBanTraHangDto bb) {
        if (benVanChuyen(bb)) return "Khi nhận hàng, bên mua và người giao hàng cùng kiểm số hàng không đạt chất lượng dưới đây:";
        return "Khi nhận hàng, hai bên cùng kiểm và xác nhận số hàng không đạt chất lượng dưới đây:";
    }

    private static String ghiDuoiTenKy(BienBanTraHangDto bb) {
        if (!KY_DA_KY.equals(bb.getKyBienBan())) return null;
        return benVanChuyen(bb) ? "(bên vận chuyển" + (sach(bb.getDonViVanChuyen()) == null ? "" : ": " + bb.getDonViVanChuyen().trim())
                + ", đã ký bản giấy)" : "(đại diện nhà cung cấp, đã ký bản giấy)";
    }

    /**
     * Câu người giao hàng đã ký biên bản giấy: in trong PDF ({@code choThu} false) và viết trong
     * email biên bản gửi nhà cung cấp ({@code choThu} true: xưng "chúng tôi" / "Quý công ty"). Người của bên vận chuyển
     * chỉ xác nhận số lỗi lúc giao, không thay nhà cung cấp: câu nói rõ nhà cung cấp vẫn phải xác nhận trên cổng. Null khi
     * chưa ghi đã ký hoặc biên bản cũ.
     */
    public static String cauKy(BienBanTraHangDto bb, boolean choThu) {
        String ky = bb.getKyBienBan();
        String xacNhan = choThu
                ? " Kính đề nghị Quý công ty xác nhận số hàng lỗi khi trả lời trên Cổng nhà cung cấp."
                : " Nhà cung cấp xác nhận số hàng lỗi trên Cổng nhà cung cấp.";
        String ten = sach(bb.getNguoiGiao());
        if (!KY_DA_KY.equals(ky) || ten == null) return null;
        String bienSo = sach(bb.getBienSoXe()) == null ? "" : ", biển số " + bb.getBienSoXe().trim();
        String nhanHang = BienBanTraHangNcc.TRA_NGAY.equals(bb.getCachXuLyHang()) ? " và nhận hàng lỗi" : "";
        String luc = bb.getThoiDiemKy() == null ? "" : " lúc " + DinhDangEmail.gioNgay(bb.getThoiDiemKy());
        String luuGiay = "; bản giấy có chữ ký lưu tại " + (choThu ? "kho của chúng tôi." : "kho bên mua.");
        if (benVanChuyen(bb)) {
            String donVi = sach(bb.getDonViVanChuyen()) == null ? "" : " của " + bb.getDonViVanChuyen().trim();
            return "Người giao hàng " + ten + donVi + bienSo + " đã ký xác nhận số hàng lỗi" + nhanHang + luc + luuGiay
                    + (choThu ? " Bên vận chuyển không đại diện cho Quý công ty." : " Bên vận chuyển không đại diện nhà cung cấp.")
                    + xacNhan;
        }
        return (choThu ? "Đại diện của Quý công ty " : "Đại diện nhà cung cấp ") + ten + bienSo + " đã ký biên bản này"
                + nhanHang + luc + luuGiay;
    }

    private static String tien(BigDecimal so) {
        return so == null ? null : DinhDangEmail.tien(so);
    }

    private static <T> List<T> danhSach(List<T> ds) {
        return ds == null ? List.of() : ds;
    }

    private static String sach(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String nvl(String s) {
        return sach(s) == null ? CHAM : s.trim();
    }

    private static String noi(String giua, String... phan) {
        String kq = Arrays.stream(phan).map(PdfBienBanTraHang::sach).filter(Objects::nonNull)
                .collect(Collectors.joining(giua));
        return kq.isEmpty() ? null : kq;
    }
}
