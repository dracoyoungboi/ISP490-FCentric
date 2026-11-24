package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.LocGiaBanRequest;
import com.dev.backend.dto.response.customize.TrangGiaBanDto;
import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.MauSac;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.Size;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.GiaBanBienTheService;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.utils.XemGiaVon;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Quyền của màn "Tem mã vạch" và giá vốn (SRS 4.4 "Barcode – Generate / Print", UC 2.7, SRS 2.4.1): quản lý kho,
 * nhân viên kho, nhân viên bán hàng xem danh sách để in tem; in tem theo phiếu nhập cho vai trò kho. Màn tem không đổi
 * giá và không trả giá vốn; giá bán chỉ đổi ở form Sửa sản phẩm (quản trị viên). Số SKU "Cần xử lý giá" chỉ quản trị
 * viên. Các API đổi giá cũ (PATCH /sku/{id}/price, PATCH /sku/gia-ban) đã gỡ.
 */
class GiaBanTemQuyenTest {

    static final String QT = IRoleType.quan_tri_vien;
    static final String QLK = IRoleType.quan_ly_kho;
    static final String NVK = IRoleType.nhan_vien_kho;
    static final String NVMH = IRoleType.nhan_vien_mua_hang;
    static final String NVBH = IRoleType.nhan_vien_ban_hang;

    private static Set<String> vaiTro(Class<?> controller, Class<? extends Annotation> loai, String duongDan) {
        Method m = Arrays.stream(controller.getDeclaredMethods())
                .filter(x -> x.isAnnotationPresent(loai))
                .filter(x -> Arrays.asList(duongDanCua(x.getAnnotation(loai))).contains(duongDan))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Không thấy " + duongDan + " trong " + controller.getSimpleName()));
        RequireAuth yeuCau = m.getAnnotation(RequireAuth.class);
        assertNotNull(yeuCau, duongDan + " phải bắt buộc đăng nhập");
        assertEquals(yeuCau.roles().length, Set.of(yeuCau.roles()).size(), "lặp vai trò: " + duongDan);
        return new HashSet<>(Arrays.asList(yeuCau.roles()));
    }

    private static String[] duongDanCua(Annotation a) {
        if (a instanceof GetMapping g) return g.value();
        if (a instanceof PostMapping p) return p.value();
        if (a instanceof PatchMapping p) return p.value();
        if (a instanceof PutMapping p) return p.value();
        if (a instanceof DeleteMapping d) return d.value();
        return new String[0];
    }

    private static void dangNhap(String... vaiTro) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(9).vaiTro(Set.of(vaiTro)).build());
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    // ───────── Ai gọi được API nào ─────────

    @Nested
    @DisplayName("Vai trò của các API")
    class VaiTroApi {

        @Test
        @DisplayName("Số SKU cần xử lý giá: chỉ quản trị viên")
        void canXuLyGia_chiQuanTriVien() {
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, GetMapping.class, "/gia-ban/can-xu-ly"));
        }

        @Test
        @DisplayName("Danh sách giá bán: quản trị viên và người in tem (quản lý kho, nhân viên kho, nhân viên bán hàng)")
        void danhSachGiaBan_nguoiInTem() {
            // SRS 4.4 "Barcode – Generate / Print" + UC 2.7; nhân viên mua hàng không in tem
            assertEquals(Set.of(QT, QLK, NVK, NVBH), vaiTro(SanPhamQuanAoController.class, PostMapping.class, "/gia-ban/filter"));
        }

        @Test
        @DisplayName("Các API đổi giá riêng đã gỡ: giá bán chỉ đổi ở form Sửa sản phẩm")
        void apiDoiGiaRieng_daGo() {
            boolean conApiCu = Arrays.stream(SanPhamQuanAoController.class.getDeclaredMethods())
                    .filter(m -> m.isAnnotationPresent(PatchMapping.class))
                    .map(m -> Arrays.asList(m.getAnnotation(PatchMapping.class).value()))
                    .anyMatch(ds -> ds.contains("/sku/{id}/price") || ds.contains("/sku/gia-ban"));
            assertFalse(conApiCu);
        }

        @Test
        @DisplayName("In tem: cấu hình tem, tra mã cho người in tem; số lượng in theo phiếu nhập chỉ vai trò kho")
        void inTem_moChoNhanVienKho() {
            Set<String> kho = Set.of(QT, QLK, NVK);
            Set<String> inTem = Set.of(QT, QLK, NVK, NVBH);
            assertEquals(inTem, vaiTro(TemSanPhamController.class, GetMapping.class, "/cau-hinh"));
            assertEquals(inTem, vaiTro(TemSanPhamController.class, GetMapping.class, "/tra-ma"));
            assertEquals(kho, vaiTro(PhieuNhapKhoController.class, GetMapping.class, "/{id}/so-luong-in-tem"));
            assertEquals(kho, vaiTro(PhieuNhapKhoController.class, GetMapping.class, "/in-tem/da-hoan-tat"));
        }

        @Test
        @DisplayName("Lịch sử giá, lịch sử sản phẩm: quản trị viên và quản lý kho")
        void lichSu_quanTriVaQuanLyKho() {
            assertEquals(Set.of(QT, QLK), vaiTro(SanPhamQuanAoController.class, GetMapping.class, "/sku/{bienTheId}/lich-su-gia"));
            assertEquals(Set.of(QT, QLK), vaiTro(SanPhamQuanAoController.class, GetMapping.class, "/{id}/lich-su"));
        }

        @Test
        @DisplayName("Xem sản phẩm: mọi vai trò (giá vốn ẩn riêng với nhân viên bán hàng)")
        void xemSanPham_moiVaiTro() {
            Set<String> tatCa = Set.of(QT, QLK, NVK, NVMH, NVBH);
            assertEquals(tatCa, vaiTro(SanPhamQuanAoController.class, PostMapping.class, "/filter"));
            assertEquals(tatCa, vaiTro(SanPhamQuanAoController.class, GetMapping.class, "/get-by-id/{id}"));
            assertEquals(tatCa, vaiTro(SanPhamQuanAoController.class, GetMapping.class, "/theo-kho/{khoId}"));
        }

        @Test
        @DisplayName("Tạo, sửa, ngừng bán sản phẩm: chỉ quản trị viên")
        void ghiSanPham_chiQuanTriVien() {
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, PostMapping.class, "/create"));
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, PutMapping.class, "/update"));
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, PatchMapping.class, "/basic-info/{id}"));
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, PatchMapping.class, "/status/{id}"));
            assertEquals(Set.of(QT), vaiTro(SanPhamQuanAoController.class, DeleteMapping.class, "/soft-delete/{id}"));
        }
    }

    // ───────── Giá vốn ─────────

    @Nested
    @DisplayName("Giá vốn: ai được thấy")
    class GiaVon {

        @Test
        @DisplayName("XemGiaVon.duocXem: mọi vai trò trừ nhân viên bán hàng; có thêm vai trò được xem thì vẫn thấy")
        void xemGiaVon_nhanVienBanHangKhongThay_vaiTroKhacThay() {
            assertFalse(XemGiaVon.duocXem(Set.of(NVBH)));
            assertFalse(XemGiaVon.duocXem(Set.of()));
            assertFalse(XemGiaVon.duocXem(null));
            assertFalse(XemGiaVon.duocXem(Set.of("khach_hang")));
            for (String vt : List.of(QT, QLK, NVK, NVMH)) assertTrue(XemGiaVon.duocXem(Set.of(vt)), vt);
            assertTrue(XemGiaVon.duocXem(Set.of(NVBH, QT)));
        }

        @Test
        @DisplayName("Người đang đăng nhập: nhân viên bán hàng không thấy; gọi nội bộ (không qua HTTP) thì thấy")
        void nguoiDangNhapDuocXem() {
            assertTrue(XemGiaVon.nguoiDangNhapDuocXem(), "không có người đăng nhập: gọi nội bộ");
            dangNhap(NVBH);
            assertFalse(XemGiaVon.nguoiDangNhapDuocXem());
            dangNhap(QLK);
            assertTrue(XemGiaVon.nguoiDangNhapDuocXem());
        }

        @Test
        @DisplayName("anGiaVon: xóa giá vốn sản phẩm và biến thể, giữ giá bán")
        void anGiaVon_xoaGiaVonSanPhamVaBienThe_giuGiaBan() {
            SanPhamQuanAoDto dto = sanPhamDto();

            SanPhamQuanAoController.anGiaVon(dto);

            assertNull(dto.getGiaVonMacDinh());
            assertNull(dto.getBienTheSanPhams().get(0).getGiaVon());
            assertEquals(0, new BigDecimal("150").compareTo(dto.getBienTheSanPhams().get(0).getGiaBan()));
        }

        @Test
        @DisplayName("anGiaVon: sản phẩm chưa có biến thể không lỗi")
        void anGiaVon_khongBienThe() {
            SanPhamQuanAoDto dto = SanPhamQuanAoDto.builder().giaVonMacDinh(new BigDecimal("100")).build();
            assertDoesNotThrow(() -> SanPhamQuanAoController.anGiaVon(dto));
            assertNull(dto.getGiaVonMacDinh());
        }

        @ParameterizedTest(name = "{0}")
        @ValueSource(strings = {QT, QLK, NVK, NVMH, NVBH})
        @DisplayName("Danh sách, chi tiết sản phẩm: chỉ ẩn giá vốn với nhân viên bán hàng; người tạo chỉ còn họ tên với mọi vai trò")
        void anThongTinNoiBo_theoVaiTro(String vt) {
            dangNhap(vt);
            SanPhamQuanAoDto dto = sanPhamDto();
            List<SanPhamQuanAoDto> ds = new ArrayList<>();
            ds.add(dto);
            ds.add(null);

            SanPhamQuanAoController.anThongTinNoiBo(ds);

            boolean xem = !NVBH.equals(vt);
            assertEquals(xem, dto.getGiaVonMacDinh() != null, "giá vốn sản phẩm");
            assertEquals(xem, dto.getBienTheSanPhams().get(0).getGiaVon() != null, "giá vốn biến thể");
            assertEquals(0, new BigDecimal("150").compareTo(dto.getBienTheSanPhams().get(0).getGiaBan()));
            NguoiDungDto nguoiTao = dto.getNguoiTao();
            assertEquals(5, nguoiTao.getId());
            assertEquals("Lê Thị Tạo", nguoiTao.getHoTen());
            assertNull(nguoiTao.getTenDangNhap());
            assertNull(nguoiTao.getEmail());
            assertNull(nguoiTao.getSoDienThoai());
            assertNull(nguoiTao.getVaiTro());
        }

        private SanPhamQuanAoDto sanPhamDto() {
            return SanPhamQuanAoDto.builder()
                    .giaVonMacDinh(new BigDecimal("100"))
                    .nguoiTao(NguoiDungDto.builder().id(5).hoTen("Lê Thị Tạo").tenDangNhap("letao")
                            .email("tao@fcentric.net").soDienThoai("0901234567").vaiTro(QT).build())
                    .bienTheSanPhams(List.of(BienTheSanPhamDto.builder().giaVon(new BigDecimal("100"))
                            .giaBan(new BigDecimal("150")).build()))
                    .build();
        }
    }

    // ───────── Danh sách của màn Tem mã vạch ─────────

    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    @DisplayName("Danh sách Tem mã vạch: mọi người in tem nhận giá bán và mã vạch, không ai nhận giá vốn")
    class DanhSachTem {

        @Mock private GiaBanBienTheRepository giaBanRepository;
        @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
        @Mock private AnhQuanAoRepository anhQuanAoRepository;
        @Mock private LichSuThayDoiService lichSuThayDoiService;
        @Mock private NguoiDungRepository nguoiDungRepository;

        @InjectMocks
        private GiaBanBienTheService service;

        private final SanPhamQuanAo polo = SanPhamQuanAo.builder().id(10).tenSanPham("Áo polo").maSanPham("AK2610232").build();

        @BeforeEach
        void duLieu() {
            BienTheSanPham bt = BienTheSanPham.builder().id(1).sanPham(polo).maSku("AK2610232-1").maVachSku("200000001")
                    .mauSac(MauSac.builder().id(1).tenMau("Đen").maMauHex("#111827").build())
                    .size(Size.builder().id(1).tenSize("M").build())
                    .trangThai(1).giaVon(new BigDecimal("420000")).giaBan(new BigDecimal("390000")).build();
            when(giaBanRepository.trangSanPhamId(any(), anyString(), any(), any(Pageable.class)))
                    .thenAnswer(inv -> new PageImpl<>(List.of(10), inv.getArgument(3), 1));
            when(giaBanRepository.demSku(any(), anyString(), any())).thenReturn(1L);
            when(giaBanRepository.bienTheKhopLoc(anyCollection(), any(), anyString(), any())).thenReturn(List.of(bt));
            when(giaBanRepository.demPhanLoai(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{10, 1L}));
            when(giaBanRepository.doiGiaGanDay(anyCollection(), any())).thenReturn(List.of());
            when(anhQuanAoRepository.findActiveByQuanAoIds(anyCollection())).thenReturn(List.of());
        }

        @ParameterizedTest(name = "{0}")
        @ValueSource(strings = {QT, QLK, NVK, NVBH})
        @DisplayName("Mọi vai trò in tem nhận đúng giá bán, mã vạch; không đếm cần xử lý giá")
        void danhSach_theoVaiTro(String vt) {
            dangNhap(vt);

            TrangGiaBanDto trang = service.loc(new LocGiaBanRequest());

            TrangGiaBanDto.BienTheGiaBan bt = trang.getContent().get(0).getBienThe().get(0);
            assertEquals(0, new BigDecimal("390000").compareTo(bt.getGiaBan()), "giá bán luôn có để in tem");
            assertEquals("200000001", bt.getMaVachSku(), "mã vạch luôn có để in tem");
            verify(giaBanRepository, never()).demCanXuLy();
        }
    }
}
