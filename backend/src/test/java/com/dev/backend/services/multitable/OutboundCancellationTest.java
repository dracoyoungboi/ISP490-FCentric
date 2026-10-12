package com.dev.backend.services.multitable;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.customize.HangCanHoanKeDto;
import com.dev.backend.dto.response.customize.ScanToPackResultDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.services.impl.multitable.NhatHangServiceImpl;
import com.dev.backend.websocket.OutboundWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OutboundCancellationTest {

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private DanhSachNhatHangRepository danhSachNhatHangRepository;
    @Mock private ChiTietNhatHangRepository chiTietNhatHangRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private CanhBaoRepository canhBaoRepository;
    @Mock private OutboundWebSocketHandler outboundWebSocketHandler;

    @InjectMocks
    private NhatHangServiceImpl nhatHangService;

    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @InjectMocks
    private PhieuXuatKhoService phieuXuatKhoService;

    private Kho kho;
    private BienTheSanPham bienTheX;
    private DanhSachNhatHang pickList;
    private DonBanHang donA;
    private DonBanHang donB;
    private ChiTietNhatHang chiTietNhat;

    @BeforeEach
    void setUp() {
        kho = Kho.builder().id(1).tenKho("Kho Tổng").build();
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(10).tenSanPham("Áo Polo Nam").build();
        bienTheX = BienTheSanPham.builder().id(100).maSku("POLO-X").sanPham(sp).build();

        pickList = DanhSachNhatHang.builder()
                .id(1)
                .maPickList("PL-20261012-001")
                .khoXuat(kho)
                .trangThai("dang_nhat")
                .build();

        chiTietNhat = ChiTietNhatHang.builder()
                .id(10)
                .danhSachNhatHang(pickList)
                .bienTheSanPham(bienTheX)
                .soLuongCanNhat(BigDecimal.valueOf(11))
                .soLuongDaQuet(BigDecimal.valueOf(11)) // Đã bốc 11 cái
                .build();

        donA = DonBanHang.builder()
                .id(101)
                .soDonHang("SHP-1001")
                .danhSachNhatHang(pickList)
                .khoXuat(kho)
                .trangThai(ITrangThaiDonBanHang.DANG_XUAT_KHO)
                .build();

        donB = DonBanHang.builder()
                .id(102)
                .soDonHang("LZD-2002")
                .danhSachNhatHang(pickList)
                .khoXuat(kho)
                .trangThai(ITrangThaiDonBanHang.DANG_XUAT_KHO)
                .build();

        ChiTietDonBanHang ctdA = ChiTietDonBanHang.builder()
                .donBanHang(donA)
                .bienTheSanPham(bienTheX)
                .soLuongDat(BigDecimal.valueOf(5))
                .build();

        ChiTietDonBanHang ctdB = ChiTietDonBanHang.builder()
                .donBanHang(donB)
                .bienTheSanPham(bienTheX)
                .soLuongDat(BigDecimal.valueOf(6))
                .build();

        when(chiTietDonBanHangRepository.findByDonBanHangId(101)).thenReturn(List.of(ctdA));
        when(chiTietDonBanHangRepository.findByDonBanHangId(102)).thenReturn(List.of(ctdB));
        when(chiTietNhatHangRepository.findByDanhSachNhatHang_Id(1)).thenReturn(new ArrayList<>(List.of(chiTietNhat)));
        when(donBanHangRepository.findByDanhSachNhatHang_Id(1)).thenReturn(List.of(donA, donB));
    }

    /**
     * Trường hợp 1.1: Đang bốc hàng (dang_nhat), đơn A bị hủy.
     * Kỳ vọng:
     * - Số lượng cần nhặt của lô giảm từ 11 xuống 6.
     * - Do đã quét 11 cái nên 5 cái thừa được tạo cảnh báo hoàn kệ Put-back (HOAN_KE_CHO_CAT).
     * - Số lượng đã quét giảm về 6 để giữ cho đơn B.
     * - Bắn WebSocket ORDER_CANCELLED_IN_PICK_LIST.
     */
    @Test
    void truongHop1_dangNhat_donABiHuy_giamCanNhatVaTaoPutBack() {
        donA.setTrangThai(ITrangThaiDonBanHang.DA_HUY);

        nhatHangService.xuLyDonBiHuyTrongPickList(donA);

        assertEquals(BigDecimal.valueOf(6), chiTietNhat.getSoLuongCanNhat());
        assertEquals(BigDecimal.valueOf(6), chiTietNhat.getSoLuongDaQuet());
        verify(chiTietNhatHangRepository).save(chiTietNhat);
        verify(canhBaoRepository).save(any(CanhBao.class));
        verify(outboundWebSocketHandler).sendPickListEvent(eq(1), eq("ORDER_CANCELLED_IN_PICK_LIST"), any());
    }

    /**
     * Trường hợp 1.2: Cả 2 đơn A và B đều bị hủy trong lúc đang nhặt.
     * Kỳ vọng: Toàn bộ Pick List chuyển sang 'da_huy', sinh nhiệm vụ hoàn kệ cho toàn bộ 11 cái.
     */
    @Test
    void truongHop1_dangNhat_caHaiDonBiHuy_huyPickListVaHoanKeToanBo() {
        donA.setTrangThai(ITrangThaiDonBanHang.DA_HUY);
        donB.setTrangThai(ITrangThaiDonBanHang.DA_HUY);

        nhatHangService.xuLyDonBiHuyTrongPickList(donA);

        assertEquals("da_huy", pickList.getTrangThai());
        verify(danhSachNhatHangRepository).save(pickList);
        verify(outboundWebSocketHandler).sendPickListEvent(eq(1), eq("PICK_LIST_CANCELLED"), any());
    }

    /**
     * Trường hợp 2.1: Đã hoàn tất nhặt (da_nhat), đã có PXK nháp.
     * Đơn A bị hủy -> PXK nháp của Đơn A bị chuyển sang 2 (Đã hủy), tạo Put-away task.
     */
    @Test
    void truongHop2_daNhat_donABiHuy_thuHoiPhieuXuatVaTaoPutAway() {
        pickList.setTrangThai("da_nhat");
        donA.setTrangThai(ITrangThaiDonBanHang.DA_HUY);

        PhieuXuatKho pxkA = PhieuXuatKho.builder()
                .id(501)
                .soPhieuXuat("PXK-001")
                .donBanHang(donA)
                .trangThai(0) // Nháp
                .build();

        when(phieuXuatKhoRepository.findByDonBanHangId(101)).thenReturn(List.of(pxkA));

        nhatHangService.xuLyDonBiHuyTrongPickList(donA);

        assertEquals(2, pxkA.getTrangThai()); // 2: Đã hủy / Thu hồi
        verify(phieuXuatKhoRepository).save(pxkA);
        verify(canhBaoRepository).save(any(CanhBao.class));
        verify(outboundWebSocketHandler).sendPickListEvent(eq(1), eq("ORDER_CANCELLED_IN_PACKING"), any());
    }
}
