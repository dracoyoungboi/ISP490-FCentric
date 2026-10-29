package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.controller.ThongBaoController;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.customize.ThongBaoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.ThongBao;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ThongBaoRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * API thông báo chỉ trả / sửa thông báo của chính người đăng nhập (người nhận lấy từ token), và phần ghi dùng chung:
 * bỏ người thao tác, bỏ trùng, cắt chuỗi dài, tone lạ thành info.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ThongBaoServiceTest {

    private static final int TOI = 7, NGUOI_KHAC = 8;

    @Mock private ThongBaoRepository repo;
    @Mock private PlatformTransactionManager txManager;

    private ThongBaoService service;

    @BeforeEach
    void setUp() {
        service = new ThongBaoService(repo, txManager);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(TOI).vaiTro(Set.of(IRoleType.nhan_vien_kho)).build());
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static ThongBao thongBao(long id, Instant ngayDoc) {
        return ThongBao.builder().id(id).nguoiNhanId(TOI).loai("phe_duyet").tone("success")
                .tieuDe("Phiếu chuyển PX-TRF-1 đã được duyệt").moTa("Lệnh điều động LDD-1").duongDan("/transfer-tickets/50")
                .loaiThamChieu("phieu_chuyen_kho").idThamChieu(50).khoaSuKien("PCK:50:DUYET")
                .ngayTao(Instant.parse("2026-10-28T03:15:00Z")).daDoc(ngayDoc != null).build();
    }

    // ══════════════════════════ Đọc ══════════════════════════

    @Test
    @DisplayName("Danh sách: chỉ của người đăng nhập, mới nhất trước, đúng hình dạng NotificationBell, kèm số chưa đọc")
    void danhSach_cuaToi_dungHinhDang() {
        when(repo.danhSachCuaNguoi(eq(TOI), eq(false), any()))
                .thenReturn(new PageImpl<>(List.of(thongBao(2, null), thongBao(1, Instant.now())), PageRequest.of(0, 30), 2));
        when(repo.demChuaDoc(TOI)).thenReturn(5L);

        ThongBaoDto.DanhSach ds = service.danhSach(0, 30, false);

        verify(repo).danhSachCuaNguoi(TOI, false, PageRequest.of(0, 30));
        verify(repo, never()).danhSachCuaNguoi(eq(NGUOI_KHAC), anyBoolean(), any());
        assertEquals(5, ds.getSoChuaDoc());
        assertEquals(2, ds.getTotalElements());
        ThongBaoDto.Dong d = ds.getContent().get(0);
        assertEquals(2L, d.getId());
        assertEquals("phieu_chuyen_kho", d.getLoai());
        assertEquals("success", d.getTone());
        assertEquals("Chuyển kho", d.getNhom());
        assertEquals("Phiếu chuyển PX-TRF-1 đã được duyệt", d.getTieuDe());
        assertEquals("/transfer-tickets/50", d.getDuongDan());
        assertEquals("2026-10-28T03:15:00Z", d.getThoiGian());
        assertFalse(d.isDaDoc());
        assertTrue(ds.getContent().get(1).isDaDoc());
    }

    @Test
    @DisplayName("Danh sách: lọc chưa đọc, số dòng mặc định 30 khi ≤ 0, tối đa 100, trang âm thành 0")
    void danhSach_locVaGioiHanSoDong() {
        when(repo.danhSachCuaNguoi(anyInt(), anyBoolean(), any())).thenReturn(new PageImpl<>(List.of()));
        service.danhSach(-1, 0, true);
        service.danhSach(2, 1000, false);
        ArgumentCaptor<Pageable> trang = ArgumentCaptor.forClass(Pageable.class);
        verify(repo, times(2)).danhSachCuaNguoi(eq(TOI), anyBoolean(), trang.capture());
        assertEquals(PageRequest.of(0, 30), trang.getAllValues().get(0));
        assertEquals(PageRequest.of(2, 100), trang.getAllValues().get(1));
        verify(repo).danhSachCuaNguoi(TOI, true, PageRequest.of(0, 30));
    }

    @Test
    @DisplayName("Chưa đăng nhập: 401, không truy vấn")
    void chuaDangNhap_401() {
        SecurityContextHolder.clear();
        CommonException e = assertThrows(CommonException.class, () -> service.danhSach(0, 30, false));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getHttpStatus());
        assertThrows(CommonException.class, () -> service.danhDauDaDoc(1L));
        assertThrows(CommonException.class, () -> service.danhDauTatCaDaDoc());
        verifyNoInteractions(repo);
    }

    // ══════════════════════════ Đánh dấu đã đọc ══════════════════════════

    @Test
    @DisplayName("Đánh dấu đã đọc: câu UPDATE luôn kèm người nhận = người đăng nhập; trả số chưa đọc còn lại")
    void danhDauDaDoc_cuaToi() {
        when(repo.danhDauDaDoc(10L, TOI)).thenReturn(1);
        when(repo.demChuaDoc(TOI)).thenReturn(3L);

        assertEquals(3, service.danhDauDaDoc(10L));
        verify(repo).danhDauDaDoc(10L, TOI);
        verify(repo, never()).existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(any(), any());
    }

    @Test
    @DisplayName("Thông báo của người khác (hoặc không có): 404, không đổi gì, không cho biết thông báo có tồn tại")
    void danhDauDaDoc_cuaNguoiKhac_404() {
        when(repo.danhDauDaDoc(99L, TOI)).thenReturn(0);
        when(repo.existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(99L, TOI)).thenReturn(false);

        CommonException e = assertThrows(CommonException.class, () -> service.danhDauDaDoc(99L));
        assertEquals(HttpStatus.NOT_FOUND, e.getHttpStatus());
        verify(repo, never()).danhDauDaDoc(any(), eq(NGUOI_KHAC));
        assertThrows(CommonException.class, () -> service.danhDauDaDoc(null));
    }

    @Test
    @DisplayName("Thông báo của mình đã đọc từ trước: không lỗi (bấm lại vô hại)")
    void danhDauDaDoc_daDocTuTruoc_khongLoi() {
        when(repo.danhDauDaDoc(10L, TOI)).thenReturn(0);
        when(repo.existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(10L, TOI)).thenReturn(true);
        assertDoesNotThrow(() -> service.danhDauDaDoc(10L));
    }

    @Test
    @DisplayName("Dòng có sẵn từ trước của mình (khoa_su_kien trống, không hiện ở chuông): 404 như thông báo không có")
    void danhDauDaDoc_dongCu_404() {
        // UPDATE đã lọc khoa_su_kien IS NOT NULL nên đổi 0 dòng; câu kiểm tồn tại cũng phải lọc như vậy
        when(repo.danhDauDaDoc(5L, TOI)).thenReturn(0);
        when(repo.existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(5L, TOI)).thenReturn(false);

        assertEquals(HttpStatus.NOT_FOUND, assertThrows(CommonException.class, () -> service.danhDauDaDoc(5L)).getHttpStatus());
        verify(repo).existsByIdAndNguoiNhanIdAndKhoaSuKienIsNotNull(5L, TOI);
        verify(repo, never()).demChuaDoc(any());
        // Không còn phương thức kiểm tồn tại bỏ qua khoa_su_kien
        assertTrue(Arrays.stream(ThongBaoRepository.class.getMethods())
                .noneMatch(m -> m.getName().startsWith("exists") && !m.getName().contains("KhoaSuKienIsNotNull")
                        && m.getDeclaringClass() == ThongBaoRepository.class));
    }

    @Test
    @DisplayName("Đọc hết: chỉ thông báo của người đăng nhập")
    void danhDauTatCa_cuaToi() {
        when(repo.danhDauTatCaDaDoc(TOI)).thenReturn(4);
        assertEquals(4, service.danhDauTatCaDaDoc());
        verify(repo).danhDauTatCaDaDoc(TOI);
        verify(repo, never()).danhDauTatCaDaDoc(NGUOI_KHAC);
    }

    // ══════════════════════════ Ghi ══════════════════════════

    @Test
    @DisplayName("Ghi: bỏ null, bỏ người thao tác, bỏ trùng; tone lạ → info; chuỗi dài bị cắt vừa cột")
    void ghi_locNguoiNhanVaCatChuoi() {
        when(repo.nguoiDaCoSuKien(anyString(), any())).thenReturn(List.of());
        String dai = "x".repeat(600);
        NoiDung nd = new NoiDung("phieu_chuyen_kho", "tim", dai, dai, "/transfer-tickets/1", "phieu_chuyen_kho", 1, null, "PCK:1:DUYET");

        List<ThongBao> moi = service.soan(new GuiDi(Arrays.asList(5, null, 6, 5, TOI, 6), TOI, nd));

        assertEquals(List.of(5, 6), moi.stream().map(ThongBao::getNguoiNhanId).toList());
        ThongBao t = moi.get(0);
        assertEquals("info", t.getTone());
        assertEquals(255, t.getTieuDe().length());
        assertEquals(500, t.getMoTa().length());
        assertTrue(t.getMoTa().endsWith("…"));
        verify(repo, never()).save(any());
        verify(repo, never()).saveAll(any());
    }

    @Test
    @DisplayName("Ghi: thiếu tiêu đề hoặc khóa sự kiện thì bỏ qua, không lỗi")
    void ghi_thieuNoiDung_boQua() {
        assertTrue(service.soan(new GuiDi(List.of(5), TOI,
                new NoiDung("phieu_chuyen_kho", "info", " ", null, null, null, null, null, "PCK:1:DUYET"))).isEmpty());
        assertTrue(service.soan(new GuiDi(List.of(5), TOI,
                new NoiDung("phieu_chuyen_kho", "info", "Tiêu đề", null, null, null, null, null, null))).isEmpty());
        assertTrue(service.soan(null).isEmpty());
        verifyNoInteractions(repo);
    }

    @Test
    @DisplayName("Tone trống (null): ghi và đọc đều thành info, không NPE (Set.of không nhận contains(null))")
    void tone_null_thanhInfo() {
        when(repo.nguoiDaCoSuKien(anyString(), any())).thenReturn(List.of());
        List<ThongBao> moi = service.soan(new GuiDi(List.of(5), TOI,
                new NoiDung("phieu_chuyen_kho", null, "Tiêu đề", null, null, null, null, null, "PCK:1:DUYET")));
        assertEquals("info", moi.get(0).getTone());

        ThongBao cu = thongBao(3, null);
        cu.setTone(null);
        assertEquals("info", ThongBaoService.dong(cu).getTone());
        cu.setTone("tim");
        assertEquals("info", ThongBaoService.dong(cu).getTone());
    }

    @Test
    @DisplayName("Ghi từng người trong giao dịch REQUIRES_NEW riêng: một người vướng khóa duy nhất thì chỉ người đó hỏng, người khác vẫn có")
    void ghi_motNguoiLoi_khongMatCuaNguoiKhac() {
        when(repo.nguoiDaCoSuKien(anyString(), any())).thenReturn(List.of());
        // Lần gửi khác cùng sự kiện vừa ghi cho người 6 sau lúc đọc "người đã có": INSERT người 6 vướng UNIQUE
        when(repo.save(any(ThongBao.class))).thenAnswer(i -> {
            ThongBao t = i.getArgument(0);
            if (t.getNguoiNhanId() == 6) {
                throw new DataIntegrityViolationException("Duplicate entry '6-PCK:1:DUYET' for key 'uk_thong_bao_nguoi_su_kien'");
            }
            return t;
        });
        NoiDung nd = new NoiDung("phieu_chuyen_kho", "success", "Tiêu đề", "Mô tả", null, null, null, null, "PCK:1:DUYET");

        assertDoesNotThrow(() -> service.chayTrongGiaoDichRieng("thử", () -> List.of(new GuiDi(List.of(5, 6, 9), TOI, nd))));

        ArgumentCaptor<ThongBao> luu = ArgumentCaptor.forClass(ThongBao.class);
        verify(repo, times(3)).save(luu.capture());
        assertEquals(List.of(5, 6, 9), luu.getAllValues().stream().map(ThongBao::getNguoiNhanId).toList());
        verify(repo, never()).saveAll(any());
        // 1 giao dịch soạn + 3 giao dịch ghi, đều REQUIRES_NEW; chỉ giao dịch của người 6 hoàn tác
        ArgumentCaptor<TransactionDefinition> dn = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager, times(4)).getTransaction(dn.capture());
        assertTrue(dn.getAllValues().stream()
                .allMatch(d -> d.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(txManager, times(3)).commit(any());
        verify(txManager, times(1)).rollback(any());

        assertEquals(2, service.ghiTungNguoi("thử", List.of(
                ThongBao.builder().nguoiNhanId(5).build(), ThongBao.builder().nguoiNhanId(6).build(),
                ThongBao.builder().nguoiNhanId(9).build())), "trả số dòng ghi được");
        assertEquals(0, service.ghiTungNguoi("thử", null));
    }

    // ══════════════════════════ Controller ══════════════════════════

    @Test
    @DisplayName("API: cả ba endpoint bắt đăng nhập, mọi vai trò nội bộ, không cần kho; không nhận id người dùng từ frontend")
    void api_batDangNhap_moiVaiTroNoiBo() {
        int soEndpoint = 0;
        for (Method m : ThongBaoController.class.getDeclaredMethods()) {
            if (!m.isAnnotationPresent(GetMapping.class) && !m.isAnnotationPresent(PutMapping.class)) continue;
            soEndpoint++;
            RequireAuth yeuCau = m.getAnnotation(RequireAuth.class);
            assertNotNull(yeuCau, m.getName());
            assertEquals(IRoleType.NOI_BO, Set.of(yeuCau.roles()), m.getName());
            assertFalse(yeuCau.inWarehouse(), m.getName());
            for (Parameter p : m.getParameters()) {
                RequestParam rp = p.getAnnotation(RequestParam.class);
                if (rp != null) assertFalse(p.getName().toLowerCase(Locale.ROOT).contains("nguoi"), m.getName());
            }
        }
        assertEquals(3, soEndpoint);
    }
}
