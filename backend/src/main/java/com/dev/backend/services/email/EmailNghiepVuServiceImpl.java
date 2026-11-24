package com.dev.backend.services.email;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.TenVaiTro;
import com.dev.backend.dto.email.*;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.email.DonMuaHangEmailRepository;
import com.dev.backend.services.impl.entities.NhatKyTraHangNcc;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.BooleanSupplier;

/**
 * Cài đặt {@link EmailNghiepVuService}: dựng record dữ liệu NGAY khi được gọi (trong transaction của nơi gọi, lúc
 * các quan hệ LAZY còn đọc được), rồi giao {@link EmailDispatcher} gửi sau commit. Không có @Transactional ở đây:
 * lỗi dựng thư chỉ ghi log, không làm transaction nghiệp vụ bị đánh dấu rollback.
 *
 * <p>Hợp đồng với nơi gọi (soát chéo 3.5):
 * <ul>
 *   <li>mọi hàm trừ E5, E6 KHÔNG ném bất kỳ ngoại lệ nào ra nơi gọi, kể cả lỗi lúc dựng dữ liệu (chỉ log ERROR): lỗi email
 *       không được làm rollback việc chấp nhận báo giá hay gửi yêu cầu;</li>
 *   <li>không tiêm NguoiDungService / DonMuaHangService / YeuCauMuaHangService (hai service đầu tiêm lớp này: vòng phụ
 *       thuộc bean);</li>
 *   <li>E1 không truy vấn CSDL trên luồng request (thông tin cửa hàng đọc ở luồng gửi);</li>
 *   <li>E5 gửi đồng bộ, không mở transaction bao quanh lúc gửi SMTP, không ghi mã vào log.</li>
 * </ul>
 *
 * <p>Để không "chính thức hóa" dữ liệu sai qua email:
 * <ul>
 *   <li>mỗi email nhà cung cấp kiểm đúng trạng thái trước khi dựng (E4/M3: đơn chờ báo giá; M1: đã chấp nhận;
 *       M2: không chấp nhận; E7/M5: biên bản chưa hủy; M6: biên bản đã hủy), sai thì không gửi và ghi ERROR;</li>
 *   <li>trước mỗi lần gửi / thử lại kiểm lại CSDL: đơn đổi trạng thái, nhà cung cấp gửi báo giá mới hơn, mật khẩu
 *       tạm đã bị thay, mã đã bị thay thì bỏ thư cũ;</li>
 *   <li>thành tiền tự tính số lượng × đơn giá (không đọc cột thanh_tien tự sinh).</li>
 * </ul>
 */
@Slf4j
@Service
public class EmailNghiepVuServiceImpl implements EmailNghiepVuService {

    // Tiêu đề theo đặc tả mục 1 (bỏ đuôi "- FCentric" cũ)
    static final String TIEU_DE_E1 = "Mã đặt lại mật khẩu FCentric";
    static final String TIEU_DE_E2 = "Tài khoản FCentric của bạn đã được tạo";
    static final String TIEU_DE_E3 = "Đặt lại mật khẩu tài khoản FCentric";
    static final String TIEU_DE_M4 = "Mật khẩu FCentric của bạn vừa được thay đổi";
    static final String TIEU_DE_E5 = "Mã đăng nhập Cổng nhà cung cấp";

    static final int DON_CHO_BAO_GIA = 2;
    static final int DON_DA_CHAP_NHAN = 3;
    static final int DON_KHONG_CHAP_NHAN = 4;

    // Trạng thái, phương án của biên bản trả hàng (cột trang_thai, phuong_an_xu_ly) và nguồn câu trả lời: tên ngắn cho
    // hằng số của entity / nhật ký
    static final String BB_DA_HUY = BienBanTraHangNcc.DA_HUY;
    static final String BB_DA_TRA_HANG = BienBanTraHangNcc.DA_TRA_HANG;
    static final String BB_DA_TIEU_HUY = BienBanTraHangNcc.DA_TIEU_HUY;
    static final String PA_DOI_HANG = BienBanTraHangNcc.PA_DOI_HANG;
    static final String PA_TRU_CONG_NO = BienBanTraHangNcc.PA_TRU_CONG_NO;
    static final String HL_NHAN_LAI = BienBanTraHangNcc.HL_NHAN_LAI;
    static final String HL_TIEU_HUY = BienBanTraHangNcc.HL_TIEU_HUY;
    static final String NGUON_CONG_NCC = NhatKyTraHangNcc.NGUON_CONG_NCC;
    static final String NGUON_TU_DONG = NhatKyTraHangNcc.NGUON_TU_DONG;
    /** Loại thư E7: ghi đã ký lần đầu / gửi lại, ký lại sau khi lập lại (số lỗi đổi), nhắc hạn trả lời. */
    static final String LOAI_GUI = NhatKyTraHangNcc.EMAIL_GUI;
    static final String LOAI_CAP_NHAT = NhatKyTraHangNcc.EMAIL_CAP_NHAT;
    static final String LOAI_NHAC = NhatKyTraHangNcc.EMAIL_NHAC;
    static final Set<String> LOAI_E7 = Set.of(LOAI_GUI, LOAI_CAP_NHAT, LOAI_NHAC);

    private final EmailDispatcher dispatcher;
    private final DuongDanEmail duongDan;
    private final NguoiDungRepository nguoiDungRepository;
    private final DonMuaHangEmailRepository donMuaHangEmailRepository;
    private final PdfBienBanTraHang pdfBienBan;
    private final Clock clock;

    @Autowired
    public EmailNghiepVuServiceImpl(EmailDispatcher dispatcher, DuongDanEmail duongDan,
                                    NguoiDungRepository nguoiDungRepository,
                                    DonMuaHangEmailRepository donMuaHangEmailRepository,
                                    PdfBienBanTraHang pdfBienBan) {
        this(dispatcher, duongDan, nguoiDungRepository, donMuaHangEmailRepository, pdfBienBan, Clock.systemUTC());
    }

    EmailNghiepVuServiceImpl(EmailDispatcher dispatcher, DuongDanEmail duongDan,
                             NguoiDungRepository nguoiDungRepository,
                             DonMuaHangEmailRepository donMuaHangEmailRepository, PdfBienBanTraHang pdfBienBan,
                             Clock clock) {
        this.dispatcher = dispatcher;
        this.duongDan = duongDan;
        this.nguoiDungRepository = nguoiDungRepository;
        this.donMuaHangEmailRepository = donMuaHangEmailRepository;
        this.pdfBienBan = pdfBienBan;
        this.clock = clock;
    }

    // =====================================================================================================
    // Email nhân sự
    // =====================================================================================================

    /**
     * E1. Không truy vấn CSDL ở đây (Quên mật khẩu phải mất cùng thời gian dù tài khoản có hay không); thông tin cửa
     * hàng do dispatcher đọc ở luồng gửi. Không thử lại; trước khi gửi kiểm mã còn là mã mới nhất và còn hạn.
     */
    @Override
    public void guiMaDatLaiMatKhau(NguoiDung nguoiDung, String ma, Instant taoLuc, Instant hetHanLuc) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.E1);
            if (den == null) {
                return;
            }
            MaDatLaiMatKhauEmail duLieu = new MaDatLaiMatKhauEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(), ma,
                    DinhDangEmail.gioNgay(taoLuc), DinhDangEmail.gioNgay(hetHanLuc),
                    DinhDangEmail.phut(Duration.between(taoLuc, hetHanLuc)));
            String emailTaiKhoan = nguoiDung.getEmail();
            BooleanSupplier conHieuLuc = () -> clock.instant().isBefore(hetHanLuc)
                    && GlobalCache.OTP_SCHEDULE_OBJS.stream().anyMatch(o -> o.getType() == OtpType.RESET_PASSWORD
                    && Objects.equals(o.getEmail(), emailTaiKhoan)
                    && Objects.equals(o.getOtp(), ma)
                    && Objects.equals(o.getCreatedAt(), taoLuc));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E1).den(den).tieuDe(c -> TIEU_DE_E1).duLieu(duLieu)
                    .conHieuLuc(conHieuLuc)
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E1, null, e);
        }
    }

    /** E2. Thử lại chỉ khi liên kết trong thư còn dùng được (chưa đặt mật khẩu, chưa cấp lại, chưa quá hạn). */
    @Override
    public void guiTaiKhoanMoi(NguoiDung nguoiDung, String maDatMatKhau, Instant hetHanLuc) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.E2);
            if (den == null) {
                return;
            }
            String vaiTro = nguoiDung.getVaiTro();
            TaiKhoanMoiEmail duLieu = new TaiKhoanMoiEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(),
                    TenVaiTro.cua(vaiTro),
                    // cùng quy tắc "làm việc theo kho" của phân quyền: mọi vai trò nhân sự trừ Quản trị viên
                    IRoleType.laNoiBo(vaiTro) && !IRoleType.quan_tri_vien.equals(vaiTro),
                    vaiTro != null && IRoleType.GUI_YEU_CAU_BAO_GIA.contains(vaiTro),
                    duongDan.datMatKhau(maDatMatKhau), DinhDangEmail.gioNgay(hetHanLuc));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E2).den(den).tieuDe(c -> TIEU_DE_E2).duLieu(duLieu)
                    .conHieuLuc(lienKetConDung(nguoiDung, hetHanLuc))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E2, null, e);
        }
    }

    /** E3: liên kết đặt mật khẩu mới. Không nêu tên quản trị viên. Lần cấp lại mới hơn thì bỏ thư cũ. */
    @Override
    public void guiCapLaiMatKhau(NguoiDung nguoiDung, String maDatMatKhau, Instant luc, Instant hetHanLuc) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.E3);
            if (den == null) {
                return;
            }
            CapLaiMatKhauEmail duLieu = new CapLaiMatKhauEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(),
                    DinhDangEmail.gioNgay(luc), !Integer.valueOf(1).equals(nguoiDung.getTrangThai()),
                    duongDan.datMatKhau(maDatMatKhau), DinhDangEmail.gioNgay(hetHanLuc));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E3).den(den).tieuDe(c -> TIEU_DE_E3).duLieu(duLieu)
                    .conHieuLuc(lienKetConDung(nguoiDung, hetHanLuc))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E3, null, e);
        }
    }

    /** M4. Không chứa mật khẩu. */
    @Override
    public void guiDaDoiMatKhau(NguoiDung nguoiDung, CachDoiMatKhau cach, Instant luc) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.M4);
            if (den == null) {
                return;
            }
            DaDoiMatKhauEmail duLieu = new DaDoiMatKhauEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(),
                    DinhDangEmail.gioNgay(luc), nhan(cach));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M4).den(den).tieuDe(c -> TIEU_DE_M4).duLieu(duLieu)
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M4, null, e);
        }
    }

    static String nhan(CachDoiMatKhau cach) {
        if (cach == null) {
            throw new LoiThamSoException(ThongDiep.of("heThong.thieuCachDoiMatKhau"));
        }
        return switch (cach) {
            case DAT_LAI_BANG_MA -> "Đặt lại bằng mã gửi qua email";
            case DOI_KHI_DA_DANG_NHAP -> "Đổi khi đã đăng nhập";
            case DAT_QUA_LIEN_KET -> "Đặt bằng liên kết gửi qua email";
        };
    }

    /**
     * Liên kết trong thư còn dùng được lúc gửi: chưa quá hạn và mật khẩu (băm) trong CSDL vẫn là lúc dựng thư. Đặt mật
     * khẩu qua liên kết, Quên mật khẩu hay quản trị viên cấp lại đều đổi mật khẩu băm, nên thư cũ không gửi (lại) nữa.
     */
    private BooleanSupplier lienKetConDung(NguoiDung nguoiDung, Instant hetHanLuc) {
        Integer id = nguoiDung.getId();
        String bam = nguoiDung.getMatKhauHash();
        return () -> (hetHanLuc == null || clock.instant().isBefore(hetHanLuc))
                && (id == null || bam == null
                || nguoiDungRepository.findById(id).map(nd -> bam.equals(nd.getMatKhauHash())).orElse(false));
    }

    // =====================================================================================================
    // Email nhà cung cấp
    // =====================================================================================================

    /** E4. Gửi được thì ghi ngay_gui_yeu_cau (transaction riêng, giữ ngay_cap_nhat). */
    @Override
    public void guiYeuCauBaoGia(DonMuaHang don) {
        String maDon = maDon(don);
        try {
            kiem(don.getId() != null, "đơn chưa lưu");
            kiem(Integer.valueOf(DON_CHO_BAO_GIA).equals(don.getTrangThai()), "đơn không ở trạng thái chờ báo giá");
            kiem(don.getNgayBaoGia() == null, "nhà cung cấp đã báo giá");
            String den = emailNhaCungCap(don);
            List<ChiTietDonMuaHang> chiTiet = chiTiet(don);
            Kho kho = don.getKhoNhap();
            kiem(kho != null, "đơn không có kho nhận");
            List<DongSanPhamEmail> dong = taoDong(chiTiet, false);
            YeuCauBaoGiaEmail duLieu = new YeuCauBaoGiaEmail(tenNhaCungCap(don), maDon, kho.getTenKho(),
                    sach(kho.getDiaChi()), DinhDangEmail.ngay(don.getNgayGiaoDuKien()), dong.size(), dong,
                    tongSoLuong(chiTiet), duongDan.congNhaCungCap(don.getId(), den), duongDan.congNhaCungCapGoc(),
                    duongDan.nhanCongNhaCungCap());
            Integer id = don.getId();
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E4).den(den).maDon(maDon)
                    .tieuDe(c -> "Yêu cầu báo giá " + maDon + duoiCuaHang(c))
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .conHieuLuc(() -> trangThaiLa(id, DON_CHO_BAO_GIA)
                            && donMuaHangEmailRepository.ngayBaoGia(id).isEmpty())
                    .khiGuiDuoc(() -> donMuaHangEmailRepository.ghiNgayGuiYeuCau(id,
                            clock.instant().truncatedTo(ChronoUnit.SECONDS)))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E4, maDon, e);
        }
    }

    /**
     * E5. Mã đăng nhập Cổng nhà cung cấp, gửi ngay trong request; không gửi được (kể cả dữ liệu sai) thì ném
     * EmailKhongGuiDuocException. Không có người phụ trách (đăng nhập theo email, có thể nhiều nhà cung cấp): Trả lời
     * tới là email cửa hàng, chân thư không mời trả lời (trả lời sẽ trích nguyên mã).
     */
    @Override
    public void guiMaDangNhapCong(String emailNhan, String tenNhaCungCap, String ma, Instant hetHanLuc) {
        EmailGui g;
        try {
            String den = sach(emailNhan);
            kiem(den != null, "thiếu email nhận");
            kiem(ma != null && !ma.isBlank() && hetHanLuc != null, "thiếu mã hoặc hạn dùng");
            MaDangNhapCongEmail duLieu = new MaDangNhapCongEmail(sach(tenNhaCungCap), den, ma,
                    DinhDangEmail.gioNgay(hetHanLuc), DinhDangEmail.phut(Duration.between(clock.instant(), hetHanLuc)));
            g = EmailGui.builder()
                    .loai(LoaiEmail.E5).den(den)
                    .tieuDe(c -> TIEU_DE_E5)
                    .duLieu(duLieu)
                    .build();
        } catch (Exception e) {
            loiDung(LoaiEmail.E5, null, e);
            // i18n-giu-nguyen: lỗi nội bộ, nơi gọi bắt EmailKhongGuiDuocException và trả câu/mã lỗi riêng
            throw new EmailKhongGuiDuocException("Không dựng được email mã đăng nhập Cổng nhà cung cấp", e);
        }
        dispatcher.guiNgay(g);
    }

    /**
     * M3. Thư (kể cả lần thử lại) chỉ bị bỏ khi nhà cung cấp đã gửi báo giá mới hơn (đã có M3 của lần mới). Đơn đã có
     * kết quả trước lúc M3 kịp đi thì M3 vẫn gửi: báo giá này đã được nhận trước khi chốt, nhà cung cấp nhận M3 rồi
     * M1 / M2 "đã báo giá" (đặc tả 7.2).
     */
    @Override
    public void guiDaNhanBaoGia(DonMuaHang don) {
        String maDon = maDon(don);
        try {
            kiem(don.getId() != null, "đơn chưa lưu");
            kiem(Integer.valueOf(DON_CHO_BAO_GIA).equals(don.getTrangThai()), "đơn không ở trạng thái chờ báo giá");
            Instant ngayBaoGia = don.getNgayBaoGia();
            kiem(ngayBaoGia != null, "chưa có ngày báo giá");
            String den = emailNhaCungCap(don);
            List<ChiTietDonMuaHang> chiTiet = chiTiet(don);
            BigDecimal tong = tongTien(don, chiTiet);
            DaNhanBaoGiaEmail duLieu = new DaNhanBaoGiaEmail(tenNhaCungCap(don), maDon,
                    DinhDangEmail.gioNgay(ngayBaoGia), taoDong(chiTiet, true), tongSoLuong(chiTiet),
                    DinhDangEmail.tienDong(tong), sach(don.getGhiChuNhaCungCap()),
                    duongDan.congNhaCungCap(don.getId(), den));
            Integer id = don.getId();
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M3).den(den).maDon(maDon)
                    .tieuDe(c -> "Đã nhận báo giá đơn " + maDon)
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .conHieuLuc(() -> cungLanBaoGia(id, ngayBaoGia))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M3, maDon, e);
        }
    }

    /** M1. Văn bản chấp nhận đề nghị: chỉ gửi khi đơn đã ở trạng thái chấp nhận và có báo giá. */
    @Override
    public void guiXacNhanDatHang(DonMuaHang don) {
        String maDon = maDon(don);
        try {
            kiem(don.getId() != null, "đơn chưa lưu");
            kiem(Integer.valueOf(DON_DA_CHAP_NHAN).equals(don.getTrangThai()), "đơn chưa được chấp nhận");
            Instant ngayBaoGia = don.getNgayBaoGia();
            kiem(ngayBaoGia != null, "chưa có ngày báo giá");
            String den = emailNhaCungCap(don);
            List<ChiTietDonMuaHang> chiTiet = chiTiet(don);
            Kho kho = don.getKhoNhap();
            kiem(kho != null, "đơn không có kho nhận");
            BigDecimal tong = tongTien(don, chiTiet);
            XacNhanDatHangEmail duLieu = new XacNhanDatHangEmail(tenNhaCungCap(don), maDon,
                    DinhDangEmail.gioNgay(ngayBaoGia), kho.getTenKho(), sach(kho.getDiaChi()),
                    DinhDangEmail.ngay(don.getNgayGiaoDuKien()), DinhDangEmail.ngay(clock.instant()),
                    taoDong(chiTiet, true), tongSoLuong(chiTiet), DinhDangEmail.tienDong(tong), bangChu(tong, maDon),
                    sach(don.getGhiChuNhaCungCap()));
            Integer id = don.getId();
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M1).den(den).maDon(maDon)
                    .tieuDe(c -> "Xác nhận đặt hàng " + maDon + duoiCuaHang(c))
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .conHieuLuc(() -> trangThaiLa(id, DON_DA_CHAP_NHAN))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M1, maDon, e);
        }
    }

    /** M2. Bản theo ngayBaoGia; lý do chỉ hiện khi có. */
    @Override
    public void guiKetQuaBaoGia(DonMuaHang don) {
        String maDon = maDon(don);
        try {
            kiem(don.getId() != null, "đơn chưa lưu");
            kiem(Integer.valueOf(DON_KHONG_CHAP_NHAN).equals(don.getTrangThai()), "đơn không ở trạng thái không chấp nhận");
            String den = emailNhaCungCap(don);
            boolean daBaoGia = don.getNgayBaoGia() != null;
            Instant ngayThamChieu = daBaoGia ? don.getNgayBaoGia()
                    : (don.getNgayGuiYeuCau() != null ? don.getNgayGuiYeuCau() : don.getNgayDatHang());
            KetQuaBaoGiaEmail duLieu = new KetQuaBaoGiaEmail(tenNhaCungCap(don), maDon, daBaoGia,
                    DinhDangEmail.ngay(ngayThamChieu), sach(don.getLyDoTuChoi()));
            Integer id = don.getId();
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M2).den(den).maDon(maDon)
                    .tieuDe(c -> daBaoGia ? "Kết quả báo giá đơn " + maDon
                            : "Yêu cầu báo giá đơn " + maDon + " đã kết thúc")
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .conHieuLuc(() -> trangThaiLa(id, DON_KHONG_CHAP_NHAN))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M2, maDon, e);
        }
    }

    // =====================================================================================================
    // Biên bản trả hàng nhà cung cấp (E7, M5, M6)
    // =====================================================================================================

    /**
     * E7. Đơn giá lấy từ dòng đơn mua cùng biến thể; một dòng biên bản không tìm được đơn giá thì cả thư bỏ phần tiền
     * (chỉ số lượng), không đoán giá. Người phụ trách = người tạo đơn mua. Kèm PDF biên bản ({@code ban}).
     */
    @Override
    public void guiBienBanTraHang(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, String loai, Instant hanTraLoi,
                                  String moTaHangLoi, BooleanSupplier conHieuLuc, Runnable khiGuiDuoc) {
        String ma = maBienBan(bienBan);
        try {
            kiem(bienBan.getId() != null, "biên bản chưa lưu");
            kiem(!BB_DA_HUY.equals(bienBan.getTrangThai()), "biên bản đã hủy");
            kiem(loai != null && LOAI_E7.contains(loai), "loại thư biên bản không hợp lệ");
            String den = emailNhaCungCap(bienBan);
            PhieuNhapKho phieu = bienBan.getPhieuNhapKho();
            kiem(phieu != null, "biên bản không có phiếu nhập");
            DonMuaHang don = phieu.getDonMuaHang();
            kiem(don != null, "phiếu nhập không thuộc đơn mua");
            List<ChiTietTraHangNcc> chiTiet = chiTietBienBan(bienBan);
            List<ChiTietDonMuaHang> dongDon = don.getChiTietDonMuaHangs() == null ? List.of()
                    : don.getChiTietDonMuaHangs();

            List<BigDecimal> donGia = new ArrayList<>();
            for (ChiTietTraHangNcc ct : chiTiet) {
                donGia.add(donGiaCua(ct.getBienTheSanPham(), dongDon));
            }
            boolean coGia = donGia.stream().allMatch(Objects::nonNull);

            List<DongTraHangEmail> dong = new ArrayList<>();
            BigDecimal tong = BigDecimal.ZERO;
            long soSanPham = 0;
            Set<String> donVi = new HashSet<>();
            for (int i = 0; i < chiTiet.size(); i++) {
                ChiTietTraHangNcc ct = chiTiet.get(i);
                BienTheSanPham bt = ct.getBienTheSanPham();
                SanPhamQuanAo sp = bt.getSanPham();
                BigDecimal soLuong = BigDecimal.valueOf(ct.getSoLuongLoi());
                soSanPham += ct.getSoLuongLoi();
                donVi.add(DinhDangEmail.donViTinh(sp.getDonViTinh()));
                String gia = null;
                String giaTri = null;
                if (coGia) {
                    BigDecimal thanh = soLuong.multiply(donGia.get(i)).setScale(2, RoundingMode.HALF_UP);
                    tong = tong.add(thanh);
                    gia = DinhDangEmail.tien(donGia.get(i));
                    giaTri = DinhDangEmail.tien(thanh);
                }
                dong.add(new DongTraHangEmail(i + 1, sach(sp.getTenSanPham()), thuocTinh(bt), sach(bt.getMaSku()),
                        sach(ct.getLyDoLoi()), DinhDangEmail.soLuong(soLuong, sp.getDonViTinh()), gia, giaTri));
            }
            String tongSoLuong = donVi.size() == 1
                    ? DinhDangEmail.soLuong(BigDecimal.valueOf(soSanPham), donVi.iterator().next()) : null;

            String trangThai = bienBan.getTrangThai();
            boolean daTra = BB_DA_TRA_HANG.equals(trangThai);
            boolean daTieuHuy = BB_DA_TIEU_HUY.equals(trangThai);
            String noiHangLoi;
            String moTaNoi;
            if (daTra) {
                noiHangLoi = "Đã giao trả";
                moTaNoi = sach(moTaHangLoi);
            } else if (daTieuHuy) {
                noiHangLoi = "Đã tiêu hủy";
                moTaNoi = sach(moTaHangLoi);
            } else {
                Kho kho = phieu.getKho();
                kiem(kho != null && sach(kho.getTenKho()) != null, "phiếu nhập không có kho");
                noiHangLoi = kho.getTenKho().trim();
                moTaNoi = sach(kho.getDiaChi());
            }

            boolean capNhat = LOAI_CAP_NHAT.equals(loai);
            boolean nhac = LOAI_NHAC.equals(loai);
            BienBanTraHangEmail duLieu = new BienBanTraHangEmail(tenNhaCungCap(bienBan), ma, sach(don.getSoDonMua()),
                    sach(phieu.getSoPhieuNhap()), capNhat, nhac, DinhDangEmail.ngay(hanTraLoi),
                    Boolean.TRUE.equals(ban.getChoNccChonCachBu()), Boolean.TRUE.equals(ban.getChoNccChonHangLoi()),
                    soSanPham, tongSoLuong, coGia,
                    coGia ? DinhDangEmail.tien(tong) : null, coGia ? DinhDangEmail.tienDong(tong) : null,
                    noiHangLoi, moTaNoi, !daTra && !daTieuHuy, daTra, dong, PdfBienBanTraHang.cauKy(ban, true),
                    duongDan.congNhaCungCapBienBan(bienBan.getId(), den));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E7).den(den).maDon(ma)
                    .tieuDe(c -> (nhac ? "Nhắc trả lời biên bản trả hàng " + ma
                            : "Biên bản trả hàng " + ma + (capNhat ? " đã cập nhật" : "")) + duoiCuaHang(c))
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .conHieuLuc(conHieuLuc)
                    .khiGuiDuoc(khiGuiDuoc)
                    .dinhKem(c -> List.of(pdfBienBan.tao(ban, c)))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E7, ma, e);
        }
    }

    /**
     * M5. Lúc ghi nhận = lúc gọi. Không kèm PDF: biên bản không đổi theo câu trả lời, chính thư này ghi lại lựa chọn,
     * người xác nhận và thời điểm.
     */
    @Override
    public void guiDaGhiNhanTraLoi(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, boolean tuDong) {
        guiM5(bienBan, ban, tuDong, Set.of());
    }

    @Override
    public void guiCanChonLaiCachBu(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, List<Integer> dongIds) {
        if (dongIds == null || dongIds.isEmpty()) return;
        guiM5(bienBan, ban, false, Set.copyOf(dongIds));
    }

    /**
     * M5 dựng từ lựa chọn từng dòng của biên bản ({@code ban.items}). {@code chonLai}: các dòng nhà cung cấp phải chọn lại
     * cách bù (rỗng: thư ghi nhận / quá hạn).
     */
    private void guiM5(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, boolean tuDong, Set<Integer> chonLai) {
        String ma = maBienBan(bienBan);
        try {
            kiem(bienBan.getId() != null, "biên bản chưa lưu");
            kiem(!BB_DA_HUY.equals(bienBan.getTrangThai()), "biên bản đã hủy");
            String den = emailNhaCungCap(bienBan);
            PhieuNhapKho phieu = bienBan.getPhieuNhapKho();
            kiem(phieu != null, "biên bản không có phiếu nhập");
            DonMuaHang don = phieu.getDonMuaHang();
            List<BienBanTraHangDto.ChiTietItemDto> items = ban.getItems() == null ? List.of() : ban.getItems();
            boolean coChonLai = !chonLai.isEmpty();

            // Tóm tắt cách bù / hàng lỗi của cả biên bản từ các dòng
            long tong = ban.getTongSoLuongLoi() == null ? 0 : ban.getTongSoLuongLoi();
            long soTru = 0;
            long soBu = 0;
            long soNhanLai = 0;
            long soTieuHuy = 0;
            long soTuDong = 0;
            long soBuTuDong = 0;
            BigDecimal tienTruDong = BigDecimal.ZERO;
            for (BienBanTraHangDto.ChiTietItemDto it : items) {
                int sl = it.getSoLuong() == null ? 0 : it.getSoLuong();
                boolean tuDongDong = NGUON_TU_DONG.equals(it.getNguonCachBu());
                if (PA_TRU_CONG_NO.equals(it.getCachBu())) {
                    // Dòng trừ một phần (đơn chỉ còn chờ một phần): phần còn lại coi như đã giao bù
                    int tru = it.getSoLuongTru() == null ? sl : Math.min(it.getSoLuongTru(), sl);
                    soTru += tru;
                    BigDecimal tienDong = it.getTienTru() != null ? it.getTienTru() : it.getGiaTri();
                    if (tienDong != null) tienTruDong = tienTruDong.add(tienDong);
                    if (tuDongDong) {
                        soTuDong += tru;
                        soBuTuDong += sl - tru;
                    }
                } else if (PA_DOI_HANG.equals(it.getCachBu())) {
                    soBu += sl;
                    if (tuDongDong) soBuTuDong += sl;
                }
                if (HL_NHAN_LAI.equals(it.getHangLoiNcc())) soNhanLai += sl;
                else if (HL_TIEU_HUY.equals(it.getHangLoiNcc())) soTieuHuy += sl;
            }
            if (items.isEmpty()) {
                // Biên bản không có dòng (dữ liệu cũ): theo cột của biên bản
                if (PA_TRU_CONG_NO.equals(ban.getPhuongAn())) soTru = tong;
                else if (PA_DOI_HANG.equals(ban.getPhuongAn())) soBu = tong;
                if (HL_NHAN_LAI.equals(ban.getHangLoiNcc())) soNhanLai = tong;
                else if (HL_TIEU_HUY.equals(ban.getHangLoiNcc())) soTieuHuy = tong;
                if (tuDong) soTuDong = soTru;
            }
            BigDecimal tien = duong(ban.getTienTruTien()) != null && soBu == 0 ? ban.getTienTruTien()
                    : duong(tienTruDong) != null ? tienTruDong : soBu == 0 ? duong(ban.getGiaTriLoi()) : null;
            String cachBu;
            String moTaCachBu;
            if (soTru > 0 && soBu > 0) {
                cachBu = "Theo từng sản phẩm";
                moTaCachBu = (tien != null ? "Trừ " + DinhDangEmail.tienDong(tien) + " cho " + soTru + " sản phẩm"
                        : "Trừ tiền " + soTru + " sản phẩm") + ", giao bù " + soBu + " sản phẩm";
            } else if (soTru > 0) {
                cachBu = "Trừ tiền hàng";
                moTaCachBu = tien != null ? "Trừ " + DinhDangEmail.tienDong(tien) + " khi thanh toán"
                        : "Đơn giảm " + soTru + " sản phẩm khi thanh toán";
            } else if (soBu > 0) {
                cachBu = "Giao bù hàng";
                moTaCachBu = "Giao lại " + soBu + " sản phẩm đạt";
            } else {
                cachBu = null;
                moTaCachBu = null;
            }
            String tenHangLoi;
            String moTaHangLoi;
            if (soNhanLai > 0 && soTieuHuy > 0) {
                tenHangLoi = "Theo từng sản phẩm";
                moTaHangLoi = "Nhận lại " + soNhanLai + " sản phẩm, đồng ý tiêu hủy " + soTieuHuy + " sản phẩm";
            } else if (soNhanLai > 0) {
                tenHangLoi = "Nhận lại hàng lỗi";
                moTaHangLoi = "Quý công ty đến lấy hoặc nhờ chúng tôi gửi vận chuyển";
            } else if (soTieuHuy > 0) {
                tenHangLoi = "Đồng ý tiêu hủy";
                moTaHangLoi = "Chúng tôi tiêu hủy, Quý công ty không cần lấy về";
            } else {
                tenHangLoi = null;
                moTaHangLoi = null;
            }

            List<DaGhiNhanCachXuLyEmail.DongLuaChon> dong = new ArrayList<>();
            long soChonLai = 0;
            for (BienBanTraHangDto.ChiTietItemDto it : items) {
                boolean lai = chonLai.contains(it.getId());
                if (lai) soChonLai += it.getSoLuong() == null ? 0 : it.getSoLuong();
                dong.add(new DaGhiNhanCachXuLyEmail.DongLuaChon(sach(it.getTenBienThe()), phanLoai(it), sach(it.getLyDo()),
                        it.getSoLuong() == null ? 0 : it.getSoLuong(), lai ? "Cần chọn lại" : tenCachBuDong(it),
                        tenHangLoiDong(it), lai));
            }
            // Thư chọn lại chỉ nói việc phải chọn lại, không kèm câu còn đổi được / còn phải chọn của thư ghi nhận
            List<String> ghiChu = coChonLai ? new ArrayList<>() : new ArrayList<>(ghiChuDoi(ban));
            if (tuDong && soBuTuDong > 0) {
                ghiChu.add(0, (soTuDong > 0 ? soBuTuDong + " sản phẩm lỗi còn lại" : soBuTuDong + " sản phẩm lỗi")
                        + " coi như đã giao bù vì đơn " + (don == null ? "" : sach(don.getSoDonMua()) + " ")
                        + "đã nhận đủ số này ở đợt giao khác, không trừ tiền.");
            }
            long soTuDongCuoi = soTuDong;

            DaGhiNhanCachXuLyEmail duLieu = new DaGhiNhanCachXuLyEmail(tenNhaCungCap(bienBan), ma,
                    don == null ? null : sach(don.getSoDonMua()), tuDong,
                    DinhDangEmail.ngay(ban.getHanTraLoi()), cachBu, moTaCachBu, tenHangLoi, moTaHangLoi,
                    coChonLai ? soChonLai : tuDong ? soTuDong : tong, tuDong || coChonLai ? null : nguoiTraLoi(ban),
                    DinhDangEmail.gioNgay(clock.instant()), ghiChu, duongDan.congNhaCungCapBienBan(bienBan.getId(), den),
                    dong, coChonLai);
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M5).den(den).maDon(ma)
                    .tieuDe(c -> coChonLai ? "Biên bản trả hàng " + ma + ": cần chọn lại cách bù"
                            : tuDong && soTuDongCuoi > 0 ? "Biên bản trả hàng " + ma + " quá hạn trả lời: đã chuyển trừ tiền"
                            : tuDong ? "Biên bản trả hàng " + ma + " quá hạn trả lời"
                            : "Đã ghi nhận trả lời biên bản " + ma)
                    .duLieu(duLieu).nguoiPhuTrach(don == null ? null : nguoiPhuTrach(don))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M5, ma, e);
        }
    }

    /** "Trắng · L" của một dòng; không có thì null. */
    private static String phanLoai(BienBanTraHangDto.ChiTietItemDto it) {
        String s = java.util.stream.Stream.of(sach(it.getMauSac()), sach(it.getKichCo()))
                .filter(x -> x != null && !x.isBlank()).collect(java.util.stream.Collectors.joining(" · "));
        return s.isEmpty() ? null : s;
    }

    /** Cách bù của một dòng trong bảng thư: "Trừ tiền · 300.000 ₫", "Giao bù", "Chưa chọn". */
    private static String tenCachBuDong(BienBanTraHangDto.ChiTietItemDto it) {
        if (PA_TRU_CONG_NO.equals(it.getCachBu())) {
            BigDecimal tien = it.getTienTru() != null ? it.getTienTru() : it.getGiaTri();
            int sl = it.getSoLuong() == null ? 0 : it.getSoLuong();
            Integer tru = it.getSoLuongTru();
            String phan = tru != null && tru < sl ? " (" + tru + "/" + sl + " sản phẩm)" : "";
            return duong(tien) != null ? "Trừ tiền · " + DinhDangEmail.tienDong(tien) + phan : "Trừ tiền" + phan;
        }
        return PA_DOI_HANG.equals(it.getCachBu()) ? "Giao bù" : "Chưa chọn";
    }

    /** Hàng lỗi của một dòng trong bảng thư: đã rời kho thì đã giao trả / đã tiêu hủy, không thì lựa chọn. */
    private static String tenHangLoiDong(BienBanTraHangDto.ChiTietItemDto it) {
        if ("DA_TRA".equals(it.getTrangThaiHang())) return "Đã giao trả";
        if ("DA_TIEU_HUY".equals(it.getTrangThaiHang())) return "Đã tiêu hủy";
        if (HL_NHAN_LAI.equals(it.getHangLoiNcc())) return "Nhận lại";
        if (HL_TIEU_HUY.equals(it.getHangLoiNcc())) return "Đồng ý tiêu hủy";
        return "Chưa chọn";
    }

    /** Người bên nhà cung cấp vừa trả lời (lần ghi gần nhất trong cách bù / hàng lỗi). */
    private static String nguoiTraLoi(BienBanTraHangDto ban) {
        Instant cachBu = NGUON_CONG_NCC.equals(ban.getNguonChot()) ? ban.getThoiDiemChot() : null;
        Instant hangLoi = ban.getHangLoiNcc() == null ? null : ban.getThoiDiemChonHangLoi();
        if (hangLoi != null && (cachBu == null || hangLoi.isAfter(cachBu))) return sach(ban.getNguoiChonHangLoi());
        return cachBu != null ? sach(ban.getNguoiXacNhanNcc()) : null;
    }

    /** Những gì nhà cung cấp còn đổi / còn phải chọn sau lần ghi nhận này. */
    private static List<String> ghiChuDoi(BienBanTraHangDto ban) {
        List<String> cau = new ArrayList<>();
        boolean daNhap = Boolean.TRUE.equals(ban.getPhieuDaNhap());
        List<String> cachBuMo = ban.getCachBuMo() == null ? List.of() : ban.getCachBuMo();
        if (!cachBuMo.isEmpty() && !daNhap) {
            cau.add(ban.getSoPhieuNhap() == null
                    ? "Quý công ty còn đổi cách bù trên Cổng nhà cung cấp cho tới khi chúng tôi nhập kho lô hàng này."
                    : "Quý công ty còn đổi cách bù trên Cổng nhà cung cấp cho tới khi chúng tôi nhập kho phiếu "
                    + ban.getSoPhieuNhap() + ".");
        } else if (cachBuMo.contains(PA_TRU_CONG_NO)) {
            cau.add("Nếu không giao bù được, Quý công ty đổi sang trừ tiền trên Cổng nhà cung cấp khi chưa có hàng bù nào về.");
        } else if (PA_TRU_CONG_NO.equals(ban.getPhuongAn()) && daNhap) {
            cau.add("Trừ tiền hàng là lựa chọn cuối, không đổi lại được.");
        }
        List<String> hangLoiMo = ban.getHangLoiMo() == null ? List.of() : ban.getHangLoiMo();
        if (Boolean.TRUE.equals(ban.getChoNccChonHangLoi())) {
            cau.add("Hàng lỗi vẫn ở kho của chúng tôi. Vui lòng chọn nhận lại hoặc đồng ý tiêu hủy trên Cổng nhà cung cấp;"
                    + " chúng tôi chỉ tiêu hủy khi Quý công ty đồng ý.");
        } else if (!hangLoiMo.isEmpty()) {
            cau.add("Lựa chọn cho hàng lỗi đổi được trên Cổng nhà cung cấp cho tới khi chúng tôi giao trả hoặc tiêu hủy.");
        }
        return cau;
    }

    private static BigDecimal duong(BigDecimal so) {
        return so != null && so.signum() > 0 ? so : null;
    }

    /** M6. Chỉ gửi khi biên bản đã ở trạng thái hủy. */
    @Override
    public void guiBienBanDaHuy(BienBanTraHangNcc bienBan) {
        String ma = maBienBan(bienBan);
        try {
            kiem(bienBan.getId() != null, "biên bản chưa lưu");
            kiem(BB_DA_HUY.equals(bienBan.getTrangThai()), "biên bản chưa hủy");
            String den = emailNhaCungCap(bienBan);
            PhieuNhapKho phieu = bienBan.getPhieuNhapKho();
            kiem(phieu != null, "biên bản không có phiếu nhập");
            DonMuaHang don = phieu.getDonMuaHang();
            BienBanDaHuyEmail duLieu = new BienBanDaHuyEmail(tenNhaCungCap(bienBan), ma,
                    don == null ? null : sach(don.getSoDonMua()), sach(phieu.getSoPhieuNhap()),
                    DinhDangEmail.ngay(bienBan.getNgayTao()));
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.M6).den(den).maDon(ma)
                    .tieuDe(c -> "Biên bản trả hàng " + ma + " đã hủy")
                    .duLieu(duLieu).nguoiPhuTrach(don == null ? null : nguoiPhuTrach(don))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.M6, ma, e);
        }
    }

    /** Dòng biên bản có số lỗi dương, xếp theo id dòng tăng dần; không có dòng nào thì không gửi. */
    private static List<ChiTietTraHangNcc> chiTietBienBan(BienBanTraHangNcc bienBan) {
        List<ChiTietTraHangNcc> kq = new ArrayList<>();
        if (bienBan.getChiTiets() != null) {
            for (ChiTietTraHangNcc ct : bienBan.getChiTiets()) {
                if (ct.getSoLuongLoi() != null && ct.getSoLuongLoi() > 0) {
                    kiem(ct.getBienTheSanPham() != null && ct.getBienTheSanPham().getSanPham() != null,
                            "dòng biên bản không có sản phẩm");
                    kq.add(ct);
                }
            }
        }
        kiem(!kq.isEmpty(), "biên bản không có sản phẩm lỗi");
        kq.sort(Comparator.comparing(ChiTietTraHangNcc::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        return kq;
    }

    /** Đơn giá dòng đơn mua cùng biến thể (dòng có giá đầu tiên theo id dòng); không có thì null. */
    static BigDecimal donGiaCua(BienTheSanPham bt, List<ChiTietDonMuaHang> dongDon) {
        for (ChiTietDonMuaHang ct : sapXep(dongDon)) {
            BienTheSanPham b = ct.getBienTheSanPham();
            boolean cungBienThe = b == bt || (b != null && b.getId() != null && b.getId().equals(bt.getId()));
            if (cungBienThe && ct.getDonGia() != null) {
                return ct.getDonGia();
            }
        }
        return null;
    }

    private static String emailNhaCungCap(BienBanTraHangNcc bienBan) {
        NhaCungCap ncc = bienBan.getNhaCungCap();
        kiem(ncc != null, "biên bản không có nhà cung cấp");
        String email = sach(ncc.getEmail());
        kiem(email != null, "nhà cung cấp chưa có email");
        return email;
    }

    private static String tenNhaCungCap(BienBanTraHangNcc bienBan) {
        NhaCungCap ncc = bienBan.getNhaCungCap();
        kiem(ncc != null && sach(ncc.getTenNhaCungCap()) != null, "biên bản không có tên nhà cung cấp");
        return ncc.getTenNhaCungCap().trim();
    }

    private static String maBienBan(BienBanTraHangNcc bienBan) {
        return bienBan == null ? null : bienBan.getMaBienBan();
    }

    // =====================================================================================================
    // Dựng dữ liệu
    // =====================================================================================================

    /** Dòng sản phẩm xếp theo id dòng tăng dần (như @OrderBy và cổng nhà cung cấp). */
    static List<DongSanPhamEmail> taoDong(List<ChiTietDonMuaHang> chiTiet, boolean coGia) {
        List<DongSanPhamEmail> dong = new ArrayList<>();
        int stt = 1;
        for (ChiTietDonMuaHang ct : sapXep(chiTiet)) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            kiem(bt != null && bt.getSanPham() != null, "dòng không có sản phẩm");
            SanPhamQuanAo sp = bt.getSanPham();
            String donGia = null;
            String thanhTien = null;
            if (coGia) {
                kiem(ct.getDonGia() != null, "dòng chưa có đơn giá");
                donGia = DinhDangEmail.tien(ct.getDonGia());
                thanhTien = DinhDangEmail.tien(thanhTien(ct));
            }
            // cắt khoảng trắng hai đầu như màu, cỡ, SKU (dữ liệu nhập tay có thể còn dấu cách cuối; bản chữ thường không
            // gộp khoảng trắng như HTML)
            dong.add(new DongSanPhamEmail(stt++, sach(sp.getTenSanPham()), thuocTinh(bt), sach(bt.getMaSku()),
                    DinhDangEmail.soLuong(ct.getSoLuongDat(), sp.getDonViTinh()), donGia, thanhTien));
        }
        return dong;
    }

    /** "Trắng · M" (màu · cỡ, đã cắt khoảng trắng); không có cả hai thì null. */
    static String thuocTinh(BienTheSanPham bt) {
        List<String> phan = new ArrayList<>();
        if (bt.getMauSac() != null && sach(bt.getMauSac().getTenMau()) != null) {
            phan.add(bt.getMauSac().getTenMau().trim());
        }
        if (bt.getSize() != null && sach(bt.getSize().getTenSize()) != null) {
            phan.add(bt.getSize().getTenSize().trim());
        }
        return phan.isEmpty() ? null : String.join(" · ", phan);
    }

    /** "360 cái" khi mọi dòng cùng đơn vị tính (so sau khi cắt khoảng trắng, viết thường); khác nhau thì null. */
    static String tongSoLuong(List<ChiTietDonMuaHang> chiTiet) {
        if (chiTiet.isEmpty()) {
            return null;
        }
        Set<String> donVi = new HashSet<>();
        BigDecimal tong = BigDecimal.ZERO;
        for (ChiTietDonMuaHang ct : chiTiet) {
            donVi.add(DinhDangEmail.donViTinh(ct.getBienTheSanPham().getSanPham().getDonViTinh()));
            tong = tong.add(ct.getSoLuongDat());
        }
        return donVi.size() == 1 ? DinhDangEmail.soLuong(tong, donVi.iterator().next()) : null;
    }

    /** Số lượng × đơn giá, làm tròn 2 số lẻ như cột thanh_tien decimal(15,2). */
    static BigDecimal thanhTien(ChiTietDonMuaHang ct) {
        return ct.getSoLuongDat().multiply(ct.getDonGia()).setScale(2, RoundingMode.HALF_UP);
    }

    /** Tổng các thành tiền tự tính; lệch tong_tien đã lưu thì ghi WARN (email theo các dòng đang hiện). */
    static BigDecimal tongTien(DonMuaHang don, List<ChiTietDonMuaHang> chiTiet) {
        BigDecimal tong = BigDecimal.ZERO;
        for (ChiTietDonMuaHang ct : chiTiet) {
            kiem(ct.getDonGia() != null, "dòng chưa có đơn giá");
            tong = tong.add(thanhTien(ct));
        }
        if (don.getTongTien() != null && don.getTongTien().compareTo(tong) != 0) {
            log.warn("[EMAIL] Đơn {}: tổng tiền đã lưu {} khác tổng các dòng {}", maDon(don),
                    don.getTongTien().toPlainString(), tong.toPlainString());
        }
        return tong;
    }

    /** Tiền bằng chữ; tổng có phần lẻ (dữ liệu cũ) thì bỏ dòng "Bằng chữ" (ghi WARN) thay vì không gửi được M1. */
    static String bangChu(BigDecimal tong, String maDon) {
        if (DinhDangEmail.coPhanLe(tong)) {
            log.warn("[EMAIL] Đơn {}: tổng tiền có phần lẻ, bỏ dòng bằng chữ", maDon);
            return null;
        }
        return DinhDangEmail.bangChu(tong);
    }

    static NguoiPhuTrachEmail nguoiPhuTrach(DonMuaHang don) {
        NguoiDung nd = don.getNguoiTao();
        if (nd == null) {
            return null;
        }
        String vaiTro = nd.getVaiTro();
        return new NguoiPhuTrachEmail(hoTen(nd),
                IRoleType.quan_tri_vien.equals(vaiTro) ? null : TenVaiTro.cua(vaiTro),
                DinhDangEmail.dienThoai(nd.getSoDienThoai()), DinhDangEmail.dienThoaiLienKet(nd.getSoDienThoai()),
                sach(nd.getEmail()));
    }

    private static List<ChiTietDonMuaHang> chiTiet(DonMuaHang don) {
        List<ChiTietDonMuaHang> ds = don.getChiTietDonMuaHangs();
        kiem(ds != null && !ds.isEmpty(), "đơn không có dòng sản phẩm");
        return sapXep(ds);
    }

    private static List<ChiTietDonMuaHang> sapXep(List<ChiTietDonMuaHang> ds) {
        List<ChiTietDonMuaHang> kq = new ArrayList<>(ds);
        kq.sort(Comparator.comparing(ChiTietDonMuaHang::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        return kq;
    }

    private static String emailNhaCungCap(DonMuaHang don) {
        NhaCungCap ncc = don.getNhaCungCap();
        kiem(ncc != null, "đơn không có nhà cung cấp");
        String email = sach(ncc.getEmail());
        kiem(email != null, "nhà cung cấp chưa có email");
        return email;
    }

    private static String tenNhaCungCap(DonMuaHang don) {
        NhaCungCap ncc = don.getNhaCungCap();
        kiem(ncc != null && sach(ncc.getTenNhaCungCap()) != null, "đơn không có tên nhà cung cấp");
        return ncc.getTenNhaCungCap().trim();
    }

    private static String maDon(DonMuaHang don) {
        return don == null ? null : don.getSoDonMua();
    }

    /** " – Thời trang Linh Lan" (đuôi tiêu đề E4, M1); cửa hàng chưa có tên thì không có đuôi. */
    static String duoiCuaHang(CuaHangEmail c) {
        return c != null && c.tenHienThi() != null ? " – " + c.tenHienThi() : "";
    }

    private boolean trangThaiLa(Integer id, int trangThai) {
        return id != null && donMuaHangEmailRepository.trangThai(id).map(t -> t == trangThai).orElse(false);
    }

    /**
     * Báo giá trong CSDL vẫn là lần báo giá của thư này. So đúng theo giây như xét báo giá (ngayBaoGiaDaXem): máy chủ
     * cắt ngayBaoGia về giây trước khi lưu và mỗi lần gửi lại luôn lớn hơn lần trước ít nhất 1 giây, nên hai lần báo giá
     * không bao giờ trùng giây (không dùng sai số: thư của lần trước sẽ lọt qua).
     */
    private boolean cungLanBaoGia(Integer id, Instant ngayBaoGia) {
        return donMuaHangEmailRepository.ngayBaoGia(id)
                .map(trongCsdl -> trongCsdl.getEpochSecond() == ngayBaoGia.getEpochSecond())
                .orElse(false);
    }

    /** E6. Gửi thẳng (không hàng đợi, không thử lại): thu ngân đang chờ mã ở quầy. */
    @Override
    public void guiMaDuyetTraHang(NguoiDung quanLy, MaDuyetTraHangThongTin tt, String ma, Instant hetHanLuc) {
        EmailGui g;
        try {
            String den = emailCua(quanLy, LoaiEmail.E6);
            kiem(den != null, "quản lý chưa có email");
            kiem(tt != null && ma != null && !ma.isBlank() && hetHanLuc != null, "thiếu mã hoặc hạn dùng");
            MaDuyetTraHangEmail duLieu = new MaDuyetTraHangEmail(hoTen(quanLy), tt.tenCuaHang(), tt.nguoiYeuCau(),
                    tt.soDonHang(), DinhDangEmail.gioNgay(tt.thanhToanLuc()), tt.soNgay(), tt.lyDo(), ma,
                    DinhDangEmail.gioNgay(hetHanLuc), DinhDangEmail.phut(Duration.between(clock.instant(), hetHanLuc)));
            String soDon = tt.soDonHang();
            g = EmailGui.builder()
                    .loai(LoaiEmail.E6).den(den).maDon(soDon)
                    .tieuDe(c -> "Mã duyệt trả hàng đơn " + soDon)
                    .duLieu(duLieu)
                    .build();
        } catch (Exception e) {
            loiDung(LoaiEmail.E6, tt == null ? null : tt.soDonHang(), e);
            // i18n-giu-nguyen: lỗi nội bộ, nơi gọi bắt EmailKhongGuiDuocException và trả câu lỗi riêng
            throw new EmailKhongGuiDuocException("Không dựng được email mã duyệt trả hàng", e);
        }
        dispatcher.guiNgay(g);
    }

    private static String emailCua(NguoiDung nd, LoaiEmail loai) {
        String email = nd == null ? null : sach(nd.getEmail());
        if (email == null) {
            log.warn("[EMAIL] Bỏ {}: tài khoản id={} chưa có email", loai, nd == null ? null : nd.getId());
        }
        return email;
    }

    /** Họ tên; trống thì tên đăng nhập (không để "Xin chào ,"). */
    static String hoTen(NguoiDung nd) {
        String ten = sach(nd.getHoTen());
        return ten != null ? ten : nd.getTenDangNhap();
    }

    private static void kiem(boolean dung, String lyDo) {
        if (!dung) {
            throw new IllegalStateException(lyDo);
        }
    }

    private static void loiDung(LoaiEmail loai, String maDon, Exception e) {
        // chỉ ghi lý do (không có mã, mật khẩu: record che trong toString, IllegalStateException chỉ mang lý do)
        log.error("[EMAIL] Không gửi {}{}: {}", loai, maDon == null ? "" : " cho đơn " + maDon, e.toString());
    }

    private static String sach(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
