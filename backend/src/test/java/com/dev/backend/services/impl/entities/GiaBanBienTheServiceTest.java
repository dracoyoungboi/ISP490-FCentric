package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.LocGiaBanRequest;
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
 * Màn "Tem mã vạch": danh sách nhóm theo sản phẩm (khớp một phần, tổng phân loại, đếm theo tab), số SKU cần xử lý giá
 * cho Danh sách sản phẩm, và phần kiểm giá / ghi lịch sử giá mà form Sửa sản phẩm dùng. Repository giả lập nên không
 * kiểm câu JPQL.
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
        when(giaBanRepository.doiGiaGanDay(anyCollection(), any())).thenReturn(List.of());
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

    // ==================== Kiểm giá, lịch sử giá (form Sửa sản phẩm) ====================

    @Test
    void kiemTraGiaBan_lamTron2ChuSoLe() {
        assertEquals(new BigDecimal("1999.99"), GiaBanBienTheService.kiemTraGiaBan(new BigDecimal("1999.994")));
        assertTrue(GiaBanBienTheService.laGiaDoi(null, BigDecimal.ONE));
        assertFalse(GiaBanBienTheService.laGiaDoi(new BigDecimal("2000000.00"), new BigDecimal("2000000")));
        assertEquals("{\"giaBan\":null}", GiaBanBienTheService.jsonGiaBan(null));
        assertEquals("{\"giaBan\":1250.5}", GiaBanBienTheService.jsonGiaBan(new BigDecimal("1250.50")));
    }

    @Test
    void kiemTraGiaBan_khongLonHon0_vuotCot_soMu_baoLoi() {
        for (String gia : List.of("0", "-5", "0.004")) {
            assertThrows(CommonException.class, () -> GiaBanBienTheService.kiemTraGiaBan(new BigDecimal(gia)), gia);
        }
        assertThrows(CommonException.class, () -> GiaBanBienTheService.kiemTraGiaBan(null));
        assertThrows(CommonException.class, () -> GiaBanBienTheService.kiemTraGiaBan(new BigDecimal("100000000000000")));
        assertThrows(CommonException.class, () -> GiaBanBienTheService.kiemTraGiaBan(new BigDecimal("1e900")));
    }

    @Test
    void ghiLichSuDoiGia_motDongDoiGiaBan_kemMaSkuVaLyDo() {
        when(bienTheSanPhamRepository.findById(11)).thenReturn(Optional.of(bienThe(11, nike, 1, "1500000", "2000000")));
        Instant luc = Instant.parse("2026-11-24T03:00:00Z");

        service.ghiLichSuDoiGia(11, new BigDecimal("2000000.00"), new BigDecimal("1900000"), GiaBanBienTheService.LY_DO_SUA_SAN_PHAM, admin, luc);

        ArgumentCaptor<LichSuThayDoi> bat = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).create(bat.capture());
        LichSuThayDoi ls = bat.getValue();
        assertEquals(ITable.bien_the_san_pham, ls.getLoaiThamChieu());
        assertEquals(11, ls.getIdThamChieu());
        assertEquals("AK2610234-11", ls.getMaDoiTuong());
        assertEquals(IHanhDong.doi_gia_ban, ls.getHanhDong());
        assertEquals("{\"giaBan\":2000000}", ls.getGiaTriCu());
        assertEquals("{\"giaBan\":1900000}", ls.getGiaTriMoi());
        assertEquals("Sửa sản phẩm", ls.getGhiChu());
        assertSame(admin, ls.getNguoiThucHien());
        assertEquals(luc, ls.getNgayThucHien());
    }

    @Test
    void nguoiDangThucHien_khongDangNhap_baoLoi() {
        SecurityContextHolder.clear();
        assertThrows(CommonException.class, () -> service.nguoiDangThucHien());
    }

    @Test
    void duocDoiGiaBan_chiQuanTriVien() {
        assertTrue(GiaBanBienTheService.duocDoiGiaBan());
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(2).vaiTro(Set.of(IRoleType.quan_ly_kho)).build());
        assertFalse(GiaBanBienTheService.duocDoiGiaBan());
    }

    // ==================== Cần xử lý giá (Danh sách sản phẩm) ====================

    @Test
    void demCanXuLy_traChuaCoGiaVaDuoiGiaVon() {
        when(giaBanRepository.demCanXuLy()).thenReturn(List.<Object[]>of(new Object[]{1L, 12L}));
        TrangGiaBanDto.CanXuLyGia dem = service.demCanXuLy();
        assertEquals(1, dem.getChuaCoGia());
        assertEquals(12, dem.getDuoiGiaVon());
    }

    @Test
    void demCanXuLy_khongCoDong_traSo0() {
        when(giaBanRepository.demCanXuLy()).thenReturn(List.of());
        TrangGiaBanDto.CanXuLyGia dem = service.demCanXuLy();
        assertEquals(0, dem.getChuaCoGia());
        assertEquals(0, dem.getDuoiGiaVon());
    }

    // ==================== Danh sách ====================

    private void trangSanPham(List<Integer> ids, long tong) {
        when(giaBanRepository.trangSanPhamId(any(), anyString(), any(Instant.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(ids, inv.getArgument(3), tong));
    }

    @Test
    void loc_khopMotPhan_traSoPhanLoaiVaCoKhopTen_dungThuTuSanPham() {
        trangSanPham(List.of(11, 10), 2);
        when(giaBanRepository.demSku(any(), anyString(), any(Instant.class))).thenAnswer(inv -> switch ((String) inv.getArgument(1)) {
            case "tat-ca" -> 7L;
            case "doi-gia" -> 2L;
            case "chua-gia" -> 1L;
            default -> 0L;
        });
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyString(), any(Instant.class))).thenReturn(List.of(
                bienThe(1, nike, 1, "1500000", "2000000"),
                bienThe(2, nike, 1, "1500000", "2000000"),
                bienThe(5, polo, 1, "220000", "390000")));
        when(giaBanRepository.demPhanLoai(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{10, 5L}, new Object[]{11, 4L}));
        when(giaBanRepository.sanPhamKhopTen(anyCollection(), anyString())).thenReturn(List.of(11));

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().tuKhoa("ak26").size(10).build());

        assertEquals(List.of(11, 10), trang.getContent().stream().map(TrangGiaBanDto.NhomGiaBan::getSanPhamId).toList());
        TrangGiaBanDto.NhomGiaBan nhomNike = trang.getContent().get(1);
        assertEquals(2, nhomNike.getBienThe().size());
        assertEquals(5, nhomNike.getTongPhanLoai(), "2/5 phân loại khớp");
        assertFalse(nhomNike.isKhopTen());
        assertTrue(trang.getContent().get(0).isKhopTen());
        assertEquals(0, new BigDecimal("390000").compareTo(trang.getContent().get(0).getBienThe().get(0).getGiaBan()));
        assertEquals("Đen", nhomNike.getBienThe().get(0).getMauSac().getTen());
        assertEquals(2, trang.getTongSanPham());
        assertEquals(7, trang.getTongSku());
        assertEquals(10, trang.getSize());
        assertEquals(7, trang.getDemTheoTab().getTatCa());
        assertEquals(2, trang.getDemTheoTab().getDoiGia());
        assertEquals(1, trang.getDemTheoTab().getChuaGia());
        assertEquals(0, trang.getDemTheoTab().getThieuMa());
        verify(giaBanRepository, never()).demCanXuLy();
    }

    @Test
    void loc_kemDemFalse_khongDemLai4Tab_chiDemTongSkuCuaTab() {
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyString(), any(Instant.class)))
                .thenReturn(List.of(bienThe(1, nike, 1, "1", "2")));
        when(giaBanRepository.demSku(any(), eq("doi-gia"), any(Instant.class))).thenReturn(3L);

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().trangThai("doi-gia").kemDem(false).build());

        assertNull(trang.getDemTheoTab());
        assertEquals(3, trang.getTongSku());
        verify(giaBanRepository, times(1)).demSku(any(), anyString(), any(Instant.class));
    }

    @Test
    void loc_coDem_tongSkuLayLuonTuSoDemCuaTab_khongDemThem() {
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyString(), any(Instant.class)))
                .thenReturn(List.of(bienThe(1, nike, 1, "1", "2")));
        when(giaBanRepository.demSku(any(), eq("chua-gia"), any(Instant.class))).thenReturn(4L);

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().trangThai("chua-gia").build());

        assertEquals(4, trang.getTongSku());
        assertEquals(4, trang.getDemTheoTab().getChuaGia());
        verify(giaBanRepository, times(4)).demSku(any(), anyString(), any(Instant.class));
    }

    @Test
    void loc_doiGiaGanDay_traGiaCuCuaLanDoiMoiNhat() {
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyString(), any(Instant.class)))
                .thenReturn(List.of(bienThe(1, nike, 1, "1", "120000"), bienThe(2, nike, 1, "1", "130000")));
        Instant moi = Instant.parse("2026-11-23T03:00:00Z");
        Instant cu = Instant.parse("2026-11-20T03:00:00Z");
        // Mới nhất trước (như ORDER BY của truy vấn); dòng cũ hơn của SKU 1 bị bỏ
        when(giaBanRepository.doiGiaGanDay(anyCollection(), any(Instant.class))).thenReturn(List.<Object[]>of(
                new Object[]{1, "{\"giaBan\":105000}", moi},
                new Object[]{1, "{\"giaBan\":99000}", cu}));

        TrangGiaBanDto trang = service.loc(LocGiaBanRequest.builder().trangThai("doi-gia").build());

        TrangGiaBanDto.BienTheGiaBan sku1 = trang.getContent().get(0).getBienThe().get(0);
        TrangGiaBanDto.BienTheGiaBan sku2 = trang.getContent().get(0).getBienThe().get(1);
        assertEquals(0, new BigDecimal("105000").compareTo(sku1.getGiaBanCu()));
        assertEquals(moi, sku1.getNgayDoiGia());
        assertNull(sku2.getGiaBanCu());
        assertNull(sku2.getNgayDoiGia());
        verify(giaBanRepository).trangSanPhamId(isNull(), eq("doi-gia"), any(Instant.class), any(Pageable.class));
    }

    @Test
    void docGiaBan_docDungDinhDangLichSu() {
        assertEquals(0, new BigDecimal("1250.5").compareTo(GiaBanBienTheService.docGiaBan("{\"giaBan\":1250.5}")));
        assertNull(GiaBanBienTheService.docGiaBan("{\"giaBan\":null}"));
        assertNull(GiaBanBienTheService.docGiaBan("rác"));
        assertNull(GiaBanBienTheService.docGiaBan(null));
    }

    @Test
    void loc_tuKhoaThoatKyTuDacBiet_tabTruyenXuong() {
        trangSanPham(List.of(), 0);
        service.loc(LocGiaBanRequest.builder().tuKhoa("  50%_off!  ").trangThai("chua-gia").build());
        verify(giaBanRepository).trangSanPhamId(eq("50!%!_off!!"), eq("chua-gia"), any(Instant.class), eq(PageRequest.of(0, 20)));
        verify(giaBanRepository).demSku(eq("50!%!_off!!"), eq("tat-ca"), any(Instant.class));
        // Trang rỗng: chỉ đếm cho tab, không đếm thêm tổng SKU
        verify(giaBanRepository, times(1)).demSku(any(), eq("chua-gia"), any(Instant.class));
        verify(giaBanRepository, never()).bienTheKhopLoc(anyCollection(), any(), anyString(), any(Instant.class));
    }

    @Test
    void loc_khongTuKhoa_moiNhomCoiLaKhopTen_soDongLaThiVeMacDinh() {
        trangSanPham(List.of(10), 1);
        when(giaBanRepository.bienTheKhopLoc(anyCollection(), isNull(), anyString(), any(Instant.class)))
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
        assertThrows(CommonException.class, () -> service.loc(LocGiaBanRequest.builder().trangThai("ngung-hoat-dong").build()));
    }
}
