package com.dev.backend.services.impl.congncc;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.PhienCongNcc;
import com.dev.backend.dto.request.DonMuaHangBaoGia;
import com.dev.backend.dto.request.congncc.CongNccRequest;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.CongNcc;
import com.dev.backend.dto.response.congncc.CuaHangCongDto;
import com.dev.backend.dto.response.congncc.DonMuaHangCongNccDto;
import com.dev.backend.dto.response.congncc.MaXacNhanNccDto;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.BienBanTraHangNccRepository;
import com.dev.backend.repository.ChiTietDonMuaHangRepository;
import com.dev.backend.repository.ChiTietLoiLoHangRepository;
import com.dev.backend.repository.ChiTietPhieuNhapKhoRepository;
import com.dev.backend.repository.ChiTietTraHangNccRepository;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailKhongGuiDuocException;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.entities.BienBanTraHangServiceImpl;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.NhatKyTraHangNcc;
import com.dev.backend.services.impl.entities.ThongTinCuaHangMuaHang;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Cổng nhà cung cấp đăng nhập theo email: nhận mã, xác nhận mã, phiên (hết hạn, đổi email, đăng xuất), việc cần làm,
 * đơn / báo giá, biên bản, lịch sử. Service thật; repository, DonMuaHangService, BienBanTraHangService, email giả; đồng
 * hồ tua được (có múi giờ, để kiểm mốc ngày theo giờ Việt Nam).
 */
@ExtendWith(MockitoExtension.class)
class CongNhaCungCapServiceTest {

    /** 10:00 giờ Việt Nam ngày 23/11/2026. */
    private static final Instant BAY_GIO = Instant.parse("2026-11-23T03:00:00Z");
    private static final String EMAIL = "lan.tran@xuongmay.vn";
    private static final String EMAIL_KHAC = "kinhdoanh@detkim.vn";

    @Mock
    private NhaCungCapRepository nhaCungCapRepository;
    @Mock
    private DonMuaHangRepository donMuaHangRepository;
    @Mock
    private DonMuaHangService donMuaHangService;
    @Mock
    private BienBanTraHangService bienBanTraHangService;
    @Mock
    private EmailNghiepVuService email;
    @Mock
    private CalcService calcService;
    @Mock
    private ThongTinCuaHangMuaHang thongTinCuaHang;
    @Mock
    private NhatKyTraHangNcc nhatKy;

    private CongNhaCungCapService service;
    private final DongHo dongHo = new DongHo(BAY_GIO);
    private final AtomicInteger soMa = new AtomicInteger(100000);

    private NhaCungCap nccA;
    private NhaCungCap nccB;
    private NhaCungCap nccKhac;

    /** Đồng hồ tua được, giữ múi giờ khi withZone (service tính "hôm nay" theo giờ Việt Nam). */
    private static final class DongHo extends Clock {
        private final AtomicReference<Instant> now;
        private final ZoneId zone;

        DongHo(Instant start) {
            this(new AtomicReference<>(start), ZoneOffset.UTC);
        }

        private DongHo(AtomicReference<Instant> now, ZoneId zone) {
            this.now = now;
            this.zone = zone;
        }

        void tua(Duration d) {
            now.set(now.get().plus(d));
        }

        void dat(Instant luc) {
            now.set(luc);
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId z) {
            return new DongHo(now, z);
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    }

    @BeforeEach
    void setUp() {
        xoaBoNho();
        service = new CongNhaCungCapService(nhaCungCapRepository, donMuaHangRepository, donMuaHangService,
                bienBanTraHangService, email, calcService, thongTinCuaHang, nhatKy);
        service.setDongHo(dongHo);

        // Email lưu có chữ hoa và khoảng trắng: so khớp không phân biệt hoa thường
        nccA = ncc(5, "Xưởng May Hoàng Anh", "Lan.Tran@XuongMay.vn ");
        nccB = ncc(6, "Dệt Kim Minh Châu", "lan.tran@xuongmay.vn");
        nccKhac = ncc(9, "Công ty Khác", EMAIL_KHAC);
        lenient().when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA));
        lenient().when(nhaCungCapRepository.timTheoEmail(EMAIL_KHAC)).thenReturn(List.of(nccKhac));
        lenient().when(calcService.getRandomActiveCode(6L)).thenAnswer(inv -> String.valueOf(soMa.incrementAndGet()));
        lenient().when(thongTinCuaHang.choCongNhaCungCap()).thenReturn(CuaHangCongDto.builder().ten("Thời trang Linh Lan").build());
        lenient().when(nhatKy.idLapCuoi(anyInt())).thenAnswer(inv -> 7000 + (Integer) inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        xoaBoNho();
    }

    private static void xoaBoNho() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        GlobalCache.PHIEN_CONG_NCC.clear();
        GlobalCache.LUOT_GUI_MA_NCC.clear();
    }

    // ── dữ liệu mẫu ───────────────────────────────────────────────────────

    private static NhaCungCap ncc(int id, String ten, String email) {
        return NhaCungCap.builder().id(id).tenNhaCungCap(ten).email(email).trangThai(1).build();
    }

    private static Kho kho() {
        return Kho.builder().id(1).tenKho("Kho tổng").diaChi("12 Lý Thường Kiệt, Hà Nội").build();
    }

    private static ChiTietDonMuaHang dong(int id, String soLuong) {
        return ChiTietDonMuaHang.builder().id(id).soLuongDat(new BigDecimal(soLuong)).build();
    }

    private static DonMuaHang don(int id, NhaCungCap ncc, int trangThai, Instant ngayGuiYeuCau, Instant ngayBaoGia,
                                  ChiTietDonMuaHang... dong) {
        return DonMuaHang.builder().id(id).soDonMua("PO20261123" + id).nhaCungCap(ncc).trangThai(trangThai)
                .khoNhap(kho()).ngayDatHang(ngayGuiYeuCau).ngayGuiYeuCau(ngayGuiYeuCau).ngayBaoGia(ngayBaoGia)
                .ngayGiaoDuKien(Instant.parse("2026-12-01T00:00:00Z")).tongTien(new BigDecimal("1500000"))
                .nguoiTao(NguoiDung.builder().id(3).hoTen("Trần Mua").soDienThoai("0912345678").email("mua@cuahang.vn").build())
                .chiTietDonMuaHangs(new ArrayList<>(List.of(dong)))
                .build();
    }

    private static BienBanTraHangDto.BienBanTraHangDtoBuilder bb(int id, String phuongAn, Instant ngayLap, int soLoi) {
        return BienBanTraHangDto.builder().id(id).soBienBan("RTV-20261123-00" + id).soDonMua("PO" + id).soPhieuNhap("PN" + id)
                .donMuaHangId(1000 + id).trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN)
                .trangThai(BienBanTraHangNcc.CHO_TRA_HANG).phuongAn(phuongAn).ngayLap(ngayLap)
                .tongSoLuongLoi(soLoi).giaTriLoi(new BigDecimal(soLoi * 100000L)).tienTruTien(BigDecimal.ZERO)
                .tenKho("Kho tổng").trangThaiHang(BienBanTraHangNcc.HANG_O_KHO).buXong(false)
                .choNccChonCachBu(BienBanTraHangNcc.PA_CHO_CHOT.equals(phuongAn)).choNccChonHangLoi(false);
    }

    /** Chạy và kiểm ném LoiCoMaException đúng mã; trả ngoại lệ để kiểm tiếp. */
    private static LoiCoMaException loiMa(String ma, Executable viec) {
        LoiCoMaException e = assertThrows(LoiCoMaException.class, viec);
        assertEquals(ma, e.getMa(), e.getMessage());
        return e;
    }

    private static OtpScheduleObj maCua(String email) {
        return GlobalCache.OTP_SCHEDULE_OBJS.stream()
                .filter(o -> o.getType() == OtpType.SUPPLIER_MAIL_SIGN_KEY && email.equals(o.getEmail()))
                .findFirst().orElse(null);
    }

    private String moPhien(String email) {
        service.layMa(email);
        return service.xacNhanMa(email, maCua(email).getOtp()).phien();
    }

    // ── Nhận mã ───────────────────────────────────────────────────────────

    @Nested
    class NhanMa {

        @Test
        void thanhCong_maGanVoiEmailKhongGanDon_emailChuanHoa_guiE5DungHetHan() {
            MaXacNhanNccDto kq = service.layMa("  LAN.TRAN@xuongmay.vn ");

            assertEquals(300, kq.getHetHanGiay());
            assertEquals(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan().toSeconds(), kq.getHetHanGiay(), "cùng nguồn với job dọn mã");
            assertEquals(CongNhaCungCapService.MA_GUI_LAI_SAU_GIAY, kq.getGuiLaiSauGiay());
            verify(nhaCungCapRepository).timTheoEmail(EMAIL);
            OtpScheduleObj ma = maCua(EMAIL);
            assertNotNull(ma);
            assertEquals(BAY_GIO, ma.getCreatedAt());
            assertEquals(List.of(BAY_GIO), GlobalCache.LUOT_GUI_MA_NCC.get(EMAIL), "lượt gửi khóa theo email đã chuẩn hóa");
            // Gửi tới email lưu trong hệ thống (bỏ khoảng trắng), không phải chuỗi người dùng gõ
            verify(email).guiMaDangNhapCong("Lan.Tran@XuongMay.vn", "Xưởng May Hoàng Anh", ma.getOtp(),
                    BAY_GIO.plus(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan()));
        }

        @Test
        void emailKhongThuocNhaCungCapNao_400EmailKhongCo_khongTaoMa_khongGuiThu() {
            LoiCoMaException e = loiMa(MaLoi.EMAIL_KHONG_CO, () -> service.layMa("nguoi.la@khac.vn"));
            assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
            assertFalse(e.getMessage().contains("nguoi.la"), "không lặp lại email người dùng gõ: " + e.getMessage());
            loiMa(MaLoi.EMAIL_KHONG_CO, () -> service.layMa("   "));
            loiMa(MaLoi.EMAIL_KHONG_CO, () -> service.layMa(null));
            assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
            assertTrue(GlobalCache.LUOT_GUI_MA_NCC.isEmpty());
            verifyNoInteractions(email);
        }

        @Test
        void nhieuNhaCungCapChungEmail_motMa_motThu_tenNoiLai() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            service.layMa(EMAIL);
            assertEquals(1, GlobalCache.OTP_SCHEDULE_OBJS.size());
            verify(email).guiMaDangNhapCong(eq("Lan.Tran@XuongMay.vn"), eq("Xưởng May Hoàng Anh, Dệt Kim Minh Châu"),
                    anyString(), any());
        }

        @Test
        void honBaNhaCungCap_tenRutGonCongSoConLai() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB,
                    ncc(7, "Ba", EMAIL), ncc(8, "Bốn", EMAIL), ncc(10, "Ba", EMAIL)));
            service.layMa(EMAIL);
            verify(email).guiMaDangNhapCong(anyString(), eq("Xưởng May Hoàng Anh, Dệt Kim Minh Châu, Ba +1"), anyString(), any());
        }

        @Test
        void xinLaiTrong60Giay_429_kemSoGiayCho_sau60GiayThiMaMoiThayMaCu() {
            service.layMa(EMAIL);
            String maCu = maCua(EMAIL).getOtp();
            dongHo.tua(Duration.ofSeconds(20));

            LoiCoMaException e = loiMa(MaLoi.MA_CU_CON_HIEU_LUC, () -> service.layMa(EMAIL));
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
            assertEquals(40, e.getDuLieu().get("guiLaiSauGiay"));
            assertEquals(280, e.getDuLieu().get("hetHanGiay"));
            assertEquals("Vui lòng chờ 40 giây rồi nhận mã mới.", e.getMessage());

            dongHo.tua(Duration.ofSeconds(41));
            service.layMa(EMAIL);
            long soMaCuaEmail = GlobalCache.OTP_SCHEDULE_OBJS.stream().filter(o -> EMAIL.equals(o.getEmail())).count();
            assertEquals(1, soMaCuaEmail, "mã mới thay mã cũ của cùng email");
            assertNotEquals(maCu, maCua(EMAIL).getOtp());
        }

        @Test
        void chan60Giay_theoEmail_emailKhacVanXinDuoc() {
            service.layMa(EMAIL);
            assertDoesNotThrow(() -> service.layMa(EMAIL_KHAC));
            assertNotNull(maCua(EMAIL));
            assertNotNull(maCua(EMAIL_KHAC));
        }

        @Test
        void qua5MaMoiGio_429_motGioSauThiXinDuoc() {
            for (int i = 0; i < CongNhaCungCapService.MA_TOI_DA_MOI_GIO; i++) {
                service.layMa(EMAIL);
                dongHo.tua(Duration.ofSeconds(61));
            }
            LoiCoMaException e = loiMa(MaLoi.MA_CU_CON_HIEU_LUC, () -> service.layMa(EMAIL));
            int cho = (Integer) e.getDuLieu().get("guiLaiSauGiay");
            assertEquals(3600 - 5 * 61, cho, "chờ tới khi lượt đầu ra khỏi cửa sổ 1 giờ");
            // mã thứ 5 vừa gửi 61 giây trước, còn hạn: cổng vẫn cho nhập mã đó
            assertEquals(300 - 61, e.getDuLieu().get("hetHanGiay"));
            assertEquals(5, GlobalCache.LUOT_GUI_MA_NCC.get(EMAIL).size(), "lần bị chặn không tính lượt");
            dongHo.tua(Duration.ofSeconds(cho));
            assertDoesNotThrow(() -> service.layMa(EMAIL));
        }

        @Test
        void qua5MaMoiGio_maCuDaHetHan_429_hetHanGiayBang0() {
            for (int i = 0; i < CongNhaCungCapService.MA_TOI_DA_MOI_GIO; i++) {
                service.layMa(EMAIL);
                dongHo.tua(Duration.ofSeconds(61));
            }
            dongHo.tua(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan());
            LoiCoMaException e = loiMa(MaLoi.MA_CU_CON_HIEU_LUC, () -> service.layMa(EMAIL));
            assertEquals(0, e.getDuLieu().get("hetHanGiay"));
            assertTrue((Integer) e.getDuLieu().get("guiLaiSauGiay") > 0);

            // mã cũ đã bị job dọn (không còn trong bộ nhớ): cũng 0
            GlobalCache.OTP_SCHEDULE_OBJS.clear();
            LoiCoMaException e2 = loiMa(MaLoi.MA_CU_CON_HIEU_LUC, () -> service.layMa(EMAIL));
            assertEquals(0, e2.getDuLieu().get("hetHanGiay"));
        }

        @Test
        void guiEmailMa_ngoaiKhoaOtpVaNgoaiTransaction() throws Exception {
            boolean[] dangGiuKhoa = {true};
            doAnswer(inv -> {
                dangGiuKhoa[0] = Thread.holdsLock(GlobalCache.OTP_SCHEDULE_OBJS);
                return null;
            }).when(email).guiMaDangNhapCong(anyString(), any(), anyString(), any());
            service.layMa(EMAIL);
            assertFalse(dangGiuKhoa[0], "E5 gọi ngoài synchronized (GlobalCache.OTP_SCHEDULE_OBJS)");

            Transactional tx = CongNhaCungCapService.class.getMethod("layMa", String.class).getAnnotation(Transactional.class);
            assertNotNull(tx);
            assertEquals(Propagation.NOT_SUPPORTED, tx.propagation());
        }

        @Test
        void guiEmailLoi_503_xoaMaVaLuot_xinLaiDuocNgay() {
            doThrow(new EmailKhongGuiDuocException("SMTP lỗi", null))
                    .doNothing()
                    .when(email).guiMaDangNhapCong(anyString(), any(), anyString(), any());

            LoiCoMaException e = loiMa(MaLoi.CHUA_GUI_DUOC_MA, () -> service.layMa(EMAIL));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
            assertEquals("Chưa gửi được mã xác nhận. Vui lòng thử lại sau ít phút.", e.getMessage());
            assertNull(maCua(EMAIL), "mã chưa gửi được phải bị xóa");
            assertFalse(GlobalCache.LUOT_GUI_MA_NCC.containsKey(EMAIL), "lượt lỗi không tính vào giới hạn");

            assertDoesNotThrow(() -> service.layMa(EMAIL));
            assertNotNull(maCua(EMAIL));
            assertEquals(List.of(BAY_GIO), GlobalCache.LUOT_GUI_MA_NCC.get(EMAIL));
        }

        @Test
        void guiEmailLoi_giuCacLuotTruoc_chiBoLuotVuaTinh() {
            service.layMa(EMAIL);
            dongHo.tua(Duration.ofSeconds(61));
            doThrow(new EmailKhongGuiDuocException("SMTP lỗi", null))
                    .when(email).guiMaDangNhapCong(anyString(), any(), anyString(), any());
            loiMa(MaLoi.CHUA_GUI_DUOC_MA, () -> service.layMa(EMAIL));
            assertEquals(List.of(BAY_GIO), GlobalCache.LUOT_GUI_MA_NCC.get(EMAIL));
            assertNull(maCua(EMAIL), "mã cũ đã bị thay rồi mã mới lỗi: không còn mã nào");
        }
    }

    // ── Xác nhận mã ───────────────────────────────────────────────────────

    @Nested
    class XacNhanMa {

        @Test
        void dungMa_xoaMa_moPhien60PhutTheoEmail_traTenNhaCungCapVaCuaHang() {
            service.layMa(EMAIL);
            String ma = maCua(EMAIL).getOtp();

            CongNcc.DangNhap kq = service.xacNhanMa("LAN.TRAN@XUONGMAY.VN", " " + ma + " ");

            assertNull(maCua(EMAIL), "mã chỉ dùng một lần");
            assertNotNull(kq.phien());
            assertTrue(kq.phien().matches("[A-Za-z0-9_-]{43}"), "32 byte base64url không đệm");
            assertEquals(BAY_GIO.plus(60, ChronoUnit.MINUTES), kq.hetHanPhien());
            assertEquals(new PhienCongNcc(EMAIL, BAY_GIO.plus(60, ChronoUnit.MINUTES)), GlobalCache.PHIEN_CONG_NCC.get(kq.phien()));
            assertEquals("Xưởng May Hoàng Anh", kq.nhaCungCap().ten());
            assertEquals("Lan.Tran@XuongMay.vn", kq.nhaCungCap().email());
            assertEquals("Thời trang Linh Lan", kq.cuaHang().getTen());
        }

        @Test
        void saiMa_giamLuotThu_lanThu5XoaMa_sauDoMaDungCungHetHan() {
            service.layMa(EMAIL);
            String ma = maCua(EMAIL).getOtp();
            for (int conLai = 4; conLai >= 1; conLai--) {
                LoiCoMaException e = loiMa(MaLoi.MA_SAI, () -> service.xacNhanMa(EMAIL, "000000"));
                assertEquals(conLai, e.getDuLieu().get("conLaiLanThu"));
                assertEquals("Mã xác nhận không đúng. Còn " + conLai + " lần thử.", e.getMessage());
                assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
            }
            LoiCoMaException lan5 = loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, "000000"));
            assertEquals("Đã nhập sai 5 lần. Vui lòng nhận mã mới.", lan5.getMessage());
            assertNull(maCua(EMAIL));
            LoiCoMaException sau = loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, ma));
            assertEquals("Mã xác nhận đã hết hạn hoặc đã dùng. Vui lòng nhận mã mới.", sau.getMessage());
            assertTrue(GlobalCache.PHIEN_CONG_NCC.isEmpty());
        }

        @Test
        void maDaSaiDu5Lan_nhapDung_vanTuChoi_vaXoaMa() {
            // Mã vẫn còn trong bộ nhớ dù đã sai đủ số lần (yêu cầu song song): nhập đúng cũng không mở phiên
            service.layMa(EMAIL);
            OtpScheduleObj ma = maCua(EMAIL);
            ma.getFailedAttempts().set(CongNhaCungCapService.MA_SAI_TOI_DA);
            LoiCoMaException e = loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, ma.getOtp()));
            assertEquals("Đã nhập sai 5 lần. Vui lòng nhận mã mới.", e.getMessage());
            assertNull(maCua(EMAIL));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.isEmpty());
        }

        @Test
        void saiMa_demTrongKhoaCuaMa() throws Exception {
            service.layMa(EMAIL);
            OtpScheduleObj ma = maCua(EMAIL);
            Throwable[] loi = {null};
            Thread khac = new Thread(() -> {
                try {
                    service.xacNhanMa(EMAIL, "000000");
                } catch (Throwable e) {
                    loi[0] = e;
                }
            });
            synchronized (ma) {
                khac.start();
                long han = System.nanoTime() + 5_000_000_000L;
                while (khac.getState() != Thread.State.BLOCKED && khac.isAlive() && System.nanoTime() < han) {
                    Thread.onSpinWait();
                }
                assertEquals(Thread.State.BLOCKED, khac.getState(), "so mã phải chờ khóa của chính mã");
                assertEquals(0, ma.getFailedAttempts().get(), "chưa vào khóa thì chưa đếm sai");
            }
            khac.join(5000);
            assertInstanceOf(LoiCoMaException.class, loi[0]);
            assertEquals(MaLoi.MA_SAI, ((LoiCoMaException) loi[0]).getMa());
            assertEquals(1, ma.getFailedAttempts().get());
        }

        @Test
        void maQuaHan_tuChoi_vaXoaMa() {
            service.layMa(EMAIL);
            String ma = maCua(EMAIL).getOtp();
            dongHo.tua(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan().plusSeconds(1));
            loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, ma));
            assertNull(maCua(EMAIL));
        }

        @Test
        void dungLaiMaDaDung_tuChoi() {
            service.layMa(EMAIL);
            String ma = maCua(EMAIL).getOtp();
            service.xacNhanMa(EMAIL, ma);
            loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, ma));
            assertEquals(1, GlobalCache.PHIEN_CONG_NCC.size());
        }

        @Test
        void maCuaEmailA_khongMoDuocEmailB() {
            service.layMa(EMAIL);
            String maA = maCua(EMAIL).getOtp();
            loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL_KHAC, maA));
            assertNotNull(maCua(EMAIL), "mã của email A còn nguyên");
            assertTrue(GlobalCache.PHIEN_CONG_NCC.isEmpty());
        }

        @Test
        void maLoaiKhac_cungEmail_khongDungDuoc() {
            GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder().email(EMAIL).otp("555555")
                    .type(OtpType.RESET_PASSWORD).createdAt(BAY_GIO).build());
            loiMa(MaLoi.MA_HET_HAN, () -> service.xacNhanMa(EMAIL, "555555"));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.isEmpty());
        }

        @Test
        void emailKhongConNhaCungCapNao_400EmailKhongCo_maGiuNguyen() {
            service.layMa(EMAIL);
            String ma = maCua(EMAIL).getOtp();
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of());
            loiMa(MaLoi.EMAIL_KHONG_CO, () -> service.xacNhanMa(EMAIL, ma));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.isEmpty());
            assertNotNull(maCua(EMAIL));
        }

        @Test
        void xacNhanLan2_phienCuCungEmailHetDung_phienEmailKhacGiuNguyen() {
            String phienKhac = moPhien(EMAIL_KHAC);
            String phienCu = moPhien(EMAIL);
            dongHo.tua(Duration.ofSeconds(61));
            String phienMoi = moPhien(EMAIL);
            assertNotEquals(phienCu, phienMoi);
            assertFalse(GlobalCache.PHIEN_CONG_NCC.containsKey(phienCu));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.containsKey(phienMoi));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.containsKey(phienKhac));
        }
    }

    // ── Phiên ─────────────────────────────────────────────────────────────

    @Nested
    class Phien {

        @Test
        void khongCoPhien_phienLa_403PhienHetHan() {
            LoiCoMaException e = loiMa(MaLoi.PHIEN_HET_HAN, () -> service.viecCanLam(null));
            assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.viecCanLam("   "));
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.layDonMua("khong-co-phien-nay", 101));
            verifyNoInteractions(donMuaHangService, bienBanTraHangService, donMuaHangRepository);
        }

        @Test
        void phienHetHanSau60Phut_403_vaXoaKhoiBoNho() {
            String phien = moPhien(EMAIL);
            dongHo.tua(Duration.ofMinutes(59));
            assertDoesNotThrow(() -> service.viecCanLam(phien));
            dongHo.tua(Duration.ofMinutes(1));
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.viecCanLam(phien));
            assertFalse(GlobalCache.PHIEN_CONG_NCC.containsKey(phien), "phiên hết hạn bị xóa");
        }

        @Test
        void phienCoKhoangTrangHaiDau_vanDung() {
            String phien = moPhien(EMAIL);
            assertDoesNotThrow(() -> service.viecCanLam(" " + phien + " "));
        }

        @Test
        void doiEmailNhaCungCap_phienCu403_vaXoa() {
            String phien = moPhien(EMAIL);
            // Nhân viên đổi email nhà cung cấp: email phiên không còn thuộc nhà cung cấp nào
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of());
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.viecCanLam(phien));
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.baoGia(phien, 101, DonMuaHangBaoGia.builder().id(101).build()));
            assertFalse(GlobalCache.PHIEN_CONG_NCC.containsKey(phien));
            verifyNoInteractions(donMuaHangService);
        }

        @Test
        void doiEmailMotTrongHaiNhaCungCap_phienChiConThayNhaCungCapCon() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            String phien = moPhien(EMAIL);
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccB));
            service.layDonMua(phien, 101);
            verify(donMuaHangService).layDonChoCong(101, Set.of(6));
        }

        @Test
        void dangXuat_xoaPhien_sauDo403() {
            String phien = moPhien(EMAIL);
            String phienKhac = moPhien(EMAIL_KHAC);
            service.dangXuat(" " + phien + " ");
            assertFalse(GlobalCache.PHIEN_CONG_NCC.containsKey(phien));
            assertTrue(GlobalCache.PHIEN_CONG_NCC.containsKey(phienKhac), "chỉ xóa phiên của mình");
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.viecCanLam(phien));
            assertDoesNotThrow(() -> service.dangXuat(null));
            assertDoesNotThrow(() -> service.dangXuat("  "));
            assertDoesNotThrow(() -> service.dangXuat(phien), "đăng xuất lần hai không lỗi");
        }
    }

    // ── Việc cần làm ──────────────────────────────────────────────────────

    @Nested
    class ViecCanLam {

        private String phien;

        @BeforeEach
        void moPhienHaiNhaCungCap() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            phien = moPhien(EMAIL);
        }

        @Test
        void nhieuNhaCungCapChungEmail_layDuLieuCuaTatCa() {
            when(bienBanTraHangService.dsChoCong(anyCollection())).thenReturn(List.of());
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of());
            CongNcc.ViecCanLam kq = service.viecCanLam(phien);
            verify(bienBanTraHangService).dsChoCong(Set.of(5, 6));
            verify(donMuaHangRepository).choCongNhaCungCap(Set.of(5, 6));
            assertEquals("Xưởng May Hoàng Anh, Dệt Kim Minh Châu", kq.nhaCungCap().ten());
            assertEquals("Lan.Tran@XuongMay.vn", kq.nhaCungCap().email());
            assertTrue(kq.bienBanCho().isEmpty());
            assertTrue(kq.donChoBaoGia().isEmpty());
            assertEquals(new CongNcc.SoLieu30Ngay(0, 0, 0, BigDecimal.ZERO), kq.soLieu30Ngay());
            assertNull(kq.nguoiPhuTrach());
        }

        @Test
        void bienBanCho_chiBienBanConViecPhaiTraLoi_cuTruoc_coHanTraLoi() {
            BienBanTraHangDto moi = bb(1, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(1, ChronoUnit.DAYS), 2).build();
            BienBanTraHangDto cu = bb(2, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(3, ChronoUnit.DAYS).minusSeconds(60), 4)
                    .hanTraLoi(Instant.parse("2026-11-30T16:59:59Z"))
                    .trangThaiHang(BienBanTraHangNcc.HANG_DA_TRA).nguoiNhanHang("tài xế Nguyễn Văn Hùng").bienSoXe("30K-288.23")
                    .build();
            BienBanTraHangDto daChon = bb(3, BienBanTraHangNcc.PA_DOI_HANG, BAY_GIO, 1).build();
            // máy chủ tắt cờ chờ khi biên bản hủy / đơn đã đóng, hủy (không còn hỏi cách bù)
            BienBanTraHangDto daHuy = bb(4, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO, 1).trangThai(BienBanTraHangNcc.DA_HUY)
                    .choNccChonCachBu(false).build();
            BienBanTraHangDto donDong = bb(5, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO, 1)
                    .trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_DONG).choNccChonCachBu(false).build();
            BienBanTraHangDto donHuy = bb(6, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO, 1)
                    .trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_HUY).choNccChonCachBu(false).build();
            // đã chọn giao bù nhưng hàng lỗi còn ở kho chưa chọn nhận lại / tiêu hủy: vẫn phải trả lời
            BienBanTraHangDto conHangLoi = bb(8, BienBanTraHangNcc.PA_DOI_HANG, BAY_GIO.minus(4, ChronoUnit.DAYS), 3)
                    .choNccChonHangLoi(true).build();
            BienBanTraHangDto donNhanDu = bb(7, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(2, ChronoUnit.DAYS), 1)
                    .trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_NHAN_DU).trangThaiHang(BienBanTraHangNcc.HANG_DA_TRA)
                    .nguoiNhanHang("Lê Bình").build();
            when(bienBanTraHangService.dsChoCong(anyCollection())).thenReturn(List.of(moi, daChon, cu, daHuy, donDong, donHuy, donNhanDu,
                    conHangLoi));

            CongNcc.ViecCanLam kq = service.viecCanLam(phien);

            assertEquals(List.of(8, 2, 7, 1), kq.bienBanCho().stream().map(CongNcc.BienBanCho::id).toList());
            assertEquals(3, kq.bienBanCho().get(0).tongSoLuong());
            CongNcc.BienBanCho dau = kq.bienBanCho().get(1);
            assertEquals(Instant.parse("2026-11-30T16:59:59Z"), dau.hanTraLoi());
            assertEquals(BAY_GIO.minus(3, ChronoUnit.DAYS).minusSeconds(60), dau.ngayLap());
            assertEquals(4, dau.tongSoLuong());
            assertEquals(new BigDecimal("400000"), dau.tongGiaTri());
            assertEquals("RTV-20261123-002", dau.soBienBan());
            assertEquals("PO2", dau.soDonMua());
            assertEquals("PN2", dau.soPhieuNhap());
            assertEquals(new CongNcc.HangLoiTomTat("DA_TRA", "tài xế Nguyễn Văn Hùng (30K-288.23)"), dau.hangLoi());
            assertEquals(new CongNcc.HangLoiTomTat("DA_TRA", "Lê Bình"), kq.bienBanCho().get(2).hangLoi());
            assertEquals(new CongNcc.HangLoiTomTat("O_KHO", "Kho tổng"), kq.bienBanCho().get(3).hangLoi());
            assertNull(kq.bienBanCho().get(3).hanTraLoi(), "chưa gửi được email biên bản: chưa có hạn");
        }

        @Test
        void donChoBaoGia_chiTrangThai2ChuaBaoGia() {
            DonMuaHang cho = don(11, nccA, 2, BAY_GIO.minus(2, ChronoUnit.DAYS), null, dong(1, "120"), dong(2, "2.5"));
            DonMuaHang daBao = don(12, nccB, 2, BAY_GIO.minus(2, ChronoUnit.DAYS), BAY_GIO.minus(1, ChronoUnit.DAYS), dong(3, "1"));
            DonMuaHang chapNhan = don(13, nccA, 3, BAY_GIO, null, dong(4, "1"));
            DonMuaHang tuChoi = don(14, nccA, 4, BAY_GIO, null, dong(5, "1"));
            DonMuaHang choNccB = don(15, nccB, 2, null, null, dong(6, "7"));
            choNccB.setNgayDatHang(BAY_GIO.minus(5, ChronoUnit.DAYS));
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(cho, daBao, chapNhan, tuChoi, choNccB));

            CongNcc.ViecCanLam kq = service.viecCanLam(phien);

            assertEquals(List.of(11, 15), kq.donChoBaoGia().stream().map(CongNcc.DonChoBaoGia::id).toList(),
                    "đơn chờ báo giá của cả hai nhà cung cấp chung email");
            CongNcc.DonChoBaoGia d = kq.donChoBaoGia().get(0);
            assertEquals("PO2026112311", d.soDonMua());
            assertEquals(2, d.soMatHang());
            assertEquals(0, new BigDecimal("122.5").compareTo(d.tongSoLuong()));
            assertEquals("Kho tổng", d.tenKho());
            assertEquals(Instant.parse("2026-12-01T00:00:00Z"), d.ngayCanGiao());
            assertEquals(BAY_GIO.minus(2, ChronoUnit.DAYS), d.ngayGuiYeuCau());
            assertEquals(BAY_GIO.minus(5, ChronoUnit.DAYS), kq.donChoBaoGia().get(1).ngayGuiYeuCau(),
                    "đơn cũ chưa có ngày gửi yêu cầu: dùng ngày đặt");
            assertEquals(new CongNcc.NguoiPhuTrach("Trần Mua", "0912345678", "mua@cuahang.vn"), kq.nguoiPhuTrach());
        }

        @Test
        void nguoiPhuTrach_theoTungViec_laNguoiTaoDonMuaCuaViecDo() {
            DonMuaHang choHa = don(31, nccA, 2, BAY_GIO.minus(1, ChronoUnit.DAYS), null, dong(1, "1"));
            choHa.setNguoiTao(NguoiDung.builder().id(4).hoTen("Phạm Thu Hà").soDienThoai("0987654321").email("ha@cuahang.vn").build());
            DonMuaHang choMin = don(32, nccA, 2, BAY_GIO.minus(3, ChronoUnit.DAYS), null, dong(2, "1"));
            DonMuaHang khongNguoiTao = don(33, nccB, 2, BAY_GIO.minus(4, ChronoUnit.DAYS), null, dong(3, "1"));
            khongNguoiTao.setNguoiTao(null);
            // đơn của biên bản đã nhận hàng (không còn chờ báo giá) vẫn có trong danh sách đơn đã gửi
            DonMuaHang donBienBan = don(1001, nccA, 5, BAY_GIO.minus(20, ChronoUnit.DAYS), BAY_GIO.minus(19, ChronoUnit.DAYS), dong(4, "1"));
            donBienBan.setNguoiTao(choHa.getNguoiTao());
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(choHa, choMin, khongNguoiTao, donBienBan));
            BienBanTraHangDto coDon = bb(1, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(2, ChronoUnit.DAYS), 1).build();
            BienBanTraHangDto donKhongCo = bb(2, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(1, ChronoUnit.DAYS), 1).build();
            when(bienBanTraHangService.dsChoCong(anyCollection())).thenReturn(List.of(coDon, donKhongCo));

            CongNcc.ViecCanLam kq = service.viecCanLam(phien);

            CongNcc.NguoiPhuTrach ha = new CongNcc.NguoiPhuTrach("Phạm Thu Hà", "0987654321", "ha@cuahang.vn");
            CongNcc.NguoiPhuTrach min = new CongNcc.NguoiPhuTrach("Trần Mua", "0912345678", "mua@cuahang.vn");
            assertEquals(java.util.Arrays.asList(ha, min, null),
                    kq.donChoBaoGia().stream().map(CongNcc.DonChoBaoGia::nguoiPhuTrach).toList());
            assertEquals(ha, kq.bienBanCho().get(0).nguoiPhuTrach(), "biên bản: người tạo đơn mua của biên bản");
            assertNull(kq.bienBanCho().get(1).nguoiPhuTrach(), "không tìm thấy đơn của biên bản: bỏ trống");
            assertEquals(ha, kq.nguoiPhuTrach(), "trường chung giữ cách cũ (đơn gửi gần nhất) cho giao diện cũ");
        }

        @Test
        void soLieu30Ngay_baoGiaTrong30Ngay_hangLoiKhongTinhBienBanHuy() {
            Instant trong = BAY_GIO.minus(29, ChronoUnit.DAYS);
            Instant ngoai = BAY_GIO.minus(31, ChronoUnit.DAYS);
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(
                    don(21, nccA, 2, trong, trong),          // đã báo giá, chờ kết quả
                    don(22, nccA, 3, trong, trong),          // được chấp nhận
                    don(23, nccB, 5, trong, BAY_GIO),        // nhận đủ: được chấp nhận
                    don(24, nccA, 6, trong, trong),          // đã đóng: được chấp nhận
                    don(25, nccA, 4, trong, trong),          // không chấp nhận
                    don(26, nccA, 7, trong, trong),          // đã hủy
                    don(27, nccA, 3, ngoai, ngoai),          // báo giá quá 30 ngày
                    don(28, nccA, 2, trong, null)));         // chưa báo giá
            when(bienBanTraHangService.dsChoCong(anyCollection())).thenReturn(List.of(
                    bb(31, BienBanTraHangNcc.PA_TRU_CONG_NO, trong, 3).tienTruTien(new BigDecimal("300000")).build(),
                    bb(32, BienBanTraHangNcc.PA_DOI_HANG, trong, 5).build(),
                    // trừ tiền đã áp cho một phần dòng, các dòng còn lại về chờ chọn lại: vẫn cộng số đã trừ
                    bb(37, BienBanTraHangNcc.PA_CHO_CHOT, trong, 1).tienTruTien(new BigDecimal("50000")).build(),
                    bb(33, BienBanTraHangNcc.PA_TRU_CONG_NO, trong, 7).tienTruTien(new BigDecimal("700000"))
                            .trangThai(BienBanTraHangNcc.DA_HUY).build(),
                    bb(34, BienBanTraHangNcc.PA_TRU_CONG_NO, ngoai, 11).tienTruTien(new BigDecimal("1100000")).build(),
                    bb(35, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO, 2).tienTruTien(null).build(),
                    // trừ tiền đã chọn nhưng chưa áp vào đơn: cộng giá trị hàng lỗi dự kiến
                    bb(36, BienBanTraHangNcc.PA_TRU_CONG_NO, trong, 1).tienTruTien(BigDecimal.ZERO).build()));

            CongNcc.SoLieu30Ngay s = service.viecCanLam(phien).soLieu30Ngay();

            assertEquals(6, s.baoGiaDaGui());
            assertEquals(3, s.duocChapNhan());
            assertEquals(3 + 5 + 2 + 1 + 1, s.sanPhamLoi());
            assertEquals(0, new BigDecimal("450000").compareTo(s.tienTru()),
                    "chỉ cộng tiền đã / sẽ trừ: 300.000 + dự kiến 100.000 + đã trừ một phần 50.000");
        }
    }

    // ── Đơn mua, báo giá ──────────────────────────────────────────────────

    @Nested
    class DonVaBaoGia {

        private String phien;

        @BeforeEach
        void moPhien() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            phien = CongNhaCungCapServiceTest.this.moPhien(EMAIL);
        }

        @Test
        void xemDon_truyenNhaCungCapCuaPhien_kemCuaHang() {
            DonMuaHangCongNccDto dto = DonMuaHangCongNccDto.builder().id(101).build();
            when(donMuaHangService.layDonChoCong(101, Set.of(5, 6))).thenReturn(dto);
            CongNhaCungCapService.DonMuaCong kq = service.layDonMua(phien, 101);
            assertSame(dto, kq.donMua());
            assertEquals("Thời trang Linh Lan", kq.cuaHang().getTen());
        }

        @Test
        void xemDonCuaNhaCungCapKhac_404() {
            when(donMuaHangService.layDonChoCong(eq(777), anyCollection()))
                    .thenThrow(new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                            com.dev.backend.i18n.ThongDiep.of("sanPhamMuaHang.congDonKhongTimThay")));
            LoiCoMaException e = loiMa(MaLoi.KHONG_TIM_THAY, () -> service.layDonMua(phien, 777));
            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        }

        @Test
        void baoGia_kiemDonThuocPhienTruoc_roiGuiVoiEmailPhien() {
            DonMuaHangBaoGia body = DonMuaHangBaoGia.builder().id(101).build();
            BaoGiaDaNhanDto daNhan = BaoGiaDaNhanDto.builder().tongTien(BigDecimal.TEN).build();
            when(donMuaHangService.baoGiaTuCong(101, EMAIL, body)).thenReturn(daNhan);
            assertSame(daNhan, service.baoGia(phien, 101, body));
            var thuTu = inOrder(donMuaHangService);
            thuTu.verify(donMuaHangService).layDonChoCong(101, Set.of(5, 6));
            thuTu.verify(donMuaHangService).baoGiaTuCong(101, EMAIL, body);
        }

        @Test
        void baoGiaDonCuaNhaCungCapKhac_404_khongGhiGi() {
            when(donMuaHangService.layDonChoCong(eq(777), anyCollection()))
                    .thenThrow(new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                            com.dev.backend.i18n.ThongDiep.of("sanPhamMuaHang.congDonKhongTimThay")));
            loiMa(MaLoi.KHONG_TIM_THAY, () -> service.baoGia(phien, 777, DonMuaHangBaoGia.builder().id(777).build()));
            verify(donMuaHangService, never()).baoGiaTuCong(any(), any(), any());
        }

        @Test
        void baoGiaPhienHetHan_403_khongGoiService() {
            dongHo.tua(Duration.ofMinutes(CongNhaCungCapService.PHIEN_PHUT));
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.baoGia(phien, 101, DonMuaHangBaoGia.builder().id(101).build()));
            verifyNoInteractions(donMuaHangService);
        }
    }

    // ── Biên bản trả hàng ─────────────────────────────────────────────────

    @Nested
    class BienBan {

        private static final Instant HAN = Instant.parse("2026-11-30T16:59:59Z");
        private String phien;

        @BeforeEach
        void moPhien() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            phien = CongNhaCungCapServiceTest.this.moPhien(EMAIL);
        }

        private BienBanTraHangDto.BienBanTraHangDtoBuilder chiTiet(String phuongAn) {
            return bb(12, phuongAn, BAY_GIO.minus(2, ChronoUnit.DAYS), 4).donMuaHangId(101).phieuDaNhap(false)
                    .giaTriLoi(new BigDecimal("1820000")).hanTraLoi(HAN)
                    .cachXuLyHang(BienBanTraHangNcc.GIU_KHO).nguoiLienHeNcc("Trần Thị Thu Hà")
                    .choNccChonHangLoi(true)
                    .cachBuMo(List.of("DOI_HANG", "TRU_CONG_NO")).hangLoiMo(List.of("NHAN_LAI", "TIEU_HUY"))
                    .theoBienThe(List.of(
                            BienBanTraHangDto.TheoBienTheDto.builder().bienTheSanPhamId(901).donGia(new BigDecimal("500000")).build(),
                            BienBanTraHangDto.TheoBienTheDto.builder().bienTheSanPhamId(902).donGia(new BigDecimal("410000")).build()))
                    .items(List.of(
                            BienBanTraHangDto.ChiTietItemDto.builder().bienTheSanPhamId(901).tenBienThe("Áo sơ mi").mauSac("Trắng")
                                    .kichCo("M").sku("AO-TR-M").maLo("LO1").lyDo("Rách").soLuong(2).build(),
                            BienBanTraHangDto.ChiTietItemDto.builder().bienTheSanPhamId(902).tenBienThe("Áo sơ mi").mauSac("Trắng")
                                    .kichCo("L").sku("AO-TR-L").maLo("LO2").lyDo("Bẩn").soLuong(2).build()));
        }

        /** Nhà cung cấp đã trả lời cả hai việc trên cổng (Hà, lúc BAY_GIO). */
        private BienBanTraHangDto daTraLoi(String phuongAn, String hangLoi) {
            return chiTiet(phuongAn).nguonChot(NhatKyTraHangNcc.NGUON_CONG_NCC).nguoiXacNhanNcc("Hà")
                    .thoiDiemChot(BAY_GIO).ghiChuChot("ok").choNccChonCachBu(false)
                    .hangLoiNcc(hangLoi).nguoiChonHangLoi("Hà").thoiDiemChonHangLoi(BAY_GIO.plusSeconds(1))
                    .ghiChuChonHangLoi("tiêu hủy giúp").choNccChonHangLoi(false).build();
        }

        @Test
        void xemBienBan_choXacNhanHaiViec_luaChonMo_han_tinhGiaTriTheoDonGiaDon() {
            when(bienBanTraHangService.chiTietChoCong(12, Set.of(5, 6))).thenReturn(chiTiet(BienBanTraHangNcc.PA_CHO_CHOT).build());
            DonMuaHang don = don(101, nccA, 3, BAY_GIO, BAY_GIO);
            when(donMuaHangRepository.findById(101)).thenReturn(Optional.of(don));

            CongNcc.BienBan kq = service.bienBan(phien, 12);

            assertEquals("CHO_XAC_NHAN", kq.trangThai());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), kq.cachBuMo());
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), kq.hangLoiMo());
            assertEquals(HAN, kq.hanTraLoi());
            assertEquals(7012, kq.phienBan(), "phiên bản = id nhật ký lập cuối");
            assertNull(kq.cachBuDaChon());
            assertNull(kq.hangLoiDaChon());
            assertNull(kq.tienTru());
            assertEquals(0, kq.soLuongTruTien());
            assertFalse(kq.buXong());
            assertFalse(kq.phieuDaNhap());
            assertEquals(0, kq.conChoGiao());
            assertEquals(2, kq.dong().size());
            assertEquals(new BigDecimal("1000000"), kq.dong().get(0).giaTri());
            assertEquals(4, kq.tongSoLuong());
            assertEquals(0, new BigDecimal("1820000").compareTo(kq.tongGiaTri()));
            assertEquals("12 Lý Thường Kiệt, Hà Nội", kq.diaChiKho());
            assertEquals("Trần Mua", kq.nguoiPhuTrach().hoTen());
            assertEquals("Trần Thị Thu Hà", kq.nguoiLienHeNcc());
            assertEquals(new CongNcc.HangLoi("O_KHO", "GIU_KHO", null, null, null), kq.hangLoi());
        }

        @Test
        void xemBienBan_daTraLoiHaiViec_luaChonDangApDung_tienTruDuKienRoiTienThat() {
            BienBanTraHangDto dto = daTraLoi(BienBanTraHangNcc.PA_TRU_CONG_NO, BienBanTraHangNcc.HL_TIEU_HUY);
            when(bienBanTraHangService.chiTietChoCong(eq(12), anyCollection())).thenReturn(dto);

            CongNcc.BienBan kq = service.bienBan(phien, 12);
            assertEquals("DA_XAC_NHAN", kq.trangThai());
            assertEquals(new CongNcc.LuaChon("TRU_CONG_NO", "CONG_NCC", "Hà", BAY_GIO, "ok"), kq.cachBuDaChon());
            assertEquals(new CongNcc.LuaChon("TIEU_HUY", "CONG_NCC", "Hà", BAY_GIO.plusSeconds(1), "tiêu hủy giúp"),
                    kq.hangLoiDaChon());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), kq.cachBuMo(), "chưa nhập kho: còn đổi được (máy chủ tính)");
            assertEquals(0, new BigDecimal("1820000").compareTo(kq.tienTru()), "chưa áp vào đơn: tiền trừ dự kiến = giá trị lỗi");

            dto.setPhieuDaNhap(true);
            dto.setTienTruTien(new BigDecimal("1000000"));
            dto.setSoLuongTruTien(2);
            dto.setCachBuMo(List.of());
            dto.setHangLoiMo(null);
            kq = service.bienBan(phien, 12);
            assertTrue(kq.phieuDaNhap());
            assertEquals(List.of(), kq.cachBuMo(), "trừ tiền sau nhập kho: chốt cuối");
            assertEquals(List.of(), kq.hangLoiMo(), "null từ máy chủ thành danh sách rỗng");
            assertEquals(new BigDecimal("1000000"), kq.tienTru(), "đã áp vào đơn: tiền trừ thật");
            assertEquals(2, kq.soLuongTruTien());

            // Quá hạn tự chuyển trừ tiền: nguồn hệ thống, không có người xác nhận
            dto.setNguonChot(NhatKyTraHangNcc.NGUON_TU_DONG);
            dto.setNguoiXacNhanNcc(null);
            dto.setGhiChuChot(null);
            assertEquals(new CongNcc.LuaChon("TRU_CONG_NO", "TU_DONG", null, BAY_GIO, null),
                    service.bienBan(phien, 12).cachBuDaChon());

            dto.setTrangThai(BienBanTraHangNcc.DA_HUY);
            assertEquals("DA_HUY", service.bienBan(phien, 12).trangThai());
        }

        @Test
        void conMotViec_hangLoiChuaChon_vanChoXacNhan_coCachBuDaChon() {
            BienBanTraHangDto dto = chiTiet(BienBanTraHangNcc.PA_DOI_HANG).nguonChot(NhatKyTraHangNcc.NGUON_CONG_NCC)
                    .nguoiXacNhanNcc("Hà").thoiDiemChot(BAY_GIO).choNccChonCachBu(false).choNccChonHangLoi(true).build();
            when(bienBanTraHangService.chiTietChoCong(eq(12), anyCollection())).thenReturn(dto);
            CongNcc.BienBan kq = service.bienBan(phien, 12);
            assertEquals("CHO_XAC_NHAN", kq.trangThai());
            assertEquals("DOI_HANG", kq.cachBuDaChon().giaTri());
            assertNull(kq.hangLoiDaChon());

            // Cách bù còn chờ (không có nguồn) nhưng hàng lỗi đã chọn
            BienBanTraHangDto choBu = chiTiet(BienBanTraHangNcc.PA_CHO_CHOT).hangLoiNcc(BienBanTraHangNcc.HL_NHAN_LAI)
                    .nguoiChonHangLoi("Lan").choNccChonHangLoi(false).build();
            when(bienBanTraHangService.chiTietChoCong(eq(12), anyCollection())).thenReturn(choBu);
            kq = service.bienBan(phien, 12);
            assertEquals("CHO_XAC_NHAN", kq.trangThai());
            assertNull(kq.cachBuDaChon());
            assertEquals("NHAN_LAI", kq.hangLoiDaChon().giaTri());
            assertEquals("CONG_NCC", kq.hangLoiDaChon().nguon());
        }

        @Test
        void choXacNhanTheoCoCuaMayChu_khongTuSuyTuPhuongAn() {
            // Đơn đã đóng: máy chủ đã tắt cờ chờ cách bù, hàng lỗi đã rời kho → không còn gì phải trả lời
            BienBanTraHangDto dto = chiTiet(BienBanTraHangNcc.PA_CHO_CHOT).trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_DONG)
                    .choNccChonCachBu(false).choNccChonHangLoi(false).cachBuMo(List.of()).hangLoiMo(List.of())
                    .trangThaiHang(BienBanTraHangNcc.HANG_DA_TRA).build();
            when(bienBanTraHangService.chiTietChoCong(eq(12), anyCollection())).thenReturn(dto);
            CongNcc.BienBan kq = service.bienBan(phien, 12);
            assertEquals("DA_XAC_NHAN", kq.trangThai());
            assertTrue(kq.cachBuMo().isEmpty() && kq.hangLoiMo().isEmpty());
        }

        @Test
        void giaoBu_buXongVaConChoGiao() {
            BienBanTraHangDto dto = chiTiet(BienBanTraHangNcc.PA_DOI_HANG).nguonChot(NhatKyTraHangNcc.NGUON_CONG_NCC)
                    .phieuDaNhap(true)
                    .theoBienThe(List.of(
                            BienBanTraHangDto.TheoBienTheDto.builder().bienTheSanPhamId(901).soLuongLoi(2)
                                    .conThieuDongDon(new BigDecimal("1")).build(),
                            BienBanTraHangDto.TheoBienTheDto.builder().bienTheSanPhamId(902).soLuongLoi(2).build()))
                    .build();
            when(bienBanTraHangService.chiTietChoCong(eq(12), anyCollection())).thenReturn(dto);
            CongNcc.BienBan kq = service.bienBan(phien, 12);
            assertEquals(1 + 2, kq.conChoGiao());
            assertFalse(kq.buXong());
            assertNull(kq.tienTru());
            assertEquals(0, kq.soLuongTruTien(), "giao bù: không có số trừ tiền");
            dto.setBuXong(true);
            kq = service.bienBan(phien, 12);
            assertTrue(kq.buXong());
            assertEquals(0, kq.conChoGiao());
        }

        @Test
        void xemBienBanCuaNhaCungCapKhac_404() {
            when(bienBanTraHangService.chiTietChoCong(eq(99), anyCollection()))
                    .thenThrow(new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                            com.dev.backend.i18n.ThongDiep.of("chungTuKho.congBienBanKhongTimThay")));
            loiMa(MaLoi.KHONG_TIM_THAY, () -> service.bienBan(phien, 99));
            verify(bienBanTraHangService).chiTietChoCong(99, Set.of(5, 6));
        }

        @Test
        void traLoiBienBan_truyenNhaCungCapCuaPhien_haiCauTraLoi_phienBan() {
            // Cách gửi cũ (một lựa chọn cho mọi dòng): không có lựa chọn từng dòng, không có cam kết
            when(bienBanTraHangService.traLoiTuCong(12, Set.of(5, 6), 7012, null, "DOI_HANG", "NHAN_LAI", "Hà",
                    "giao tuần sau", false))
                    .thenReturn(daTraLoi(BienBanTraHangNcc.PA_DOI_HANG, BienBanTraHangNcc.HL_NHAN_LAI));
            CongNcc.BienBan kq = service.traLoiBienBan(phien, 12,
                    new CongNccRequest.TraLoiBienBan("DOI_HANG", "NHAN_LAI", "Hà", "giao tuần sau", 7012));
            assertEquals("DOI_HANG", kq.phuongAn());
            assertEquals("DA_XAC_NHAN", kq.trangThai());
            assertEquals("NHAN_LAI", kq.hangLoiDaChon().giaTri());
            assertEquals(7012, kq.phienBan());
            assertNull(kq.tienTru(), "giao bù: không trừ tiền");

            // Chỉ đổi hàng lỗi: cách bù gửi null (giữ nguyên), không gửi phiên bản
            when(bienBanTraHangService.traLoiTuCong(12, Set.of(5, 6), null, null, null, "TIEU_HUY", "Hà", null, false))
                    .thenReturn(daTraLoi(BienBanTraHangNcc.PA_DOI_HANG, BienBanTraHangNcc.HL_TIEU_HUY));
            assertEquals("TIEU_HUY", service.traLoiBienBan(phien, 12,
                    new CongNccRequest.TraLoiBienBan(null, "TIEU_HUY", "Hà", null, null)).hangLoiDaChon().giaTri());
        }

        @Test
        void traLoiBienBan_theoTungDong_camKet_dongLoiCoLuaChonRieng_tienTruVaChoGiaoTheoDong() {
            BienBanTraHangDto ketQua = chiTiet(BienBanTraHangNcc.PA_HON_HOP).nguonChot(NhatKyTraHangNcc.NGUON_CONG_NCC)
                    .nguoiXacNhanNcc("Hà").thoiDiemChot(BAY_GIO).choNccChonCachBu(false).choNccChonHangLoi(false)
                    .giaTriTruTien(new BigDecimal("1000000")).soLuongChoHangBu(2)
                    .items(List.of(
                            BienBanTraHangDto.ChiTietItemDto.builder().id(301).bienTheSanPhamId(901).tenBienThe("Áo sơ mi")
                                    .mauSac("Trắng").kichCo("M").sku("AO-TR-M").maLo("LO1").lyDo("Rách").soLuong(2)
                                    .donGia(new BigDecimal("500000")).cachBu("TRU_CONG_NO").nguonCachBu("CONG_NCC")
                                    .cachBuMo(List.of("DOI_HANG", "TRU_CONG_NO")).buXong(false).hangLoiNcc("NHAN_LAI")
                                    .trangThaiHang("O_KHO").hangLoiMo(List.of("NHAN_LAI", "TIEU_HUY")).build(),
                            BienBanTraHangDto.ChiTietItemDto.builder().id(302).bienTheSanPhamId(902).tenBienThe("Áo sơ mi")
                                    .mauSac("Trắng").kichCo("L").sku("AO-TR-L").maLo("LO2").lyDo("Bẩn").soLuong(2)
                                    .cachBu("DOI_HANG").nguonCachBu("CONG_NCC").cachBuMo(List.of("DOI_HANG", "TRU_CONG_NO"))
                                    .buXong(false).hangLoiNcc("TIEU_HUY").trangThaiHang("DA_TIEU_HUY").hangLoiMo(List.of())
                                    .nguoiNhanHang("Hà").thoiDiemRoiKho(BAY_GIO).build()))
                    .build();
            List<BienBanTraHangService.LuaChonDong> theoDong = List.of(
                    new BienBanTraHangService.LuaChonDong(301, "TRU_CONG_NO", "NHAN_LAI"),
                    new BienBanTraHangService.LuaChonDong(302, "DOI_HANG", null));
            when(bienBanTraHangService.traLoiTuCong(12, Set.of(5, 6), 7012, theoDong, null, null, "Hà", null, true))
                    .thenReturn(ketQua);

            CongNcc.BienBan kq = service.traLoiBienBan(phien, 12, new CongNccRequest.TraLoiBienBan(null, null, "Hà", null,
                    7012, List.of(new CongNccRequest.TraLoiDong(301, "TRU_CONG_NO", "NHAN_LAI"),
                    new CongNccRequest.TraLoiDong(302, "DOI_HANG", null)), true));

            assertEquals("HON_HOP", kq.phuongAn());
            assertEquals(2, kq.dong().size());
            CongNcc.DongLoi tru = kq.dong().get(0);
            assertEquals(301, tru.id());
            assertEquals("TRU_CONG_NO", tru.cachBu());
            assertEquals("CONG_NCC", tru.nguonCachBu());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), tru.cachBuMo());
            assertEquals("NHAN_LAI", tru.hangLoi());
            assertEquals("O_KHO", tru.viTriHang());
            assertEquals(0, new BigDecimal("1000000").compareTo(tru.giaTri()), "đơn giá của dòng × số lượng");
            CongNcc.DongLoi bu = kq.dong().get(1);
            assertEquals(302, bu.id());
            assertEquals("DOI_HANG", bu.cachBu());
            assertEquals("DA_TIEU_HUY", bu.viTriHang());
            assertEquals(List.of(), bu.hangLoiMo(), "đã tiêu hủy: không đổi được");
            assertEquals("Hà", bu.nguoiNhanHang());
            assertEquals(BAY_GIO, bu.thoiDiemRoiKho());
            assertEquals(0, new BigDecimal("820000").compareTo(bu.giaTri()), "dòng thiếu đơn giá: lấy đơn giá theo biến thể");
            assertEquals(0, new BigDecimal("1000000").compareTo(kq.tienTru()), "hỗn hợp chưa nhập kho: giá trị các dòng trừ tiền");
            assertEquals(2, kq.conChoGiao(), "số chờ hàng bù tính theo các dòng giao bù");
            verify(bienBanTraHangService).traLoiTuCong(12, Set.of(5, 6), 7012, theoDong, null, null, "Hà", null, true);
        }

        @Test
        void traLoiPhienHetHan_403_khongGoiService() {
            GlobalCache.PHIEN_CONG_NCC.clear();
            loiMa(MaLoi.PHIEN_HET_HAN, () -> service.traLoiBienBan(phien, 12,
                    new CongNccRequest.TraLoiBienBan("DOI_HANG", "NHAN_LAI", "Hà", null, 7012)));
            verifyNoInteractions(bienBanTraHangService);
        }
    }

    /**
     * Phần 404 nằm ở BienBanTraHangServiceImpl (lọc theo nhà cung cấp của phiên): dựng service thật với repository giả,
     * chỉ đi tới bước kiểm quyền.
     */
    @Nested
    class BienBanNhaCungCapKhacTrenServiceThat {

        @Mock
        private BienBanTraHangNccRepository bienBanRepo;

        private BienBanTraHangServiceImpl that() {
            return new BienBanTraHangServiceImpl(bienBanRepo, mock(ChiTietTraHangNccRepository.class),
                    mock(PhieuNhapKhoRepository.class), mock(NguoiDungRepository.class), mock(ChiTietPhieuNhapKhoRepository.class),
                    mock(ChiTietLoiLoHangRepository.class), mock(ChiTietDonMuaHangRepository.class), mock(NhatKyTraHangNcc.class));
        }

        private BienBanTraHangNcc bienBanCua(NhaCungCap ncc, DonMuaHang don) {
            BienBanTraHangNcc b = mock(BienBanTraHangNcc.class);
            PhieuNhapKho phieu = mock(PhieuNhapKho.class);
            lenient().when(b.getNhaCungCap()).thenReturn(ncc);
            lenient().when(b.getPhieuNhapKho()).thenReturn(phieu);
            lenient().when(phieu.getDonMuaHang()).thenReturn(don);
            return b;
        }

        @Test
        void bienBanCuaNhaCungCapKhac_hoacKhongCo_hoacKhongGanDon_404CungMotCau() {
            BienBanTraHangServiceImpl that = that();
            BienBanTraHangNcc cuaNccKhac = bienBanCua(nccKhac, don(1, nccKhac, 3, BAY_GIO, BAY_GIO));
            BienBanTraHangNcc khongGanDon = bienBanCua(nccA, null);
            when(bienBanRepo.findById(40)).thenReturn(Optional.of(cuaNccKhac));
            when(bienBanRepo.findById(41)).thenReturn(Optional.empty());
            when(bienBanRepo.findById(42)).thenReturn(Optional.of(khongGanDon));
            Collection<Integer> ids = Set.of(5, 6);

            LoiCoMaException khac = loiMa(MaLoi.KHONG_TIM_THAY, () -> that.chiTietChoCong(40, ids));
            assertEquals(HttpStatus.NOT_FOUND, khac.getStatus());
            LoiCoMaException khongCo = loiMa(MaLoi.KHONG_TIM_THAY, () -> that.chiTietChoCong(41, ids));
            LoiCoMaException khongDon = loiMa(MaLoi.KHONG_TIM_THAY, () -> that.chiTietChoCong(42, ids));
            loiMa(MaLoi.KHONG_TIM_THAY, () -> that.chiTietChoCong(null, ids));
            assertEquals(khac.getMessage(), khongCo.getMessage(), "không lộ biên bản nào tồn tại");
            assertEquals(khac.getMessage(), khongDon.getMessage());
        }

        @Test
        void traLoiBienBanCuaNhaCungCapKhac_404_khongGhiGi() {
            BienBanTraHangServiceImpl that = that();
            BienBanTraHangNcc cuaNccKhac = bienBanCua(nccKhac, don(1, nccKhac, 3, BAY_GIO, BAY_GIO));
            when(bienBanRepo.findById(40)).thenReturn(Optional.of(cuaNccKhac));
            loiMa(MaLoi.KHONG_TIM_THAY, () -> that.traLoiTuCong(40, Set.of(5, 6), null, "TRU_CONG_NO", "NHAN_LAI", "Hà", null));
            verify(bienBanRepo, never()).save(any());
        }
    }

    // ── Lịch sử báo giá ───────────────────────────────────────────────────

    @Nested
    class LichSuBaoGia {

        private String phien;

        @BeforeEach
        void moPhien() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            phien = CongNhaCungCapServiceTest.this.moPhien(EMAIL);
        }

        @Test
        void ketQuaTheoTrangThai() {
            assertEquals("CHO_BAO_GIA", CongNhaCungCapService.ketQuaBaoGia(don(1, nccA, 2, BAY_GIO, null)));
            assertEquals("CHO_KET_QUA", CongNhaCungCapService.ketQuaBaoGia(don(1, nccA, 2, BAY_GIO, BAY_GIO)));
            for (int tt : new int[]{3, 5, 6}) {
                assertEquals("DUOC_CHAP_NHAN", CongNhaCungCapService.ketQuaBaoGia(don(1, nccA, tt, BAY_GIO, BAY_GIO)), "tt " + tt);
            }
            assertEquals("KHONG_CHAP_NHAN", CongNhaCungCapService.ketQuaBaoGia(don(1, nccA, 4, BAY_GIO, BAY_GIO)));
            assertEquals("DA_HUY", CongNhaCungCapService.ketQuaBaoGia(don(1, nccA, 7, BAY_GIO, BAY_GIO)));
        }

        @Test
        void danhSach_ketQua_tongTienChiKhiDaBaoGia_tomTat() {
            Instant t = BAY_GIO.minus(10, ChronoUnit.DAYS);
            when(donMuaHangRepository.choCongNhaCungCap(Set.of(5, 6))).thenReturn(List.of(
                    don(1, nccA, 2, t, null, dong(1, "1"), dong(2, "1")),
                    don(2, nccB, 2, t, t),
                    don(3, nccA, 3, t, t),
                    don(4, nccA, 5, t, t),
                    don(5, nccB, 6, t, t),
                    don(6, nccA, 4, t, t),
                    don(7, nccA, 7, t, t)));

            CongNcc.LichSuBaoGia kq = service.lichSuBaoGia(phien, null, null, null);

            assertEquals(List.of("CHO_BAO_GIA", "CHO_KET_QUA", "DUOC_CHAP_NHAN", "DUOC_CHAP_NHAN", "DUOC_CHAP_NHAN",
                    "KHONG_CHAP_NHAN", "DA_HUY"), kq.items().stream().map(CongNcc.DongBaoGia::ketQua).toList());
            CongNcc.DongBaoGia chua = kq.items().get(0);
            assertNull(chua.tongTien(), "chưa báo giá: không hiện tổng tiền");
            assertNull(chua.ngayBaoGia());
            assertEquals(2, chua.soMatHang());
            assertEquals(t, chua.ngayYeuCau());
            assertEquals(new BigDecimal("1500000"), kq.items().get(1).tongTien());
            assertEquals(new CongNcc.TomTatBaoGia(6, 3, 1, 1), kq.tomTat());
        }

        @Test
        void khongChonNgay_layMoiThoiGian_keCaDonKhongCoNgay() {
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(
                    don(1, nccA, 2, Instant.parse("2023-03-01T03:00:00Z"), null),   // hơn 3 năm trước
                    don(2, nccA, 2, BAY_GIO, null),
                    don(3, nccA, 2, null, null)));

            assertEquals(List.of(1, 2, 3), ids(service.lichSuBaoGia(phien, null, null, null)),
                    "không giới hạn 12 tháng; đơn không có ngày yêu cầu vẫn hiện");
        }

        @Test
        void tuNgayDenNgay_theoNgayVietNam_baoGomCaHaiDau() {
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(
                    don(1, nccA, 4, Instant.parse("2026-10-31T17:00:00Z"), null),   // 00:00 01/11 VN: đầu khoảng
                    don(2, nccA, 4, Instant.parse("2026-10-31T16:59:59Z"), null),   // 23:59:59 31/10 VN: trước khoảng
                    don(3, nccA, 4, Instant.parse("2026-11-10T16:59:59Z"), null),   // 23:59:59 10/11 VN: cuối khoảng
                    don(4, nccA, 4, Instant.parse("2026-11-10T17:00:00Z"), null),   // 00:00 11/11 VN: sau khoảng
                    don(5, nccA, 4, null, null)));

            LocalDate tu = LocalDate.of(2026, 11, 1), den = LocalDate.of(2026, 11, 10);
            assertEquals(List.of(1, 3), ids(service.lichSuBaoGia(phien, tu, den, null)), "đang lọc: bỏ đơn không có ngày");
            assertEquals(List.of(1, 3, 4), ids(service.lichSuBaoGia(phien, tu, null, null)), "chỉ từ ngày");
            assertEquals(List.of(1, 2, 3), ids(service.lichSuBaoGia(phien, null, den, null)), "chỉ đến ngày");
            assertEquals(List.of(), ids(service.lichSuBaoGia(phien, den, tu, null)), "từ sau đến: không có gì");
        }

        @Test
        void tuKhoa_khongPhanBietHoaThuong_boKhoangTrang() {
            when(donMuaHangRepository.choCongNhaCungCap(anyCollection())).thenReturn(List.of(
                    don(41, nccA, 3, BAY_GIO, BAY_GIO), don(52, nccA, 2, BAY_GIO, null)));
            CongNcc.LichSuBaoGia kq = service.lichSuBaoGia(phien, null, null, "  po2026112341 ");
            assertEquals(List.of(41), kq.items().stream().map(CongNcc.DongBaoGia::id).toList());
            assertEquals(new CongNcc.TomTatBaoGia(1, 1, 0, 0), kq.tomTat(), "tóm tắt theo danh sách đã lọc");
            assertEquals(2, service.lichSuBaoGia(phien, null, null, "   ").items().size());
        }

        private List<Integer> ids(CongNcc.LichSuBaoGia ls) {
            return ls.items().stream().map(CongNcc.DongBaoGia::id).toList();
        }
    }

    // ── Lịch sử trả hàng ──────────────────────────────────────────────────

    @Nested
    class LichSuTraHang {

        private String phien;

        @BeforeEach
        void moPhien() {
            when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(nccA, nccB));
            phien = CongNhaCungCapServiceTest.this.moPhien(EMAIL);
        }

        private static BienBanTraHangDto.TheoBienTheDto bt(int loi, String conThieu) {
            return BienBanTraHangDto.TheoBienTheDto.builder().soLuongLoi(loi)
                    .conThieuDongDon(conThieu == null ? null : new BigDecimal(conThieu)).build();
        }

        @Test
        void tomTatKhongTinhBienBanHuy_tienTruChiKhiTruCongNo_conChoGiao() {
            Instant t = BAY_GIO.minus(5, ChronoUnit.DAYS);
            when(bienBanTraHangService.dsChoCong(Set.of(5, 6))).thenReturn(List.of(
                    bb(1, BienBanTraHangNcc.PA_TRU_CONG_NO, t, 3).tienTruTien(new BigDecimal("300000")).build(),
                    bb(2, BienBanTraHangNcc.PA_DOI_HANG, t, 5)
                            .theoBienThe(List.of(bt(3, "1"), bt(2, null), bt(4, "0"))).build(),
                    bb(3, BienBanTraHangNcc.PA_DOI_HANG, t, 2).buXong(true).theoBienThe(List.of(bt(2, "2"))).build(),
                    bb(4, BienBanTraHangNcc.PA_CHO_CHOT, t, 4).build(),
                    bb(5, BienBanTraHangNcc.PA_TRU_CONG_NO, t, 7).tienTruTien(new BigDecimal("700000"))
                            .trangThai(BienBanTraHangNcc.DA_HUY).build(),
                    bb(6, BienBanTraHangNcc.PA_CHO_CHOT, t, 1).trangThaiDonMua(DonMuaHangService.TRANG_THAI_DA_DONG)
                            .choNccChonCachBu(false).build(),
                    bb(7, BienBanTraHangNcc.PA_TRU_CONG_NO, t, 2).tienTruTien(BigDecimal.ZERO)
                            .choNccChonHangLoi(true).build()));

            CongNcc.LichSuTraHang kq = service.lichSuTraHang(phien, null, null, null);

            assertEquals(7, kq.items().size(), "biên bản hủy vẫn hiện trong danh sách");
            assertTrue(kq.items().get(4).daHuy());
            assertNull(kq.items().get(4).tienTru(), "biên bản hủy: không hiện tiền trừ");
            assertEquals(new BigDecimal("200000"), kq.items().get(6).tienTru(), "trừ tiền chưa áp: giá trị hàng lỗi dự kiến");
            assertFalse(kq.items().get(0).daHuy());
            assertEquals(new BigDecimal("300000"), kq.items().get(0).tienTru());
            assertNull(kq.items().get(1).tienTru(), "giao bù: không hiện tiền trừ");
            assertNull(kq.items().get(3).tienTru());
            assertEquals(1 + 2 + 0, kq.items().get(1).conChoGiao(), "min(lỗi, còn thiếu) từng biến thể; thiếu số còn thiếu thì lấy số lỗi");
            assertEquals(0, kq.items().get(2).conChoGiao(), "đã bù xong");
            assertTrue(kq.items().get(2).buXong());
            assertEquals(0, kq.items().get(0).conChoGiao());
            assertEquals("O_KHO", kq.items().get(0).hangLoi());
            assertTrue(kq.items().get(3).choTraLoi(), "chờ chọn cách bù");
            assertTrue(kq.items().get(6).choTraLoi(), "đã trừ tiền nhưng hàng lỗi chưa chọn");
            assertFalse(kq.items().get(5).choTraLoi(), "đơn đã đóng: không còn hỏi");
            assertFalse(kq.items().get(0).choTraLoi());
            assertEquals(new CongNcc.TomTatTraHang(6, 3 + 5 + 2 + 4 + 1 + 2, new BigDecimal("500000"), 2), kq.tomTat());

            // Biên bản hủy dù máy chủ còn cờ chờ: không tính là chờ trả lời
            when(bienBanTraHangService.dsChoCong(Set.of(5, 6))).thenReturn(List.of(
                    bb(9, BienBanTraHangNcc.PA_CHO_CHOT, t, 1).trangThai(BienBanTraHangNcc.DA_HUY).build(),
                    bb(10, BienBanTraHangNcc.PA_DOI_HANG, t, 1).hangLoiNcc(BienBanTraHangNcc.HL_TIEU_HUY).build()));
            kq = service.lichSuTraHang(phien, null, null, null);
            assertFalse(kq.items().get(0).choTraLoi());
            assertEquals("TIEU_HUY", kq.items().get(1).hangLoiNcc());
            assertEquals(0, kq.tomTat().choChon());
        }

        @Test
        void locTuNgay_vaTuKhoaTheoSoBienBanSoDonSoPhieu() {
            when(bienBanTraHangService.dsChoCong(anyCollection())).thenReturn(List.of(
                    bb(1, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(30, ChronoUnit.DAYS), 1).soBienBan("RTV-A").soDonMua("PO-X")
                            .soPhieuNhap("PN-1").build(),
                    bb(2, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(200, ChronoUnit.DAYS), 1).soBienBan("RTV-B").build(),
                    bb(3, BienBanTraHangNcc.PA_CHO_CHOT, BAY_GIO.minus(2, ChronoUnit.DAYS), 1).soBienBan("RTV-C").soDonMua("PO-Y")
                            .soPhieuNhap("PN-2").build()));

            assertEquals(List.of(1, 2, 3), ids(service.lichSuTraHang(phien, null, null, null)), "mặc định mọi thời gian");
            assertEquals(List.of(1, 3), ids(service.lichSuTraHang(phien, LocalDate.of(2026, 9, 1), null, null)));
            assertEquals(List.of(2), ids(service.lichSuTraHang(phien, null, LocalDate.of(2026, 6, 1), null)));
            assertEquals(List.of(3), ids(service.lichSuTraHang(phien, null, null, "rtv-c")));
            assertEquals(List.of(1), ids(service.lichSuTraHang(phien, null, null, "po-x")));
            assertEquals(List.of(3), ids(service.lichSuTraHang(phien, null, null, " PN-2 ")));
            assertEquals(new CongNcc.TomTatTraHang(1, 1, BigDecimal.ZERO, 1),
                    service.lichSuTraHang(phien, null, null, "PN-2").tomTat());
        }

        private List<Integer> ids(CongNcc.LichSuTraHang ls) {
            return ls.items().stream().map(CongNcc.DongTraHang::id).toList();
        }
    }
}
