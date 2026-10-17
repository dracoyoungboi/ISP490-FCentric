package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MaVachNhaCungCapServiceTest {

    @Mock
    private MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private NhaCungCapRepository nhaCungCapRepository;
    @Mock
    private PhieuNhapKhoRepository phieuNhapKhoRepository;

    private MaVachNhaCungCapServiceImpl service;

    private SanPhamQuanAo sanPham;
    private BienTheSanPham bienThe;
    private NhaCungCap nhaCungCap;
    private MaVachNhaCungCap maVachEntity;

    @BeforeEach
    void setUp() {
        service = new MaVachNhaCungCapServiceImpl(
                maVachNhaCungCapRepository,
                bienTheSanPhamRepository,
                nhaCungCapRepository,
                phieuNhapKhoRepository
        );

        sanPham = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Thun Polo").build();
        bienThe = BienTheSanPham.builder().id(10).maSku("POLO-BLK-M").sanPham(sanPham).build();
        nhaCungCap = NhaCungCap.builder().id(5).tenNhaCungCap("NCC May Mặc Việt").build();

        maVachEntity = MaVachNhaCungCap.builder()
                .id(100)
                .barcodeNcc("893000000123")
                .nhaCungCap(nhaCungCap)
                .bienTheSanPham(bienThe)
                .build();
    }

    @Test
    @DisplayName("Tra cứu mã vạch nội bộ SKU thành công")
    void testTraCuu_MaNoiBoSku_ThanhCong() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("POLO-BLK-M")).thenReturn(Optional.of(bienThe));

        TraCuuMaVachResponse res = service.traCuu("POLO-BLK-M", 5);
        assertNotNull(res);
        assertEquals("FCENTRIC", res.getLoaiMa());
        assertEquals("POLO-BLK-M", res.getSku());
        assertFalse(res.getCanMapNhanh());
    }

    @Test
    @DisplayName("Tra cứu mã vạch NCC đã ánh xạ thành công")
    void testTraCuu_MaNccDaAnhXa_ThanhCong() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("893000000123")).thenReturn(Optional.empty());
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("893000000123", 5))
                .thenReturn(Optional.of(maVachEntity));

        TraCuuMaVachResponse res = service.traCuu("893000000123", 5);
        assertNotNull(res);
        assertEquals("NCC", res.getLoaiMa());
        assertEquals("POLO-BLK-M", res.getSku());
        assertFalse(res.getCanMapNhanh());
    }

    @Test
    @DisplayName("Tra cứu mã lạ trả về cờ yêu cầu mở Popup liên kết")
    void testTraCuu_MaLa_YeuCauLienKet() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("UNKNOWN_BARCODE")).thenReturn(Optional.empty());
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("UNKNOWN_BARCODE", 5))
                .thenReturn(Optional.empty());

        TraCuuMaVachResponse res = service.traCuu("UNKNOWN_BARCODE", 5);
        assertNotNull(res);
        assertEquals("LA", res.getLoaiMa());
        assertTrue(res.getCanMapNhanh());
    }

    @Test
    @DisplayName("Liên kết mã vạch NCC mới thành công")
    void testLienKet_ThanhCong() {
        when(nhaCungCapRepository.findById(5)).thenReturn(Optional.of(nhaCungCap));
        when(bienTheSanPhamRepository.findById(10)).thenReturn(Optional.of(bienThe));
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("893999999999", 5)).thenReturn(Optional.empty());
        when(maVachNhaCungCapRepository.save(any(MaVachNhaCungCap.class))).thenAnswer(inv -> {
            MaVachNhaCungCap m = inv.getArgument(0);
            m.setId(101);
            return m;
        });

        MaVachLienKetRequest req = MaVachLienKetRequest.builder()
                .maVach("893999999999")
                .nhaCungCapId(5)
                .bienTheSanPhamId(10)
                .build();

        MaVachNhaCungCapDto dto = service.lienKet(req);
        assertNotNull(dto);
        assertEquals("893999999999", dto.getMaVach());
        assertEquals("POLO-BLK-M", dto.getSku());
    }

    @Test
    @DisplayName("Liên kết mã vạch thiếu mã báo lỗi BadRequest")
    void testLienKet_ThieuMaVach_BaoLoiBadRequest() {
        MaVachLienKetRequest req = MaVachLienKetRequest.builder()
                .maVach("")
                .nhaCungCapId(5)
                .bienTheSanPhamId(10)
                .build();

        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }
}

