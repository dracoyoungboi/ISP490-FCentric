package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.BienTheSanPhamCreating;
import com.dev.backend.dto.request.SanPhamQuanAoBasicInfoUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tên sản phẩm không trùng: không phân biệt hoa thường, có phân biệt dấu, gộp khoảng trắng, tính mọi trạng thái;
 * áp cho tạo mới, sửa đầy đủ và sửa thông tin cơ bản. Sửa mà giữ nguyên tên thì không kiểm tra.
 * Repository được giả lập nên không kiểm được collation / REGEXP_REPLACE của MySQL (tập ứng viên).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SanPhamQuanAoServiceTenTrungTest {

    private static final int SP_ID = 1;
    private static final int SP_KHAC_ID = 5;

    @Mock private SanPhamQuanAoRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private Query truyVanTon;
    @Mock private TypedQuery<BienTheSanPham> truyVanBienThe;
    @Mock private DanhMucQuanAoService danhMucQuanAoService;
    @Mock private BienTheSanPhamService bienTheSanPhamService;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private NguoiDungService nguoiDungService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private SanPhamQuanAoMapper sanPhamQuanAoMapper;
    @Mock private GiaBanBienTheService giaBanBienTheService;
    @Mock private com.dev.backend.services.multitable.DieuHanhHeThongService dieuHanhHeThongService;

    private SanPhamQuanAoService service;
    private SanPhamQuanAo sanPham;

    @BeforeEach
    void setUp() {
        service = new SanPhamQuanAoService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "danhMucQuanAoService", danhMucQuanAoService);
        ReflectionTestUtils.setField(service, "bienTheSanPhamService", bienTheSanPhamService);
        ReflectionTestUtils.setField(service, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "sanPhamQuanAoMapper", sanPhamQuanAoMapper);
        ReflectionTestUtils.setField(service, "giaBanBienTheService", giaBanBienTheService);
        ReflectionTestUtils.setField(service, "dieuHanhHeThongService", dieuHanhHeThongService);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());

        sanPham = SanPhamQuanAo.builder().id(SP_ID).maSanPham("AK2610051").tenSanPham("áo khoác gió").trangThai(1).build();
        sanPham.setBienTheSanPhams(new ArrayList<>());
        when(repository.findById(SP_ID)).thenAnswer(inv -> Optional.of(sanPham));
        when(repository.findDetailById(SP_ID)).thenAnswer(inv -> Optional.of(sanPham));
        when(repository.save(any(SanPhamQuanAo.class))).thenAnswer(inv -> inv.getArgument(0));
        when(sanPhamQuanAoMapper.toDto(any(SanPhamQuanAo.class))).thenReturn(SanPhamQuanAoDto.builder().build());
        when(danhMucQuanAoService.getOne(28)).thenReturn(Optional.of(DanhMucQuanAo.builder().id(28).build()));
        when(bienTheSanPhamRepository.findBySanPham_Id(SP_ID)).thenReturn(List.of());
        when(bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(SP_ID)).thenReturn(List.of());
        // recalculatePriceAndStatus sau khi sửa đầy đủ: chưa có biến thể/tồn kho
        when(entityManager.createQuery(anyString(), eq(BienTheSanPham.class))).thenReturn(truyVanBienThe);
        when(truyVanBienThe.setParameter(anyString(), any())).thenReturn(truyVanBienThe);
        when(truyVanBienThe.getResultList()).thenReturn(List.of());
        when(entityManager.createNativeQuery(anyString())).thenReturn(truyVanTon);
        when(truyVanTon.setParameter(anyString(), any())).thenReturn(truyVanTon);
        when(truyVanTon.getSingleResult()).thenReturn(new Object[]{null, null});
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ---------- chuẩn hóa / so tên ----------

    @Test
    void chuanHoa_boKhoangTrangThua_gopNbsp_veNfc() {
        String nfd = Normalizer.normalize("Áo", Normalizer.Form.NFD);
        assertEquals("Áo thun basic", SanPhamQuanAoService.chuanHoaTenSanPham("  " + nfd + "   thun \tbasic \n"));
        assertNull(SanPhamQuanAoService.chuanHoaTenSanPham(null));
    }

    @Test
    void soTen_khongPhanBietHoaThuong_coPhanBietDau() {
        assertTrue(SanPhamQuanAoService.cungTenSanPham("ÁO THUN  Basic", "áo thun basic"));
        assertFalse(SanPhamQuanAoService.cungTenSanPham("Áo bò", "Ao bo"));
        assertFalse(SanPhamQuanAoService.cungTenSanPham("Đầm", "Dầm"));
    }

    // ---------- tạo mới ----------

    @Test
    void taoMoi_trungTenKhacHoaThuong_bao409KemMaSanPham_khongGhiGi() {
        coSanPhamKhac("ÁO THUN BASIC", 1);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.create(taoMoi(" áo  thun basic "), null, null));

        assertEquals(HttpStatus.CONFLICT, loi.getStatus());
        assertEquals(MaLoi.TEN_SAN_PHAM_TRUNG, loi.getMa());
        assertEquals(SP_KHAC_ID, loi.getData().get("sanPhamId"));
        assertEquals("AT2610155", loi.getData().get("maSanPham"));
        assertEquals("Đã có sản phẩm cùng tên «ÁO THUN BASIC» (mã AT2610155). Vui lòng đặt tên khác.", loi.getMessage());
        verify(repository).findUngVienTrungTen("áo thun basic");
        verify(repository, never()).save(any());
    }

    @Test
    void taoMoi_trungSanPhamNgungHoatDong_vanChan_cauBaoNeuTrangThai() {
        coSanPhamKhac("Áo thun basic", 2);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.create(taoMoi("Áo thun basic"), null, null));

        assertTrue(loi.getMessage().contains("(mã AT2610155, đang ngừng hoạt động)"), loi.getMessage());
    }

    @Test
    void taoMoi_trungSanPhamHetHang_vanChan_khongGhiNgungHoatDong() {
        // Trạng thái 0 = Hết hàng (sản phẩm mới tạo chưa nhập kho), vẫn đang kinh doanh
        coSanPhamKhac("Áo thun basic", 0);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.create(taoMoi("Áo thun basic"), null, null));

        assertTrue(loi.getMessage().contains("(mã AT2610155)"), loi.getMessage());
    }

    @Test
    void taoMoi_nhieuUngVien_boQuaDongKhacDau_chanDongTrungThat() {
        when(repository.findUngVienTrungTen(anyString())).thenReturn(List.of(
                new Object[]{7, "AT2610151", "Áo bò", 1L},
                new Object[]{8, "AT2610152", "ÁO BO", 1L}));

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.create(taoMoi("Áo bo"), null, null));

        assertEquals(8, loi.getData().get("sanPhamId"));
    }

    @Test
    void taoMoi_tenChiToanKhoangTrang_bao400_khongTruyVan() {
        CommonException loi = assertThrows(CommonException.class, () -> service.create(taoMoi("  \t"), null, null));

        assertEquals("Vui lòng nhập tên sản phẩm.", loi.getMessage());
        verify(repository, never()).findUngVienTrungTen(anyString());
        verify(repository, never()).save(any());
    }

    @Test
    void taoMoi_chiKhacDau_khongTinhLaTrung() {
        // CSDL (unicode_ci) trả cả tên khác dấu làm ứng viên; máy chủ phải lọc lại.
        coSanPhamKhac("Áo bò", 1);
        when(danhMucQuanAoService.getOne(28)).thenReturn(Optional.empty());

        CommonException loi = assertThrows(CommonException.class, () -> service.create(taoMoi("Ao bo"), null, null));

        // Qua được bước kiểm tra tên, dừng ở bước sau (danh mục không tồn tại)
        assertTrue(loi.getMessage().startsWith("Danh mục không tồn tại"), loi.getMessage());
    }

    // ---------- sửa đầy đủ ----------

    @Test
    void suaDayDu_doiThanhTenSanPhamKhac_bao409_khongGhiGi() {
        coSanPhamKhac("Áo thun basic", 1);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.update(suaDayDu("Áo Thun Basic"), null, null));

        assertEquals(MaLoi.TEN_SAN_PHAM_TRUNG, loi.getMa());
        assertEquals("áo khoác gió", sanPham.getTenSanPham());
        verify(repository, never()).save(any());
    }

    @Test
    void suaDayDu_chiDoiHoaThuong_khongKiemTra_luuTenDaChuanHoa() {
        // Dữ liệu cũ đang trùng: vẫn phải sửa được sản phẩm này
        coSanPhamKhac("ÁO KHOÁC GIÓ", 1);

        service.update(suaDayDu("  Áo khoác   gió "), null, null);

        verify(repository, never()).findUngVienTrungTen(anyString());
        assertEquals("Áo khoác gió", sanPham.getTenSanPham());
    }

    @Test
    void suaDayDu_ungVienLaChinhSanPhamDangSua_khongTinhLaTrung() {
        when(repository.findUngVienTrungTen(anyString()))
                .thenReturn(List.<Object[]>of(new Object[]{SP_ID, "AK2610051", "Áo khoác dù", 1L}));

        service.update(suaDayDu("Áo khoác dù"), null, null);

        assertEquals("Áo khoác dù", sanPham.getTenSanPham());
    }

    // ---------- sửa thông tin cơ bản ----------

    @Test
    void suaCoBan_doiThanhTenSanPhamKhac_bao409_khongGhiGi() {
        coSanPhamKhac("áo thun basic", 1);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class,
                () -> service.updateBasicInfo(SP_ID, SanPhamQuanAoBasicInfoUpdating.builder().tenSanPham("Áo thun  basic").build()));

        assertEquals(MaLoi.TEN_SAN_PHAM_TRUNG, loi.getMa());
        assertEquals("áo khoác gió", sanPham.getTenSanPham());
        verify(repository, never()).save(any());
    }

    @Test
    void suaCoBan_chiDoiHoaThuong_khongKiemTra_vanLuu() {
        coSanPhamKhac("ÁO KHOÁC GIÓ", 1);

        service.updateBasicInfo(SP_ID, SanPhamQuanAoBasicInfoUpdating.builder().tenSanPham("Áo Khoác Gió").build());

        verify(repository, never()).findUngVienTrungTen(anyString());
        assertEquals("Áo Khoác Gió", sanPham.getTenSanPham());
    }

    @Test
    void suaCoBan_tenMoiChuaCo_luuTenDaChuanHoa() {
        coSanPhamKhac("Áo khoác dù", 1);

        service.updateBasicInfo(SP_ID, SanPhamQuanAoBasicInfoUpdating.builder().tenSanPham(" Áo khoác   bomber ").build());

        assertEquals("Áo khoác bomber", sanPham.getTenSanPham());
        verify(repository).findUngVienTrungTen("Áo khoác bomber");
    }

    // ---------- dữ liệu mẫu ----------

    /** Dòng như truy vấn native trả: id INT → Integer, CAST(trang_thai AS SIGNED) → Long. */
    private void coSanPhamKhac(String ten, int trangThai) {
        when(repository.findUngVienTrungTen(anyString()))
                .thenReturn(List.<Object[]>of(new Object[]{SP_KHAC_ID, "AT2610155", ten, (long) trangThai}));
    }

    private static SanPhamQuanAoCreating taoMoi(String ten) {
        return SanPhamQuanAoCreating.builder()
                .tenSanPham(ten).danhMucId(28).mucTonToiThieu(0).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .bienTheSanPhams(List.of(BienTheSanPhamCreating.builder().mauSacId(25).sizeId(18).chatLieuId(36).build()))
                .build();
    }

    private static SanPhamQuanAoUpdating suaDayDu(String ten) {
        return SanPhamQuanAoUpdating.builder()
                .id(SP_ID).maSanPham("AK2610051").tenSanPham(ten).danhMucId(28)
                .mucTonToiThieu(5).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .isImageUpdated(false)
                .bienTheSanPhams(new ArrayList<>())
                .build();
    }
}
