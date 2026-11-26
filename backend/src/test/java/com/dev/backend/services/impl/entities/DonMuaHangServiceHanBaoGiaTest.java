package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.ChiTietDonMuaHangBaoGia;
import com.dev.backend.dto.request.DonMuaHangBaoGia;
import com.dev.backend.dto.response.congncc.DonMuaHangCongNccDto;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.testsupport.MutableClock;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.dev.backend.services.impl.entities.DonMuaHangFixture.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Hạn báo giá: tính hạn (HanBaoGia), lượt xét hạn mỗi giờ (nhắc, hết hạn, yêu cầu về Đã duyệt), chặn báo giá sau hạn,
 * cổng biết đơn đã qua hạn. Mốc: gửi 26/11/2026 10:15 giờ VN, hạn chốt hết ngày 01/12/2026.
 */
@ExtendWith(MockitoExtension.class)
class DonMuaHangServiceHanBaoGiaTest {

    /** 26/11/2026 10:15 giờ Việt Nam. */
    static final Instant GUI_LUC = Instant.parse("2026-11-26T03:15:00Z");
    static final LocalDate HAN = LocalDate.of(2026, 12, 1);
    /** 8:00 ngày 30/11 giờ VN. */
    static final Instant NHAC_LUC = Instant.parse("2026-11-30T01:00:00Z");
    /** 0:00 ngày 02/12 giờ VN. */
    static final Instant HET_HAN_LUC = Instant.parse("2026-12-01T17:00:00Z");

    @Mock
    private CauHinhHeThongRepository cauHinhRepository;
    @Mock
    private LichSuThayDoiRepository lichSuRepository;

    private HanBaoGia hanBaoGia;

    @BeforeEach
    void taoHan() {
        hanBaoGia = new HanBaoGia(cauHinhRepository, lichSuRepository);
    }

    private void soNgayCauHinh(String giaTri) {
        lenient().when(cauHinhRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_HAN_BAO_GIA_NGAY))
                .thenReturn(giaTri == null ? Optional.empty()
                        : Optional.of(CauHinhHeThong.builder().giaTri(giaTri).build()));
    }

    /** Dòng chốt hạn của các đơn: id → ngày (mới nhất trước như truy vấn thật). */
    private void hanDaChot(Object[]... dong) {
        lenient().when(lichSuRepository.giaTriMoiTheoHanhDong(eq(ITable.don_mua_hang), anyCollection(),
                eq(IHanhDong.dat_han_bao_gia))).thenReturn(new ArrayList<>(List.of(dong)));
    }

    // ── Tính hạn ───────────────────────────────────────────────────────────

    @Nested
    class TinhHan {

        @Test
        void hanTinhTheoNgayGioVietNam_quaNuaDemVanLaNgayGui() {
            assertEquals(HAN, HanBaoGia.hanKhiGui(GUI_LUC, 5));
            // 23:30 ngày 26/11 giờ VN (16:30Z): vẫn là ngày 26/11
            assertEquals(HAN, HanBaoGia.hanKhiGui(Instant.parse("2026-11-26T16:30:00Z"), 5));
            // 0:30 ngày 27/11 giờ VN (17:30Z hôm trước theo UTC): đã sang ngày 27/11
            assertEquals(LocalDate.of(2026, 12, 2), HanBaoGia.hanKhiGui(Instant.parse("2026-11-26T17:30:00Z"), 5));
        }

        @Test
        void hetHanTu0GioNgaySau_nhacLuc8GioNgayTruoc() {
            assertEquals(HET_HAN_LUC, HanBaoGia.hetHanLuc(HAN));
            assertFalse(HanBaoGia.daQuaHan(HAN, HET_HAN_LUC.minusSeconds(1)), "23:59:59 ngày hạn vẫn còn hạn");
            assertTrue(HanBaoGia.daQuaHan(HAN, HET_HAN_LUC));
            assertFalse(HanBaoGia.daQuaHan(null, HET_HAN_LUC));
            assertEquals(NHAC_LUC, HanBaoGia.nhacLuc(HAN));
        }

        @Test
        void soNgay_chuaCoHoacSai_dungMacDinh5() {
            soNgayCauHinh(null);
            assertEquals(5, hanBaoGia.soNgay());
            soNgayCauHinh(" 7 ");
            assertEquals(7, hanBaoGia.soNgay());
            soNgayCauHinh("0");
            assertEquals(5, hanBaoGia.soNgay());
            soNgayCauHinh("31");
            assertEquals(5, hanBaoGia.soNgay());
            soNgayCauHinh("năm");
            assertEquals(5, hanBaoGia.soNgay());
        }

        @Test
        void hanDaChot_uuTienDongMoiNhat_donCuThiSuyRaTheoSoNgayHienTai() {
            soNgayCauHinh("3");
            YeuCauMuaHang yc = yeuCau(10, YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
            DonMuaHang coChot = don(101, yc, ncc(1, "A", "a@x.vn"), 2);
            DonMuaHang donCu = don(102, yc, ncc(2, "B", "b@x.vn"), 2);
            donCu.setNgayDatHang(GUI_LUC);
            hanDaChot(new Object[]{101, "2026-12-01"}, new Object[]{101, "2026-11-28"}, new Object[]{102, "hỏng"});

            Map<Integer, HanBaoGia.Han> han = hanBaoGia.hanCua(List.of(coChot, donCu));
            assertEquals(new HanBaoGia.Han(HAN, true), han.get(101));
            // Dòng hỏng bỏ qua: đơn cũ lấy ngày gửi + số ngày đang cấu hình, không coi là đã chốt
            assertEquals(new HanBaoGia.Han(LocalDate.of(2026, 11, 29), false), han.get(102));
        }
    }

    // ── Lượt xét hạn và báo giá trên cổng ─────────────────────────────────

    @Nested
    class XetHan {

        @Mock
        private DonMuaHangRepository repository;
        @Mock
        private EntityManager entityManager;
        @Mock
        private EmailNghiepVuService email;
        @Mock
        private YeuCauMuaHangService yeuCauMuaHangService;
        @Mock
        private LichSuThayDoiService lichSuThayDoiService;
        @Mock
        private ThongBaoMuaHangService thongBao;
        @Mock
        private ChiTietDonMuaHangService chiTietDonMuaHangService;

        private DonMuaHangService service;
        private final MutableClock clock = new MutableClock(GUI_LUC);
        private YeuCauMuaHang yc;
        /** Chưa báo giá, email đã tới, hạn chốt 01/12. */
        private DonMuaHang donA;
        private final List<DonMuaHang> cacDon = new ArrayList<>();

        @BeforeEach
        void setUp() {
            service = new DonMuaHangService(repository);
            ReflectionTestUtils.setField(service, "entityManager", entityManager);
            ReflectionTestUtils.setField(service, "emailNghiepVuService", email);
            ReflectionTestUtils.setField(service, "yeuCauMuaHangService", yeuCauMuaHangService);
            ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
            ReflectionTestUtils.setField(service, "thongBaoMuaHangService", thongBao);
            ReflectionTestUtils.setField(service, "chiTietDonMuaHangService", chiTietDonMuaHangService);
            ReflectionTestUtils.setField(service, "hanBaoGia", hanBaoGia);
            service.setDongHo(clock);

            yc = yeuCau(10, YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
            donA = don(101, yc, ncc(5, "Xưởng May Hoàng Anh", "lan@xuong.vn"), 2, dong(11, "AO-M", "10", "0"));
            donA.setNgayDatHang(GUI_LUC);
            donA.setNgayGuiYeuCau(GUI_LUC.plusSeconds(20));
            cacDon.add(donA);
            soNgayCauHinh("5");
            hanDaChot(new Object[]{101, "2026-12-01"});
            lenient().when(repository.layIdYeuCau(anyInt())).thenReturn(Optional.of(10));
            lenient().when(entityManager.find(YeuCauMuaHang.class, 10, LockModeType.PESSIMISTIC_WRITE)).thenReturn(yc);
            lenient().when(repository.khoaTheoYeuCau(10)).thenReturn(cacDon);
            lenient().when(repository.findById(101)).thenReturn(Optional.of(donA));
            lenient().when(repository.findByIdForUpdate(101)).thenReturn(Optional.of(donA));
        }

        private DonMuaHangService.KetQuaXetHan xet(Instant luc) {
            return service.xetHanBaoGia(101, luc);
        }

        private List<LichSuThayDoi> lichSuDaGhi() {
            ArgumentCaptor<LichSuThayDoi> c = ArgumentCaptor.forClass(LichSuThayDoi.class);
            verify(lichSuThayDoiService, atLeast(0)).create(c.capture());
            return c.getAllValues();
        }

        @Test
        void truocMocNhac_khongLamGi() {
            assertEquals(DonMuaHangService.KetQuaXetHan.KHONG_DOI, xet(NHAC_LUC.minusSeconds(1)));
            verifyNoInteractions(email);
            assertEquals(2, donA.getTrangThai());
        }

        @Test
        void toiMocNhac_guiNhacMotLan_ghiDaNhac() {
            assertEquals(DonMuaHangService.KetQuaXetHan.DA_NHAC, xet(NHAC_LUC));
            verify(email).guiNhacHanBaoGia(donA, HAN);
            ArgumentCaptor<LichSuThayDoi> ghi = ArgumentCaptor.forClass(LichSuThayDoi.class);
            verify(lichSuRepository).save(ghi.capture());
            assertEquals(IHanhDong.nhac_han_bao_gia, ghi.getValue().getHanhDong());
            assertEquals(2, donA.getTrangThai());

            // Lượt sau: đã có dòng nhắc thì không gửi lần hai
            when(lichSuRepository.idCoHanhDong(ITable.don_mua_hang, List.of(101), IHanhDong.nhac_han_bao_gia))
                    .thenReturn(List.of(101));
            assertEquals(DonMuaHangService.KetQuaXetHan.KHONG_DOI, xet(NHAC_LUC.plus(Duration.ofHours(3))));
            verify(email, times(1)).guiNhacHanBaoGia(any(), any());
        }

        @Test
        void hanLaNgayMai_guiSauMocNhac_khongNhac() {
            // Gửi 10:15 ngày 30/11, hạn chốt 01/12: mốc nhắc 8:00 ngày 30/11 đã qua lúc gửi
            donA.setNgayDatHang(NHAC_LUC.plus(Duration.ofMinutes(135)));
            assertEquals(DonMuaHangService.KetQuaXetHan.KHONG_DOI, xet(NHAC_LUC.plus(Duration.ofHours(5))));
            verifyNoInteractions(email);
        }

        @Test
        void quaHan_donSangHetHan_emailHetHan_yeuCauVeDaDuyet_baoNguoiMua() {
            assertEquals(DonMuaHangService.KetQuaXetHan.HET_HAN, xet(HET_HAN_LUC.plus(Duration.ofHours(8))));

            assertEquals(DonMuaHangService.TRANG_THAI_HET_HAN, donA.getTrangThai());
            verify(repository).save(donA);
            verify(email).guiHetHanBaoGia(donA, HAN);
            assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
            verify(yeuCauMuaHangService).create(yc);
            verify(thongBao).hetHanBaoGia(donA, yc, HAN, true);

            List<LichSuThayDoi> ls = lichSuDaGhi();
            LichSuThayDoi hetHan = ls.stream().filter(l -> IHanhDong.het_han_bao_gia.equals(l.getHanhDong())).findFirst().orElseThrow();
            assertEquals("2", hetHan.getGiaTriCu());
            assertEquals("8", hetHan.getGiaTriMoi());
            assertNull(hetHan.getGhiChu(), "email đã tới: không có lý do riêng");
            LichSuThayDoi moLai = ls.stream().filter(l -> IHanhDong.mo_lai_yeu_cau_mua_hang.equals(l.getHanhDong())).findFirst().orElseThrow();
            assertEquals(YeuCauMuaHangService.LOAI_THAM_CHIEU, moLai.getLoaiThamChieu());
            assertEquals("3", moLai.getGiaTriCu());
            assertEquals("2", moLai.getGiaTriMoi());
        }

        @Test
        void quaHan_conBaoGiaChoXet_yeuCauGiuNguyen() {
            DonMuaHang donB = don(102, yc, ncc(6, "Dệt B", "b@x.vn"), 2, dong(21, "AO-M", "10", "1000"));
            donB.setNgayBaoGia(GUI_LUC.plus(Duration.ofDays(1)));
            cacDon.add(donB);

            assertEquals(DonMuaHangService.KetQuaXetHan.HET_HAN, xet(HET_HAN_LUC));
            assertEquals(8, donA.getTrangThai());
            assertEquals(2, donB.getTrangThai(), "báo giá đã gửi không hết hạn");
            assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA, yc.getTrangThai());
            verify(yeuCauMuaHangService, never()).create(any(YeuCauMuaHang.class));
            verify(thongBao).hetHanBaoGia(donA, yc, HAN, false);
        }

        @Test
        void quaHan_emailChuaToi_khongGuiEmailHetHan_ghiLyDo() {
            donA.setNgayGuiYeuCau(null);
            assertEquals(DonMuaHangService.KetQuaXetHan.HET_HAN, xet(HET_HAN_LUC));
            verify(email, never()).guiHetHanBaoGia(any(), any());
            LichSuThayDoi hetHan = lichSuDaGhi().stream()
                    .filter(l -> IHanhDong.het_han_bao_gia.equals(l.getHanhDong())).findFirst().orElseThrow();
            assertEquals(DonMuaHangService.LY_DO_HET_HAN_CHUA_GUI_EMAIL, hetHan.getGhiChu());
        }

        @Test
        void donGuiTruocKhiCoHan_hetHanImLang() {
            hanDaChot();
            donA.setNgayDatHang(Instant.parse("2026-11-10T03:00:00Z"));
            assertEquals(DonMuaHangService.KetQuaXetHan.HET_HAN, xet(GUI_LUC));
            verifyNoInteractions(email);
            verifyNoInteractions(thongBao);
            LichSuThayDoi hetHan = lichSuDaGhi().stream()
                    .filter(l -> IHanhDong.het_han_bao_gia.equals(l.getHanhDong())).findFirst().orElseThrow();
            assertEquals(DonMuaHangService.LY_DO_HET_HAN_DON_CU, hetHan.getGhiChu());
            assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
        }

        @Test
        void donGuiTruocKhiCoHan_conKip_vanDuocNhac_hetHanThiCoEmail() {
            hanDaChot();
            // Gửi 26/11 trước khi có hạn: hạn suy ra = 26/11 + 5 = 01/12, mốc nhắc 30/11 8:00
            assertEquals(DonMuaHangService.KetQuaXetHan.DA_NHAC, xet(NHAC_LUC));
            verify(email).guiNhacHanBaoGia(donA, HAN);

            when(lichSuRepository.idCoHanhDong(ITable.don_mua_hang, List.of(101), IHanhDong.nhac_han_bao_gia))
                    .thenReturn(List.of(101));
            assertEquals(DonMuaHangService.KetQuaXetHan.HET_HAN, xet(HET_HAN_LUC));
            verify(email).guiHetHanBaoGia(donA, HAN);
            verify(thongBao).hetHanBaoGia(donA, yc, HAN, true);
        }

        @Test
        void donDaBaoGia_hoacYeuCauDaChon_khongDoi() {
            donA.setNgayBaoGia(GUI_LUC.plus(Duration.ofDays(1)));
            assertEquals(DonMuaHangService.KetQuaXetHan.KHONG_DOI, xet(HET_HAN_LUC));
            donA.setNgayBaoGia(null);
            yc.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC);
            assertEquals(DonMuaHangService.KetQuaXetHan.KHONG_DOI, xet(HET_HAN_LUC));
            assertEquals(2, donA.getTrangThai());
            verifyNoInteractions(email);
        }

        @Test
        void khongChapNhanBaoGiaCuoi_yeuCauVeDaDuyet_conDonChoThiGiu() {
            com.dev.backend.config.SecurityContextHolder.setUser(com.dev.backend.dto.response.entities.NguoiDungAuthInfo
                    .builder().id(7).vaiTro(Set.of("nhan_vien_mua_hang")).build());
            NguoiDungService nguoiDungService = mock(NguoiDungService.class);
            ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
            when(nguoiDungService.getOne(7)).thenReturn(Optional.of(com.dev.backend.entities.NguoiDung.builder().id(7).build()));
            try {
                Instant baoGia = Instant.parse("2026-11-27T02:00:00Z");
                DonMuaHang donB = don(102, yc, ncc(6, "Dệt B", "b@x.vn"), 2, dong(21, "AO-M", "10", "1000"));
                donB.setNgayBaoGia(baoGia);
                cacDon.add(donB);
                // Còn đơn A chờ báo giá: không chấp nhận B thì yêu cầu vẫn mở
                service.xetBaoGia(102, DonMuaHangService.TRANG_THAI_KHONG_CHAP_NHAN, null, baoGia);
                assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA, yc.getTrangThai());

                // A cũng đã báo giá và bị không chấp nhận: không còn đơn nào chờ, yêu cầu về Đã duyệt
                donA.setNgayBaoGia(baoGia);
                service.xetBaoGia(101, DonMuaHangService.TRANG_THAI_KHONG_CHAP_NHAN, "Giá cao", baoGia);
                assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
                LichSuThayDoi moLai = lichSuDaGhi().stream()
                        .filter(l -> IHanhDong.mo_lai_yeu_cau_mua_hang.equals(l.getHanhDong())).findFirst().orElseThrow();
                assertEquals(DonMuaHangService.LY_DO_MO_LAI_KHONG_CHAP_NHAN, moLai.getGhiChu());
                assertEquals(7, moLai.getNguoiThucHien().getId());
            } finally {
                com.dev.backend.config.SecurityContextHolder.clear();
            }
        }

        @Test
        void congNcc_quaHan_tuChoiBaoGia_vaCoCoQuaHan() {
            service.setDongHo(new MutableClock(HET_HAN_LUC.minusSeconds(1)));
            DonMuaHangCongNccDto conHan = service.layDonChoCong(101, Set.of(5));
            assertEquals(HAN, conHan.getHanBaoGia());
            assertFalse(conHan.getQuaHanBaoGia());

            service.setDongHo(new MutableClock(HET_HAN_LUC));
            assertTrue(service.layDonChoCong(101, Set.of(5)).getQuaHanBaoGia(), "0:00 ngày sau hạn đã là quá hạn");
            LoiCoMaException e = loiMa(MaLoi.DON_KHONG_CON_NHAN, () -> service.baoGiaTuCong(101, "lan@xuong.vn",
                    DonMuaHangBaoGia.builder().id(101).chiTietDonMuaHangBaoGias(List.of(ChiTietDonMuaHangBaoGia.builder()
                            .chiTietDonMuaHangId(11).donGia(new BigDecimal("1000")).build())).build()));
            assertTrue(e.getMessage().contains("01/12/2026"), e.getMessage());
            verify(repository, never()).save(any());
            verify(chiTietDonMuaHangService, never()).update(anyInt(), any());
        }
    }
}
