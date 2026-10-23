package com.dev.backend.services.email;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.TenVaiTro;
import com.dev.backend.dto.email.*;
import com.dev.backend.entities.*;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.email.DonMuaHangEmailRepository;
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
 *   <li>mọi hàm trừ E5 KHÔNG ném bất kỳ ngoại lệ nào ra nơi gọi, kể cả lỗi lúc dựng dữ liệu (chỉ log ERROR): lỗi email
 *       không được làm rollback việc chấp nhận báo giá hay gửi yêu cầu;</li>
 *   <li>không tiêm NguoiDungService / DonMuaHangService / YeuCauMuaHangService (hai service đầu tiêm lớp này: vòng phụ
 *       thuộc bean);</li>
 *   <li>E1 không truy vấn CSDL trên luồng request (thông tin cửa hàng đọc ở luồng gửi);</li>
 *   <li>E5 gửi đồng bộ, không mở transaction bao quanh lúc gửi SMTP, không ghi mã vào log.</li>
 * </ul>
 *
 * <p>Để không "chính thức hóa" dữ liệu sai qua email:
 * <ul>
 *   <li>mỗi email nhà cung cấp kiểm đúng trạng thái đơn trước khi dựng (E4/M3/E5: chờ báo giá; M1: đã chấp nhận;
 *       M2: không chấp nhận), sai thì không gửi và ghi ERROR;</li>
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
    static final String TIEU_DE_E3 = "Mật khẩu tạm thời mới cho tài khoản FCentric";
    static final String TIEU_DE_M4 = "Mật khẩu FCentric của bạn vừa được thay đổi";

    static final int DON_CHO_BAO_GIA = 2;
    static final int DON_DA_CHAP_NHAN = 3;
    static final int DON_KHONG_CHAP_NHAN = 4;

    private final EmailDispatcher dispatcher;
    private final DuongDanEmail duongDan;
    private final NguoiDungRepository nguoiDungRepository;
    private final DonMuaHangEmailRepository donMuaHangEmailRepository;
    private final Clock clock;

    @Autowired
    public EmailNghiepVuServiceImpl(EmailDispatcher dispatcher, DuongDanEmail duongDan,
                                    NguoiDungRepository nguoiDungRepository,
                                    DonMuaHangEmailRepository donMuaHangEmailRepository) {
        this(dispatcher, duongDan, nguoiDungRepository, donMuaHangEmailRepository, Clock.systemUTC());
    }

    EmailNghiepVuServiceImpl(EmailDispatcher dispatcher, DuongDanEmail duongDan,
                             NguoiDungRepository nguoiDungRepository,
                             DonMuaHangEmailRepository donMuaHangEmailRepository, Clock clock) {
        this.dispatcher = dispatcher;
        this.duongDan = duongDan;
        this.nguoiDungRepository = nguoiDungRepository;
        this.donMuaHangEmailRepository = donMuaHangEmailRepository;
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

    /** E2. Thử lại chỉ khi mật khẩu tạm vẫn là mật khẩu hiện tại (người dùng chưa đổi, quản trị viên chưa cấp lại). */
    @Override
    public void guiTaiKhoanMoi(NguoiDung nguoiDung, String matKhauTam) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.E2);
            if (den == null) {
                return;
            }
            String vaiTro = nguoiDung.getVaiTro();
            TaiKhoanMoiEmail duLieu = new TaiKhoanMoiEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(), matKhauTam,
                    TenVaiTro.cua(vaiTro),
                    // cùng quy tắc "làm việc theo kho" của phân quyền: mọi vai trò nhân sự trừ Quản trị viên
                    IRoleType.laNoiBo(vaiTro) && !IRoleType.quan_tri_vien.equals(vaiTro),
                    vaiTro != null && IRoleType.GUI_YEU_CAU_BAO_GIA.contains(vaiTro),
                    duongDan.dangNhap(), duongDan.nhanDangNhap());
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E2).den(den).tieuDe(c -> TIEU_DE_E2).duLieu(duLieu)
                    .conHieuLuc(matKhauConLa(nguoiDung))
                    .build());
        } catch (Exception e) {
            loiDung(LoaiEmail.E2, null, e);
        }
    }

    /** E3 (sửa L9: có mật khẩu tạm). Không nêu tên quản trị viên. Lần cấp lại mới hơn thì bỏ thư cũ. */
    @Override
    public void guiCapLaiMatKhau(NguoiDung nguoiDung, String matKhauTam, Instant luc) {
        try {
            String den = emailCua(nguoiDung, LoaiEmail.E3);
            if (den == null) {
                return;
            }
            CapLaiMatKhauEmail duLieu = new CapLaiMatKhauEmail(hoTen(nguoiDung), nguoiDung.getTenDangNhap(),
                    matKhauTam, DinhDangEmail.gioNgay(luc), !Integer.valueOf(1).equals(nguoiDung.getTrangThai()),
                    duongDan.dangNhap(), duongDan.nhanDangNhap());
            dispatcher.guiSauCommit(EmailGui.builder()
                    .loai(LoaiEmail.E3).den(den).tieuDe(c -> TIEU_DE_E3).duLieu(duLieu)
                    .conHieuLuc(matKhauConLa(nguoiDung))
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
            throw new IllegalArgumentException("Thiếu cách thay đổi mật khẩu");
        }
        return switch (cach) {
            case DAT_LAI_BANG_MA -> "Đặt lại bằng mã gửi qua email";
            case DOI_KHI_DA_DANG_NHAP -> "Đổi khi đã đăng nhập";
        };
    }

    /** Mật khẩu (băm) trong CSDL lúc gửi vẫn là mật khẩu lúc dựng thư: mật khẩu tạm trong thư còn dùng được. */
    private BooleanSupplier matKhauConLa(NguoiDung nguoiDung) {
        Integer id = nguoiDung.getId();
        String bam = nguoiDung.getMatKhauHash();
        if (id == null || bam == null) {
            return null;
        }
        return () -> nguoiDungRepository.findById(id).map(nd -> bam.equals(nd.getMatKhauHash())).orElse(false);
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

    /** E5. Gửi ngay trong request; không gửi được (kể cả dữ liệu sai) thì ném EmailKhongGuiDuocException. */
    @Override
    public void guiMaXacNhanBaoGia(DonMuaHang don, String emailNhan, String ma, Instant hetHanLuc) {
        String maDon = maDon(don);
        EmailGui g;
        try {
            kiem(Integer.valueOf(DON_CHO_BAO_GIA).equals(don.getTrangThai()), "đơn không ở trạng thái chờ báo giá");
            kiem(emailNhan != null && !emailNhan.isBlank(), "thiếu email nhận");
            kiem(ma != null && !ma.isBlank() && hetHanLuc != null, "thiếu mã hoặc hạn dùng");
            MaXacNhanBaoGiaEmail duLieu = new MaXacNhanBaoGiaEmail(tenNhaCungCap(don), maDon, ma,
                    DinhDangEmail.gioNgay(hetHanLuc), DinhDangEmail.phut(Duration.between(clock.instant(), hetHanLuc)));
            g = EmailGui.builder()
                    .loai(LoaiEmail.E5).den(emailNhan.trim()).maDon(maDon)
                    .tieuDe(c -> "Mã xác nhận báo giá đơn " + maDon)
                    .duLieu(duLieu).nguoiPhuTrach(nguoiPhuTrach(don))
                    .build();
        } catch (Exception e) {
            loiDung(LoaiEmail.E5, maDon, e);
            throw new EmailKhongGuiDuocException("Không dựng được email mã xác nhận báo giá", e);
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
            List<String> thuocTinh = new ArrayList<>();
            if (bt.getMauSac() != null && sach(bt.getMauSac().getTenMau()) != null) {
                thuocTinh.add(bt.getMauSac().getTenMau().trim());
            }
            if (bt.getSize() != null && sach(bt.getSize().getTenSize()) != null) {
                thuocTinh.add(bt.getSize().getTenSize().trim());
            }
            String donGia = null;
            String thanhTien = null;
            if (coGia) {
                kiem(ct.getDonGia() != null, "dòng chưa có đơn giá");
                donGia = DinhDangEmail.tien(ct.getDonGia());
                thanhTien = DinhDangEmail.tien(thanhTien(ct));
            }
            // cắt khoảng trắng hai đầu như màu, cỡ, SKU (dữ liệu nhập tay có thể còn dấu cách cuối; bản chữ thường không
            // gộp khoảng trắng như HTML)
            dong.add(new DongSanPhamEmail(stt++, sach(sp.getTenSanPham()),
                    thuocTinh.isEmpty() ? null : String.join(" · ", thuocTinh), sach(bt.getMaSku()),
                    DinhDangEmail.soLuong(ct.getSoLuongDat(), sp.getDonViTinh()), donGia, thanhTien));
        }
        return dong;
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
