package com.dev.backend.utils;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import org.springframework.http.HttpStatus;

/**
 * Chứng từ kho chỉ được xem / sửa từ đúng kho đang chọn (header kho_id).
 * {@code @RequireAuth(inWarehouse = true)} mới kiểm người dùng thuộc kho đang chọn, chưa kiểm chứng từ thuộc kho đó:
 * thiếu bước này thì đổi số phiếu trên đường dẫn là thao tác được phiếu của kho khác.
 * Quản trị viên được thao tác mọi kho.
 * <ul>
 *   <li>{@link #kiemTra}: thao tác ghi, chứng từ phải thuộc đúng kho đang chọn.</li>
 *   <li>{@link #kiemTraXem}: chỉ xem, chứng từ thuộc một kho bất kỳ người dùng được phân quyền (VD trang đơn mua liệt kê
 *   phiếu nhập của kho nhận khác kho đang chọn).</li>
 * </ul>
 * Câu báo lỗi không được chứa "bị khóa": frontend coi lỗi có cụm đó là tài khoản bị khoá và đăng xuất.
 */
public final class KhoDangChon {

    private KhoDangChon() {
    }

    public static void kiemTra(Kho khoCuaChungTu, String tenChungTu) {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        if (nguoiDung == null) return; // gọi nội bộ (không qua HTTP)
        if (nguoiDung.getVaiTro() != null && nguoiDung.getVaiTro().contains(IRoleType.quan_tri_vien)) return;
        Integer khoDangChon = SecurityContextHolder.getKhoId();
        if (khoCuaChungTu == null || khoDangChon == null || !khoDangChon.equals(khoCuaChungTu.getId())) {
            throw new CommonException(HttpStatus.FORBIDDEN,
                    tenChungTu + " thuộc kho khác kho đang chọn. Chọn đúng kho rồi thử lại.");
        }
    }

    public static void kiemTraXem(Kho khoCuaChungTu, String tenChungTu) {
        if (duocXem(khoCuaChungTu)) return;
        throw new CommonException(HttpStatus.FORBIDDEN, "Bạn không thuộc kho của "
                + Character.toLowerCase(tenChungTu.charAt(0)) + tenChungTu.substring(1) + ".");
    }

    /** Người dùng hiện tại xem được chứng từ của kho này không (dùng để lọc danh sách). */
    public static boolean duocXem(Kho khoCuaChungTu) {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        if (nguoiDung == null) return true;
        if (nguoiDung.getVaiTro() != null && nguoiDung.getVaiTro().contains(IRoleType.quan_tri_vien)) return true;
        if (khoCuaChungTu != null && nguoiDung.getPhanQuyenNguoiDungKhos() != null) {
            for (PhanQuyenNguoiDungKhoDto pq : nguoiDung.getPhanQuyenNguoiDungKhos()) {
                if (pq != null && pq.getKho() != null && khoCuaChungTu.getId().equals(pq.getKho().getId())) return true;
            }
        }
        return false;
    }
}
