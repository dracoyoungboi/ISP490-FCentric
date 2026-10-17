package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BienBanTraHangServiceTest {

    @Mock
    private BienBanTraHangNccRepository bienBanTraHangNccRepository;
    @Mock
    private ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    @Mock
    private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private LoHangRepository loHangRepository;

    private BienBanTraHangServiceImpl service;

    private PhieuNhapKho phieu;
    private NhaCungCap ncc;
    private NguoiDung nguoiDung;
    private BienTheSanPham bienThe;
    private LoHang loHang;

    @BeforeEach
    void setUp() {
        service = new BienBanTraHangServiceImpl(
                bienBanTraHangNccRepository,
                chiTietTraHangNccRepository,
                phieuNhapKhoRepository,
                nguoiDungRepository,
                bienTheSanPhamRepository,
                loHangRepository
        );

        ncc = NhaCungCap.builder().id(5).tenNhaCungCap("NCC Việt").build();
        nguoiDung = NguoiDung.builder().id(99).hoTen("Trần Kho").build();
        phieu = PhieuNhapKho.builder().id(1).soPhieuNhap("PN2026101701").nhaCungCap(ncc).trangThai(0).build();

        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Polo").build();
        bienThe = BienTheSanPham.builder().id(10).maSku("POLO-01").sanPham(sp).build();
        loHang = LoHang.builder().id(50).maLo("LOT-01").bienTheSanPham(bienThe).build();
    }

    @Test
    @DisplayName("Phát hành biên bản RTV thành công")
    void testPhatHanhBienBan_ThanhCong() {
        when(phieuNhapKhoRepository.findById(1)).thenReturn(Optional.of(phieu));
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.empty());
        when(nguoiDungRepository.findById(99)).thenReturn(Optional.of(nguoiDung));
        when(bienTheSanPhamRepository.findById(10)).thenReturn(Optional.of(bienThe));
        when(loHangRepository.findFirstByMaLo("LOT-01")).thenReturn(Optional.of(loHang));

        when(bienBanTraHangNccRepository.save(any(BienBanTraHangNcc.class))).thenAnswer(inv -> {
            BienBanTraHangNcc b = inv.getArgument(0);
            b.setId(200);
            if (b.getMaBienBan() == null) {
                b.setMaBienBan("RTV-20261017-001");
            }
            return b;
        });

        PhatHanhBienBanRequest.ItemLoiRequest item = PhatHanhBienBanRequest.ItemLoiRequest.builder()
                .bienTheSanPhamId(10)
                .maLo("LOT-01")
                .lyDo("RACH_VAI")
                .soLuong(5)
                .ghiChu("Rách viền cổ")
                .build();

        PhatHanhBienBanRequest req = PhatHanhBienBanRequest.builder()
                .phuongAn("DOI_HANG_MOI")
                .ghiChu("Đổi hàng trong 3 ngày")
                .items(List.of(item))
                .build();

        BienBanTraHangDto res = service.phatHanh(1, req, 99);
        assertNotNull(res);
        assertTrue(res.getSoBienBan().startsWith("RTV-"));
        assertEquals("DOI_HANG_MOI", res.getPhuongAn());
        assertEquals(5, res.getTongSoLuongLoi());
    }

    @Test
    @DisplayName("Phát hành biên bản RTV báo lỗi khi phiếu nhập không có NCC")
    void testPhatHanhBienBan_KhongCoNcc_BaoLoi() {
        phieu.setNhaCungCap(null);
        when(phieuNhapKhoRepository.findById(1)).thenReturn(Optional.of(phieu));

        PhatHanhBienBanRequest req = PhatHanhBienBanRequest.builder()
                .phuongAn("DOI_HANG_MOI")
                .build();

        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(1, req, 99));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("không có thông tin Nhà cung cấp"));
    }
}

