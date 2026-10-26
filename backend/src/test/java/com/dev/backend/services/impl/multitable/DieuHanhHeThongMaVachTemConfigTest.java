package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.CauHinhHeThongMapper;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Khóa cấu hình của mã vạch SKU và tem sản phẩm: tiền tố đúng 2 chữ số, khổ tem trong danh sách dựng sẵn, ngưỡng hỏi
 * xác nhận 1–9999, cờ in tên cửa hàng / SKU là BOOLEAN; seed đúng kiểu và mô tả ghi rõ mã đã cấp giữ nguyên.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DieuHanhHeThongMaVachTemConfigTest {

    @Mock private CauHinhHeThongRepository cauHinhRepository;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private CauHinhHeThongMapper cauHinhMapper;

    @InjectMocks
    private DieuHanhHeThongServiceImpl service;

    private final Map<String, CauHinhHeThong> bang = new HashMap<>();

    @BeforeEach
    void setUp() {
        dat("MA_VACH_TIEN_TO", "20", KieuDuLieuCauHinh.STRING);
        dat("TEM_KHO_MAC_DINH", "35x22", KieuDuLieuCauHinh.STRING);
        dat("TEM_IN_TEN_CUA_HANG", "false", KieuDuLieuCauHinh.BOOLEAN);
        dat("TEM_IN_SKU", "false", KieuDuLieuCauHinh.BOOLEAN);
        dat("TEM_NGUONG_XAC_NHAN", "200", KieuDuLieuCauHinh.INT);
        when(cauHinhRepository.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(bang.get((String) inv.getArgument(0))));
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void dat(String ma, String giaTri, KieuDuLieuCauHinh kieu) {
        bang.put(ma, CauHinhHeThong.builder().maCauHinh(ma).giaTri(giaTri).kieuDuLieu(kieu).build());
    }

    private void doi(String ma, String giaTri) {
        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri(giaTri);
        service.updateCauHinh(ma, req, null);
    }

    private void saiThiBaoLoi(String ma, String... giaTriSai) {
        String truoc = bang.get(ma).getGiaTri();
        for (String sai : giaTriSai) {
            assertThrows(CommonException.class, () -> doi(ma, sai), ma + " = " + sai);
        }
        assertEquals(truoc, bang.get(ma).getGiaTri(), "giá trị sai không được lưu");
    }

    @Test
    void tienToMaVach_dung2ChuSo() {
        saiThiBaoLoi("MA_VACH_TIEN_TO", "2", "893", "2a", "AB", " 20", "");
        doi("MA_VACH_TIEN_TO", "29");
        assertEquals("29", bang.get("MA_VACH_TIEN_TO").getGiaTri());
    }

    @Test
    void khoTem_chiNhanKhoDungSan() {
        saiThiBaoLoi("TEM_KHO_MAC_DINH", "40x30", "35X22", "A4");
        doi("TEM_KHO_MAC_DINH", "50x30");
        assertEquals("50x30", bang.get("TEM_KHO_MAC_DINH").getGiaTri());
    }

    @Test
    void nguongXacNhan_tu1Den9999() {
        saiThiBaoLoi("TEM_NGUONG_XAC_NHAN", "0", "-1", "10000", "abc", "12.5");
        doi("TEM_NGUONG_XAC_NHAN", "1");
        doi("TEM_NGUONG_XAC_NHAN", "9999");
        assertEquals("9999", bang.get("TEM_NGUONG_XAC_NHAN").getGiaTri());
    }

    @Test
    void coInTem_laBoolean() {
        saiThiBaoLoi("TEM_IN_SKU", "co", "yes", "2");
        CauHinhHeThongBulkUpdateRequest a = new CauHinhHeThongBulkUpdateRequest();
        a.setMaCauHinh("TEM_IN_SKU");
        a.setGiaTri("true");
        CauHinhHeThongBulkUpdateRequest b = new CauHinhHeThongBulkUpdateRequest();
        b.setMaCauHinh("TEM_IN_TEN_CUA_HANG");
        b.setGiaTri("true");
        service.bulkUpdateCauHinh(List.of(a, b), null);
        assertEquals("true", bang.get("TEM_IN_SKU").getGiaTri());
        assertEquals("true", bang.get("TEM_IN_TEN_CUA_HANG").getGiaTri());
    }

    @Test
    void seed_dungKieuVaGiaTriMacDinh() {
        when(cauHinhRepository.existsById(anyString())).thenReturn(false);

        service.initDefaultConfigurations();

        verify(cauHinhRepository).save(argThat(c -> "MA_VACH_TIEN_TO".equals(c.getMaCauHinh()) && "20".equals(c.getGiaTri())
                && c.getKieuDuLieu() == KieuDuLieuCauHinh.STRING && c.getMoTa().contains("mã đã cấp giữ nguyên")));
        verify(cauHinhRepository).save(argThat(c -> "TEM_KHO_MAC_DINH".equals(c.getMaCauHinh()) && "35x22".equals(c.getGiaTri())));
        verify(cauHinhRepository).save(argThat(c -> "TEM_IN_TEN_CUA_HANG".equals(c.getMaCauHinh()) && "false".equals(c.getGiaTri())
                && c.getKieuDuLieu() == KieuDuLieuCauHinh.BOOLEAN));
        verify(cauHinhRepository).save(argThat(c -> "TEM_IN_SKU".equals(c.getMaCauHinh()) && c.getKieuDuLieu() == KieuDuLieuCauHinh.BOOLEAN));
        verify(cauHinhRepository).save(argThat(c -> "TEM_NGUONG_XAC_NHAN".equals(c.getMaCauHinh()) && "200".equals(c.getGiaTri())
                && c.getKieuDuLieu() == KieuDuLieuCauHinh.INT));
    }
}
