package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.dto.response.customize.DongBoNgayDto;
import com.dev.backend.dto.response.customize.LayDonResultDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangDongBoService.TheoDoiDayTon;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DongBoNgayServiceTest {

    /** Đồng hồ chỉnh tay để kiểm tra thời gian chạy. */
    static class DongHoTay extends Clock {
        final AtomicReference<Instant> luc = new AtomicReference<>(Instant.parse("2026-10-18T01:14:00Z"));

        void troi(Duration d) {
            luc.updateAndGet(i -> i.plus(d));
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return luc.get();
        }
    }

    /** Giữ việc lại cho test tự chạy, để xem trạng thái trong lúc đợt còn chạy. */
    static class LuongGiu implements java.util.concurrent.Executor {
        final List<Runnable> viec = new ArrayList<>();

        @Override
        public void execute(Runnable r) {
            viec.add(r);
        }

        void chayHet() {
            List<Runnable> ds = new ArrayList<>(viec);
            viec.clear();
            ds.forEach(Runnable::run);
        }
    }

    private KenhBanHangDongBoService dongBo;
    private DongHoTay dongHo;
    private LuongGiu luong;
    private AtomicBoolean daBocPhienJpa;
    private DongBoNgayService service;

    @BeforeEach
    void setUp() {
        dongBo = mock(KenhBanHangDongBoService.class);
        dongHo = new DongHoTay();
        luong = new LuongGiu();
        daBocPhienJpa = new AtomicBoolean();
        service = new DongBoNgayService(dongBo, luong, dongHo, viec -> {
            daBocPhienJpa.set(true);
            viec.run();
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private static DayTonResultDto ketQuaTon(int ok, int loi, int chuaDay, String loiKenh) {
        return DayTonResultDto.builder().soDong(ok).soLoi(loi).soChuaDay(chuaDay).loiKenh(loiKenh).build();
    }

    /** Giả lập vòng đẩy tồn: báo tiến độ cho từng SKU, {@code null} là thành công, chuỗi là lý do lỗi SKU. */
    private void dayTonGia(String[] skus, String[] loi, Duration moiSku) {
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            TheoDoiDayTon t = inv.getArgument(1);
            t.batDauDay(skus.length);
            int ok = 0, soLoi = 0, daXuLy = 0;
            for (int i = 0; i < skus.length; i++) {
                if (t.canDung()) break;
                t.dangDay(skus[i]);
                dongHo.troi(moiSku);
                boolean thanhCong = loi[i] == null;
                t.daDay(skus[i], thanhCong ? null : "Tên " + skus[i], thanhCong, loi[i]);
                daXuLy++;
                if (thanhCong) ok++; else soLoi++;
            }
            return ketQuaTon(ok, soLoi, skus.length - daXuLy, null);
        });
    }

    @Test
    void batDau_dayTonRoiLayDon24GioQua_ketThucXongVoiSoLieuThat() {
        dayTonGia(new String[]{"A-1", "A-2", "A-3"}, new String[]{null, "Không tìm thấy SKU A-2 trên Shopify", null}, Duration.ofMillis(800));
        when(dongBo.layDonHang(eq("SHOPIFY"), any())).thenReturn(LayDonResultDto.builder().soDonMoi(3).build());

        DongBoNgayDto luc0 = service.batDau("shopify");
        assertEquals(DongBoNgayService.DANG_CHAY, luc0.getTrangThai());
        assertEquals(DongBoNgayService.DOC_SAN_PHAM, luc0.getGiaiDoan());
        assertEquals("SHOPIFY", luc0.getMaKenh());

        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");

        assertEquals(luc0.getMaPhien(), kq.getMaPhien());
        assertEquals(DongBoNgayService.XONG, kq.getTrangThai());
        assertEquals(DongBoNgayService.LAY_DON, kq.getGiaiDoan());
        assertEquals(3, kq.getTongSku());
        assertEquals(3, kq.getDaXuLy());
        assertEquals(2, kq.getSoThanhCong());
        assertEquals(1, kq.getSoLoi());
        assertEquals(0, kq.getSoChuaDay());
        assertEquals(3, kq.getSoDonMoi());
        assertNull(kq.getLoi());
        assertNull(kq.getSkuDangDay());
        assertEquals(1, kq.getDsLoi().size());
        assertEquals("A-2", kq.getDsLoi().get(0).getMaSku());
        assertEquals("Tên A-2", kq.getDsLoi().get(0).getTenSku());
        assertEquals(2400, kq.getDaChayMs());
        assertEquals(2400, kq.getDayTonDaChayMs());
        assertNotNull(kq.getKetThuc());
        assertTrue(daBocPhienJpa.get(), "cả đợt phải chạy trong phiên JPA mở");

        ArgumentCaptor<LayDonHangKenhRequest> req = ArgumentCaptor.forClass(LayDonHangKenhRequest.class);
        verify(dongBo).layDonHang(eq("SHOPIFY"), req.capture());
        assertEquals(Duration.ofHours(24),
                Duration.between(Instant.parse(req.getValue().getTu()), Instant.parse(req.getValue().getDen())));
    }

    @Test
    void hienTai_trongLucDayTon_traSkuDangDayVaSoDaXuLy() {
        AtomicReference<DongBoNgayDto> giuaChung = new AtomicReference<>();
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            TheoDoiDayTon t = inv.getArgument(1);
            t.batDauDay(49);
            t.dangDay("AT001-DEN-S");
            dongHo.troi(Duration.ofMillis(700));
            t.daDay("AT001-DEN-S", null, true, null);
            t.dangDay("AT001-DEN-M");
            dongHo.troi(Duration.ofMillis(300));
            giuaChung.set(service.hienTai("SHOPIFY"));
            return ketQuaTon(49, 0, 0, null);
        });
        when(dongBo.layDonHang(any(), any())).thenReturn(LayDonResultDto.builder().soDonMoi(0).build());

        service.batDau("SHOPIFY");
        dongHo.troi(Duration.ofSeconds(2));
        luong.chayHet();

        DongBoNgayDto p = giuaChung.get();
        assertEquals(DongBoNgayService.DANG_CHAY, p.getTrangThai());
        assertEquals(DongBoNgayService.DAY_TON, p.getGiaiDoan());
        assertEquals(49, p.getTongSku());
        assertEquals(1, p.getDaXuLy());
        assertEquals("AT001-DEN-M", p.getSkuDangDay());
        assertEquals(3000, p.getDaChayMs());
        assertEquals(1000, p.getDayTonDaChayMs());
        assertNull(p.getSoChuaDay());
    }

    @Test
    void batDau_khiDangChay_traDotDangChayKhongTaoDotThuHai() {
        dayTonGia(new String[]{"A-1"}, new String[]{null}, Duration.ZERO);
        when(dongBo.layDonHang(any(), any())).thenReturn(LayDonResultDto.builder().soDonMoi(0).build());

        DongBoNgayDto dau = service.batDau("SHOPIFY");
        DongBoNgayDto lanHai = service.batDau("Shopify ");

        assertEquals(dau.getMaPhien(), lanHai.getMaPhien());
        assertEquals(1, luong.viec.size(), "chỉ một việc chạy nền");
        luong.chayHet();
        verify(dongBo, times(1)).dayTonTheoQuyTacDaLuu(any(), any());

        // Đợt trước đã xong thì bấm lại là đợt mới
        DongBoNgayDto lanBa = service.batDau("SHOPIFY");
        assertNotEquals(dau.getMaPhien(), lanBa.getMaPhien());
        assertEquals(DongBoNgayService.DANG_CHAY, lanBa.getTrangThai());
    }

    @Test
    void loiCaGianHang_dungVoiLyDoVaBoQuaLayDon() {
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            TheoDoiDayTon t = inv.getArgument(1);
            t.batDauDay(49);
            for (int i = 0; i < 23; i++) {
                t.dangDay("S-" + i);
                t.daDay("S-" + i, null, true, null);
            }
            t.dangDay("S-23");
            return ketQuaTon(23, 0, 26, "Khóa truy cập Shopify không hợp lệ hoặc thiếu quyền ghi tồn kho");
        });

        service.batDau("SHOPIFY");
        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");

        assertEquals(DongBoNgayService.LOI, kq.getTrangThai());
        assertEquals(DongBoNgayService.DAY_TON, kq.getGiaiDoan());
        assertEquals("Khóa truy cập Shopify không hợp lệ hoặc thiếu quyền ghi tồn kho", kq.getLoi());
        assertEquals(23, kq.getDaXuLy());
        assertEquals(26, kq.getSoChuaDay());
        assertNull(kq.getSkuDangDay());
        assertNull(kq.getSoDonMoi());
        verify(dongBo, never()).layDonHang(any(), any());
    }

    @Test
    void khongKetNoiDuocShopify_dungOBuocDocSanPham() {
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any()))
                .thenReturn(ketQuaTon(0, 0, 49, "Không tải được danh sách sản phẩm trên Shopify"));

        service.batDau("SHOPIFY");
        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");

        assertEquals(DongBoNgayService.LOI, kq.getTrangThai());
        assertEquals(DongBoNgayService.DOC_SAN_PHAM, kq.getGiaiDoan());
        assertNull(kq.getTongSku());
        assertNull(kq.getDayTonDaChayMs());
        assertEquals(49, kq.getSoChuaDay());
    }

    @Test
    void dung_trongLucDayTon_dungSauSkuDangDayVaBoQuaLayDon() {
        String[] skus = {"A-1", "A-2", "A-3", "A-4"};
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            TheoDoiDayTon t = inv.getArgument(1);
            t.batDauDay(skus.length);
            int daXuLy = 0;
            for (String sku : skus) {
                if (t.canDung()) break;
                t.dangDay(sku);
                if (daXuLy == 1) {
                    // Người dùng bấm Dừng khi SKU thứ hai đang đẩy
                    DongBoNgayDto sauKhiBam = service.dung("SHOPIFY");
                    assertTrue(sauKhiBam.isYeuCauDung());
                    assertEquals(DongBoNgayService.DANG_CHAY, sauKhiBam.getTrangThai());
                }
                t.daDay(sku, null, true, null);
                daXuLy++;
            }
            return ketQuaTon(daXuLy, 0, skus.length - daXuLy, null);
        });

        service.batDau("SHOPIFY");
        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");

        assertEquals(DongBoNgayService.DA_DUNG, kq.getTrangThai());
        assertEquals(2, kq.getDaXuLy());
        assertEquals(2, kq.getSoChuaDay());
        verify(dongBo, never()).layDonHang(any(), any());
    }

    @Test
    void dung_khiChuaCoDotHoacDaXong_khongDoiKetQua() {
        assertNull(service.dung("SHOPIFY"));
        assertNull(service.hienTai("SHOPIFY"));

        dayTonGia(new String[]{"A-1"}, new String[]{null}, Duration.ZERO);
        when(dongBo.layDonHang(any(), any())).thenReturn(LayDonResultDto.builder().soDonMoi(1).build());
        service.batDau("SHOPIFY");
        luong.chayHet();

        DongBoNgayDto kq = service.dung("SHOPIFY");
        assertEquals(DongBoNgayService.XONG, kq.getTrangThai());
        assertFalse(kq.isYeuCauDung());
    }

    @Test
    void loiNghiepVu_hienLyDo_loiKhac_hienCauChung() {
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any()))
                .thenThrow(new CommonException("Kênh bán hàng SHOPIFY đang tạm dừng", HttpStatus.BAD_REQUEST, null));
        service.batDau("SHOPIFY");
        luong.chayHet();
        assertEquals("Kênh bán hàng SHOPIFY đang tạm dừng", service.hienTai("SHOPIFY").getLoi());
        assertEquals(DongBoNgayService.LOI, service.hienTai("SHOPIFY").getTrangThai());

        reset(dongBo);
        dayTonGia(new String[]{"A-1"}, new String[]{null}, Duration.ZERO);
        when(dongBo.layDonHang(any(), any())).thenThrow(new IllegalStateException("could not initialize proxy - no Session"));
        service.batDau("SHOPIFY");
        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");
        assertEquals(DongBoNgayService.LOI, kq.getTrangThai());
        assertEquals(DongBoNgayService.LAY_DON, kq.getGiaiDoan());
        assertEquals("Máy chủ gặp lỗi khi đồng bộ, vui lòng thử lại", kq.getLoi());
        assertEquals(1, kq.getSoThanhCong());
    }

    @Test
    void loiNang_dotVanKetThucLoi_bamLaiChayDotMoi_vaErrorKhongBiNuot() {
        // Như thread pool thật: Error làm chết luồng; ghi lại để biết nó vẫn được ném tiếp
        AtomicReference<Throwable> nemRa = new AtomicReference<>();
        DongBoNgayService s = new DongBoNgayService(dongBo, r -> {
            try {
                r.run();
            } catch (Throwable t) {
                nemRa.set(t);
            }
        }, dongHo, Runnable::run);
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenThrow(new StackOverflowError("giả lập"));

        DongBoNgayDto lan1 = s.batDau("SHOPIFY");

        DongBoNgayDto kq = s.hienTai("SHOPIFY");
        assertEquals(DongBoNgayService.LOI, kq.getTrangThai());
        assertEquals("Máy chủ gặp lỗi khi đồng bộ, vui lòng thử lại", kq.getLoi());
        assertNotNull(kq.getKetThuc());
        assertInstanceOf(StackOverflowError.class, nemRa.get());

        // Không còn kẹt: bấm lại là một đợt mới
        DongBoNgayDto lan2 = s.batDau("SHOPIFY");
        assertNotEquals(lan1.getMaPhien(), lan2.getMaPhien());
        verify(dongBo, times(2)).dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any());
    }

    @Test
    void dsLoi_toiDa50DongNhungVanDemDu() {
        String[] skus = new String[60];
        String[] loi = new String[60];
        for (int i = 0; i < 60; i++) {
            skus[i] = "L-" + i;
            loi[i] = "Không tìm thấy SKU L-" + i + " trên Shopify";
        }
        dayTonGia(skus, loi, Duration.ZERO);
        when(dongBo.layDonHang(any(), any())).thenReturn(LayDonResultDto.builder().soDonMoi(0).build());

        service.batDau("SHOPIFY");
        luong.chayHet();
        DongBoNgayDto kq = service.hienTai("SHOPIFY");

        assertEquals(60, kq.getSoLoi());
        assertEquals(DongBoNgayService.TOI_DA_DS_LOI, kq.getDsLoi().size());
    }

    @Test
    void luongTuChoi_ketThucLoiNgay() {
        DongBoNgayService tuChoi = new DongBoNgayService(dongBo, r -> {
            throw new RejectedExecutionException("shutdown");
        }, dongHo, Runnable::run);

        DongBoNgayDto kq = tuChoi.batDau("SHOPIFY");

        assertEquals(DongBoNgayService.LOI, kq.getTrangThai());
        assertEquals("Máy chủ đang tắt, chưa chạy được đồng bộ", kq.getLoi());
        // Không kẹt ở "đang chạy": bấm lại được
        assertNotEquals(kq.getMaPhien(), tuChoi.batDau("SHOPIFY").getMaPhien());
    }

    @Test
    void maKenhTrong_baoLoi() {
        assertThrows(CommonException.class, () -> service.batDau(" "));
        assertThrows(CommonException.class, () -> service.hienTai(null));
    }

    @Test
    void chayTrenLuongRieng_ghiNguoiBamVaGiaoDienHoiDuocTrongLucChay() throws Exception {
        ExecutorService that = Executors.newSingleThreadExecutor();
        try {
            DongBoNgayService nen = new DongBoNgayService(dongBo, that, Clock.systemUTC(), Runnable::run);
            CountDownLatch dangDay = new CountDownLatch(1);
            CountDownLatch choPhepTiep = new CountDownLatch(1);
            AtomicReference<NguoiDungAuthInfo> nguoiTrenLuong = new AtomicReference<>();
            AtomicReference<String> tenLuong = new AtomicReference<>();
            when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
                nguoiTrenLuong.set(SecurityContextHolder.getUser());
                tenLuong.set(Thread.currentThread().getName());
                TheoDoiDayTon t = inv.getArgument(1);
                t.batDauDay(2);
                t.dangDay("A-1");
                dangDay.countDown();
                assertTrue(choPhepTiep.await(5, TimeUnit.SECONDS));
                t.daDay("A-1", null, true, null);
                t.dangDay("A-2");
                t.daDay("A-2", null, true, null);
                return ketQuaTon(2, 0, 0, null);
            });
            when(dongBo.layDonHang(any(), any())).thenReturn(LayDonResultDto.builder().soDonMoi(2).build());
            NguoiDungAuthInfo nguoi = NguoiDungAuthInfo.builder().id(5).hoTen("Nguyễn Văn Kho").build();
            SecurityContextHolder.setUser(nguoi);

            DongBoNgayDto dau = nen.batDau("SHOPIFY");
            assertEquals("Nguyễn Văn Kho", dau.getNguoiBam());
            assertTrue(dangDay.await(5, TimeUnit.SECONDS));

            // Request khác hỏi tiến độ trong khi luồng nền đang đẩy
            DongBoNgayDto dangChay = nen.hienTai("SHOPIFY");
            assertEquals(DongBoNgayService.DANG_CHAY, dangChay.getTrangThai());
            assertEquals("A-1", dangChay.getSkuDangDay());
            assertEquals(0, dangChay.getDaXuLy());
            assertEquals(dau.getMaPhien(), nen.batDau("SHOPIFY").getMaPhien());

            choPhepTiep.countDown();
            that.shutdown();
            assertTrue(that.awaitTermination(5, TimeUnit.SECONDS));

            DongBoNgayDto kq = nen.hienTai("SHOPIFY");
            assertEquals(DongBoNgayService.XONG, kq.getTrangThai());
            assertEquals(2, kq.getSoDonMoi());
            assertSame(nguoi, nguoiTrenLuong.get(), "nhật ký kênh ghi đúng người bấm");
            assertNotEquals(Thread.currentThread().getName(), tenLuong.get());
            verify(dongBo, times(1)).dayTonTheoQuyTacDaLuu(any(), any());
        } finally {
            that.shutdownNow();
        }
    }

    @Test
    void tatMay_yeuCauDungDotDangChay() {
        AtomicReference<Boolean> canDungLucChay = new AtomicReference<>();
        when(dongBo.dayTonTheoQuyTacDaLuu(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            TheoDoiDayTon t = inv.getArgument(1);
            canDungLucChay.set(t.canDung());
            return ketQuaTon(0, 0, 3, null);
        });
        service.batDau("SHOPIFY");
        service.dungKhiTatMay();
        luong.chayHet();

        assertTrue(canDungLucChay.get());
        assertEquals(DongBoNgayService.DA_DUNG, service.hienTai("SHOPIFY").getTrangThai());
    }

    @Test
    void chayTrongPhienJpa_moVaDongEntityManagerChoLuongNen() {
        EntityManagerFactory emf = mock(EntityManagerFactory.class);
        EntityManager em = mock(EntityManager.class);
        when(emf.createEntityManager()).thenReturn(em);
        when(em.isOpen()).thenReturn(true);
        AtomicBoolean coPhien = new AtomicBoolean();

        DongBoNgayService.chayTrongPhienJpa(emf, () -> {
            coPhien.set(TransactionSynchronizationManager.hasResource(emf));
            // Lồng nhau thì dùng lại phiên đang mở, không mở phiên thứ hai
            DongBoNgayService.chayTrongPhienJpa(emf, () -> {});
        });

        assertTrue(coPhien.get());
        assertFalse(TransactionSynchronizationManager.hasResource(emf));
        verify(emf, times(1)).createEntityManager();
        verify(em).close();
    }

    @Test
    void chayTrongPhienJpa_loiVanDongPhien() {
        EntityManagerFactory emf = mock(EntityManagerFactory.class);
        EntityManager em = mock(EntityManager.class);
        when(emf.createEntityManager()).thenReturn(em);
        when(em.isOpen()).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> DongBoNgayService.chayTrongPhienJpa(emf, () -> {
            throw new IllegalStateException("x");
        }));

        assertFalse(TransactionSynchronizationManager.hasResource(emf));
        verify(em).close();
    }
}
