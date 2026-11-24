package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuGiaoDichKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.LichSuGiaoDichKhoMapper;
import com.dev.backend.repository.ChiTietPhieuChuyenKeRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.LichSuGiaoDichKhoRepository;
import com.dev.backend.repository.PhieuChuyenKeRepository;
import com.dev.backend.repository.PhieuDieuChinhKhoRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Chi tiết một dòng lịch sử giao dịch kho chỉ xem được trong kho mình được phân, cùng phạm vi với danh sách. */
@ExtendWith(MockitoExtension.class)
class LichSuGiaoDichKhoChiTietTest {

    private static final Kho HA_NOI = Kho.builder().id(1).tenKho("Kho Hà Nội").build();
    private static final Kho HCM = Kho.builder().id(2).tenKho("Kho Hồ Chí Minh").build();

    @Mock private LichSuGiaoDichKhoRepository repository;
    @Mock private LichSuGiaoDichKhoMapper mapper;
    @Mock private ViTriKhoRepository viTriKhoRepository;
    @Mock private ChiTietPhieuChuyenKeRepository chiTietPhieuChuyenKeRepository;
    @Mock private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private PhieuDieuChinhKhoRepository phieuDieuChinhKhoRepository;
    @Mock private PhieuChuyenKeRepository phieuChuyenKeRepository;
    @Mock private DonBanHangRepository donBanHangRepository;

    private LichSuGiaoDichKhoService service;

    @BeforeEach
    void setUp() {
        service = new LichSuGiaoDichKhoService(repository, mapper, viTriKhoRepository, chiTietPhieuChuyenKeRepository,
                phieuNhapKhoRepository, phieuXuatKhoRepository, phieuDieuChinhKhoRepository, phieuChuyenKeRepository,
                donBanHangRepository);
        when(repository.findByIdWithDetails(100)).thenReturn(Optional.of(LichSuGiaoDichKho.builder().id(100).kho(HCM).build()));
        lenient().when(mapper.toDto(any())).thenReturn(new LichSuGiaoDichKhoDto());
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static void dangNhap(String vaiTro, Integer... khoDuocPhan) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(khoDuocPhan)
                        .map(id -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(id).build()).build())
                        .toList())
                .build());
    }

    @Test
    void dongCuaKhoKhac_baoKhongTimThayNhuIdKhongCo() {
        when(repository.findByIdWithDetails(999)).thenReturn(Optional.empty());
        dangNhap(IRoleType.nhan_vien_kho, HA_NOI.getId());

        CommonException khoKhac = assertThrows(CommonException.class, () -> service.getChiTiet(100));
        CommonException khongCo = assertThrows(CommonException.class, () -> service.getChiTiet(999));

        assertEquals(khongCo.getHttpStatus(), khoKhac.getHttpStatus());
        assertEquals(khongCo.getMessage().replace("999", "100"), khoKhac.getMessage(),
                "không để dò id phân biệt được dòng của kho khác với id không tồn tại");
    }

    @Test
    void quanLyKhoKhac_cungBiChan() {
        dangNhap(IRoleType.quan_ly_kho, HA_NOI.getId());
        assertThrows(CommonException.class, () -> service.getChiTiet(100));
    }

    @Test
    void dongCuaKhoDuocPhan_xemDuoc() {
        dangNhap(IRoleType.nhan_vien_kho, HA_NOI.getId(), HCM.getId());
        assertNotNull(service.getChiTiet(100));
    }

    @Test
    void quanTriVien_xemMoiKho() {
        dangNhap(IRoleType.quan_tri_vien);
        assertNotNull(service.getChiTiet(100));
    }
}
