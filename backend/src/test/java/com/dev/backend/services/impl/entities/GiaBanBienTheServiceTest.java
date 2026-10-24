package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.DoiGiaBanRequest;
import com.dev.backend.dto.request.LocGiaBanRequest;
import com.dev.backend.dto.response.customize.KetQuaDoiGiaBanDto;
import com.dev.backend.dto.response.customize.TrangGiaBanDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.repository.NguoiDungRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Màn "Giá bán & tem mã vạch": đổi giá (giá > 0, bắt buộc lý do, bỏ qua biến thể ngừng / giá không đổi, ghi lịch sử
 * doi_gia_ban, không đụng giá vốn) và danh sách nhóm theo sản phẩm (khớp một phần, tổng phân loại, đếm theo tab,
 * ẩn giá vốn với nhân viên bán hàng). Repository giả lập nên không kiểm câu JPQL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GiaBanBienTheServiceTest {

    @Mock private GiaBanBienTheRepository giaBanRepository;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private AnhQuanAoRepository anhQuanAoRepository;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    @InjectMocks
    private GiaBanBienTheService service;

    private final NguoiDung admin = NguoiDung.builder().id(1).build();
    private final SanPhamQuanAo nike = SanPhamQuanAo.builder().id(10).tenSanPham("Nike Sportswear").maSanPham("AK2610234").build();
    private final SanPhamQuanAo polo = SanPhamQuanAo.builder().id(11).tenSanPham("Áo polo").maSanPham("AK2610232").build();

    @BeforeEach
    void setUp() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).vaiTro(Set.of(IRoleType.quan_tri_vien)).build());
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(admin));
        when(giaBanRepository.tonKho(anyCollection())).thenReturn(List.of());
        when(giaBanRepository.lanDoiGiaGanNhat(anyCollection())).thenReturn(List.of());
        when(giaBanRepository.demTheoTab(any(), anyBoolean())).thenReturn(List.<Object[]>of(new Object[]{0L, 0L}));
        when(giaBanRepository.demCanXuLy()).thenReturn(List.<Object[]>of(new Object[]{0L, 0L}));
        when(anhQuanAoRepository.findActiveByQuanAoIds(anyCollection())).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private BienTheSanPham bienThe(int id, SanPhamQuanAo sp, int trangThai, String giaVon, String giaBan) {
        return BienTheSanPham.builder()
                .id(id).sanPham(sp).maSku(sp.getMaSanPham() + "-" + id).maVachSku("20000000" + id)
                .mauSac(MauSac.builder().id(1).tenMau("Đen").maMauHex("#111827").build())
                .size(Size.builder().id(id).tenSize("S" + id).build())
                .trangThai(trangThai)
                .giaVon(giaVon == null ? null : new BigDecimal(giaVon))
                .giaBan(giaBan == null ? null : new BigDecimal(giaBan))
                .build();
    }

    private static DoiGiaBanRequest doi(String lyDo, Object... idVaGia) {
        List<DoiGiaBanRequest.Dong> items = new ArrayList<>();
        for (int i = 0; i < idVaGia.length; i += 2) {
            items.add(DoiGiaBanRequest.Dong.builder()
                    .bienTheId((Integer) idVaGia[i])
                    .giaBan(idVaGia[i + 1] == null ? null : new BigDecimal(idVaGia[i + 1].toString()))
                    .build());
        }
        return DoiGiaBanRequest.builder().items(items).lyDo(lyDo).build();
    }

    // ==================== Đổi giá ====================

    @Test
    void doiGia_ghiGiaMoi_ghiMotDongLichSuMoiSku_khongDungGiaVon() {
        BienTheSanPham a = bienThe(11, nike, 1, "1500000", "2000000");
        BienTheSanPham b = bienThe(12, nike, 1, "1500000", "2000000");
        when(giaBanRepository.khoaTheoIds(anyCollection())).thenReturn(List.of(a, b));
        when(giaBanRepository.tonKho(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{11, new BigDecimal("12")}));

        KetQuaDoiGiaBanDto kq = service.doiGia(doi("Khuyến mãi", 11, 1900000, 12, "1900000.00"));

        assertEquals(0, new BigDecimal("1900000").compareTo(a.getGiaBan()));
        assertEquals(0, new BigDecimal("1500000").compareTo(a.getGiaVon()), "giá vốn giữ nguyên");
        assertEquals(2, kq.getDaDoi().size());
        assertEquals(0, new BigDecimal("12").compareTo(kq.getDaDoi().get(0).getTonKho()));
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getDaDoi().get(1).getTonKho()), "không có dòng tồn thì 0");
        assertTrue(kq.getBoQua().isEmpty());
        verify(bienTheSanPhamRepository, times(2)).save(any(BienTheSanPham.class));

        ArgumentCaptor<LichSuThayDoi> ls = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService, times(2)).create(ls.capture());
        LichSuThayDoi dau = ls.getAllValues().get(0);
        assertEquals(ITable.bien_the_san_pham, dau.getLoaiThamChieu());
        assertEquals(11, dau.getIdThamChieu());
        assertEquals(IHanhDong.doi_gia_ban, dau.getHanhDong());
        assertEquals("{\"giaBan\":2000000}", dau.getGiaTriCu());
        assertEquals("{\"giaBan\":1900000}", dau.getGiaTriMoi());
        assertEquals("Khuyến mãi", dau.getGhiChu());
        assertSame(admin, dau.getNguoiThucHien());
    }

    @Test
    void doiGia_tinhLaiGiaBanMacDinhSanPham_trungBinhCacBienTheConHang() {
        BienTheSanPham a = bienThe(11, nike, 1, "1500000", "2000000");
        BienTheSanPham b = bienThe(12, nike, 1, "1500000", "3000000");   // hết hàng: không tính
        BienTheSanPham c = bienThe(13, nike, 1, "800000", "1000001");
        nike.setBienTheSanPhams(new ArrayList<>(List.of(a, b, c)));
        nike.setGiaBanMacDinh(new BigDecimal("2000000"));
        when(giaBanRepository.khoaTheoIds(anyCollection())).thenReturn(List.of(a));
        when(giaBanRepository.tonKho(anyCollection())).thenReturn(List.<Object[]>of(
                new Object[]{11, new BigDecimal("12")}, new Object[]{13, new BigDecimal("5")}));

        service.doiGia(doi("Khuyến mãi", 11, 1900000));

        // (1.900.000 + 1.000.001) / 2 = 1.450.000,5 → làm tròn lên như recalculatePriceAndStatus; chỉ ghi cột giá bán mặc định
        verify(giaBanRepository).capNhatGiaBanMacDinh(eq(10), argThat(g -> g.compareTo(new BigDecimal("1450001")) == 0));
    }

    @Test
    void doiGia_boQuaSkuNgungHoatDong_vaGiaKhongDoi_khongGhiLichSu() {
        BienTheSanPham dangBan = bienThe(21, nike, 1, "100", "200");
        BienTheSanPham ngung = bienThe(22, nike, 0, "100", "200");
        BienTheSanPham giaNhuCu = bienThe(23, nike, 1, "100", "300.00");
        when(giaBanRepository.khoaTheoIds(anyCollection())).thenReturn(List.of(dangBan, ngung, giaNhuCu));

        KetQuaDoiGiaBanDto kq = service.doiGia(doi("Giá nhập mới", 21, 300, 22, 300, 23, 300));

        assertEquals(List.of(21), kq.getDaDoi().stream().map(KetQuaDoiGiaBanDto.DaDoi::getId).toList());
        Map<Integer, String> boQua = new HashMap<>();
        kq.getBoQua().forEach(b -> boQua.put(b.getId(), b.getLyDo()));
        assertEquals("Ngừng hoạt động", boQua.get(22));
        assertEquals("Giá bán không đổi", boQua.get(23));
        assertEquals(0, new BigDecimal("200").compareTo(ngung.getGiaBan()), "SKU ngừng không bị đổi giá");
        verify(lichSuThayDoiService, times(1)).create(any(LichSuThayDoi.class));
    }

    @Test
    void doiGia_giaKhongLonHon0_baoLoi_khongGhiGi() {
        for (Object gia : new Object[]{0, -5, "0.004", null}) {
            CommonException loi = assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, gia)));
            assertTrue(loi.getMessage().contains("Giá bán") || loi.getMessage().contains("giá bán"), loi.getMessage());
        }
        verify(giaBanRepository, never()).khoaTheoIds(anyCollection());
        verify(bienTheSanPhamRepository, never()).save(any());
    }

    @Test
    void doiGia_giaVuotCotHoacSoMuKhongLo_baoLoi() {
        assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, "100000000000000")));
        assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, "1e900")));
    }

    @Test
    void doiGia_thieuHoacQuaDaiLyDo_baoLoi() {
        assertEquals("Chọn lý do đổi giá bán",
                assertThrows(CommonException.class, () -> service.doiGia(doi("  ", 11, 1000))).getMessage());
        assertThrows(CommonException.class, () -> service.doiGia(doi(null, 11, 1000)));
        assertThrows(CommonException.class, () -> service.doiGia(doi("x".repeat(256), 11, 1000)));
        verify(giaBanRepository, never()).khoaTheoIds(anyCollection());
    }

    @Test
    void doiGia_danhSachRong_trungId_khongTimThay_baoLoi() {
        assertThrows(CommonException.class, () -> service.doiGia(DoiGiaBanRequest.builder().items(List.of()).lyDo("Khuyến mãi").build()));
        assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, 1000, 11, 2000)));

        when(giaBanRepository.khoaTheoIds(anyCollection())).thenReturn(List.of(bienThe(11, nike, 1, "1", "2")));
        CommonException loi = assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, 1000, 99, 1000)));
        assertTrue(loi.getMessage().contains("99"));
        verify(bienTheSanPhamRepository, never()).save(any());
    }

    @Test
    void doiGia_khongXacDinhNguoiDung_baoLoi() {
        SecurityContextHolder.clear();
        when(giaBanRepository.khoaTheoIds(anyCollection())).thenReturn(List.of(bienThe(11, nike, 1, "1", "2")));
        assertThrows(CommonException.class, () -> service.doiGia(doi("Khuyến mãi", 11, 1000)));
        verify(bienTheSanPhamRepository, never()).save(any());
    }

    @Test
    void kiemTraGiaBan_lamTron2ChuSoLe() {
        assertEquals(new BigDecimal("1999.99"), GiaBanBienTheService.kiemTraGiaBan(new BigDecimal("1999.994")));
        assertTrue(GiaBanBienTheService.laGiaDoi(null, BigDecimal.ONE));
        assertFalse(GiaBanBienTheService.laGiaDoi(new BigDecimal("2000000.00"), new BigDecimal("2000000")));
        assertEquals("{\"giaBan\":null}", GiaBanBienTheService.jsonGiaBan(null));
        assertEquals("{\"giaBan\":1250.5}", GiaBanBienTheService.jsonGiaBan(new BigDecimal("1250.50")));
    }

    // ==================== Danh sách ====================

    private void trangSanPham(List<Integer> ids, long tong) {
        when(giaBanRepository.trangSanPhamId(any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(ids, inv.getArgument(3), tong));
    }

    @Test
    void loc_khopMotPhan_traSoPhanLoaiVaCoKhopTen_dungThuTuSanPham() {
        trangSanPham(List.of(11, 10), 2);
        when(giaBanRepository.demSku(any(), anyBoolean(), anyString())).thenReturn(3L);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyBoolean(), anyString())).thenReturn(List.of(
                bienThe(1, nike, 1, "1500000", "2000000"),
                bienThe(2, nike, 1, "1500000", "2000000"),
                bienThe(5, polo, 1, "220000", "390000")));
        when(giaBanRepository.demPhanLoai(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{10, 5L}, new Object[]{11, 4L}));
        when(giaBanRepository.sanPhamKhopTen(anyCollection(), anyString())).thenReturn(List.of(11));
        Instant luc = Instant.parse("2026-10-22T03:00:00Z");
        when(giaBanRepository.lanDoiGiaGanNhat(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{5, luc}));
        when(giaBanRepository.tonKho(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{1, new BigDecimal("12.000")}));
        when(giaBanRepository.demTheoTab(any(), anyBoolean())).thenReturn(List.<Object[]>of(new Object[]{7L, 6L}));
        when(giaBanRepository.demCanXuLy()).thenReturn(List.<Object[]>of(new Object[]{1L, 2L}));

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().tuKhoa("ak26").size(10).build());

        assertEquals(List.of(11, 10), trang.getContent().stream().map(TrangGiaBanDto.NhomGiaBan::getSanPhamId).toList());
        TrangGiaBanDto.NhomGiaBan nhomNike = trang.getContent().get(1);
        assertEquals(2, nhomNike.getBienThe().size());
        assertEquals(5, nhomNike.getTongPhanLoai(), "2/5 phân loại khớp");
        assertFalse(nhomNike.isKhopTen());
        assertTrue(trang.getContent().get(0).isKhopTen());
        assertEquals(0, new BigDecimal("12").compareTo(nhomNike.getBienThe().get(0).getTonKho()));
        assertEquals(luc, trang.getContent().get(0).getBienThe().get(0).getNgayDoiGiaGanNhat());
        assertEquals("Đen", nhomNike.getBienThe().get(0).getMauSac().getTen());
        assertEquals(2, trang.getTongSanPham());
        assertEquals(3, trang.getTongSku());
        assertEquals(10, trang.getSize());
        assertEquals(7, trang.getDemTheoTab().getTatCa());
        assertEquals(6, trang.getDemTheoTab().getHoatDong());
        assertEquals(1, trang.getDemTheoTab().getNgungHoatDong());
        assertEquals(1, trang.getCanXuLy().getChuaCoGia());
        assertEquals(2, trang.getCanXuLy().getDuoiGiaVon());
    }

    @Test
    void loc_tuKhoaThoatKyTuDacBiet_tabVaCanXuLyTruyenXuong() {
        trangSanPham(List.of(), 0);
        service.loc(LocGiaBanRequest.builder().tuKhoa("  50%_off!  ").trangThai("ngung-hoat-dong").canXuLyGia(true).build());
        verify(giaBanRepository).trangSanPhamId(eq("50!%!_off!!"), eq(true), eq("ngung-hoat-dong"), eq(PageRequest.of(0, 20)));
        verify(giaBanRepository).demTheoTab("50!%!_off!!", true);
        verify(giaBanRepository, never()).demSku(any(), anyBoolean(), anyString());
        verify(giaBanRepository, never()).bienTheKhopLoc(anyCollection(), any(), anyBoolean(), anyString());
    }

    @Test
    void loc_khongTuKhoa_moiNhomCoiLaKhopTen_soDongLaThiVeMacDinh() {
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), isNull(), anyBoolean(), anyString()))
                .thenReturn(List.of(bienThe(1, nike, 1, "1", "2")));
        when(giaBanRepository.demPhanLoai(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{10, 1L}));

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().tuKhoa("   ").size(100).page(-3).build());

        assertTrue(trang.getContent().get(0).isKhopTen());
        assertEquals(20, trang.getSize());
        assertEquals(0, trang.getPage());
        verify(giaBanRepository, never()).sanPhamKhopTen(anyCollection(), any());
    }

    @Test
    void loc_tabKhongHopLe_baoLoi() {
        assertThrows(CommonException.class, () -> service.loc(LocGiaBanRequest.builder().trangThai("xoa").build()));
    }

    @Test
    void loc_nhanVienBanHang_khongThayGiaVon() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(3).vaiTro(Set.of(IRoleType.nhan_vien_ban_hang)).build());
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyBoolean(), anyString()))
                .thenReturn(List.of(bienThe(1, nike, 1, "1500000", "2000000")));
        when(giaBanRepository.demPhanLoai(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{10, 1L}));

        TrangGiaBanDto.BienTheGiaBan bt = service.loc(new LocGiaBanRequest()).getContent().get(0).getBienThe().get(0);

        assertNull(bt.getGiaVon());
        assertEquals(0, new BigDecimal("2000000").compareTo(bt.getGiaBan()));
    }
}
