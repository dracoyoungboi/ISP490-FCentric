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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
        // Chưa đẩy lần nào: không lấy số khả dụng thay vào
        assertNull(dto.getSoLuongDaDay());
        assertNull(dto.getNgayDayTonCuoi());
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

    // ── Đẩy tồn: giả lập Shopify qua spy (moKetNoiDayTon, guiTonLenShopify), không gọi mạng ──

    /** Kết nối giả có các SKU cho trước; inventory item của SKU thứ i là 2000 + i. */
    private KenhBanHangDongBoServiceImpl.KetNoiDayTon ketNoiCo(String... skus) {
        Map<String, KenhBanHangDongBoServiceImpl.ShopifyVariantInfo> skuMap = new HashMap<>();
        for (int i = 0; i < skus.length; i++) {
            skuMap.put(skus[i].toLowerCase(),
                    new KenhBanHangDongBoServiceImpl.ShopifyVariantInfo(1001L + i, 2001L + i, 3001L, null));
        }
        return new KenhBanHangDongBoServiceImpl.KetNoiDayTon("fcentric-store.myshopify.com", "shpat_token", 99L, skuMap, null);
    }

    private KenhBanHangDongBoServiceImpl spyVoiKetNoi(KenhBanHangDongBoServiceImpl.KetNoiDayTon ketNoi) {
        KenhBanHangDongBoServiceImpl spy = spy(service);
        doReturn(ketNoi).when(spy).moKetNoiDayTon(any());
        return spy;
    }

    private void tonKhaDung(int bienTheId, int soLuong) {
        List<Object[]> stock = new java.util.ArrayList<>();
        stock.add(new Object[]{bienTheId, BigDecimal.valueOf(soLuong)});
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(eq(List.of(bienTheId)))).thenReturn(stock);
    }

    /** Dòng thứ hai của cùng kênh: POLO-BLK-L (biến thể 102). */
    private TrangThaiDongBoSanPham dongThuHai() {
        BienTheSanPham bt2 = BienTheSanPham.builder().id(102).sanPham(bienThe1.getSanPham()).maSku("POLO-BLK-L").trangThai(1).build();
        return TrangThaiDongBoSanPham.builder().id(2).kenhBanHang(shopifyKenh).bienTheSanPham(bt2)
                .maSanPhamKenh("48123456790").trangThaiDongBo("thanh_cong").build();
    }

    @Test
    void dayTonKhoLenKenh_shopifyNhan_luuSoVaGioDaDay() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        // 20 × 100% − tồn đệm 2 = 18 (vượt ngưỡng 1)
        DayTonKenhRequest req = DayTonKenhRequest.builder().khoId(1).tyLeDayTon(BigDecimal.valueOf(100)).tonDem(2).nguongVe0(1).build();
        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", req);

        assertEquals(1, result.getSoDong());
        assertEquals(0, result.getSoLoi());
        assertEquals(0, result.getSoChuaDay());
        assertNull(result.getLoiKenh());
        verify(spy).guiTonLenShopify("fcentric-store.myshopify.com", "shpat_token", 99L, 2001L, 18);
        assertEquals(18, mapping1.getSoLuongDaDay());
        assertNotNull(mapping1.getNgayDayTonCuoi());
        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
        assertNotNull(spy.getTongQuan("SHOPIFY").getLanDayTonCuoi());
    }

    @Test
    void dayTonKhoLenKenh_shopifyTuChoiMotSku_chiDongDoSangLoi() {
        TrangThaiDongBoSanPham mapping2 = dongThuHai();
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1, mapping2));
        tonKhaDung(101, 5);
        tonKhaDung(102, 3);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M", "POLO-BLK-L"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), eq(2001L), anyInt());
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiSku("Shopify từ chối số tồn: Inventory item does not have inventory tracking enabled"))
                .when(spy).guiTonLenShopify(any(), any(), any(), eq(2002L), anyInt());

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(1, result.getSoDong());
        assertEquals(1, result.getSoLoi());
        assertNull(result.getLoiKenh());
        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
        assertEquals(5, mapping1.getSoLuongDaDay());
        assertEquals("that_bai", mapping2.getTrangThaiDongBo());
        assertTrue(mapping2.getChiTietLoi().contains("inventory tracking"));
        assertNull(mapping2.getSoLuongDaDay());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
        verify(trangThaiDongBoSanPhamRepository).save(mapping2);
    }

    @Test
    void dayTonKhoLenKenh_skuKhongCoTrenShopify_dongSangLoiKhongGoiShopify() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 5);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo());

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(0, result.getSoDong());
        assertEquals(1, result.getSoLoi());
        assertEquals("that_bai", mapping1.getTrangThaiDongBo());
        assertEquals("Không tìm thấy SKU POLO-BLK-M trên Shopify", mapping1.getChiTietLoi());
        verify(spy, never()).guiTonLenShopify(any(), any(), any(), any(), anyInt());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
        assertNull(spy.getTongQuan("SHOPIFY").getLanDayTonCuoi());
    }

    @Test
    void dayTonKhoLenKenh_chuaCoKhoa_baoLoiKenhKhongDoiDongNao() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        DayTonResultDto result = service.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(0, result.getSoDong());
        assertEquals(0, result.getSoLoi());
        assertEquals(1, result.getSoChuaDay());
        assertTrue(result.getLoiKenh().contains("khóa truy cập"));
        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
        assertNull(mapping1.getChiTietLoi());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
        assertNull(service.getTongQuan("SHOPIFY").getLanDayTonCuoi());
    }

    @Test
    void dayTonKhoLenKenh_loiCaGianHangGiuaChung_dungLaiGiuNguyenDongChuaDay() {
        TrangThaiDongBoSanPham mapping2 = dongThuHai();
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1, mapping2));
        tonKhaDung(101, 5);
        tonKhaDung(102, 3);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M", "POLO-BLK-L"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), eq(2001L), anyInt());
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiCaKenh("Shopify đang giới hạn số lần gọi, vui lòng thử lại sau ít phút"))
                .when(spy).guiTonLenShopify(any(), any(), any(), eq(2002L), anyInt());

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(1, result.getSoDong());
        assertEquals(0, result.getSoLoi());
        assertEquals(1, result.getSoChuaDay());
        assertTrue(result.getLoiKenh().contains("giới hạn"));
        // Dòng đã đẩy được vẫn lưu; dòng gặp lỗi cả gian hàng giữ nguyên để lần sau đẩy lại
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
        verify(trangThaiDongBoSanPhamRepository, never()).save(mapping2);
        assertEquals("thanh_cong", mapping2.getTrangThaiDongBo());
        assertNull(mapping2.getChiTietLoi());
        assertNull(mapping2.getSoLuongDaDay());
    }

    @Test
    void dayTonKhoLenKenh_dongLoiLanTruocDuocDayLaiVaHetLoi() {
        mapping1.setTrangThaiDongBo("that_bai");
        mapping1.setChiTietLoi("Shopify từ chối số tồn (mã 422)");
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 4);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(1, result.getSoDong());
        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
        assertNull(mapping1.getChiTietLoi());
        assertEquals(4, mapping1.getSoLuongDaDay());
    }

    @Test
    void dayTonKhoLenKenh_boQuaDongNgungDongBo() {
        mapping1.setTrangThaiDongBo("chua_dong_bo");
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(0, result.getSoDong());
        assertEquals(0, result.getSoChuaDay());
        verify(spy, never()).guiTonLenShopify(any(), any(), any(), any(), anyInt());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void dayTonKhoKhanCap_kichHoatChoSKUDuoi3Units_luuSoDaDay() {
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 2);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        spy.dayTonKhoKhanCap(101);

        // Chưa lưu quy tắc: 100%, tồn đệm 0, ngưỡng 0 -> đẩy đúng 2
        verify(spy).guiTonLenShopify(any(), any(), any(), eq(2001L), eq(2));
        assertEquals(2, mapping1.getSoLuongDaDay());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void dayTonKhoKhanCap_chuaCoKhoa_khongDoiDong() {
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        service.dayTonKhoKhanCap(101);

        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
    }

    @Test
    void phanLoaiLoiShopify_tachLoiGianHangVaLoiSku() {
        assertTrue(service.phanLoaiLoiShopify(401, null).loiKenh());
        assertTrue(service.phanLoaiLoiShopify(403, null).loiKenh());
        assertTrue(service.phanLoaiLoiShopify(429, null).loiKenh());
        assertTrue(service.phanLoaiLoiShopify(500, null).loiKenh());
        assertTrue(service.phanLoaiLoiShopify(503, null).loiKenh());

        var loi422 = service.phanLoaiLoiShopify(422, "{\"errors\":[\"Inventory item does not have inventory tracking enabled\"]}");
        assertFalse(loi422.loiKenh());
        assertFalse(loi422.thanhCong());
        assertEquals("Shopify từ chối số tồn: Inventory item does not have inventory tracking enabled", loi422.lyDo());

        var loi404 = service.phanLoaiLoiShopify(404, "");
        assertFalse(loi404.loiKenh());
        assertEquals("Shopify từ chối số tồn (mã 404)", loi404.lyDo());
    }

    @Test
    void loiTuShopify_docCacDangBodyLoi() {
        assertEquals("Not Found", service.loiTuShopify("{\"errors\":\"Not Found\"}"));
        assertEquals("a; b", service.loiTuShopify("{\"errors\":[\"a\",\"b\"]}"));
        assertEquals("must be an integer", service.loiTuShopify("{\"errors\":{\"available\":[\"must be an integer\"]}}"));
        assertNull(service.loiTuShopify("<html>Bad Gateway</html>"));
        assertNull(service.loiTuShopify(null));
        assertNull(service.loiTuShopify("{\"product\":{}}"));
    }

    @Test
    void moTaKetQuaDayTon_ghiDungKetQuaVaoNhatKy() {
        assertEquals("Đẩy tồn kho kênh SHOPIFY: 48 SKU thành công",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", 48, 0, 0, null));
        assertEquals("Đẩy tồn kho kênh SHOPIFY: 45 SKU thành công, 3 SKU lỗi",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", 45, 3, 0, null));
        assertEquals("Đẩy tồn kho kênh SHOPIFY thất bại: Chưa có khóa",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", 0, 0, 48, "Chưa có khóa"));
        assertEquals("Đẩy tồn kho kênh SHOPIFY: 10 SKU thành công; dừng giữa chừng, còn 38 SKU chưa đẩy: Shopify lỗi",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", 10, 0, 38, "Shopify lỗi"));
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
    void thuLai_thanhCong_hetLoiVaTraSoDaDay() {
        mapping1.setTrangThaiDongBo("that_bai");
        mapping1.setChiTietLoi("Lỗi kết nối");
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        tonKhaDung(101, 6);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        var res = spy.thuLai(1);

        assertEquals("da_lien_ket", res.getTrangThaiLienKet());
        assertNull(res.getChiTietLoi());
        assertEquals(0, BigDecimal.valueOf(6).compareTo(res.getSoLuongDaDay()));
        assertNotNull(res.getNgayDayTonCuoi());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void thuLai_shopifyTuChoi_ghiLyDoVaoDong() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        tonKhaDung(101, 6);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiSku("Shopify từ chối số tồn (mã 422)"))
                .when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        var res = spy.thuLai(1);

        assertEquals("that_bai", res.getTrangThaiLienKet());
        assertEquals("Shopify từ chối số tồn (mã 422)", res.getChiTietLoi());
        assertNull(res.getSoLuongDaDay());
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
    void thuLai_chuaCoKhoa_baoLoiGiuNguyenDong() {
        mapping1.setTrangThaiDongBo("that_bai");
        mapping1.setChiTietLoi("Lỗi kết nối");
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);

        CommonException ex = assertThrows(CommonException.class, () -> service.thuLai(1));

        assertTrue(ex.getMessage().contains("khóa truy cập"));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals("that_bai", mapping1.getTrangThaiDongBo());
        assertEquals("Lỗi kết nối", mapping1.getChiTietLoi());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void thuLai_loiCaGianHangKhiGui_baoLoiGiuNguyenDong() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        tonKhaDung(101, 6);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiCaKenh("Không kết nối được Shopify, vui lòng thử lại sau"))
                .when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        assertThrows(CommonException.class, () -> spy.thuLai(1));

        assertEquals("thanh_cong", mapping1.getTrangThaiDongBo());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
    }

    @Test
    void filterLienKet_traSoDaDayDaLuuThayViSoKhaDung() {
        Instant luc = Instant.parse("2026-10-16T07:05:00Z");
        mapping1.setSoLuongDaDay(7);
        mapping1.setNgayDayTonCuoi(luc);
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(new PageImpl<>(List.of(mapping1)));
        tonKhaDung(101, 15);

        LienKetSanPhamDto dto = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10)).getContent().get(0);

        assertEquals(0, BigDecimal.valueOf(15).compareTo(dto.getSoLuongKhaDung()));
        assertEquals(0, BigDecimal.valueOf(7).compareTo(dto.getSoLuongDaDay()));
        assertEquals(luc, dto.getNgayDayTonCuoi());
    }
}
