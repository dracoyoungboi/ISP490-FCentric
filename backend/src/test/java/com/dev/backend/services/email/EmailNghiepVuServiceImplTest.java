package com.dev.backend.services.email;

import com.dev.backend.config.EmailTemplateConfig;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.email.*;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.email.DonMuaHangEmailRepository;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Hợp đồng của lớp cài đặt (soát chéo 3.5): không ném lỗi trừ E5, kiểm trạng thái đơn trước khi dựng, không truy vấn
 * CSDL trong request E1, kiểm "còn hiệu lực" trước mỗi lần gửi, E4 ghi ngay_gui_yeu_cau (cắt giây) khi gửi được,
 * không tiêm service gây vòng phụ thuộc, không @Transactional.
 */
class EmailNghiepVuServiceImplTest {

    /** 14:22:00,750 ngày 19/10/2026 giờ Việt Nam (có phần lẻ giây để kiểm cắt giây). */
    private static final Instant BAY_GIO = Instant.parse("2026-10-19T07:22:00.750Z");

    private final EmailDispatcher dispatcher = mock(EmailDispatcher.class);
    private final NguoiDungRepository nguoiDungRepository = mock(NguoiDungRepository.class);
    private final DonMuaHangEmailRepository donRepo = mock(DonMuaHangEmailRepository.class);
    private final EmailNghiepVuServiceImpl service = new EmailNghiepVuServiceImpl(dispatcher,
            new DuongDanEmail("https://fcentric.net"), nguoiDungRepository, donRepo, new PdfBienBanTraHang(),
            Clock.fixed(BAY_GIO, ZoneOffset.UTC));

    @BeforeEach
    @AfterEach
    void donBoNhoMa() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
    }

    private EmailGui moiGuiSauCommit() {
        var cap = org.mockito.ArgumentCaptor.forClass(EmailGui.class);
        verify(dispatcher).guiSauCommit(cap.capture());
        return cap.getValue();
    }

    private static DonMuaHang don(int trangThai, boolean daBaoGia) {
        DonMuaHang d = daBaoGia ? MauEmailFixture.donDaBaoGia(null) : MauEmailFixture.don(false);
        d.setTrangThai(trangThai);
        return d;
    }

    // ---------------- Không ném lỗi (trừ E5) ----------------

    @Test
    void duLieuSai_khongNem_khongGui() {
        List<Consumer<EmailNghiepVuServiceImpl>> goi = List.of(
                s -> s.guiYeuCauBaoGia(null),
                s -> s.guiDaNhanBaoGia(null),
                s -> s.guiXacNhanDatHang(null),
                s -> s.guiKetQuaBaoGia(null),
                s -> s.guiMaDatLaiMatKhau(null, "1", BAY_GIO, BAY_GIO),
                s -> s.guiTaiKhoanMoi(null, "x", BAY_GIO),
                s -> s.guiCapLaiMatKhau(null, "x", BAY_GIO, BAY_GIO),
                s -> s.guiDaDoiMatKhau(null, CachDoiMatKhau.DAT_LAI_BANG_MA, BAY_GIO),
                s -> s.guiDaDoiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), null, BAY_GIO),
                s -> s.guiMaDatLaiMatKhau(MauEmailFixture.nhanSu("nhan_vien_kho"), "1", null, BAY_GIO),
                // sai trạng thái: không "chính thức hóa" dữ liệu sai qua email
                s -> s.guiYeuCauBaoGia(don(3, false)),
                s -> s.guiYeuCauBaoGia(don(2, true)),
                s -> s.guiDaNhanBaoGia(don(2, false)),
                s -> s.guiDaNhanBaoGia(don(4, true)),
                s -> s.guiXacNhanDatHang(don(2, true)),
                s -> s.guiXacNhanDatHang(don(3, false)),
                s -> s.guiKetQuaBaoGia(don(2, true)),
                // thiếu quan hệ
                s -> {
                    DonMuaHang d = don(2, false);
                    d.setChiTietDonMuaHangs(null);
                    s.guiYeuCauBaoGia(d);
                },
                s -> {
                    DonMuaHang d = don(2, false);
                    d.getNhaCungCap().setEmail(" ");
                    s.guiYeuCauBaoGia(d);
                },
                s -> {
                    DonMuaHang d = don(2, false);
                    d.setNhaCungCap(null);
                    s.guiYeuCauBaoGia(d);
                },
                s -> {
                    DonMuaHang d = don(2, false);
                    d.setKhoNhap(null);
                    s.guiYeuCauBaoGia(d);
                },
                s -> {
                    DonMuaHang d = don(3, true);
                    d.getChiTietDonMuaHangs().get(0).setDonGia(null);
                    s.guiXacNhanDatHang(d);
                },
                s -> {
                    DonMuaHang d = don(2, false);
                    d.getChiTietDonMuaHangs().get(0).getBienTheSanPham().setSanPham(null);
                    s.guiYeuCauBaoGia(d);
                });
        for (int i = 0; i < goi.size(); i++) {
            int stt = i;
            assertDoesNotThrow(() -> goi.get(stt).accept(service), "ca " + stt);
        }
        verifyNoInteractions(dispatcher);
    }

    @Test
    void dispatcherNemLoi_cungKhongLanRaNoiGoi() {
        doThrow(new IllegalStateException("hỏng")).when(dispatcher).guiSauCommit(any());
        assertDoesNotThrow(() -> service.guiYeuCauBaoGia(don(2, false)));
        assertDoesNotThrow(() -> service.guiXacNhanDatHang(don(3, true)));
        assertDoesNotThrow(() -> service.guiTaiKhoanMoi(MauEmailFixture.nhanSu("nhan_vien_kho"), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET));
    }

    @Test
    void nguoiDungKhongCoEmail_khongGui() {
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        nd.setEmail(" ");
        service.guiDaDoiMatKhau(nd, CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP, BAY_GIO);
        service.guiMaDatLaiMatKhau(nd, "123456", BAY_GIO, BAY_GIO.plusSeconds(300));
        verifyNoInteractions(dispatcher);
    }

    // ---------------- E5 ----------------

    @Test
    void e5_duLieuSai_nemEmailKhongGuiDuoc_khongGoiDispatcher() {
        assertThrows(EmailKhongGuiDuocException.class, () -> service.guiMaDangNhapCong(null,
                MauEmailFixture.TEN_NCC, "771204", BAY_GIO.plusSeconds(300)));
        assertThrows(EmailKhongGuiDuocException.class, () -> service.guiMaDangNhapCong(" ",
                MauEmailFixture.TEN_NCC, "771204", BAY_GIO.plusSeconds(300)));
        assertThrows(EmailKhongGuiDuocException.class, () -> service.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC,
                MauEmailFixture.TEN_NCC, " ", BAY_GIO.plusSeconds(300)));
        assertThrows(EmailKhongGuiDuocException.class, () -> service.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC,
                MauEmailFixture.TEN_NCC, "771204", null));
        verifyNoInteractions(dispatcher);
    }

    @Test
    void e5_guiNgayDongBo_khongNguoiPhuTrach_loiThiNemNguyen() {
        service.guiMaDangNhapCong(" " + MauEmailFixture.EMAIL_NCC, "  Xưởng May Hoàng Anh ", "771204",
                BAY_GIO.plusSeconds(300));
        var cap = org.mockito.ArgumentCaptor.forClass(EmailGui.class);
        verify(dispatcher).guiNgay(cap.capture());
        verify(dispatcher, never()).guiSauCommit(any());
        EmailGui g = cap.getValue();
        assertEquals(LoaiEmail.E5, g.loai());
        assertEquals(MauEmailFixture.EMAIL_NCC, g.den());
        assertNull(g.nguoiPhuTrach(), "đăng nhập theo email: không có người phụ trách riêng");
        assertEquals("Mã đăng nhập Cổng nhà cung cấp", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        MaDangNhapCongEmail e = (MaDangNhapCongEmail) g.duLieu();
        assertEquals("Xưởng May Hoàng Anh", e.tenNhaCungCap());
        assertEquals(MauEmailFixture.EMAIL_NCC, e.emailNhan());
        assertEquals("5 phút", e.thoiHan());
        assertEquals("14:27 ngày 19/10/2026", e.hetHanLuc());
        assertFalse(e.toString().contains("771204"));
        assertFalse(g.toString().contains("771204"));

        clearInvocations(dispatcher);
        service.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC, "  ", "771204", BAY_GIO.plusSeconds(300));
        verify(dispatcher).guiNgay(cap.capture());
        assertNull(((MaDangNhapCongEmail) cap.getValue().duLieu()).tenNhaCungCap());

        doThrow(new EmailKhongGuiDuocException("x", null)).when(dispatcher).guiNgay(any());
        assertThrows(EmailKhongGuiDuocException.class, () -> service.guiMaDangNhapCong(MauEmailFixture.EMAIL_NCC,
                MauEmailFixture.TEN_NCC, "771204", BAY_GIO.plusSeconds(300)));
    }

    // ---------------- E7, M5, M6 biên bản trả hàng ----------------

    @Test
    void e7_dungDuLieu_guiSauCommit_chuyenNguyenConHieuLucVaKhiGuiDuoc_kemPdf() {
        BooleanSupplier conHieuLuc = () -> true;
        Runnable khiGuiDuoc = () -> { };
        service.guiBienBanTraHang(MauEmailFixture.bienBan(), MauEmailFixture.ban(), "GUI", MauEmailFixture.HAN_TRA_LOI,
                null, conHieuLuc, khiGuiDuoc);
        EmailGui g = moiGuiSauCommit();
        verify(dispatcher, never()).guiNgay(any());
        assertEquals(LoaiEmail.E7, g.loai());
        assertTrue(LoaiEmail.E7.thuLai() && LoaiEmail.E7.nhaCungCap());
        assertEquals(MauEmailFixture.EMAIL_NCC, g.den());
        assertSame(conHieuLuc, g.conHieuLuc());
        assertSame(khiGuiDuoc, g.khiGuiDuoc());
        assertEquals("Phạm Thu Hà", g.nguoiPhuTrach().hoTen(), "người phụ trách = người tạo đơn mua");
        assertEquals("Biên bản trả hàng RTV-20261021-003 – Thời trang Linh Lan",
                g.tieuDe().apply(MauEmailFixture.cuaHang()));
        assertEquals("Biên bản trả hàng RTV-20261021-003", g.tieuDe().apply(CuaHangEmail.TRONG));
        BienBanTraHangEmail e = (BienBanTraHangEmail) g.duLieu();
        assertTrue(e.coGia());
        assertEquals(4, e.soSanPham());
        assertEquals("4 cái", e.tongSoLuong());
        assertEquals("645.000", e.tongGiaTri());
        assertEquals("645.000" + DinhDangEmail.KY_HIEU_DONG, e.tongGiaTriDong());
        assertEquals("PO202610195101", e.maDon());
        assertEquals("PN202610210004", e.soPhieuNhap());
        assertEquals("Kho tổng", e.noiHangLoi());
        assertEquals("Lô B2, KCN Quang Minh, xã Quang Minh, Hà Nội", e.moTaNoiHangLoi());
        assertTrue(e.hangConOKho());
        assertFalse(e.daTra());
        assertFalse(e.capNhat());
        assertFalse(e.nhac());
        assertEquals("28/10/2026", e.hanTraLoi(), "hạn theo giờ Việt Nam");
        assertTrue(e.choCachBu(), "lấy từ bản DTO: nhà cung cấp còn phải chọn cách bù");
        assertTrue(e.choHangLoi());
        assertEquals(3, e.dong().size());
        assertEquals("Lỗi phụ liệu", e.dong().get(0).lyDo());
        assertEquals("2 cái", e.dong().get(0).soLuong());
        assertEquals("145.000", e.dong().get(0).donGia());
        assertEquals("290.000", e.dong().get(0).giaTri());
        assertEquals("Ố bẩn", e.dong().get(2).lyDo());
        assertEquals("https://fcentric.net/supplier/login?bienBan=12&email=lan.tran%40xuongmayhoanganh.vn",
                e.duongDanCong());

        // PDF biên bản dựng lúc gửi (theo cửa hàng lúc đó), không dựng ngay lúc xếp thư
        assertNotNull(g.dinhKem(), "E7 phải kèm PDF biên bản");
        List<TepDinhKem> tep = g.dinhKem().apply(MauEmailFixture.cuaHang());
        assertEquals(1, tep.size());
        assertEquals("Bien-ban-tra-hang-RTV-20261021-003.pdf", tep.get(0).ten());
        assertEquals(PdfBienBanTraHang.LOAI_PDF, tep.get(0).loai());
        assertTrue(tep.get(0).noiDung().length > 1000);
        assertEquals("%PDF", new String(tep.get(0).noiDung(), 0, 4, java.nio.charset.StandardCharsets.ISO_8859_1));

        clearInvocations(dispatcher);
        service.guiBienBanTraHang(MauEmailFixture.bienBan(), MauEmailFixture.ban(), "CAP_NHAT",
                MauEmailFixture.HAN_TRA_LOI, null, null, null);
        EmailGui capNhat = moiGuiSauCommit();
        assertEquals("Biên bản trả hàng RTV-20261021-003 đã cập nhật – Thời trang Linh Lan",
                capNhat.tieuDe().apply(MauEmailFixture.cuaHang()));
        assertTrue(((BienBanTraHangEmail) capNhat.duLieu()).capNhat());
        assertFalse(((BienBanTraHangEmail) capNhat.duLieu()).nhac());
        assertNull(capNhat.conHieuLuc());
        assertNotNull(capNhat.dinhKem());

        clearInvocations(dispatcher);
        service.guiBienBanTraHang(MauEmailFixture.bienBan(), MauEmailFixture.ban(), "NHAC",
                MauEmailFixture.HAN_TRA_LOI, null, null, null);
        EmailGui nhac = moiGuiSauCommit();
        assertEquals("Nhắc trả lời biên bản trả hàng RTV-20261021-003 – Thời trang Linh Lan",
                nhac.tieuDe().apply(MauEmailFixture.cuaHang()));
        assertTrue(((BienBanTraHangEmail) nhac.duLieu()).nhac());
        assertFalse(((BienBanTraHangEmail) nhac.duLieu()).capNhat());
    }

    @Test
    void e7_choTraLoiLayTuBan_daChonHetThiKhongHoi() {
        service.guiBienBanTraHang(MauEmailFixture.bienBan(), MauEmailFixture.banDaTraLoi("DOI_HANG", "NHAN_LAI", "Hà"),
                "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
        BienBanTraHangEmail e = (BienBanTraHangEmail) moiGuiSauCommit().duLieu();
        assertFalse(e.choCachBu());
        assertFalse(e.choHangLoi());

        clearInvocations(dispatcher);
        service.guiBienBanTraHang(MauEmailFixture.bienBan(), MauEmailFixture.banDaTraLoi(null, "TIEU_HUY", "Hà"),
                "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
        e = (BienBanTraHangEmail) moiGuiSauCommit().duLieu();
        assertTrue(e.choCachBu(), "mới chọn hàng lỗi: cách bù vẫn chờ");
        assertFalse(e.choHangLoi());
    }

    @Test
    void e7_donGiaTheoIdBienThe_thieuMotDongThiBoTienCaThu() {
        BienBanTraHangNcc bb = MauEmailFixture.bienBan();
        // biến thể của biên bản là bản khác (cùng id) với biến thể của dòng đơn: vẫn tìm được đơn giá
        bb.getChiTiets().forEach(ct -> {
            var goc = ct.getBienTheSanPham();
            ct.setBienTheSanPham(com.dev.backend.entities.BienTheSanPham.builder().id(goc.getId())
                    .sanPham(goc.getSanPham()).mauSac(goc.getMauSac()).size(goc.getSize()).maSku(goc.getMaSku()).build());
        });
        service.guiBienBanTraHang(bb, MauEmailFixture.ban(), "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
        assertTrue(((BienBanTraHangEmail) moiGuiSauCommit().duLieu()).coGia());

        clearInvocations(dispatcher);
        BienBanTraHangNcc thieu = MauEmailFixture.bienBan();
        thieu.getPhieuNhapKho().getDonMuaHang().getChiTietDonMuaHangs().stream().filter(ct -> ct.getId() == 903)
                .findFirst().orElseThrow().setDonGia(null);
        service.guiBienBanTraHang(thieu, MauEmailFixture.ban(), "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
        BienBanTraHangEmail e = (BienBanTraHangEmail) moiGuiSauCommit().duLieu();
        assertFalse(e.coGia());
        assertNull(e.tongGiaTri());
        assertNull(e.tongGiaTriDong());
        assertTrue(e.dong().stream().allMatch(d -> d.donGia() == null && d.giaTri() == null));
        assertEquals(4, e.soSanPham());
    }

    @Test
    void e7_daTraHang_dungMoTaNoiGoiTruyen_daTieuHuy() {
        service.guiBienBanTraHang(MauEmailFixture.bienBan("DA_TRA_HANG"), MauEmailFixture.ban(), "GUI",
                MauEmailFixture.HAN_TRA_LOI, " Nguyễn Văn Hùng ", null, null);
        BienBanTraHangEmail e = (BienBanTraHangEmail) moiGuiSauCommit().duLieu();
        assertEquals("Đã giao trả", e.noiHangLoi());
        assertEquals("Nguyễn Văn Hùng", e.moTaNoiHangLoi());
        assertFalse(e.hangConOKho());
        assertTrue(e.daTra());

        clearInvocations(dispatcher);
        service.guiBienBanTraHang(MauEmailFixture.bienBan("DA_TIEU_HUY"), MauEmailFixture.ban(), "GUI",
                MauEmailFixture.HAN_TRA_LOI, null, null, null);
        e = (BienBanTraHangEmail) moiGuiSauCommit().duLieu();
        assertEquals("Đã tiêu hủy", e.noiHangLoi());
        assertNull(e.moTaNoiHangLoi());
        assertFalse(e.hangConOKho());
        assertFalse(e.daTra());
    }

    @Test
    void e7m5m6_duLieuSai_khongNem_khongGui() {
        BienBanTraHangDto ban = MauEmailFixture.ban();
        BienBanTraHangDto truTien = MauEmailFixture.banDaTraLoi("TRU_CONG_NO", null, "A");
        List<Consumer<EmailNghiepVuServiceImpl>> goi = List.of(
                s -> s.guiBienBanTraHang(null, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null),
                s -> s.guiDaGhiNhanTraLoi(null, truTien, false),
                s -> s.guiBienBanDaHuy(null),
                // E7, M5: biên bản đã hủy; M6: biên bản chưa hủy
                s -> s.guiBienBanTraHang(MauEmailFixture.bienBan("DA_HUY"), ban, "GUI", MauEmailFixture.HAN_TRA_LOI,
                        null, null, null),
                s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan("DA_HUY"), truTien, false),
                s -> s.guiBienBanDaHuy(MauEmailFixture.bienBan()),
                // loại thư biên bản lạ (quá hạn có thể ra dòng giao bù: M5 tự động không còn chỉ là trừ tiền)
                s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(), ban, "XYZ", MauEmailFixture.HAN_TRA_LOI, null,
                        null, null),
                s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(), ban, null, MauEmailFixture.HAN_TRA_LOI, null,
                        null, null),
                // chọn lại cách bù: biên bản thiếu / đã hủy / thiếu bản DTO
                s -> s.guiCanChonLaiCachBu(null, truTien, List.of(51)),
                s -> s.guiCanChonLaiCachBu(MauEmailFixture.bienBan("DA_HUY"), truTien, List.of(51)),
                s -> s.guiCanChonLaiCachBu(MauEmailFixture.bienBan(), null, List.of(51)),
                // thiếu bản DTO
                s -> s.guiBienBanTraHang(MauEmailFixture.bienBan(), null, "GUI", MauEmailFixture.HAN_TRA_LOI, null,
                        null, null),
                s -> s.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), null, false),
                // thiếu quan hệ
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.getNhaCungCap().setEmail(" ");
                    s.guiBienBanTraHang(bb, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
                },
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.setChiTiets(List.of());
                    s.guiBienBanTraHang(bb, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
                },
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.getChiTiets().forEach(ct -> ct.setSoLuongLoi(0));
                    s.guiBienBanTraHang(bb, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
                },
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.getPhieuNhapKho().setDonMuaHang(null);
                    s.guiBienBanTraHang(bb, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
                },
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.setPhieuNhapKho(null);
                    s.guiBienBanDaHuy(bb);
                },
                s -> {
                    BienBanTraHangNcc bb = MauEmailFixture.bienBan();
                    bb.setId(null);
                    s.guiBienBanTraHang(bb, ban, "GUI", MauEmailFixture.HAN_TRA_LOI, null, null, null);
                });
        for (int i = 0; i < goi.size(); i++) {
            int stt = i;
            assertDoesNotThrow(() -> goi.get(stt).accept(service), "ca " + stt);
        }
        verifyNoInteractions(dispatcher);

        doThrow(new IllegalStateException("hỏng")).when(dispatcher).guiSauCommit(any());
        assertDoesNotThrow(() -> service.guiBienBanTraHang(MauEmailFixture.bienBan(), ban, "GUI",
                MauEmailFixture.HAN_TRA_LOI, null, null, null));
        assertDoesNotThrow(() -> service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), truTien, false));
        assertDoesNotThrow(() -> service.guiBienBanDaHuy(MauEmailFixture.bienBan("DA_HUY")));
    }

    @Test
    void m5_cachBuVaHangLoi_nguoiTraLoi_lucGhiNhan_kemPdf() {
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(),
                MauEmailFixture.banDaTraLoi("DOI_HANG", "NHAN_LAI", " Trần Thị Thu Hà "), false);
        EmailGui g = moiGuiSauCommit();
        assertEquals(LoaiEmail.M5, g.loai());
        assertEquals("Đã ghi nhận trả lời biên bản RTV-20261021-003", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        DaGhiNhanCachXuLyEmail bu = (DaGhiNhanCachXuLyEmail) g.duLieu();
        assertFalse(bu.tuDong());
        assertEquals("Giao bù hàng", bu.cachBu());
        assertEquals("Giao lại 4 sản phẩm đạt", bu.moTaCachBu());
        assertEquals("Nhận lại hàng lỗi", bu.hangLoi());
        assertEquals("Quý công ty đến lấy hoặc nhờ chúng tôi gửi vận chuyển", bu.moTaHangLoi());
        assertEquals("Trần Thị Thu Hà", bu.nguoiXacNhan());
        assertEquals("14:22 ngày 19/10/2026", bu.luc());
        assertEquals("28/10/2026", bu.hanTraLoi());
        assertEquals(4, bu.soSanPham());
        assertEquals("PO202610195101", bu.maDon());
        assertEquals(List.of("Quý công ty còn đổi cách bù trên Cổng nhà cung cấp cho tới khi chúng tôi nhập kho phiếu "
                        + "PN202610210004.",
                "Lựa chọn cho hàng lỗi đổi được trên Cổng nhà cung cấp cho tới khi chúng tôi giao trả hoặc tiêu hủy."),
                bu.ghiChuDoi());
        assertEquals("https://fcentric.net/supplier/login?bienBan=12&email=lan.tran%40xuongmayhoanganh.vn",
                bu.duongDanCong());
        assertNull(g.dinhKem(), "M5 không kèm PDF: biên bản không đổi theo câu trả lời");

        // Trừ tiền đã áp (phiếu đã nhập): số tiền trừ, trừ tiền là chốt cuối; hàng lỗi chưa chọn thì vẫn hỏi
        clearInvocations(dispatcher);
        BienBanTraHangDto tru = MauEmailFixture.banDaTraLoi("TRU_CONG_NO", null, "Trần Thị Thu Hà");
        tru.setPhieuDaNhap(true);
        tru.setCachBuMo(List.of());
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), tru, false);
        DaGhiNhanCachXuLyEmail e = (DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu();
        assertEquals("Trừ tiền hàng", e.cachBu());
        assertEquals("Trừ 645.000" + DinhDangEmail.KY_HIEU_DONG + " khi thanh toán", e.moTaCachBu());
        assertNull(e.hangLoi());
        assertNull(e.moTaHangLoi());
        assertEquals("Trần Thị Thu Hà", e.nguoiXacNhan());
        assertEquals(List.of("Trừ tiền hàng là lựa chọn cuối, không đổi lại được.",
                "Hàng lỗi vẫn ở kho của chúng tôi. Vui lòng chọn nhận lại hoặc đồng ý tiêu hủy trên Cổng nhà cung cấp;"
                        + " chúng tôi chỉ tiêu hủy khi Quý công ty đồng ý."), e.ghiChuDoi());

        // Chọn trừ tiền trước nhập kho, chưa có số trừ: lấy giá trị hàng lỗi; không có giá thì nói số sản phẩm
        clearInvocations(dispatcher);
        BienBanTraHangDto truTruocNhap = MauEmailFixture.banDaTraLoi("TRU_CONG_NO", "TIEU_HUY", "Lan");
        truTruocNhap.setTienTruTien(BigDecimal.ZERO);
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), truTruocNhap, false);
        e = (DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu();
        assertEquals("Trừ 645.000" + DinhDangEmail.KY_HIEU_DONG + " khi thanh toán", e.moTaCachBu());
        assertEquals("Đồng ý tiêu hủy", e.hangLoi());
        assertEquals("Chúng tôi tiêu hủy, Quý công ty không cần lấy về", e.moTaHangLoi());
        clearInvocations(dispatcher);
        truTruocNhap.setGiaTriLoi(null);
        truTruocNhap.getItems().forEach(it -> it.setGiaTri(null));
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), truTruocNhap, false);
        assertEquals("Đơn giảm 4 sản phẩm khi thanh toán",
                ((DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu()).moTaCachBu());

        // Mới chọn hàng lỗi, cách bù còn chờ: không có ô cách bù
        clearInvocations(dispatcher);
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), MauEmailFixture.banDaTraLoi(null, "NHAN_LAI", "Lan"), false);
        e = (DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu();
        assertNull(e.cachBu());
        assertNull(e.moTaCachBu());
        assertEquals("Lan", e.nguoiXacNhan());
    }

    @Test
    void m5_quaHan_tuDongTruTien_khongCoNguoiXacNhan() {
        BienBanTraHangDto ban = MauEmailFixture.banQuaHan();
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), ban, true);
        EmailGui g = moiGuiSauCommit();
        assertEquals("Biên bản trả hàng RTV-20261021-003 quá hạn trả lời: đã chuyển trừ tiền",
                g.tieuDe().apply(MauEmailFixture.cuaHang()));
        DaGhiNhanCachXuLyEmail e = (DaGhiNhanCachXuLyEmail) g.duLieu();
        assertTrue(e.tuDong());
        assertEquals("Trừ tiền hàng", e.cachBu());
        assertNull(e.nguoiXacNhan(), "quá hạn: không có ai bên nhà cung cấp xác nhận");
        assertEquals("28/10/2026", e.hanTraLoi());
        assertEquals(4, e.soSanPham(), "số vừa chuyển trừ tiền");
        assertNull(g.dinhKem());

        // Quá hạn một phần: dòng 51 hệ thống chuyển trừ tiền, dòng 52, 53 coi như đã giao bù (đơn đã nhận đủ)
        clearInvocations(dispatcher);
        BienBanTraHangDto motPhan = MauEmailFixture.banTheoDong(new String[]{"TRU_CONG_NO", "DOI_HANG", "DOI_HANG"},
                new String[]{null, null, null}, null);
        motPhan.setNguonChot("TU_DONG");
        motPhan.getItems().forEach(it -> it.setNguonCachBu("TU_DONG"));
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), motPhan, true);
        e = (DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu();
        assertEquals(2, e.soSanPham(), "chỉ số sản phẩm chuyển trừ tiền");
        assertEquals("Theo từng sản phẩm", e.cachBu());
        assertTrue(e.moTaCachBu().startsWith("Trừ "), e.moTaCachBu());
        assertTrue(e.moTaCachBu().endsWith(" cho 2 sản phẩm, giao bù 2 sản phẩm"), e.moTaCachBu());
        assertEquals("2 sản phẩm lỗi còn lại coi như đã giao bù vì đơn PO202610195101 đã nhận đủ số này ở đợt giao khác, không trừ tiền.",
                e.ghiChuDoi().get(0));
        assertEquals(3, e.dong().size());
        assertTrue(e.coBangDong());
    }

    @Test
    void m5_theoTungDong_tomTatVaBangDong() {
        // Dòng 51 (2 sp) trừ tiền + nhận lại, dòng 52 (1) giao bù + tiêu hủy, dòng 53 (1) giao bù + nhận lại
        BienBanTraHangDto ban = MauEmailFixture.banTheoDong(new String[]{"TRU_CONG_NO", "DOI_HANG", "DOI_HANG"},
                new String[]{"NHAN_LAI", "TIEU_HUY", "NHAN_LAI"}, "Trần Thị Thu Hà");
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), ban, false);
        EmailGui g = moiGuiSauCommit();
        assertEquals("Đã ghi nhận trả lời biên bản RTV-20261021-003", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        DaGhiNhanCachXuLyEmail e = (DaGhiNhanCachXuLyEmail) g.duLieu();
        assertFalse(e.chonLai());
        assertEquals("Theo từng sản phẩm", e.cachBu());
        assertEquals("Trừ " + DinhDangEmail.tienDong(ban.getItems().get(0).getGiaTri()) + " cho 2 sản phẩm, giao bù 2 sản phẩm",
                e.moTaCachBu());
        assertEquals("Theo từng sản phẩm", e.hangLoi());
        assertEquals("Nhận lại 3 sản phẩm, đồng ý tiêu hủy 1 sản phẩm", e.moTaHangLoi());
        assertEquals(4, e.soSanPham());
        assertEquals("Trần Thị Thu Hà", e.nguoiXacNhan());
        assertEquals(3, e.dong().size());
        DaGhiNhanCachXuLyEmail.DongLuaChon d0 = e.dong().get(0);
        assertEquals("Trừ tiền · " + DinhDangEmail.tienDong(ban.getItems().get(0).getGiaTri()), d0.cachBu());
        assertEquals("Nhận lại", d0.hangLoi());
        assertEquals(2, d0.soLuong());
        assertFalse(d0.canChonLai());
        assertEquals("Giao bù", e.dong().get(1).cachBu());
        assertEquals("Đồng ý tiêu hủy", e.dong().get(1).hangLoi());

        // Dòng đã rời kho: bảng ghi đã giao trả / đã tiêu hủy thay lựa chọn
        clearInvocations(dispatcher);
        ban.getItems().get(0).setTrangThaiHang("DA_TRA");
        ban.getItems().get(1).setTrangThaiHang("DA_TIEU_HUY");
        service.guiDaGhiNhanTraLoi(MauEmailFixture.bienBan(), ban, false);
        e = (DaGhiNhanCachXuLyEmail) moiGuiSauCommit().duLieu();
        assertEquals("Đã giao trả", e.dong().get(0).hangLoi());
        assertEquals("Đã tiêu hủy", e.dong().get(1).hangLoi());
        assertEquals("Nhận lại", e.dong().get(2).hangLoi());
    }

    @Test
    void m5_chonLai_chiCacDongCanChonLai_khongNguoiXacNhan() {
        // Nhà cung cấp chọn trừ tiền cả 3 dòng, nhập kho chỉ trừ được dòng 52, 53: dòng 51 về chờ chọn
        BienBanTraHangDto ban = MauEmailFixture.banTheoDong(new String[]{null, "TRU_CONG_NO", "TRU_CONG_NO"},
                new String[]{"NHAN_LAI", "NHAN_LAI", "NHAN_LAI"}, "Lan");
        ban.getItems().get(0).setNguonCachBu("NHAP_KHO");
        service.guiCanChonLaiCachBu(MauEmailFixture.bienBan(), ban, List.of(51));
        EmailGui g = moiGuiSauCommit();
        assertEquals(LoaiEmail.M5, g.loai());
        assertEquals("Biên bản trả hàng RTV-20261021-003: cần chọn lại cách bù", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        DaGhiNhanCachXuLyEmail e = (DaGhiNhanCachXuLyEmail) g.duLieu();
        assertTrue(e.chonLai());
        assertFalse(e.tuDong());
        assertEquals(2, e.soSanPham(), "số sản phẩm của các dòng cần chọn lại");
        assertNull(e.nguoiXacNhan(), "thư do nhập kho gửi, không phải câu trả lời của nhà cung cấp");
        assertTrue(e.coBangDong());
        assertEquals("Cần chọn lại", e.dong().get(0).cachBu());
        assertTrue(e.dong().get(0).canChonLai());
        assertFalse(e.dong().get(1).canChonLai());
        assertTrue(e.dong().get(1).cachBu().startsWith("Trừ tiền"), e.dong().get(1).cachBu());

        // Không có dòng nào phải chọn lại: không gửi
        clearInvocations(dispatcher);
        service.guiCanChonLaiCachBu(MauEmailFixture.bienBan(), ban, List.of());
        service.guiCanChonLaiCachBu(MauEmailFixture.bienBan(), ban, null);
        verifyNoInteractions(dispatcher);
    }

    @Test
    void m6_chiKhiDaHuy() {
        service.guiBienBanDaHuy(MauEmailFixture.bienBan("DA_HUY"));
        EmailGui g = moiGuiSauCommit();
        assertEquals(LoaiEmail.M6, g.loai());
        assertEquals("Biên bản trả hàng RTV-20261021-003 đã hủy", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        BienBanDaHuyEmail e = (BienBanDaHuyEmail) g.duLieu();
        assertEquals("21/10/2026", e.ngayLap());
        assertEquals("PO202610195101", e.maDon());
        assertEquals("PN202610210004", e.soPhieuNhap());
    }

    // ---------------- E1 ----------------

    @Test
    void e1_khongTruyVanCsdl_conHieuLucTheoMaTrongBoNho() {
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        Instant taoLuc = BAY_GIO.minusSeconds(10);
        OtpScheduleObj otp = OtpScheduleObj.builder().email(nd.getEmail()).otp("482913").createdAt(taoLuc)
                .type(OtpType.RESET_PASSWORD).build();
        GlobalCache.OTP_SCHEDULE_OBJS.add(otp);

        service.guiMaDatLaiMatKhau(nd, "482913", taoLuc, taoLuc.plusSeconds(300));

        verifyNoInteractions(nguoiDungRepository, donRepo);
        EmailGui g = moiGuiSauCommit();
        assertEquals(LoaiEmail.E1, g.loai());
        assertNull(g.nguoiPhuTrach());
        MaDatLaiMatKhauEmail e = (MaDatLaiMatKhauEmail) g.duLieu();
        assertEquals("5 phút", e.thoiHan());
        assertFalse(e.toString().contains("482913"));
        assertTrue(g.conHieuLuc().getAsBoolean(), "mã đang là mã mới nhất");

        // gửi lại mã: mã cũ bị thay -> thư cũ (đang chờ / thử lại) không gửi nữa
        GlobalCache.OTP_SCHEDULE_OBJS.remove(otp);
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder().email(nd.getEmail()).otp("111111")
                .createdAt(BAY_GIO).type(OtpType.RESET_PASSWORD).build());
        assertFalse(g.conHieuLuc().getAsBoolean());
        verifyNoInteractions(nguoiDungRepository, donRepo);
    }

    @Test
    void e1_maHetHan_khongGui() {
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        Instant taoLuc = BAY_GIO.minusSeconds(400);
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder().email(nd.getEmail()).otp("482913")
                .createdAt(taoLuc).type(OtpType.RESET_PASSWORD).build());
        service.guiMaDatLaiMatKhau(nd, "482913", taoLuc, taoLuc.plusSeconds(300));
        assertFalse(moiGuiSauCommit().conHieuLuc().getAsBoolean());
    }

    // ---------------- E2, E3, M4 ----------------

    @Test
    void e2_dongTheoVaiTro_vaConHieuLucKhiMatKhauChuaDoi() {
        for (String vt : List.of("quan_tri_vien", "quan_ly_kho", "nhan_vien_kho", "nhan_vien_ban_hang",
                "nhan_vien_mua_hang")) {
            clearInvocations(dispatcher);
            service.guiTaiKhoanMoi(MauEmailFixture.nhanSu(vt), MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET);
            TaiKhoanMoiEmail e = (TaiKhoanMoiEmail) moiGuiSauCommit().duLieu();
            assertEquals(!vt.equals("quan_tri_vien"), e.coDongNoiLamViec(), vt);
            // Dòng "gửi yêu cầu báo giá" chỉ cho vai trò gửi được (SRS 4.4 "RFQ": nhân viên mua hàng, quản trị viên)
            assertEquals(com.dev.backend.constant.variables.IRoleType.GUI_YEU_CAU_BAO_GIA.contains(vt), e.coDongGuiNhaCungCap(), vt);
            assertEquals(MauEmailFixture.LIEN_KET_DAT_MAT_KHAU, e.duongDanDatMatKhau());
            assertEquals("14:22 ngày 20/10/2026", e.hetHanLuc());
            assertFalse(e.toString().contains(MauEmailFixture.MA_LIEN_KET), "toString không lộ liên kết");
        }
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        clearInvocations(dispatcher);
        service.guiTaiKhoanMoi(nd, MauEmailFixture.MA_LIEN_KET,
                    MauEmailFixture.HET_HAN_LIEN_KET);
        EmailGui g = moiGuiSauCommit();
        NguoiDung trongCsdl = MauEmailFixture.nhanSu("nhan_vien_kho");
        when(nguoiDungRepository.findById(15)).thenReturn(Optional.of(trongCsdl));
        assertTrue(g.conHieuLuc().getAsBoolean());
        trongCsdl.setMatKhauHash("$2a$10$da.doi");
        assertFalse(g.conHieuLuc().getAsBoolean(), "đã đặt mật khẩu (hoặc bị cấp lại) thì không gửi lại liên kết cũ");

        trongCsdl.setMatKhauHash(nd.getMatKhauHash());
        assertTrue(g.conHieuLuc().getAsBoolean());
        EmailNghiepVuServiceImpl quaHan = new EmailNghiepVuServiceImpl(dispatcher, new DuongDanEmail("https://fcentric.net"),
                nguoiDungRepository, donRepo, mock(PdfBienBanTraHang.class),
                Clock.fixed(MauEmailFixture.HET_HAN_LIEN_KET, ZoneOffset.UTC));
        clearInvocations(dispatcher);
        quaHan.guiTaiKhoanMoi(nd, MauEmailFixture.MA_LIEN_KET, MauEmailFixture.HET_HAN_LIEN_KET);
        assertFalse(moiGuiSauCommit().conHieuLuc().getAsBoolean(), "liên kết quá hạn thì không gửi (lại) nữa");
    }

    @Test
    void e3_dangKhoa_vaLienKetDatMatKhau() {
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        nd.setTrangThai(0);
        service.guiCapLaiMatKhau(nd, MauEmailFixture.MA_LIEN_KET, BAY_GIO,
                MauEmailFixture.HET_HAN_LIEN_KET);
        CapLaiMatKhauEmail e = (CapLaiMatKhauEmail) moiGuiSauCommit().duLieu();
        assertTrue(e.dangKhoa());
        assertEquals(MauEmailFixture.LIEN_KET_DAT_MAT_KHAU, e.duongDanDatMatKhau());
        assertEquals("14:22 ngày 20/10/2026", e.hetHanLuc());
        assertEquals("14:22 ngày 19/10/2026", e.thoiDiem());
        assertFalse(e.toString().contains(MauEmailFixture.MA_LIEN_KET));
    }

    @Test
    void m4_haiCach_hoTenTrongThiDungTenDangNhap() {
        NguoiDung nd = MauEmailFixture.nhanSu("nhan_vien_kho");
        nd.setHoTen("  ");
        service.guiDaDoiMatKhau(nd, CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP, BAY_GIO);
        DaDoiMatKhauEmail e = (DaDoiMatKhauEmail) moiGuiSauCommit().duLieu();
        assertEquals("minhanh", e.hoTen());
        assertEquals("Đổi khi đã đăng nhập", e.cachThayDoi());
        assertEquals("Đặt lại bằng mã gửi qua email", EmailNghiepVuServiceImpl.nhan(CachDoiMatKhau.DAT_LAI_BANG_MA));
    }

    // ---------------- E4 ----------------

    @Test
    void e4_guiDuoc_ghiNgayGuiYeuCau_catGiay_conHieuLucTheoCsdl() {
        service.guiYeuCauBaoGia(don(2, false));
        EmailGui g = moiGuiSauCommit();
        YeuCauBaoGiaEmail e = (YeuCauBaoGiaEmail) g.duLieu();
        assertEquals(4, e.soMatHang());
        assertEquals("360 cái", e.tongSoLuong());
        assertEquals("26/10/2026", e.ngayCanGiao());
        assertEquals("https://fcentric.net/supplier/login?id=1287&email=lan.tran%40xuongmayhoanganh.vn",
                e.duongDanCong());
        assertEquals(List.of(1, 2, 3, 4), e.dong().stream().map(DongSanPhamEmail::stt).toList());
        assertEquals("APL-NAM-TRANG-M", e.dong().get(0).maSku());
        assertNull(e.dong().get(0).donGia());
        assertEquals("PO202610195101", g.maDon());

        g.khiGuiDuoc().run();
        verify(donRepo).ghiNgayGuiYeuCau(1287, Instant.parse("2026-10-19T07:22:00Z"));

        when(donRepo.trangThai(1287)).thenReturn(Optional.of(2));
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.empty());
        assertTrue(g.conHieuLuc().getAsBoolean());
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(BAY_GIO));
        assertFalse(g.conHieuLuc().getAsBoolean(), "nhà cung cấp đã báo giá thì không gửi lại yêu cầu");
        when(donRepo.trangThai(1287)).thenReturn(Optional.of(4));
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.empty());
        assertFalse(g.conHieuLuc().getAsBoolean());
        when(donRepo.trangThai(1287)).thenReturn(Optional.empty());
        assertFalse(g.conHieuLuc().getAsBoolean(), "đơn đã bị xóa");
    }

    @Test
    void e4_tieuDeTheoCuaHangLucGui() {
        service.guiYeuCauBaoGia(don(2, false));
        EmailGui g = moiGuiSauCommit();
        assertEquals("Yêu cầu báo giá PO202610195101 – Thời trang Linh Lan", g.tieuDe().apply(MauEmailFixture.cuaHang()));
        assertEquals("Yêu cầu báo giá PO202610195101", g.tieuDe().apply(CuaHangEmail.TRONG));
    }

    // ---------------- M3, M1, M2 ----------------

    @Test
    void m3_thanhTienTuTinh_khongDocCotThanhTien_boThuCuKhiCoBaoGiaMoi() {
        DonMuaHang d = don(2, true);
        // cột thanh_tien tự sinh giữ giá trị cũ sau khi cập nhật đơn giá: email không được đọc
        d.getChiTietDonMuaHangs().forEach(ct -> ct.setThanhTien(new BigDecimal("1.00")));
        service.guiDaNhanBaoGia(d);
        EmailGui g = moiGuiSauCommit();
        DaNhanBaoGiaEmail e = (DaNhanBaoGiaEmail) g.duLieu();
        assertEquals("17.400.000", e.dong().get(0).thanhTien());
        assertEquals("51.400.000 ₫", e.tongTien());
        assertEquals("14:35 ngày 19/10/2026", e.thoiDiemBaoGia());

        when(donRepo.trangThai(1287)).thenReturn(Optional.of(2));
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(Instant.parse("2026-10-19T07:35:00Z")));
        assertTrue(g.conHieuLuc().getAsBoolean());
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(Instant.parse("2026-10-19T07:40:00Z")));
        assertFalse(g.conHieuLuc().getAsBoolean(), "đã có báo giá mới hơn: chỉ gửi M3 của lần mới");
        // gửi lại ngay giây sau (máy chủ luôn tăng ngayBaoGia ít nhất 1 giây): thư lần trước vẫn bị bỏ
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(Instant.parse("2026-10-19T07:35:01Z")));
        assertFalse(g.conHieuLuc().getAsBoolean(), "lần báo giá sau 1 giây cũng là lần khác");
    }

    @Test
    void m3_donDaCoKetQuaTruocKhiThuKipDi_vanGuiM3_dacTa7_2() {
        // B gửi báo giá (M3 xếp hàng / đang thử lại), rồi nhân viên chấp nhận A: đơn B sang 4 (hoặc đơn được chọn
        // sang 3). Báo giá này đã nhận trước khi chốt: B phải nhận M3 rồi M2 "đã báo giá" (hoặc M1).
        service.guiDaNhanBaoGia(don(2, true));
        EmailGui g = moiGuiSauCommit();
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(Instant.parse("2026-10-19T07:35:00Z")));
        for (int trangThai : new int[]{2, 3, 4}) {
            when(donRepo.trangThai(1287)).thenReturn(Optional.of(trangThai));
            assertTrue(g.conHieuLuc().getAsBoolean(), "trạng thái " + trangThai);
        }
    }

    @Test
    void m3_dangThuLai_donChuyenSang4_lanThuLaiVanGui() {
        // Bộ gửi thật (luồng đồng bộ, bộ hẹn giờ giả), SMTP giả lỗi lần đầu
        JavaMailSender smtp = mock(JavaMailSender.class);
        when(smtp.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));
        doThrow(new MailSendException("SMTP tạm lỗi")).doNothing().when(smtp).send(any(MimeMessage.class));
        CuaHangEmailFactory cuaHang = mock(CuaHangEmailFactory.class);
        when(cuaHang.hienTai()).thenReturn(MauEmailFixture.cuaHang());
        ScheduledExecutorService henGio = mock(ScheduledExecutorService.class);
        EmailDispatcher that = new EmailDispatcher(smtp, new DungMauEmail(EmailTemplateConfig.taoEngine()), cuaHang,
                "no-reply@linhlan.vn", Runnable::run, henGio);
        EmailNghiepVuServiceImpl s = new EmailNghiepVuServiceImpl(that,
                new DuongDanEmail("https://fcentric.net"), nguoiDungRepository, donRepo,
                mock(PdfBienBanTraHang.class), Clock.fixed(BAY_GIO, ZoneOffset.UTC));
        when(donRepo.ngayBaoGia(1287)).thenReturn(Optional.of(Instant.parse("2026-10-19T07:35:00Z")));
        when(donRepo.trangThai(1287)).thenReturn(Optional.of(2));

        s.guiDaNhanBaoGia(don(2, true)); // không có transaction: xếp hàng ngay, lần 1 lỗi -> hẹn 30 giây
        ArgumentCaptor<Runnable> thuLai = ArgumentCaptor.forClass(Runnable.class);
        verify(henGio).schedule(thuLai.capture(), eq(30_000L), eq(TimeUnit.MILLISECONDS));

        when(donRepo.trangThai(1287)).thenReturn(Optional.of(4)); // nhân viên chấp nhận nhà cung cấp khác (K1)
        thuLai.getValue().run();
        verify(smtp, times(2)).send(any(MimeMessage.class));
    }

    @Test
    void dongSanPham_catKhoangTrangTenSanPham_banChuKhongThuaDauCach() {
        DonMuaHang d = don(2, false);
        d.getChiTietDonMuaHangs().forEach(ct -> ct.getBienTheSanPham().getSanPham()
                .setTenSanPham(" " + ct.getBienTheSanPham().getSanPham().getTenSanPham() + "  "));
        d.getChiTietDonMuaHangs().get(0).getBienTheSanPham().setMaSku(" ATN-NU-DEN-S ");
        List<DongSanPhamEmail> dong = EmailNghiepVuServiceImpl.taoDong(d.getChiTietDonMuaHangs(), false);
        assertEquals("Áo polo nam cơ bản", dong.get(0).tenSanPham());
        assertEquals("Áo thun nữ cổ tròn", dong.get(3).tenSanPham());
        assertEquals("ATN-NU-DEN-S", dong.get(3).maSku());

        MauEmailFixture f = new MauEmailFixture();
        String txt = f.dung(x -> x.guiYeuCauBaoGia(d), MauEmailFixture.cuaHang()).text();
        assertTrue(txt.contains("Áo polo nam cơ bản (Trắng"), txt);
        assertFalse(txt.contains("bản  ("), "không có 2 dấu cách liền nhau sau tên sản phẩm");
    }

    @Test
    void m1_bangChu_vaTongLe_boBangChuNhungVanGui() {
        service.guiXacNhanDatHang(don(3, true));
        XacNhanDatHangEmail e = (XacNhanDatHangEmail) moiGuiSauCommit().duLieu();
        assertEquals("Năm mươi mốt triệu bốn trăm nghìn đồng", e.tongTienBangChu());
        assertEquals("19/10/2026", e.ngayChapNhan());

        clearInvocations(dispatcher);
        DonMuaHang le = don(3, true);
        le.getChiTietDonMuaHangs().get(0).setSoLuongDat(new BigDecimal("3"));
        le.getChiTietDonMuaHangs().get(0).setDonGia(new BigDecimal("145000.50"));
        service.guiXacNhanDatHang(le);
        XacNhanDatHangEmail e2 = (XacNhanDatHangEmail) moiGuiSauCommit().duLieu();
        assertNull(e2.tongTienBangChu(), "dữ liệu cũ có phần lẻ: bỏ dòng bằng chữ, không bỏ M1");
    }

    @Test
    void m2_banTheoNgayBaoGia_lyDo_ngayThamChieu() {
        DonMuaHang daBao = don(4, true);
        daBao.setLyDoTuChoi("  Giá cao  ");
        service.guiKetQuaBaoGia(daBao);
        EmailGui g = moiGuiSauCommit();
        KetQuaBaoGiaEmail e = (KetQuaBaoGiaEmail) g.duLieu();
        assertTrue(e.daBaoGia());
        assertEquals("Giá cao", e.lyDo());
        assertEquals("Kết quả báo giá đơn PO202610195101", g.tieuDe().apply(MauEmailFixture.cuaHang()));

        clearInvocations(dispatcher);
        DonMuaHang chuaBao = don(4, false);
        chuaBao.setNgayGuiYeuCau(null);
        chuaBao.setLyDoTuChoi(" ");
        service.guiKetQuaBaoGia(chuaBao);
        EmailGui g2 = moiGuiSauCommit();
        KetQuaBaoGiaEmail e2 = (KetQuaBaoGiaEmail) g2.duLieu();
        assertFalse(e2.daBaoGia());
        assertNull(e2.lyDo());
        assertEquals("19/10/2026", e2.ngayThamChieu(), "không có ngày gửi yêu cầu thì dùng ngày đặt");
        assertEquals("Yêu cầu báo giá đơn PO202610195101 đã kết thúc", g2.tieuDe().apply(MauEmailFixture.cuaHang()));
    }

    @Test
    void nguoiPhuTrach_quanTriVienKhongCoChucDanh_dienThoaiNhomSo() {
        DonMuaHang d = don(2, false);
        NguoiPhuTrachEmail npt = EmailNghiepVuServiceImpl.nguoiPhuTrach(d);
        assertEquals("Nhân viên mua hàng", npt.chucDanh());
        assertEquals("0912 345 678", npt.dienThoai());
        assertEquals("0912345678", npt.dienThoaiLienKet());
        d.getNguoiTao().setVaiTro("quan_tri_vien");
        assertNull(EmailNghiepVuServiceImpl.nguoiPhuTrach(d).chucDanh());
        d.setNguoiTao(null);
        assertNull(EmailNghiepVuServiceImpl.nguoiPhuTrach(d));
    }

    // ---------------- Cấu trúc ----------------

    @Test
    void khongTiemServiceGayVongPhuThuoc_khongCoTransactional() {
        Set<Class<?>> cam = Set.of(NguoiDungService.class, DonMuaHangService.class, YeuCauMuaHangService.class);
        for (Constructor<?> c : EmailNghiepVuServiceImpl.class.getDeclaredConstructors()) {
            assertTrue(Arrays.stream(c.getParameterTypes()).noneMatch(cam::contains), c.toString());
        }
        for (Field fld : EmailNghiepVuServiceImpl.class.getDeclaredFields()) {
            assertFalse(cam.contains(fld.getType()), fld.getName());
        }
        assertNull(EmailNghiepVuServiceImpl.class.getAnnotation(Transactional.class));
        assertNull(EmailDispatcher.class.getAnnotation(Transactional.class));
        for (Method m : EmailNghiepVuServiceImpl.class.getDeclaredMethods()) {
            assertNull(m.getAnnotation(Transactional.class), m.getName());
        }
        for (Method m : EmailDispatcher.class.getDeclaredMethods()) {
            assertNull(m.getAnnotation(Transactional.class), m.getName());
        }
    }
}
