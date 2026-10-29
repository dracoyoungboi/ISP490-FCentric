package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietDonBanHang;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Đơn chờ xuất: xin trang vượt số trang (vd. đơn cuối của trang cuối vừa được tạo phiếu nhặt ở nơi khác) phải trả trang
 * rỗng kèm tổng thật và đúng trang đang xin, để màn Đơn chờ xuất lùi về trang cuối còn dữ liệu thay vì về trang đầu.
 */
@ExtendWith(MockitoExtension.class)
class NhatHangDonChoXuatPhanTrangTest {

    private static final int KHO = 7;

    @Mock
    private DonBanHangRepository donBanHangRepository;
    @Mock
    private LoDangGiuService loDangGiuService;
    @Mock
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    @InjectMocks
    private NhatHangServiceImpl service;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder()
                .id(5).hoTen("Nguyễn Văn Kho").vaiTro(Set.of(IRoleType.quan_ly_kho)).build());
        SecurityContextHolder.setKhoId(KHO);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @SuppressWarnings("unchecked")
    private void trangRepositoryTra(long tong) {
        when(donBanHangRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<DonBanHang>(List.of(), inv.getArgument(1, Pageable.class), tong));
    }

    @Test
    @SuppressWarnings("unchecked")
    void trangVuotSoTrang_traTongThatVaTrangDangXin() {
        trangRepositoryTra(45);

        Page<DonChoXuatDto> ketQua = service.getDonChoXuat(DonChoXuatFilterRequest.builder().page(3).size(20).build());

        assertTrue(ketQua.getContent().isEmpty());
        assertEquals(45, ketQua.getTotalElements());
        assertEquals(3, ketQua.getTotalPages());
        assertEquals(3, ketQua.getNumber());
        assertEquals(20, ketQua.getSize());

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(donBanHangRepository).findAll(any(Specification.class), pageable.capture());
        assertEquals(3, pageable.getValue().getPageNumber());
        assertEquals(20, pageable.getValue().getPageSize());
        // Trang rỗng: không cần tính khả dụng
        verifyNoInteractions(loDangGiuService);
    }

    @Test
    void khongCoDonNao_tongBangKhongVaGiuCoTrang() {
        trangRepositoryTra(0);

        Page<DonChoXuatDto> ketQua = service.getDonChoXuat(DonChoXuatFilterRequest.builder().page(0).size(20).build());

        assertTrue(ketQua.getContent().isEmpty());
        assertEquals(0, ketQua.getTotalElements());
        assertEquals(0, ketQua.getNumber());
        assertEquals(20, ketQua.getSize());
        verifyNoInteractions(loDangGiuService);
    }

    /** "Đủ hàng" khớp phép phân bổ lô khi tạo phiếu nhặt: trừ cả phần phiếu chuyển đang giữ chỗ mà chưa chọn lô. */
    @Test
    @SuppressWarnings("unchecked")
    void duHang_truGiuChoPhieuChuyen() {
        DonBanHang don = DonBanHang.builder().id(1).soDonHang("SO-1").trangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG).build();
        don.setChiTietDonBanHangs(List.of(ChiTietDonBanHang.builder()
                .bienTheSanPham(BienTheSanPham.builder().id(93).build()).soLuongDat(new BigDecimal("5")).build()));
        when(donBanHangRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(List.of(don), inv.getArgument(1, Pageable.class), 1));
        when(loDangGiuService.conLaiTheoBienThe(eq(KHO), any())).thenReturn(Map.of(93, new BigDecimal("8")));
        DonChoXuatFilterRequest yc = DonChoXuatFilterRequest.builder().page(0).size(20).build();

        // không phiếu chuyển nào giữ chỗ: còn 8 ≥ 5
        assertTrue(service.getDonChoXuat(yc).getContent().get(0).getDuHang());

        // phiếu chuyển Chờ duyệt giữ 4 (chưa chọn lô): còn 8 − 4 = 4 < 5
        when(giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(eq(KHO), any())).thenReturn(Map.of(93, new BigDecimal("4")));
        DonChoXuatDto dto = service.getDonChoXuat(yc).getContent().get(0);
        assertFalse(dto.getDuHang());
        assertEquals("Thiếu hàng", dto.getKhaDung());
    }
}
