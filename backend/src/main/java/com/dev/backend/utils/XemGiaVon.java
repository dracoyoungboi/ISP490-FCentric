package com.dev.backend.utils;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;

import java.util.Set;

/**
 * Giá vốn là số nội bộ: nhân viên bán hàng không được thấy (SRS 2.4.1). Người dùng có thêm vai trò khác
 * (quản trị viên, quản lý kho, nhân viên kho, nhân viên mua hàng) vẫn thấy.
 */
public final class XemGiaVon {

    private static final Set<String> DUOC_XEM = Set.of(
            IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang);

    private XemGiaVon() {
    }

    public static boolean duocXem(Set<String> vaiTro) {
        return vaiTro != null && vaiTro.stream().anyMatch(DUOC_XEM::contains);
    }

    /** Người đang gọi API có được thấy giá vốn không; gọi nội bộ (không qua HTTP) thì được. */
    public static boolean nguoiDangNhapDuocXem() {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        return nguoiDung == null || duocXem(nguoiDung.getVaiTro());
    }
}
