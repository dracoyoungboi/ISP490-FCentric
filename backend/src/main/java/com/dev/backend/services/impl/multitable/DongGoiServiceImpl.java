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
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.DongGoiService;
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

    @Override
    @Transactional(readOnly = true)
    public PhienDongGoiDto layPhienTheoDon(Integer donBanHangId) {
        DonBanHang don = donBanHangRepository.findById(donBanHangId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đơn bán hàng", HttpStatus.NOT_FOUND, null));
        if (!"don_ban_hang".equals(don.getLoaiChungTu())) {
            throw new CommonException("Chứng từ này không phải đơn bán hàng");
        }

        // Phiếu đang mở (nháp / chờ xuất) trước; không còn thì phiếu gần nhất (đã xuất / đã hủy) để xem lại
        List<PhieuXuatKho> phieuMo = phieuXuatKhoRepository.findByDonBanHangIdAndTrangThaiInOrderByIdDesc(donBanHangId, PHIEU_DANG_MO);
        PhieuXuatKho phieu = !phieuMo.isEmpty() ? phieuMo.get(0)
                : phieuXuatKhoRepository.findByDonBanHangId(donBanHangId).stream()
                        .max(Comparator.comparing(PhieuXuatKho::getId)).orElse(null);
        if (phieu == null) {
            throw new CommonException("Đơn " + don.getSoDonHang()
                    + " chưa có phiếu xuất kho để đóng gói (chưa hoàn tất nhặt hàng).", HttpStatus.CONFLICT, null);
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
            throw new CommonException("Mã vạch / SKU [" + ma + "] không thuộc đơn " + don.getSoDonHang() + "!");
        }

        String sku = khop.getBienTheSanPham().getMaSku();
        BigDecimal daQuet = soLuong(khop.getSoLuongDaDongGoi());
        BigDecimal can = soLuong(khop.getSoLuongXuat());
        if (daQuet.compareTo(can) >= 0) {
            throw new CommonException("Mặt hàng [" + sku + "] đã đóng gói đủ số lượng (" + hienThi(daQuet) + "/" + hienThi(can) + ")!");
        }
        BigDecimal moi = daQuet.add(soLuong);
        if (moi.compareTo(can) > 0) {
            throw new CommonException("Số lượng quét vượt quá yêu cầu (Đã quét: " + hienThi(daQuet) + ", Quét thêm: "
                    + hienThi(soLuong) + ", Cần đóng gói: " + hienThi(can) + ")");
        }
        khop.setSoLuongDaDongGoi(moi);
        chiTietPhieuXuatKhoRepository.save(khop);

        ghiNhatKy(phieu, IHanhDong.quet_dong_goi, daQuet.toPlainString(), moi.toPlainString(),
                "Quét mã " + ma + " (" + hienThi(moi) + "/" + hienThi(can) + ") đóng gói đơn " + don.getSoDonHang());

        String tenSp = khop.getBienTheSanPham().getSanPham() != null ? khop.getBienTheSanPham().getSanPham().getTenSanPham() : sku;
        return taoPhien(don, phieu, dong, khop.getId(),
                "Đã quét " + hienThi(soLuong) + "x " + tenSp + " [" + sku + "] (" + hienThi(moi) + "/" + hienThi(can) + ")");
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
            return taoPhien(don, phieu, null, null, "Phiếu xuất " + phieu.getSoPhieuXuat() + " đã đóng gói trước đó.");
        }
        kiemTraCoTheDongGoi(phieu, don);

        List<ChiTietPhieuXuatKho> dong = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());
        if (dong.isEmpty()) {
            throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat() + " không có sản phẩm để đóng gói");
        }
        for (ChiTietPhieuXuatKho ct : dong) {
            BigDecimal daQuet = soLuong(ct.getSoLuongDaDongGoi());
            BigDecimal can = soLuong(ct.getSoLuongXuat());
            if (daQuet.compareTo(can) < 0) {
                throw new CommonException("Chưa đóng gói đủ hàng! Mặt hàng [" + ct.getBienTheSanPham().getMaSku()
                        + "] mới quét " + hienThi(daQuet) + "/" + hienThi(can));
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
        }

        ghiNhatKy(phieu, IHanhDong.hoan_tat_dong_goi, "trang_thai = 0 (Nháp)", "trang_thai = 6 (Chờ xuất - đã đóng gói)",
                "Hoàn tất đóng gói đơn " + don.getSoDonHang() + " (" + dong.size() + " dòng sản phẩm)");
        return taoPhien(don, phieu, dong, null,
                "Đã đóng gói xong đơn " + don.getSoDonHang() + ". Phiếu xuất " + phieu.getSoPhieuXuat() + " chờ xác nhận xuất kho.");
    }

    // ===================== kiểm tra =====================

    /** Câu đọc phiếu đầu tiên của giao dịch phải là câu khóa (SELECT ... FOR UPDATE). */
    private PhieuXuatKho khoaPhieu(Integer phieuXuatKhoId) {
        return phieuXuatKhoRepository.findByIdForUpdate(phieuXuatKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu xuất kho", HttpStatus.NOT_FOUND, null));
    }

    private void kiemTraCoTheDongGoi(PhieuXuatKho phieu, DonBanHang don) {
        kiemTraKho(phieu.getKho());
        if (!"ban_hang".equals(phieu.getLoaiXuat()) || don == null) {
            throw new CommonException("Chỉ đóng gói được phiếu xuất bán hàng");
        }
        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())
                || Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(phieu.getTrangThai())) {
            String canhBao = "ĐƠN HÀNG " + don.getSoDonHang() + " ĐÃ BỊ HỦY! Hệ thống đã khóa đóng gói. "
                    + "Vui lòng chuyển toàn bộ hàng của đơn này về khu hoàn kệ.";
            throw new CommonException(canhBao, HttpStatus.CONFLICT, taoPhien(don, phieu, null, null, canhBao));
        }
        Integer tt = phieu.getTrangThai();
        if (Integer.valueOf(ITrangThaiPhieuXuat.DA_XUAT).equals(tt)) {
            throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat() + " đã xuất kho.", HttpStatus.CONFLICT, null);
        }
        if (Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(tt)) {
            throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat() + " đã đóng gói xong, đang chờ xác nhận xuất kho.",
                    HttpStatus.CONFLICT, null);
        }
        if (!Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(tt)) {
            throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat() + " không ở trạng thái chờ đóng gói.", HttpStatus.CONFLICT, null);
        }
    }

    /** Nhân viên chỉ thao tác trên phiếu của kho đang làm việc; quản trị viên được làm ở mọi kho. */
    private void kiemTraKho(Kho kho) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }
        boolean isAdmin = user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer khoLamViec = SecurityContextHolder.getKhoId();
        if (!isAdmin && (kho == null || khoLamViec == null || !khoLamViec.equals(kho.getId()))) {
            throw new CommonException("Phiếu xuất thuộc kho khác với kho đang làm việc", HttpStatus.FORBIDDEN, null);
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
                    .soLuongCan(can)
                    .soLuongDaQuet(daQuet)
                    .build());
        }

        double phanTram = tongCan.compareTo(BigDecimal.ZERO) > 0
                ? Math.min(100.0, tongDaQuet.multiply(BigDecimal.valueOf(100)).divide(tongCan, 2, RoundingMode.HALF_UP).doubleValue())
                : 0.0;
        boolean biHuy = Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())
                || Integer.valueOf(ITrangThaiPhieuXuat.DA_HUY).equals(phieu.getTrangThai());
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
                .coTheHoanTat(!biHuy && duHet && Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(phieu.getTrangThai()))
                .biHuy(biHuy)
                .thongBao(thongBao)
                .chiTietVuaQuetId(chiTietVuaQuetId)
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
        SauCommit.chay("Ghi nhật ký đóng gói phiếu " + phieu.getSoPhieuXuat(), () -> lichSuThayDoiService.create(LichSuThayDoi.builder()
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
