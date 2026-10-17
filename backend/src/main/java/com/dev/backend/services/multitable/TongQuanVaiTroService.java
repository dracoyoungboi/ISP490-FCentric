package com.dev.backend.services.multitable;

import com.dev.backend.dto.response.TongQuanVaiTroResponse;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonSanPham;

import java.util.List;

public interface TongQuanVaiTroService {

    /**
     * Màn Tổng quan của người đang đăng nhập (quản lý kho, nhân viên kho, nhân viên mua hàng, nhân viên bán hàng).
     *
     * @param vaiTro vai trò giao diện đang dùng; người dùng không có vai trò này (hoặc bỏ trống) thì lấy vai trò
     *               đầu tiên có được theo thứ tự quản lý kho, nhân viên kho, nhân viên bán hàng, nhân viên mua hàng
     * @param lamMoi true = bỏ qua bản đã tính trong 60 giây gần nhất (nút "Tải lại")
     */
    TongQuanVaiTroResponse layTongQuanCuaToi(String vaiTro, boolean lamMoi);

    /** Tra còn hàng ở kho làm việc theo tên / mã sản phẩm / mã SKU (tối đa 6 sản phẩm). */
    List<TraTonSanPham> traTon(String tuKhoa);
}
