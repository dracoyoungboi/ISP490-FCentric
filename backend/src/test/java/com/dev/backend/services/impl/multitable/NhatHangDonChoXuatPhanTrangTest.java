package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
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

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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
}
