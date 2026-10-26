package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.dto.response.customize.CauHinhTemDto;
import com.dev.backend.dto.response.customize.DongInTemDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Hộp In tem: cấu hình tem (giá trị hỏng thì về mặc định), dòng in tem theo đúng thứ tự, tra mã quét. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TemSanPhamServiceTest {

    @Mock private GiaBanBienTheRepository giaBanRepository;
    @Mock private GiaBanBienTheService giaBanBienTheService;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private ThongTinCongTyService thongTinCongTyService;

    @InjectMocks
    private TemSanPhamService service;

    private final SanPhamQuanAo sp = SanPhamQuanAo.builder().id(10).tenSanPham("Nike Sportswear").build();

    @BeforeEach
    void setUp() {
        when(dieuHanhHeThongService.getCauHinhString(anyString(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        when(dieuHanhHeThongService.getCauHinhInt(anyString(), anyInt())).thenAnswer(inv -> inv.getArgument(1));
        when(dieuHanhHeThongService.getCauHinhBoolean(anyString(), anyBoolean())).thenAnswer(inv -> inv.getArgument(1));
        when(thongTinCongTyService.getProfile()).thenReturn(ThongTinCongTyDto.builder().name("  Cửa hàng Mặc Đẹp ").build());
        when(giaBanBienTheService.tonKho(anyCollection())).thenReturn(Map.of(2, new BigDecimal("7")));
    }

    private BienTheSanPham bt(int id) {
        return BienTheSanPham.builder().id(id).sanPham(sp).maSku("AK-" + id).maVachSku("20000000" + id)
                .mauSac(MauSac.builder().tenMau("Đen").maMauHex("#111").build())
                .size(Size.builder().tenSize("M").build()).trangThai(1).giaBan(new BigDecimal("2000000")).giaVon(new BigDecimal("1")).build();
    }

    @Test
    void cauHinh_macDinh_vaTenCuaHang() {
        CauHinhTemDto ch = service.cauHinh();
        assertEquals("35x22", ch.getKho());
        assertEquals(200, ch.getNguongXacNhan());
        assertFalse(ch.isInTenCuaHang());
        assertFalse(ch.isInSku());
        assertEquals("Cửa hàng Mặc Đẹp", ch.getTenCuaHang());
    }

    @Test
    void cauHinh_giaTriHong_veMacDinh() {
        when(dieuHanhHeThongService.getCauHinhString(eq("TEM_KHO_MAC_DINH"), anyString())).thenReturn("A4");
        when(dieuHanhHeThongService.getCauHinhInt(eq("TEM_NGUONG_XAC_NHAN"), anyInt())).thenReturn(0);
        when(thongTinCongTyService.getProfile()).thenReturn(ThongTinCongTyDto.builder().build());

        CauHinhTemDto ch = service.cauHinh();

        assertEquals("35x22", ch.getKho());
        assertEquals(200, ch.getNguongXacNhan());
        assertNull(ch.getTenCuaHang());
    }

    @Test
    void dongTheoIds_giuThuTu_kemSoLuongVaTon_khongCoGiaVon() {
        when(giaBanRepository.bienTheInTem(anyCollection())).thenReturn(List.of(bt(1), bt(2)));

        List<DongInTemDto> ds = service.dongTheoIds(List.of(2, 1, 99), Map.of(2, 12));

        assertEquals(List.of(2, 1), ds.stream().map(DongInTemDto::getBienTheId).toList());
        assertEquals(12, ds.get(0).getSoLuong());
        assertNull(ds.get(1).getSoLuong());
        assertEquals(0, new BigDecimal("7").compareTo(ds.get(0).getTonKho()));
        assertEquals("Nike Sportswear", ds.get(0).getTenSanPham());
        assertEquals("Đen", ds.get(0).getTenMau());
        assertEquals("M", ds.get(0).getKichCo());
    }

    @Test
    void traMa_khongCo_traNull_maRong_baoLoi() {
        when(giaBanRepository.timTheoMa("2000000099")).thenReturn(List.of());
        when(giaBanRepository.timTheoMa("2000000002")).thenReturn(List.of(bt(2)));

        assertNull(service.traMa(" 2000000099 "));
        assertEquals(2, service.traMa("2000000002").getBienTheId());
        assertThrows(CommonException.class, () -> service.traMa("   "));
    }
}
