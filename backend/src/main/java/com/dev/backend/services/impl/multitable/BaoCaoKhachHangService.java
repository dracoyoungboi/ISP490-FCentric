package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.KhachHangTangTruongDTO;
import com.dev.backend.repository.BaoCaoKhachHangRepository;
import com.dev.backend.repository.KhachHangReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Báo cáo khách hàng (màn /reports/customers): khách mới, khách quay lại theo kỳ, và tệp Excel của màn kèm danh sách
 * khách mua trong kỳ.
 */
@Service
@RequiredArgsConstructor
public class BaoCaoKhachHangService {

    private final KhachHangReportRepository khachHangReportRepository;
    private final BaoCaoKhachHangRepository repo;
    private final XuatBaoCaoService xuatBaoCaoService;

    /** Bộ lọc của màn. loai: ngay | tuan | thang | nam | so_sanh. */
    public record ThamSo(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang, Integer tuNam,
                         Integer denNam, Integer khoId) {
    }

    /** Các dòng của bảng trên màn theo kiểu báo cáo. */
    public List<KhachHangTangTruongDTO> lay(ThamSo t) {
        return switch (t.loai()) {
            case "ngay" -> {
                canNgay(t);
                yield khachHangReportRepository.baoCaoTheoNgay(t.tuNgay(), t.denNgay(), t.khoId());
            }
            case "tuan" -> khachHangReportRepository.baoCaoTheoTuan(canNam(t), t.khoId());
            case "thang" -> khachHangReportRepository.baoCaoTheoThang(canNam(t), t.khoId());
            case "nam" -> {
                if (t.tuNam() == null || t.denNam() == null)
                    throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                yield khachHangReportRepository.baoCaoTheoNam(t.tuNam(), t.denNam(), t.khoId());
            }
            case "so_sanh" -> {
                if (t.nam() == null || t.thang() == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm và tháng cần so sánh");
                if (t.thang() < 1 || t.thang() > 12) throw new IllegalArgumentException("Tháng phải từ 1 đến 12");
                int thangTruoc = (t.thang() == 1) ? 12 : t.thang() - 1;
                int namTruoc = (t.thang() == 1) ? t.nam() - 1 : t.nam();
                yield khachHangReportRepository.soSanhCungKy(t.nam(), t.thang(), namTruoc, thangTruoc, t.khoId());
            }
            default -> throw new IllegalArgumentException("Kiểu báo cáo không hợp lệ");
        };
    }

    /** Tệp Excel của màn (đúng kiểu báo cáo, kỳ, kho đã xem); ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(ThamSo t) {
        List<KhachHangTangTruongDTO> theoKy = lay(t);
        BaoCaoNhapXuatService.Khoang kh = BaoCaoNhapXuatService.khoang(new BaoCaoNhapXuatService.ThamSo(t.loai(),
                t.tuNgay(), t.denNgay(), t.nam(), t.thang(), t.tuNam(), t.denNam(), t.khoId(), null, null));
        if (kh.tu().isAfter(kh.den())) throw new IllegalArgumentException("Từ ngày phải trước hoặc bằng đến ngày");
        List<BaoCaoKhachHangRepository.KhachMua> khach = repo.khachMuaTrongKy(kh.tu(), kh.den(), t.khoId());

        String tenKy = switch (t.loai()) {
            case "ngay" -> "Theo ngày";
            case "tuan" -> "Theo tuần năm " + t.nam();
            case "thang" -> "Theo tháng năm " + t.nam();
            case "nam" -> "Từ năm " + t.tuNam() + " đến năm " + t.denNam();
            default -> "Tháng " + t.thang() + "/" + t.nam() + " so với tháng trước";
        };
        String phamVi = xuatBaoCaoService.tenKho(t.khoId());
        String tenTep = "Bao-cao-khach-hang_" + kh.tu() + "_" + kh.den() + ".xlsx";
        byte[] tep = BaoCaoKhachHangExcel.tao(new BaoCaoKhachHangExcel.DuLieu(t.loai(), tenKy, kh.tu(), kh.den(), theoKy, khach),
                xuatBaoCaoService.thongTin(phamVi));

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("loai", t.loai());
        nhatKy.put("tuNgay", String.valueOf(kh.tu()));
        nhatKy.put("denNgay", String.valueOf(kh.den()));
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("soKhach", khach.size());
        xuatBaoCaoService.ghiNhatKy("Báo cáo khách hàng", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }

    private static void canNgay(ThamSo t) {
        if (t.tuNgay() == null || t.denNgay() == null) throw new IllegalArgumentException("Vui lòng chọn từ ngày và đến ngày");
    }

    private static int canNam(ThamSo t) {
        if (t.nam() == null) throw new IllegalArgumentException("Vui lòng chọn năm");
        return t.nam();
    }
}
