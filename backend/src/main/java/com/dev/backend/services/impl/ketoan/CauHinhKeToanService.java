package com.dev.backend.services.impl.ketoan;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CauHinhKeToanRequest;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.ketoan.CauHinhKeToanDto;
import com.dev.backend.entities.CauHinhKeToan;
import com.dev.backend.entities.ChungTuXuatKeToan;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.CauHinhKeToanRepository;
import com.dev.backend.repository.ChungTuXuatKeToanRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Cấu hình xuất kế toán (bảng một dòng). Giá trị mặc định theo hệ thống tài khoản TT 99/2025 của AMIS Kế toán doanh
 * nghiệp, đã nhập thử 14/11/2026 (511, 521 có tài khoản con nên dùng 5111, 5211; 111, 112, 156 không có con). Ngày mốc
 * bị khóa khi đã có chứng từ đang khóa trong lô: đổi lúc đó thì tồn đầu kỳ đã giao và chứng từ còn lại lệch nhau.
 */
@Service
public class CauHinhKeToanService {

    public static final String HO_SO_AMIS_DOANH_NGHIEP = "AMIS_DOANH_NGHIEP";
    /**
     * Ba hình thức chuyển kho AMIS nhận (danh sách thả xuống trong tệp mẫu Chuyển kho); phần tử đầu là mặc định. Không
     * mặc định "Xuất kho kiêm vận chuyển nội bộ": AMIS coi phiếu đó là hóa đơn điện tử, bỏ trống số chứng từ khi nhập
     * (thử 14/11/2026), nên kế toán không đối chiếu được với số phiếu xuất chuyển kho.
     */
    public static final List<String> HINH_THUC_CHUYEN_KHO = List.of(
            "Xuất chuyển kho nội bộ", "Xuất kho kiêm vận chuyển nội bộ", "Xuất kho gửi bán đại lý");
    /** Chặn gõ nhầm năm; ngày mốc thực tế phải trùng "Ngày bắt đầu dữ liệu" trên AMIS (bản dùng thử: 01/01/2026). */
    static final LocalDate NGAY_MOC_SOM_NHAT = LocalDate.of(2020, 1, 1);

    /** Số tài khoản kế toán: chỉ chữ số, 3–20 ký tự (AMIS chỉ nhận tài khoản chi tiết nhất, vd. 33311). */
    private static final Pattern TAI_KHOAN = Pattern.compile("^\\d{3,20}$");
    /** Mã dịch vụ phí vận chuyển: như mã hàng của AMIS (tối đa 50 ký tự ở đây), không dấu cách. */
    private static final Pattern MA_DICH_VU = Pattern.compile("^[A-Za-z0-9._-]{1,50}$");
    private static final Pattern SO_TAI_KHOAN_NGAN_HANG = Pattern.compile("^[A-Za-z0-9]{4,30}$");

    private final CauHinhKeToanRepository repository;
    private final ChungTuXuatKeToanRepository chungTuRepository;
    private final BienTheSanPhamRepository bienTheSanPhamRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final LichSuThayDoiService lichSuThayDoiService;

    public CauHinhKeToanService(CauHinhKeToanRepository repository,
                                ChungTuXuatKeToanRepository chungTuRepository,
                                BienTheSanPhamRepository bienTheSanPhamRepository,
                                NguoiDungRepository nguoiDungRepository,
                                LichSuThayDoiService lichSuThayDoiService) {
        this.repository = repository;
        this.chungTuRepository = chungTuRepository;
        this.bienTheSanPhamRepository = bienTheSanPhamRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.lichSuThayDoiService = lichSuThayDoiService;
    }

    /** Cấu hình hiện tại; chưa có dòng (migration chưa chèn) thì trả giá trị mặc định chưa lưu. */
    @Transactional(readOnly = true)
    public CauHinhKeToan lay() {
        return repository.findById(CauHinhKeToan.ID).orElseGet(CauHinhKeToanService::macDinh);
    }

    @Transactional(readOnly = true)
    public CauHinhKeToanDto layDto() {
        return toDto(lay());
    }

    @Transactional
    public CauHinhKeToanDto capNhat(CauHinhKeToanRequest req) {
        if (req == null) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.thieuDuLieuCauHinh"));
        }
        CauHinhKeToan ch = repository.findByIdForUpdate(CauHinhKeToan.ID).orElseGet(CauHinhKeToanService::macDinh);
        // Dòng đã lưu có phiên bản: yêu cầu phải mang đúng phiên bản (thiếu cũng coi là cũ, không cho ghi đè)
        if (ch.getVersion() != null && !ch.getVersion().equals(req.getVersion())) {
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("keToanDuLieuVao.cauHinhVuaDuocLuu"));
        }
        String truoc = tomTat(ch);

        if (!Objects.equals(req.getNgayMoc(), ch.getNgayMoc())) {
            if (daCoChungTuDangKhoa()) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.khongDoiDuocNgayMoc"));
            }
            if (req.getNgayMoc() != null && req.getNgayMoc().isBefore(NGAY_MOC_SOM_NHAT)) {
                throw new CommonException(ThongDiep.of("keToanDuLieuVao.ngayMocQuaSom"));
            }
            if (req.getNgayMoc() != null && req.getNgayMoc().isAfter(LocalDate.now(XuatKeToanService.MUI_GIO).plusYears(1))) {
                throw new CommonException(ThongDiep.of("keToanDuLieuVao.ngayMocQuaXa"));
            }
            ch.setNgayMoc(req.getNgayMoc());
        }
        ch.setTkTienMat(taiKhoan(req.getTkTienMat(), ThongDiep.of("keToanDuLieuVao.tkTienMatSai")));
        ch.setTkNganHang(taiKhoan(req.getTkNganHang(), ThongDiep.of("keToanDuLieuVao.tkNganHangSai")));
        ch.setTkPhaiThu(taiKhoan(req.getTkPhaiThu(), ThongDiep.of("keToanDuLieuVao.tkPhaiThuSai")));
        ch.setTkDoanhThu(taiKhoan(req.getTkDoanhThu(), ThongDiep.of("keToanDuLieuVao.tkDoanhThuSai")));
        ch.setTkChietKhau(taiKhoan(req.getTkChietKhau(), ThongDiep.of("keToanDuLieuVao.tkChietKhauSai")));
        ch.setTkThueDauRa(taiKhoan(req.getTkThueDauRa(), ThongDiep.of("keToanDuLieuVao.tkThueDauRaSai")));
        ch.setTkKho(taiKhoan(req.getTkKho(), ThongDiep.of("keToanDuLieuVao.tkKhoSai")));
        ch.setTkGiaVon(taiKhoan(req.getTkGiaVon(), ThongDiep.of("keToanDuLieuVao.tkGiaVonSai")));
        ch.setTkPhaiTra(taiKhoan(req.getTkPhaiTra(), ThongDiep.of("keToanDuLieuVao.tkPhaiTraSai")));
        ch.setTkThueDauVao(taiKhoan(req.getTkThueDauVao(), ThongDiep.of("keToanDuLieuVao.tkThueDauVaoSai")));
        ch.setTkTraLai(taiKhoan(req.getTkTraLai(), ThongDiep.of("keToanDuLieuVao.tkTraLaiSai")));
        ch.setTkHangThieu(taiKhoan(req.getTkHangThieu(), ThongDiep.of("keToanDuLieuVao.tkHangThieuSai")));
        ch.setTkHangThua(taiKhoan(req.getTkHangThua(), ThongDiep.of("keToanDuLieuVao.tkHangThuaSai")));

        String maDv = gon(req.getMaDichVuVanChuyen());
        if (maDv == null || !MA_DICH_VU.matcher(maDv).matches()) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.maDichVuVanChuyenSai"));
        }
        if (bienTheSanPhamRepository.findByMaSkuIgnoreCase(maDv).isPresent()) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.maDichVuVanChuyenTrungSku"));
        }
        ch.setMaDichVuVanChuyen(maDv);
        String tenDv = gon(req.getTenDichVuVanChuyen());
        if (tenDv == null || tenDv.length() > 100) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.tenDichVuVanChuyenSai"));
        }
        ch.setTenDichVuVanChuyen(tenDv);

        String hinhThuc = gon(req.getHinhThucChuyenKho());
        if (!HINH_THUC_CHUYEN_KHO.contains(hinhThuc)) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.hinhThucChuyenKhoSai"));
        }
        ch.setHinhThucChuyenKho(hinhThuc);

        String soTk = gon(req.getSoTkNganHangNhan());
        if (soTk != null && !SO_TAI_KHOAN_NGAN_HANG.matcher(soTk).matches()) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.soTkNganHangSai"));
        }
        ch.setSoTkNganHangNhan(soTk);

        NguoiDung nguoi = nguoiDangThucHien();
        ch.setVersion(ch.getVersion() == null ? 1 : ch.getVersion() + 1);
        ch.setNguoiCapNhatId(nguoi.getId());
        ch.setNgayCapNhat(Instant.now());
        ch = repository.save(ch);

        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.cau_hinh_ke_toan)
                .idThamChieu(CauHinhKeToan.ID)
                .hanhDong(IHanhDong.cap_nhat_cau_hinh_ke_toan)
                .giaTriCu(truoc)
                .giaTriMoi(tomTat(ch))
                .nguoiThucHien(nguoi)
                .ngayThucHien(Instant.now())
                .build());
        return toDto(ch);
    }

    /** Có chứng từ nào đang khóa trong một lô xuất kế toán. */
    boolean daCoChungTuDangKhoa() {
        return chungTuRepository.existsByTrangThai(ChungTuXuatKeToan.TRANG_THAI_DA_XUAT);
    }

    CauHinhKeToanDto toDto(CauHinhKeToan ch) {
        return CauHinhKeToanDto.builder()
                .hoSo(ch.getHoSo())
                .ngayMoc(ch.getNgayMoc())
                .tkTienMat(ch.getTkTienMat())
                .tkNganHang(ch.getTkNganHang())
                .tkPhaiThu(ch.getTkPhaiThu())
                .tkDoanhThu(ch.getTkDoanhThu())
                .tkChietKhau(ch.getTkChietKhau())
                .tkThueDauRa(ch.getTkThueDauRa())
                .tkKho(ch.getTkKho())
                .tkGiaVon(ch.getTkGiaVon())
                .tkPhaiTra(ch.getTkPhaiTra())
                .tkThueDauVao(ch.getTkThueDauVao())
                .tkTraLai(ch.getTkTraLai())
                .tkHangThieu(ch.getTkHangThieu())
                .tkHangThua(ch.getTkHangThua())
                .maDichVuVanChuyen(ch.getMaDichVuVanChuyen())
                .tenDichVuVanChuyen(ch.getTenDichVuVanChuyen())
                .hinhThucChuyenKho(ch.getHinhThucChuyenKho())
                .soTkNganHangNhan(ch.getSoTkNganHangNhan())
                .daCoLoXuat(daCoChungTuDangKhoa())
                .version(ch.getVersion())
                .ngayCapNhat(ch.getNgayCapNhat())
                .build();
    }

    static CauHinhKeToan macDinh() {
        return CauHinhKeToan.builder()
                .id(CauHinhKeToan.ID)
                .hoSo(HO_SO_AMIS_DOANH_NGHIEP)
                .tkTienMat("111").tkNganHang("112").tkPhaiThu("131").tkDoanhThu("5111").tkChietKhau("5211")
                .tkThueDauRa("33311").tkKho("156").tkGiaVon("632").tkPhaiTra("331").tkThueDauVao("1331")
                .tkTraLai("5212").tkHangThieu("1381").tkHangThua("3381")
                .maDichVuVanChuyen("PVC").tenDichVuVanChuyen("Phí vận chuyển")
                .hinhThucChuyenKho(HINH_THUC_CHUYEN_KHO.get(0))
                .version(1)
                .build();
    }

    /** {@code loi}: câu "Tài khoản … chỉ gồm chữ số (3–20 số), vd. 33311" của đúng ô (mỗi ô một khóa để dịch trọn câu). */
    private static String taiKhoan(String giaTri, ThongDiep loi) {
        String gon = gon(giaTri);
        if (gon == null || !TAI_KHOAN.matcher(gon).matches()) {
            throw new CommonException(loi);
        }
        return gon;
    }

    private static String gon(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String tomTat(CauHinhKeToan ch) {
        return "{\"ngayMoc\":" + (ch.getNgayMoc() == null ? "null" : "\"" + ch.getNgayMoc() + "\"")
                + ",\"tk\":\"" + String.join("/", ch.getTkTienMat(), ch.getTkNganHang(), ch.getTkPhaiThu(),
                ch.getTkDoanhThu(), ch.getTkChietKhau(), ch.getTkThueDauRa(), ch.getTkKho(), ch.getTkGiaVon(),
                ch.getTkPhaiTra(), ch.getTkThueDauVao(), ch.getTkTraLai(), ch.getTkHangThieu(), ch.getTkHangThua()) + "\""
                + ",\"maDichVuVanChuyen\":\"" + ch.getMaDichVuVanChuyen() + "\""
                + ",\"hinhThucChuyenKho\":\"" + ch.getHinhThucChuyenKho() + "\""
                + ",\"soTkNganHangNhan\":" + (ch.getSoTkNganHangNhan() == null ? "null" : "\"" + ch.getSoTkNganHangNhan() + "\"")
                + "}";
    }

    NguoiDung nguoiDangThucHien() {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth == null || auth.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("keToanDuLieuVao.khongXacDinhNguoiThaoTac"));
        }
        return nguoiDungRepository.findById(auth.getId()).orElseThrow(
                () -> new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("keToanDuLieuVao.khongXacDinhNguoiThaoTac")));
    }
}
