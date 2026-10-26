package com.dev.backend.services.impl.payos;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.websocket.PosWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Hủy QR chỉ khi payOS xác nhận (rà soát POS 24/10, C3). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PosPayosCancelTest {

    private static final long ORDER = 1729000000123L;
    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock PaymentConfigService configService;
    @Mock PayosClient payosClient;
    @Mock PosPayosTransaction tx;
    @Mock PosPayosPaymentRepository repository;
    @Mock PosCatalogService posCatalogService;
    @Mock PosWebSocketHandler webSocket;
    @Mock KhoRepository khoRepository;
    @Mock NguoiDungRepository nguoiDungRepository;

    private PosPayosService service;
    private PosPayosPayment row;
    private final PayosCredentials cred = new PayosCredentials("c", "k", "s");

    @BeforeEach
    void setUp() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of("nhan_vien_ban_hang")).build());
        service = new PosPayosService(configService, payosClient, tx, repository, posCatalogService, webSocket,
                khoRepository, nguoiDungRepository, "http://x");
        row = PosPayosPayment.builder().orderCode(ORDER).nguoiThuNganId(7).khoId(1)
                .soTien(new BigDecimal("100000")).trangThai(PosPayosPayment.PENDING)
                .hetHanLuc(Instant.now().plusSeconds(600)).build();
        when(tx.reload(ORDER)).thenAnswer(inv -> Optional.of(row));
        when(tx.closeUnpaid(eq(ORDER), anyString(), anyString())).thenAnswer(inv -> {
            row.setTrangThai(inv.getArgument(1));
            return row;
        });
        when(configService.credentialsForBackgroundJob()).thenReturn(cred);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private static PayosClient.PayosResult payos(String status) {
        ObjectNode data = JSON.createObjectNode().put("status", status).put("amount", 100000).put("amountPaid", 0);
        return new PayosClient.PayosResult(200, "00", "success", data);
    }

    @Test
    void khongLienLacDuocPayos_baoLoi409_vaGiuNguyenGiaoDich() {
        when(payosClient.getPaymentLink(cred, ORDER)).thenReturn(new PayosClient.PayosResult(0, null, "timeout", null));

        CommonException e = assertThrows(CommonException.class, () -> service.cancel(ORDER));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals(PosPayosPayment.PENDING, row.getTrangThai());
        verify(tx, never()).closeUnpaid(anyLong(), anyString(), anyString());
        verify(payosClient, never()).cancelPaymentLink(any(), anyLong(), anyString());
    }

    @Test
    void chuaCauHinhPayos_khongTuHuy() {
        when(configService.credentialsForBackgroundJob()).thenReturn(null);

        assertThrows(CommonException.class, () -> service.cancel(ORDER));

        assertEquals(PosPayosPayment.PENDING, row.getTrangThai());
    }

    @Test
    void payosTuChoiHuy_baoLoi409_khongTraHangGiuCho() {
        when(payosClient.getPaymentLink(cred, ORDER)).thenReturn(payos("PENDING"));
        when(payosClient.cancelPaymentLink(eq(cred), eq(ORDER), anyString()))
                .thenReturn(new PayosClient.PayosResult(200, "101", "Đơn thanh toán không tồn tại", null));

        assertThrows(CommonException.class, () -> service.cancel(ORDER));

        assertEquals(PosPayosPayment.PENDING, row.getTrangThai());
        verify(tx, never()).closeUnpaid(anyLong(), anyString(), anyString());
    }

    @Test
    void payosXacNhanHuy_moiDanhDauCancelled() {
        when(payosClient.getPaymentLink(cred, ORDER)).thenReturn(payos("PENDING"));
        when(payosClient.cancelPaymentLink(eq(cred), eq(ORDER), anyString())).thenReturn(payos("CANCELLED"));

        PayosPaymentLinkDto dto = service.cancel(ORDER);

        assertEquals(PosPayosPayment.CANCELLED, dto.getTrangThai());
        verify(tx).closeUnpaid(eq(ORDER), eq(PosPayosPayment.CANCELLED), anyString());
    }

    @Test
    void payosBaoDaHuySan_dongTheoPayos_khongGoiHuyLan2() {
        when(payosClient.getPaymentLink(cred, ORDER)).thenReturn(payos("CANCELLED"));

        PayosPaymentLinkDto dto = service.cancel(ORDER);

        assertEquals(PosPayosPayment.CANCELLED, dto.getTrangThai());
        verify(payosClient, never()).cancelPaymentLink(any(), anyLong(), anyString());
    }

    @Test
    void khachDaChuyenMotPhan_khongHuy_chuyenChoQuanLy() {
        ObjectNode partial = JSON.createObjectNode().put("status", "PENDING").put("amount", 100000).put("amountPaid", 40000);
        when(payosClient.getPaymentLink(cred, ORDER)).thenReturn(new PayosClient.PayosResult(200, "00", "success", partial));
        org.mockito.Mockito.doAnswer(inv -> {
            row.setTrangThai(PosPayosPayment.PAID_ERROR);
            return null;
        }).when(tx).markPaidError(eq(ORDER), anyString(), any(), any(), eq(true));

        PayosPaymentLinkDto dto = service.cancel(ORDER);

        assertEquals(PosPayosPayment.PAID_ERROR, dto.getTrangThai());
        verify(tx).markPaidError(eq(ORDER), anyString(), any(), eq(new BigDecimal("40000")), eq(true));
        verify(payosClient, never()).cancelPaymentLink(any(), anyLong(), anyString());
        verify(tx, never()).closeUnpaid(anyLong(), anyString(), anyString());
    }

    @Test
    void huyHongViKhachVuaTra_hoiLaiPayosVaHoanTatDon() {
        ObjectNode paid = JSON.createObjectNode().put("status", "PAID").put("amount", 100000).put("amountPaid", 100000);
        when(payosClient.getPaymentLink(cred, ORDER))
                .thenReturn(payos("PENDING"))
                .thenReturn(new PayosClient.PayosResult(200, "00", "success", paid));
        when(payosClient.cancelPaymentLink(eq(cred), eq(ORDER), anyString()))
                .thenReturn(new PayosClient.PayosResult(200, "101", "Đơn đã thanh toán", null));
        when(tx.finalizePaid(eq(ORDER), any(), any())).thenAnswer(inv -> {
            row.setTrangThai(PosPayosPayment.PAID);
            return null;
        });

        PayosPaymentLinkDto dto = service.cancel(ORDER);

        assertEquals(PosPayosPayment.PAID, dto.getTrangThai());
        verify(tx, never()).closeUnpaid(anyLong(), anyString(), anyString());
    }
}
