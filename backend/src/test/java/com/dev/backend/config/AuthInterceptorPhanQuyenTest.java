package com.dev.backend.config;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.SessionRevokedException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Token sống 24 giờ mang vai trò và quyền lúc đăng nhập: AuthInterceptor so với CSDL ở mỗi request,
 * token có thứ CSDL không còn cho phép thì buộc đăng nhập lại; quyền vừa cấp thêm thì không.
 */
class AuthInterceptorPhanQuyenTest {

    private int idChiTiet = 1;

    private PhanQuyenNguoiDungKhoDto pq(int khoId, String... maQuyen) {
        KhoDto kho = new KhoDto();
        kho.setId(khoId);
        Set<ChiTietQuyenKhoDto> ct = new LinkedHashSet<>();
        for (String ma : maQuyen) {
            QuyenHanDto q = new QuyenHanDto();
            q.setMaQuyen(ma);
            ChiTietQuyenKhoDto c = new ChiTietQuyenKhoDto();
            c.setId(idChiTiet++);
            c.setTrangThai(1);
            c.setQuyenHan(q);
            ct.add(c);
        }
        PhanQuyenNguoiDungKhoDto p = new PhanQuyenNguoiDungKhoDto();
        p.setKho(kho);
        p.setTrangThai(1);
        p.setChiTietQuyenKhos(ct);
        return p;
    }

    private NguoiDungAuthInfo token(String vaiTro, PhanQuyenNguoiDungKhoDto... ds) {
        return NguoiDungAuthInfo.builder().id(52).vaiTro(Set.of(vaiTro)).phanQuyenNguoiDungKhos(List.of(ds)).build();
    }

    private static List<Object[]> csdl(Object... capKhoQuyen) {
        List<Object[]> ds = new ArrayList<>();
        for (int i = 0; i < capKhoQuyen.length; i += 2) ds.add(new Object[]{capKhoQuyen[i], capKhoQuyen[i + 1]});
        return ds;
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    @DisplayName("Khớp CSDL hoặc CSDL có thêm quyền (vừa cấp) → không thu hồi phiên")
    void khop_hoacDuocCapThem() {
        NguoiDungAuthInfo t = token(IRoleType.nhan_vien_kho, pq(22, "xem_ton_kho", "tao_phieu_xuat"));
        assertFalse(AuthInterceptor.tokenVuotQuyenHienTai(t, IRoleType.nhan_vien_kho,
                csdl(22, "xem_ton_kho", 22, "tao_phieu_xuat")));
        assertFalse(AuthInterceptor.tokenVuotQuyenHienTai(t, IRoleType.nhan_vien_kho,
                csdl(22, "xem_ton_kho", 22, "tao_phieu_xuat", 22, "chuyen_kho")));
    }

    @Test
    @DisplayName("Đổi vai trò → thu hồi phiên (kể cả quản trị viên bị hạ quyền)")
    void doiVaiTro() {
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.quan_tri_vien), IRoleType.nhan_vien_kho, csdl()));
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.nhan_vien_kho, pq(22)), IRoleType.quan_ly_kho,
                csdl(22, null)));
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.nhan_vien_kho), null, csdl()));
    }

    @Test
    @DisplayName("Bỏ một quyền, đổi kho, thu hồi kho hoặc hết hạn → thu hồi phiên")
    void boQuyen_doiKho() {
        NguoiDungAuthInfo t = token(IRoleType.nhan_vien_kho, pq(22, "xem_ton_kho", "duyet_phieu_xuat"));
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(t, IRoleType.nhan_vien_kho, csdl(22, "xem_ton_kho")), "bỏ quyền");
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(t, IRoleType.nhan_vien_kho,
                csdl(23, "xem_ton_kho", 23, "duyet_phieu_xuat")), "đổi kho");
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(t, IRoleType.nhan_vien_kho, csdl()), "không còn kho");
        assertTrue(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.nhan_vien_kho, pq(22)), IRoleType.nhan_vien_kho,
                csdl()), "kho chưa có quyền nào cũng bị thu hồi");
    }

    @Test
    @DisplayName("Quyền đã tắt sẵn trong token (trang_thai = 0) không tính; kho chưa có quyền khớp dòng (kho, null)")
    void boQuaQuyenDaTat_khoRong() {
        PhanQuyenNguoiDungKhoDto p = pq(22, "xem_ton_kho", "huy_phieu_xuat");
        p.getChiTietQuyenKhos().stream().filter(c -> "huy_phieu_xuat".equals(c.getQuyenHan().getMaQuyen()))
                .forEach(c -> c.setTrangThai(0));
        assertFalse(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.nhan_vien_kho, p), IRoleType.nhan_vien_kho,
                csdl(22, "xem_ton_kho")));
        assertFalse(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.nhan_vien_kho, pq(22)), IRoleType.nhan_vien_kho,
                csdl(22, null)));
    }

    @Test
    @DisplayName("Quản trị viên còn là quản trị viên → không so quyền theo kho")
    void quanTriVien() {
        assertFalse(AuthInterceptor.tokenVuotQuyenHienTai(token(IRoleType.quan_tri_vien, pq(22, "xem_ton_kho")),
                IRoleType.quan_tri_vien, csdl()));
    }

    @Test
    @DisplayName("preHandle: quyền vừa bị bỏ → SESSION_REVOKED với lời nhắn riêng; khớp thì cho qua")
    void preHandle() throws Exception {
        AuthInterceptor interceptor = new AuthInterceptor();
        JwtService jwt = mock(JwtService.class);
        NguoiDungRepository nguoiDungRepo = mock(NguoiDungRepository.class);
        PhanQuyenNguoiDungKhoRepository pqRepo = mock(PhanQuyenNguoiDungKhoRepository.class);
        dat(interceptor, "jwtService", jwt);
        dat(interceptor, "nguoiDungRepository", nguoiDungRepo);
        dat(interceptor, "phanQuyenNguoiDungKhoRepository", pqRepo);

        when(jwt.getTokenFromAuthHeader("Bearer x")).thenReturn("x");
        when(jwt.getNguoiDungAuthInfoFromToken("x"))
                .thenReturn(token(IRoleType.nhan_vien_kho, pq(22, "xem_ton_kho", "duyet_phieu_xuat")));
        when(nguoiDungRepo.findById(52)).thenReturn(Optional.of(
                NguoiDung.builder().id(52).vaiTro(IRoleType.nhan_vien_kho).trangThai(1).build()));
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getHeader("Authorization")).thenReturn("Bearer x");
        HttpServletResponse res = mock(HttpServletResponse.class);

        when(pqRepo.layKhoVaQuyenHieuLuc(eq(52), any(Instant.class))).thenReturn(csdl(22, "xem_ton_kho"));
        SessionRevokedException loi = assertThrows(SessionRevokedException.class, () -> interceptor.preHandle(req, res, new Object()));
        assertEquals(AuthInterceptor.LOI_QUYEN_DA_DOI, loi.getMessage());
        assertNull(SecurityContextHolder.getUser(), "phải dọn context trước khi ném lỗi");

        when(pqRepo.layKhoVaQuyenHieuLuc(eq(52), any(Instant.class)))
                .thenReturn(csdl(22, "xem_ton_kho", 22, "duyet_phieu_xuat"));
        assertTrue(interceptor.preHandle(req, res, new Object()));
    }

    private static void dat(Object o, String ten, Object giaTri) throws Exception {
        Field f = o.getClass().getDeclaredField(ten);
        f.setAccessible(true);
        f.set(o, giaTri);
    }
}
