package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DieuHanhHeThongDssConfigTest {

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
        when(cauHinhRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void dssConfig_tuDongSeed12KhoaVaValidateBien() {
        when(cauHinhRepository.existsById(anyString())).thenReturn(false);
        service.initDefaultConfigurations();

        verify(cauHinhRepository).save(argThat(c ->
                "DSS_REPLENISHMENT_MODE".equals(c.getMaCauHinh())
                        && "BY_ABC_CLASS".equals(c.getGiaTri())));
        verify(cauHinhRepository).save(argThat(c ->
                "DSS_OBSERVATION_DAYS_N".equals(c.getMaCauHinh())
                        && "14".equals(c.getGiaTri())));

        CauHinhHeThong modeEntity = CauHinhHeThong.builder()
                .maCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE)
                .giaTri("BY_ABC_CLASS")
                .kieuDuLieu(KieuDuLieuCauHinh.STRING)
                .build();
        CauHinhHeThong nEntity = CauHinhHeThong.builder()
                .maCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_OBSERVATION_DAYS_N)
                .giaTri("14")
                .kieuDuLieu(KieuDuLieuCauHinh.INT)
                .build();
        CauHinhHeThong zEntity = CauHinhHeThong.builder()
                .maCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_SERVICE_LEVEL_Z)
                .giaTri("1.65")
                .kieuDuLieu(KieuDuLieuCauHinh.DECIMAL)
                .build();
        when(cauHinhRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE))
                .thenReturn(Optional.of(modeEntity));
        when(cauHinhRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_OBSERVATION_DAYS_N))
                .thenReturn(Optional.of(nEntity));
        when(cauHinhRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_SERVICE_LEVEL_Z))
                .thenReturn(Optional.of(zEntity));

        CauHinhHeThongUpdateRequest req = new CauHinhHeThongUpdateRequest();
        req.setGiaTri("INVALID_MODE");
        assertThrows(CommonException.class, () ->
                service.updateCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE, req, null));
        req.setGiaTri("5");
        assertThrows(CommonException.class, () ->
                service.updateCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_OBSERVATION_DAYS_N, req, null));
        req.setGiaTri("4.5");
        assertThrows(CommonException.class, () ->
                service.updateCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_SERVICE_LEVEL_Z, req, null));

        req.setGiaTri("GLOBAL_PRESET");
        assertDoesNotThrow(() ->
                service.updateCauHinh(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE, req, null));
        assertEquals("GLOBAL_PRESET", modeEntity.getGiaTri());
    }
}

