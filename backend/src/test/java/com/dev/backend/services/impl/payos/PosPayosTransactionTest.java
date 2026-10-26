package com.dev.backend.services.impl.payos;

import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction.CheckoutContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Luồng ghi payOS: tiền về muộn, xử lý giao dịch lỗi, cờ giữ chỗ (rà soát POS 24/10, C2/C3). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PosPayosTransactionTest {

    private static final long ORDER = 1729000000456L;
    private static final String PAYLOAD = """
            {"payload":{"requestId":"r-1","khoId":1,"khachHangId":10,"note":"Gói quà",
              "items":[{"bienTheSanPhamId":5,"quantity":2,"unitPriceClient":50000}]},
             "productNames":{"5":"Áo khoác"}}""";
    private static final String GIU_CHO = "[{\"tonKhoTheoLoId\":3,\"bienTheSanPhamId\":5,\"quantity\":2}]";

    @Mock PosPayosPaymentRepository repository;
    @Mock PosCheckoutTransaction checkoutTransaction;
    @Mock EntityManager entityManager;

    private PosPayosTransaction tx;
    private PosPayosPayment row;

    @BeforeEach
    void setUp() {
        tx = new PosPayosTransaction(repository, checkoutTransaction, new ObjectMapper(), entityManager);
        row = PosPayosPayment.builder().orderCode(ORDER).khoId(1).nguoiThuNganId(7)
                .soTien(new BigDecimal("100000")).payloadJson(PAYLOAD).giuChoJson(GIU_CHO)
                .hetHanLuc(Instant.now()).build();
        when(repository.lockByOrderCode(ORDER)).thenAnswer(inv -> Optional.of(row));
        when(repository.save(any(PosPayosPayment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(checkoutTransaction.executeWith(any(), any()))
                .thenReturn(PosCheckoutResponse.builder().donBanHangId(901).soDonHang("SO202610249").build());
    }

    private void paidError(String received, boolean held) {
        row.setTrangThai(PosPayosPayment.PAID_ERROR);
        row.setErrorMessage("Đã nhận tiền nhưng chưa tạo được đơn: x");
        row.setSoTienDaNhan(received == null ? null : new BigDecimal(received));
        row.setDangGiuCho(held);
    }

    // ---------- tạo mã QR ----------

    @Test
    void taoMaQr_luuNoiDungCkDayDuCuaPayos() throws Exception {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setNoiDungCk("FC2320800");
        String qr = "000201010212" + "5303704" + "62" + "25" + "08" + "21" + "CST9DVDPQ93 FC2320800" + "6304ABCD";
        var data = new ObjectMapper().readTree("{\"qrCode\":\"" + qr + "\",\"description\":\"FC2320800\"}");

        tx.markLinkCreated(ORDER, data);

        assertEquals("CST9DVDPQ93 FC2320800", row.getNoiDungCk());
    }

    @Test
    void taoMaQr_khongDocDuocQr_dungDescriptionPayos() throws Exception {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setNoiDungCk("FC2320800");
        var data = new ObjectMapper().readTree("{\"qrCode\":\"khong-phai-vietqr\",\"description\":\"CST9DVDPQ93 FC2320800\"}");

        tx.markLinkCreated(ORDER, data);

        assertEquals("CST9DVDPQ93 FC2320800", row.getNoiDungCk());
    }

    // ---------- tài khoản người chuyển ----------

    @Test
    void ghiNguoiChuyen_chiGhiLanDau_dungTenNganHangHoacMaBin() throws Exception {
        row.setTrangThai(PosPayosPayment.PENDING);
        ObjectMapper om = new ObjectMapper();

        tx.ghiNguoiChuyen(ORDER, om.readTree("{\"counterAccountName\":\"NGUYEN VAN A\",\"counterAccountBankId\":\"970436\",\"counterAccountNumber\":\"0011001234567\"}"));
        tx.ghiNguoiChuyen(ORDER, om.readTree("{\"counterAccountName\":\"TRAN THI B\",\"counterAccountNumber\":\"999\"}"));

        assertEquals("NGUYEN VAN A", row.getTenNguoiChuyen());
        assertEquals("970436", row.getNganHangNguoiChuyen());
        assertEquals("0011001234567", row.getSoTkNguoiChuyen());
    }

    @Test
    void ghiNguoiChuyen_khongCoThongTin_khongDung() throws Exception {
        tx.ghiNguoiChuyen(ORDER, new ObjectMapper().readTree("{\"reference\":\"FT1\"}"));

        assertNull(row.getTenNguoiChuyen());
        verify(repository, never()).lockByOrderCode(ORDER);
    }

    @Test
    void lyDo_theoThuTu_chuaRo_saiTien_tienVeMuon_loiTaoDon_vaGiuNguyenSauXuLy() {
        row.setTrangThai(PosPayosPayment.PAID_ERROR);
        assertEquals("CHUA_RO_SO_TIEN", PosPayosService.lyDo(row));
        row.setSoTienDaNhan(new BigDecimal("99000"));
        assertEquals("CHUYEN_THIEU", PosPayosService.lyDo(row));
        row.setSoTienDaNhan(new BigDecimal("101000"));
        assertEquals("CHUYEN_DU", PosPayosService.lyDo(row));
        row.setSoTienDaNhan(new BigDecimal("100000"));
        assertEquals("LOI_TAO_DON", PosPayosService.lyDo(row));
        row.setTienVeSauHuy(true);
        assertEquals("TIEN_VE_MUON", PosPayosService.lyDo(row));
        row.setTrangThai(PosPayosPayment.REFUNDED);
        assertEquals("TIEN_VE_MUON", PosPayosService.lyDo(row), "đã xử lý xong vẫn kể đúng lý do ban đầu");
        row.setTrangThai(PosPayosPayment.PAID);
        assertNull(PosPayosService.lyDo(row), "đơn tự tạo bình thường không có lý do");
    }

    @Test
    void markPaidError_tuGiaoDichDaHuy_chotCoTienVeSauHuy() {
        row.setTrangThai(PosPayosPayment.CANCELLED);
        tx.markPaidError(ORDER, "trả muộn", "FT1", new BigDecimal("100000"), false);
        assertTrue(row.isTienVeSauHuy());
    }

    @Test
    void markPaidError_tuPending_khongDanhCoTienVeSauHuy() {
        row.setTrangThai(PosPayosPayment.PENDING);
        tx.markPaidError(ORDER, "lỗi", "FT1", new BigDecimal("100000"), false);
        assertFalse(row.isTienVeSauHuy());
    }

    @Test
    void banBinhThuong_xoaTaiKhoanNguoiChuyen() {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setTenNguoiChuyen("NGUYEN VAN A");
        row.setSoTkNguoiChuyen("0011");
        tx.finalizePaid(ORDER, new BigDecimal("100000"), "FT1");
        assertNull(row.getTenNguoiChuyen());
        assertNull(row.getSoTkNguoiChuyen());
    }

    // ---------- tiền về muộn ----------

    @Test
    void tienVeSauKhiDaHuy_khongTuTaoDon() {
        row.setTrangThai(PosPayosPayment.CANCELLED);

        CommonException e = assertThrows(CommonException.class,
                () -> tx.finalizePaid(ORDER, new BigDecimal("100000"), "FT123"));

        assertTrue(e.getMessage().contains("hủy hoặc hết hạn"));
        verify(checkoutTransaction, never()).executeWith(any(), any());
    }

    @Test
    void tienVeSauKhiHetHan_khongTuTaoDon() {
        row.setTrangThai(PosPayosPayment.EXPIRED);

        assertThrows(CommonException.class, () -> tx.finalizePaid(ORDER, new BigDecimal("100000"), "FT123"));

        verify(checkoutTransaction, never()).executeWith(any(), any());
    }

    @Test
    void tienVeDungHan_taoDon_luuSoTienDaNhan_hetGiuCho() {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setDangGiuCho(true);

        tx.finalizePaid(ORDER, new BigDecimal("100000"), "FT123");

        assertEquals(PosPayosPayment.PAID, row.getTrangThai());
        assertEquals(0, new BigDecimal("100000").compareTo(row.getSoTienDaNhan()));
        assertFalse(row.isDangGiuCho());
    }

    // ---------- markPaidError ----------

    @Test
    void markPaidError_luuSoTien_khongLongTienToKhiBaoLan2() {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setDangGiuCho(true);

        tx.markPaidError(ORDER, "sai số tiền", "FT1", new BigDecimal("99000"), false);
        String lan1 = row.getErrorMessage();
        tx.markPaidError(ORDER, lan1, "FT1", new BigDecimal("99000"), false);

        assertEquals(PosPayosPayment.PAID_ERROR, row.getTrangThai());
        assertEquals(lan1, row.getErrorMessage());
        assertEquals(0, new BigDecimal("99000").compareTo(row.getSoTienDaNhan()), "webhook gửi lại cùng mã không cộng dồn");
        assertTrue(row.isDangGiuCho(), "PAID_ERROR từ PENDING vẫn giữ hàng cho quản lý xử lý");
    }

    @Test
    void markPaidError_khachChuyenThemLanHai_congDonTheoMaGiaoDichMoi() {
        row.setTrangThai(PosPayosPayment.PENDING);

        tx.markPaidError(ORDER, "thiếu", "FT1", new BigDecimal("60000"), false);
        tx.markPaidError(ORDER, "thiếu", "FT2", new BigDecimal("40000"), false);
        tx.markPaidError(ORDER, "thiếu", "FT1", new BigDecimal("60000"), false);

        assertEquals(0, new BigDecimal("100000").compareTo(row.getSoTienDaNhan()));
        assertEquals("FT1,FT2", row.getMaGiaoDichNganHang());
    }

    @Test
    void markPaidError_tongTuPayos_ghiDungSoDo() {
        row.setTrangThai(PosPayosPayment.PENDING);

        tx.markPaidError(ORDER, "thiếu", "FT1", new BigDecimal("60000"), false);
        tx.markPaidError(ORDER, "thiếu", "FT2", new BigDecimal("90000"), true);

        assertEquals(0, new BigDecimal("90000").compareTo(row.getSoTienDaNhan()));
    }

    @Test
    void markPaidError_khongDongVaoGiaoDichDaHoanTien() {
        row.setTrangThai(PosPayosPayment.REFUNDED);

        tx.markPaidError(ORDER, "webhook gửi lại", "FT1", new BigDecimal("100000"), false);

        assertEquals(PosPayosPayment.REFUNDED, row.getTrangThai());
    }

    // ---------- Tạo đơn bán từ giao dịch lỗi ----------

    @Test
    void taoDon_duTien_traGiuChoTrongCungGiaoDich_vaGhiNguoiXuLy() {
        paidError("100000", true);
        Instant tienVeLuc = Instant.parse("2026-10-24T08:03:00Z");
        row.setThanhToanLuc(tienVeLuc);
        ArgumentCaptor<CheckoutContext> ctx = ArgumentCaptor.forClass(CheckoutContext.class);
        ArgumentCaptor<PosCheckoutCreating> payload = ArgumentCaptor.forClass(PosCheckoutCreating.class);

        PosCheckoutResponse result = tx.createOrderFromPaidError(ORDER, 1, "Đã kiểm sao kê");

        verify(checkoutTransaction).executeWith(payload.capture(), ctx.capture());
        assertEquals("PAYOS-XU-LY-" + ORDER, payload.getValue().getRequestId(), "không dùng lại requestId gốc (có thể đã gắn đơn khác)");
        assertEquals(tienVeLuc, ctx.getValue().thoiDiemBan(), "đơn mang ngày tiền về, không phải ngày quản lý xử lý");
        assertEquals(1, ctx.getValue().reservationToRelease().size());
        assertEquals(0, new BigDecimal("100000").compareTo(ctx.getValue().paidAmount()));
        assertEquals(7, ctx.getValue().userId(), "đơn ghi người bán là thu ngân đã tạo QR");
        assertEquals(901, result.getDonBanHangId());
        assertEquals(PosPayosPayment.PAID, row.getTrangThai());
        assertEquals(1, row.getNguoiXuLyId());
        assertEquals("Đã kiểm sao kê", row.getGhiChuXuLy());
        assertFalse(row.isDangGiuCho());
    }

    @Test
    void taoDon_khiHangDaTraChoTruocDo_khongTraLan2() {
        paidError("100000", false);
        ArgumentCaptor<CheckoutContext> ctx = ArgumentCaptor.forClass(CheckoutContext.class);

        tx.createOrderFromPaidError(ORDER, 1, null);

        verify(checkoutTransaction).executeWith(any(), ctx.capture());
        assertNull(ctx.getValue().reservationToRelease());
    }

    @Test
    void taoDon_chuyenDu_donDungTong_ghiChuCanHoan() {
        paidError("105000", true);
        ArgumentCaptor<PosCheckoutCreating> payload = ArgumentCaptor.forClass(PosCheckoutCreating.class);
        ArgumentCaptor<CheckoutContext> ctx = ArgumentCaptor.forClass(CheckoutContext.class);

        tx.createOrderFromPaidError(ORDER, 1, null);

        verify(checkoutTransaction).executeWith(payload.capture(), ctx.capture());
        assertEquals(0, new BigDecimal("100000").compareTo(ctx.getValue().paidAmount()));
        assertEquals("Gói quà Khách chuyển dư 5000đ qua payOS — cần hoàn lại.", payload.getValue().getNote());
    }

    @Test
    void taoDon_chuyenThieu_tuChoi() {
        paidError("99000", true);

        CommonException e = assertThrows(CommonException.class, () -> tx.createOrderFromPaidError(ORDER, 1, null));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(checkoutTransaction, never()).executeWith(any(), any());
        assertEquals(PosPayosPayment.PAID_ERROR, row.getTrangThai());
    }

    @Test
    void taoDon_chuaRoSoTien_tuChoi() {
        paidError(null, true);

        assertThrows(CommonException.class, () -> tx.createOrderFromPaidError(ORDER, 1, null));

        verify(checkoutTransaction, never()).executeWith(any(), any());
    }

    @Test
    void taoDon_giaoDichKhongConLoi_tuChoi() {
        row.setTrangThai(PosPayosPayment.PAID);

        assertThrows(CommonException.class, () -> tx.createOrderFromPaidError(ORDER, 1, null));

        verify(checkoutTransaction, never()).executeWith(any(), any());
    }

    // ---------- Đã hoàn tiền ----------

    @Test
    void hoanTien_traGiuChoDungMotLan() {
        paidError("100000", true);

        tx.markRefunded(ORDER, 1, "Đã hoàn FT999");
        assertThrows(CommonException.class, () -> tx.markRefunded(ORDER, 1, "bấm lần 2"));

        verify(checkoutTransaction, times(1)).releaseReservation(eq(1), anyList());
        assertEquals(PosPayosPayment.REFUNDED, row.getTrangThai());
        assertFalse(row.isDangGiuCho());
        assertEquals("Đã hoàn FT999", row.getGhiChuXuLy());
    }

    @Test
    void hoanTien_khiHangDaTraTruocDo_khongTraLai() {
        paidError("100000", false);

        tx.markRefunded(ORDER, 1, "Đã hoàn");

        verify(checkoutTransaction, never()).releaseReservation(anyInt(), anyList());
    }

    @Test
    void huyQr_traGiuCho_vaTatCo() {
        row.setTrangThai(PosPayosPayment.PENDING);
        row.setDangGiuCho(true);

        tx.closeUnpaid(ORDER, PosPayosPayment.CANCELLED, "hủy");
        tx.closeUnpaid(ORDER, PosPayosPayment.CANCELLED, "hủy lần 2");

        verify(checkoutTransaction, times(1)).releaseReservation(eq(1), anyList());
        assertFalse(row.isDangGiuCho());
    }
}
