package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.customize.PhienDongGoiDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BangChungDongGoiRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.services.multitable.DongGoiService;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.dev.backend.utils.SauCommit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import com.dev.backend.i18n.ThongDiep;

@Service
@Slf4j
public class DongGoiServiceImpl implements DongGoiService {

    private static final List<Integer> PHIEU_DANG_MO = List.of(ITrangThaiPhieuXuat.NHAP, ITrangThaiPhieuXuat.CHO_XUAT);

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private BangChungDongGoiService bangChungDongGoiService;

    @Autowired
    private BangChungDongGoiRepository bangChungDongGoiRepository;

    @Autowired(required = false)
    private KenhBanHangDongBoService kenhBanHangDongBoService;

    @Override
    @Transactional(readOnly = true)
    public PhienDongGoiDto layPhienTheoDon(Integer donBanHangId) {
        DonBanHang don = donBanHangRepository.findById(donBanHangId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("khoVanHanh.donBanKhongTimThay"), HttpStatus.NOT_FOUND, null));
        if (!"don_ban_hang".equals(don.getLoaiChungTu())) {
            throw new CommonException(ThongDiep.of("khoVanHanh.khongPhaiDonBan"));
        }

        // Phiếu đang mở (nháp / chờ xuất) trước; không còn thì phiếu gần nhất (đã xuất / đã hủy) để xem lại
        List<PhieuXuatKho> phieuMo = phieuXuatKhoRepository.findByDonBanHangIdAndTrangThaiInOrderByIdDesc(donBanHangId, PHIEU_DANG_MO);
        PhieuXuatKho phieu = !phieuMo.isEmpty() ? phieuMo.get(0)
                : phieuXuatKhoRepository.findByDonBanHangId(donBanHangId).stream()
                        .max(Comparator.comparing(PhieuXuatKho::getId)).orElse(null);
        if (phieu == null) {
            throw new CommonException(ThongDiep.of("khoVanHanh.donChuaCoPhieuXuatDongGoi", don.getSoDonHang()), HttpStatus.CONFLICT, null);
        }
        kiemTraKho(phieu.getKho());
        return taoPhien(don, phieu, null, null, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PhienDongGoiDto quet(Integer phieuXuatKhoId, QuetBarcodeRequest request) {
        PhieuXuatKho phieu = khoaPhieu(phieuXuatKhoId);
        DonBanHang don = phieu.getDonBanHang();
        kiemTraCoTheDongGoi(phieu, don);

        String ma = request.getBarcode().trim();
        BigDecimal soLuong = request.getSoLuong() != null && request.getSoLuong().compareTo(BigDecimal.ZERO) > 0
                ? request.getSoLuong().setScale(3, RoundingMode.HALF_UP)
                : BigDecimal.ONE.setScale(3, RoundingMode.HALF_UP);

        List<ChiTietPhieuXuatKho> dong = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());
        // Ưu tiên dòng khớp mã còn thiếu (phòng phiếu có hai dòng cùng biến thể)
        ChiTietPhieuXuatKho khop = dong.stream()
                .filter(ct -> khopMa(ct.getBienTheSanPham(), ma) && soLuong(ct.getSoLuongDaDongGoi()).compareTo(soLuong(ct.getSoLuongXuat())) < 0)
                .findFirst()
                .orElse(dong.stream().filter(ct -> khopMa(ct.getBienTheSanPham(), ma)).findFirst().orElse(null));
        if (khop == null) {
            throw new CommonException(ThongDiep.of("khoVanHanh.maKhongThuocDon", ma, don.getSoDonHang()));
        }

        String sku = khop.getBienTheSanPham().getMaSku();
        BigDecimal daQuet = soLuong(khop.getSoLuongDaDongGoi());
        BigDecimal can = soLuong(khop.getSoLuongXuat());
        if (daQuet.compareTo(can) >= 0) {
            throw new CommonException(ThongDiep.of("khoVanHanh.matHangDaDongGoiDu", sku, hienThi(daQuet), hienThi(can)));
        }
        BigDecimal moi = daQuet.add(soLuong);
        if (moi.compareTo(can) > 0) {
            throw new CommonException(ThongDiep.of("khoVanHanh.quetVuotYeuCauDongGoi", hienThi(daQuet), hienThi(soLuong), hienThi(can)));
        }
        khop.setSoLuongDaDongGoi(moi);
        chiTietPhieuXuatKhoRepository.save(khop);

        ghiNhatKy(phieu, IHanhDong.quet_dong_goi, daQuet.toPlainString(), moi.toPlainString(),
                "Quét mã " + ma + " (" + hienThi(moi) + "/" + hienThi(can) + ") đóng gói đơn " + don.getSoDonHang());

        String tenSp = khop.getBienTheSanPham().getSanPham() != null ? khop.getBienTheSanPham().getSanPham().getTenSanPham() : sku;
        return taoPhien(don, phieu, dong, khop.getId(),
                ThongDiep.dich("khoVanHanh.daQuetSanPham", hienThi(soLuong), tenSp, sku, hienThi(moi), hienThi(can)));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PhienDongGoiDto hoanTat(Integer phieuXuatKhoId) {
        PhieuXuatKho phieu = khoaPhieu(phieuXuatKhoId);
        DonBanHang don = phieu.getDonBanHang();

        // Bấm lại / hai tab: phiếu đã đóng gói thì trả phiên hiện tại, không báo lỗi
        if (Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(phieu.getTrangThai()) && don != null
                && !Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            kiemTraKho(phieu.getKho());
            return taoPhien(don, phieu, null, null, ThongDiep.dich("khoVanHanh.phieuXuatDaDongGoiTruoc", phieu.getSoPhieuXuat()));
        }
        kiemTraCoTheDongGoi(phieu, don);

        List<ChiTietPhieuXuatKho> dong = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());
        if (dong.isEmpty()) {
            throw new CommonException(ThongDiep.of("khoVanHanh.phieuXuatKhongCoSanPhamDongGoi", phieu.getSoPhieuXuat()));
        }
        for (ChiTietPhieuXuatKho ct : dong) {
            BigDecimal daQuet = soLuong(ct.getSoLuongDaDongGoi());
            BigDecimal can = soLuong(ct.getSoLuongXuat());
            if (daQuet.compareTo(can) < 0) {
                throw new CommonException(ThongDiep.of("khoVanHanh.chuaDongGoiDu", ct.getBienTheSanPham().getMaSku(), hienThi(daQuet), hienThi(can)));
            }
        }

        if (!bangChungDongGoiService.kiemTraDaDuBangChung(don)) {
            BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
            boolean yeuCauVideo = tongTien.compareTo(BangChungDongGoiServiceImpl.NGUONG_TIEN_VIDEO) >= 0;
            ThongDiep thieuMsg = yeuCauVideo
                    ? ThongDiep.of("khoVanHanh.donChuaCoVideoDongGoi", don.getSoDonHang(),
                            BangChungDongGoiServiceImpl.chuThoiLuongTheoKhoa(BangChungDongGoiServiceImpl.THOI_LUONG_VIDEO_TOI_THIEU),
                            BangChungDongGoiServiceImpl.chuThoiLuongTheoKhoa(BangChungDongGoiServiceImpl.THOI_LUONG_VIDEO_TOI_DA))
                    : ThongDiep.of("khoVanHanh.donChuaDuAnhDongGoi", don.getSoDonHang());
            throw new CommonException(thieuMsg, HttpStatus.BAD_REQUEST, null);
        }

        // Liên kết các bản ghi bằng chứng của đơn vào phiếu xuất kho này — cả bản ghi còn trỏ về phiếu đã hủy (đóng gói
        // xong rồi hủy phiếu, tạo lại phiếu mới dùng lại bằng chứng): không thì bằng chứng của phiếu mới thay / xóa được
        List<BangChungDongGoi> proofs = bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(don.getId(), 1);
        for (BangChungDongGoi bc : proofs) {
            if (bc.getPhieuXuatKho() == null
                    || Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(bc.getPhieuXuatKho().getTrangThai())) {
                bc.setPhieuXuatKho(phieu);
                bangChungDongGoiRepository.save(bc);
            }
        }

        phieu.setTrangThai(ITrangThaiPhieuXuat.CHO_XUAT);
        phieuXuatKhoRepository.save(phieu);

        Integer ttDon = don.getTrangThai();
        if (ttDon != null && (ttDon == ITrangThaiDonBanHang.CHO_DONG_GOI || ttDon == ITrangThaiDonBanHang.CHO_NHAT_HANG
                || ttDon == ITrangThaiDonBanHang.DANG_XUAT_KHO)) {
            don.setTrangThai(ITrangThaiDonBanHang.DA_DONG_GOI);
            don.setNgayCapNhat(Instant.now());
            donBanHangRepository.save(don);

            if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isLazada(don.getKenhBanHang().getMaKenh())
                    && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                    && kenhBanHangDongBoService != null) {
                String lazOrderId = don.getMaDonHangKenh();
                SauCommit.chay("Đồng bộ đóng gói xong sang Lazada (ready_to_ship)",
                        () -> kenhBanHangDongBoService.dongBoTrangThaiReadyToShipLazada(lazOrderId));
            }
        }

        ghiNhatKy(phieu, IHanhDong.hoan_tat_dong_goi, "trang_thai = 0 (Nháp)", "trang_thai = 6 (Chờ xuất - đã đóng gói)",
                "Hoàn tất đóng gói đơn " + don.getSoDonHang() + " (" + dong.size() + " dòng sản phẩm)");
        return taoPhien(don, phieu, dong, null,
                ThongDiep.dich("khoVanHanh.daDongGoiXongDon", don.getSoDonHang(), phieu.getSoPhieuXuat()));
    }

    // ===================== kiểm tra =====================

    /** Câu đọc phiếu đầu tiên của giao dịch phải là câu khóa (SELECT ... FOR UPDATE). */
    private PhieuXuatKho khoaPhieu(Integer phieuXuatKhoId) {
        return phieuXuatKhoRepository.findByIdForUpdate(phieuXuatKhoId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("khoVanHanh.phieuXuatKhongTimThay"), HttpStatus.NOT_FOUND, null));
    }

    private void kiemTraCoTheDongGoi(PhieuXuatKho phieu, DonBanHang don) {
        kiemTraKho(phieu.getKho());
        if (!"ban_hang".equals(phieu.getLoaiXuat()) || don == null) {
            throw new CommonException(ThongDiep.of("khoVanHanh.chiDongGoiPhieuXuatBan"));
        }
        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            ThongDiep canhBao = ThongDiep.of("khoVanHanh.donDaHuyKhoaDongGoi", don.getSoDonHang());
            throw new CommonException(canhBao, HttpStatus.CONFLICT,
                    taoPhien(don, phieu, null, null, ThongDiep.dich("khoVanHanh.donDaHuyKhoaDongGoi", don.getSoDonHang())));
        }
        // Chỉ phiếu xuất bị hủy (kho hủy tay): đơn vẫn còn hiệu lực, cần phiếu xuất mới — không phải hàng của đơn đã hủy
        if (Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(phieu.getTrangThai())) {
            ThongDiep canhBao = ThongDiep.of("khoVanHanh.phieuXuatDaHuyKhoaDongGoi", phieu.getSoPhieuXuat(), don.getSoDonHang());
            throw new CommonException(canhBao, HttpStatus.CONFLICT, taoPhien(don, phieu, null, null,
                    ThongDiep.dich("khoVanHanh.phieuXuatDaHuyKhoaDongGoi", phieu.getSoPhieuXuat(), don.getSoDonHang())));
        }
        Integer tt = phieu.getTrangThai();
        if (Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(tt)) {
            throw new CommonException(ThongDiep.of("khoVanHanh.phieuXuatDaXuatKho", phieu.getSoPhieuXuat()), HttpStatus.CONFLICT, null);
        }
        if (Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(tt)) {
            throw new CommonException(ThongDiep.of("khoVanHanh.phieuXuatDaDongGoiXong", phieu.getSoPhieuXuat()),
                    HttpStatus.CONFLICT, null);
        }
        if (!Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(tt)) {
            throw new CommonException(ThongDiep.of("khoVanHanh.phieuXuatKhongChoDongGoi", phieu.getSoPhieuXuat()), HttpStatus.CONFLICT, null);
        }
    }

    /** Nhân viên chỉ thao tác trên phiếu của kho đang làm việc; quản trị viên được làm ở mọi kho. */
    private void kiemTraKho(Kho kho) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user == null) {
            throw new CommonException(ThongDiep.of("khoVanHanh.nguoiDungChuaXacThucHeThong"));
        }
        boolean isAdmin = user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer khoLamViec = SecurityContextHolder.getKhoId();
        if (!isAdmin && (kho == null || khoLamViec == null || !khoLamViec.equals(kho.getId()))) {
            throw new CommonException(ThongDiep.of("khoVanHanh.phieuXuatThuocKhoKhac"), HttpStatus.FORBIDDEN, null);
        }
    }

    private static boolean khopMa(BienTheSanPham bt, String ma) {
        if (bt == null) return false;
        return (bt.getMaSku() != null && bt.getMaSku().equalsIgnoreCase(ma))
                || (bt.getMaVachSku() != null && bt.getMaVachSku().equalsIgnoreCase(ma));
    }

    // ===================== dựng phiên =====================

    private PhienDongGoiDto taoPhien(DonBanHang don, PhieuXuatKho phieu, List<ChiTietPhieuXuatKho> dong,
                                     Integer chiTietVuaQuetId, String thongBao) {
        List<ChiTietPhieuXuatKho> dongGoc = dong != null ? dong
                : chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());

        BigDecimal tongCan = BigDecimal.ZERO;
        BigDecimal tongDaQuet = BigDecimal.ZERO;
        boolean duHet = !dongGoc.isEmpty();
        List<PhienDongGoiDto.DongDongGoiDto> items = new java.util.ArrayList<>();
        for (ChiTietPhieuXuatKho ct : dongGoc) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            BigDecimal can = soLuong(ct.getSoLuongXuat());
            BigDecimal daQuet = soLuong(ct.getSoLuongDaDongGoi());
            tongCan = tongCan.add(can);
            tongDaQuet = tongDaQuet.add(daQuet);
            if (daQuet.compareTo(can) < 0) duHet = false;
            items.add(PhienDongGoiDto.DongDongGoiDto.builder()
                    .chiTietId(ct.getId())
                    .bienTheId(bt != null ? bt.getId() : null)
                    .maSku(bt != null ? bt.getMaSku() : null)
                    .maVachSku(bt != null ? bt.getMaVachSku() : null)
                    .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : (bt != null ? bt.getMaSku() : null))
                    .tenMau(bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "")
                    .tenSize(bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : "")
                    .maMauHex(com.dev.backend.utils.HienThiBienThe.maMauHex(bt))
                    .anh(com.dev.backend.utils.HienThiBienThe.anh(bt))
                    .sanPhamId(com.dev.backend.utils.HienThiBienThe.sanPhamId(bt))
                    .soLuongCan(can)
                    .soLuongDaQuet(daQuet)
                    .build());
        }

        double phanTram = tongCan.compareTo(BigDecimal.ZERO) > 0
                ? Math.min(100.0, tongDaQuet.multiply(BigDecimal.valueOf(100)).divide(tongCan, 2, RoundingMode.HALF_UP).doubleValue())
                : 0.0;
        boolean biHuy = Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())
                || Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(phieu.getTrangThai());
        BigDecimal tongTien = don.getTongCong() != null ? don.getTongCong() : BigDecimal.ZERO;
        boolean yeuCauVideo = tongTien.compareTo(BangChungDongGoiServiceImpl.NGUONG_TIEN_VIDEO) >= 0;
        com.dev.backend.dto.response.customize.ThongTinBangChungDonDto thongTinBc = null;
        boolean daDuBangChung = false;
        try {
            thongTinBc = bangChungDongGoiService.layThongTinBangChung(don.getId());
            daDuBangChung = Boolean.TRUE.equals(thongTinBc.getDaDuBangChung());
        } catch (Exception ex) {
            log.warn("Không thể lấy thông tin bằng chứng cho đơn {}: {}", don.getSoDonHang(), ex.getMessage());
        }
        KhachHang kh = don.getKhachHang();

        return PhienDongGoiDto.builder()
                .donBanHangId(don.getId())
                .soDonHang(don.getSoDonHang())
                .trangThaiDon(don.getTrangThai())
                .maDonHangKenh(don.getMaDonHangKenh())
                .tenKenh(don.getKenhBanHang() != null ? don.getKenhBanHang().getTenKenh() : null)
                .tenKhachHang(kh != null ? kh.getTenKhachHang() : null)
                .soDienThoai(kh != null ? kh.getSoDienThoai() : null)
                .diaChiGiaoHang(don.getDiaChiGiaoHang())
                .phieuXuatKhoId(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .trangThaiPhieu(phieu.getTrangThai())
                .khoId(phieu.getKho() != null ? phieu.getKho().getId() : null)
                .tenKho(phieu.getKho() != null ? phieu.getKho().getTenKho() : null)
                .maPickList(don.getDanhSachNhatHang() != null ? don.getDanhSachNhatHang().getMaPickList() : null)
                .tongSoLuongCan(tongCan)
                .tongSoLuongDaQuet(tongDaQuet)
                .phanTramHoanThanh(phanTram)
                .coTheHoanTat(!biHuy && duHet && daDuBangChung && Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(phieu.getTrangThai()))
                .biHuy(biHuy)
                .thongBao(thongBao)
                .chiTietVuaQuetId(chiTietVuaQuetId)
                .tongTienDonHang(tongTien)
                .yeuCauVideo(yeuCauVideo)
                .loaiYeuCau(yeuCauVideo ? "VIDEO_15_30S" : "ANH_2_BUOC")
                .thoiLuongVideoToiThieu(BangChungDongGoiServiceImpl.THOI_LUONG_VIDEO_TOI_THIEU)
                .thoiLuongVideoToiDa(BangChungDongGoiServiceImpl.THOI_LUONG_VIDEO_TOI_DA)
                .daDuBangChung(daDuBangChung)
                .danhSachBangChung(thongTinBc != null ? thongTinBc.getDanhSachBangChung() : java.util.Collections.emptyList())
                .items(items)
                .build();
    }

    /** Ghi lịch sử SAU KHI commit: lỗi ghi nhật ký không được làm hỏng giao dịch đóng gói (rollback-only). */
    private void ghiNhatKy(PhieuXuatKho phieu, String hanhDong, String giaTriCu, String giaTriMoi, String ghiChu) {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth == null || auth.getId() == null) {
            log.info("[NHAT-KY-DONG-GOI] {} phiếu {}: {}", hanhDong, phieu.getSoPhieuXuat(), ghiChu);
            return;
        }
        Integer nguoiId = auth.getId();
        Integer phieuId = phieu.getId();
        Kho kho = phieu.getKho();
        SauCommit.chay("Ghi nhật ký đóng gói phiếu " + phieu.getSoPhieuXuat(), () -> lichSuThayDoiService.createGiaoDichRieng(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.phieu_xuat_kho)
                .idThamChieu(phieuId)
                .kho(kho)
                .hanhDong(hanhDong)
                .giaTriCu(giaTriCu)
                .giaTriMoi(giaTriMoi)
                .nguoiThucHien(nguoiDungRepository.findById(nguoiId).orElse(null))
                .ngayThucHien(Instant.now())
                .ghiChu(ghiChu)
                .build()));
    }

    private static BigDecimal soLuong(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static String hienThi(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}
