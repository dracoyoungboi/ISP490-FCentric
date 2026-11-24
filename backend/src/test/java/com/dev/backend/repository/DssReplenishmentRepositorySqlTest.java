package com.dev.backend.repository;

import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DssReplenishmentRepositorySqlTest {

    @Mock private NamedParameterJdbcTemplate jdbc;
    @Mock private TongQuanAdminRepository adminRepo;
    @Mock private TongQuanVaiTroRepository vaiTroRepo;

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("loadRawInputsAllWarehouses: tổng hợp tồn kho, hàng đang về và sức bán trên toàn bộ kho hoạt động, loại KHO_TRANSIT")
    void loadRawInputsAllWarehouses_sqlCongGopTatCaKhoHoatDong() throws Exception {
        DssReplenishmentRepository repository = new DssReplenishmentRepository(jdbc, adminRepo, vaiTroRepo);

        ResultSet variantRs = mock(ResultSet.class);
        when(variantRs.getInt("san_pham_id")).thenReturn(10);
        when(variantRs.getInt("bien_the_id")).thenReturn(101);
        when(variantRs.getString("ma_san_pham")).thenReturn("SP-10");
        when(variantRs.getString("ma_sku")).thenReturn("SKU-101");
        when(variantRs.getString("ten_san_pham")).thenReturn("Áo polo");
        when(variantRs.getString("ten_mau")).thenReturn("Đen");
        when(variantRs.getString("ma_mau_hex")).thenReturn("#000000");
        when(variantRs.getString("ten_size")).thenReturn("M");
        when(variantRs.getString("ten_chat_lieu")).thenReturn("Cotton");
        when(variantRs.getString("ten_danh_muc")).thenReturn("Áo");
        when(variantRs.getString("anh")).thenReturn(null);
        when(variantRs.getBigDecimal("on_hand")).thenReturn(BigDecimal.valueOf(30));
        when(variantRs.getBigDecimal("outgoing")).thenReturn(BigDecimal.valueOf(5));
        when(variantRs.getBigDecimal("ftu")).thenReturn(BigDecimal.valueOf(25));
        when(variantRs.getInt("da_tung_nhap")).thenReturn(1);
        when(variantRs.getBigDecimal("don_gia_nhap")).thenReturn(BigDecimal.valueOf(120000));

        List<String> stockSqls = new ArrayList<>();
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(inv -> {
            stockSqls.add(inv.getArgument(0));
            RowMapper<?> mapper = inv.getArgument(1);
            return List.of(mapper.mapRow(variantRs, 0));
        });

        List<String> noParamCallbackSqls = new ArrayList<>();
        doAnswer(inv -> {
            noParamCallbackSqls.add(inv.getArgument(0));
            return null;
        }).when(jdbc).query(anyString(), any(RowCallbackHandler.class));

        when(vaiTroRepo.yeuCauMoTheoBienThe(List.of(101))).thenReturn(Map.of());
        when(adminRepo.coBang("pos_checkout_request")).thenReturn(true);

        List<SkuRawInput> inputs = repository.loadRawInputsAllWarehouses(14, 10, LocalDate.of(2026, 11, 24));
        assertEquals(1, inputs.size());
        assertEquals(25L, inputs.get(0).ftu());

        ArgumentCaptor<String> salesSqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(salesSqlCaptor.capture(), any(MapSqlParameterSource.class), any(RowCallbackHandler.class));

        assertEquals(1, stockSqls.size());
        String stockSql = stockSqls.get(0);
        assertTrue(stockSql.contains("JOIN kho k"), "Tồn kho phải join kho để lọc kho hoạt động");
        assertTrue(stockSql.contains("k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'"));
        assertFalse(stockSql.contains(":khoId"), "Tồn kho không được lọc theo 1 khoId riêng lẻ");

        assertTrue(noParamCallbackSqls.size() >= 2);
        String incomingSql = noParamCallbackSqls.get(0);
        assertTrue(incomingSql.contains("JOIN kho k"), "Hàng đang về phải join kho để lọc kho hoạt động");
        assertTrue(incomingSql.contains("k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'"));
        assertFalse(incomingSql.contains(":khoId"), "Hàng đang về không được lọc theo 1 khoId riêng lẻ");

        String salesSql = salesSqlCaptor.getValue();
        assertTrue(salesSql.contains("JOIN kho kx ON kx.id = d.kho_xuat_id AND kx.trang_thai = 1 AND kx.ma_kho <> 'KHO_TRANSIT'"));
        assertFalse(salesSql.contains(":khoId"), "Sức bán không được lọc theo 1 khoId riêng lẻ");
    }
}
