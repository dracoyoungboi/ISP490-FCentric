package com.dev.backend.services.impl.utils;

import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.dto.response.entities.*;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B2 · Lỗi đã biết (18/10/2026) ở JwtServiceImpl. Đi đúng đường thật: phát hành token có quyền kho
 * → đọc lại token như AuthInterceptor → hỏi quyền như AuthorizationAspect.
 * Các test khẳng định HÀNH VI ĐÚNG nên hiện đang ĐỎ; sửa xong phải XANH.
 */
class JwtServiceImplPhanQuyenTest {

    private final JwtServiceImpl jwt = new JwtServiceImpl();

    @BeforeEach
    void setUp() throws Exception {
        new ConstantVariables().setSignerKey("khoa-ky-thu-nghiem-chi-dung-trong-bo-kiem-thu-0123456789");
        ObjectMapper om = new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        Field f = JwtServiceImpl.class.getDeclaredField("objectMapper");
        f.setAccessible(true);
        f.set(jwt, om);
    }

    /** Token của một nhân viên kho tại kho 22, map quyền → trangThai (1 đang bật, 0 đã thu hồi). */
    private NguoiDungAuthInfo dangNhap(Map<String, Integer> quyen) {
        Set<ChiTietQuyenKhoDto> ds = quyen.entrySet().stream().map(e -> ChiTietQuyenKhoDto.builder()
                .quyenHan(QuyenHanDto.builder().maQuyen(e.getKey()).build()).trangThai(e.getValue()).build())
                .collect(Collectors.toSet());
        PhanQuyenNguoiDungKhoDto pq = PhanQuyenNguoiDungKhoDto.builder().id(100).trangThai(1)
                .kho(KhoDto.builder().id(22).maKho("KHO_TONG").build()).chiTietQuyenKhos(ds).build();
        String token = jwt.generateTokenWithPermissions(52, "nhanvienkhotong", "nhanvienkhotong", "b@fcentric.net", null,
                Set.of("nhan_vien_kho"), 1, null, null, List.of(pq), "Google", null);
        return jwt.getNguoiDungAuthInfoFromToken(token);
    }

    @Test
    @DisplayName("B2 · Quyền đã thu hồi (trangThai = 0) không được chấp nhận")
    void quyenDaThuHoi_khongDuocChapNhan() {
        NguoiDungAuthInfo info = dangNhap(Map.of("tao_phieu_nhap", 1, "cap_quyen_nhan_vien", 0));
        assertFalse(jwt.hasAnyPermissionInWorkSpace(22, info, "cap_quyen_nhan_vien"));
        assertFalse(jwt.hasAllPermissionsInWorkSpace(22, info, "cap_quyen_nhan_vien"));
    }

    @Test
    @DisplayName("B2 · Logic HOẶC phải xét mọi quyền, không dừng ở quyền đầu tiên")
    void logicHoac_xetMoiQuyen() {
        NguoiDungAuthInfo info = dangNhap(Map.of("huy_phieu_xuat", 1));
        assertTrue(jwt.hasAnyPermissionInWorkSpace(22, info, "tao_phieu_xuat", "huy_phieu_xuat"));
    }

    @Test
    @DisplayName("Phụ · hasAllRoles trả true khi có đủ vai trò")
    void hasAllRoles_duVaiTro() {
        NguoiDungAuthInfo info = dangNhap(Map.of("tao_phieu_nhap", 1));
        assertTrue(jwt.hasAllRoles(info, "nhan_vien_kho"));
    }

    @Test
    @DisplayName("Đối chứng · Quyền đang bật được chấp nhận")
    void doiChung_quyenDangBat() {
        NguoiDungAuthInfo info = dangNhap(Map.of("tao_phieu_nhap", 1));
        assertTrue(jwt.hasAnyPermissionInWorkSpace(22, info, "tao_phieu_nhap"));
    }
}
