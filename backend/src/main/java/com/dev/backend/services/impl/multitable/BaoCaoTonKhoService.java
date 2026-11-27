package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.customize.LoHangTonKhoDTO;
import com.dev.backend.dto.response.customize.LoTrongKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoViTriRepository;
import com.dev.backend.services.impl.entities.KhoService;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.utils.XemGiaVon;

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
    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final TonKhoViTriRepository tonKhoViTriRepository;
    private final KhoaKiemKeGuard khoaKiemKeGuard;

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

    /**
     * Các lô đang tồn (tồn &gt; 0) của một mã ở một kho, lô vào kho trước nằm trên — phần sổ xuống khi bấm một dòng của
     * màn. Cộng tồn các lô bằng On Hand, cộng tồn × giá vốn lô bằng Giá trị tồn của dòng (cùng nguồn ton_kho_theo_lo).
     * Chặn kho như bảng: nhân viên kho chỉ xem kho mình được phân công.
     */
    @Transactional(readOnly = true)
    public List<LoTrongKhoDto> loCuaMa(Integer khoId, Integer bienTheId) {
        kiemTraKhoXem(khoId);
        List<LoHangTonKhoDTO> lots = tonKhoTheoLoRepository.findLoHangByBienTheAndKho(bienTheId, khoId);
        if (lots.isEmpty()) return List.of();

        List<Integer> loIds = lots.stream().map(LoHangTonKhoDTO::getLoHangId).toList();
        Map<Integer, List<LoTrongKhoDto.KeCuaLo>> keTheoLo = new HashMap<>();
        for (Object[] r : tonKhoViTriRepository.keCuaLoTheoKho(khoId, loIds)) {
            keTheoLo.computeIfAbsent(((Number) r[0]).intValue(), k -> new ArrayList<>())
                    .add(new LoTrongKhoDto.KeCuaLo(((Number) r[1]).intValue(), (String) r[2], ((Number) r[3]).intValue()));
        }

        // Phần đang kiểm kê: cùng cách tính với nhãn "Đang kiểm kê N" của dòng (đọc thường, không khóa)
        Map<Integer, BigDecimal> tonTheoLo = new HashMap<>();
        lots.forEach(l -> tonTheoLo.put(l.getLoHangId(), l.getSoLuongTon()));
        Map<Integer, BigDecimal> dangKiem = khoaKiemKeGuard.luongDangKiemKeHienThi(khoId, tonTheoLo);
        String maDot = null;
        if (dangKiem.values().stream().anyMatch(v -> v != null && v.signum() > 0)) {
            KhoaKiemKeGuard.KiemKeTheoMa kk = khoaKiemKeGuard.dangKiemKeTheoMa(khoId, List.of(bienTheId));
            maDot = kk.dotToanKho() != null ? kk.dotToanKho() : kk.dotCuaMa().get(bienTheId);
        }

        // Giá vốn lô là số nội bộ: người không được xem giá vốn (nhân viên bán hàng, SRS 2.4.1) nhận null
        boolean xemGiaVon = XemGiaVon.nguoiDangNhapDuocXem();
        List<LoTrongKhoDto> kq = new ArrayList<>();
        for (LoHangTonKhoDTO l : lots) {
            List<LoTrongKhoDto.KeCuaLo> ke = keTheoLo.getOrDefault(l.getLoHangId(), List.of());
            BigDecimal trenKe = BigDecimal.valueOf(ke.stream().mapToLong(LoTrongKhoDto.KeCuaLo::soLuong).sum());
            BigDecimal kiem = dangKiem.getOrDefault(l.getLoHangId(), BigDecimal.ZERO);
            boolean coKiem = kiem != null && kiem.signum() > 0;
            kq.add(new LoTrongKhoDto(
                    l.getLoHangId(), l.getMaLo(), l.getNgayNhapGanNhat(), l.getNgaySanXuat(), l.getTenNhaCungCap(),
                    xemGiaVon ? l.getGiaVonLo() : null, l.getSoLuongTon(), l.getSoLuongDaDat().max(BigDecimal.ZERO),
                    coKiem ? kiem : BigDecimal.ZERO, coKiem ? maDot : null,
                    ke, l.getSoLuongTon().subtract(trenKe).max(BigDecimal.ZERO)));
        }
        // Lô vào kho trước ở trên (thứ tự xuất trước); chưa có ngày nhập thì xuống cuối
        kq.sort(Comparator.comparing(LoTrongKhoDto::ngayNhap, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(LoTrongKhoDto::maLo, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(LoTrongKhoDto::loHangId));
        return kq;
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
        byte[] tep = BaoCaoTonKhoExcel.tao(ds, khoAo, boLoc.toString(), tin, XemGiaVon.nguoiDangNhapDuocXem());

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("tinhTrang", tabHopLe);
        nhatKy.put("tuKhoa", tuKhoa);
        nhatKy.put("soDong", ds.size());
        xuatBaoCaoService.ghiNhatKy("Báo cáo tồn kho", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }
}
