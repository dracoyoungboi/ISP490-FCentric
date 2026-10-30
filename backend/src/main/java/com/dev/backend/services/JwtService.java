package com.dev.backend.services;

import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.nimbusds.jwt.JWTClaimsSet;

import java.time.Instant;
import java.util.List;
import java.util.Set;

public interface JwtService {

    String buildScope(Set<String> roles);

    @Deprecated
    String generateToken(String id, String email, Set<String> roles, String userAgent);

    String generateTokenWithPermissions(
            Integer id,
            String tenDangNhap,
            String hoTen,
            String email,
            String soDienThoai,
            Set<String> vaiTros,  // Role chính: quan_tri_vien, quan_ly_kho, nhan_vien_kho...
            Integer trangThai,
            Instant ngayTao,
            Instant ngayCapNhat,
            List<PhanQuyenNguoiDungKhoDto> phanQuyenNguoiDungKhos, // Quyền theo từng kho
            String userAgent
    );

    // Như trên + claim "cv" (credentialVersion của mật khẩu hiện tại) để thu hồi token khi đổi mật khẩu,
    // và claim "sid" (mã phiên đăng nhập) để đối chiếu bảng phien_dang_nhap mỗi request (null = không ghi claim)
    String generateTokenWithPermissions(
            Integer id,
            String tenDangNhap,
            String hoTen,
            String email,
            String soDienThoai,
            Set<String> vaiTros,
            Integer trangThai,
            Instant ngayTao,
            Instant ngayCapNhat,
            List<PhanQuyenNguoiDungKhoDto> phanQuyenNguoiDungKhos,
            String userAgent,
            String credentialVersion,
            String sid
    );

    // Dấu vân tay của mật khẩu (HMAC của hash, không lộ hash); đổi mật khẩu -> giá trị đổi -> token cũ bị thu hồi
    String credentialVersion(String matKhauHash);

    Integer getUserId(String token);

    String getKeycloakUserIdFromToken(String token);

    String getCurrentUserId();

    JWTClaimsSet getClaimsFromToken(String token);

    String getTokenFromAuthHeader(String authHeader);


    // Kiểm tra quyền người dùng
    NguoiDungAuthInfo getNguoiDungAuthInfoFromToken(String token);
    public boolean hasAnyRole(NguoiDungAuthInfo nguoiDungAuthInfo, String... roles);
    public boolean hasAllRoles(NguoiDungAuthInfo nguoiDungAuthInfo, String... roles);
    public boolean inWorkspace(Integer workspaceId, NguoiDungAuthInfo nguoiDungAuthInfo);
    public boolean hasAnyPermissionInWorkSpace(Integer workspaceId, NguoiDungAuthInfo nguoiDungAuthInfo, String... permissions);
    public boolean hasAllPermissionsInWorkSpace(Integer workspaceId, NguoiDungAuthInfo nguoiDungAuthInfo, String... permissions);
}
