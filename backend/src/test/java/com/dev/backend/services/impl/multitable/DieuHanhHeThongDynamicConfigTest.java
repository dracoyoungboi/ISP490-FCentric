package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.CauHinhHeThongMapper;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DieuHanhHeThongDynamicConfigTest {

    @Mock private CauHinhHeThongRepository cauHinhRepository;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private CauHinhHeThongMapper cauHinhMapper;

    @InjectMocks
    private DieuHanhHeThongServiceImpl service;

    @BeforeEach
    void setUp() {
        when(cauHinhMapper.toDto(any(CauHinhHeThong.class))).thenAnswer(inv -> null);
        when(cauHinhMapper.toDtoList(any())).thenAnswer(inv -> List.of());
    }

    @Test
    void initDefaultConfigurations_khiDBThieu_seTuDongSeedDuCacKhoa() {
        // Giả lập DB chưa có khóa nào
        when(cauHinhRepository.existsById(anyString())).thenReturn(false);

        service.initDefaultConfigurations();

        // 6 khóa vận hành + 5 khóa mã vạch / tem sản phẩm (MA_VACH_TIEN_TO, TEM_*) + 2 khóa VAT
        verify(cauHinhRepository, times(13)).save(any(CauHinhHeThong.class));
        verify(cauHinhRepository).save(argThat(c -> "KIEM_DEM_XAC_NHAN".equals(c.getMaCauHinh())
                && "QUET_TIEP_LA_DAT".equals(c.getGiaTri()) && c.getKieuDuLieu() == KieuDuLieuCauHinh.STRING));
        verify(cauHinhRepository).save(argThat(c -> "MA_KHACH_HANG_TIEN_TO".equals(c.getMaCauHinh())
                && "KH".equals(c.getGiaTri()) && c.getKieuDuLieu() == KieuDuLieuCauHinh.STRING));
        verify(cauHinhRepository).save(argThat(c -> "DEFAULT_MIN_STOCK_ALERT".equals(c.getMaCauHinh()) && "100".equals(c.getGiaTri())));
        verify(cauHinhRepository).save(argThat(c -> "OMNI_SYNC_INTERVAL_MINS".equals(c.getMaCauHinh()) && "10".equals(c.getGiaTri())));
        verify(cauHinhRepository).save(argThat(c -> "REALTIME_SYNC_THRESHOLD".equals(c.getMaCauHinh()) && "3".equals(c.getGiaTri())));
    }

    @Test
    void initDefaultConfigurations_khiDBDaCoSan_khongGhiDeGiaTriCu() {
        // Giả lập DB đã có sẵn cả 3 khóa
        when(cauHinhRepository.existsById(anyString())).thenReturn(true);

        service.initDefaultConfigurations();

        // Không được gọi save để bảo toàn dữ liệu Quản trị viên đã chỉnh sửa
        verify(cauHinhRepository, never()).save(any(CauHinhHeThong.class));
    }

    @Test
    void updateCauHinh_tienToMaLo_khongDuocLaFcCuaTheLenh() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("MA_LO_TIEN_TO")
                .giaTri("LO")
                .kieuDuLieu(KieuDuLieuCauHinh.STRING)
                .build();
        when(cauHinhRepository.findById("MA_LO_TIEN_TO")).thenReturn(Optional.of(entity));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));

        for (String sai : new String[] {"FC", "FC-", "FC-LO", "AFC", "LOFC", "A_FC-", "AFC-"}) {
            CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
            req.setGiaTri(sai);
            CommonException ex = assertThrows(CommonException.class,
                    () -> service.updateCauHinh("MA_LO_TIEN_TO", req, null), sai);
            assertTrue(ex.getMessage().contains("FC"), ex.getMessage());
        }
        assertEquals("LO", entity.getGiaTri());

        CauHinhHeThongUpdateRequest dung = new CauHinhHeThongUpdateRequest();
        dung.setGiaTri("FCL");
        service.updateCauHinh("MA_LO_TIEN_TO", dung, null);
        assertEquals("FCL", entity.getGiaTri(), "FCL-… không phải dạng thẻ lệnh FC-");
    }

    @Test
    void updateCauHinh_tienToMaKhachHang_chiNhanInHoaSoVaDauChamGachToiDa10KyTu() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("MA_KHACH_HANG_TIEN_TO")
                .giaTri("KH")
                .kieuDuLieu(KieuDuLieuCauHinh.STRING)
                .build();
        when(cauHinhRepository.findById("MA_KHACH_HANG_TIEN_TO")).thenReturn(Optional.of(entity));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));

        for (String sai : new String[] {"", "kh", "KH ", "KHÁCH", "KHACHHANG-01"}) {
            CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
            req.setGiaTri(sai);
            CommonException ex = assertThrows(CommonException.class,
                    () -> service.updateCauHinh("MA_KHACH_HANG_TIEN_TO", req, null), sai);
            assertTrue(ex.getMessage().startsWith("Tiền tố mã khách hàng"));
        }

        CauHinhHeThongUpdateRequest dung = new CauHinhHeThongUpdateRequest();
        dung.setGiaTri("KH-HN");
        service.updateCauHinh("MA_KHACH_HANG_TIEN_TO", dung, null);
        assertEquals("KH-HN", entity.getGiaTri());
    }

    @Test
    void updateCauHinh_cheDoXacNhanKiemDem_chiNhanHaiGiaTri() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("KIEM_DEM_XAC_NHAN")
                .giaTri("QUET_TIEP_LA_DAT")
                .kieuDuLieu(KieuDuLieuCauHinh.STRING)
                .build();
        when(cauHinhRepository.findById("KIEM_DEM_XAC_NHAN")).thenReturn(Optional.of(entity));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));

        for (String sai : new String[] {"", "quet_tiep_la_dat", "DAT", "QUET_THE_TUNG_CAI "}) {
            CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
            req.setGiaTri(sai);
            CommonException ex = assertThrows(CommonException.class,
                    () -> service.updateCauHinh("KIEM_DEM_XAC_NHAN", req, null), sai);
            assertTrue(ex.getMessage().startsWith("Cách xác nhận chất lượng"), ex.getMessage());
        }
        assertEquals("QUET_TIEP_LA_DAT", entity.getGiaTri());

        CauHinhHeThongUpdateRequest dung = new CauHinhHeThongUpdateRequest();
        dung.setGiaTri("QUET_THE_TUNG_CAI");
        service.updateCauHinh("KIEM_DEM_XAC_NHAN", dung, null);
        assertEquals("QUET_THE_TUNG_CAI", entity.getGiaTri());
    }

    @Test
    void updateCauHinh_chuKyNhoHon1_nemCommonException() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("OMNI_SYNC_INTERVAL_MINS")
                .giaTri("10")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(entity));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("0"); // 0 phút là không hợp lệ

        CommonException ex = assertThrows(CommonException.class, () -> service.updateCauHinh("OMNI_SYNC_INTERVAL_MINS", req, 1));
        assertTrue(ex.getMessage().contains("phải từ 1 đến 1440 phút"));
    }

    @Test
    void updateCauHinh_chuKyAm_nemCommonException() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("OMNI_SYNC_INTERVAL_MINS")
                .giaTri("10")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(entity));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("-5");

        assertThrows(CommonException.class, () -> service.updateCauHinh("OMNI_SYNC_INTERVAL_MINS", req, 1));
    }

    @Test
    void updateCauHinh_nguongKhanCapAm_nemCommonException() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("REALTIME_SYNC_THRESHOLD")
                .giaTri("3")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        when(cauHinhRepository.findById("REALTIME_SYNC_THRESHOLD")).thenReturn(Optional.of(entity));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("-1");

        assertThrows(CommonException.class, () -> service.updateCauHinh("REALTIME_SYNC_THRESHOLD", req, 1));
    }

    @Test
    void updateCauHinh_hopLe_luuThanhCongVaGhiNhatKyKiemToan() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("OMNI_SYNC_INTERVAL_MINS")
                .giaTri("10")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(entity));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));

        NguoiDung admin = NguoiDung.builder().id(1).hoTen("Admin Test").build();
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(admin));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("15");

        service.updateCauHinh("OMNI_SYNC_INTERVAL_MINS", req, 1);

        assertEquals("15", entity.getGiaTri());
        verify(cauHinhRepository).save(entity);

        // Xác minh ghi vết kiểm toán
        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).create(captor.capture());
        LichSuThayDoi log = captor.getValue();
        assertEquals(ITable.cau_hinh_he_thong, log.getLoaiThamChieu());
        assertEquals(IHanhDong.cap_nhat_cau_hinh, log.getHanhDong());
        assertTrue(log.getGiaTriCu().contains("10"));
        assertTrue(log.getGiaTriMoi().contains("15"));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    void bulkUpdateCauHinh_hopLe_luuTatCaVaGhiNhatKy() {
        CauHinhHeThong c1 = CauHinhHeThong.builder().maCauHinh("OMNI_SYNC_INTERVAL_MINS").giaTri("10").kieuDuLieu(KieuDuLieuCauHinh.INT).build();
        CauHinhHeThong c2 = CauHinhHeThong.builder().maCauHinh("REALTIME_SYNC_THRESHOLD").giaTri("3").kieuDuLieu(KieuDuLieuCauHinh.INT).build();

        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(c1));
        when(cauHinhRepository.findById("REALTIME_SYNC_THRESHOLD")).thenReturn(Optional.of(c2));

        NguoiDung admin = NguoiDung.builder().id(1).hoTen("Admin Test").build();
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(admin));

        CauHinhHeThongBulkUpdateRequest r1 = new CauHinhHeThongBulkUpdateRequest();
        r1.setMaCauHinh("OMNI_SYNC_INTERVAL_MINS");
        r1.setGiaTri("20");

        CauHinhHeThongBulkUpdateRequest r2 = new CauHinhHeThongBulkUpdateRequest();
        r2.setMaCauHinh("REALTIME_SYNC_THRESHOLD");
        r2.setGiaTri("5");

        service.bulkUpdateCauHinh(List.of(r1, r2), 1);

        assertEquals("20", c1.getGiaTri());
        assertEquals("5", c2.getGiaTri());
        verify(cauHinhRepository).saveAll(any());
        verify(lichSuThayDoiService).create(any(LichSuThayDoi.class));
    }

    @Test
    void bulkUpdateCauHinh_khiUserIdNullVaKhongCoContext_vanLuuThanhCongVaKhongGoiLichSuThayDoi() {
        CauHinhHeThong c1 = CauHinhHeThong.builder().maCauHinh("OMNI_SYNC_INTERVAL_MINS").giaTri("10").kieuDuLieu(KieuDuLieuCauHinh.INT).build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(c1));

        CauHinhHeThongBulkUpdateRequest r1 = new CauHinhHeThongBulkUpdateRequest();
        r1.setMaCauHinh("OMNI_SYNC_INTERVAL_MINS");
        r1.setGiaTri("20");

        // userId = null và SecurityContextHolder không có user
        service.bulkUpdateCauHinh(List.of(r1), null);

        assertEquals("20", c1.getGiaTri());
        verify(cauHinhRepository).saveAll(any());
        // Bắt buộc KHÔNG được gọi lichSuThayDoiService.create để triệt tiêu bẫy rollback-only!
        verify(lichSuThayDoiService, never()).create(any(LichSuThayDoi.class));
    }

    @Test
    void bulkUpdateCauHinh_khiUserIdNullNhungSecurityContextCoUser_tuDongNhanDienVaGhiLog() {
        CauHinhHeThong c1 = CauHinhHeThong.builder().maCauHinh("OMNI_SYNC_INTERVAL_MINS").giaTri("10").kieuDuLieu(KieuDuLieuCauHinh.INT).build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(c1));

        NguoiDung admin = NguoiDung.builder().id(99).hoTen("Admin Context").build();
        when(nguoiDungRepository.findById(99)).thenReturn(Optional.of(admin));

        // Thiết lập SecurityContext
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(99).tenDangNhap("admin99").build());

        CauHinhHeThongBulkUpdateRequest r1 = new CauHinhHeThongBulkUpdateRequest();
        r1.setMaCauHinh("OMNI_SYNC_INTERVAL_MINS");
        r1.setGiaTri("20");

        service.bulkUpdateCauHinh(List.of(r1), null);

        assertEquals("20", c1.getGiaTri());
        verify(cauHinhRepository).saveAll(any());
        // Nhờ fallback SecurityContextHolder, log kiểm toán vẫn được tạo thành công với user id = 99
        verify(lichSuThayDoiService).create(argThat((LichSuThayDoi log) -> log.getNguoiThucHien() != null && log.getNguoiThucHien().getId() == 99));
    }

    @Test
    void updateCauHinh_khiUserIdNullVaKhongCoContext_vanLuuThanhCongVaKhongGoiLichSuThayDoi() {
        CauHinhHeThong entity = CauHinhHeThong.builder()
                .maCauHinh("OMNI_SYNC_INTERVAL_MINS")
                .giaTri("10")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS")).thenReturn(Optional.of(entity));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("25");

        service.updateCauHinh("OMNI_SYNC_INTERVAL_MINS", req, null);

        assertEquals("25", entity.getGiaTri());
        verify(cauHinhRepository).save(entity);
        // Không gọi lichSuThayDoiService.create vì user = null
        verify(lichSuThayDoiService, never()).create(any(LichSuThayDoi.class));
    }

    @Test
    void getCauHinhInt_traVeGiaTriDungHoacDefault() {
        when(cauHinhRepository.findById("OMNI_SYNC_INTERVAL_MINS"))
                .thenReturn(Optional.of(CauHinhHeThong.builder().maCauHinh("OMNI_SYNC_INTERVAL_MINS").giaTri("15").build()));
        when(cauHinhRepository.findById("NON_EXISTING"))
                .thenReturn(Optional.empty());

        assertEquals(15, service.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10));
        assertEquals(10, service.getCauHinhInt("NON_EXISTING", 10));
    }
}

