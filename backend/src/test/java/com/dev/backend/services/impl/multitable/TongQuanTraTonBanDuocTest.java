package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonBienThe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonSanPham;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository.BienTheTim;
import com.dev.backend.repository.TongQuanVaiTroRepository.SanPhamTim;
import com.dev.backend.services.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Thẻ "Tra tồn" ở Tổng quan: cột "Tại kho" bằng số bán được tại quầy — mã đang bị giữ ở kho lấy số BanDuocTaiQuayService
 * tính lại theo lô (cùng công thức với danh mục POS và thanh toán), mã khác giữ số SQL; số lẻ làm tròn, không âm.
 */
@ExtendWith(MockitoExtension.class)
class TongQuanTraTonBanDuocTest {

    @Mock private TongQuanAdminRepository admin;
    @Mock private TongQuanVaiTroRepository repo;
    @Mock private KhaDungChuyenKhoService khaDungChuyenKhoService;
    @Mock private BanDuocTaiQuayService banDuocTaiQuayService;
    @Mock private JwtService jwtService;

    @Test
    void taiKho_maDangBiGiu_dungSoBanDuoc_maKhacGiuSoSql() {
        TongQuanVaiTroServiceImpl service = new TongQuanVaiTroServiceImpl(admin, repo, khaDungChuyenKhoService,
                banDuocTaiQuayService, jwtService);
        when(repo.timSanPham(anyString(), eq("áo"), anyInt())).thenReturn(List.of(new SanPhamTim(59, "SP59", "Áo")));
        when(repo.tonBienThe(1, List.of(59))).thenReturn(List.of(
                new BienTheTim(59, new BigDecimal("100000"), new TraTonBienThe(93, "SKU93", "Đỏ", "M", 8, 5, 1)),
                new BienTheTim(59, new BigDecimal("120000"), new TraTonBienThe(94, "SKU94", "Đỏ", "L", 4, 0, 0))));
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(1, List.of(93, 94)))
                .thenReturn(new HashMap<>(Map.of(93, new BigDecimal("3.000"))));

        List<TraTonSanPham> ketQua = service.traTon(1, "Áo");

        List<TraTonBienThe> bienThe = ketQua.get(0).bienThe();
        assertEquals(3, bienThe.get(0).taiKho(), "SKU 93 bị giữ: SQL 8 → bán được 3");
        assertEquals(5, bienThe.get(0).khoKhac(), "cột khác giữ nguyên");
        assertEquals(1, bienThe.get(0).dangVe());
        assertEquals(4, bienThe.get(1).taiKho(), "SKU 94 không bị giữ: giữ số SQL");
        assertEquals(100_000L, ketQua.get(0).giaThapNhat());
        assertEquals(120_000L, ketQua.get(0).giaCaoNhat());
    }
}
