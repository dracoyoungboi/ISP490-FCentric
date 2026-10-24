package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.BienTheSanPhamCreating;
import com.dev.backend.dto.request.BienTheSanPhamUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Mã vạch biến thể khi tạo / sửa sản phẩm (để trống thì cấp tiền tố + id đủ 10 chữ số, nhập tay thì giữ nhưng không trùng),
 * đổi giá bán ở form Sửa (cùng kiểm tra và lịch sử với màn Giá bán) và quy tắc tính lại giá theo tồn (giữ giá bán đã đặt).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SanPhamQuanAoServiceMaVachGiaBanTest {

    private static final int SP_ID = 1;
    private static final int MAU_DEN = 25;
    private static final int SIZE_S = 18;
    private static final int SIZE_M = 19;
    private static final int CHAT_LIEU = 36;

    @Mock private SanPhamQuanAoRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private Query truyVanTon;
    @Mock private TypedQuery<BienTheSanPham> truyVanBienThe;
    @Mock private DanhMucQuanAoService danhMucQuanAoService;
    @Mock private BienTheSanPhamService bienTheSanPhamService;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private MauSacService mauSacService;
    @Mock private SizeService sizeService;
    @Mock private ChatLieuService chatLieuService;
    @Mock private NguoiDungService nguoiDungService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private SanPhamQuanAoMapper sanPhamQuanAoMapper;
    @Mock private GiaBanBienTheService giaBanBienTheService;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;

    private SanPhamQuanAoService service;
    private SanPhamQuanAo sanPham;
    private final NguoiDung admin = NguoiDung.builder().id(7).build();
    private final ChatLieu chatLieu = ChatLieu.builder().id(CHAT_LIEU).maChatLieu("CL-4036").tenChatLieu("Nylon").build();
    private final MauSac den = MauSac.builder().id(MAU_DEN).maMau("MS-2691").tenMau("Đen").build();
    private final Size sizeS = Size.builder().id(SIZE_S).maSize("S").tenSize("S").build();
    private final Size sizeM = Size.builder().id(SIZE_M).maSize("M").tenSize("M").build();
    private final AtomicInteger idBienThe = new AtomicInteger(100);

    @BeforeEach
    void setUp() {
        service = new SanPhamQuanAoService(repository);
        Map<String, Object> phuThuoc = new LinkedHashMap<>();
        phuThuoc.put("entityManager", entityManager);
        phuThuoc.put("danhMucQuanAoService", danhMucQuanAoService);
        phuThuoc.put("bienTheSanPhamService", bienTheSanPhamService);
        phuThuoc.put("bienTheSanPhamRepository", bienTheSanPhamRepository);
        phuThuoc.put("mauSacService", mauSacService);
        phuThuoc.put("sizeService", sizeService);
        phuThuoc.put("chatLieuService", chatLieuService);
        phuThuoc.put("nguoiDungService", nguoiDungService);
        phuThuoc.put("lichSuThayDoiService", lichSuThayDoiService);
        phuThuoc.put("sanPhamQuanAoMapper", sanPhamQuanAoMapper);
        phuThuoc.put("giaBanBienTheService", giaBanBienTheService);
        phuThuoc.put("dieuHanhHeThongService", dieuHanhHeThongService);
        phuThuoc.forEach((ten, giaTri) -> ReflectionTestUtils.setField(service, ten, giaTri));

        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(IRoleType.quan_tri_vien)).build());
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(admin));
        when(giaBanBienTheService.nguoiDangThucHien()).thenReturn(admin);
        when(danhMucQuanAoService.getOne(28)).thenReturn(Optional.of(DanhMucQuanAo.builder().id(28).tenDanhMuc("Áo Khoác").build()));
        when(mauSacService.getOne(MAU_DEN)).thenReturn(Optional.of(den));
        when(sizeService.getOne(SIZE_S)).thenReturn(Optional.of(sizeS));
        when(sizeService.getOne(SIZE_M)).thenReturn(Optional.of(sizeM));
        when(chatLieuService.getOne(CHAT_LIEU)).thenReturn(Optional.of(chatLieu));

        sanPham = SanPhamQuanAo.builder().id(SP_ID).maSanPham("AK2610051").tenSanPham("Áo khoác").trangThai(1).build();
        sanPham.setBienTheSanPhams(new ArrayList<>());
        when(repository.countByMaSanPhamStartingWith(anyString())).thenReturn(0L);
        when(repository.save(any(SanPhamQuanAo.class))).thenAnswer(inv -> {
            SanPhamQuanAo sp = inv.getArgument(0);
            if (sp.getId() == null) sp.setId(SP_ID);
            if (sp != sanPham) {
                sp.setBienTheSanPhams(sanPham.getBienTheSanPhams());
                sanPham = sp;
            }
            return sp;
        });
        when(repository.findById(SP_ID)).thenAnswer(inv -> Optional.of(sanPham));
        when(bienTheSanPhamRepository.findBySanPham_Id(SP_ID)).thenAnswer(inv -> new ArrayList<>(sanPham.getBienTheSanPhams()));
        when(bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(SP_ID)).thenReturn(List.of());

        // recalculatePriceAndStatus: mặc định chưa có tồn kho
        when(entityManager.createQuery(anyString(), eq(BienTheSanPham.class))).thenReturn(truyVanBienThe);
        when(truyVanBienThe.setParameter(anyString(), any())).thenReturn(truyVanBienThe);
        when(truyVanBienThe.getResultList()).thenReturn(List.of());
        when(entityManager.createNativeQuery(anyString())).thenReturn(truyVanTon);
        when(truyVanTon.setParameter(anyString(), any())).thenReturn(truyVanTon);
        when(truyVanTon.getSingleResult()).thenReturn(new Object[]{null, null});
        when(bienTheSanPhamService.update(anyInt(), any(BienTheSanPham.class))).thenAnswer(inv -> inv.getArgument(1));
        when(bienTheSanPhamService.create(any(BienTheSanPham.class))).thenAnswer(inv -> {
            BienTheSanPham bt = inv.getArgument(0);
            bt.setId(idBienThe.incrementAndGet());
            return bt;
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ---------- Tạo sản phẩm ----------

    @Test
    void taoSanPham_maVachDeTrong_capTienToCongIdDu10ChuSo_trongCungGiaoDich() throws Exception {
        List<BienTheSanPham> daTao = new ArrayList<>();
        when(bienTheSanPhamService.create(any(BienTheSanPham.class))).thenAnswer(inv -> {
            BienTheSanPham bt = inv.getArgument(0);
            assertNull(bt.getMaVachSku(), "chưa có id thì chưa có mã vạch");
            bt.setId(idBienThe.incrementAndGet());
            daTao.add(bt);
            return bt;
        });

        service.create(sanPhamMoi(List.of(bienTheMoi(SIZE_S, null), bienTheMoi(SIZE_M, "   "))), null, null);

        assertEquals(List.of("2000000101", "2000000102"), daTao.stream().map(BienTheSanPham::getMaVachSku).toList());
        verify(bienTheSanPhamService).update(eq(101), argThat(bt -> "2000000101".equals(bt.getMaVachSku())));
        verify(bienTheSanPhamService).update(eq(102), argThat(bt -> "2000000102".equals(bt.getMaVachSku())));
    }

    @Test
    void taoSanPham_tienToTheoCauHinh() throws Exception {
        when(dieuHanhHeThongService.getCauHinhString(eq(DieuHanhHeThongServiceImpl.CAU_HINH_MA_VACH_TIEN_TO), anyString())).thenReturn("25");
        List<BienTheSanPham> daTao = ghiNhanBienTheTao();

        service.create(sanPhamMoi(List.of(bienTheMoi(SIZE_S, null))), null, null);

        assertEquals("2500000101", daTao.get(0).getMaVachSku());
    }

    @Test
    void taoSanPham_maVachNhapTay_giuNguyen_khongCapMaMoi() throws Exception {
        List<BienTheSanPham> daTao = ghiNhanBienTheTao();

        service.create(sanPhamMoi(List.of(bienTheMoi(SIZE_S, " 8936000000123 "))), null, null);

        assertEquals("8936000000123", daTao.get(0).getMaVachSku());
        verify(bienTheSanPhamService, never()).update(anyInt(), any());
    }

    @Test
    void taoSanPham_maVachNhapTayDaDung_baoLoiTiengViet_khongGhiGi() {
        when(bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase("8936000000123"))
                .thenReturn(Optional.of(BienTheSanPham.builder().id(9).maSku("AK2610001-CL-1-S-MS-1").build()));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.create(sanPhamMoi(List.of(bienTheMoi(SIZE_S, "8936000000123"))), null, null));

        assertEquals("Mã vạch 8936000000123 đã dùng cho SKU AK2610001-CL-1-S-MS-1", loi.getMessage());
        verify(repository, never()).save(any());
        verify(bienTheSanPhamService, never()).create(any(BienTheSanPham.class));
    }

    @Test
    void taoSanPham_haiBienTheCungMaVach_baoLoi() {
        CommonException loi = assertThrows(CommonException.class, () -> service.create(
                sanPhamMoi(List.of(bienTheMoi(SIZE_S, "ABC-1"), bienTheMoi(SIZE_M, "abc-1"))), null, null));
        assertTrue(loi.getMessage().contains("bị trùng"), loi.getMessage());
        verify(bienTheSanPhamService, never()).create(any(BienTheSanPham.class));
    }

    @Test
    void taoSanPham_maTuSinhDaBiNhapTayChoSkuKhac_baoLoiRo() {
        when(bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase("2000000101"))
                .thenReturn(Optional.of(BienTheSanPham.builder().id(5).maSku("AK-CU").build()));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.create(sanPhamMoi(List.of(bienTheMoi(SIZE_S, null))), null, null));

        assertTrue(loi.getMessage().startsWith("Mã vạch tự sinh 2000000101 trùng mã nhập tay của SKU AK-CU"), loi.getMessage());
    }

    // ---------- Sửa sản phẩm ----------

    @Test
    void suaSanPham_bienTheMoi_duocCapMaVach() throws Exception {
        sanPham.getBienTheSanPhams().add(bienTheCu(11, sizeS, "120000"));

        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "120000"), guiBienThe(null, SIZE_M, "120000"))), null, List.of());

        // Lần đầu ghi mã vạch, lần sau là bước tính lại giá theo tồn
        verify(bienTheSanPhamService, atLeastOnce()).update(eq(101), argThat(bt -> "2000000101".equals(bt.getMaVachSku())));
    }

    @Test
    void suaSanPham_doiGiaBan_ghiLichSuLyDoSuaSanPham() throws Exception {
        BienTheSanPham bt = bienTheCu(11, sizeS, "120000");
        sanPham.getBienTheSanPhams().add(bt);

        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "150000"))), null, List.of());

        assertEquals(0, new BigDecimal("150000").compareTo(bt.getGiaBan()));
        verify(giaBanBienTheService).ghiLichSuDoiGia(eq(11), argThat(cu -> cu.compareTo(new BigDecimal("120000")) == 0),
                argThat(moi -> moi.compareTo(new BigDecimal("150000")) == 0), eq("Sửa sản phẩm"), same(admin), any());
    }

    @Test
    void suaSanPham_giaBanNhuCuHoacDeTrong_khongDoi_khongGhiLichSu() throws Exception {
        BienTheSanPham bt = bienTheCu(11, sizeS, "120000.00");
        sanPham.getBienTheSanPhams().add(bt);

        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "120000"))), null, List.of());
        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, null))), null, List.of());

        assertEquals(0, new BigDecimal("120000").compareTo(bt.getGiaBan()), "gửi trống giữ giá cũ");
        verify(giaBanBienTheService, never()).ghiLichSuDoiGia(anyInt(), any(), any(), anyString(), any(), any());
    }

    @Test
    void suaSanPham_doiGiaBanVe0_baoLoiTruocKhiGhi() {
        sanPham.getBienTheSanPhams().add(bienTheCu(11, sizeS, "120000"));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "0"))), null, List.of()));

        assertTrue(loi.getMessage().contains("Giá bán phải lớn hơn 0"), loi.getMessage());
        verify(bienTheSanPhamService, never()).update(anyInt(), any());
        verify(repository, never()).save(any());
    }

    @Test
    void suaSanPham_quanLyKhoDoiGiaBan_bao403_khongGhiGi() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(8).vaiTro(Set.of(IRoleType.quan_ly_kho)).build());
        BienTheSanPham bt = bienTheCu(11, sizeS, "120000");
        sanPham.getBienTheSanPhams().add(bt);

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "150000"))), null, List.of()));

        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, loi.getStatus());
        assertTrue(loi.getMessage().contains("chỉ quản trị viên được đổi giá bán"), loi.getMessage());
        assertEquals(0, new BigDecimal("120000").compareTo(bt.getGiaBan()));
        verify(bienTheSanPhamService, never()).update(anyInt(), any());
        verify(giaBanBienTheService, never()).ghiLichSuDoiGia(anyInt(), any(), any(), anyString(), any(), any());
    }

    @Test
    void suaSanPham_quanLyKhoGiuNguyenGia_vanLuuDuoc() throws Exception {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(8).vaiTro(Set.of(IRoleType.quan_ly_kho)).build());
        sanPham.getBienTheSanPhams().add(bienTheCu(11, sizeS, "120000"));

        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "120000"))), null, List.of());

        verify(giaBanBienTheService, never()).ghiLichSuDoiGia(anyInt(), any(), any(), anyString(), any(), any());
    }

    @Test
    void suaSanPham_bienTheChuaCoGia_formGui0_khongChanLanLuu() throws Exception {
        BienTheSanPham bt = bienTheCu(11, sizeS, "0");
        bt.setGiaBan(null);
        sanPham.getBienTheSanPhams().add(bt);

        service.update(capNhat(List.of(guiBienThe(11, SIZE_S, "0"))), null, List.of());

        verify(giaBanBienTheService, never()).ghiLichSuDoiGia(anyInt(), any(), any(), anyString(), any(), any());
    }

    // ---------- Tính lại giá theo tồn ----------

    @Test
    void tinhLaiGia_conTon_tinhLaiGiaVon_giuGiaBanDaDat() {
        BienTheSanPham coGia = bienTheCu(11, sizeS, "2000000");
        BienTheSanPham chuaGia = bienTheCu(12, sizeM, "0");
        sanPham.getBienTheSanPhams().addAll(List.of(coGia, chuaGia));
        // Tồn 10 cái, tổng giá trị 15.000.000 → giá vốn bình quân 1.500.000
        when(truyVanTon.getSingleResult()).thenReturn(new Object[]{new BigDecimal("15000000"), new BigDecimal("10")});

        service.recalculatePriceAndStatus(SP_ID);

        assertEquals(0, new BigDecimal("1500000").compareTo(coGia.getGiaVon()));
        assertEquals(0, new BigDecimal("2000000").compareTo(coGia.getGiaBan()), "giá bán đã đặt giữ nguyên");
        assertEquals(0, new BigDecimal("1800000").compareTo(chuaGia.getGiaBan()), "chưa có giá thì gợi ý giá vốn × 1,2");
        assertEquals(0, new BigDecimal("1900000").compareTo(sanPham.getGiaBanMacDinh()), "giá mặc định = trung bình giá thật");
    }

    // ---------- dữ liệu mẫu ----------

    private List<BienTheSanPham> ghiNhanBienTheTao() {
        List<BienTheSanPham> daTao = new ArrayList<>();
        when(bienTheSanPhamService.create(any(BienTheSanPham.class))).thenAnswer(inv -> {
            BienTheSanPham bt = inv.getArgument(0);
            bt.setId(idBienThe.incrementAndGet());
            daTao.add(bt);
            return bt;
        });
        return daTao;
    }

    private BienTheSanPham bienTheCu(int id, Size size, String giaBan) {
        return BienTheSanPham.builder().id(id).sanPham(sanPham).mauSac(den).size(size).chatLieu(chatLieu)
                .maSku("AK2610051-CL-4036-" + size.getMaSize() + "-MS-2691").maVachSku("20000000" + id)
                .giaVon(new BigDecimal("100000")).giaBan(new BigDecimal(giaBan)).trangThai(1).build();
    }

    private static BienTheSanPhamCreating bienTheMoi(int sizeId, String maVach) {
        return BienTheSanPhamCreating.builder().mauSacId(MAU_DEN).sizeId(sizeId).chatLieuId(CHAT_LIEU)
                .maVachSku(maVach).giaVon(new BigDecimal("280000")).giaBan(new BigDecimal("459000")).trangThai(1).build();
    }

    private static SanPhamQuanAoCreating sanPhamMoi(List<BienTheSanPhamCreating> ds) {
        return SanPhamQuanAoCreating.builder()
                .tenSanPham("Áo khoác gió unisex").maSanPham("").danhMucId(28).mucTonToiThieu(5).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .bienTheSanPhams(new ArrayList<>(ds))
                .build();
    }

    private static BienTheSanPhamUpdating guiBienThe(Integer id, int sizeId, String giaBan) {
        return BienTheSanPhamUpdating.builder().id(id).mauSacId(MAU_DEN).sizeId(sizeId)
                .giaVon(new BigDecimal("100000")).giaBan(giaBan == null ? null : new BigDecimal(giaBan)).trangThai(1).build();
    }

    private static SanPhamQuanAoUpdating capNhat(List<BienTheSanPhamUpdating> ds) {
        return SanPhamQuanAoUpdating.builder()
                .id(SP_ID).maSanPham("AK2610051").tenSanPham("Áo khoác").danhMucId(28).mucTonToiThieu(5).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .bienTheSanPhams(new ArrayList<>(ds))
                .build();
    }
}
