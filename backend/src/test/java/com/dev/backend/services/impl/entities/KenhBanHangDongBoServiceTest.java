package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.dto.response.customize.DongBoTongQuanDto;
import com.dev.backend.dto.response.customize.TuDongLienKetResultDto;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThuongHieu;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.exception.customize.CommonException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhBanHangDongBoServiceTest {

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;
    @Mock
    private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private KenhBanHangService kenhBanHangService;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private AnhQuanAoRepository anhQuanAoRepository;
    @Mock
    private AnhBienTheRepository anhBienTheRepository;
    @Mock
    private MinioService minioService;
    @Mock
    private KhoRepository khoRepository;
    @Mock
    private TonKhoTongHopRepository tonKhoTongHopRepository;
    @Mock
    private com.dev.backend.workers.OmnichannelOrderSyncJob omnichannelOrderSyncJob;
    @Mock
    private DieuHanhHeThongService dieuHanhHeThongService;

    private KenhBanHangDongBoServiceImpl service;

    private KenhBanHang shopifyKenh;
    private BienTheSanPham bienThe1;
    private TrangThaiDongBoSanPham mapping1;

    @BeforeEach
    void setUp() {
        service = new KenhBanHangDongBoServiceImpl(
                kenhBanHangRepository,
                trangThaiDongBoSanPhamRepository,
                bienTheSanPhamRepository,
                tonKhoTheoLoRepository,
                kenhBanHangService,
                lichSuThayDoiService,
                nguoiDungRepository,
                anhQuanAoRepository,
                anhBienTheRepository,
                minioService,
                khoRepository,
                tonKhoTongHopRepository,
                omnichannelOrderSyncJob,
                dieuHanhHeThongService
        );

        shopifyKenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .apiUrl("https://fcentric-store.myshopify.com/admin/api/2024-01")
                .apiKey("shpat_token")
                .trangThai(1)
                .build();

        DanhMucQuanAo dm = DanhMucQuanAo.builder().id(1).tenDanhMuc("Áo Polo").build();
        ThuongHieu th = ThuongHieu.builder().id(1).tenThuongHieu("Routine").build();

        SanPhamQuanAo sp = SanPhamQuanAo.builder()
                .id(10)
                .tenSanPham("Áo Polo FCentric")
                .danhMuc(dm)
                .thuongHieu(th)
                .build();

        bienThe1 = BienTheSanPham.builder()
                .id(101)
                .sanPham(sp)
                .maSku("POLO-BLK-M")
                .giaBan(BigDecimal.valueOf(250000))
                .trangThai(1)
                .build();

        mapping1 = TrangThaiDongBoSanPham.builder()
                .id(1)
                .kenhBanHang(shopifyKenh)
                .bienTheSanPham(bienThe1)
                .maSanPhamKenh("48123456789")
                .trangThaiDongBo("thanh_cong")
                .ngayDongBoCuoi(Instant.now())
                .build();

        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopifyKenh));
        when(trangThaiDongBoSanPhamRepository.save(any(TrangThaiDongBoSanPham.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void tuDongLienKet_thanhCong() {
        when(bienTheSanPhamRepository.findByTrangThai(1)).thenReturn(List.of(bienThe1));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(1, 101)).thenReturn(Optional.empty());

        TuDongLienKetResultDto result = service.tuDongLienKet("SHOPIFY");

        assertNotNull(result);
        assertEquals(1, result.getSoDaGhep());
        verify(trangThaiDongBoSanPhamRepository).save(any(TrangThaiDongBoSanPham.class));
    }

    @Test
    void filterLienKet_traVePageDto() {
        Page<TrangThaiDongBoSanPham> page = new PageImpl<>(List.of(mapping1));
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(page);
        List<Object[]> mockStock = new java.util.ArrayList<>();
        mockStock.add(new Object[]{101, BigDecimal.valueOf(15)});
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any()))
                .thenReturn(mockStock);

        Page<LienKetSanPhamDto> dtos = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10));

        assertNotNull(dtos);
        assertEquals(1, dtos.getTotalElements());
        LienKetSanPhamDto dto = dtos.getContent().get(0);
        assertEquals("POLO-BLK-M", dto.getMaSku());
        assertEquals("da_lien_ket", dto.getTrangThaiLienKet());
        assertEquals(BigDecimal.valueOf(15), dto.getSoLuongKhaDung());
    }

    @Test
    void filterLienKet_traVeMaSanPhamVaAnhChinh() {
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(List.of());
        // Truy vấn trả ảnh chính trước, ảnh phụ sau: phải lấy ảnh chính
        AnhQuanAo anhChinh = AnhQuanAo.builder().id(1).quanAo(bienThe1.getSanPham()).anhChinh(1)
                .tepTin(TepTin.builder().id(1).duongDan("http://minio/fcentric/polo-chinh.jpg").build()).build();
        AnhQuanAo anhPhu = AnhQuanAo.builder().id(2).quanAo(bienThe1.getSanPham()).anhChinh(0)
                .tepTin(TepTin.builder().id(2).duongDan("http://minio/fcentric/polo-phu.jpg").build()).build();
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenReturn(List.of(anhChinh, anhPhu));

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals(10, dto.getSanPhamId());
        assertEquals("http://minio/fcentric/polo-chinh.jpg", dto.getAnhDaiDien());
        verify(anhQuanAoRepository, times(1)).findActiveByQuanAoIds(any());
    }

    @Test
    void filterLienKet_anhChuaCoDuongDanThiDungTenLuuTru() {
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(List.of());
        AnhQuanAo anh = AnhQuanAo.builder().id(1).quanAo(bienThe1.getSanPham()).anhChinh(1)
                .tepTin(TepTin.builder().id(1).tenLuuTru("san-pham/polo.jpg").build()).build();
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenReturn(List.of(anh));
        when(minioService.getPublicUrl("san-pham/polo.jpg")).thenReturn("http://minio/fcentric/san-pham/polo.jpg");

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals("http://minio/fcentric/san-pham/polo.jpg", dto.getAnhDaiDien());
    }

    @Test
    void filterLienKet_anhTheoIpMinioDoiSangHttps() {
        // Web HTTPS chặn ảnh http://IP (Mixed Content) nên phải trả tên miền HTTPS
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(List.of());
        AnhQuanAo anh = AnhQuanAo.builder().id(1).quanAo(bienThe1.getSanPham()).anhChinh(1)
                .tepTin(TepTin.builder().id(1).duongDan("http://171.244.142.43:9000/fashion/polo.jpg").build()).build();
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenReturn(List.of(anh));

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals("https://minio.slmglobal.vn/fashion/polo.jpg", dto.getAnhDaiDien());
    }

    @Test
    void filterLienKet_anhTuTenLuuTruCungDoiSangHttps() {
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(List.of());
        AnhQuanAo anh = AnhQuanAo.builder().id(1).quanAo(bienThe1.getSanPham()).anhChinh(1)
                .tepTin(TepTin.builder().id(1).tenLuuTru("san-pham/polo.jpg").build()).build();
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenReturn(List.of(anh));
        when(minioService.getPublicUrl("san-pham/polo.jpg")).thenReturn("http://171.244.142.43:9000/fashion/san-pham/polo.jpg");

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals("https://minio.slmglobal.vn/fashion/san-pham/polo.jpg", dto.getAnhDaiDien());
    }

    @Test
    void filterLienKet_loiDocAnhVanTraDanhSach() {
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(List.of());
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenThrow(new RuntimeException("mất kết nối"));

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals("POLO-BLK-M", dto.getMaSku());
        assertEquals(10, dto.getSanPhamId());
        assertNull(dto.getAnhDaiDien());
    }

    @Test
    void capNhatLienKet_thanhCong() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        when(bienTheSanPhamRepository.findById(101)).thenReturn(Optional.of(bienThe1));

        CapNhatLienKetRequest req = CapNhatLienKetRequest.builder()
                .bienTheSanPhamId(101)
                .choPhepDongBo(true)
                .build();

        LienKetSanPhamDto dto = service.capNhatLienKet(1, req);

        assertNotNull(dto);
        assertEquals("da_lien_ket", dto.getTrangThaiLienKet());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void dayTonKhoLenKenh_apDungCongThucTonKhaDung() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        // Tồn khả dụng = 20
        List<Object[]> mockStock2 = new java.util.ArrayList<>();
        mockStock2.add(new Object[]{101, BigDecimal.valueOf(20)});
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(eq(List.of(101))))
                .thenReturn(mockStock2);

        DayTonKenhRequest req = DayTonKenhRequest.builder()
                .khoId(1)
                .tyLeDayTon(BigDecimal.valueOf(100))
                .tonDem(2) // 20 - 2 = 18
                .nguongVe0(1)
                .build();

        DayTonResultDto result = service.dayTonKhoLenKenh("SHOPIFY", req);

        assertNotNull(result);
        assertEquals(1, result.getSoDong());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void dayTonKhoKhanCap_kichHoatChoSKUDuoi3Units() {
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));

        service.dayTonKhoKhanCap(101);

        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void getTongQuan_traVeKpiChuan() {
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangId(1)).thenReturn(100L);
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(1, "thanh_cong")).thenReturn(90L);
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(1, "that_bai")).thenReturn(2L);

        DongBoTongQuanDto kpi = service.getTongQuan("SHOPIFY");

        assertNotNull(kpi);
        assertEquals(100L, kpi.getTongSkuSan());
        assertEquals(90L, kpi.getDaLienKet());
        assertEquals(8L, kpi.getChuaLienKet());
        assertEquals(2L, kpi.getLoiDongBo());
    }

    @Test
    void getTongQuan_traChuKyVaLanLayDonTuJob() {
        java.time.Instant layDon = java.time.Instant.parse("2026-10-10T07:26:00Z");
        when(omnichannelOrderSyncJob.getChuKyPhut()).thenReturn(3);
        when(omnichannelOrderSyncJob.getLanLayDonCuoi(1)).thenReturn(layDon);

        DongBoTongQuanDto kpi = service.getTongQuan("SHOPIFY");

        assertEquals(3, kpi.getChuKyDongBoTonPhut());
        assertEquals(3, kpi.getChuKyLayDonPhut());
        assertEquals(layDon, kpi.getLanLayDonCuoi());
        // Chưa đẩy tồn lần nào thì không lấy ngày cập nhật kênh thay vào
        assertNull(kpi.getLanDayTonCuoi());
    }

    @Test
    void getLocations_traVeFallbackKhiChuaCoToken() {
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        var locations = service.getLocations("SHOPIFY");

        assertNotNull(locations);
        assertFalse(locations.isEmpty());
        assertEquals("gid://shopify/Location/default", locations.get(0).getMaKhoSan());
    }

    @Test
    void luuCaiDat_thanhCong() {
        when(khoRepository.existsById(1)).thenReturn(true);

        com.dev.backend.dto.request.KenhBanHangCaiDatRequest req = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder()
                .khoId(1)
                .maKhoSan("loc_123")
                .tyLeDayTon(100)
                .tonDem(0)
                .nguongVe0(0)
                .build();

        DongBoTongQuanDto res = service.luuCaiDat("SHOPIFY", req);

        assertNotNull(res);
        verify(kenhBanHangRepository).save(shopifyKenh);
    }

    @Test
    void filterNhatKy_thanhCong() {
        Page<TrangThaiDongBoSanPham> mockPage = new PageImpl<>(List.of(mapping1), PageRequest.of(0, 10), 1);
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(mockPage);

        var pageRes = service.filterNhatKy("SHOPIFY", null, "THANH_CONG", null, PageRequest.of(0, 10));

        assertNotNull(pageRes);
        assertEquals(1, pageRes.getTotalElements());
        assertEquals("TON_KHO", pageRes.getContent().get(0).getLoai());
    }

    @Test
    void getNhatKyDetail_thanhCong() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));

        var detail = service.getNhatKyDetail(1);

        assertNotNull(detail);
        assertEquals("TON_KHO", detail.getLoai());
        assertEquals("POLO-BLK-M", detail.getMaThamChieu());
    }

    @Test
    void layDonHang_thanhCong() {
        when(omnichannelOrderSyncJob.syncShopifyOrders(eq(shopifyKenh), any(), any())).thenReturn(5);

        com.dev.backend.dto.request.LayDonHangKenhRequest req = com.dev.backend.dto.request.LayDonHangKenhRequest.builder()
                .tu("2026-10-10T00:00:00Z")
                .den("2026-10-11T00:00:00Z")
                .build();

        var res = service.layDonHang("SHOPIFY", req);

        assertNotNull(res);
        assertEquals(5, res.getSoDonMoi());
    }

    @Test
    void dongBoTatCa_thanhCong() {
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(shopifyKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));

        var res = service.dongBoTatCa();

        assertNotNull(res);
        verify(omnichannelOrderSyncJob).syncShopifyOrders(shopifyKenh);
    }

    @Test
    void thuLai_thanhCong() {
        mapping1.setTrangThaiDongBo("that_bai");
        mapping1.setChiTietLoi("Lỗi kết nối");
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));

        var res = service.thuLai(1);

        assertNotNull(res);
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void tinhSoTonDay_apDungTyLeTonDemVaNguong() {
        assertEquals(18, KenhBanHangDongBoServiceImpl.tinhSoTonDay(BigDecimal.valueOf(20), BigDecimal.valueOf(100), 2, 1));
        assertEquals(10, KenhBanHangDongBoServiceImpl.tinhSoTonDay(BigDecimal.valueOf(20), BigDecimal.valueOf(50), 0, 0));
        assertEquals(7, KenhBanHangDongBoServiceImpl.tinhSoTonDay(BigDecimal.valueOf(9), BigDecimal.valueOf(80), 0, 0));
        // 5 - 2 = 3, không vượt ngưỡng 3 -> đẩy 0
        assertEquals(0, KenhBanHangDongBoServiceImpl.tinhSoTonDay(BigDecimal.valueOf(5), BigDecimal.valueOf(100), 2, 3));
        assertEquals(0, KenhBanHangDongBoServiceImpl.tinhSoTonDay(BigDecimal.valueOf(-4), BigDecimal.valueOf(100), 0, 0));
        assertEquals(0, KenhBanHangDongBoServiceImpl.tinhSoTonDay(null, null, 0, 0));
    }

    @Test
    void capNhatLienKet_bienTheDaGhepDongKhac_bao400() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        when(bienTheSanPhamRepository.findById(101)).thenReturn(Optional.of(bienThe1));
        when(trangThaiDongBoSanPhamRepository.existsByKenhBanHangIdAndBienTheSanPhamIdAndIdNot(1, 101, 1)).thenReturn(true);

        CommonException ex = assertThrows(CommonException.class, () -> service.capNhatLienKet(1,
                CapNhatLienKetRequest.builder().bienTheSanPhamId(101).choPhepDongBo(true).build()));

        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void dayTonKhoKhanCap_boQuaDongDangNgung() {
        mapping1.setTrangThaiDongBo("chua_dong_bo");
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));

        service.dayTonKhoKhanCap(101);

        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void dayTonKhoKhanCap_kenhTatTuDongDayTon_boQua() {
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("false");
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));

        service.dayTonKhoKhanCap(101);

        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void thuLai_chuaCoKhoa_ghiThatBaiKemLyDo() {
        mapping1.setTrangThaiDongBo("that_bai");
        mapping1.setChiTietLoi("Lỗi kết nối");
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        var res = service.thuLai(1);

        assertEquals("that_bai", mapping1.getTrangThaiDongBo());
        assertTrue(mapping1.getChiTietLoi().contains("khóa truy cập"));
        assertEquals("that_bai", res.getTrangThaiLienKet());
        assertEquals(0, BigDecimal.ZERO.compareTo(res.getSoLuongDaDay()));
    }
}
