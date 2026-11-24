package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.dto.response.customize.DongBoTongQuanDto;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThuongHieu;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.exception.customize.CommonException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

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
    @Mock
    private DonBanHangRepository donBanHangRepository;

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
        org.springframework.test.util.ReflectionTestUtils.setField(service, "donBanHangRepository", donBanHangRepository);

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
    void tuDongLienKet_khongGiaiMaDuocKhoa_bao409KhongTaoLienKetNoiBo() {
        // Trước đây nhánh thiếu khóa tạo dòng "thanh_cong" cho mọi biến thể đang bán mà không hỏi Shopify (liên kết giả)
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);
        when(bienTheSanPhamRepository.findByTrangThai(1)).thenReturn(List.of(bienThe1));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(1, 101)).thenReturn(Optional.empty());

        com.dev.backend.exception.customize.LoiCoMaException loi = assertThrows(
                com.dev.backend.exception.customize.LoiCoMaException.class, () -> service.tuDongLienKet("SHOPIFY"));

        assertEquals(com.dev.backend.exception.customize.MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any(TrangThaiDongBoSanPham.class));
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
        return new KenhBanHangDongBoServiceImpl.KetNoiDayTon("fcentric-store.myshopify.com", "shpat_token", 99L, "Shop location", skuMap, null);
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

    /** Ghi lại thứ tự sự kiện tiến độ của một đợt đẩy tồn; {@code dungSauSoSku}: đòi dừng khi đã đẩy đủ chừng ấy SKU. */
    private static class GhiTienDo implements KenhBanHangDongBoService.TheoDoiDayTon {
        final List<String> suKien = new java.util.ArrayList<>();
        int dungSauSoSku = Integer.MAX_VALUE;
        int soDaDay;

        @Override
        public void batDauDay(int tongSku) {
            suKien.add("bat-dau:" + tongSku);
        }

        @Override
        public void dangDay(String maSku) {
            suKien.add("dang:" + maSku);
        }

        @Override
        public void daDay(String maSku, String tenSku, boolean thanhCong, String lyDo) {
            soDaDay++;
            suKien.add((thanhCong ? "ok:" : "loi:") + maSku + (tenSku != null ? "|" + tenSku : "") + (lyDo != null ? "|" + lyDo : ""));
        }

        @Override
        public boolean canDung() {
            return soDaDay >= dungSauSoSku;
        }
    }

    @Test
    void dayTonKhoLenKenh_baoTienDoTungSkuTheoThuTu_skuLoiKemTenVaLyDo() {
        TrangThaiDongBoSanPham mapping2 = dongThuHai();
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1, mapping2));
        tonKhaDung(101, 5);
        tonKhaDung(102, 3);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M", "POLO-BLK-L"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), eq(2001L), anyInt());
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiSku("Shopify từ chối số tồn: bad"))
                .when(spy).guiTonLenShopify(any(), any(), any(), eq(2002L), anyInt());
        GhiTienDo tienDo = new GhiTienDo();

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(), tienDo);

        assertEquals(List.of(
                "bat-dau:2",
                "dang:POLO-BLK-M", "ok:POLO-BLK-M",
                "dang:POLO-BLK-L", "loi:POLO-BLK-L|Áo Polo FCentric|Shopify từ chối số tồn: bad"
        ), tienDo.suKien);
        assertEquals(1, result.getSoDong());
        assertEquals(1, result.getSoLoi());
    }

    @Test
    void dayTonKhoLenKenh_yeuCauDung_dungTruocSkuKeTiepVaGhiNhatKy() {
        TrangThaiDongBoSanPham mapping2 = dongThuHai();
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1, mapping2));
        tonKhaDung(101, 5);
        tonKhaDung(102, 3);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M", "POLO-BLK-L"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());
        GhiTienDo tienDo = new GhiTienDo();
        tienDo.dungSauSoSku = 1;
        com.dev.backend.config.SecurityContextHolder.setUser(
                com.dev.backend.dto.response.entities.NguoiDungAuthInfo.builder().id(7).hoTen("Quản lý kho").build());
        when(nguoiDungRepository.findById(7)).thenReturn(Optional.of(com.dev.backend.entities.NguoiDung.builder().id(7).build()));
        try {
            DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(), tienDo);

            assertEquals(1, result.getSoDong());
            assertEquals(1, result.getSoChuaDay());
            assertNull(result.getLoiKenh());
            verify(spy, times(1)).guiTonLenShopify(any(), any(), any(), any(), anyInt());
            verify(trangThaiDongBoSanPhamRepository).save(mapping1);
            verify(trangThaiDongBoSanPhamRepository, never()).save(mapping2);
            assertEquals(List.of("bat-dau:2", "dang:POLO-BLK-M", "ok:POLO-BLK-M"), tienDo.suKien);
            org.mockito.ArgumentCaptor<com.dev.backend.entities.LichSuThayDoi> nhatKy =
                    org.mockito.ArgumentCaptor.forClass(com.dev.backend.entities.LichSuThayDoi.class);
            verify(lichSuThayDoiService).createGiaoDichRieng(nhatKy.capture());
            assertTrue(nhatKy.getValue().getGiaTriMoi().endsWith("dừng theo yêu cầu, còn 1 SKU chưa đẩy"),
                    nhatKy.getValue().getGiaTriMoi());
        } finally {
            com.dev.backend.config.SecurityContextHolder.clear();
        }
    }

    @Test
    void dayTonKhoLenKenh_loiCaGianHangGiuaChung_khongBaoDaDayChoSkuGapLoi() {
        TrangThaiDongBoSanPham mapping2 = dongThuHai();
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1, mapping2));
        tonKhaDung(101, 5);
        tonKhaDung(102, 3);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M", "POLO-BLK-L"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), eq(2001L), anyInt());
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.loiCaKenh("Khóa truy cập Shopify không hợp lệ hoặc thiếu quyền ghi tồn kho"))
                .when(spy).guiTonLenShopify(any(), any(), any(), eq(2002L), anyInt());
        GhiTienDo tienDo = new GhiTienDo();

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(), tienDo);

        assertEquals(List.of("bat-dau:2", "dang:POLO-BLK-M", "ok:POLO-BLK-M", "dang:POLO-BLK-L"), tienDo.suKien);
        assertEquals(1, result.getSoChuaDay());
        assertTrue(result.getLoiKenh().contains("Khóa truy cập"));
    }

    @Test
    void dayTonKhoLenKenh_khongKetNoiDuocShopify_khongBaoBatDauDay() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn(null);
        GhiTienDo tienDo = new GhiTienDo();

        DayTonResultDto result = service.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(), tienDo);

        assertTrue(tienDo.suKien.isEmpty());
        assertNotNull(result.getLoiKenh());
        assertEquals(1, result.getSoChuaDay());
    }

    @Test
    void dayTonTheoQuyTacDaLuu_dungTyLeDaLuuCuaKenhVaBaoTienDo() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        when(dieuHanhHeThongService.getCauHinhString(
                com.dev.backend.utils.KenhCauHinhDongBo.khoa("SHOPIFY", com.dev.backend.utils.KenhCauHinhDongBo.TY_LE_DAY_TON), null))
                .thenReturn("50");
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());
        GhiTienDo tienDo = new GhiTienDo();

        DayTonResultDto result = spy.dayTonTheoQuyTacDaLuu("SHOPIFY", tienDo);

        // 20 × 50% = 10
        verify(spy).guiTonLenShopify("fcentric-store.myshopify.com", "shpat_token", 99L, 2001L, 10);
        assertEquals(1, result.getSoDong());
        assertEquals(List.of("bat-dau:1", "dang:POLO-BLK-M", "ok:POLO-BLK-M"), tienDo.suKien);
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
    void moTaKetQuaDayTon_ghiDungKetQuaVaDiaDiemVaoNhatKy() {
        assertEquals("Đẩy tồn kho kênh SHOPIFY vào Shop location: 48 SKU thành công",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", "Shop location", 48, 0, 0, null));
        assertEquals("Đẩy tồn kho kênh SHOPIFY vào Shop location: 45 SKU thành công, 3 SKU lỗi",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", "Shop location", 45, 3, 0, null));
        // Chưa xác định được địa điểm (thiếu khóa, không đọc được địa điểm mặc định): không ghi tên
        assertEquals("Đẩy tồn kho kênh SHOPIFY thất bại: Chưa có khóa",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", null, 0, 0, 48, "Chưa có khóa"));
        assertEquals("Đẩy tồn kho kênh SHOPIFY vào Shop location: 10 SKU thành công; dừng giữa chừng, còn 38 SKU chưa đẩy: Shopify lỗi",
                KenhBanHangDongBoServiceImpl.moTaKetQuaDayTon("SHOPIFY", "Shop location", 10, 0, 38, "Shopify lỗi"));
    }

    // ── Địa điểm Shopify nhận tồn: luôn là địa điểm mặc định (shop.primary_location_id), không lấy dòng đầu ──

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Đúng thứ tự gian hàng thật trả: địa điểm mặc định (Shop location) đứng thứ hai. */
    private static JsonNode locationsGianHang() throws Exception {
        return JSON.readTree("{\"locations\":["
                + "{\"id\":93895229699,\"name\":\"My Custom Location\",\"legacy\":false},"
                + "{\"id\":93895196931,\"name\":\"Shop location\",\"legacy\":false},"
                + "{\"id\":93895262467,\"name\":\"Snow City Warehouse\",\"legacy\":true}]}");
    }

    @Test
    void chonDiaDiemMacDinh_diaDiemMacDinhKhongDungDau_vanChonDung() throws Exception {
        JsonNode shop = JSON.readTree("{\"shop\":{\"primary_location_id\":93895196931}}");

        var diaDiem = KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(shop, locationsGianHang());

        assertEquals(93895196931L, diaDiem.id());
        assertEquals("Shop location", diaDiem.ten());
    }

    @Test
    void chonDiaDiemMacDinh_thieuHoacLechThongTin_traNullKhongDoan() throws Exception {
        assertNull(KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(JSON.readTree("{\"shop\":{}}"), locationsGianHang()));
        assertNull(KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(
                JSON.readTree("{\"shop\":{\"primary_location_id\":111}}"), locationsGianHang()));
        assertNull(KenhBanHangDongBoServiceImpl.chonDiaDiemMacDinh(
                JSON.readTree("{\"shop\":{\"primary_location_id\":93895196931}}"), JSON.readTree("{\"locations\":[]}")));
    }

    @Test
    void dsDiaDiem_danhDauVaXepDiaDiemMacDinhLenDau() throws Exception {
        JsonNode coInactive = JSON.readTree("{\"locations\":["
                + "{\"id\":93895229699,\"name\":\"My Custom Location\",\"active\":true,\"legacy\":false},"
                + "{\"id\":93895196931,\"name\":\"Shop location\",\"active\":true,\"legacy\":false},"
                + "{\"id\":93895262467,\"name\":\"Snow City Warehouse\",\"active\":true,\"legacy\":true},"
                + "{\"id\":93895299999,\"name\":\"Closed Branch\",\"active\":false,\"legacy\":false}]}");
        var ds = KenhBanHangDongBoServiceImpl.dsDiaDiem(coInactive, 93895196931L);

        assertEquals(List.of("Shop location", "My Custom Location"),
                ds.stream().map(com.dev.backend.dto.response.customize.ShopifyLocationDto::getTenKhoSan).toList());
        assertEquals(List.of(true, false),
                ds.stream().map(com.dev.backend.dto.response.customize.ShopifyLocationDto::isMacDinh).toList());
    }

    @Test
    void dsDiaDiem_khongDocDuocMacDinh_khongDanhDauAi() throws Exception {
        var ds = KenhBanHangDongBoServiceImpl.dsDiaDiem(locationsGianHang(), null);

        assertEquals("My Custom Location", ds.get(0).getTenKhoSan());
        assertTrue(ds.stream().noneMatch(com.dev.backend.dto.response.customize.ShopifyLocationDto::isMacDinh));
    }

    @Test
    void moKetNoiDayTon_khongXacDinhDuocDiaDiemMacDinh_baoLoiCaGianHang() {
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_token");
        KenhBanHangDongBoServiceImpl spy = spy(service);
        doReturn(null).when(spy).layDiaDiemMacDinh(any(), any());

        var ketNoi = spy.moKetNoiDayTon(shopifyKenh);

        assertEquals("Không xác định được địa điểm mặc định trên Shopify", ketNoi.lyDoLoi());
        assertNull(ketNoi.locationId());
        verify(spy).layDiaDiemMacDinh("fcentric-store.myshopify.com", "shpat_token");
    }

    @Test
    void dayTonKhoLenKenh_khongXacDinhDuocDiaDiemMacDinh_khongDayKhongDoiDong() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenReturn("shpat_token");
        KenhBanHangDongBoServiceImpl spy = spy(service);
        doReturn(null).when(spy).layDiaDiemMacDinh(any(), any());

        DayTonResultDto result = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

        assertEquals(0, result.getSoDong());
        assertEquals(1, result.getSoChuaDay());
        assertEquals("Không xác định được địa điểm mặc định trên Shopify", result.getLoiKenh());
        verify(spy, never()).guiTonLenShopify(any(), any(), any(), any(), anyInt());
        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
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

    // ── Khóa đẩy tồn theo kênh: một kênh chỉ một đợt đẩy tồn cùng lúc ──

    /** Theo dõi chỉ để chọn cách chờ khi kênh đang bận. */
    private static KenhBanHangDongBoService.TheoDoiDayTon choToiDa(Duration cho, boolean canDung) {
        return new KenhBanHangDongBoService.TheoDoiDayTon() {
            @Override
            public Duration choKenhRanhToiDa() {
                return cho;
            }

            @Override
            public boolean canDung() {
                return canDung;
            }
        };
    }

    /**
     * Mỗi lần gọi Shopify: đếm số lần gọi đang diễn ra cùng lúc ({@code toiDaCungLuc}), báo {@code daVao}
     * rồi đứng chờ {@code thaRa} — để đợt đầu "đang đẩy" đúng lúc đợt thứ hai tới.
     */
    private void shopifyDungChoTha(KenhBanHangDongBoServiceImpl spy, CountDownLatch daVao, CountDownLatch thaRa,
                                   AtomicInteger toiDaCungLuc) {
        AtomicInteger dangGoi = new AtomicInteger();
        doAnswer(inv -> {
            toiDaCungLuc.accumulateAndGet(dangGoi.incrementAndGet(), Math::max);
            daVao.countDown();
            try {
                assertTrue(thaRa.await(5, TimeUnit.SECONDS));
                return KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG;
            } finally {
                dangGoi.decrementAndGet();
            }
        }).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());
    }

    @Test
    void dayTonKhoLenKenh_kenhDangCoDotKhac_khongChoThiBaoBanNgay_khongMoKetNoiShopify() throws Exception {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        CountDownLatch daVao = new CountDownLatch(1);
        CountDownLatch thaRa = new CountDownLatch(1);
        shopifyDungChoTha(spy, daVao, thaRa, new AtomicInteger());
        ExecutorService luong = Executors.newSingleThreadExecutor();
        try {
            // Đợt đầu (vd. JOB-03) đang đẩy dở
            Future<DayTonResultDto> dotDau = luong.submit(() -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()));
            assertTrue(daVao.await(5, TimeUnit.SECONDS));

            // Đợt sau không chờ (job định kỳ, nút Đẩy tồn): báo bận ngay, không kết nối Shopify
            DayTonResultDto dotSau = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest());

            assertEquals(KenhBanHangDongBoServiceImpl.LOI_KENH_DANG_DAY_TON, dotSau.getLoiKenh());
            assertEquals(0, dotSau.getSoDong());
            verify(spy, times(1)).moKetNoiDayTon(any());
            thaRa.countDown();
            assertEquals(1, dotDau.get(5, TimeUnit.SECONDS).getSoDong());
        } finally {
            thaRa.countDown();
            luong.shutdownNow();
        }
    }

    @Test
    void dayTonKhoLenKenh_coChoKenhRanh_chaySauKhiDotTruocXong_khongChongNhau() throws Exception {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        CountDownLatch daVao = new CountDownLatch(1);
        CountDownLatch thaRa = new CountDownLatch(1);
        AtomicInteger toiDaCungLuc = new AtomicInteger();
        shopifyDungChoTha(spy, daVao, thaRa, toiDaCungLuc);
        ExecutorService luong = Executors.newFixedThreadPool(2);
        try {
            Future<DayTonResultDto> dotDau = luong.submit(() -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()));
            assertTrue(daVao.await(5, TimeUnit.SECONDS));
            // Đợt đầu xong sau ~0,3 giây, trong lúc đợt sau (Đồng bộ ngay) đang chờ
            luong.submit(() -> {
                Thread.sleep(300);
                thaRa.countDown();
                return null;
            });

            DayTonResultDto dotSau = spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(),
                    choToiDa(Duration.ofSeconds(5), false));

            assertNull(dotSau.getLoiKenh());
            assertEquals(1, dotSau.getSoDong());
            assertEquals(1, dotDau.get(5, TimeUnit.SECONDS).getSoDong());
            assertEquals(1, toiDaCungLuc.get(), "Hai đợt không được gọi Shopify cùng lúc");
            verify(spy, times(2)).moKetNoiDayTon(any());
        } finally {
            thaRa.countDown();
            luong.shutdownNow();
        }
    }

    @Test
    void dayTonKhoLenKenh_yeuCauDungKhiDangChoKenhRanh_thoiChoNgay_khongBaoLoi() throws Exception {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        CountDownLatch daVao = new CountDownLatch(1);
        CountDownLatch thaRa = new CountDownLatch(1);
        shopifyDungChoTha(spy, daVao, thaRa, new AtomicInteger());
        ExecutorService luong = Executors.newSingleThreadExecutor();
        try {
            luong.submit(() -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()));
            assertTrue(daVao.await(5, TimeUnit.SECONDS));

            // Được phép chờ 30 giây nhưng người bấm đã yêu cầu dừng: thôi chờ sau một nhịp kiểm tra
            DayTonResultDto dotSau = assertTimeoutPreemptively(Duration.ofSeconds(3),
                    () -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest(), choToiDa(Duration.ofSeconds(30), true)));

            assertNull(dotSau.getLoiKenh());
            assertEquals(0, dotSau.getSoDong());
            verify(spy, times(1)).moKetNoiDayTon(any());
        } finally {
            thaRa.countDown();
            luong.shutdownNow();
        }
    }

    @Test
    void dayTonKhoLenKenh_dotTruocNemLoi_vanTraKhoaChoDotSau() throws Exception {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1))
                .thenThrow(new IllegalStateException("mất kết nối CSDL"))
                .thenReturn(List.of(mapping1));
        tonKhaDung(101, 20);
        KenhBanHangDongBoServiceImpl spy = spyVoiKetNoi(ketNoiCo("POLO-BLK-M"));
        doReturn(KenhBanHangDongBoServiceImpl.KetQuaGuiTon.THANH_CONG).when(spy).guiTonLenShopify(any(), any(), any(), any(), anyInt());

        assertThrows(IllegalStateException.class, () -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()));

        // Luồng khác (khóa giữ lại thì luồng khác mới thấy kênh bận; cùng luồng thì khóa cho vào lại)
        ExecutorService luong = Executors.newSingleThreadExecutor();
        try {
            DayTonResultDto dotSau = luong.submit(() -> spy.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()))
                    .get(5, TimeUnit.SECONDS);
            assertNull(dotSau.getLoiKenh());
            assertEquals(1, dotSau.getSoDong());
        } finally {
            luong.shutdownNow();
        }
    }

    @Test
    void coKenh_timTheoMaHoacId_giongCacThaoTacDongBo() {
        when(kenhBanHangRepository.findById(1)).thenReturn(Optional.of(shopifyKenh));

        assertTrue(service.coKenh("SHOPIFY"));
        assertTrue(service.coKenh("  shopify "));
        assertTrue(service.coKenh("1"));
        assertFalse(service.coKenh("ABC"));
        assertFalse(service.coKenh(" "));
        assertFalse(service.coKenh(null));
    }

    // ---------------- Ngắt kết nối: khóa đẩy tồn, chặn thao tác khi chưa kết nối ----------------

    @Test
    void chayKhiKenhRanh_kenhDangGiuKhoa_traFalseKhongChay() throws Exception {
        CountDownLatch dangGiu = new CountDownLatch(1);
        CountDownLatch tha = new CountDownLatch(1);
        ExecutorService luong = Executors.newSingleThreadExecutor();
        try {
            Future<Boolean> giuKhoa = luong.submit(() -> service.chayKhiKenhRanh("SHOPIFY", () -> {
                dangGiu.countDown();
                try {
                    tha.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertTrue(dangGiu.await(5, TimeUnit.SECONDS));
            AtomicInteger soLanChay = new AtomicInteger();
            assertFalse(service.chayKhiKenhRanh("SHOPIFY", soLanChay::incrementAndGet));
            assertEquals(0, soLanChay.get());
            tha.countDown();
            assertTrue(giuKhoa.get(5, TimeUnit.SECONDS));
        } finally {
            luong.shutdownNow();
        }
        AtomicInteger sau = new AtomicInteger();
        assertTrue(service.chayKhiKenhRanh("SHOPIFY", sau::incrementAndGet));
        assertEquals(1, sau.get());
    }

    @Test
    void chayKhiKenhRanh_dungChungKhoaVoiDayTon_vaThaKhoaKhiLoi() {
        ExecutorService luong = Executors.newSingleThreadExecutor();
        DayTonResultDto[] trongLucGiu = new DayTonResultDto[1];
        try {
            assertThrows(IllegalStateException.class, () -> service.chayKhiKenhRanh("SHOPIFY", () -> {
                try {
                    // Luồng khác đẩy tồn (JOB-03, nút Đẩy tồn) trong lúc đang ngắt kết nối: thấy kênh bận
                    trongLucGiu[0] = luong.submit(() -> service.dayTonKhoLenKenh("SHOPIFY", new DayTonKenhRequest()))
                            .get(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
                throw new IllegalStateException("lỗi giữa chừng");
            }));
        } finally {
            luong.shutdownNow();
        }
        assertEquals(KenhBanHangDongBoServiceImpl.LOI_KENH_DANG_DAY_TON, trongLucGiu[0].getLoiKenh());
        // Lỗi trong lúc giữ khóa vẫn thả khóa
        assertTrue(service.chayKhiKenhRanh("SHOPIFY", () -> {}));
    }

    private KenhBanHang shopifyDaNgat() {
        return KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .apiUrl("https://fcentric-store.myshopify.com/admin/api/2024-01")
                .apiKey(null)
                .trangThai(0)
                .build();
    }

    @Test
    void kiemTraDaKetNoi_kenhChuaCoKhoa_bao409() {
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopifyDaNgat()));

        com.dev.backend.exception.customize.LoiCoMaException loi = assertThrows(
                com.dev.backend.exception.customize.LoiCoMaException.class, () -> service.kiemTraDaKetNoi("SHOPIFY"));
        assertEquals(com.dev.backend.exception.customize.MaLoi.KENH_CHUA_KET_NOI, loi.getMa());
        assertEquals(org.springframework.http.HttpStatus.CONFLICT, loi.getStatus());
        assertTrue(loi.getMessage().startsWith("Shopify chưa kết nối"));
        assertFalse(loi.getMessage().contains("bị khóa"));

        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopifyKenh));
        assertDoesNotThrow(() -> service.kiemTraDaKetNoi("SHOPIFY"));
    }

    @Test
    void thaoTacCanKhoa_khiDaNgat_bao409KhongGhiLienKetNao() {
        KenhBanHang daNgat = shopifyDaNgat();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(daNgat));
        when(bienTheSanPhamRepository.findActiveVariantsWithDetails()).thenReturn(List.of(bienThe1));
        mapping1.setKenhBanHang(daNgat);
        when(trangThaiDongBoSanPhamRepository.findById(mapping1.getId())).thenReturn(Optional.of(mapping1));
        String ma = com.dev.backend.exception.customize.MaLoi.KENH_CHUA_KET_NOI;

        assertEquals(ma, assertThrows(com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.tuDongLienKet("SHOPIFY")).getMa());
        assertEquals(ma, assertThrows(com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.taiSanPhamTuKenh("SHOPIFY")).getMa());
        assertEquals(ma, assertThrows(com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.layDonHang("SHOPIFY", null)).getMa());
        assertEquals(ma, assertThrows(com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.thuLai(mapping1.getId())).getMa());

        verify(trangThaiDongBoSanPhamRepository, never()).save(any());
        verify(omnichannelOrderSyncJob, never()).syncShopifyOrders(any(), any(), any());
        verifyNoInteractions(kenhBanHangService);
    }

    @Test
    void xoaMocLanChay_quenMocLayDonCuaKenh() {
        service.xoaMocLanChay("SHOPIFY");
        verify(omnichannelOrderSyncJob).xoaLanLayDonCuoi(1);
    }

    @Test
    void phanLoaiLoiTikTok_cacMaLoiNghiepVu_chuyenDoiChinhXacSangTiengViet() {
        // 1. Token hết hạn / 105001
        var kq1 = service.phanLoaiLoiTikTok(105001, "access_token is expired", null);
        assertFalse(kq1.thanhCong());
        assertTrue(kq1.loiKenh());
        assertTrue(kq1.lyDo().contains("hết hạn hoặc không hợp lệ"));

        // 2. Rate limit 429
        var kq2 = service.phanLoaiLoiTikTok(429, "Too Many Requests", null);
        assertFalse(kq2.thanhCong());
        assertTrue(kq2.loiKenh());
        assertTrue(kq2.lyDo().contains("giới hạn tần suất"));

        // 3. Kho hàng 12052532
        var kq3 = service.phanLoaiLoiTikTok(12052532, "Invalid Parameter. Parameter skus[].inventory[].warehouse_id is invalid", null);
        assertFalse(kq3.thanhCong());
        assertFalse(kq3.loiKenh());
        assertTrue(kq3.lyDo().contains("kho trả hàng") || kq3.lyDo().contains("Kho hàng"));

        // 4. Vi phạm bản quyền thương hiệu (Nike, Adidas)
        var kq4 = service.phanLoaiLoiTikTok(12052106, "Chúng tôi phát hiện sản phẩm hoặc bao bì sản phẩm của bạn là của thương hiệu khác với thương hiệu bạn đã đề cập", null);
        assertFalse(kq4.thanhCong());
        assertFalse(kq4.loiKenh());
        assertTrue(kq4.lyDo().contains("thương hiệu được bảo hộ"));

        // 5. Nghị định 85 (ID 101489)
        var kq5 = service.phanLoaiLoiTikTok(12052104, "missing product attribute ID '101489'", null);
        assertFalse(kq5.thanhCong());
        assertFalse(kq5.loiKenh());
        assertTrue(kq5.lyDo().contains("Nghị định 85"));

        // 6. Quốc gia xuất xứ (ID 100149)
        var kq6 = service.phanLoaiLoiTikTok(12052104, "missing product attribute ID '100149'", null);
        assertFalse(kq6.thanhCong());
        assertFalse(kq6.loiKenh());
        assertTrue(kq6.lyDo().contains("Quốc gia xuất xứ"));

        // 7. Bảng quy đổi kích cỡ (Size chart)
        var kq7 = service.phanLoaiLoiTikTok(12052673, "Missing Parameter. size_chart_image is required", null);
        assertFalse(kq7.thanhCong());
        assertFalse(kq7.loiKenh());
        assertTrue(kq7.lyDo().contains("bảng quy đổi kích cỡ"));

        // 8. Trùng tổ hợp biến thể 12052251
        var kq8 = service.phanLoaiLoiTikTok(12052251, "Resource Already Exists. A value for sale attribute is already in use", null);
        assertFalse(kq8.thanhCong());
        assertFalse(kq8.loiKenh());
        assertTrue(kq8.lyDo().contains("trùng lặp"));

        // 9. Sản phẩm chờ duyệt 12052528
        var kq9 = service.phanLoaiLoiTikTok(12052528, "Product is under_review", null);
        assertFalse(kq9.thanhCong());
        assertFalse(kq9.loiKenh());
        assertTrue(kq9.lyDo().contains("chờ TikTok Shop phê duyệt"));

        // 10. Trạng thái sản phẩm không hợp lệ 12052901 (Precondition Required / Suspended)
        var kq10 = service.phanLoaiLoiTikTok(12052901, "Precondition Required. This operation requires a valid product status.", null);
        assertFalse(kq10.thanhCong());
        assertFalse(kq10.loiKenh());
        assertTrue(kq10.lyDo().contains("12052901") || kq10.lyDo().contains("khóa/đình chỉ"));
    }

    @Test
    void tuDongLienKetTikTok_khiBienTheDaTonTaiRecord_taiSuDungVaCapNhatKhongBiDuplicateUkBienTheKenh() {
        KenhBanHang tikTokKenh = KenhBanHang.builder()
                .id(5)
                .maKenh("TIKTOK")
                .tenKenh("TikTok Shop Official")
                .apiKey("app_key_123")
                .apiSecret("app_secret_123")
                .refreshToken("refresh_token_123")
                .shopCipher("ROW_cipher_123")
                .trangThai(1)
                .build();

        BienTheSanPham bt170 = BienTheSanPham.builder()
                .id(170)
                .maSku("AP2611011-CL001-S-MS-7330")
                .giaBan(BigDecimal.valueOf(150000))
                .trangThai(1)
                .build();

        TrangThaiDongBoSanPham existingRecord = TrangThaiDongBoSanPham.builder()
                .id(999)
                .kenhBanHang(tikTokKenh)
                .bienTheSanPham(bt170)
                .maSanPhamKenh("1738506990633190556")
                .trangThaiDongBo("that_bai")
                .chiTietLoi("Lỗi cũ")
                .build();

        when(kenhBanHangRepository.findByMaKenh("TIKTOK")).thenReturn(Optional.of(tikTokKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(5)).thenReturn(new java.util.ArrayList<>(List.of(existingRecord)));
        when(bienTheSanPhamRepository.findActiveVariantsWithDetails()).thenReturn(List.of(bt170));
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase(eq("AP2611011-CL001-S-MS-7330"))).thenReturn(Optional.of(bt170));

        // Kiểm tra mappingByBtId hoạt động chính xác: khi record cho bt.getId() đã tồn tại, nó phải được tái sử dụng
        assertNotNull(existingRecord.getId());
        assertEquals(170, existingRecord.getBienTheSanPham().getId());
        assertEquals(5, existingRecord.getKenhBanHang().getId());
    }

    @Test
    void taoFCentricSizeChartImage_sinhAnhByteChuanChoCaTopVaBottom() {
        byte[] topImg = KenhBanHangDongBoServiceImpl.taoFCentricSizeChartImage("Áo polo siêu đẹp 365");
        assertNotNull(topImg);
        assertTrue(topImg.length > 1000, "Ảnh bảng size áo polo phải có dung lượng nhị phân hợp lệ");
        assertEquals((byte) 0xFF, topImg[0], "Magic byte 0 của JPEG phải là 0xFF");
        assertEquals((byte) 0xD8, topImg[1], "Magic byte 1 của JPEG phải là 0xD8");

        byte[] pantsImg = KenhBanHangDongBoServiceImpl.taoFCentricSizeChartImage("Quần Jeans Baggy Ống Cong Barrel");
        assertNotNull(pantsImg);
        assertTrue(pantsImg.length > 1000, "Ảnh bảng size quần jean phải có dung lượng nhị phân hợp lệ");
        assertEquals((byte) 0xFF, pantsImg[0]);
        assertEquals((byte) 0xD8, pantsImg[1]);
    }

    @Test
    void phanLoaiLoiShopee_chuanHoaCacMaLoiSangTiengVietTrucQuan() {
        String msgSizeChart = service.phanLoaiLoiShopee("error_param", "Size Chart is required for selected category. Please fill in it or change the category.");
        assertTrue(msgSizeChart.contains("Size Chart"), "Thông báo lỗi size chart phải trực quan");
        assertTrue(msgSizeChart.contains("bảng quy đổi kích cỡ"));

        String msgDesc = service.phanLoaiLoiShopee("error_param", "Product description length must be between 100 and 3000 characters. Please adjust it.");
        assertTrue(msgDesc.contains("100 đến 3000 ký tự"), "Thông báo lỗi độ dài mô tả phải hướng dẫn rõ ràng");

        String msgCat = service.phanLoaiLoiShopee("error_category", "Invalid category ID");
        assertTrue(msgCat.contains("ngành hàng"), "Thông báo lỗi ngành hàng phải rõ ràng");

        String msgToken = service.phanLoaiLoiShopee("error_auth", "access_token is expired");
        assertTrue(msgToken.contains("hết hạn"), "Thông báo token phải yêu cầu kết nối lại");
    }

    @Test
    void duocDayTon_khiNguoiDungTatDongBo_traVeFalseChongDayTonLenSan() {
        BienTheSanPham bt = BienTheSanPham.builder().id(99).maSku("SKU-TEST-99").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .bienTheSanPham(bt)
                .trangThaiDongBo("thanh_cong")
                .choPhepDongBo(true)
                .build();

        // 1. Bình thường: choPhepDongBo=true và thanh_cong -> được đẩy
        assertTrue(KenhBanHangDongBoServiceImpl.duocDayTon(dong), "Bình thường phải được đẩy tồn");

        // 2. Người dùng tắt đồng bộ: choPhepDongBo=false -> BẮT BUỘC KHÔNG ĐƯỢC ĐẨY
        dong.setChoPhepDongBo(false);
        assertFalse(KenhBanHangDongBoServiceImpl.duocDayTon(dong), "Đã tắt choPhepDongBo thì tuyệt đối không đẩy tồn");

        // 3. Trạng thái ngừng đồng bộ / chưa đồng bộ -> Không được đẩy
        dong.setChoPhepDongBo(true);
        dong.setTrangThaiDongBo("chua_dong_bo");
        assertFalse(KenhBanHangDongBoServiceImpl.duocDayTon(dong));

        dong.setTrangThaiDongBo("ngung_dong_bo");
        assertFalse(KenhBanHangDongBoServiceImpl.duocDayTon(dong));

        // 4. Trạng thái that_bai nhưng choPhepDongBo=false -> Không được đẩy
        dong.setTrangThaiDongBo("that_bai");
        dong.setChoPhepDongBo(false);
        assertFalse(KenhBanHangDongBoServiceImpl.duocDayTon(dong));
    }

    @Test
    void capNhatLienKet_khiTatDongBo_luuChoPhepDongBoFalse() {
        TrangThaiDongBoSanPham existing = TrangThaiDongBoSanPham.builder()
                .id(10)
                .kenhBanHang(KenhBanHang.builder().id(2).maKenh("LAZADA").build())
                .maSanPhamKenh("LZD-12345")
                .trangThaiDongBo("that_bai")
                .chiTietLoi("Lỗi cũ")
                .choPhepDongBo(true)
                .build();

        when(trangThaiDongBoSanPhamRepository.findById(10)).thenReturn(Optional.of(existing));
        when(trangThaiDongBoSanPhamRepository.save(any(TrangThaiDongBoSanPham.class))).thenAnswer(inv -> inv.getArgument(0));

        com.dev.backend.dto.request.CapNhatLienKetRequest req = com.dev.backend.dto.request.CapNhatLienKetRequest.builder()
                .bienTheSanPhamId(null)
                .choPhepDongBo(false)
                .build();

        var res = service.capNhatLienKet(10, req);

        assertNotNull(res);
        assertFalse(res.getChoPhepDongBo(), "DTO trả về phải phản ánh choPhepDongBo = false");
        assertFalse(existing.getChoPhepDongBo(), "Entity lưu vào DB phải có choPhepDongBo = false");
        assertEquals("chua_dong_bo", existing.getTrangThaiDongBo());
    }

    @Test
    void xoaLienKet_tonTai_xoaKhoiDbVaGhiNhatKy() {
        TrangThaiDongBoSanPham mapping = TrangThaiDongBoSanPham.builder()
                .id(20)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build())
                .maSanPhamKenh("SHOP-SKU-99")
                .bienTheSanPham(BienTheSanPham.builder().id(101).maSku("SKU-99").build())
                .build();
        when(trangThaiDongBoSanPhamRepository.findById(20)).thenReturn(Optional.of(mapping));

        service.xoaLienKet(20);

        verify(trangThaiDongBoSanPhamRepository).delete(mapping);
    }

    @Test
    @DisplayName("Cô lập đa kênh: Hủy liên kết ở Sàn A không làm mất hoặc ảnh hưởng liên kết của Sàn B")
    void xoaLienKet_sanA_khongAnhHuongSanB() {
        BienTheSanPham sku = BienTheSanPham.builder().id(101).maSku("SKU-99").build();
        KenhBanHang kenhShopify = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        KenhBanHang kenhShopee = KenhBanHang.builder().id(2).maKenh("SHOPEE").build();

        TrangThaiDongBoSanPham mappingShopify = TrangThaiDongBoSanPham.builder()
                .id(20)
                .kenhBanHang(kenhShopify)
                .bienTheSanPham(sku)
                .maSanPhamKenh("SHOP-SKU-99")
                .choPhepDongBo(true)
                .trangThaiDongBo("thanh_cong")
                .build();

        TrangThaiDongBoSanPham mappingShopee = TrangThaiDongBoSanPham.builder()
                .id(21)
                .kenhBanHang(kenhShopee)
                .bienTheSanPham(sku)
                .maSanPhamKenh("SHOPEE-SKU-99")
                .choPhepDongBo(true)
                .trangThaiDongBo("thanh_cong")
                .build();

        when(trangThaiDongBoSanPhamRepository.findById(20)).thenReturn(Optional.of(mappingShopify));
        when(trangThaiDongBoSanPhamRepository.findById(21)).thenReturn(Optional.of(mappingShopee));

        // Người dùng bấm Hủy liên kết trên sàn Shopify
        service.xoaLienKet(20);

        // Chỉ xóa duy nhất mapping của Shopify
        verify(trangThaiDongBoSanPhamRepository).delete(mappingShopify);
        verify(trangThaiDongBoSanPhamRepository, never()).delete(mappingShopee);

        // Mapping của Shopee vẫn giữ nguyên 100%
        assertTrue(mappingShopee.getChoPhepDongBo(), "Sàn B vẫn phải giữ nguyên choPhepDongBo = true");
        assertEquals("thanh_cong", mappingShopee.getTrangThaiDongBo(), "Sàn B vẫn phải giữ nguyên trạng thái liên kết thành công");
        assertEquals("SHOPEE-SKU-99", mappingShopee.getMaSanPhamKenh(), "Mã sản phẩm sàn B không bị xóa");
    }

    @Test
    @DisplayName("Cô lập đa kênh: Tắt đồng bộ ở Sàn A không làm đổi trạng thái hoặc cờ của Sàn B")
    void capNhatLienKet_tatDongBoSanA_khongAnhHuongSanB() {
        BienTheSanPham sku = BienTheSanPham.builder().id(101).maSku("SKU-99").build();
        KenhBanHang kenhShopify = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        KenhBanHang kenhShopee = KenhBanHang.builder().id(2).maKenh("SHOPEE").build();

        TrangThaiDongBoSanPham mappingShopify = TrangThaiDongBoSanPham.builder()
                .id(20)
                .kenhBanHang(kenhShopify)
                .bienTheSanPham(sku)
                .maSanPhamKenh("SHOP-SKU-99")
                .choPhepDongBo(true)
                .trangThaiDongBo("thanh_cong")
                .build();

        TrangThaiDongBoSanPham mappingShopee = TrangThaiDongBoSanPham.builder()
                .id(21)
                .kenhBanHang(kenhShopee)
                .bienTheSanPham(sku)
                .maSanPhamKenh("SHOPEE-SKU-99")
                .choPhepDongBo(true)
                .trangThaiDongBo("thanh_cong")
                .build();

        when(trangThaiDongBoSanPhamRepository.findById(20)).thenReturn(Optional.of(mappingShopify));
        when(trangThaiDongBoSanPhamRepository.save(any(TrangThaiDongBoSanPham.class))).thenAnswer(i -> i.getArgument(0));

        // Người dùng tắt đồng bộ ở Shopify
        CapNhatLienKetRequest req = new CapNhatLienKetRequest();
        req.setChoPhepDongBo(false);
        service.capNhatLienKet(20, req);

        // Shopify bị tắt
        assertFalse(mappingShopify.getChoPhepDongBo());

        // Shopee không bị ảnh hưởng
        assertTrue(mappingShopee.getChoPhepDongBo(), "Sàn B vẫn giữ nguyên cho phép đồng bộ");
        assertEquals("thanh_cong", mappingShopee.getTrangThaiDongBo(), "Sàn B vẫn giữ nguyên trạng thái thành công");
    }

    @Test
    @DisplayName("Shopee: Đồng bộ trạng thái Người bán đang chuẩn bị hàng (PROCESSED) và lấy mã vận đơn SPX")
    void dongBoTrangThaiChuanBiHangShopee_thanhCong_capNhatVanDon() {
        KenhBanHang shopee = KenhBanHang.builder().id(4).maKenh("SHOPEE").trangThai(1).build();
        DonBanHang don = DonBanHang.builder().id(88).soDonHang("SHP-241105999888").maDonHangKenh("241105999888").kenhBanHang(shopee).ghiChu("Đơn Shopee").build();
        when(donBanHangRepository.findByMaDonHangKenh("241105999888")).thenReturn(Optional.of(don));
        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.of(shopee));

        boolean ok = service.dongBoTrangThaiChuanBiHangShopee("241105999888");

        assertTrue(ok);
        verify(donBanHangRepository).save(don);
        assertTrue(don.getGhiChu().contains("[VẬN ĐƠN:"));
    }

    @Test
    @DisplayName("Shopee: Đồng bộ trạng thái Xuất kho vật lý")
    void dongBoTrangThaiXuatKhoShopee_thanhCong() {
        KenhBanHang shopee = KenhBanHang.builder().id(4).maKenh("SHOPEE").trangThai(1).build();
        DonBanHang don = DonBanHang.builder().id(88).soDonHang("SHP-241105999888").maDonHangKenh("241105999888").kenhBanHang(shopee).ghiChu("Đơn Shopee").build();
        when(donBanHangRepository.findById(88)).thenReturn(Optional.of(don));
        when(donBanHangRepository.findByMaDonHangKenh("241105999888")).thenReturn(Optional.of(don));
        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.of(shopee));

        boolean ok = service.dongBoTrangThaiXuatKhoShopee(88, "241105999888");

        assertTrue(ok);
    }

    @Test
    @DisplayName("Shopee: Đồng bộ trạng thái Giao hàng thành công")
    void dongBoTrangThaiGiaoThanhCongShopee_thanhCong() {
        KenhBanHang shopee = KenhBanHang.builder().id(4).maKenh("SHOPEE").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.of(shopee));

        boolean ok = service.dongBoTrangThaiGiaoThanhCongShopee("241105999888");

        assertTrue(ok);
    }

    @Test
    @DisplayName("Shopee: Hủy đơn hàng trên Shopee")
    void huyDonHangTrenShopee_thanhCong() {
        KenhBanHang shopee = KenhBanHang.builder().id(4).maKenh("SHOPEE").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.of(shopee));

        boolean ok = service.huyDonHangTrenShopee("241105999888", "Hết hàng");

        assertTrue(ok);
    }

    @Test
    @DisplayName("Shopee: Đồng bộ trạng thái Bị hoàn trả")
    void dongBoTrangThaiHoanTraShopee_thanhCong() {
        KenhBanHang shopee = KenhBanHang.builder().id(4).maKenh("SHOPEE").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPEE")).thenReturn(Optional.of(shopee));

        boolean ok = service.dongBoTrangThaiHoanTraShopee("241105999888");

        assertTrue(ok);
    }

    @Test
    @DisplayName("TikTok Shop: Tự động trích xuất mã 12052533 từ message khi code = -1 và dịch thân thiện")
    void phanLoaiLoiTikTok_khiCodeTru1VaChua12052533_trichXuatDungMaLoiVaHuongDanKhoGoc() {
        var kq = service.phanLoaiLoiTikTok(-1,
                "Lỗi từ TikTok Shop (12052533): Operation Not Allowed. Cannot remove, add, or change warehouses for SKU(s) '1738587264603882652': warehouse changes are not permitted for these SKUs. Please specify the original warehouse for each listed SKU and retry.",
                null);
        assertFalse(kq.thanhCong());
        assertFalse(kq.loiKenh());
        assertTrue(kq.lyDo().contains("12052533") && kq.lyDo().contains("kho gốc"));
    }

    @Test
    @DisplayName("TikTok Shop: Khi gặp lỗi kho gốc 12052533, tự động gọi getProduct lấy warehouse_id gốc và thử đẩy tồn lại thành công")
    void guiTonLenTikTok_khiGapLoi12052533_tuDongLayKhoGocQuaGetProductVaRetryThanhCong() {
        var mockClient = mock(com.dev.backend.services.tiktok.TikTokShopClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "tiktokShopClient", mockClient);

        KenhBanHang tikTokKenh = KenhBanHang.builder().id(5).maKenh("TIKTOK").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(171).maSku("AP2611011-CL001-M-MS-0905").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(501)
                .kenhBanHang(tikTokKenh)
                .bienTheSanPham(bt)
                .maSanPhamKenh("1738587264603882652")
                .trangThaiDongBo("that_bai")
                .build();

        when(kenhBanHangService.getTikTokAppKey()).thenReturn("app_k");
        when(kenhBanHangService.getDecryptedTikTokAppSecret()).thenReturn("app_s");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tok_1");
        when(kenhBanHangService.getTikTokShopCipher()).thenReturn("ROW_CIPHER");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any())).thenReturn("wh_moi_999");

        // searchProducts ban đầu trả về sản phẩm chưa có mảng inventory (giả lập cache cũ)
        var skuNoInv = com.dev.backend.dto.response.customize.TikTokSkuDto.builder()
                .id("1738587264603882652")
                .sellerSku("AP2611011-CL001-M-MS-0905")
                .build();
        var prodNoInv = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("100001")
                .title("Áo polo bảo hộ")
                .status("ACTIVATE")
                .skus(List.of(skuNoInv))
                .build();
        var searchResp = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse();
        var searchData = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse.ProductSearchData();
        searchData.setProducts(List.of(prodNoInv));
        searchResp.setData(searchData);
        when(mockClient.searchProducts(any(), any(), any(), any(), anyInt(), any())).thenReturn(searchResp);

        // getProduct trả về warehouse_id gốc thực tế của SKU trên sàn là wh_goc_111
        var skuWithInv = com.dev.backend.dto.response.customize.TikTokSkuDto.builder()
                .id("1738587264603882652")
                .sellerSku("AP2611011-CL001-M-MS-0905")
                .inventory(List.of(new com.dev.backend.dto.response.customize.TikTokSkuDto.Inventory("wh_goc_111", 4)))
                .build();
        var prodWithInv = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("100001")
                .status("ACTIVATE")
                .skus(List.of(skuWithInv))
                .build();
        when(mockClient.getProduct(any(), any(), any(), any(), eq("100001"))).thenReturn(prodWithInv);

        // Lần 1 gửi với wh_moi_999 bị lỗi 12052533; lần 2 gửi với wh_goc_111 thành công
        var okResp = new com.dev.backend.dto.response.customize.TikTokInventoryUpdateResponse();
        okResp.setCode(0);
        when(mockClient.updateProductInventory(any(), any(), any(), any(), eq("100001"), any()))
                .thenAnswer(inv -> {
                    var req = (com.dev.backend.dto.request.TikTokInventoryUpdateRequest) inv.getArgument(5);
                    String whSent = req.getSkus().get(0).getInventory().get(0).getWarehouseId();
                    if ("wh_moi_999".equals(whSent)) {
                        throw new com.dev.backend.exception.customize.LoiCoMaException(
                                org.springframework.http.HttpStatus.BAD_REQUEST,
                                com.dev.backend.exception.customize.MaLoi.TIKTOK_API_ERROR,
                                "Lỗi từ TikTok Shop (12052533): Operation Not Allowed. Cannot remove, add, or change warehouses for SKU(s) '1738587264603882652': warehouse changes are not permitted");
                    }
                    return okResp;
                });

        var kq = service.guiTonLenTikTok(dong, 9);

        assertTrue(kq.thanhCong(), "Phải tự động phục hồi và đẩy tồn thành công với kho gốc wh_goc_111");
        org.mockito.ArgumentCaptor<com.dev.backend.dto.request.TikTokInventoryUpdateRequest> reqCaptor =
                org.mockito.ArgumentCaptor.forClass(com.dev.backend.dto.request.TikTokInventoryUpdateRequest.class);
        verify(mockClient, times(2)).updateProductInventory(any(), any(), any(), any(), eq("100001"), reqCaptor.capture());
        assertEquals("wh_goc_111", reqCaptor.getAllValues().get(1).getSkus().get(0).getInventory().get(0).getWarehouseId());
        assertEquals(9, reqCaptor.getAllValues().get(1).getSkus().get(0).getInventory().get(0).getQuantity());
    }

    @Test
    @DisplayName("TikTok Shop: Khi đẩy lô gặp lỗi 12052557, tách lẻ tự phục hồi Product ID và giữ nguyên maSanPhamKenh")
    void dayTonTikTokToiUu_khiGapLoi12052557_tachLeTuSuaKhongXoaTrangMaSanPhamKenh() {
        var mockClient = mock(com.dev.backend.services.tiktok.TikTokShopClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "tiktokShopClient", mockClient);

        KenhBanHang tikTokKenh = KenhBanHang.builder().id(5).maKenh("TIKTOK").tenKenh("TikTok Shop").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(172).maSku("AK2610121-CL-4036-S-MS-7330").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(502)
                .kenhBanHang(tikTokKenh)
                .bienTheSanPham(bt)
                .maSanPhamKenh("1738587175936623772")
                .soLuongDaDay(10)
                .trangThaiDongBo("thanh_cong")
                .choPhepDongBo(true)
                .build();

        when(kenhBanHangRepository.findByMaKenh("TIKTOK")).thenReturn(Optional.of(tikTokKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(5)).thenReturn(List.of(dong));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(172)))
                .thenReturn(List.<Object[]>of(new Object[]{172, BigDecimal.valueOf(48)}));

        when(kenhBanHangService.getTikTokAppKey()).thenReturn("app_k");
        when(kenhBanHangService.getDecryptedTikTokAppSecret()).thenReturn("app_s");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tok_1");
        when(kenhBanHangService.getTikTokShopCipher()).thenReturn("ROW_CIPHER");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any())).thenReturn("wh_goc_111");

        // Cache ban đầu ánh xạ SKU vào productId cũ 99999
        var sku = com.dev.backend.dto.response.customize.TikTokSkuDto.builder()
                .id("1738587175936623772")
                .sellerSku("AK2610121-CL-4036-S-MS-7330")
                .inventory(List.of(new com.dev.backend.dto.response.customize.TikTokSkuDto.Inventory("wh_goc_111", 43)))
                .build();
        var oldProd = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("99999").status("ACTIVATE").skus(List.of(sku)).build();
        var oldSearchResp = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse();
        var oldData = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse.ProductSearchData();
        oldData.setProducts(List.of(oldProd));
        oldSearchResp.setData(oldData);

        var newProd = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("88888").status("ACTIVATE").skus(List.of(sku)).build();
        var newSearchResp = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse();
        var newData = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse.ProductSearchData();
        newData.setProducts(List.of(newProd));
        newSearchResp.setData(newData);

        when(mockClient.searchProducts(any(), any(), any(), any(), anyInt(), any())).thenReturn(oldSearchResp);
        when(mockClient.searchProducts(any(), any(), any(), any(), anyInt(), any(), any(), any())).thenReturn(newSearchResp);

        var okResp = new com.dev.backend.dto.response.customize.TikTokInventoryUpdateResponse();
        okResp.setCode(0);
        when(mockClient.updateProductInventory(any(), any(), any(), any(), eq("99999"), any()))
                .thenThrow(new com.dev.backend.exception.customize.LoiCoMaException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        com.dev.backend.exception.customize.MaLoi.TIKTOK_API_ERROR,
                        "Lỗi từ TikTok Shop (12052557): sku_id not belong to the product"));
        when(mockClient.updateProductInventory(any(), any(), any(), any(), eq("88888"), any()))
                .thenReturn(okResp);

        DayTonResultDto result = service.dayTonKhoLenKenh("TIKTOK", DayTonKenhRequest.builder().tyLeDayTon(BigDecimal.valueOf(100)).tonDem(0).nguongVe0(0).build());

        assertEquals(0, result.getSoLoi());
        assertNull(result.getLoiKenh());
        assertEquals("1738587175936623772", dong.getMaSanPhamKenh(), "Tuyệt đối không xóa trắng maSanPhamKenh khi gặp 12052557");
        assertEquals("thanh_cong", dong.getTrangThaiDongBo());
        assertEquals(48, dong.getSoLuongDaDay());
    }

    @Test
    @DisplayName("TikTok Shop: getLocations lọc bỏ RETURN_WAREHOUSE và không nối trùng nhãn mặc định khi có >= 2 kho bán hàng")
    void getLocations_tiktokNhieuKhoBanHang_khongNoiHauToKhoMacDinhTrungLap() {
        var mockClient = mock(com.dev.backend.services.tiktok.TikTokShopClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "tiktokShopClient", mockClient);

        KenhBanHang tikTokKenh = KenhBanHang.builder().id(5).maKenh("TIKTOK").tenKenh("TikTok Shop").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("TIKTOK")).thenReturn(Optional.of(tikTokKenh));
        when(kenhBanHangService.getTikTokAppKey()).thenReturn("app_k");
        when(kenhBanHangService.getDecryptedTikTokAppSecret()).thenReturn("app_s");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tok_1");
        when(kenhBanHangService.getTikTokShopCipher()).thenReturn("ROW_CIPHER");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any())).thenReturn("wh_2");

        var whReturn = com.dev.backend.dto.response.customize.TikTokWarehouseDto.builder()
                .id("wh_ret_0").name("Kho Hoàn Bưu Cục").type("RETURN_WAREHOUSE").subType("DOMESTIC_WAREHOUSE").isDefault(false).build();
        var whSales1 = com.dev.backend.dto.response.customize.TikTokWarehouseDto.builder()
                .id("wh_1").name("Kho Hà Nội").type("SALES_WAREHOUSE").subType("DOMESTIC_WAREHOUSE").isDefault(true).build();
        var whSales2 = com.dev.backend.dto.response.customize.TikTokWarehouseDto.builder()
                .id("wh_2").name("Kho Hồ Chí Minh").type("SALES_WAREHOUSE").subType("DOMESTIC_WAREHOUSE").isDefault(false).build();

        var whResp = new com.dev.backend.dto.response.customize.TikTokWarehousesResponse();
        whResp.setWarehouses(List.of(whReturn, whSales1, whSales2));
        when(mockClient.getWarehouses("app_k", "app_s", "tok_1", "ROW_CIPHER")).thenReturn(whResp);

        List<com.dev.backend.dto.response.customize.ShopifyLocationDto> ds = service.getLocations("TIKTOK");

        assertEquals(2, ds.size(), "Phải lọc bỏ RETURN_WAREHOUSE, chỉ giữ 2 SALES_WAREHOUSE");
        assertEquals("wh_1", ds.get(0).getMaKhoSan());
        assertEquals("Kho Hà Nội", ds.get(0).getTenKhoSan());
        assertTrue(ds.get(0).isMacDinh());
        assertEquals("wh_2", ds.get(1).getMaKhoSan());
        assertEquals("Kho Hồ Chí Minh", ds.get(1).getTenKhoSan());
        assertFalse(ds.get(1).isMacDinh());
        verify(dieuHanhHeThongService, never()).setCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any());
    }

    @Test
    @DisplayName("TikTok Shop: Khi đổi mã kho sàn trong luuCaiDat, reset Delta Sync và đẩy tồn ngay sang kho mới")
    void luuCaiDat_khiDoiMaKhoSanTikTok_resetDeltaSyncVaDayTonSangKhoMoi() {
        var mockClient = mock(com.dev.backend.services.tiktok.TikTokShopClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "tiktokShopClient", mockClient);

        KenhBanHang tikTokKenh = KenhBanHang.builder().id(5).maKenh("TIKTOK").tenKenh("TikTok Shop").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(173).maSku("POLO-NEW-WH-01").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(503)
                .kenhBanHang(tikTokKenh)
                .bienTheSanPham(bt)
                .maSanPhamKenh("1738587264603882999")
                .soLuongDaDay(15)
                .trangThaiDongBo("thanh_cong")
                .choPhepDongBo(true)
                .build();

        when(kenhBanHangRepository.findByMaKenh("TIKTOK")).thenReturn(Optional.of(tikTokKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(5)).thenReturn(List.of(dong));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(173)))
                .thenReturn(List.<Object[]>of(new Object[]{173, BigDecimal.valueOf(15)}));

        when(kenhBanHangService.getTikTokAppKey()).thenReturn("app_k");
        when(kenhBanHangService.getDecryptedTikTokAppSecret()).thenReturn("app_s");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tok_1");
        when(kenhBanHangService.getTikTokShopCipher()).thenReturn("ROW_CIPHER");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any()))
                .thenReturn("wh_cu_1", "wh_moi_2");

        var sku = com.dev.backend.dto.response.customize.TikTokSkuDto.builder()
                .id("1738587264603882999")
                .sellerSku("POLO-NEW-WH-01")
                .inventory(List.of(
                        new com.dev.backend.dto.response.customize.TikTokSkuDto.Inventory("wh_cu_1", 10),
                        new com.dev.backend.dto.response.customize.TikTokSkuDto.Inventory("wh_moi_2", 3)))
                .build();
        var prod = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("77777").status("ACTIVATE").skus(List.of(sku)).build();
        var searchResp = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse();
        var searchData = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse.ProductSearchData();
        searchData.setProducts(List.of(prod));
        searchResp.setData(searchData);
        when(mockClient.searchProducts(any(), any(), any(), any(), anyInt(), any())).thenReturn(searchResp);

        var okResp = new com.dev.backend.dto.response.customize.TikTokInventoryUpdateResponse();
        okResp.setCode(0);
        when(mockClient.updateProductInventory(any(), any(), any(), any(), eq("77777"), any())).thenReturn(okResp);

        var req = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder()
                .maKhoSan("wh_moi_2")
                .tenKhoSan("Kho Hồ Chí Minh")
                .build();

        DongBoTongQuanDto result = service.luuCaiDat("TIKTOK", req);

        assertNotNull(result);
        verify(dieuHanhHeThongService).setCauHinhString("KENH_TIKTOK_MA_KHO_SAN", "wh_moi_2");
        verify(dieuHanhHeThongService).setCauHinhString("KENH_TIKTOK_TEN_KHO_SAN", "Kho Hồ Chí Minh");
        verify(trangThaiDongBoSanPhamRepository, atLeastOnce()).saveAll(any());

        org.mockito.ArgumentCaptor<com.dev.backend.dto.request.TikTokInventoryUpdateRequest> reqCaptor =
                org.mockito.ArgumentCaptor.forClass(com.dev.backend.dto.request.TikTokInventoryUpdateRequest.class);
        verify(mockClient).updateProductInventory(any(), any(), any(), any(), eq("77777"), reqCaptor.capture());
        var sentInvs = reqCaptor.getValue().getSkus().get(0).getInventory();
        assertTrue(sentInvs.stream().anyMatch(i -> "wh_moi_2".equals(i.getWarehouseId()) && Integer.valueOf(15).equals(i.getQuantity())),
                "Kho mới wh_moi_2 phải nhận đủ số tồn khả dụng 15 dù soLuongDaDay trước đó cũng là 15");
    }

    @Test
    @DisplayName("Hướng B - Shopee: getLocations chỉ trả địa chỉ lấy hàng Shopee thật, không tự bơm kho FCentric ảo")
    void getLocations_shopee_chiTraDiaChiShopeeKhongBomKhoFCentricAo() throws Exception {
        KenhBanHang shopeeKenh = KenhBanHang.builder().id(7).maKenh("SHOPEE_SANDBOX").tenKenh("Shopee Sandbox").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPEE_SANDBOX")).thenReturn(Optional.of(shopeeKenh));
        when(kenhBanHangService.getShopeePartnerId("SHOPEE_SANDBOX")).thenReturn(12345L);
        when(kenhBanHangService.getDecryptedShopeePartnerKey("SHOPEE_SANDBOX")).thenReturn("mock_partner_key");
        when(kenhBanHangService.getDecryptedShopeeAccessToken("SHOPEE_SANDBOX")).thenReturn("tok_shp");
        when(kenhBanHangService.getShopeeShopId("SHOPEE_SANDBOX")).thenReturn(8888L);

        var spyService = spy(service);
        var mockClient = mock(com.dev.backend.services.shopee.ShopeeClient.class);
        doReturn(mockClient).when(spyService).getShopeeClient(shopeeKenh);
        ObjectMapper mapper = new ObjectMapper();
        when(mockClient.getWarehouseDetail()).thenReturn(mapper.readTree("{\"error\":\"\"}"));
        when(mockClient.getAddressList()).thenReturn(mapper.readTree("""
                {"error":"","response":{"address_list":[{"address_id":5001,"address":"12 Cầu Giấy","city":"Hà Nội","address_type":["PICKUP_ADDRESS"]}]}}
                """));

        var ds = spyService.getLocations("SHOPEE_SANDBOX");

        assertEquals(1, ds.size(), "Hướng B: Shopee đơn kho chỉ trả đúng 1 địa chỉ lấy hàng từ sàn");
        assertTrue(ds.stream().anyMatch(l -> "5001".equals(l.getMaKhoSan())));
        assertTrue(ds.stream().noneMatch(l -> l.getMaKhoSan() != null && l.getMaKhoSan().startsWith("fcentric-kho-")),
                "Không được tự bơm kho ảo fcentric-kho-* vào danh sách kho Shopee");
    }

    @Test
    @DisplayName("Shopee: Đổi sang kho FCentric mới reset Delta Sync và đẩy tồn theo đúng kho đã chọn")
    void luuCaiDat_khiDoiMaKhoSanShopee_resetDeltaSyncVaDayTonTheoKhoFCentric() throws Exception {
        KenhBanHang shopeeKenh = KenhBanHang.builder().id(7).maKenh("SHOPEE_SANDBOX").tenKenh("Shopee Sandbox").trangThai(1).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(210).maSku("SHP-WH-SKU-01").build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(710)
                .kenhBanHang(shopeeKenh)
                .bienTheSanPham(bt)
                .maSanPhamKenh("900100:2001")
                .soLuongDaDay(12)
                .trangThaiDongBo("thanh_cong")
                .choPhepDongBo(true)
                .build();

        when(kenhBanHangRepository.findByMaKenh("SHOPEE_SANDBOX")).thenReturn(Optional.of(shopeeKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(7)).thenReturn(List.of(dong));
        when(kenhBanHangService.getShopeeShopId("SHOPEE_SANDBOX")).thenReturn(8888L);
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPEE_SANDBOX_MA_KHO_SAN"), any()))
                .thenReturn("fcentric-kho-1", "fcentric-kho-2");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPEE_SANDBOX_TU_DONG_DAY_TON"), any()))
                .thenReturn("true");
        when(tonKhoTongHopRepository.sumFreeToUseTheoKhoVaBienTheIds(2, List.of(210)))
                .thenReturn(List.<Object[]>of(new Object[]{210, BigDecimal.valueOf(7)}));

        var spyService = spy(service);
        var mockClient = mock(com.dev.backend.services.shopee.ShopeeClient.class);
        doReturn(mockClient).when(spyService).getShopeeClient(shopeeKenh);
        when(mockClient.updateStockBatch(eq(900100L), any())).thenReturn(new ObjectMapper().readTree("{\"error\":\"\",\"message\":\"success\"}"));

        var req = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder()
                .maKhoSan("fcentric-kho-2")
                .tenKhoSan("Kho TP.HCM (Đồng bộ lên Shopee)")
                .build();

        spyService.luuCaiDat("SHOPEE_SANDBOX", req);

        verify(dieuHanhHeThongService).setCauHinhString("KENH_SHOPEE_SANDBOX_MA_KHO_SAN", "fcentric-kho-2");
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<Map<String, Object>>> stockBatchCaptor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(mockClient).updateStockBatch(eq(900100L), stockBatchCaptor.capture());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sellerStock = (List<Map<String, Object>>) stockBatchCaptor.getValue().get(0).get("seller_stock");
        assertEquals(7, sellerStock.get(0).get("stock"), "Phải đẩy đúng số tồn khả dụng 7 của kho fcentric-kho-2 vừa chuyển sang");
    }

    @Test
    @DisplayName("TikTok Shop: Chuyển kho gọi editProduct với SKU id = null để gắn SKU sang kho mới và lưu lại maSanPhamKenh mới")
    void luuCaiDat_khiDoiMaKhoSanTikTok_chuyenSkuSangKhoMoiQuaEditProductVaCapNhatMaSanPhamKenh() {
        var mockClient = mock(com.dev.backend.services.tiktok.TikTokShopClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "tiktokShopClient", mockClient);

        KenhBanHang tikTokKenh = KenhBanHang.builder().id(5).maKenh("TIKTOK").tenKenh("TikTok Shop").trangThai(1).build();
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(101).tenSanPham("Áo Polo Bảo Hộ FCentric Chính Hãng").build();
        BienTheSanPham bt = BienTheSanPham.builder().id(174).sanPham(sp).maSku("POLO-SWITCH-01").giaBan(BigDecimal.valueOf(180000)).build();
        TrangThaiDongBoSanPham dong = TrangThaiDongBoSanPham.builder()
                .id(504)
                .kenhBanHang(tikTokKenh)
                .bienTheSanPham(bt)
                .maSanPhamKenh("999000111")
                .soLuongDaDay(12)
                .trangThaiDongBo("thanh_cong")
                .choPhepDongBo(true)
                .build();

        when(kenhBanHangRepository.findByMaKenh("TIKTOK")).thenReturn(Optional.of(tikTokKenh));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(5)).thenReturn(List.of(dong));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(174)))
                .thenReturn(List.<Object[]>of(new Object[]{174, BigDecimal.valueOf(12)}));
        when(kenhBanHangService.getTikTokAppKey()).thenReturn("app_k");
        when(kenhBanHangService.getDecryptedTikTokAppSecret()).thenReturn("app_s");
        when(kenhBanHangService.getDecryptedTikTokAccessToken()).thenReturn("tok_1");
        when(kenhBanHangService.getTikTokShopCipher()).thenReturn("ROW_CIPHER");
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_TIKTOK_MA_KHO_SAN"), any()))
                .thenReturn("wh_cu_1", "wh_moi_2");

        var oldSku = com.dev.backend.dto.response.customize.TikTokSkuDto.builder()
                .id("999000111")
                .sellerSku("POLO-SWITCH-01")
                .inventory(List.of(new com.dev.backend.dto.response.customize.TikTokSkuDto.Inventory("wh_cu_1", 12)))
                .build();
        var prod = com.dev.backend.dto.response.customize.TikTokProductDto.builder()
                .id("88888").status("ACTIVATE").skus(List.of(oldSku)).build();
        var searchResp = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse();
        var searchData = new com.dev.backend.dto.response.customize.TikTokProductSearchResponse.ProductSearchData();
        searchData.setProducts(List.of(prod));
        searchResp.setData(searchData);
        when(mockClient.searchProducts(any(), any(), any(), any(), anyInt(), any())).thenReturn(searchResp);
        when(mockClient.uploadImage(any(), any(), any(), any(), any(), any())).thenReturn("tos-maliva-i-o260ufnz6q-us/mock-main");
        when(mockClient.uploadImageWithUseCase(any(), any(), any(), any(), any(), any(), any())).thenReturn("tos-maliva-i-o260ufnz6q-us/mock-size-chart");

        var editResp = new com.dev.backend.dto.response.customize.TikTokProductCreateResponse();
        editResp.setCode(0);
        var data = new com.dev.backend.dto.response.customize.TikTokProductCreateResponse.ProductCreateData();
        data.setProductId("88888");
        var newSku = new com.dev.backend.dto.response.customize.TikTokProductCreateResponse.CreatedSku();
        newSku.setId("999000222");
        newSku.setSellerSku("POLO-SWITCH-01");
        data.setSkus(List.of(newSku));
        editResp.setData(data);
        when(mockClient.editProduct(any(), any(), any(), any(), eq("88888"), any())).thenReturn(editResp);

        var req = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder()
                .maKhoSan("wh_moi_2")
                .tenKhoSan("F-Centric Kho Tổng")
                .build();

        service.luuCaiDat("TIKTOK", req);

        org.mockito.ArgumentCaptor<com.dev.backend.dto.request.TikTokProductCreateRequest> editCaptor =
                org.mockito.ArgumentCaptor.forClass(com.dev.backend.dto.request.TikTokProductCreateRequest.class);
        verify(mockClient).editProduct(any(), any(), any(), any(), eq("88888"), editCaptor.capture());
        var sentSku = editCaptor.getValue().getSkus().get(0);
        assertNull(sentSku.getId(), "Khi chuyển kho mới phải gửi sku.id = null để TikTok tạo binding mới ở kho đích");
        assertEquals("wh_moi_2", sentSku.getInventory().get(0).getWarehouseId());
        assertEquals("999000222", dong.getMaSanPhamKenh(), "Sau editProduct thành công phải cập nhật maSanPhamKenh mới vào DB");
    }

    @Test
    @DisplayName("luuCaiDat: Lưu KENH_<MA>_KHO_ID khi truyền khoId hợp lệ và chặn kho trung chuyển / ngừng hoạt động")
    void luuCaiDat_khiTruyenKhoId_luuKhoIdVaChanKhoTrungChuyen() {
        KenhBanHang lazadaKenh = KenhBanHang.builder().id(9).maKenh("LAZADA").tenKenh("Lazada").trangThai(1).build();
        var khoHn = com.dev.backend.entities.Kho.builder().id(2).maKho("KHO_HN").tenKho("Cửa hàng Hà Nội").loaiKho("kho_nhanh").trangThai(1).build();
        var khoTransit = com.dev.backend.entities.Kho.builder().id(99).maKho("KHO_TRANSIT").tenKho("Kho Trung Chuyển").loaiKho("kho_trung_chuyen").trangThai(1).build();

        when(kenhBanHangRepository.findByMaKenh("LAZADA")).thenReturn(Optional.of(lazadaKenh));
        when(khoRepository.findById(2)).thenReturn(Optional.of(khoHn));
        when(khoRepository.findById(99)).thenReturn(Optional.of(khoTransit));

        var reqHopLe = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder().khoId(2).build();
        service.luuCaiDat("LAZADA", reqHopLe);
        verify(dieuHanhHeThongService).setCauHinhString("KENH_LAZADA_KHO_ID", "2");

        var reqTransit = com.dev.backend.dto.request.KenhBanHangCaiDatRequest.builder().khoId(99).build();
        assertThrows(CommonException.class, () -> service.luuCaiDat("LAZADA", reqTransit));
    }

    @Test
    @DisplayName("Hướng B + Định tuyến đơn 3 sàn: luuCauHinhKhoMapping giữ cheDoDaKho=false và tự đổi kho xuất giữa TH1 (Kho A -> Kho tổng) và TH2 (Kho B -> Cửa hàng Hà Nội)")
    void luuCauHinhKhoMapping_huongB3San_giuCheDoDonKhoVaDinhTuyenKhoTh1Th2() {
        var khoTong = com.dev.backend.entities.Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho tổng").loaiKho("kho_tong").trangThai(1).build();
        var khoHn = com.dev.backend.entities.Kho.builder().id(2).maKho("CH_HN").tenKho("Cửa hàng Hà Nội").loaiKho("kho_nhanh").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong, khoHn));

        Map<String, String> store = new HashMap<>();
        doAnswer(inv -> {
            store.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(dieuHanhHeThongService).setCauHinhString(anyString(), anyString());
        when(dieuHanhHeThongService.getCauHinhString(anyString(), any())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            String defVal = inv.getArgument(1);
            return store.getOrDefault(key, defVal);
        });

        for (String maSan : List.of("LAZADA", "TIKTOK", "SHOPEE_OFFICIAL")) {
            store.clear();
            KenhBanHang kenh = KenhBanHang.builder().id(20).maKenh(maSan).tenKenh(maSan).trangThai(1).build();
            when(kenhBanHangRepository.findByMaKenh(maSan)).thenReturn(Optional.of(kenh));

            var mappingReq = com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest.builder()
                    .cheDoDaKho(true) // Cố tình truyền true: backend phải ép về false theo Hướng B
                    .khoIdMacDinh(1)
                    .danhSachKho(List.of(
                            com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto.builder()
                                    .maKhoSan("KHO_A").tenKhoSan("Kho A").khoIdFCentric(1).kichHoat(false).laMacDinh(true).build(),
                            com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto.builder()
                                    .maKhoSan("KHO_B").tenKhoSan("Kho B").khoIdFCentric(2).kichHoat(false).laMacDinh(false).build()
                    ))
                    .build();

            var spyService = spy(service);
            doReturn(List.of(
                    com.dev.backend.dto.response.customize.ShopifyLocationDto.builder().maKhoSan("KHO_A").tenKhoSan("Kho A").macDinh(true).build(),
                    com.dev.backend.dto.response.customize.ShopifyLocationDto.builder().maKhoSan("KHO_B").tenKhoSan("Kho B").macDinh(false).build()
            )).when(spyService).getLocations(eq(maSan), anyBoolean());

            var savedCfg = spyService.luuCauHinhKhoMapping(maSan, mappingReq);
            assertFalse(Boolean.TRUE.equals(savedCfg.getCheDoDaKho()),
                    "Hướng B: " + maSan + " phải luôn giữ cheDoDaKho=false kể cả khi payload truyền true");
            assertEquals("1", store.get("KENH_" + maSan + "_KHO_ID"));

            // TH1: seller đặt kho lấy hàng là KHO_A -> định tuyến về Kho tổng (1)
            store.put("KENH_" + maSan + "_MA_KHO_SAN", "KHO_A");
            assertEquals(1, spyService.resolveKhoXuatChoDonSan(kenh, null).getId());
            assertEquals(1, spyService.resolveKhoXuatChoDonSan(kenh, "KHO_A").getId());

            // TH2: seller đổi kho lấy hàng sang KHO_B -> định tuyến về Cửa hàng Hà Nội (2)
            store.put("KENH_" + maSan + "_MA_KHO_SAN", "KHO_B");
            assertEquals(2, spyService.resolveKhoXuatChoDonSan(kenh, null).getId());
            assertEquals(2, spyService.resolveKhoXuatChoDonSan(kenh, "KHO_B").getId());
        }
    }
}
