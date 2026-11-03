package com.dev.backend.services.impl.ketoan;

import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.HoaDonDauVaoRequest;
import com.dev.backend.dto.response.ketoan.HoaDonDauVaoDto;
import com.dev.backend.entities.CauHinhKeToan;
import com.dev.backend.entities.ChungTuXuatKeToan;
import com.dev.backend.entities.HoaDonDauVao;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhKeToanRepository;
import com.dev.backend.repository.ChungTuXuatKeToanRepository;
import com.dev.backend.repository.HoaDonDauVaoRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.utils.KhoDangChon;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Hóa đơn nhà cung cấp của phiếu nhập mua hàng. Chỉ nhập cho phiếu đã hoàn tất (hàng đã vào kho, đơn giá đã chốt),
 * sửa được tới khi phiếu được xuất sang kế toán; sau đó bị khóa (mở khóa chứng từ trong lô thì sửa lại được).
 *
 * <p>Ký hiệu theo hóa đơn điện tử: ký hiệu mẫu số 1 ký tự số (vd. 1), ký hiệu hóa đơn 6 ký tự (vd. C26TAA), số hóa đơn
 * tối đa 8 chữ số. Kiểm lỏng (chữ, số, / và -) để còn nhập được hóa đơn giấy cũ dạng 01GTKT0/001, AA/20E.</p>
 */
@Service
public class HoaDonDauVaoService {

    private static final Pattern KY_HIEU = Pattern.compile("^[A-Za-z0-9/\\-]{1,20}$");
    private static final Pattern SO_HOA_DON = Pattern.compile("^\\d{1,20}$");
    private static final LocalDate NGAY_HOA_DON_SOM_NHAT = LocalDate.of(2020, 1, 1);

    private final HoaDonDauVaoRepository repository;
    private final PhieuNhapKhoRepository phieuNhapKhoRepository;
    private final ChungTuXuatKeToanRepository chungTuRepository;
    private final CauHinhKeToanRepository cauHinhKeToanRepository;
    private final CauHinhKeToanService cauHinhKeToanService;
    private final LichSuThayDoiService lichSuThayDoiService;

    public HoaDonDauVaoService(HoaDonDauVaoRepository repository,
                               PhieuNhapKhoRepository phieuNhapKhoRepository,
                               ChungTuXuatKeToanRepository chungTuRepository,
                               CauHinhKeToanRepository cauHinhKeToanRepository,
                               CauHinhKeToanService cauHinhKeToanService,
                               LichSuThayDoiService lichSuThayDoiService) {
        this.repository = repository;
        this.phieuNhapKhoRepository = phieuNhapKhoRepository;
        this.chungTuRepository = chungTuRepository;
        this.cauHinhKeToanRepository = cauHinhKeToanRepository;
        this.cauHinhKeToanService = cauHinhKeToanService;
        this.lichSuThayDoiService = lichSuThayDoiService;
    }

    @Transactional(readOnly = true)
    public HoaDonDauVaoDto lay(Integer phieuNhapKhoId) {
        PhieuNhapKho phieu = timPhieu(phieuNhapKhoId);
        KhoDangChon.kiemTraXem(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());
        return toDto(phieu.getId(), repository.findByPhieuNhapKho_Id(phieu.getId()).orElse(null));
    }

    @Transactional
    public HoaDonDauVaoDto luu(Integer phieuNhapKhoId, HoaDonDauVaoRequest req) {
        PhieuNhapKho phieu = phieuNhapKhoRepository.khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập"));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());
        if (phieu.getDonMuaHang() == null) {
            throw new CommonException("Chỉ phiếu nhập mua hàng (từ đơn mua) mới có hóa đơn nhà cung cấp");
        }
        if (!Integer.valueOf(TrangThaiPhieuNhap.COMPLETED.getValue()).equals(phieu.getTrangThai())) {
            throw new CommonException("Nhập hóa đơn sau khi phiếu nhập đã hoàn tất");
        }
        // Xếp hàng sau lô đang tạo (tạo lô khóa dòng cấu hình trước): không để hóa đơn đổi giữa lúc dựng tệp và lúc khóa
        cauHinhKeToanRepository.findByIdForUpdate(CauHinhKeToan.ID);
        Optional<String> loKhoa = chungTuRepository.soLoDangKhoa(ChungTuXuatKeToan.LOAI_MUA_HANG, phieu.getId());
        if (loKhoa.isPresent()) {
            throw new CommonException(HttpStatus.CONFLICT, "Phiếu nhập đã xuất sang kế toán ở lô "
                    + loKhoa.get() + " nên không sửa được hóa đơn. Quản trị viên mở khóa chứng từ trước.");
        }
        if (req == null || req.getCoHoaDon() == null) {
            throw new CommonException("Chọn nhà cung cấp có xuất hóa đơn GTGT hay không");
        }

        HoaDonDauVao hd = repository.findByPhieuNhapKho_Id(phieu.getId())
                .orElseGet(() -> HoaDonDauVao.builder().phieuNhapKho(phieu).build());
        String truoc = hd.getId() == null ? null : tomTat(hd);
        if (Boolean.TRUE.equals(req.getCoHoaDon())) {
            String mauSo = gon(req.getMauSo());
            String kyHieu = gon(req.getKyHieu());
            String so = gon(req.getSoHoaDon());
            if (mauSo != null && !KY_HIEU.matcher(mauSo).matches()) {
                throw new CommonException("Ký hiệu mẫu số chỉ gồm chữ, số, / và - (tối đa 20 ký tự)");
            }
            if (kyHieu == null || !KY_HIEU.matcher(kyHieu).matches()) {
                throw new CommonException("Nhập ký hiệu hóa đơn (chữ, số, / và -, tối đa 20 ký tự), vd. C26TAA");
            }
            if (so == null || !SO_HOA_DON.matcher(so).matches()) {
                throw new CommonException("Nhập số hóa đơn (chỉ chữ số)");
            }
            LocalDate ngay = req.getNgayHoaDon();
            if (ngay == null) {
                throw new CommonException("Chọn ngày hóa đơn");
            }
            if (ngay.isAfter(LocalDate.now(XuatKeToanService.MUI_GIO)) || ngay.isBefore(NGAY_HOA_DON_SOM_NHAT)) {
                throw new CommonException("Ngày hóa đơn không hợp lệ");
            }
            BigDecimal thue = req.getThueSuat();
            if (thue == null || ThueSuatService.THUE_SUAT_HOP_LE.stream().noneMatch(h -> h.compareTo(thue) == 0)) {
                throw new CommonException("Thuế suất trên hóa đơn chỉ nhận 0%, 5%, 8% hoặc 10%");
            }
            hd.setCoHoaDon(true);
            hd.setMauSo(mauSo);
            hd.setKyHieu(kyHieu.toUpperCase());
            hd.setSoHoaDon(so);
            hd.setNgayHoaDon(ngay);
            hd.setThueSuat(thue.setScale(2));
        } else {
            hd.setCoHoaDon(false);
            hd.setMauSo(null);
            hd.setKyHieu(null);
            hd.setSoHoaDon(null);
            hd.setNgayHoaDon(null);
            hd.setThueSuat(null);
        }
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        hd.setNguoiCapNhatId(nguoi.getId());
        hd.setNgayCapNhat(Instant.now());
        hd = repository.save(hd);

        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.hoa_don_dau_vao)
                .idThamChieu(phieu.getId())
                .kho(phieu.getKho())
                .hanhDong(IHanhDong.cap_nhat_hoa_don_dau_vao)
                .giaTriCu(truoc)
                .giaTriMoi(tomTat(hd))
                .nguoiThucHien(nguoi)
                .ngayThucHien(Instant.now())
                .build());
        return toDto(phieu.getId(), hd);
    }

    private HoaDonDauVaoDto toDto(Integer phieuId, HoaDonDauVao hd) {
        Optional<String> loKhoa = chungTuRepository.soLoDangKhoa(ChungTuXuatKeToan.LOAI_MUA_HANG, phieuId);
        HoaDonDauVaoDto.HoaDonDauVaoDtoBuilder b = HoaDonDauVaoDto.builder()
                .phieuNhapKhoId(phieuId)
                .daNhap(hd != null)
                .daKhoa(loKhoa.isPresent())
                .soLoXuat(loKhoa.orElse(null));
        if (hd != null) {
            b.coHoaDon(hd.getCoHoaDon())
                    .mauSo(hd.getMauSo())
                    .kyHieu(hd.getKyHieu())
                    .soHoaDon(hd.getSoHoaDon())
                    .ngayHoaDon(hd.getNgayHoaDon())
                    .thueSuat(hd.getThueSuat())
                    .ngayCapNhat(hd.getNgayCapNhat());
        }
        return b.build();
    }

    private PhieuNhapKho timPhieu(Integer id) {
        return phieuNhapKhoRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập"));
    }

    private static String gon(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String tomTat(HoaDonDauVao hd) {
        if (!Boolean.TRUE.equals(hd.getCoHoaDon())) {
            return "{\"coHoaDon\":false}";
        }
        return "{\"coHoaDon\":true,\"mauSo\":" + (hd.getMauSo() == null ? "null" : "\"" + hd.getMauSo() + "\"")
                + ",\"kyHieu\":\"" + hd.getKyHieu() + "\",\"so\":\"" + hd.getSoHoaDon() + "\",\"ngay\":\""
                + hd.getNgayHoaDon() + "\",\"thueSuat\":" + hd.getThueSuat().stripTrailingZeros().toPlainString() + "}";
    }
}
