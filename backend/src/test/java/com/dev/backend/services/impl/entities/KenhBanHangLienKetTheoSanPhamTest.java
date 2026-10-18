package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.NhomLienKetDto;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChatLieu;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.MauSac;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.Size;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Danh sách liên kết phân trang theo sản phẩm (màn Sản phẩm Shopify).
 * Lỗi cũ: phân trang theo SKU rồi giao diện tự gom trên trang, nên đổi số dòng thì một sản phẩm
 * bị cắt sang hai trang và hàng sản phẩm đếm sai số phân loại, sai tổng tồn, chọn cả nhóm bị sót SKU.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhBanHangLienKetTheoSanPhamTest {

    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private KenhBanHangService kenhBanHangService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private AnhQuanAoRepository anhQuanAoRepository;
    @Mock private AnhBienTheRepository anhBienTheRepository;
    @Mock private MinioService minioService;
    @Mock private KhoRepository khoRepository;
    @Mock private TonKhoTongHopRepository tonKhoTongHopRepository;
    @Mock private com.dev.backend.workers.OmnichannelOrderSyncJob omnichannelOrderSyncJob;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;

    private KenhBanHangDongBoServiceImpl service;

    private static final int KENH_ID = 2;
    private final ChatLieu nylon = ChatLieu.builder().id(7).tenChatLieu("Nylon").build();
    private SanPhamQuanAo aoKhoac;
    private SanPhamQuanAo aoPolo;
    private int lienKetId = 1000;
    private int bienTheId = 500;

    @BeforeEach
    void setUp() {
        service = new KenhBanHangDongBoServiceImpl(
                kenhBanHangRepository, trangThaiDongBoSanPhamRepository, bienTheSanPhamRepository, tonKhoTheoLoRepository,
                kenhBanHangService, lichSuThayDoiService, nguoiDungRepository, anhQuanAoRepository, anhBienTheRepository,
                minioService, khoRepository, tonKhoTongHopRepository, omnichannelOrderSyncJob, dieuHanhHeThongService);

        KenhBanHang shopify = KenhBanHang.builder().id(KENH_ID).maKenh("SHOPIFY").tenKenh("Shopify").trangThai(1).build();
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopify));
        when(kenhBanHangRepository.findByMaKenh("LAZADA")).thenReturn(Optional.empty());

        aoKhoac = SanPhamQuanAo.builder().id(12).tenSanPham("Áo Khoác Blouson Cản Gió Cổ Đứng").build();
        aoPolo = SanPhamQuanAo.builder().id(6).tenSanPham("Áo Polo tennis").build();
    }

    // ── Dựng dữ liệu ──

    private TrangThaiDongBoSanPham lienKet(SanPhamQuanAo sp, String mau, String kichCo, String trangThai) {
        int btId = bienTheId++;
        BienTheSanPham bt = BienTheSanPham.builder()
                .id(btId)
                .sanPham(sp)
                .mauSac(MauSac.builder().id(mau.hashCode() & 0xff).tenMau(mau).build())
                .size(Size.builder().id(kichCo.hashCode() & 0xff).tenSize(kichCo).build())
                .chatLieu(nylon)
                .maSku("SKU-" + btId)
                .giaBan(BigDecimal.valueOf(350000))
                .build();
        return TrangThaiDongBoSanPham.builder()
                .id(lienKetId++)
                .bienTheSanPham(bt)
                .maSanPhamKenh("4979771" + btId)
                .trangThaiDongBo(trangThai)
                .build();
    }

    /** 16 phân loại: 4 màu × 4 kích cỡ, như sản phẩm trong ảnh lỗi. */
    private List<TrangThaiDongBoSanPham> muoiSauPhanLoai(SanPhamQuanAo sp) {
        List<TrangThaiDongBoSanPham> ds = new ArrayList<>();
        for (String mau : List.of("Nâu", "Đen", "Kem", "Xanh than")) {
            for (String kichCo : List.of("S", "M", "L", "XL")) ds.add(lienKet(sp, mau, kichCo, "thanh_cong"));
        }
        return ds;
    }

    private void trangSanPham(List<Integer> ids, long tongSanPham) {
        when(trangThaiDongBoSanPhamRepository.pageSanPhamIdTheoKenh(eq(KENH_ID), any(), any(), any()))
                .thenAnswer(inv -> new PageImpl<>(ids, inv.getArgument(3, Pageable.class), tongSanPham));
    }

    private void lienKetCuaTrang(List<TrangThaiDongBoSanPham> dong) {
        when(trangThaiDongBoSanPhamRepository.findTheoKenhVaSanPham(eq(KENH_ID), any(), any(), any())).thenReturn(dong);
    }

    private static List<Object[]> hang(Object[]... rows) {
        return new ArrayList<>(List.of(rows));
    }

    // ── Kiểm thử ──

    @Test
    void sanPhamNhieuPhanLoai_traVeDuTrongMotNhom() {
        List<TrangThaiDongBoSanPham> dong = new ArrayList<>(muoiSauPhanLoai(aoKhoac));
        dong.add(lienKet(aoPolo, "Trắng", "M", "thanh_cong"));
        trangSanPham(List.of(12, 6), 2);
        lienKetCuaTrang(dong);

        Page<NhomLienKetDto> trang = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20));

        assertEquals(2, trang.getContent().size());
        NhomLienKetDto khoac = trang.getContent().get(0);
        assertEquals(12, khoac.getSanPhamId());
        assertEquals("Áo Khoác Blouson Cản Gió Cổ Đứng", khoac.getTenSanPham());
        assertEquals(16, khoac.getBienThe().size());
        assertEquals(16, khoac.getTongPhanLoai());
        assertEquals(1, trang.getContent().get(1).getTongPhanLoai());
        // Không lọc thì không cần đếm riêng tổng SKU
        verify(trangThaiDongBoSanPhamRepository, never()).demLienKetTheoSanPham(any(), any());
    }

    @Test
    void totalElementsLaSoSanPham_khongPhaiSoSku() {
        trangSanPham(List.of(12), 23);
        lienKetCuaTrang(muoiSauPhanLoai(aoKhoac));

        Page<NhomLienKetDto> trang = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 1));

        assertEquals(23, trang.getTotalElements());
        assertEquals(23, trang.getTotalPages());
        assertEquals(16, trang.getContent().get(0).getBienThe().size());
    }

    @Test
    void boSapXepCuaYeuCau_giuSoTrangVaSoDong() {
        trangSanPham(List.of(12), 60);
        lienKetCuaTrang(muoiSauPhanLoai(aoKhoac));

        service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(2, 20, Sort.by("id").descending()));

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(trangThaiDongBoSanPhamRepository).pageSanPhamIdTheoKenh(eq(KENH_ID), isNull(), isNull(), pageable.capture());
        assertEquals(2, pageable.getValue().getPageNumber());
        assertEquals(20, pageable.getValue().getPageSize());
        // Truy vấn có GROUP BY và thứ tự riêng: không được nối thêm ORDER BY t.id
        assertTrue(pageable.getValue().getSort().isUnsorted());
        verify(trangThaiDongBoSanPhamRepository).findTheoKenhVaSanPham(eq(KENH_ID), eq(List.of(12)), isNull(), isNull());
    }

    @Test
    void dangTimKiem_nhomChiCoSkuKhop_tongPhanLoaiLaCuaCaSanPham() {
        trangSanPham(List.of(12), 1);
        lienKetCuaTrang(List.of(lienKet(aoKhoac, "Nâu", "M", "thanh_cong")));
        when(trangThaiDongBoSanPhamRepository.demLienKetTheoSanPham(eq(KENH_ID), any())).thenReturn(hang(new Object[]{12, 16L}));

        NhomLienKetDto nhom = service.filterLienKetTheoSanPham("SHOPIFY", "  nau-m ", "   ", PageRequest.of(0, 20))
                .getContent().get(0);

        assertEquals(1, nhom.getBienThe().size());
        assertEquals(16, nhom.getTongPhanLoai());
        // Từ khóa bỏ khoảng trắng hai đầu, trạng thái rỗng coi như không lọc, cả hai truy vấn dùng cùng bộ lọc
        verify(trangThaiDongBoSanPhamRepository).pageSanPhamIdTheoKenh(eq(KENH_ID), isNull(), eq("nau-m"), any());
        verify(trangThaiDongBoSanPhamRepository).findTheoKenhVaSanPham(eq(KENH_ID), eq(List.of(12)), isNull(), eq("nau-m"));
        verify(trangThaiDongBoSanPhamRepository).demLienKetTheoSanPham(KENH_ID, List.of(12));
    }

    @Test
    void locTheoTrangThai_truyenXuongCaHaiTruyVan() {
        trangSanPham(List.of(12), 1);
        lienKetCuaTrang(List.of(lienKet(aoKhoac, "Đen", "XL", "that_bai"), lienKet(aoKhoac, "Đen", "L", "that_bai")));
        when(trangThaiDongBoSanPhamRepository.demLienKetTheoSanPham(eq(KENH_ID), any())).thenReturn(hang(new Object[]{12, 16L}));

        NhomLienKetDto nhom = service.filterLienKetTheoSanPham("SHOPIFY", null, "that_bai", PageRequest.of(0, 20))
                .getContent().get(0);

        assertEquals(2, nhom.getBienThe().size());
        assertEquals(16, nhom.getTongPhanLoai());
        assertTrue(nhom.getBienThe().stream().allMatch(d -> "that_bai".equals(d.getTrangThaiLienKet())));
        verify(trangThaiDongBoSanPhamRepository).pageSanPhamIdTheoKenh(eq(KENH_ID), eq("that_bai"), isNull(), any());
        verify(trangThaiDongBoSanPhamRepository).findTheoKenhVaSanPham(eq(KENH_ID), any(), eq("that_bai"), isNull());
    }

    @Test
    void tonKhaDung_motTruyVanChoCaTrang_bienTheKhongCoTonLa0() {
        TrangThaiDongBoSanPham a = lienKet(aoKhoac, "Nâu", "S", "thanh_cong");
        TrangThaiDongBoSanPham b = lienKet(aoKhoac, "Nâu", "M", "thanh_cong");
        TrangThaiDongBoSanPham c = lienKet(aoPolo, "Trắng", "M", "thanh_cong");
        trangSanPham(List.of(12, 6), 2);
        lienKetCuaTrang(List.of(a, b, c));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(hang(
                new Object[]{a.getBienTheSanPham().getId(), BigDecimal.valueOf(7)},
                new Object[]{c.getBienTheSanPham().getId(), BigDecimal.valueOf(3)}));

        List<NhomLienKetDto> nhom = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20)).getContent();

        verify(tonKhoTongHopRepository, times(1)).sumTongFreeToUseToanHeThongByBienTheIds(List.of(
                a.getBienTheSanPham().getId(), b.getBienTheSanPham().getId(), c.getBienTheSanPham().getId()));
        assertEquals(BigDecimal.valueOf(7), nhom.get(0).getBienThe().get(0).getSoLuongKhaDung());
        assertEquals(BigDecimal.ZERO, nhom.get(0).getBienThe().get(1).getSoLuongKhaDung());
        assertEquals(BigDecimal.valueOf(3), nhom.get(1).getBienThe().get(0).getSoLuongKhaDung());
    }

    @Test
    void trangRong_khongTruyVanThem_giuTongSoSanPham() {
        trangSanPham(List.of(), 3);

        Page<NhomLienKetDto> trang = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(5, 20));

        assertTrue(trang.getContent().isEmpty());
        assertEquals(3, trang.getTotalElements());
        verify(trangThaiDongBoSanPhamRepository, never()).findTheoKenhVaSanPham(any(), any(), any(), any());
        verifyNoInteractions(tonKhoTongHopRepository, anhQuanAoRepository);
    }

    @Test
    void giuThuTuSanPhamCuaTrang_vaThuTuPhanLoaiCuaTruyVan() {
        TrangThaiDongBoSanPham k1 = lienKet(aoKhoac, "Nâu", "S", "thanh_cong");
        TrangThaiDongBoSanPham p1 = lienKet(aoPolo, "Trắng", "M", "thanh_cong");
        TrangThaiDongBoSanPham k2 = lienKet(aoKhoac, "Nâu", "M", "chua_dong_bo");
        trangSanPham(List.of(6, 12), 2);
        lienKetCuaTrang(List.of(k1, p1, k2));

        List<NhomLienKetDto> nhom = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20)).getContent();

        assertEquals(List.of(6, 12), nhom.stream().map(NhomLienKetDto::getSanPhamId).toList());
        assertEquals(List.of(k1.getId(), k2.getId()), nhom.get(1).getBienThe().stream().map(LienKetSanPhamDto::getId).toList());
    }

    @Test
    void anhDaiDienTheoSanPham_motTruyVan_ganChoNhomVaTungDong() {
        trangSanPham(List.of(12, 6), 2);
        lienKetCuaTrang(List.of(lienKet(aoKhoac, "Nâu", "S", "thanh_cong"), lienKet(aoPolo, "Trắng", "M", "thanh_cong")));
        AnhQuanAo anh = AnhQuanAo.builder().id(1).quanAo(aoKhoac).anhChinh(1)
                .tepTin(TepTin.builder().id(1).duongDan("https://minio.slmglobal.vn/fashion/blouson.jpg").build()).build();
        when(anhQuanAoRepository.findActiveByQuanAoIds(any())).thenReturn(List.of(anh));

        List<NhomLienKetDto> nhom = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20)).getContent();

        assertEquals("https://minio.slmglobal.vn/fashion/blouson.jpg", nhom.get(0).getAnhDaiDien());
        assertEquals("https://minio.slmglobal.vn/fashion/blouson.jpg", nhom.get(0).getBienThe().get(0).getAnhDaiDien());
        assertNull(nhom.get(1).getAnhDaiDien());
        verify(anhQuanAoRepository, times(1)).findActiveByQuanAoIds(List.of(12, 6));
    }

    @Test
    void sanPhamMatLienKetGiuaHaiTruyVan_boQuaNhomRong() {
        trangSanPham(List.of(12, 6), 2);
        lienKetCuaTrang(List.of(lienKet(aoKhoac, "Nâu", "S", "thanh_cong")));

        List<NhomLienKetDto> nhom = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20)).getContent();

        assertEquals(1, nhom.size());
        assertEquals(12, nhom.get(0).getSanPhamId());
    }

    @Test
    void dongLienKet_tenPhanLoaiVaTrangThaiNhuDanhSachCu() {
        trangSanPham(List.of(12), 1);
        lienKetCuaTrang(List.of(
                lienKet(aoKhoac, "Nâu", "XL", "thanh_cong"),
                lienKet(aoKhoac, "Nâu", "L", "chua_dong_bo"),
                lienKet(aoKhoac, "Nâu", "M", "that_bai")));

        List<LienKetSanPhamDto> dong = service.filterLienKetTheoSanPham("SHOPIFY", null, null, PageRequest.of(0, 20))
                .getContent().get(0).getBienThe();

        assertEquals("Nâu - XL - Nylon", dong.get(0).getTenBienThe());
        assertEquals("Áo Khoác Blouson Cản Gió Cổ Đứng", dong.get(0).getTenSanPham());
        assertEquals(12, dong.get(0).getSanPhamId());
        assertEquals(List.of("da_lien_ket", "chua_lien_ket", "that_bai"),
                dong.stream().map(LienKetSanPhamDto::getTrangThaiLienKet).toList());
    }

    @Test
    void kenhKhongTonTai_baoLoi() {
        assertThrows(CommonException.class,
                () -> service.filterLienKetTheoSanPham("LAZADA", null, null, PageRequest.of(0, 20)));
        verifyNoInteractions(trangThaiDongBoSanPhamRepository);
    }

    @Test
    void danhSachCuTheoSku_tonKhaDungMotTruyVanChoCaTrang() {
        TrangThaiDongBoSanPham a = lienKet(aoKhoac, "Nâu", "S", "thanh_cong");
        TrangThaiDongBoSanPham b = lienKet(aoKhoac, "Nâu", "M", "thanh_cong");
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(KENH_ID), any(), any(), any())).thenReturn(new PageImpl<>(List.of(a, b)));
        when(tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(any())).thenReturn(hang(
                new Object[]{b.getBienTheSanPham().getId(), BigDecimal.valueOf(4)}));

        List<LienKetSanPhamDto> dong = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 20)).getContent();

        verify(tonKhoTongHopRepository, times(1)).sumTongFreeToUseToanHeThongByBienTheIds(any());
        assertEquals(BigDecimal.ZERO, dong.get(0).getSoLuongKhaDung());
        assertEquals(BigDecimal.valueOf(4), dong.get(1).getSoLuongKhaDung());
    }
}
