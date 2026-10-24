package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.BienTheSanPhamCreating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.services.MinioService;
import jakarta.persistence.EntityManager;
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
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Ảnh biến thể theo màu khi tạo sản phẩm: mỗi tệp trong anhBienThes chỉ tải lên 1 lần,
 * các biến thể cùng viTriAnh dùng chung một tệp; cách gửi cũ (ghép theo vị trí) vẫn chạy;
 * đổi ảnh một biến thể không xóa tệp còn biến thể khác dùng chung.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SanPhamQuanAoServiceAnhBienTheTest {

    private static final int MAU_DEN = 25;
    private static final int MAU_TRANG = 29;
    private static final int SIZE_S = 18;
    private static final int SIZE_M = 19;
    private static final int CHAT_LIEU = 36;

    @Mock private SanPhamQuanAoRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private TypedQuery<BienTheSanPham> bienTheQuery;
    @Mock private DanhMucQuanAoService danhMucQuanAoService;
    @Mock private BienTheSanPhamService bienTheSanPhamService;
    @Mock private MauSacService mauSacService;
    @Mock private SizeService sizeService;
    @Mock private ChatLieuService chatLieuService;
    @Mock private NguoiDungService nguoiDungService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private AnhQuanAoService anhQuanAoService;
    @Mock private AnhBienTheService anhBienTheService;
    @Mock private AnhBienTheRepository anhBienTheRepository;
    @Mock private AnhQuanAoRepository anhQuanAoRepository;
    @Mock private TepTinService tepTinService;
    @Mock private MinioService minioService;
    @Mock private SanPhamQuanAoMapper sanPhamQuanAoMapper;

    private SanPhamQuanAoService service;
    private SanPhamQuanAo sanPhamDaLuu;
    /** objectName trên MinIO -> tên tệp gốc đã tải lên, để biết tep_tin nào sinh ra từ tệp nào. */
    private final Map<String, String> tenTepTheoObject = new HashMap<>();

    @BeforeEach
    void setUp() throws Exception {
        service = new SanPhamQuanAoService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "danhMucQuanAoService", danhMucQuanAoService);
        ReflectionTestUtils.setField(service, "bienTheSanPhamService", bienTheSanPhamService);
        ReflectionTestUtils.setField(service, "mauSacService", mauSacService);
        ReflectionTestUtils.setField(service, "sizeService", sizeService);
        ReflectionTestUtils.setField(service, "chatLieuService", chatLieuService);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "anhQuanAoService", anhQuanAoService);
        ReflectionTestUtils.setField(service, "anhBienTheService", anhBienTheService);
        ReflectionTestUtils.setField(service, "anhBienTheRepository", anhBienTheRepository);
        ReflectionTestUtils.setField(service, "anhQuanAoRepository", anhQuanAoRepository);
        ReflectionTestUtils.setField(service, "tepTinService", tepTinService);
        ReflectionTestUtils.setField(service, "minioService", minioService);
        ReflectionTestUtils.setField(service, "sanPhamQuanAoMapper", sanPhamQuanAoMapper);

        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(danhMucQuanAoService.getOne(28)).thenReturn(Optional.of(DanhMucQuanAo.builder().id(28).tenDanhMuc("Áo Khoác").build()));
        when(mauSacService.getOne(MAU_DEN)).thenReturn(Optional.of(MauSac.builder().id(MAU_DEN).maMau("MS-2691").tenMau("Đen").build()));
        when(mauSacService.getOne(MAU_TRANG)).thenReturn(Optional.of(MauSac.builder().id(MAU_TRANG).maMau("MS-7330").tenMau("Trắng").build()));
        when(sizeService.getOne(SIZE_S)).thenReturn(Optional.of(Size.builder().id(SIZE_S).maSize("S").build()));
        when(sizeService.getOne(SIZE_M)).thenReturn(Optional.of(Size.builder().id(SIZE_M).maSize("M").build()));
        when(chatLieuService.getOne(CHAT_LIEU)).thenReturn(Optional.of(ChatLieu.builder().id(CHAT_LIEU).maChatLieu("CL-4036").build()));

        // Lưu sản phẩm cha: gán id; recalculatePriceAndStatus/getOne đọc lại chính bản ghi này.
        when(repository.countByMaSanPhamStartingWith(anyString())).thenReturn(0L);
        when(repository.save(any(SanPhamQuanAo.class))).thenAnswer(inv -> {
            SanPhamQuanAo sp = inv.getArgument(0);
            if (sp.getId() == null) sp.setId(1);
            sanPhamDaLuu = sp;
            return sp;
        });
        when(repository.findById(1)).thenAnswer(inv -> Optional.ofNullable(sanPhamDaLuu));
        when(entityManager.createQuery(anyString(), eq(BienTheSanPham.class))).thenReturn(bienTheQuery);
        when(bienTheQuery.setParameter(anyString(), any())).thenReturn(bienTheQuery);
        when(bienTheQuery.getResultList()).thenReturn(List.of());

        AtomicInteger idBienThe = new AtomicInteger(100);
        when(bienTheSanPhamService.create(any(BienTheSanPham.class))).thenAnswer(inv -> {
            BienTheSanPham bt = inv.getArgument(0);
            bt.setId(idBienThe.incrementAndGet());
            return bt;
        });

        when(minioService.upload(any(MultipartFile.class), anyString())).thenAnswer(inv -> {
            MultipartFile tep = inv.getArgument(0);
            String objectName = inv.getArgument(1);
            tenTepTheoObject.put(objectName, tep.getOriginalFilename());
            return objectName;
        });
        when(minioService.getPublicUrl(anyString())).thenAnswer(inv -> "https://minio/" + inv.getArgument(0));
        when(minioService.getObjectInfo(anyString()))
                .thenReturn(FileObjectInfo.builder().userMetadata(Map.of("file-extension", "png")).build());
        AtomicInteger idTep = new AtomicInteger(900);
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> {
            TepTin tep = inv.getArgument(0);
            tep.setId(idTep.incrementAndGet());
            return tep;
        });
        when(anhBienTheService.create(any(AnhBienThe.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    void taoSanPham_bienTheCungMau_dungChungMotTepAnh() throws Exception {
        MultipartFile anhDen = anh("mau-den.png");
        MultipartFile anhTrang = anh("mau-trang.png");
        SanPhamQuanAoCreating creating = sanPham(List.of(
                bienThe(MAU_DEN, SIZE_S, 0),
                bienThe(MAU_DEN, SIZE_M, 0),
                bienThe(MAU_TRANG, SIZE_S, 1),
                bienThe(MAU_TRANG, SIZE_M, 1)));

        service.create(creating, List.of(anh("anh-chinh.png")), List.of(anhDen, anhTrang));

        // 1 ảnh sản phẩm + 2 ảnh biến thể (mỗi màu 1 lần), không phải 1 + 4.
        verify(minioService, times(3)).upload(any(MultipartFile.class), anyString());
        verify(minioService, times(1)).upload(eq(anhDen), anyString());
        verify(minioService, times(1)).upload(eq(anhTrang), anyString());

        List<AnhBienThe> anhBienThes = anhBienTheDaTao(4);
        Map<Integer, Set<TepTin>> tepTheoMau = anhBienThes.stream().collect(Collectors.groupingBy(
                a -> a.getBienThe().getMauSac().getId(),
                Collectors.mapping(AnhBienThe::getTepTin, Collectors.toCollection(() -> Collections.newSetFromMap(new IdentityHashMap<>())))));
        assertEquals(1, tepTheoMau.get(MAU_DEN).size(), "2 kích cỡ màu Đen phải dùng chung 1 tệp");
        assertEquals(1, tepTheoMau.get(MAU_TRANG).size(), "2 kích cỡ màu Trắng phải dùng chung 1 tệp");
        assertEquals("mau-den.png", tenTepGoc(tepTheoMau.get(MAU_DEN).iterator().next()));
        assertEquals("mau-trang.png", tenTepGoc(tepTheoMau.get(MAU_TRANG).iterator().next()));
    }

    @Test
    void taoSanPham_khongGuiViTriAnh_vanGhepTheoViTriNhuCu() throws Exception {
        SanPhamQuanAoCreating creating = sanPham(List.of(
                bienThe(MAU_DEN, SIZE_S, null),
                bienThe(MAU_TRANG, SIZE_S, null)));

        service.create(creating, List.of(anh("anh-chinh.png")), List.of(anh("bien-the-1.png"), anh("bien-the-2.png")));

        List<AnhBienThe> anhBienThes = anhBienTheDaTao(2);
        assertEquals("bien-the-1.png", tenTepGoc(anhBienThes.get(0).getTepTin()));
        assertEquals("bien-the-2.png", tenTepGoc(anhBienThes.get(1).getTepTin()));
    }

    @Test
    void taoSanPham_tepGiuChoRong_khongTaiLenVaKhongTaoAnh() throws Exception {
        SanPhamQuanAoCreating creating = sanPham(List.of(bienThe(MAU_DEN, SIZE_S, null)));
        MultipartFile tepRong = new MockMultipartFile("anhBienThes", "empty.txt", "text/plain", new byte[0]);

        service.create(creating, List.of(anh("anh-chinh.png")), List.of(tepRong));

        verify(minioService, never()).upload(eq(tepRong), anyString());
        verify(anhBienTheService, never()).create(any(AnhBienThe.class));
    }

    @Test
    void taoSanPham_viTriAnhKhongCoTep_baoLoiTruocKhiGhi() {
        SanPhamQuanAoCreating creating = sanPham(List.of(bienThe(MAU_DEN, SIZE_S, 3)));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.create(creating, List.of(anh("anh-chinh.png")), List.of(anh("mau-den.png"))));

        assertEquals("Thiếu tệp ảnh cho biến thể #1.", loi.getMessage());
        verify(repository, never()).save(any());
        verifyNoInteractions(minioService);
    }

    @Test
    void taoSanPham_anhLaSvgHoacHtml_baoLoiTruocKhiGhi() {
        // Tên .png, khai image/png nhưng nội dung là SVG / HTML có script → không được lưu lên MinIO
        MultipartFile svg = new MockMultipartFile("anh", "mau-den.png", "image/png",
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes());
        MultipartFile html = new MockMultipartFile("anh", "anh-chinh.png", "image/png",
                "<!doctype html><script>alert(1)</script>".getBytes());

        CommonException loiBienThe = assertThrows(CommonException.class, () -> service.create(
                sanPham(List.of(bienThe(MAU_DEN, SIZE_S, 0))), List.of(anh("anh-chinh.png")), List.of(svg)));
        assertEquals("Ảnh \"mau-den.png\" phải là ảnh JPEG, PNG, WebP, GIF hoặc AVIF", loiBienThe.getMessage());

        CommonException loiSanPham = assertThrows(CommonException.class, () -> service.create(
                sanPham(List.of(bienThe(MAU_DEN, SIZE_S, null))), List.of(html), List.of()));
        assertEquals("Ảnh \"anh-chinh.png\" phải là ảnh JPEG, PNG, WebP, GIF hoặc AVIF", loiSanPham.getMessage());

        verify(repository, never()).save(any());
        verifyNoInteractions(minioService);
    }

    @Test
    void taoSanPham_quaGioiHanBienThe_baoLoi() {
        List<BienTheSanPhamCreating> dsBienThe = IntStream.range(0, 101)
                .mapToObj(i -> BienTheSanPhamCreating.builder().mauSacId(1000 + i).sizeId(SIZE_S).chatLieuId(CHAT_LIEU).build())
                .toList();

        CommonException loi = assertThrows(CommonException.class,
                () -> service.create(sanPham(dsBienThe), List.of(), List.of()));

        assertTrue(loi.getMessage().contains("tối đa 100 biến thể"));
        verify(repository, never()).save(any());
    }

    @Test
    void taoSanPham_trungToHop_baoLoi() {
        SanPhamQuanAoCreating creating = sanPham(List.of(bienThe(MAU_DEN, SIZE_S, 0), bienThe(MAU_DEN, SIZE_S, 0)));

        assertThrows(CommonException.class,
                () -> service.create(creating, List.of(), List.of(anh("mau-den.png"))));
        verify(repository, never()).save(any());
    }

    @Test
    void taoSanPham_giaAm_baoLoi() {
        BienTheSanPhamCreating bt = bienThe(MAU_DEN, SIZE_S, 0);
        bt.setGiaBan(new BigDecimal("-1"));

        CommonException loi = assertThrows(CommonException.class,
                () -> service.create(sanPham(List.of(bt)), List.of(), List.of(anh("mau-den.png"))));
        assertEquals("Giá của biến thể #1 không được âm.", loi.getMessage());
    }

    @Test
    void doiAnhBienThe_tepCuConBienTheKhacDung_khongXoaTepCu() {
        BienTheSanPham bienThe = bienTheCoAnh(555);
        when(anhBienTheRepository.countByTepTin_Id(555)).thenReturn(5L);

        doiAnh(bienThe);

        verify(tepTinService, never()).delete(anyInt());
        verify(minioService, never()).delete(anyString());
        assertNotEquals(555, bienThe.getAnhBienThe().getTepTin().getId());
    }

    @Test
    void doiAnhBienThe_tepCuKhongConAiDung_xoaTepCu() {
        BienTheSanPham bienThe = bienTheCoAnh(555);
        when(anhBienTheRepository.countByTepTin_Id(555)).thenReturn(0L);
        when(tepTinService.getOne(555)).thenReturn(Optional.of(TepTin.builder().id(555).tenLuuTru("anh-cu.png").build()));

        doiAnh(bienThe);

        // Không có giao dịch đang chạy (unit test) nên xóa luôn; khi chạy thật, MinIO xóa sau khi giao dịch ghi xong.
        verify(tepTinService).delete(555);
        verify(minioService).delete("anh-cu.png");
    }

    // ---------- dữ liệu mẫu ----------

    private void doiAnh(BienTheSanPham bienThe) {
        ReflectionTestUtils.invokeMethod(service, "capNhatAnhBienThe",
                bienThe, anh("anh-moi.png"), "AK2610121", 1L, 0, Instant.now());
    }

    private BienTheSanPham bienTheCoAnh(int idTepCu) {
        BienTheSanPham bienThe = BienTheSanPham.builder().id(501).maSku("AK2610121-CL-4036-S-MS-2691").build();
        bienThe.setAnhBienThe(AnhBienThe.builder().id(77).bienThe(bienThe).tepTin(TepTin.builder().id(idTepCu).build()).build());
        when(anhBienTheService.update(eq(77), any(AnhBienThe.class))).thenAnswer(inv -> inv.getArgument(1));
        return bienThe;
    }

    private List<AnhBienThe> anhBienTheDaTao(int soLuong) {
        ArgumentCaptor<AnhBienThe> captor = ArgumentCaptor.forClass(AnhBienThe.class);
        verify(anhBienTheService, times(soLuong)).create(captor.capture());
        return captor.getAllValues();
    }

    private String tenTepGoc(TepTin tepTin) {
        return tenTepTheoObject.get(tepTin.getTenLuuTru());
    }

    private static MultipartFile anh(String ten) {
        // Chữ ký PNG: máy chủ nhận dạng ảnh theo byte đầu tệp
        return new MockMultipartFile("anh", ten, "image/png",
                new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3});
    }

    private static BienTheSanPhamCreating bienThe(int mauSacId, int sizeId, Integer viTriAnh) {
        return BienTheSanPhamCreating.builder()
                .mauSacId(mauSacId).sizeId(sizeId).chatLieuId(CHAT_LIEU)
                .giaVon(new BigDecimal("280000")).giaBan(new BigDecimal("459000"))
                .trangThai(1).viTriAnh(viTriAnh)
                .build();
    }

    private static SanPhamQuanAoCreating sanPham(List<BienTheSanPhamCreating> dsBienThe) {
        return SanPhamQuanAoCreating.builder()
                .tenSanPham("Áo khoác gió unisex").maSanPham("").danhMucId(28)
                .mucTonToiThieu(5).trangThai(1)
                .giaVonMacDinh(BigDecimal.ZERO).giaBanMacDinh(BigDecimal.ZERO)
                .bienTheSanPhams(new ArrayList<>(dsBienThe))
                .build();
    }
}
