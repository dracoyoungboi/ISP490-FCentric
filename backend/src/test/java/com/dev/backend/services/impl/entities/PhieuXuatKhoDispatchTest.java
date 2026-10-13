package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.XacNhanXuatKhoRequest;
import com.dev.backend.dto.response.customize.XacNhanXuatKhoResponse;
import com.dev.backend.entities.*;
import com.dev.backend.event.DonHangXuatKhoEvent;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PhieuXuatKhoDispatchTest {

    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private EntityManager entityManager;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock private LoHangRepository loHangRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Mock private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    @Mock private SanPhamQuanAoService sanPhamQuanAoService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private ApplicationEventPublisher applicationEventPublisher;

    private PhieuXuatKhoService phieuXuatKhoService;

    private Kho kho;
    private NguoiDung staff;
    private PhieuXuatKho phieu;
    private DonBanHang don;
    private BienTheSanPham variant;
    private LoHang lot;
    private TonKhoTheoLo tonKho;
    private ChiTietPhieuXuatKho pick;
    private ChiTietPhieuXuatKho ctGoc;

    @BeforeEach
    void setUp() {
        phieuXuatKhoService = new PhieuXuatKhoService(phieuXuatKhoRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "entityManager", entityManager);
        ReflectionTestUtils.setField(phieuXuatKhoService, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "loHangRepository", loHangRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "nguoiDungRepository", nguoiDungRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "lichSuGiaoDichKhoRepository", lichSuGiaoDichKhoRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "phanQuyenNguoiDungKhoRepository", phanQuyenNguoiDungKhoRepository);
        ReflectionTestUtils.setField(phieuXuatKhoService, "sanPhamQuanAoService", sanPhamQuanAoService);
        ReflectionTestUtils.setField(phieuXuatKhoService, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(phieuXuatKhoService, "applicationEventPublisher", applicationEventPublisher);

        kho = Kho.builder().id(1).tenKho("Kho Tổng").maKho("KHO_TONG").build();
        staff = NguoiDung.builder().id(99).hoTen("Thủ kho test").tenDangNhap("thukho").build();

        don = DonBanHang.builder()
                .id(10)
                .soDonHang("SO-20261009-001")
                .khoXuat(kho)
                .trangThai(ITrangThaiDonBanHang.DANG_XUAT_KHO) // 2: Đang nhặt / đóng gói
                .build();

        phieu = PhieuXuatKho.builder()
                .id(20)
                .soPhieuXuat("PXK-20261009-001")
                .kho(kho)
                .donBanHang(don)
                .loaiXuat("ban_hang")
                .trangThai(0) // 0: Chờ xuất kho
                .build();

        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(50).build();
        variant = BienTheSanPham.builder().id(100).sanPham(sp).maSku("SKU-AO-001").build();
        lot = LoHang.builder().id(200).maLo("LO-2026-001").giaVon(new BigDecimal("150000.00")).build();

        tonKho = TonKhoTheoLo.builder()
                .id(300)
                .kho(kho)
                .loHang(lot)
                .soLuongTon(new BigDecimal("10.000"))   // On Hand: 10
                .soLuongDaDat(new BigDecimal("5.000"))  // Outgoing: 5
                .build();

        ctGoc = ChiTietPhieuXuatKho.builder()
                .id(399)
                .phieuXuatKho(phieu)
                .bienTheSanPham(variant)
                .loHang(null)
                .soLuongXuat(new BigDecimal("2.000"))
                .build();

        pick = ChiTietPhieuXuatKho.builder()
                .id(400)
                .phieuXuatKho(phieu)
                .bienTheSanPham(variant)
                .loHang(lot)
                .soLuongXuat(new BigDecimal("2.000"))
                .build();
    }

    @Test
    void test_xacNhanXuatKho_banHang_thanhCong() {
        // Given
        XacNhanXuatKhoRequest req = XacNhanXuatKhoRequest.builder()
                .donViVanChuyen("GHTK")
                .maVanDon("GHTK-HN-8849201")
                .phiVanChuyenThucTe(new BigDecimal("35000.00"))
                .ghiChu("Đã giao tài xế")
                .build();

        when(phieuXuatKhoRepository.findById(20)).thenReturn(Optional.of(phieu));
        when(nguoiDungRepository.findById(99)).thenReturn(Optional.of(staff));
        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(20)).thenReturn(List.of(ctGoc));
        when(chiTietPhieuXuatKhoRepository.sumSoLuongDaPick(20, 100)).thenReturn(new BigDecimal("2.000"));
        when(chiTietPhieuXuatKhoRepository.findAll()).thenReturn(List.of(pick));
        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(1, 200)).thenReturn(Optional.of(tonKho));
        when(phieuXuatKhoRepository.save(any(PhieuXuatKho.class))).thenReturn(phieu);
        when(entityManager.find(DonBanHang.class, 10)).thenReturn(don);

        ChiTietDonBanHang ctDon = ChiTietDonBanHang.builder()
                .bienTheSanPham(variant)
                .soLuongDat(new BigDecimal("2.000"))
                .build();
        when(chiTietDonBanHangRepository.findByDonBanHangId(10)).thenReturn(List.of(ctDon));
        when(chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(10, 100)).thenReturn(new BigDecimal("2.000"));

        // When
        XacNhanXuatKhoResponse res = phieuXuatKhoService.xacNhanXuatKho(20, req, 99);

        // Then: 1. Kiểm tra trừ tồn kho vật lý On Hand và giải phóng Outgoing
        assertEquals(new BigDecimal("8.000"), tonKho.getSoLuongTon(), "On Hand (soLuongTon) phải giảm từ 10 xuống 8");
        assertEquals(new BigDecimal("3.000"), tonKho.getSoLuongDaDat(), "Outgoing (soLuongDaDat) phải giải phóng từ 5 xuống 3");
        verify(tonKhoTheoLoRepository).save(tonKho);

        // Then: 2. Kiểm tra SỔ 1 (Thẻ kho vật lý)
        verify(lichSuGiaoDichKhoRepository).save(argThat(h ->
                "xuat_kho".equals(h.getLoaiGiaoDich())
                        && "phieu_xuat_kho".equals(h.getLoaiThamChieu())
                        && h.getSoLuong().compareTo(new BigDecimal("2.000")) == 0
                        && h.getGiaVon().compareTo(new BigDecimal("150000.00")) == 0
        ));

        // Then: 3. Kiểm tra SỔ 2 (Kiểm toán hành vi)
        ArgumentCaptor<LichSuThayDoi> auditCaptor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).create(auditCaptor.capture());
        LichSuThayDoi audit = auditCaptor.getValue();
        assertEquals(ITable.phieu_xuat_kho, audit.getLoaiThamChieu());
        assertEquals(IHanhDong.xuat_kho, audit.getHanhDong());
        assertEquals("trang_thai = 0 (Chờ xuất)", audit.getGiaTriCu());
        assertTrue(audit.getGiaTriMoi().contains("GHTK-HN-8849201"));

        // Then: 4. Kiểm tra trạng thái phiếu và đơn
        assertEquals(3, phieu.getTrangThai(), "Phiếu xuất phải sang trạng thái 3 (Đã xuất)");
        assertEquals(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, don.getTrangThai(), "Đơn bán hàng phải sang trạng thái 3 (Đã xuất toàn bộ / Đang giao)");
        assertEquals(new BigDecimal("35000.00"), don.getPhiVanChuyen(), "Cước vận chuyển phải được cập nhật vào đơn hàng");

        // Then: 5. Kiểm tra phát sự kiện Omnichannel Push
        ArgumentCaptor<DonHangXuatKhoEvent> eventCaptor = ArgumentCaptor.forClass(DonHangXuatKhoEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        DonHangXuatKhoEvent event = eventCaptor.getValue();
        assertEquals("GHTK-HN-8849201", event.getMaVanDon());
        assertEquals("GHTK", event.getDonViVanChuyen());

        // Then: 6. Kiểm tra response trả về
        assertNotNull(res);
        assertEquals(3, res.getTrangThaiPhieu());
        assertEquals(3, res.getTrangThaiDonHang());
        assertEquals("GHTK-HN-8849201", res.getMaVanDon());
    }

    @Test
    void test_xacNhanXuatKho_trangThaiKhongHopLe_nemCommonException() {
        // Given: Phiếu đã xuất trước đó (trangThai = 3)
        phieu.setTrangThai(3);
        when(phieuXuatKhoRepository.findById(20)).thenReturn(Optional.of(phieu));

        // When & Then
        CommonException ex = assertThrows(CommonException.class, () ->
                phieuXuatKhoService.xacNhanXuatKho(20, null, 99)
        );
        assertTrue(ex.getMessage().contains("Phiếu không ở trạng thái chờ xuất"));
    }

    @Test
    void test_complete_backwardCompatibility_delegatesTo_xacNhanXuatKho() {
        // Given
        when(phieuXuatKhoRepository.findById(20)).thenReturn(Optional.of(phieu));
        when(nguoiDungRepository.findById(99)).thenReturn(Optional.of(staff));
        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(20)).thenReturn(List.of(ctGoc));
        when(chiTietPhieuXuatKhoRepository.sumSoLuongDaPick(20, 100)).thenReturn(new BigDecimal("2.000"));
        when(chiTietPhieuXuatKhoRepository.findAll()).thenReturn(List.of(pick));
        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(1, 200)).thenReturn(Optional.of(tonKho));
        when(phieuXuatKhoRepository.save(any(PhieuXuatKho.class))).thenReturn(phieu);
        when(entityManager.find(DonBanHang.class, 10)).thenReturn(don);

        ChiTietDonBanHang ctDon = ChiTietDonBanHang.builder()
                .bienTheSanPham(variant)
                .soLuongDat(new BigDecimal("2.000"))
                .build();
        when(chiTietDonBanHangRepository.findByDonBanHangId(10)).thenReturn(List.of(ctDon));
        when(chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(10, 100)).thenReturn(new BigDecimal("2.000"));

        // When: Gọi complete (endpoint cũ của Frontend)
        phieuXuatKhoService.complete(20, 99);

        // Then: Vẫn trừ kho và chuyển trạng thái sang 3 bình thường
        assertEquals(3, phieu.getTrangThai());
        verify(lichSuThayDoiService).create(any(LichSuThayDoi.class));
    }
}
