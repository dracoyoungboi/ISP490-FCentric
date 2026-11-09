package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Autowired;

import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.MaVachNhaCungCap;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.ChiTietPhieuNhapKhoRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.MaVachNhaCungCapService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.MaVachUtils;
import com.dev.backend.i18n.ThongDiep;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MaVachNhaCungCapServiceImpl implements MaVachNhaCungCapService {

    MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    PhieuNhapKhoRepository phieuNhapKhoRepository;
    ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    NguoiDungRepository nguoiDungRepository;
    com.dev.backend.repository.ViTriKhoRepository viTriKhoRepository;

    /** Nhật ký nghiệp vụ (liên kết / gỡ mã vạch NCC); null khi unit test dựng tay. */
    @NonFinal
    @Autowired(required = false)
    NhatKyNghiepVu nhatKy;

    @Override
    @Transactional(readOnly = true)
    public Page<MaVachNhaCungCapDto> timKiem(String q, Integer nhaCungCapId, Pageable pageable) {
        // Ký tự đại diện của LIKE (% _) trong từ khóa là chữ thường, không phải "khớp mọi thứ"; '!' là ký tự thoát
        String queryStr = (q != null && !q.isBlank())
                ? q.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_")
                : null;
        for (org.springframework.data.domain.Sort.Order o : pageable.getSort()) {
            if (!TRUONG_SAP_XEP.contains(o.getProperty())) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccKhongSapXepDuoc", o.getProperty()));
            }
        }
        return maVachNhaCungCapRepository.searchMappings(nhaCungCapId, queryStr, pageable).map(this::toDto);
    }

    /** Trường được sắp xếp ở trang Mã vạch nhà cung cấp (trường khác làm truy vấn lỗi). */
    private static final java.util.Set<String> TRUONG_SAP_XEP = java.util.Set.of("ngayTao", "barcodeNcc", "maSanPhamNcc", "id");

    @Override
    @Transactional(readOnly = true)
    public TraCuuMaVachResponse traCuu(String maVach, Integer nhaCungCapId) {
        if (maVach == null || maVach.isBlank()) {
            return TraCuuMaVachResponse.builder()
                    .timThay(false)
                    .loaiMa("LA")
                    .canMapNhanh(true)
                    .build();
        }

        String code = maVach.trim();

        // 1. Kiểm tra mã nội bộ FCentric (SKU hoặc mã vạch in trên tem FCentric)
        Optional<BienTheSanPham> optBt = timMaFcentric(code);
        if (optBt.isPresent()) {
            BienTheSanPham bt = optBt.get();
            return TraCuuMaVachResponse.builder()
                    .timThay(true)
                    .loaiMa("FCENTRIC")
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .mauSac(tenMau(bt))
                    .kichCo(tenKichCo(bt))
                    .barcode(code)
                    .canMapNhanh(false)
                    .build();
        }

        // 2. Kiểm tra mã NCC theo nhà cung cấp (hoặc tra cứu chung)
        Optional<MaVachNhaCungCap> optMap = (nhaCungCapId != null && nhaCungCapId > 0)
                ? maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id(code, nhaCungCapId)
                : maVachNhaCungCapRepository.findFirstByBarcodeNcc(code);

        if (optMap.isPresent()) {
            MaVachNhaCungCap map = optMap.get();
            BienTheSanPham bt = map.getBienTheSanPham();
            return TraCuuMaVachResponse.builder()
                    .timThay(true)
                    .loaiMa("NCC")
                    .bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                    .mauSac(tenMau(bt))
                    .kichCo(tenKichCo(bt))
                    .barcode(code)
                    .canMapNhanh(false)
                    .build();
        }

        // 3. Mã lạ chưa từng xuất hiện
        return TraCuuMaVachResponse.builder()
                .timThay(false)
                .loaiMa("LA")
                .barcode(code)
                .canMapNhanh(true)
                .build();
    }

    /**
     * Liên kết mã vạch in trên tem nhà cung cấp với một biến thể FCentric. Chỉ làm lúc kiểm đếm phiếu nhập
     * (đã chốt 19/10): phiếu phải đang Nháp, thuộc kho đang chọn, cùng nhà cung cấp, và biến thể phải có trong phiếu.
     * Mã đã liên kết biến thể khác thì báo 409, không ghi đè; muốn đổi thì gỡ ở trang Mã vạch nhà cung cấp.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaVachNhaCungCapDto lienKet(MaVachLienKetRequest request) {
        if (request.getMaVach() == null || request.getMaVach().isBlank()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccTrongMa"));
        }
        if (request.getNhaCungCapId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccTrongNcc"));
        }
        if (request.getBienTheSanPhamId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccTrongBienThe"));
        }
        if (request.getPhieuNhapKhoId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccChiKhiKiemDem"));
        }

        String maVach = request.getMaVach().trim();
        if (maVach.length() > 100) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccToiDa100"));
        }
        if (!MaVachUtils.kyTuHopLe(maVach)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of("sanPhamMuaHang.maVachNccKyTuKhongHopLe", maVach));
        }
        if (MaVachUtils.laMaTheLenh(maVach)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of("sanPhamMuaHang.maVachNccLaTheLenh", MaVachUtils.TIEN_TO_THE_LENH));
        }
        if (Boolean.FALSE.equals(MaVachUtils.soKiemTraGs1Dung(maVach))) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of("sanPhamMuaHang.maVachNccSaiSoKiemTra", maVach, MaVachUtils.dangGs1(maVach)));
        }
        Optional<BienTheSanPham> maFcentric = timMaFcentric(maVach);
        if (maFcentric.isPresent()) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of("sanPhamMuaHang.maVachNccLaMaFcentric", maVach, nhan(maFcentric.get())));
        }

        PhieuNhapKho phieu = phieuNhapKhoRepository.findById(request.getPhieuNhapKhoId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.phieuNhapKhongTimThay", request.getPhieuNhapKhoId())));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());
        if (phieu.getTrangThai() == null || phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccPhieuHetKiemDem", phieu.getSoPhieuNhap()));
        }
        if (phieu.getNhaCungCap() == null || !phieu.getNhaCungCap().getId().equals(request.getNhaCungCapId())) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccKhongKhopNcc", phieu.getSoPhieuNhap()));
        }
        if (chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(
                phieu.getId(), request.getBienTheSanPhamId()).isEmpty()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("sanPhamMuaHang.maVachNccBienTheKhongTrongPhieu", phieu.getSoPhieuNhap()));
        }
        // Mã kệ quét lúc danh sách kệ chưa tải xong trông như mã lạ: không để thành mã vạch sản phẩm
        if (phieu.getKho() != null && viTriKhoRepository.existsByKho_IdAndMaViTriIgnoreCase(phieu.getKho().getId(), maVach)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of("sanPhamMuaHang.maVachNccLaMaKe", maVach));
        }

        NhaCungCap ncc = phieu.getNhaCungCap();
        BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.maVachNccKhongTimThayBienThe", request.getBienTheSanPhamId())));

        Optional<MaVachNhaCungCap> daCo = maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id(maVach, ncc.getId());
        if (daCo.isPresent()) {
            MaVachNhaCungCap cu = daCo.get();
            if (!cu.getBienTheSanPham().getId().equals(bt.getId())) {
                throw new CommonException(HttpStatus.CONFLICT,
                        ThongDiep.of("sanPhamMuaHang.maVachNccDaLienKet", maVach, nhan(cu.getBienTheSanPham())));
            }
            // Cùng biến thể (hai người cùng xác nhận một mã): giữ liên kết cũ, chỉ bổ sung mã hàng NCC nếu còn trống
            if ((cu.getMaSanPhamNcc() == null || cu.getMaSanPhamNcc().isBlank()) && request.getMaHangNcc() != null
                    && !request.getMaHangNcc().isBlank()) {
                cu.setMaSanPhamNcc(gioiHan(request.getMaHangNcc().trim(), 100));
                maVachNhaCungCapRepository.save(cu);
            }
            return toDto(cu);
        }

        NguoiDung nguoiLienKet = SecurityContextHolder.getUser() != null && SecurityContextHolder.getUser().getId() != null
                ? nguoiDungRepository.findById(SecurityContextHolder.getUser().getId()).orElse(null)
                : null;
        MaVachNhaCungCap entity = MaVachNhaCungCap.builder()
                .nhaCungCap(ncc)
                .barcodeNcc(maVach)
                .bienTheSanPham(bt)
                .maSanPhamNcc(request.getMaHangNcc() != null && !request.getMaHangNcc().isBlank()
                        ? gioiHan(request.getMaHangNcc().trim(), 100) : null)
                .phieuNhapKho(phieu)
                .ghiChu(request.getGhiChu() != null && !request.getGhiChu().isBlank() ? gioiHan(request.getGhiChu().trim(), 255) : null)
                .nguoiLienKet(nguoiLienKet)
                .build();

        MaVachNhaCungCap saved;
        try {
            saved = maVachNhaCungCapRepository.saveAndFlush(entity);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // Máy khác vừa liên kết đúng mã này cùng lúc (khóa duy nhất mã + NCC chặn bản thứ hai)
            // Không đọc lại bản ghi của máy kia được trong giao dịch đã hỏng: hướng dẫn quét lại để thấy mã đã gắn với sản phẩm nào
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("sanPhamMuaHang.maVachNccLienKetDongThoi", maVach));
        }
        if (nhatKy != null) {
            // Ghi lên nhà cung cấp (loai nha_cung_cap, id NCC) để hiện trong lịch sử nhà cung cấp
            nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap,
                            saved.getNhaCungCap() != null ? saved.getNhaCungCap().getId() : null, IHanhDong.them_ma_vach_ncc)
                    .ma(saved.getNhaCungCap() != null ? saved.getNhaCungCap().getMaNhaCungCap() : maVach)
                    .ghiChu("Liên kết mã vạch " + maVach)
                    .kho(phieu.getKho() != null ? phieu.getKho().getId() : null)
                    .moi(anhLienKet(saved)));
        }
        log.info("[BARCODE-MAP] Đã liên kết mã vạch NCC `{}` với SKU `{}` (NCC ID: {}, phiếu {})", maVach, bt.getMaSku(), ncc.getId(), phieu.getSoPhieuNhap());
        return toDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void huyLienKet(Integer id) {
        MaVachNhaCungCap entity = maVachNhaCungCapRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.maVachNccKhongTimThayLienKet", id)));
        if (nhatKy != null) {
            PhieuNhapKho phieuGoc = entity.getPhieuNhapKho();
            nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap,
                            entity.getNhaCungCap() != null ? entity.getNhaCungCap().getId() : null, IHanhDong.xoa_ma_vach_ncc)
                    .ma(entity.getNhaCungCap() != null ? entity.getNhaCungCap().getMaNhaCungCap() : entity.getBarcodeNcc())
                    .ghiChu("Gỡ liên kết mã vạch " + entity.getBarcodeNcc())
                    .kho(phieuGoc != null && phieuGoc.getKho() != null ? phieuGoc.getKho().getId() : null)
                    .cu(anhLienKet(entity)));
        }
        maVachNhaCungCapRepository.delete(entity);
        log.info("[BARCODE-MAP] Đã gỡ liên kết mã vạch NCC ID `{}` (Barcode: {})", id, entity.getBarcodeNcc());
    }

    /** Ảnh chụp liên kết cho nhật ký: mã vạch, mã hàng NCC, SKU, biến thể, NCC, phiếu nhập lúc liên kết. */
    private static java.util.Map<String, Object> anhLienKet(MaVachNhaCungCap m) {
        BienTheSanPham bt = m.getBienTheSanPham();
        return NhatKyNghiepVu.anh(
                "maVach", m.getBarcodeNcc(),
                "maHangNcc", m.getMaSanPhamNcc(),
                "sku", bt != null ? bt.getMaSku() : null,
                "bienThe", bt != null ? nhan(bt) : null,
                "nhaCungCap", m.getNhaCungCap() != null ? m.getNhaCungCap().getTenNhaCungCap() : null,
                "phieuNhap", m.getPhieuNhapKho() != null ? m.getPhieuNhapKho().getSoPhieuNhap() : null);
    }

    private MaVachNhaCungCapDto toDto(MaVachNhaCungCap m) {
        return MaVachNhaCungCapDto.builder()
                .id(m.getId())
                .maVach(m.getBarcodeNcc())
                .maHangNcc(m.getMaSanPhamNcc())
                .nhaCungCapId(m.getNhaCungCap().getId())
                .tenNhaCungCap(m.getNhaCungCap().getTenNhaCungCap())
                .bienTheSanPhamId(m.getBienTheSanPham().getId())
                .tenBienThe(m.getBienTheSanPham().getSanPham() != null ? m.getBienTheSanPham().getSanPham().getTenSanPham() : m.getBienTheSanPham().getMaSku())
                .sku(m.getBienTheSanPham().getMaSku())
                .ngayLienKet(m.getNgayTao())
                .phieuNhapKhoId(m.getPhieuNhapKho() != null ? m.getPhieuNhapKho().getId() : null)
                .soPhieuNhap(m.getPhieuNhapKho() != null ? m.getPhieuNhapKho().getSoPhieuNhap() : null)
                .mauSac(tenMau(m.getBienTheSanPham()))
                .kichCo(tenKichCo(m.getBienTheSanPham()))
                .tenNguoiLienKet(m.getNguoiLienKet() != null ? m.getNguoiLienKet().getHoTen() : null)
                .build();
    }

    /** SKU hoặc mã vạch tem FCentric. */
    private Optional<BienTheSanPham> timMaFcentric(String code) {
        Optional<BienTheSanPham> theoSku = bienTheSanPhamRepository.findByMaSkuIgnoreCase(code);
        return theoSku.isPresent() ? theoSku : bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase(code);
    }

    private static String tenMau(BienTheSanPham bt) {
        return bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null;
    }

    private static String tenKichCo(BienTheSanPham bt) {
        return bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : null;
    }

    /** "Tên sản phẩm · màu · kích cỡ (SKU)" để phân biệt các biến thể cùng sản phẩm trong câu báo. */
    private static String nhan(BienTheSanPham bt) {
        StringBuilder sb = new StringBuilder(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku());
        if (tenMau(bt) != null) sb.append(" · ").append(tenMau(bt));
        if (tenKichCo(bt) != null) sb.append(" · ").append(tenKichCo(bt));
        return sb.append(" (").append(bt.getMaSku()).append(")").toString();
    }

    private static String gioiHan(String s, int toiDa) {
        return s.length() > toiDa ? s.substring(0, toiDa) : s;
    }
}

