package com.dev.backend.services.impl.trahang;

import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.dto.trahang.TraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.services.impl.kiemke.SoTonKeService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Ghi một lần trả hàng tại quầy trong MỘT giao dịch (đặc tả BA bước 5 "giao dịch nguyên tử"): phiếu trả RET-…, phiếu
 * nhập hàng bán trả lại PN-RET-… (chỉ hàng Đạt) ở cửa hàng nhận, cộng tồn + xếp kệ, nhật ký kho, đánh dấu đơn gốc trả
 * một phần / trả hết, dùng duyệt quá hạn. Lỗi bất kỳ → rollback toàn bộ. Nơi gọi (TraHangTaiQuayService) thử lại bằng
 * giao dịch mới khi trùng số chứng từ / deadlock.
 */
@Service
public class TraHangTaiQuayTransaction {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter NGAY = DateTimeFormatter.BASIC_ISO_DATE;
    private static final int MAX_DONG = 100;

    @Autowired
    private EntityManager em;
    @Autowired
    private PosCatalogService posCatalogService;
    @Autowired
    private TraHangTaiQuayService doc;
    @Autowired
    private PhieuTraHangRepository phieuTraHangRepository;
    @Autowired
    private ChiTietPhieuTraHangRepository chiTietRepository;
    @Autowired
    private ChiTietPhieuTraHangLoRepository chiTietLoRepository;
    @Autowired
    private YeuCauDuyetTraHangRepository yeuCauRepository;
    @Autowired
    private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Autowired
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;
    @Autowired(required = false)
    private SoTonKeService soTonKeService;
    @Autowired(required = false)
    private ApplicationEventPublisher eventPublisher;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TraHangDto.KetQua xacNhan(TraHangDto.XacNhanRequest req, Integer userId) {
        Instant bayGio = Instant.now();
        HoanTien hoan = kiemHoanTien(req);
        List<TraHangDto.DongTra> dongTra = kiemDong(req.dong());

        posCatalogService.authorizeWarehouse(req.khoId());
        Kho khoNhan = em.find(Kho.class, req.khoId());
        NguoiDung nguoiLap = em.find(NguoiDung.class, userId);

        // GBR-RET-01 + khóa đơn gốc: hai quầy cùng trả một đơn thì lần sau thấy số đã trả của lần trước (GBR-RET-03)
        DonBanHang don = em.find(DonBanHang.class, req.donBanHangId(), LockModeType.PESSIMISTIC_WRITE);
        if (don != null) em.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        doc.kiemDonHopLe(don);
        // Cùng requestId gửi hai lần đồng thời: lần sau chờ khóa đơn xong thì thấy phiếu của lần trước -> trả đúng phiếu đó
        Optional<PhieuTraHang> daLap = phieuTraHangRepository.findByRequestId(req.requestId().trim());
        if (daLap.isPresent() && Objects.equals(daLap.get().getDonBanHangId(), don.getId())) {
            PhieuTraHang p = daLap.get();
            String soPn = p.getPhieuNhapKhoId() == null ? null
                    : phieuNhapKhoRepository.findById(p.getPhieuNhapKhoId()).map(PhieuNhapKho::getSoPhieuNhap).orElse(null);
            return new TraHangDto.KetQua(p.getId(), p.getSoPhieu(), soPn, p.getTongTienHoan(), p.getPhuongThucHoan(),
                    doc.trangThaiTraHang(don.getId()));
        }

        // GBR-RET-02: quá 03 ngày cần quản lý cửa hàng duyệt
        Instant thanhToanLuc = TraHangTaiQuayService.thanhToanLuc(don);
        boolean quaHan = TraHangQuyTac.quaHan(thanhToanLuc, bayGio);
        Integer yeuCauDuyetId = null;
        Integer nguoiDuyetId = null;
        String lyDoDuyet = null;
        if (quaHan) {
            if (req.yeuCauDuyetId() != null) {
                YeuCauDuyetTraHang yc = em.find(YeuCauDuyetTraHang.class, req.yeuCauDuyetId(), LockModeType.PESSIMISTIC_WRITE);
                if (yc == null || !YeuCauDuyetTraHang.DA_DUYET.equals(yc.getTrangThai())
                        || !Objects.equals(yc.getDonBanHangId(), don.getId()) || !Objects.equals(yc.getKhoId(), req.khoId())
                        || !Objects.equals(yc.getNguoiYeuCauId(), userId) || yc.getDuyetLuc() == null
                        || yc.getDuyetLuc().plus(TraHangQuyTac.HIEU_LUC_DUYET).isBefore(bayGio)) {
                    throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("traHang.duyetKhongConHieuLuc"));
                }
                yc.setTrangThai(YeuCauDuyetTraHang.DA_DUNG);
                yeuCauRepository.save(yc);
                yeuCauDuyetId = yc.getId();
                nguoiDuyetId = yc.getNguoiDuyetId();
                lyDoDuyet = yc.getLyDo();
            } else if (doc.laQuanLyCuaHang(req.khoId()) && req.lyDoDuyet() != null && !req.lyDoDuyet().isBlank()) {
                nguoiDuyetId = userId;
                lyDoDuyet = catNgan(req.lyDoDuyet().trim(), 255);
            } else {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("traHang.quaHanCanDuyet"));
            }
        }

        // Dòng đơn gốc + số đã trả / đã hoàn các lần trước
        Map<Integer, ChiTietDonBanHang> dongDon = new HashMap<>();
        for (ChiTietDonBanHang ct : don.getChiTietDonBanHangs()) dongDon.put(ct.getId(), ct);
        Map<Integer, BigDecimal> daTra = doc.daTraTheoDong(don.getId());
        Map<Integer, BigDecimal> daHoan = doc.daHoanTheoDong(don.getId());
        Map<Integer, List<LoBan>> loTheoBienThe = loConTraTheoBienThe(don.getId());

        // Kiểm từng dòng trước khi ghi gì
        List<DongGhi> ghi = new ArrayList<>();
        Set<Integer> keCuaKho = doc.keHoatDongCuaKho(req.khoId());
        // Cùng điều kiện với màn hình (donGoc.khoCoKe): chỉ bắt chọn kệ khi cửa hàng có kệ đang dùng được
        boolean khoCoKe = !keCuaKho.isEmpty();
        for (TraHangDto.DongTra d : dongTra) {
            ChiTietDonBanHang ct = dongDon.get(d.chiTietDonBanHangId());
            if (ct == null) throw new CommonException(ThongDiep.of("traHang.dongKhongThuocDon"));
            BigDecimal mua = ct.getSoLuongDat();
            BigDecimal tra = daTra.getOrDefault(ct.getId(), BigDecimal.ZERO);
            BigDecimal conTra = mua.subtract(tra);
            if (d.soLuong().compareTo(conTra) > 0) {
                // MSG-RET-03
                throw new CommonException(ThongDiep.of("traHang.vuotSoLuongConTra", ct.getBienTheSanPham().getMaSku(),
                        plain(conTra)));
            }
            boolean dat = ChiTietPhieuTraHang.DAT.equals(d.tinhTrang());
            Integer viTri = dat ? d.viTriKhoId() : null;
            if (dat && viTri != null && !keCuaKho.contains(viTri)) {
                throw new CommonException(ThongDiep.of("traHang.keKhongThuocCuaHang"));
            }
            if (dat && viTri == null && khoCoKe) {
                throw new CommonException(ThongDiep.of("traHang.chonKeChoHangDat", ct.getBienTheSanPham().getMaSku()));
            }
            BigDecimal donGia = TraHangQuyTac.donGiaThucTra(ct.getThanhTien(), ct.getTienGiamGia(), mua);
            BigDecimal tien = TraHangQuyTac.tienHoan(ct.getThanhTien(), ct.getTienGiamGia(), mua, tra,
                    daHoan.getOrDefault(ct.getId(), BigDecimal.ZERO), d.soLuong());
            List<LoTra> lo = chiaLo(loTheoBienThe.get(ct.getBienTheSanPham().getId()), d.soLuong(),
                    ct.getBienTheSanPham().getMaSku());
            ghi.add(new DongGhi(d, ct, dat, viTri, donGia, tien, lo));
        }

        BigDecimal tongTien = BigDecimal.ZERO, tongSl = BigDecimal.ZERO, slDat = BigDecimal.ZERO, slLoi = BigDecimal.ZERO;
        for (DongGhi g : ghi) {
            tongTien = tongTien.add(g.tien);
            tongSl = tongSl.add(g.d.soLuong());
            if (g.dat) slDat = slDat.add(g.d.soLuong()); else slLoi = slLoi.add(g.d.soLuong());
        }

        // Phiếu trả RET-YYYYMMDD-XXXX
        String ngay = LocalDate.now(VN).format(NGAY);
        PhieuTraHang phieu = phieuTraHangRepository.save(PhieuTraHang.builder()
                .soPhieu(soTiepTheo("RET-" + ngay + "-", phieuTraHangRepository.soDuoiLonNhat("RET-" + ngay + "-")))
                .requestId(req.requestId().trim())
                .donBanHangId(don.getId())
                .khoBanId(don.getKhoXuat().getId())
                .khoNhanId(khoNhan.getId())
                .hinhThuc(PhieuTraHang.HINH_THUC_TRA_HANG)
                .tongSoLuong(tongSl).soLuongDat(slDat).soLuongLoi(slLoi)
                .tongTienHoan(tongTien)
                .phuongThucHoan(hoan.phuongThuc)
                .nganHang(hoan.nganHang).soTaiKhoan(hoan.soTaiKhoan).tenChuTaiKhoan(hoan.tenChu).maGiaoDich(hoan.maGiaoDich)
                .quaHan(quaHan).yeuCauDuyetId(yeuCauDuyetId).nguoiDuyetId(nguoiDuyetId).lyDoDuyet(lyDoDuyet)
                .ghiChu(req.ghiChu() == null || req.ghiChu().isBlank() ? null : catNgan(req.ghiChu().trim(), 500))
                .nguoiLapId(userId)
                .ngayTao(bayGio)
                .build());

        // Phiếu nhập hàng bán trả lại PN-RET-YYYYMMDD-XXXX (chỉ khi có hàng Đạt) — Hoàn tất ngay, ghi rõ đơn gốc
        PhieuNhapKho pn = null;
        if (slDat.signum() > 0) {
            String tienTo = "PN-RET-" + ngay + "-";
            BigDecimal tongVon = BigDecimal.ZERO;
            for (DongGhi g : ghi) {
                if (!g.dat) continue;
                for (LoTra l : g.lo) tongVon = tongVon.add(l.giaVon.multiply(l.soLuong));
            }
            pn = phieuNhapKhoRepository.save(PhieuNhapKho.builder()
                    .soPhieuNhap(soTiepTheo(tienTo, soDuoiLonNhatPhieuNhap(tienTo)))
                    .kho(khoNhan)
                    .ngayNhap(bayGio)
                    .trangThai(TrangThaiPhieuNhap.COMPLETED.getValue())
                    .tongTien(tongVon)
                    // i18n-giu-nguyen: ghi chú chứng từ lưu CSDL
                    .ghiChu("Hàng bán trả lại tại quầy: " + phieu.getSoPhieu() + ", đơn gốc " + don.getSoDonHang()
                            + " (bán tại " + don.getKhoXuat().getTenKho() + ")")
                    .nguoiNhap(nguoiLap)
                    .nguoiDuyet(nguoiLap)
                    .ngayTao(bayGio)
                    .ngayCapNhat(bayGio)
                    .build());
            phieu.setPhieuNhapKhoId(pn.getId());
            phieuTraHangRepository.save(phieu);
        }

        // Khóa dòng tồn của cửa hàng nhận (mutex kho trước, rồi PK) như bán tại quầy
        Map<Integer, TonKhoTheoLo> tonTheoLo = new HashMap<>();
        if (slDat.signum() > 0) {
            if (khoaKiemKeGuard != null) khoaKiemKeGuard.giuKho(khoNhan.getId());
            List<Integer> bienThe = ghi.stream().filter(g -> g.dat).map(g -> g.ct.getBienTheSanPham().getId())
                    .distinct().sorted().toList();
            for (TonKhoTheoLo t : tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(khoNhan.getId(), bienThe)) {
                em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
                tonTheoLo.put(t.getLoHang().getId(), t);
            }
        }

        Map<Integer, BigDecimal> hoiPhucTheoBienThe = new LinkedHashMap<>();
        for (DongGhi g : ghi) {
            ChiTietPhieuTraHang dongPhieu = chiTietRepository.save(ChiTietPhieuTraHang.builder()
                    .phieuTraHangId(phieu.getId())
                    .chiTietDonBanHangId(g.ct.getId())
                    .bienTheSanPhamId(g.ct.getBienTheSanPham().getId())
                    .soLuong(g.d.soLuong())
                    .donGiaHoan(g.donGia)
                    .thanhTienHoan(g.tien)
                    .tinhTrang(g.dat ? ChiTietPhieuTraHang.DAT : ChiTietPhieuTraHang.LOI)
                    .viTriKhoId(g.viTri)
                    .lyDo(g.d.lyDo())
                    .nhomLoi(g.dat ? null : g.d.nhomLoi())
                    .build());
            for (LoTra l : g.lo) {
                chiTietLoRepository.save(ChiTietPhieuTraHangLo.builder()
                        .chiTietPhieuTraHangId(dongPhieu.getId())
                        .loHangId(l.lo.getId())
                        .soLuong(l.soLuong)
                        .giaVon(l.giaVon)
                        .build());
            }
            if (!g.dat) continue; // GBR-RET-04: hàng lỗi để riêng, không vào tồn

            for (LoTra l : g.lo) {
                if (khoaKiemKeGuard != null) {
                    if (g.viTri != null) {
                        khoaKiemKeGuard.kiemTraNhapKe(khoNhan.getId(), g.viTri, List.of(l.lo.getId()), "nhận hàng khách trả");
                    } else {
                        khoaKiemKeGuard.kiemTraNhapKho(khoNhan.getId(), List.of(l.lo.getId()), "nhận hàng khách trả");
                    }
                }
                chiTietPhieuNhapKhoRepository.save(ChiTietPhieuNhapKho.builder()
                        .phieuNhapKho(pn)
                        .bienTheSanPham(g.ct.getBienTheSanPham())
                        .loHang(l.lo)
                        .soLuongNhap(l.soLuong)
                        .donGia(l.giaVon)
                        .soLuongYeuCau(l.soLuong.intValue())
                        .soLuongDatQc(l.soLuong.intValue())
                        .soLuongLoiQc(0)
                        .trangThaiKiemDem("DA_HOAN_TAT")
                        // i18n-giu-nguyen: ghi chú chứng từ lưu CSDL
                        .ghiChu("Khách trả tại quầy (" + phieu.getSoPhieu() + "), lô " + l.lo.getMaLo())
                        .build());

                TonKhoTheoLo ton = tonTheoLo.get(l.lo.getId());
                if (ton == null) {
                    ton = TonKhoTheoLo.builder().kho(khoNhan).loHang(l.lo)
                            .soLuongTon(BigDecimal.ZERO).soLuongDaDat(BigDecimal.ZERO)
                            .ngayNhapGanNhat(bayGio).build();
                    tonTheoLo.put(l.lo.getId(), ton);
                }
                BigDecimal truoc = ton.getSoLuongTon() == null ? BigDecimal.ZERO : ton.getSoLuongTon();
                ton.setSoLuongTon(truoc.add(l.soLuong));
                if (ton.getNgayNhapGanNhat() == null) ton.setNgayNhapGanNhat(bayGio);
                ton.setLanCapNhatCuoi(bayGio);
                tonKhoTheoLoRepository.saveAndFlush(ton);

                // Bước 3: "Nhân viên lựa chọn kệ cất hàng và hệ thống sẽ cộng tồn vào kệ đã lựa chọn"
                if (g.viTri != null && soTonKeService != null) {
                    soTonKeService.xepKe(khoNhan.getId(), l.lo.getId(), g.viTri, l.soLuong.intValue());
                }

                lichSuGiaoDichKhoRepository.save(LichSuGiaoDichKho.builder()
                        .ngayGiaoDich(bayGio)
                        .loaiGiaoDich("nhap_kho")
                        .loaiThamChieu("phieu_nhap_kho")
                        .idThamChieu(pn.getId())
                        .bienTheSanPham(g.ct.getBienTheSanPham())
                        .loHang(l.lo)
                        .kho(khoNhan)
                        .soLuong(l.soLuong)
                        .soLuongTruoc(truoc)
                        .soLuongSau(ton.getSoLuongTon())
                        .giaVon(l.giaVon)
                        .nguoiDung(nguoiLap)
                        // i18n-giu-nguyen: nhật ký kho lưu CSDL
                        .ghiChu("Nhập hàng bán trả lại POS: " + pn.getSoPhieuNhap() + " (" + phieu.getSoPhieu()
                                + ", đơn " + don.getSoDonHang() + ")")
                        .build());
            }
            hoiPhucTheoBienThe.merge(g.ct.getBienTheSanPham().getId(), g.d.soLuong(), BigDecimal::add);
        }

        // Cập nhật đơn gốc: trả một phần / trả hết (không đổi trang_thai — xem migration 2026-11-11)
        boolean traHet = true;
        Map<Integer, BigDecimal> traLanNay = new HashMap<>();
        for (DongGhi g : ghi) traLanNay.merge(g.ct.getId(), g.d.soLuong(), BigDecimal::add);
        for (ChiTietDonBanHang ct : don.getChiTietDonBanHangs()) {
            BigDecimal tong = daTra.getOrDefault(ct.getId(), BigDecimal.ZERO)
                    .add(traLanNay.getOrDefault(ct.getId(), BigDecimal.ZERO));
            if (tong.compareTo(ct.getSoLuongDat()) < 0) {
                traHet = false;
                break;
            }
        }
        String trangThaiTra = traHet ? TraHangTaiQuayService.DA_TRA_HET : TraHangTaiQuayService.TRA_MOT_PHAN;
        em.createNativeQuery("UPDATE don_ban_hang SET trang_thai_tra_hang = :tt WHERE id = :id")
                .setParameter("tt", trangThaiTra).setParameter("id", don.getId()).executeUpdate();

        // Tự đẩy tồn mở bán lên kênh trực tuyến sau commit (Hybrid Sync)
        if (eventPublisher != null) {
            hoiPhucTheoBienThe.forEach((bt, sl) ->
                    eventPublisher.publishEvent(new InventoryRestockedEvent(this, bt, sl, khoNhan.getId())));
        }

        return new TraHangDto.KetQua(phieu.getId(), phieu.getSoPhieu(), pn == null ? null : pn.getSoPhieuNhap(),
                tongTien, hoan.phuongThuc, trangThaiTra);
    }

    // ================= kiểm đầu vào =================

    private record HoanTien(String phuongThuc, String nganHang, String soTaiKhoan, String tenChu, String maGiaoDich) {
    }

    private static HoanTien kiemHoanTien(TraHangDto.XacNhanRequest req) {
        if (req == null || req.requestId() == null || req.requestId().isBlank() || req.requestId().trim().length() > 64) {
            throw new CommonException(ThongDiep.of("traHang.thieuMaYeuCau"));
        }
        if (req.donBanHangId() == null) throw new CommonException(ThongDiep.of("traHang.thieuDonGoc"));
        if (req.khoId() == null) throw new CommonException(ThongDiep.of("banHang.chonKhoBanHang"));
        String pt = req.phuongThucHoan();
        if (PhieuTraHang.HOAN_TIEN_MAT.equals(pt)) {
            return new HoanTien(pt, null, null, null, null);
        }
        if (!PhieuTraHang.HOAN_CHUYEN_KHOAN.equals(pt)) {
            throw new CommonException(ThongDiep.of("traHang.chonCachHoanTien"));
        }
        String nh = sach(req.nganHang()), stk = sach(req.soTaiKhoan()), ten = sach(req.tenChuTaiKhoan()),
                ma = sach(req.maGiaoDich());
        if (nh == null || stk == null || ten == null || ma == null) {
            throw new CommonException(ThongDiep.of("traHang.thieuThongTinChuyenKhoan"));
        }
        if (!TraHangQuyTac.soTaiKhoanHopLe(stk)) throw new CommonException(ThongDiep.of("traHang.soTaiKhoanKhongHopLe"));
        return new HoanTien(pt, catNgan(nh, 100), stk, catNgan(ten, 100), catNgan(ma, 100));
    }

    private static List<TraHangDto.DongTra> kiemDong(List<TraHangDto.DongTra> dong) {
        if (dong == null || dong.isEmpty()) throw new CommonException(ThongDiep.of("traHang.chuaChonSanPham"));
        if (dong.size() > MAX_DONG) throw new CommonException(ThongDiep.of("banHang.hoaDonQuaNhieuDong", MAX_DONG));
        Set<Integer> daCo = new HashSet<>();
        for (TraHangDto.DongTra d : dong) {
            if (d == null || d.chiTietDonBanHangId() == null || !daCo.add(d.chiTietDonBanHangId())) {
                throw new CommonException(ThongDiep.of("traHang.dongKhongHopLe"));
            }
            BigDecimal sl = d.soLuong();
            if (sl == null || sl.signum() <= 0 || sl.stripTrailingZeros().scale() > 0) {
                throw new CommonException(ThongDiep.of("traHang.soLuongTraKhongHopLe"));
            }
            if (!ChiTietPhieuTraHang.DAT.equals(d.tinhTrang()) && !ChiTietPhieuTraHang.LOI.equals(d.tinhTrang())) {
                throw new CommonException(ThongDiep.of("traHang.chonHienTrang"));
            }
            if (d.lyDo() == null || !TraHangQuyTac.LY_DO.contains(d.lyDo())) {
                throw new CommonException(ThongDiep.of("traHang.chonLyDo"));
            }
            if (ChiTietPhieuTraHang.LOI.equals(d.tinhTrang())
                    && (d.nhomLoi() == null || !TraHangQuyTac.NHOM_LOI.contains(d.nhomLoi()))) {
                throw new CommonException(ThongDiep.of("traHang.chonNhomLoi"));
            }
        }
        return dong;
    }

    // ================= lô =================

    /** Một lô đã bán của đơn còn có thể nhận trả: số bán − số đã trả các lần trước. */
    private record LoBan(LoHang lo, BigDecimal conLai, BigDecimal giaVon) {
    }

    private record LoTra(LoHang lo, BigDecimal soLuong, BigDecimal giaVon) {
    }

    private record DongGhi(TraHangDto.DongTra d, ChiTietDonBanHang ct, boolean dat, Integer viTri, BigDecimal donGia,
                           BigDecimal tien, List<LoTra> lo) {
    }

    /**
     * Lô của phiếu xuất đã hoàn tất của đơn, theo biến thể, trừ phần đã trả. Lô xuất sau cùng đứng trước (trả theo thứ
     * tự ngược lúc xuất).
     */
    private Map<Integer, List<LoBan>> loConTraTheoBienThe(Integer donId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT ct.bien_the_san_pham_id, ct.lo_hang_id, SUM(ct.so_luong_xuat), MAX(ct.gia_von), MAX(ct.id) AS cuoi
                  FROM chi_tiet_phieu_xuat_kho ct
                  JOIN phieu_xuat_kho px ON px.id = ct.phieu_xuat_kho_id
                 WHERE px.don_ban_hang_id = :don AND px.trang_thai = 3 AND ct.lo_hang_id IS NOT NULL
                 GROUP BY ct.bien_the_san_pham_id, ct.lo_hang_id
                 ORDER BY cuoi DESC
                """).setParameter("don", donId).getResultList();
        Map<String, BigDecimal> daTra = new HashMap<>();
        for (Object[] r : chiTietLoRepository.daTraTheoLo(donId)) {
            daTra.put(r[0] + ":" + r[1], (BigDecimal) r[2]);
        }
        Map<Integer, List<LoBan>> kq = new HashMap<>();
        for (Object[] r : rows) {
            int bt = ((Number) r[0]).intValue();
            int lo = ((Number) r[1]).intValue();
            BigDecimal con = ((BigDecimal) r[2]).subtract(daTra.getOrDefault(bt + ":" + lo, BigDecimal.ZERO));
            if (con.signum() <= 0) continue;
            BigDecimal gv = r[3] == null ? BigDecimal.ZERO : (BigDecimal) r[3];
            kq.computeIfAbsent(bt, k -> new ArrayList<>()).add(new LoBan(em.find(LoHang.class, lo), con, gv));
        }
        return kq;
    }

    private static List<LoTra> chiaLo(List<LoBan> lo, BigDecimal can, String maSku) {
        List<LoTra> kq = new ArrayList<>();
        BigDecimal con = can;
        if (lo != null) {
            for (LoBan l : lo) {
                if (con.signum() <= 0) break;
                BigDecimal lay = l.conLai.min(con);
                kq.add(new LoTra(l.lo, lay, l.giaVon));
                con = con.subtract(lay);
            }
        }
        if (con.signum() > 0) {
            // Đơn không có đủ dòng xuất theo lô (dữ liệu lệch): không đoán lô
            throw new CommonException(ThongDiep.of("traHang.khongTimThayLoDaBan", maSku));
        }
        return kq;
    }

    // ================= số chứng từ =================

    /** Số đuôi đệm 4 chữ số (RET-20261111-0001), đúng mẫu số của đặc tả BA. */
    static String soTiepTheo(String tienTo, Number lonNhat) {
        long n = lonNhat == null ? 0 : lonNhat.longValue();
        return tienTo + String.format("%04d", n + 1);
    }

    private Number soDuoiLonNhatPhieuNhap(String tienTo) {
        Object v = em.createNativeQuery("""
                SELECT MAX(CAST(SUBSTRING(so_phieu_nhap, CHAR_LENGTH(:t) + 1) AS UNSIGNED))
                  FROM phieu_nhap_kho
                 WHERE so_phieu_nhap LIKE CONCAT(:t, '%')
                   AND SUBSTRING(so_phieu_nhap, CHAR_LENGTH(:t) + 1) REGEXP '^[0-9]+$'
                """).setParameter("t", tienTo).getSingleResult();
        return (Number) v;
    }

    private static String sach(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String catNgan(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }
}
