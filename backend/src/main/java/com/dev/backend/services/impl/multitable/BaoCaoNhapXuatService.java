package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.NhatKyNhapXuatDTO;
import com.dev.backend.repository.BaoCaoNhapXuatRepository;
import com.dev.backend.repository.NhatKyNhapXuatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Nhật ký nhập xuất (màn /reports/stock-movements): số nhập, xuất theo kỳ đọc từ sổ giao dịch kho, và tệp Excel của màn.
 */
@Service
@RequiredArgsConstructor
public class BaoCaoNhapXuatService {

    /** Số dòng tối đa của trang Chi tiết giao dịch (tệp quá lớn mở rất chậm). */
    static final int TOI_DA_DONG_CHI_TIET = 100_000;

    static final Map<String, String> TEN_LOAI = Map.of(
            "nhap_kho", "Nhập kho",
            "xuat_kho", "Xuất kho",
            "chuyen_kho", "Chuyển kho",
            "dieu_chinh", "Điều chỉnh");

    private final NhatKyNhapXuatRepository nhatKyRepo;
    private final BaoCaoNhapXuatRepository repo;
    private final XuatBaoCaoService xuatBaoCaoService;

    /**
     * Bộ lọc của màn. loai: ngay | tuan | thang | nam | so_sanh | chi_tiet | theo_kho. loaiGiaoDich trống = mọi loại.
     */
    public record ThamSo(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang, Integer tuNam,
                         Integer denNam, Integer khoId, String loaiGiaoDich, Integer bienTheSanPhamId) {
    }

    /** Khoảng ngày mà kiểu báo cáo đang chọn bao trùm. */
    record Khoang(LocalDate tu, LocalDate den) {
    }

    /** Các dòng của bảng trên màn theo kiểu báo cáo. */
    public List<NhatKyNhapXuatDTO> lay(ThamSo t) {
        String loaiGd = trongThanhNull(t.loaiGiaoDich());
        return switch (t.loai()) {
            case "ngay" -> {
                canNgay(t);
                yield nhatKyRepo.baoCaoTheoNgay(t.tuNgay(), t.denNgay(), t.khoId(), loaiGd);
            }
            case "tuan" -> nhatKyRepo.baoCaoTheoTuan(canNam(t), t.khoId(), loaiGd);
            case "thang" -> nhatKyRepo.baoCaoTheoThang(canNam(t), t.khoId(), loaiGd);
            case "nam" -> {
                if (t.tuNam() == null || t.denNam() == null)
                    throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                yield nhatKyRepo.baoCaoTheoNam(t.tuNam(), t.denNam(), t.khoId(), loaiGd);
            }
            case "so_sanh" -> {
                if (t.nam() == null || t.thang() == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm và tháng cần so sánh");
                if (t.thang() < 1 || t.thang() > 12) throw new IllegalArgumentException("Tháng phải từ 1 đến 12");
                int thangTruoc = (t.thang() == 1) ? 12 : t.thang() - 1;
                int namTruoc = (t.thang() == 1) ? t.nam() - 1 : t.nam();
                yield nhatKyRepo.soSanhCungKy(t.nam(), t.thang(), namTruoc, thangTruoc, t.khoId(), loaiGd);
            }
            case "chi_tiet" -> {
                canNgay(t);
                yield nhatKyRepo.chiTietGiaoDich(t.tuNgay(), t.denNgay(), t.khoId(), loaiGd, t.bienTheSanPhamId());
            }
            case "theo_kho" -> {
                canNgay(t);
                yield nhatKyRepo.tongHopTheoKho(t.tuNgay(), t.denNgay(), loaiGd);
            }
            default -> throw new IllegalArgumentException("Kiểu báo cáo không hợp lệ");
        };
    }

    /** Khoảng ngày của kiểu báo cáo (theo tuần, tháng: cả năm; so sánh: tháng trước tới hết tháng đang chọn). */
    static Khoang khoang(ThamSo t) {
        return switch (t.loai()) {
            case "tuan", "thang" -> new Khoang(LocalDate.of(t.nam(), 1, 1), LocalDate.of(t.nam(), 12, 31));
            case "nam" -> new Khoang(LocalDate.of(t.tuNam(), 1, 1), LocalDate.of(t.denNam(), 12, 31));
            case "so_sanh" -> {
                LocalDate dauThang = LocalDate.of(t.nam(), t.thang(), 1);
                yield new Khoang(dauThang.minusMonths(1), dauThang.plusMonths(1).minusDays(1));
            }
            default -> new Khoang(t.tuNgay(), t.denNgay());
        };
    }

    static String tenKy(ThamSo t) {
        return switch (t.loai()) {
            case "ngay" -> "Theo ngày";
            case "tuan" -> "Theo tuần năm " + t.nam();
            case "thang" -> "Theo tháng năm " + t.nam();
            case "nam" -> "Từ năm " + t.tuNam() + " đến năm " + t.denNam();
            case "so_sanh" -> "Tháng " + t.thang() + "/" + t.nam() + " so với tháng trước";
            case "chi_tiet" -> "Chi tiết giao dịch";
            default -> "Theo kho";
        };
    }

    /** Tệp Excel của màn (đúng kiểu báo cáo, kỳ, kho, loại giao dịch đã xem); ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(ThamSo t) {
        String loaiGd = trongThanhNull(t.loaiGiaoDich());
        // Kiểu Chi tiết giao dịch: bảng trên màn là từng dòng sổ, đã có ở trang Chi tiết — không nạp lại cả kỳ
        if ("chi_tiet".equals(t.loai())) canNgay(t);
        List<NhatKyNhapXuatDTO> theoKy = "chi_tiet".equals(t.loai()) ? List.of() : lay(t);
        Khoang kh = khoang(t);
        if (kh.tu().isAfter(kh.den())) throw new IllegalArgumentException("Từ ngày phải trước hoặc bằng đến ngày");
        // Kho chọn trên màn không áp vào kiểu "Theo kho" (bảng so sánh mọi kho)
        Integer khoId = "theo_kho".equals(t.loai()) ? null : t.khoId();
        List<BaoCaoNhapXuatRepository.TheoLoai> theoLoai = repo.theoLoai(kh.tu(), kh.den(), khoId, loaiGd);
        List<NhatKyNhapXuatDTO> theoKho = khoId == null
                ? nhatKyRepo.tongHopTheoKho(kh.tu(), kh.den(), loaiGd) : List.of();
        boolean coChiTiet = kh.den().isBefore(kh.tu().plusYears(1));
        List<BaoCaoNhapXuatRepository.GiaoDich> chiTiet = coChiTiet
                ? repo.chiTiet(kh.tu(), kh.den(), khoId, loaiGd, TOI_DA_DONG_CHI_TIET + 1) : null;

        String phamVi = xuatBaoCaoService.tenKho(khoId);
        String dongPhu = "Loại giao dịch: " + (loaiGd == null ? "Tất cả" : TEN_LOAI.getOrDefault(loaiGd, loaiGd));
        String tenTep = "Nhat-ky-nhap-xuat_" + kh.tu() + "_" + kh.den() + ".xlsx";
        byte[] tep = BaoCaoNhapXuatExcel.tao(new BaoCaoNhapXuatExcel.DuLieu(t.loai(), tenKy(t), kh.tu(), kh.den(),
                dongPhu, theoKy, theoLoai, theoKho, chiTiet), xuatBaoCaoService.thongTin(phamVi));

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("loai", t.loai());
        nhatKy.put("tuNgay", String.valueOf(kh.tu()));
        nhatKy.put("denNgay", String.valueOf(kh.den()));
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("loaiGiaoDich", loaiGd);
        xuatBaoCaoService.ghiNhatKy("Nhật ký nhập xuất", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }

    private static void canNgay(ThamSo t) {
        if (t.tuNgay() == null || t.denNgay() == null) throw new IllegalArgumentException("Vui lòng chọn từ ngày và đến ngày");
    }

    private static int canNam(ThamSo t) {
        if (t.nam() == null) throw new IllegalArgumentException("Vui lòng chọn năm");
        return t.nam();
    }

    private static String trongThanhNull(String s) {
        return s == null || s.isBlank() || "ALL".equals(s) ? null : s;
    }
}
