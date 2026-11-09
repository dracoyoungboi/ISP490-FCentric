package com.dev.backend.services.impl.multitable;

import com.dev.backend.i18n.CoThongDiep;
import com.dev.backend.dto.response.BaoCaoKhachHangDTO;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BaoCaoKhachHangRepository;
import com.dev.backend.repository.BaoCaoKhachHangRepository.KhachMua;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import com.dev.backend.i18n.ThongDiep;

/**
 * Báo cáo khách hàng (màn /reports/customers): khách mới, khách quay lại theo kỳ, phần tổng cả kỳ, danh sách khách mua
 * trong kỳ và tệp Excel của màn. Màn và tệp Excel đọc cùng một nguồn nên luôn khớp nhau.
 */
@Service
@RequiredArgsConstructor
public class BaoCaoKhachHangService {

    private static final ZoneId MUI_GIO = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int SO_DONG_TOI_DA = 100;

    private final BaoCaoKhachHangRepository repo;
    private final XuatBaoCaoService xuatBaoCaoService;

    /** Bộ lọc của màn. loai: ngay | tuan | thang | nam | so_sanh. */
    public record ThamSo(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang, Integer tuNam,
                         Integer denNam, Integer khoId) {
    }

    /** Một khách trong danh sách "Khách mua trong kỳ" của màn. */
    public record KhachMuaDTO(int id, String ma, String ten, String soDienThoai, long soDon, BigDecimal doanhThu,
                              LocalDate lanDauMua, LocalDate muaGanNhat, boolean khachMoi, boolean muaLai) {
    }

    /** Một trang danh sách khách mua; tatCa / motLan / muaLai: số khách mỗi nhóm (đã lọc tìm kiếm, chưa lọc nhóm). */
    public record DanhSachKhachMua(List<KhachMuaDTO> content, long totalElements, int page, int size, long tatCa,
                                   long motLan, long muaLai) {
    }

    /** Các kỳ và phần tổng của màn. */
    public BaoCaoKhachHangDTO lay(ThamSo t) {
        List<Integer> khoIds = khoXem(t.khoId());
        List<TinhBaoCaoKhachHang.Ky> ky = cacKy(t);
        TinhBaoCaoKhachHang.Ky truoc = TinhBaoCaoKhachHang.kyTruoc(t.loai(), ky.get(0));
        TinhBaoCaoKhachHang.Ky khoangTong = TinhBaoCaoKhachHang.khoangTong(t.loai(), ky);
        LocalDate cuoi = ky.get(ky.size() - 1).den();

        // Tải đơn từ kỳ liền trước kỳ đầu để kỳ đầu cũng có tỷ lệ so với kỳ trước
        List<TinhBaoCaoKhachHang.Don> don = repo.donDaGiao(truoc.tu(), cuoi, khoIds);
        Map<Integer, TinhBaoCaoKhachHang.LichSu> lichSu = repo.lichSuKhach(truoc.tu(), cuoi, khoIds, khoangTong.den());
        Map<Integer, LocalDate> lanDau = new LinkedHashMap<>();
        lichSu.forEach((id, ls) -> {
            if (ls.lanDau() != null) lanDau.put(id, ls.lanDau());
        });

        return new BaoCaoKhachHangDTO(
                TinhBaoCaoKhachHang.theoKy(ky, truoc, don, lanDau, LocalDate.now(MUI_GIO)),
                TinhBaoCaoKhachHang.tong(khoangTong, don, lichSu));
    }

    /**
     * Danh sách khách mua trong khoảng của phần tổng, doanh thu lớn trước.
     * nhom: tat_ca | mot_lan | mua_lai; q: tìm theo tên, mã, số điện thoại (không phân biệt dấu, hoa thường).
     */
    public DanhSachKhachMua khachMua(ThamSo t, String nhom, String q, int page, int size) {
        List<Integer> khoIds = khoXem(t.khoId());
        TinhBaoCaoKhachHang.Ky khoang = TinhBaoCaoKhachHang.khoangTong(t.loai(), cacKy(t));
        List<KhachMua> tat = repo.khachMuaTrongKy(khoang.tu(), khoang.den(), khoIds);

        Predicate<KhachMua> theoNhom = switch (nhom == null || nhom.isBlank() ? "tat_ca" : nhom) {
            case "tat_ca" -> k -> true;
            case "mot_lan" -> k -> !k.muaLai();
            case "mua_lai" -> KhachMua::muaLai;
            default -> throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("khoVanHanh.nhomKhachKhongHopLe"));
        };
        String tim = boDau(q);
        Predicate<KhachMua> theoTim = tim.isEmpty() ? k -> true
                : k -> boDau(k.ten()).contains(tim) || boDau(k.ma()).contains(tim)
                || (k.soDienThoai() != null && k.soDienThoai().replace(" ", "").contains(tim.replace(" ", "")));

        // Số mỗi nhóm đếm sau khi lọc tìm kiếm, để số trên tab bằng số dòng sẽ thấy khi bấm tab
        List<KhachMua> khopTim = tat.stream().filter(theoTim).toList();
        long muaLai = khopTim.stream().filter(KhachMua::muaLai).count();
        List<KhachMua> loc = khopTim.stream().filter(theoNhom).toList();
        int co = Math.max(1, Math.min(size, SO_DONG_TOI_DA));
        int trang = Math.max(0, page);
        int tu = (int) Math.min((long) trang * co, loc.size());
        int den = Math.min(tu + co, loc.size());
        List<KhachMuaDTO> noiDung = loc.subList(tu, den).stream()
                .map(k -> new KhachMuaDTO(k.id(), k.ma(), k.ten(), k.soDienThoai(), k.soDon(), k.doanhThu(),
                        ngay(k.lanDauMua()), ngay(k.muaGanNhat()), k.khachMoi(), k.muaLai()))
                .toList();
        return new DanhSachKhachMua(noiDung, loc.size(), trang, co, khopTim.size(), khopTim.size() - muaLai, muaLai);
    }

    /** Tệp Excel của màn (đúng kiểu báo cáo, kỳ, kho đã xem); ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(ThamSo t) {
        BaoCaoKhachHangDTO bc = lay(t);
        LocalDate tu = bc.tong().tuNgay();
        LocalDate den = bc.tong().denNgay();
        List<KhachMua> khach = repo.khachMuaTrongKy(tu, den, khoXem(t.khoId()));

        String tenKy = switch (t.loai()) {
            case "ngay" -> "Theo ngày";
            case "tuan" -> "Theo tuần năm " + t.nam();
            case "thang" -> "Theo tháng năm " + t.nam();
            case "nam" -> "Từ năm " + t.tuNam() + " đến năm " + t.denNam();
            default -> "Tháng " + t.thang() + "/" + t.nam() + " so với tháng trước";
        };
        String phamVi = xuatBaoCaoService.phamViKho(t.khoId(), DoanhThuReportService.phamVi(t.khoId()));
        String tenTep = "Bao-cao-khach-hang_" + tu + "_" + den + ".xlsx";
        byte[] tep = BaoCaoKhachHangExcel.tao(new BaoCaoKhachHangExcel.DuLieu(t.loai(), tenKy, tu, den, bc.ky(),
                        bc.tong(), khach), xuatBaoCaoService.thongTin(phamVi));

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("loai", t.loai());
        nhatKy.put("tuNgay", String.valueOf(tu));
        nhatKy.put("denNgay", String.valueOf(den));
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("soKhach", khach.size());
        xuatBaoCaoService.ghiNhatKy("Báo cáo khách hàng", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }

    /**
     * Kho được xem, như Báo cáo doanh thu, sản phẩm: quản trị viên mọi kho (null) hoặc kho đã chọn; quản lý kho chỉ các
     * cửa hàng mình phụ trách (chọn kho khác thì 403, không chọn kho thì gộp các cửa hàng phụ trách).
     */
    static List<Integer> khoXem(Integer khoId) {
        DoanhThuReportService.PhamVi pv = DoanhThuReportService.phamVi(khoId);
        return pv.tatCaKho() ? null : pv.khoIds();
    }

    /** Các kỳ của bộ lọc; tham số sai trả 400 kèm câu báo lỗi. */
    static List<TinhBaoCaoKhachHang.Ky> cacKy(ThamSo t) {
        try {
            return TinhBaoCaoKhachHang.cacKy(t.loai(), t.tuNgay(), t.denNgay(), t.nam(), t.thang(), t.tuNam(), t.denNam());
        } catch (IllegalArgumentException e) {
            // Giữ khóa câu (đa ngôn ngữ) nếu lỗi gốc có
            if (e instanceof CoThongDiep coThongDiep && coThongDiep.getThongDiep() != null) {
                throw new CommonException(HttpStatus.BAD_REQUEST, coThongDiep.getThongDiep());
            }
            throw new CommonException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Chữ thường, bỏ dấu tiếng Việt (đ → d), để tìm kiếm không phân biệt dấu. */
    static String boDau(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return n.replace('đ', 'd');
    }

    private static LocalDate ngay(LocalDateTime t) {
        return t == null ? null : t.toLocalDate();
    }
}
