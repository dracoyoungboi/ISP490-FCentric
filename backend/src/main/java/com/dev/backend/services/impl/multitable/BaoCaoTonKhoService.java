package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.impl.entities.KhoService;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

/**
 * Báo cáo tồn kho (màn /reports/inventory): tồn từng mã SKU ở từng kho tại thời điểm xem, và tệp Excel của màn này.
 * Tình trạng tính đúng như màn (TonKhoTongQuan.jsx, hàm trangThaiTon): so tồn thực tế với tồn tối thiểu của mã.
 */
@Service
@RequiredArgsConstructor
public class BaoCaoTonKhoService {

    /** Mã tình trạng, khớp khóa tab trên màn. */
    public static final String HET_HANG = "het_hang", SAP_HET = "thieu_hang", BINH_THUONG = "binh_thuong",
            DU_HANG = "du_hang", DANG_VAN_CHUYEN = "dang_van_chuyen";

    static final Map<String, String> TEN_TINH_TRANG = Map.of(
            HET_HANG, "Hết hàng",
            SAP_HET, "Sắp hết hàng",
            BINH_THUONG, "Bình thường",
            DU_HANG, "Dư hàng",
            DANG_VAN_CHUYEN, "Đang vận chuyển");

    /** Giá trị ?tinhTrang= trên đường dẫn của màn → mã tình trạng (null = tất cả). */
    private static final Map<String, String> TAB = Map.of(
            "het-hang", HET_HANG, "thieu-hang", SAP_HET, "binh-thuong", BINH_THUONG, "du-hang", DU_HANG);

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ThongKeHeThongService thongKeHeThongService;
    private final KhoRepository khoRepository;
    private final JwtService jwtService;
    private final XuatBaoCaoService xuatBaoCaoService;

    /** Một dòng của báo cáo: số liệu từ câu tồn kho tổng hợp kèm tình trạng đã tính. */
    public record Dong(TonKhoProjection so, String tinhTrang) {
    }

    /**
     * Nhân viên kho chỉ xem kho mình được phân công và phải chọn một kho; các vai trò khác xem mọi kho
     * (như GET /thong-ke-he-thong/ton-kho-tong-quan).
     */
    public void kiemTraKhoXem(Integer khoId) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user != null && user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.nhan_vien_kho)) {
            if (khoId == null) throw new CommonException(ThongDiep.of("khoVanHanh.thieuKhoId"));
            if (!jwtService.inWorkspace(khoId, user)) throw new CommonException(ThongDiep.of("khoVanHanh.khongQuanLyKhoNay"));
        }
    }

    /**
     * Tình trạng như màn: Kho Trung Chuyển còn hàng là "Đang vận chuyển" (hết thì không có tình trạng); kho khác: tồn ≤ 0
     * hết hàng, ≤ tồn tối thiểu sắp hết, ≤ 1,5 lần tồn tối thiểu bình thường, còn lại (kể cả mã chưa đặt tồn tối thiểu) dư hàng.
     */
    static String tinhTrang(BigDecimal tonThucTe, Integer tonToiThieu, boolean laTrungChuyen) {
        double ton = tonThucTe == null ? 0 : tonThucTe.doubleValue();
        if (laTrungChuyen) return ton > 0 ? DANG_VAN_CHUYEN : null;
        double min = tonToiThieu == null ? 0 : tonToiThieu;
        if (ton <= 0) return HET_HANG;
        if (min > 0 && ton <= min) return SAP_HET;
        if (min > 0 && ton <= min * 1.5) return BINH_THUONG;
        return DU_HANG;
    }

    /** Các dòng của màn sau khi lọc kho, từ khóa và tab tình trạng (tab: giá trị ?tinhTrang=, trống = tất cả). */
    List<Dong> lay(Integer khoId, String tuKhoa, String tab, Set<Integer> khoAo) {
        String loc = tab == null ? null : TAB.get(tab);
        return thongKeHeThongService.getTonKhoTongHop(khoId, tuKhoa).stream()
                .map(p -> new Dong(p, tinhTrang(p.getOnHand(), p.getMucTonToiThieu(), khoAo.contains(p.getKhoId()))))
                .filter(d -> loc == null || loc.equals(d.tinhTrang()))
                .toList();
    }

    /** Tệp Excel của màn (đúng kho, từ khóa, tab tình trạng đang chọn); ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(Integer khoId, String keyword, String tab) {
        kiemTraKhoXem(khoId);
        String tuKhoa = keyword == null || keyword.isBlank() ? null : keyword.trim();
        String tabHopLe = tab != null && TAB.containsKey(tab) ? tab : null;
        Set<Integer> khoAo = khoRepository.findAll().stream().filter(KhoService::laKhoAo).map(Kho::getId).collect(Collectors.toSet());
        List<Dong> ds = lay(khoId, tuKhoa, tabHopLe, khoAo);

        String phamVi = xuatBaoCaoService.tenKho(khoId);
        StringBuilder boLoc = new StringBuilder("Tình trạng: ")
                .append(tabHopLe == null ? "Tất cả" : TEN_TINH_TRANG.get(TAB.get(tabHopLe)));
        if (tuKhoa != null) boLoc.append(" · Từ khóa: \"").append(tuKhoa).append('"');
        KhuonExcelBaoCao.ThongTin tin = xuatBaoCaoService.thongTin(phamVi);
        String tenTep = "Bao-cao-ton-kho_" + LocalDate.now(VN) + ".xlsx";
        byte[] tep = BaoCaoTonKhoExcel.tao(ds, khoAo, boLoc.toString(), tin);

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("tinhTrang", tabHopLe);
        nhatKy.put("tuKhoa", tuKhoa);
        nhatKy.put("soDong", ds.size());
        xuatBaoCaoService.ghiNhatKy("Báo cáo tồn kho", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }
}
