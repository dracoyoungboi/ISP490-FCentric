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
import org.springframework.test.util.ReflectionTestUtils;

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
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;
    @Mock private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;

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
        // Thu hồi phiếu xuất đi qua PhieuXuatKhoService thật (cùng mock repository) để kiểm tra trạng thái cuối
        ReflectionTestUtils.setField(nhatHangService, "phieuXuatKhoService", phieuXuatKhoService);
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
        when(chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(1)).thenReturn(new ArrayList<>(List.of(chiTietNhat)));
        when(donBanHangRepository.findByDanhSachNhatHang_Id(1)).thenReturn(List.of(donA, donB));
    }

    /**
     * E1 (Log 2): đơn A (5) bị hủy khi phiếu nhặt còn mở → số cần nhặt 11 → 6, phân bổ lô cắt từ lô MỚI NHẤT:
     * L1 (nhập 01/10) × 4 + L2 (nhập 08/10) × 7 → L1 × 4 + L2 × 2 (L2 bớt 5); lô cắt hết thì xóa dòng phân bổ.
     */
    @Test
    void truongHop1_dangNhat_donABiHuy_catPhanBoLoTuLoMoiNhat() {
        LoHang l1 = LoHang.builder().id(1).maLo("L1").bienTheSanPham(bienTheX).build();
        LoHang l2 = LoHang.builder().id(2).maLo("L2").bienTheSanPham(bienTheX).build();
        PhanBoLoNhatHang pb1 = PhanBoLoNhatHang.builder().id(51).chiTietNhatHang(chiTietNhat).loHang(l1).soLuong(BigDecimal.valueOf(4)).build();
        PhanBoLoNhatHang pb2 = PhanBoLoNhatHang.builder().id(52).chiTietNhatHang(chiTietNhat).loHang(l2).soLuong(BigDecimal.valueOf(7)).build();
        when(phanBoLoNhatHangRepository.findByChiTietId(10)).thenReturn(List.of(pb2, pb1));
        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_IdIn(eq(1), any())).thenReturn(List.of(
                TonKhoTheoLo.builder().loHang(l1).ngayNhapGanNhat(java.time.Instant.parse("2026-10-01T00:00:00Z")).build(),
                TonKhoTheoLo.builder().loHang(l2).ngayNhapGanNhat(java.time.Instant.parse("2026-10-08T00:00:00Z")).build()));
        donA.setTrangThai(ITrangThaiDonBanHang.DA_HUY);

        nhatHangService.xuLyDonBiHuyTrongPickList(donA);

        assertEquals(BigDecimal.valueOf(6), chiTietNhat.getSoLuongCanNhat());
        assertEquals(0, BigDecimal.valueOf(4).compareTo(pb1.getSoLuong()), "lô cũ nhất giữ nguyên");
        assertEquals(0, BigDecimal.valueOf(2).compareTo(pb2.getSoLuong()), "lô mới nhất bị cắt 5");
        verify(phanBoLoNhatHangRepository).save(pb2);
        verify(phanBoLoNhatHangRepository, never()).delete(any());
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
     * Đơn A bị hủy -> PXK nháp của Đơn A bị chuyển sang 4 (Đã hủy), tạo Put-away task.
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
        when(phieuXuatKhoRepository.findById(501)).thenReturn(Optional.of(pxkA));

        nhatHangService.xuLyDonBiHuyTrongPickList(donA);

        assertEquals(4, pxkA.getTrangThai()); // 4: Đã hủy (2 là Đã duyệt)
        assertTrue(pxkA.getGhiChu().contains("Tự động hủy do đơn"));
        verify(phieuXuatKhoRepository).save(pxkA);
        verify(canhBaoRepository).save(any(CanhBao.class));
        verify(outboundWebSocketHandler).sendPickListEvent(eq(1), eq("ORDER_CANCELLED_IN_PACKING"), any());
    }
}
