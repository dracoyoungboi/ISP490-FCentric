package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.AnhSanPhamSapXep;
import com.dev.backend.dto.request.BienTheSanPhamUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.services.MinioService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Cập nhật sản phẩm (form Sửa): ảnh sản phẩm giữ lại + ảnh mới, chỉ xóa tệp sau khi ghi xong;
 * ảnh biến thể theo màu (viTriAnh), biến thể mới dùng lại ảnh của màu; giới hạn số biến thể; cờ còn tồn kho.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SanPhamQuanAoServiceCapNhatTest {

    private static final int SP_ID = 1;
    private static final int MAU_DEN = 25;
    private static final int MAU_TRANG = 29;
    private static final int SIZE_S = 18;
    private static final int SIZE_M = 19;

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
    @Mock private AnhBienTheService anhBienTheService;
    @Mock private AnhBienTheRepository anhBienTheRepository;
    @Mock private AnhQuanAoRepository anhQuanAoRepository;
    @Mock private TepTinService tepTinService;
    @Mock private MinioService minioService;
    @Mock private SanPhamQuanAoMapper sanPhamQuanAoMapper;

    private SanPhamQuanAoService service;
    private SanPhamQuanAo sanPham;
    private final ChatLieu chatLieu = ChatLieu.builder().id(36).maChatLieu("CL-4036").tenChatLieu("Nylon").build();
    private final MauSac den = MauSac.builder().id(MAU_DEN).maMau("MS-2691").tenMau("Đen").build();
    private final MauSac trang = MauSac.builder().id(MAU_TRANG).maMau("MS-7330").tenMau("Trắng").build();
    private final Size sizeS = Size.builder().id(SIZE_S).maSize("S").tenSize("S").build();
    private final Size sizeM = Size.builder().id(SIZE_M).maSize("M").tenSize("M").build();
    private final Map<Integer, TepTin> tepTheoId = new HashMap<>();

    @BeforeEach
    void setUp() throws Exception {
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
        phuThuoc.put("anhBienTheService", anhBienTheService);
        phuThuoc.put("anhBienTheRepository", anhBienTheRepository);
        phuThuoc.put("anhQuanAoRepository", anhQuanAoRepository);
        phuThuoc.put("tepTinService", tepTinService);
        phuThuoc.put("minioService", minioService);
        phuThuoc.put("sanPhamQuanAoMapper", sanPhamQuanAoMapper);
        phuThuoc.forEach((ten, giaTri) -> ReflectionTestUtils.setField(service, ten, giaTri));

        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(danhMucQuanAoService.getOne(28)).thenReturn(Optional.of(DanhMucQuanAo.builder().id(28).build()));
        when(mauSacService.getOne(MAU_DEN)).thenReturn(Optional.of(den));
        when(mauSacService.getOne(MAU_TRANG)).thenReturn(Optional.of(trang));
        when(sizeService.getOne(SIZE_S)).thenReturn(Optional.of(sizeS));
        when(sizeService.getOne(SIZE_M)).thenReturn(Optional.of(sizeM));

        sanPham = SanPhamQuanAo.builder().id(SP_ID).maSanPham("AK2610051").trangThai(1).build();
        sanPham.setBienTheSanPhams(new ArrayList<>());
        when(repository.findById(SP_ID)).thenAnswer(inv -> Optional.of(sanPham));
        when(repository.save(any(SanPhamQuanAo.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bienTheSanPhamRepository.findBySanPham_Id(SP_ID)).thenAnswer(inv -> new ArrayList<>(sanPham.getBienTheSanPhams()));
        when(bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(SP_ID)).thenReturn(List.of());

        // recalculatePriceAndStatus: chưa có tồn kho nào
        when(entityManager.createQuery(anyString(), eq(BienTheSanPham.class))).thenReturn(truyVanBienThe);
        when(truyVanBienThe.setParameter(anyString(), any())).thenReturn(truyVanBienThe);
        when(truyVanBienThe.getResultList()).thenReturn(List.of());
        when(entityManager.createNativeQuery(anyString())).thenReturn(truyVanTon);
        when(truyVanTon.setParameter(anyString(), any())).thenReturn(truyVanTon);
        when(truyVanTon.getSingleResult()).thenReturn(new Object[]{null, null});
        when(bienTheSanPhamService.update(anyInt(), any(BienTheSanPham.class))).thenAnswer(inv -> inv.getArgument(1));
        AtomicInteger idBienThe = new AtomicInteger(200);
        when(bienTheSanPhamService.create(any(BienTheSanPham.class))).thenAnswer(inv -> {
            BienTheSanPham bt = inv.getArgument(0);
            bt.setId(idBienThe.incrementAndGet());
            return bt;
        });

        when(minioService.upload(any(MultipartFile.class), anyString())).thenAnswer(inv -> inv.getArgument(1));
        when(minioService.getPublicUrl(anyString())).thenAnswer(inv -> "https://minio/" + inv.getArgument(0));
        when(minioService.getObjectInfo(anyString()))
                .thenReturn(FileObjectInfo.builder().userMetadata(Map.of("file-extension", "png")).build());
        AtomicInteger idTep = new AtomicInteger(900);
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> {
            TepTin tep = inv.getArgument(0);
            tep.setId(idTep.incrementAndGet());
            tepTheoId.put(tep.getId(), tep);
            return tep;
        });
        when(tepTinService.getOne(anyInt())).thenAnswer(inv -> Optional.ofNullable(tepTheoId.get((Integer) inv.getArgument(0))));
        when(anhBienTheService.create(any(AnhBienThe.class))).thenAnswer(inv -> inv.getArgument(0));
        when(anhBienTheService.update(anyInt(), any(AnhBienThe.class))).thenAnswer(inv -> inv.getArgument(1));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ---------- ảnh sản phẩm ----------

    @Test
    void anhSanPham_giuLaiVaThemMoi_chiGoAnhBiBo_tepMinioXoaSauKhiGhiXong() throws Exception {
        AnhQuanAo anh1 = anhSanPham(1, tep(401, "sp-1.png"));
        AnhQuanAo anh2 = anhSanPham(2, tep(402, "sp-2.png"));
        sanPham.setAnhQuanAos(new ArrayList<>(List.of(anh1, anh2)));
        MultipartFile moi = anh("moi.png");
        SanPhamQuanAoUpdating updating = capNhat(List.of(), true, List.of(
                AnhSanPhamSapXep.builder().viTriTep(0).build(),
                AnhSanPhamSapXep.builder().id(2).build()));

        TransactionSynchronizationManager.initSynchronization();
        service.update(updating, List.of(moi), List.of());

        verify(minioService, times(1)).upload(eq(moi), anyString());
        List<AnhQuanAo> sauLuu = sanPham.getAnhQuanAos();
        assertEquals(2, sauLuu.size());
        assertNull(sauLuu.get(0).getId(), "ảnh mới đứng đầu");
        assertEquals(1, sauLuu.get(0).getAnhChinh());
        assertSame(anh2, sauLuu.get(1));
        assertEquals(0, anh2.getAnhChinh());

        verify(tepTinService).delete(401);
        verify(tepTinService, never()).delete(402);
        verify(tepTinService, never()).hardDeleteNoMessage(anyInt());
        verify(minioService, never()).delete(anyString());
        // Giao dịch ghi xong mới xóa tệp trên MinIO
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(minioService).delete("sp-1.png");
    }

    @Test
    void anhSanPham_goHetAnh_baoLoi_khongXoaGi() {
        sanPham.setAnhQuanAos(new ArrayList<>(List.of(anhSanPham(1, tep(401, "sp-1.png")))));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(List.of(), true, List.of()), null, List.of()));

        assertEquals("Sản phẩm cần ít nhất 1 ảnh. Vui lòng thêm ảnh sản phẩm.", loi.getMessage());
        verify(repository, never()).save(any());
        verify(tepTinService, never()).delete(anyInt());
        verifyNoInteractions(minioService);
    }

    @Test
    void anhSanPham_cachGuiCuKhongCoTep_baoLoiTiengViet() {
        sanPham.setAnhQuanAos(new ArrayList<>(List.of(anhSanPham(1, tep(401, "sp-1.png")))));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(List.of(), true, null), null, List.of()));

        assertEquals("Sản phẩm cần ít nhất 1 ảnh. Vui lòng thêm ảnh sản phẩm.", loi.getMessage());
        verifyNoInteractions(minioService);
    }

    @Test
    void anhSanPham_taiAnhMoiLoi_khongXoaAnhCu() throws Exception {
        sanPham.setAnhQuanAos(new ArrayList<>(List.of(anhSanPham(1, tep(401, "sp-1.png")))));
        when(minioService.upload(any(MultipartFile.class), anyString())).thenThrow(new RuntimeException("mất kết nối"));

        CommonException loi = assertThrows(CommonException.class, () -> service.update(
                capNhat(List.of(), true, List.of(AnhSanPhamSapXep.builder().viTriTep(0).build())),
                List.of(anh("moi.png")), List.of()));

        assertEquals("Không tải được ảnh sản phẩm. Vui lòng thử lại.", loi.getMessage());
        verify(tepTinService, never()).delete(anyInt());
        verify(minioService, never()).delete(anyString());
    }

    @Test
    void anhSanPham_idKhongThuocSanPham_baoLoi() {
        sanPham.setAnhQuanAos(new ArrayList<>(List.of(anhSanPham(1, tep(401, "sp-1.png")))));

        assertThrows(CommonException.class, () -> service.update(
                capNhat(List.of(), true, List.of(AnhSanPhamSapXep.builder().id(99).build())), null, List.of()));
        verify(repository, never()).save(any());
    }

    // ---------- ảnh biến thể theo màu ----------

    @Test
    void anhTheoMau_viTriAnh_doiAnhChoCaMau_taiLenMotLan_xoaTepCuKhiHetDung() throws Exception {
        TepTin tepCu = tep(501, "mau-den-cu.png");
        BienTheSanPham denS = bienTheCoAnh(11, den, sizeS, tepCu);
        BienTheSanPham denM = bienTheCoAnh(12, den, sizeM, tepCu);
        sanPham.getBienTheSanPhams().addAll(List.of(denS, denM));
        when(anhBienTheRepository.countByTepTin_Id(501)).thenReturn(1L, 0L);
        MultipartFile anhMoi = anh("mau-den-moi.png");

        service.update(capNhat(List.of(guiBienThe(11, MAU_DEN, SIZE_S, 0), guiBienThe(12, MAU_DEN, SIZE_M, 0)), false, null),
                null, List.of(anhMoi));

        verify(minioService, times(1)).upload(eq(anhMoi), anyString());
        assertSame(denS.getAnhBienThe().getTepTin(), denM.getAnhBienThe().getTepTin(), "cả màu dùng chung tệp mới");
        assertNotEquals(501, denS.getAnhBienThe().getTepTin().getId());
        verify(tepTinService, times(1)).delete(501);
        verify(minioService).delete("mau-den-cu.png");
    }

    @Test
    void bienTheMoi_khongGuiAnh_dungLaiAnhCuaMau() throws Exception {
        TepTin tepDen = tep(501, "mau-den.png");
        sanPham.getBienTheSanPhams().add(bienTheCoAnh(11, den, sizeS, tepDen));

        service.update(capNhat(List.of(guiBienThe(11, MAU_DEN, SIZE_S, null), guiBienThe(null, MAU_DEN, SIZE_M, null)), false, null),
                null, List.of());

        ArgumentCaptor<AnhBienThe> captor = ArgumentCaptor.forClass(AnhBienThe.class);
        verify(anhBienTheService).create(captor.capture());
        assertSame(tepDen, captor.getValue().getTepTin());
        verify(minioService, never()).upload(any(MultipartFile.class), anyString());
        verify(tepTinService, never()).delete(anyInt());
    }

    @Test
    void thongTinCoBan_maVachVaMoTaDeTrong_luuNull_giongPatchBasicInfo() throws Exception {
        sanPham.getBienTheSanPhams().add(bienTheCoAnh(11, den, sizeS, tep(501, "mau-den.png")));
        sanPham.setMaVach("8935049501234");
        sanPham.setMoTa("Mô tả cũ");
        SanPhamQuanAoUpdating guiLen = capNhat(List.of(guiBienThe(11, MAU_DEN, SIZE_S, null)), false, null);
        guiLen.setMaVach("   ");
        guiLen.setMoTa("");

        service.update(guiLen, null, List.of());

        assertNull(sanPham.getMaVach());
        assertNull(sanPham.getMoTa());
    }

    @Test
    void bienTheMoi_mauMoi_coViTriAnh_taoAnhTuTepGuiLen() throws Exception {
        sanPham.getBienTheSanPhams().add(bienTheCoAnh(11, den, sizeS, tep(501, "mau-den.png")));
        MultipartFile anhTrang = anh("mau-trang.png");

        service.update(capNhat(List.of(guiBienThe(11, MAU_DEN, SIZE_S, null),
                        guiBienThe(null, MAU_TRANG, SIZE_S, 0), guiBienThe(null, MAU_TRANG, SIZE_M, 0)), false, null),
                null, List.of(anhTrang));

        verify(minioService, times(1)).upload(eq(anhTrang), anyString());
        ArgumentCaptor<AnhBienThe> captor = ArgumentCaptor.forClass(AnhBienThe.class);
        verify(anhBienTheService, times(2)).create(captor.capture());
        assertSame(captor.getAllValues().get(0).getTepTin(), captor.getAllValues().get(1).getTepTin());
    }

    @Test
    void viTriAnhKhongCoTep_baoLoiTruocKhiGhi() {
        sanPham.getBienTheSanPhams().add(bienTheCoAnh(11, den, sizeS, tep(501, "mau-den.png")));

        CommonException loi = assertThrows(CommonException.class, () -> service.update(
                capNhat(List.of(guiBienThe(11, MAU_DEN, SIZE_S, 2)), false, null), null, List.of(anh("a.png"))));

        assertEquals("Thiếu tệp ảnh cho biến thể #1", loi.getMessage());
        verify(repository, never()).save(any());
        verifyNoInteractions(minioService);
    }

    @Test
    void themBienTheVuotGioiHan_baoLoi() {
        for (int i = 0; i < 99; i++) {
            MauSac mau = MauSac.builder().id(1000 + i).maMau("M" + i).tenMau("Màu " + i).build();
            sanPham.getBienTheSanPhams().add(BienTheSanPham.builder().id(5000 + i).sanPham(sanPham)
                    .mauSac(mau).size(sizeS).chatLieu(chatLieu).maSku("SKU" + i).build());
        }

        CommonException loi = assertThrows(CommonException.class, () -> service.update(
                capNhat(List.of(guiBienThe(null, MAU_DEN, SIZE_S, null), guiBienThe(null, MAU_DEN, SIZE_M, null)), false, null),
                null, List.of()));

        assertTrue(loi.getMessage().startsWith("Mỗi sản phẩm có tối đa 100 biến thể"), loi.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void cauLoi_dungTuKichCo_khongDungSize() {
        CommonException loi = assertThrows(CommonException.class, () -> service.update(
                capNhat(List.of(guiBienThe(null, MAU_DEN, null, null)), false, null), null, List.of()));

        assertEquals("Biến thể mới #1: vui lòng chọn màu sắc và kích cỡ", loi.getMessage());
    }

    // ---------- chi tiết: cờ còn tồn kho ----------

    @Test
    void chiTiet_danhDauBienTheConTonKho() {
        when(repository.findDetailById(SP_ID)).thenReturn(Optional.of(sanPham));
        BienTheSanPhamDto conTon = BienTheSanPhamDto.builder().id(11).build();
        BienTheSanPhamDto hetTon = BienTheSanPhamDto.builder().id(12).build();
        when(sanPhamQuanAoMapper.toDto(sanPham)).thenReturn(SanPhamQuanAoDto.builder()
                .bienTheSanPhams(List.of(conTon, hetTon)).build());
        when(bienTheSanPhamRepository.findIdConTonKho(SP_ID)).thenReturn(List.of(11));

        service.getDetail(SP_ID);

        assertTrue(conTon.getConTonKho());
        assertFalse(hetTon.getConTonKho());
    }

    // ---------- dữ liệu mẫu ----------

    private TepTin tep(int id, String tenLuuTru) {
        TepTin tep = TepTin.builder().id(id).tenLuuTru(tenLuuTru).build();
        tepTheoId.put(id, tep);
        return tep;
    }

    private AnhQuanAo anhSanPham(int id, TepTin tep) {
        return AnhQuanAo.builder().id(id).quanAo(sanPham).tepTin(tep).anhChinh(id == 1 ? 1 : 0).build();
    }

    private BienTheSanPham bienTheCoAnh(int id, MauSac mau, Size size, TepTin tep) {
        BienTheSanPham bt = BienTheSanPham.builder().id(id).sanPham(sanPham).mauSac(mau).size(size).chatLieu(chatLieu)
                .maSku("AK2610051-CL-4036-" + size.getMaSize() + "-" + mau.getMaMau()).trangThai(1).build();
        bt.setAnhBienThe(AnhBienThe.builder().id(100 + id).bienThe(bt).tepTin(tep).build());
        return bt;
    }

    private static BienTheSanPhamUpdating guiBienThe(Integer id, int mauSacId, Integer sizeId, Integer viTriAnh) {
        return BienTheSanPhamUpdating.builder().id(id).mauSacId(mauSacId).sizeId(sizeId)
                .giaVon(new BigDecimal("100000")).giaBan(new BigDecimal("120000")).trangThai(1).viTriAnh(viTriAnh).build();
    }

    private static SanPhamQuanAoUpdating capNhat(List<BienTheSanPhamUpdating> dsBienThe, boolean doiAnh,
                                                 List<AnhSanPhamSapXep> sapXep) {
        return SanPhamQuanAoUpdating.builder()
                .id(SP_ID).maSanPham("AK2610051").tenSanPham("Áo khoác").danhMucId(28)
                .mucTonToiThieu(5).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .isImageUpdated(doiAnh).anhSanPhamSapXep(sapXep)
                .bienTheSanPhams(new ArrayList<>(dsBienThe))
                .build();
    }

    private static MultipartFile anh(String ten) {
        // Chữ ký PNG: máy chủ nhận dạng ảnh theo byte đầu tệp
        return new MockMultipartFile("anh", ten, "image/png",
                new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3});
    }
}
