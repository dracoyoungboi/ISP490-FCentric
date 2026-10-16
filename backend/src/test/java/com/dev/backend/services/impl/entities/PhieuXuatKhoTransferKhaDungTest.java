package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietPhieuXuatKho;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Kiểm tồn khi tạo yêu cầu chuyển kho: khả dụng ở kho gửi = (tồn − đang giữ) − chờ xuất của đơn bán đang giữ hàng
 * tại kho đó. Không trừ thêm phần lô phiếu nhặt / phiếu xuất bán giữ (đã nằm trong chờ xuất của chính các đơn ấy).
 */
@ExtendWith(MockitoExtension.class)
class PhieuXuatKhoTransferKhaDungTest {

    private static final int KHO_GUI = 1;
    private static final int KHO_NHAN = 2;
    private static final int BIEN_THE = 93;

    @Mock
    private PhieuXuatKhoRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock
    private LoDangGiuService loDangGiuService;

    private PhieuXuatKhoService service;

    @BeforeEach
    void setUp() {
        service = new PhieuXuatKhoService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(service, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(service, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(service, "loDangGiuService", loDangGiuService);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(IRoleType.quan_tri_vien)).build());

        when(entityManager.find(Kho.class, KHO_GUI)).thenReturn(
                Kho.builder().id(KHO_GUI).maKho("KHO_TONG").tenKho("Kho tổng").trangThai(1).build());
        when(entityManager.find(Kho.class, KHO_NHAN)).thenReturn(
                Kho.builder().id(KHO_NHAN).maKho("CH_01").tenKho("Cửa hàng 1").trangThai(1).build());
        when(entityManager.find(BienTheSanPham.class, BIEN_THE)).thenReturn(
                BienTheSanPham.builder().id(BIEN_THE).maSku("AK-93").build());
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static PhieuChuyenKhoCreating yeuCau(String... soLuong) {
        PhieuChuyenKhoCreating req = new PhieuChuyenKhoCreating();
        req.setKhoXuatId(KHO_GUI);
        req.setKhoNhapId(KHO_NHAN);
        req.setChiTietXuat(java.util.Arrays.stream(soLuong)
                .map(sl -> ChiTietPhieuXuatKhoCreating.builder().bienTheSanPhamId(BIEN_THE).soLuongXuat(new BigDecimal(sl)).build())
                .toList());
        return req;
    }

    /** Kho gửi: tồn − đang giữ = 10. Đơn bán kho gửi đặt 9, đã xuất thật 2 → chờ xuất 7. Kho khác có đơn đặt 50. */
    private void tonVaDonCho(String tonTruGiu, String datKhoGui, String daXuatKhoGui) {
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(KHO_GUI, List.of(BIEN_THE)))
                .thenReturn(List.<Object[]>of(new Object[]{BIEN_THE, new BigDecimal(tonTruGiu)}));
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(List.of(BIEN_THE), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.of(
                        new Object[]{BIEN_THE, KHO_GUI, new BigDecimal(datKhoGui)},
                        new Object[]{BIEN_THE, KHO_NHAN, new BigDecimal("50")}));
        when(chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(List.of(BIEN_THE), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.<Object[]>of(new Object[]{BIEN_THE, KHO_GUI, new BigDecimal(daXuatKhoGui)}));
    }

    private void choPhepLuuPhieu() {
        when(repository.countBySoPhieuXuatStartingWith(anyString())).thenReturn(0L);
        when(repository.save(any(PhieuXuatKho.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void chuyenDungPhanKhaDung_truDonDangCho_khongTruLoHaiLan() {
        tonVaDonCho("10", "9", "2");
        choPhepLuuPhieu();

        service.createTransfer(yeuCau("3"));

        ArgumentCaptor<ChiTietPhieuXuatKho> dong = ArgumentCaptor.forClass(ChiTietPhieuXuatKho.class);
        verify(entityManager).persist(dong.capture());
        assertEquals(0, new BigDecimal("3").compareTo(dong.getValue().getSoLuongXuat()));
        assertEquals(BIEN_THE, dong.getValue().getBienTheSanPham().getId());
        // Phần lô phiếu nhặt / phiếu xuất bán giữ không được trừ thêm
        verifyNoInteractions(loDangGiuService);
    }

    @Test
    void vuotKhaDung_biChan_thongBaoDuSo_khongTaoPhieu() {
        tonVaDonCho("10", "9", "2");

        CommonException ex = assertThrows(CommonException.class, () -> service.createTransfer(yeuCau("4")));

        assertEquals("Sản phẩm [AK-93] chỉ còn 3 có thể chuyển tại kho Kho tổng (tồn trừ phần đang giữ 10, "
                + "đơn bán đang chờ xuất 7). Yêu cầu: 4.", ex.getMessage());
        verify(repository, never()).save(any());
        verify(entityManager, never()).persist(any());
    }

    @Test
    void haiDongCungMa_gopLaiTruocKhiKiem() {
        tonVaDonCho("10", "9", "2");

        CommonException ex = assertThrows(CommonException.class, () -> service.createTransfer(yeuCau("2", "2")));

        assertTrue(ex.getMessage().contains("chỉ còn 3") && ex.getMessage().contains("Yêu cầu: 4."), ex.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void khongCoDonCho_thongBaoKhongKemPhanDonBan() {
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(KHO_GUI, List.of(BIEN_THE)))
                .thenReturn(List.<Object[]>of(new Object[]{BIEN_THE, new BigDecimal("1")}));
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(List.of(BIEN_THE), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.of());
        when(chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(List.of(BIEN_THE), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.of());

        CommonException ex = assertThrows(CommonException.class, () -> service.createTransfer(yeuCau("2")));

        assertEquals("Sản phẩm [AK-93] chỉ còn 1 có thể chuyển tại kho Kho tổng. Yêu cầu: 2.", ex.getMessage());
    }

    @Test
    void donChoVuotTon_khaDungVe0() {
        tonVaDonCho("5", "8", "0");

        CommonException ex = assertThrows(CommonException.class, () -> service.createTransfer(yeuCau("1")));

        assertTrue(ex.getMessage().startsWith("Sản phẩm [AK-93] chỉ còn 0 có thể chuyển"), ex.getMessage());
    }

    @Test
    void soLuongKhongHopLe_biChan_khongTruyVanTon() {
        CommonException ex = assertThrows(CommonException.class, () -> service.createTransfer(yeuCau("0")));

        assertEquals("Số lượng chuyển của sản phẩm [AK-93] phải lớn hơn 0", ex.getMessage());
        verifyNoInteractions(tonKhoTheoLoRepository, chiTietDonBanHangRepository);
    }
}
