package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import org.junit.jupiter.api.function.Executable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Dữ liệu mẫu cho test luồng mua hàng (đơn mua, yêu cầu, nhà cung cấp, dòng) và tiện ích kiểm lỗi có mã. */
public final class DonMuaHangFixture {

    public static final Instant BAY_GIO = Instant.parse("2026-10-22T03:00:00Z");

    private DonMuaHangFixture() {
    }

    public static void xoaBoNhoCong() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        GlobalCache.PHIEN_CONG_NCC.clear();
        GlobalCache.LUOT_GUI_MA_NCC.clear();
        GlobalCache.GUI_LAI_YEU_CAU.clear();
    }

    public static Kho kho() {
        return Kho.builder().id(1).maKho("KHO01").tenKho("Kho tổng").diaChi("12 Lý Thường Kiệt, Hà Nội").build();
    }

    public static NhaCungCap ncc(int id, String ten, String email) {
        return NhaCungCap.builder().id(id).tenNhaCungCap(ten).email(email)
                .trangThai(NhaCungCapService.TRANG_THAI_HOAT_DONG).soNganHang("0123456789").build();
    }

    public static YeuCauMuaHang yeuCau(int id, int trangThai) {
        return YeuCauMuaHang.builder().id(id).soYeuCauMuaHang("PR2026102200" + id).trangThai(trangThai)
                .khoNhap(kho()).ngayGiaoDuKien(Instant.parse("2026-10-30T00:00:00Z"))
                .chiTietYeuCauMuaHangs(new ArrayList<>()).build();
    }

    public static ChiTietDonMuaHang dong(int id, String sku, String soLuong, String donGia) {
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(500 + id).tenSanPham("Áo sơ mi").donViTinh("Cái").build();
        BienTheSanPham bt = BienTheSanPham.builder().id(900 + id).maSku(sku).sanPham(sp)
                .giaVon(new BigDecimal("80000")).giaBan(new BigDecimal("150000"))
                .mauSac(MauSac.builder().id(1).tenMau("Trắng").build())
                .size(Size.builder().id(2).tenSize("M").build())
                .build();
        return ChiTietDonMuaHang.builder().id(id).bienTheSanPham(bt)
                .soLuongDat(new BigDecimal(soLuong)).soLuongDaNhan(BigDecimal.ZERO)
                .donGia(new BigDecimal(donGia)).thanhTien(BigDecimal.ZERO).build();
    }

    public static DonMuaHang don(int id, YeuCauMuaHang yc, NhaCungCap ncc, int trangThai, ChiTietDonMuaHang... dong) {
        DonMuaHang don = DonMuaHang.builder().id(id).soDonMua("PO2026102200" + id).yeuCauMuaHang(yc)
                .nhaCungCap(ncc).khoNhap(kho()).trangThai(trangThai).tongTien(BigDecimal.ZERO)
                .ngayDatHang(BAY_GIO.minusSeconds(3600)).ngayTao(BAY_GIO.minusSeconds(3600))
                .ngayGiaoDuKien(Instant.parse("2026-10-30T00:00:00Z"))
                .nguoiTao(NguoiDung.builder().id(3).hoTen("Trần Mua").email("mua@cuahang.vn").build())
                .chiTietDonMuaHangs(new ArrayList<>(Arrays.asList(dong)))
                .build();
        for (ChiTietDonMuaHang ct : dong) ct.setDonMuaHang(don);
        return don;
    }

    /** Chạy và kiểm ném LoiCoMaException đúng mã; trả ngoại lệ để kiểm tiếp. */
    public static LoiCoMaException loiMa(String ma, Executable viec) {
        LoiCoMaException e = assertThrows(LoiCoMaException.class, viec);
        assertEquals(ma, e.getMa(), e.getMessage());
        return e;
    }

    public static List<Integer> ids(List<? extends Object> ds) {
        List<Integer> kq = new ArrayList<>();
        for (Object o : ds) {
            if (o instanceof DonMuaHang d) kq.add(d.getId());
        }
        return kq;
    }
}
