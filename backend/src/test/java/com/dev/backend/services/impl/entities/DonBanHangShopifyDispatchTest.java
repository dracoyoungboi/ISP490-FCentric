package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta;
import com.dev.backend.dto.response.customize.KhoKhaDungDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietDonBanHang;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.i18n.TuChoiTruyCapException;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import com.dev.backend.services.shopify.ShopifyOrderRoutingService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DonBanHangShopifyDispatchTest {

    @Mock
    private DonBanHangRepository donBanHangRepository;

    @Mock
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Mock
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Mock
    private KhoRepository khoRepository;

    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private KenhBanHangDongBoService kenhBanHangDongBoService;

    @Mock
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    @Mock
    private ShopifyOrderRoutingService shopifyOrderRoutingService;

    @InjectMocks
    private DonBanHangService donBanHangService;

    @BeforeEach
    void wireFields() {
        ReflectionTestUtils.setField(donBanHangService, "repository", donBanHangRepository);
        ReflectionTestUtils.setField(donBanHangService, "donBanHangRepository", donBanHangRepository);
        ReflectionTestUtils.setField(donBanHangService, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(donBanHangService, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(donBanHangService, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(donBanHangService, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(donBanHangService, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(donBanHangService, "entityManager", entityManager);
        ReflectionTestUtils.setField(donBanHangService, "kenhBanHangDongBoService", kenhBanHangDongBoService);
        ReflectionTestUtils.setField(donBanHangService, "giuChoChuyenKhoService", giuChoChuyenKhoService);
        ReflectionTestUtils.setField(donBanHangService, "shopifyOrderRoutingService", shopifyOrderRoutingService);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clear();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private NguoiDungAuthInfo taoUser(Integer userId, String role, KhoDto kho, Integer laQlk) {
        PhanQuyenNguoiDungKhoDto pq = PhanQuyenNguoiDungKhoDto.builder()
                .kho(kho)
                .laQuanLyKho(laQlk)
                .trangThai(1)
                .build();
        return NguoiDungAuthInfo.builder()
                .id(userId)
                .tenDangNhap("user" + userId)
                .vaiTro(Set.of(role))
                .phanQuyenNguoiDungKhos(kho == null ? List.of() : List.of(pq))
                .build();
    }

    private KhoDto khoTongDto() {
        return KhoDto.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
    }

    private KhoDto khoBranchDto() {
        return KhoDto.builder().id(2).maKho("CN_HCM").tenKho("Kho HCM").loaiKho("cua_hang").trangThai(1).build();
    }

    @Test
    @DisplayName("laQuanLyKhoTong: Chỉ true khi vai trò quan_ly_kho được gán Kho Tổng (loaiKho=kho_tong); QLK chi nhánh và NV kho trả false")
    void laQuanLyKhoTong_xacDinhChinhXac() {
        assertTrue(donBanHangService.laQuanLyKhoTong(taoUser(1, IRoleType.quan_ly_kho, khoTongDto(), 1)));
        assertFalse(donBanHangService.laQuanLyKhoTong(taoUser(2, IRoleType.quan_ly_kho, khoBranchDto(), 1)));
        assertFalse(donBanHangService.laQuanLyKhoTong(taoUser(3, IRoleType.nhan_vien_kho, khoTongDto(), 1)));
        assertFalse(donBanHangService.laQuanLyKhoTong(taoUser(4, IRoleType.quan_ly_kho, null, 0)));
    }

    @Test
    @DisplayName("duocDieuTietDonSan: Quản lý Kho Tổng CHỈ được điều tiết đơn Shopify (khóa Shopee/Lazada/nội bộ); QLK chi nhánh bị khóa toàn bộ")
    void duocDieuTietDonSan_coLapQuyenKhoTongChiVoiShopify() {
        DonBanHang donShopify = DonBanHang.builder()
                .id(10).soDonHang("SHP-1001").trangThai(0)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build())
                .maDonHangKenh("9001").build();
        DonBanHang donShopee = DonBanHang.builder()
                .id(11).soDonHang("SPE-1002").trangThai(0)
                .kenhBanHang(KenhBanHang.builder().id(2).maKenh("SHOPEE").build())
                .maDonHangKenh("SPE-9002").build();
        DonBanHang donLazada = DonBanHang.builder()
                .id(12).soDonHang("LAZ-1003").trangThai(0)
                .kenhBanHang(KenhBanHang.builder().id(3).maKenh("LAZADA").build())
                .maDonHangKenh("LAZ-9003").build();
        DonBanHang donNoiBo = DonBanHang.builder()
                .id(13).soDonHang("SO-1004").trangThai(0).build();

        NguoiDungAuthInfo qlkTong = taoUser(10, IRoleType.quan_ly_kho, khoTongDto(), 1);
        NguoiDungAuthInfo qlkBranch = taoUser(11, IRoleType.quan_ly_kho, khoBranchDto(), 1);
        NguoiDungAuthInfo nvbh = taoUser(12, IRoleType.nhan_vien_ban_hang, null, 0);
        NguoiDungAuthInfo qtv = taoUser(13, IRoleType.quan_tri_vien, null, 0);

        assertTrue(donBanHangService.duocDieuTietDonSan(donShopify, qlkTong));
        assertFalse(donBanHangService.duocDieuTietDonSan(donShopee, qlkTong));
        assertFalse(donBanHangService.duocDieuTietDonSan(donLazada, qlkTong));
        assertFalse(donBanHangService.duocDieuTietDonSan(donNoiBo, qlkTong));

        assertFalse(donBanHangService.duocDieuTietDonSan(donShopify, qlkBranch));
        assertFalse(donBanHangService.duocDieuTietDonSan(donNoiBo, qlkBranch));

        assertTrue(donBanHangService.duocDieuTietDonSan(donShopify, nvbh));
        assertTrue(donBanHangService.duocDieuTietDonSan(donShopee, nvbh));
        assertTrue(donBanHangService.duocDieuTietDonSan(donNoiBo, qtv));
    }

    @Test
    @DisplayName("sendToWarehouse: QLK chi nhánh bấm Gửi sang kho đơn Shopify hoặc QLK Kho Tổng bấm đơn Shopee bị chặn 403 TuChoiTruyCapException")
    void sendToWarehouse_biChan403KhiKhongDuDieuKienDieuTiet() {
        org.springframework.test.util.ReflectionTestUtils.setField(donBanHangService, "repository", donBanHangRepository);

        Kho khoTong = Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        DonBanHang donShopify = DonBanHang.builder()
                .id(50).soDonHang("SHP-5001").loaiChungTu("don_ban_hang").trangThai(0).khoXuat(khoTong)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build()).maDonHangKenh("5001").build();
        DonBanHang donShopee = DonBanHang.builder()
                .id(51).soDonHang("SPE-5002").loaiChungTu("don_ban_hang").trangThai(0).khoXuat(khoTong)
                .kenhBanHang(KenhBanHang.builder().id(2).maKenh("SHOPEE").build()).maDonHangKenh("SPE5002").build();

        DonBanHang donShopifyTaiBranch = DonBanHang.builder()
                .id(52).soDonHang("SHP-5003").loaiChungTu("don_ban_hang").trangThai(0)
                .khoXuat(Kho.builder().id(2).maKho("CN_HCM").tenKho("Kho HCM").loaiKho("cua_hang").trangThai(1).build())
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build()).maDonHangKenh("5003").build();

        when(donBanHangRepository.findById(50)).thenReturn(Optional.of(donShopify));
        when(donBanHangRepository.findById(51)).thenReturn(Optional.of(donShopee));
        when(donBanHangRepository.findById(52)).thenReturn(Optional.of(donShopifyTaiBranch));

        // 1. QLK chi nhánh HCM không có quyền trên đơn thuộc Kho Tổng (bị chặn bởi phạm vi kho)
        SecurityContextHolder.setUser(taoUser(20, IRoleType.quan_ly_kho, khoBranchDto(), 1));
        assertThrows(com.dev.backend.exception.customize.CommonException.class, () -> donBanHangService.sendToWarehouse(50, 2));

        // 2. Kể cả khi đơn Shopify nằm trong kho chi nhánh của QLK chi nhánh, tầng duocDieuTietDonSan vẫn khóa 403
        assertThrows(TuChoiTruyCapException.class, () -> donBanHangService.sendToWarehouse(52, 2));

        // 3. QLK Kho Tổng thử điều tiết đơn Shopee -> 403
        SecurityContextHolder.setUser(taoUser(21, IRoleType.quan_ly_kho, khoTongDto(), 1));
        assertThrows(TuChoiTruyCapException.class, () -> donBanHangService.sendToWarehouse(51, 2));
    }

    @Test
    @DisplayName("sendToWarehouse: Quản lý Kho Tổng điều tiết đơn Shopify sang chi nhánh -> đổi kho xuất (0->1) và gọi chuyenKhoShopifyTheoKhoFCentric")
    void sendToWarehouse_quanLyKhoTongDieuTietShopify_thanhCongVaGoiMove() {
        Kho khoTong = Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        Kho khoHcm = Kho.builder().id(2).maKho("CN_HCM").tenKho("Kho HCM").loaiKho("cua_hang").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(101).maSku("AO-M").build();
        ChiTietDonBanHang ct = ChiTietDonBanHang.builder().id(1).bienTheSanPham(bt).soLuongDat(new BigDecimal("2")).build();
        DonBanHang don = DonBanHang.builder()
                .id(60).soDonHang("SHP-6001").loaiChungTu("don_ban_hang").trangThai(0)
                .khoXuat(khoTong)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build())
                .maDonHangKenh("6001")
                .chiTietDonBanHangs(List.of(ct))
                .build();

        when(donBanHangRepository.findById(60)).thenReturn(Optional.of(don));
        when(chiTietDonBanHangRepository.findByDonBanHangId(60)).thenReturn(List.of(ct));
        when(khoRepository.findById(2)).thenReturn(Optional.of(khoHcm));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(eq(List.of(101))))
                .thenReturn(List.<Object[]>of(new Object[]{101, 2, new BigDecimal("10")}));
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(eq(List.of(101)), any(), any()))
                .thenReturn(List.of());

        SecurityContextHolder.setUser(taoUser(21, IRoleType.quan_ly_kho, khoTongDto(), 1));
        TransactionSynchronizationManager.initSynchronization();

        donBanHangService.sendToWarehouse(60, 2);

        assertEquals(1, don.getTrangThai());
        assertEquals(2, don.getKhoXuat().getId());
        verify(donBanHangRepository).save(don);

        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }
        verify(kenhBanHangDongBoService).chuyenKhoShopifyTheoKhoFCentric("6001", 2);
    }

    @Test
    @DisplayName("getKhoKhaDungChoDonHang: Đánh dấu goiYTuSan = true cho kho trùng gợi ý từ Shopify")
    void getKhoKhaDungChoDonHang_danhDauGoiYTuSan() {
        Kho khoTong = Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        Kho khoHcm = Kho.builder().id(2).maKho("CN_HCM").tenKho("Kho HCM").loaiKho("cua_hang").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(101).maSku("AO-M").build();
        ChiTietDonBanHang ct = ChiTietDonBanHang.builder().id(1).bienTheSanPham(bt).soLuongDat(new BigDecimal("1")).build();
        DonBanHang don = DonBanHang.builder()
                .id(61).soDonHang("SHP-6002").loaiChungTu("don_ban_hang").trangThai(0)
                .khoXuat(khoTong)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build())
                .maDonHangKenh("6002")
                .chiTietDonBanHangs(List.of(ct))
                .build();

        when(donBanHangRepository.findById(61)).thenReturn(Optional.of(don));
        when(chiTietDonBanHangRepository.findByDonBanHangId(61)).thenReturn(List.of(ct));
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong, khoHcm));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(eq(List.of(101))))
                .thenReturn(List.<Object[]>of(
                        new Object[]{101, 1, new BigDecimal("5")},
                        new Object[]{101, 2, new BigDecimal("8")}
                ));
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(eq(List.of(101)), any(), any()))
                .thenReturn(List.of());
        when(shopifyOrderRoutingService.find("6002")).thenReturn(Optional.of(
                ShopifyOrderRoutingMeta.builder().maDonHangKenh("6002").khoDeXuatId(2).deliveryMethodType("PICK_UP").build()
        ));

        SecurityContextHolder.setUser(taoUser(21, IRoleType.quan_ly_kho, khoTongDto(), 1));
        List<KhoKhaDungDto> ds = donBanHangService.getKhoKhaDungChoDonHang(61);

        KhoKhaDungDto hcmDto = ds.stream().filter(k -> k.getKhoId().equals(2)).findFirst().orElseThrow();
        KhoKhaDungDto tongDto = ds.stream().filter(k -> k.getKhoId().equals(1)).findFirst().orElseThrow();
        assertTrue(Boolean.TRUE.equals(hcmDto.getGoiYTuSan()));
        assertFalse(Boolean.TRUE.equals(tongDto.getGoiYTuSan()));
    }
}
