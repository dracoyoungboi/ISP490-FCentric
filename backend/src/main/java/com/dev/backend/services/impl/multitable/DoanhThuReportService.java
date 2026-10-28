package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.dto.response.DoanhThuTongHopDTO;
import com.dev.backend.dto.response.TienThuDTO;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DoanhThuReportRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.ThongTinCongTyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class DoanhThuReportService {

    private final DoanhThuReportRepository repo;
    private final KhoRepository khoRepository;
    private final ThongTinCongTyRepository thongTinCongTyRepository;

    /** Hồ sơ cửa hàng (một dòng, id 1 — như ThongTinCongTyService). */
    private static final int HO_SO_CONG_TY = 1;

    public List<DoanhThuChartDTO> layBaoCaoTheoNgay(LocalDate tuNgay, LocalDate denNgay, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoNgay(tuNgay, denNgay, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoTuan(Integer nam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoTuan(nam, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoThang(Integer nam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoThang(nam, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoNam(Integer tuNam, Integer denNam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoNam(tuNam, denNam, khoId));
    }

    public List<DoanhThuChartDTO> laySoSanhCungKy(Integer nam, Integer thang, Integer khoId) {
        // Tính tháng trước
        LocalDate thangHienTai = LocalDate.of(nam, thang, 1);
        LocalDate thangTruoc   = thangHienTai.minusMonths(1);
        return tinhTyLe(repo.soSanhCungKy(
                nam, thang,
                thangTruoc.getYear(), thangTruoc.getMonthValue(),
                khoId
        ));
    }

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Năm nhỏ nhất nhận ở bộ lọc (ô ngày đang gõ dở như 0002-… bị từ chối, không quét cả nghìn năm). */
    static final int NAM_NHO_NHAT = 2000;

    /**
     * Theo ngày: từ năm 2000, đến ngày trước tuNgay + 1 năm — mỗi ngày một nhãn dd/MM không lặp (khoảng dài hơn hai ngày
     * cùng dd/MM sẽ bị cộng lẫn); xem dài hơn thì dùng theo tháng.
     */
    static void kiemKhoangNgay(LocalDate tuNgay, LocalDate denNgay) {
        if (tuNgay == null || denNgay == null) throw new IllegalArgumentException("Vui lòng chọn từ ngày và đến ngày");
        if (tuNgay.getYear() < NAM_NHO_NHAT || denNgay.getYear() < NAM_NHO_NHAT) {
            throw new CommonException("Ngày phải từ năm " + NAM_NHO_NHAT + " trở đi");
        }
        if (tuNgay.isAfter(denNgay)) throw new CommonException("Từ ngày phải trước hoặc bằng đến ngày");
        if (!denNgay.isBefore(tuNgay.plusYears(1))) {
            throw new CommonException("Xem theo ngày tối đa 1 năm; khoảng dài hơn hãy xem theo tháng");
        }
    }

    // ================= Phạm vi cửa hàng =================

    /** tatCaKho: quản trị viên xem mọi kho; khác thì chỉ các kho trong khoIds (không có kho nào: -1). */
    record PhamVi(boolean quanTri, boolean tatCaKho, List<Integer> khoIds, boolean theoKhoPhuTrach) {
    }

    /** Quản trị viên xem mọi cửa hàng; quản lý kho chỉ các cửa hàng mình phụ trách (chọn kho khác thì 403). */
    static PhamVi phamVi(Integer khoId) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        boolean quanTri = user == null || (user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien));
        List<Integer> khoCuaToi = quanTri || user.getPhanQuyenNguoiDungKhos() == null ? List.of()
                : user.getPhanQuyenNguoiDungKhos().stream()
                        .filter(pq -> pq.getKho() != null).map(pq -> pq.getKho().getId()).distinct().toList();
        if (khoId != null && !quanTri && !khoCuaToi.contains(khoId)) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Bạn không phụ trách cửa hàng này");
        }
        // Tham số "in" không được rỗng: không phụ trách kho nào thì -1 (không khớp dòng nào)
        List<Integer> khoIds = khoId != null ? List.of(khoId) : khoCuaToi.isEmpty() ? List.of(-1) : khoCuaToi;
        return new PhamVi(quanTri, quanTri && khoId == null, khoIds, !quanTri && khoId == null);
    }

    // ================= Doanh thu kèm cùng kỳ năm trước =================

    /**
     * Doanh thu của kỳ (theo ngày / tháng / năm) kèm cùng kỳ năm trước — màn Báo cáo doanh thu và tệp Excel dùng chung.
     * Kỳ này cắt tới hôm nay; cùng kỳ = cùng khoảng ngày năm trước, nên năm / tháng đang chạy so với đúng phần đã qua của
     * năm / tháng đó năm trước (không so nửa năm với cả năm).
     */
    public DoanhThuTongHopDTO layTongHop(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer tuNam,
                                         Integer denNam, Integer khoId) {
        PhamVi pv = phamVi(khoId);
        LocalDate homNay = LocalDate.now(VN);
        LocalDate tu;
        LocalDate denDayDu;
        switch (loai == null ? "" : loai) {
            case "ngay" -> {
                kiemKhoangNgay(tuNgay, denNgay);
                tu = tuNgay;
                denDayDu = denNgay;
            }
            case "thang" -> {
                if (nam == null) throw new IllegalArgumentException("Vui lòng chọn năm");
                if (nam < NAM_NHO_NHAT) throw new CommonException("Năm phải từ " + NAM_NHO_NHAT + " trở đi");
                tu = LocalDate.of(nam, 1, 1);
                denDayDu = LocalDate.of(nam, 12, 31);
            }
            case "nam" -> {
                if (tuNam == null || denNam == null) throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                if (tuNam > denNam) throw new CommonException("Từ năm phải trước hoặc bằng đến năm");
                if (tuNam < NAM_NHO_NHAT) throw new CommonException("Năm phải từ " + NAM_NHO_NHAT + " trở đi");
                if (denNam - tuNam > 20) throw new CommonException("Mỗi lần xem tối đa 20 năm");
                tu = LocalDate.of(tuNam, 1, 1);
                denDayDu = LocalDate.of(denNam, 12, 31);
            }
            default -> throw new IllegalArgumentException("Kiểu báo cáo không hợp lệ");
        }
        // Cả khoảng ở tương lai: không có số liệu, cũng không so cùng kỳ (trả 0)
        boolean tuongLai = tu.isAfter(homNay);
        LocalDate den = denDayDu.isAfter(homNay) ? (tuongLai ? tu : homNay) : denDayDu;
        LocalDate tuTruoc = tu.minusYears(1);
        LocalDate denTruoc = den.minusYears(1);

        List<DoanhThuTongHopDTO.Ky> ky = new ArrayList<>();
        switch (loai) {
            case "ngay" -> {
                Map<String, DoanhThuChartDTO> nay = theoNhan(gop(pv, k -> repo.baoCaoTheoNgay(tu, den, k)));
                Map<String, DoanhThuChartDTO> truoc = theoNhan(gop(pv, k -> repo.baoCaoTheoNgay(tuTruoc, denTruoc, k)));
                int i = 0;
                for (LocalDate d = tu; !d.isAfter(denDayDu); d = d.plusDays(1)) {
                    String nhan = String.format("%02d/%02d", d.getDayOfMonth(), d.getMonthValue());
                    boolean chuaToi = d.isAfter(homNay);
                    ky.add(dongKy(nhan, i++, d, d, chuaToi ? null : nay.get(nhan), chuaToi ? null : truoc.get(nhan), chuaToi));
                }
            }
            case "thang" -> {
                Map<Integer, DoanhThuChartDTO> nay = theoSortKey(gop(pv, k -> repo.baoCaoTheoThang(nam, k)));
                Map<Integer, DoanhThuChartDTO> truoc = theoSortKey(gop(pv, k -> repo.baoCaoTheoThang(nam - 1, k)));
                for (int m = 1; m <= 12; m++) {
                    LocalDate dau = LocalDate.of(nam, m, 1);
                    LocalDate cuoi = dau.withDayOfMonth(dau.lengthOfMonth());
                    boolean chuaToi = dau.isAfter(homNay);
                    DoanhThuChartDTO t = chuaToi ? null : truoc.get(m);
                    // Tháng đang chạy: so với đúng số ngày đã qua của tháng đó năm trước; tháng chưa tới không so
                    if (!chuaToi && cuoi.isAfter(homNay)) {
                        t = tongDong(gop(pv, k -> repo.baoCaoTheoNgay(dau.minusYears(1), homNay.minusYears(1), k)));
                    }
                    ky.add(dongKy("T" + m + "/" + nam, m, dau, cuoi.isAfter(homNay) && !chuaToi ? homNay : cuoi,
                            chuaToi ? null : nay.get(m), t, chuaToi));
                }
            }
            default -> {
                Map<Integer, DoanhThuChartDTO> nay = theoSortKey(gop(pv, k -> repo.baoCaoTheoNam(tuNam, denNam, k)));
                Map<Integer, DoanhThuChartDTO> truoc = theoSortKey(gop(pv, k -> repo.baoCaoTheoNam(tuNam - 1, denNam - 1, k)));
                for (int y = tuNam; y <= denNam; y++) {
                    LocalDate dau = LocalDate.of(y, 1, 1);
                    LocalDate cuoi = LocalDate.of(y, 12, 31);
                    boolean chuaToi = dau.isAfter(homNay);
                    DoanhThuChartDTO t = chuaToi ? null : truoc.get(y - 1);
                    // Năm đang chạy: so với cùng phần đã qua của năm trước; năm chưa tới không so
                    if (!chuaToi && cuoi.isAfter(homNay)) {
                        t = tongDong(gop(pv, k -> repo.baoCaoTheoNgay(dau.minusYears(1), homNay.minusYears(1), k)));
                    }
                    ky.add(dongKy(String.valueOf(y), y, dau, cuoi.isAfter(homNay) && !chuaToi ? homNay : cuoi,
                            chuaToi ? null : nay.get(y), t, chuaToi));
                }
            }
        }
        return DoanhThuTongHopDTO.builder()
                .loai(loai)
                .tuNgay(tu).denNgay(den).tuNgayCungKy(tuTruoc).denNgayCungKy(denTruoc)
                .kyNay(tong(tuongLai ? List.of() : gop(pv, k -> repo.baoCaoTheoNgay(tu, den, k))))
                .cungKy(tong(tuongLai ? List.of() : gop(pv, k -> repo.baoCaoTheoNgay(tuTruoc, denTruoc, k))))
                .theoKhoPhuTrach(pv.theoKhoPhuTrach())
                .theoKy(ky)
                .build();
    }

    /**
     * Tệp Excel của Báo cáo doanh thu: cùng số với màn (doanh thu kèm cùng kỳ năm trước, tiền thu trong kỳ), đầu trang lấy
     * từ hồ sơ cửa hàng. Trả nội dung tệp và tên tệp (không dấu).
     */
    public record TepExcel(byte[] noiDung, String tenTep) {
    }

    public TepExcel xuatExcel(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer tuNam, Integer denNam,
                              Integer khoId) {
        DoanhThuTongHopDTO dt = layTongHop(loai, tuNgay, denNgay, nam, tuNam, denNam, khoId);
        TienThuDTO tt = layTienThu(loai, tuNgay, denNgay, nam, null, tuNam, denNam, khoId);
        PhamVi pv = phamVi(khoId);
        String phamViChu;
        if (khoId != null) {
            phamViChu = khoRepository.findById(khoId).map(Kho::getTenKho).orElse("Kho #" + khoId);
        } else if (pv.tatCaKho()) {
            phamViChu = "Tất cả kho";
        } else {
            List<String> ten = khoRepository.findAllById(pv.khoIds()).stream().map(Kho::getTenKho).toList();
            phamViChu = ten.isEmpty() ? "Không có cửa hàng phụ trách" : "Các cửa hàng phụ trách: " + String.join(", ", ten);
        }
        String tenKy = switch (loai) {
            case "ngay" -> "Theo ngày";
            case "nam" -> "Từ năm " + tuNam + " đến năm " + denNam;
            default -> "Năm " + nam;
        };
        ThongTinCongTy ct = thongTinCongTyRepository.findById(HO_SO_CONG_TY).orElse(null);
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        BaoCaoDoanhThuExcel.ThongTin tin = new BaoCaoDoanhThuExcel.ThongTin(
                ct == null ? null : (ct.getTenCongTy() != null && !ct.getTenCongTy().isBlank() ? ct.getTenCongTy() : ct.getTenDangKyKinhDoanh()),
                ct == null ? null : ct.getDiaChi(),
                ct == null ? null : ct.getMaSoThue(),
                phamViChu, tenKy,
                user == null ? null : (user.getHoTen() != null && !user.getHoTen().isBlank() ? user.getHoTen() : user.getTenDangNhap()),
                java.time.LocalDateTime.now(VN));
        String hau = switch (loai) {
            case "ngay" -> dt.getTuNgay() + "_" + dt.getDenNgay();
            case "nam" -> tuNam + "-" + denNam;
            default -> String.valueOf(nam);
        };
        return new TepExcel(BaoCaoDoanhThuExcel.tao(dt, tt, tin), "Bao-cao-doanh-thu_" + hau + ".xlsx");
    }

    /** Chạy câu doanh thu cho phạm vi: mọi kho một lần (null), không thì từng kho rồi cộng theo nhãn kỳ. */
    private static List<DoanhThuChartDTO> gop(PhamVi pv, Function<Integer, List<DoanhThuChartDTO>> cau) {
        if (pv.tatCaKho()) return cau.apply(null);
        Map<String, DoanhThuChartDTO> theoNhan = new LinkedHashMap<>();
        for (Integer k : pv.khoIds()) {
            if (k == null || k < 0) continue;
            for (DoanhThuChartDTO d : cau.apply(k)) {
                theoNhan.merge(d.getNhanThoiGian(), d, DoanhThuReportService::cong);
            }
        }
        return new ArrayList<>(theoNhan.values());
    }

    private static DoanhThuChartDTO cong(DoanhThuChartDTO a, DoanhThuChartDTO b) {
        return new DoanhThuChartDTO(a.getNhanThoiGian(), so(a.getTienHang()).add(so(b.getTienHang())),
                so(a.getPhiVanChuyen()).add(so(b.getPhiVanChuyen())), so(a.getDoanhThu()).add(so(b.getDoanhThu())),
                so(a.getGiaVon()).add(so(b.getGiaVon())), so(a.getLoiNhuan()).add(so(b.getLoiNhuan())),
                dem(a.getSoLuongDon()) + dem(b.getSoLuongDon()), a.getSortKey());
    }

    /** Cộng mọi dòng thành một dòng (null khi không có dòng nào). */
    private static DoanhThuChartDTO tongDong(List<DoanhThuChartDTO> ds) {
        return ds.stream().reduce(DoanhThuReportService::cong).orElse(null);
    }

    private static DoanhThuTongHopDTO.Tong tong(List<DoanhThuChartDTO> ds) {
        DoanhThuChartDTO t = tongDong(ds);
        return DoanhThuTongHopDTO.Tong.builder()
                .tienHang(t == null ? BigDecimal.ZERO : so(t.getTienHang()))
                .phiVanChuyen(t == null ? BigDecimal.ZERO : so(t.getPhiVanChuyen()))
                .doanhThu(t == null ? BigDecimal.ZERO : so(t.getDoanhThu()))
                .giaVon(t == null ? BigDecimal.ZERO : so(t.getGiaVon()))
                .loiNhuan(t == null ? BigDecimal.ZERO : so(t.getLoiNhuan()))
                .soDon(t == null ? 0 : dem(t.getSoLuongDon()))
                .build();
    }

    private static DoanhThuTongHopDTO.Ky dongKy(String nhan, int sortKey, LocalDate tu, LocalDate den,
                                                DoanhThuChartDTO nay, DoanhThuChartDTO truoc, boolean chuaToi) {
        return DoanhThuTongHopDTO.Ky.builder()
                .nhanThoiGian(nhan).sortKey(sortKey).tuNgay(tu).denNgay(den).chuaToi(chuaToi)
                .doanhThu(nay == null ? BigDecimal.ZERO : so(nay.getDoanhThu()))
                .giaVon(nay == null ? BigDecimal.ZERO : so(nay.getGiaVon()))
                .loiNhuan(nay == null ? BigDecimal.ZERO : so(nay.getLoiNhuan()))
                .soDon(nay == null ? 0 : dem(nay.getSoLuongDon()))
                .doanhThuCungKy(truoc == null ? BigDecimal.ZERO : so(truoc.getDoanhThu()))
                .giaVonCungKy(truoc == null ? BigDecimal.ZERO : so(truoc.getGiaVon()))
                .loiNhuanCungKy(truoc == null ? BigDecimal.ZERO : so(truoc.getLoiNhuan()))
                .soDonCungKy(truoc == null ? 0 : dem(truoc.getSoLuongDon()))
                .build();
    }

    private static Map<String, DoanhThuChartDTO> theoNhan(List<DoanhThuChartDTO> ds) {
        Map<String, DoanhThuChartDTO> m = new LinkedHashMap<>();
        ds.forEach(d -> m.merge(d.getNhanThoiGian(), d, DoanhThuReportService::cong));
        return m;
    }

    private static Map<Integer, DoanhThuChartDTO> theoSortKey(List<DoanhThuChartDTO> ds) {
        Map<Integer, DoanhThuChartDTO> m = new LinkedHashMap<>();
        ds.forEach(d -> m.merge(d.getSortKey(), d, DoanhThuReportService::cong));
        return m;
    }

    // ================= Tiền thu trong kỳ =================

    /** Khoảng ngày [tu, den) và cách gom kỳ của một loại báo cáo (cùng tham số với báo cáo doanh thu). */
    record KhoangKy(LocalDate tu, LocalDate den, String loai) {
    }

    static KhoangKy khoangKy(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang,
                             Integer tuNam, Integer denNam) {
        return switch (loai == null ? "" : loai) {
            case "ngay" -> {
                kiemKhoangNgay(tuNgay, denNgay);
                yield new KhoangKy(tuNgay, denNgay.plusDays(1), loai);
            }
            case "tuan", "thang" -> {
                if (nam == null) throw new IllegalArgumentException("Vui lòng chọn năm");
                yield new KhoangKy(LocalDate.of(nam, 1, 1), LocalDate.of(nam + 1, 1, 1), loai);
            }
            case "nam" -> {
                if (tuNam == null || denNam == null) throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                if (tuNam > denNam) throw new CommonException("Từ năm phải trước hoặc bằng đến năm");
                yield new KhoangKy(LocalDate.of(tuNam, 1, 1), LocalDate.of(denNam + 1, 1, 1), loai);
            }
            case "so_sanh" -> {
                if (nam == null || thang == null) throw new IllegalArgumentException("Vui lòng chọn năm và tháng cần so sánh");
                LocalDate dau = LocalDate.of(nam, thang, 1);
                yield new KhoangKy(dau.minusMonths(1), dau.plusMonths(1), loai);
            }
            default -> throw new IllegalArgumentException("Kiểu báo cáo không hợp lệ");
        };
    }

    /** Nhãn và khóa sắp xếp của một kỳ. */
    record NhanKy(String nhan, int sortKey) {
    }

    /**
     * Nhãn kỳ của một ngày — trùng nhãn của các câu doanh thu (DATE_FORMAT %d/%m, "Tuần " + WEEK(..., 3), "T" + tháng +
     * "/" + năm, năm) để giao diện ghép hai bảng theo nhãn.
     */
    static NhanKy nhanKy(String loai, LocalDate ngay, int tuanIso) {
        return switch (loai) {
            case "ngay" -> new NhanKy(String.format("%02d/%02d", ngay.getDayOfMonth(), ngay.getMonthValue()), ngay.getDayOfMonth());
            case "tuan" -> new NhanKy("Tuần " + tuanIso, tuanIso);
            case "nam" -> new NhanKy(String.valueOf(ngay.getYear()), ngay.getYear());
            default -> new NhanKy("T" + ngay.getMonthValue() + "/" + ngay.getYear(), ngay.getMonthValue());
        };
    }

    /**
     * Tiền thu trong kỳ: theo ngày thu tiền, tách tiền mặt / chuyển khoản (QR payOS + ghi tay) / hoàn, kèm sàn thu hộ và
     * còn phải thu tới hiện tại. Quản trị viên xem mọi cửa hàng; quản lý kho chỉ các cửa hàng mình phụ trách (chọn kho
     * khác thì 403, "Tất cả kho" thì gom các cửa hàng của mình).
     */
    public TienThuDTO layTienThu(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang,
                                 Integer tuNam, Integer denNam, Integer khoId) {
        KhoangKy ky = khoangKy(loai, tuNgay, denNgay, nam, thang, tuNam, denNam);
        PhamVi pv = phamVi(khoId);
        boolean quanTri = pv.quanTri();
        boolean tatCaKho = pv.tatCaKho();
        List<Integer> khoIds = pv.khoIds();

        Map<String, TienThuDTO.Ky> theoNhan = new LinkedHashMap<>();
        BigDecimal tmQuay = BigDecimal.ZERO, tmDon = BigDecimal.ZERO, qr = BigDecimal.ZERO, ckTay = BigDecimal.ZERO, hoan = BigDecimal.ZERO;
        long soHoan = 0;
        for (Object[] r : repo.tienThuTheoNgay(ky.tu(), ky.den(), tatCaKho, khoIds)) {
            LocalDate ngay = LocalDate.parse(String.valueOf(r[0]));
            int tuan = r[1] == null ? ngay.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) : ((Number) r[1]).intValue();
            boolean taiQuay = "POS".equals(String.valueOf(r[2]));
            BigDecimal tm = so(r[3]), q = so(r[4]), ck = so(r[5]), h = so(r[6]);
            if (taiQuay) tmQuay = tmQuay.add(tm); else tmDon = tmDon.add(tm);
            qr = qr.add(q);
            ckTay = ckTay.add(ck);
            hoan = hoan.add(h);
            soHoan += dem(r[7]);
            NhanKy nhan = nhanKy(ky.loai(), ngay, tuan);
            TienThuDTO.Ky k = theoNhan.computeIfAbsent(nhan.nhan(), n -> TienThuDTO.Ky.builder()
                    .nhanThoiGian(n).sortKey(nhan.sortKey())
                    .tienMat(BigDecimal.ZERO).chuyenKhoan(BigDecimal.ZERO).hoan(BigDecimal.ZERO).build());
            k.setTienMat(k.getTienMat().add(tm));
            k.setChuyenKhoan(k.getChuyenKhoan().add(q).add(ck));
            k.setHoan(k.getHoan().add(h));
        }
        List<TienThuDTO.Ky> dsKy = new ArrayList<>(theoNhan.values());
        dsKy.sort(Comparator.comparing(TienThuDTO.Ky::getSortKey, Comparator.nullsLast(Comparator.naturalOrder())));

        Object[] san = dongDau(repo.sanThuHo(ky.tu(), ky.den(), tatCaKho, khoIds));
        Object[] no = dongDau(repo.conPhaiThu(tatCaKho, khoIds));
        return TienThuDTO.builder()
                .tienMat(tmQuay.add(tmDon))
                .tienMatTaiQuay(tmQuay)
                .tienMatDonThuong(tmDon)
                .chuyenKhoan(qr.add(ckTay))
                .qrPayos(qr)
                .chuyenKhoanGhiTay(ckTay)
                .hoan(hoan)
                .soPhieuHoan(soHoan)
                .soDonSan(dem(san[0]))
                .sanThuHo(so(san[1]))
                .soDonConPhaiThu(dem(no[0]))
                .conPhaiThu(so(no[1]))
                .chuaDoiChieu(quanTri ? repo.chuaDoiChieu(tatCaKho, khoIds) : null)
                .theoKhoPhuTrach(!quanTri && khoId == null)
                .theoKy(dsKy)
                .build();
    }

    private static Object[] dongDau(List<Object[]> ds) {
        return ds == null || ds.isEmpty() || ds.get(0) == null ? new Object[]{0, 0} : ds.get(0);
    }

    private static BigDecimal so(Object v) {
        return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
    }

    private static long dem(Object v) {
        return v == null ? 0 : ((Number) v).longValue();
    }

    /** Tính % lợi nhuận sau khi nhận data từ DB */
    private List<DoanhThuChartDTO> tinhTyLe(List<DoanhThuChartDTO> list) {
        list.forEach(row -> {
            if (row.getDoanhThu() != null && row.getDoanhThu().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal tyLe = row.getLoiNhuan()
                        .divide(row.getDoanhThu(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);
                row.setTyLeLaiGop(tyLe);
            } else {
                row.setTyLeLaiGop(BigDecimal.ZERO);
            }
        });
        return list;
    }
}