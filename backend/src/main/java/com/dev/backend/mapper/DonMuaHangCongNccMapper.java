package com.dev.backend.mapper;

import com.dev.backend.dto.response.congncc.DonMuaHangCongNccDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.NhaCungCap;

import java.util.Comparator;
import java.util.List;

/**
 * Đơn mua -> DTO cho cổng nhà cung cấp. Viết tay (không MapStruct) để chỉ đúng các trường liệt kê ở đây đi ra API
 * công khai: thêm trường vào entity sau này không tự lộ ra cổng.
 */
public final class DonMuaHangCongNccMapper {

    private DonMuaHangCongNccMapper() {
    }

    public static DonMuaHangCongNccDto toDto(DonMuaHang don) {
        if (don == null) return null;
        List<ChiTietDonMuaHang> dong = don.getChiTietDonMuaHangs() == null ? List.of() : don.getChiTietDonMuaHangs();
        return DonMuaHangCongNccDto.builder()
                .id(don.getId())
                .soDonMua(don.getSoDonMua())
                .trangThai(don.getTrangThai())
                .ngayDatHang(don.getNgayDatHang())
                .ngayGiaoDuKien(don.getNgayGiaoDuKien())
                .ghiChu(don.getGhiChu())
                .ghiChuNCC(don.getGhiChuNhaCungCap())
                .ngayBaoGia(don.getNgayBaoGia())
                .tongTien(don.getTongTien())
                .khoNhap(kho(don.getKhoNhap()))
                .nhaCungCap(nhaCungCap(don.getNhaCungCap()))
                .nguoiTao(nguoiPhuTrach(don.getNguoiTao()))
                // Danh sách đã @OrderBy("id ASC"); xếp lại phòng khi danh sách dựng tay trong bộ nhớ
                .chiTietDonMuaHangs(dong.stream()
                        .sorted(Comparator.comparing(ChiTietDonMuaHang::getId,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(DonMuaHangCongNccMapper::dong)
                        .toList())
                .build();
    }

    private static DonMuaHangCongNccDto.Kho kho(Kho kho) {
        if (kho == null) return null;
        return DonMuaHangCongNccDto.Kho.builder().tenKho(kho.getTenKho()).diaChi(kho.getDiaChi()).build();
    }

    private static DonMuaHangCongNccDto.NhaCungCap nhaCungCap(NhaCungCap ncc) {
        if (ncc == null) return null;
        return DonMuaHangCongNccDto.NhaCungCap.builder()
                .tenNhaCungCap(ncc.getTenNhaCungCap())
                .email(ncc.getEmail())
                .build();
    }

    private static DonMuaHangCongNccDto.NguoiPhuTrach nguoiPhuTrach(NguoiDung nd) {
        if (nd == null) return null;
        return DonMuaHangCongNccDto.NguoiPhuTrach.builder()
                .hoTen(nd.getHoTen())
                .soDienThoai(nd.getSoDienThoai())
                .email(nd.getEmail())
                .build();
    }

    private static DonMuaHangCongNccDto.Dong dong(ChiTietDonMuaHang ct) {
        return DonMuaHangCongNccDto.Dong.builder()
                .id(ct.getId())
                .bienTheSanPham(bienThe(ct.getBienTheSanPham()))
                .soLuongDat(ct.getSoLuongDat())
                .donGia(ct.getDonGia())
                .build();
    }

    private static DonMuaHangCongNccDto.BienThe bienThe(BienTheSanPham bt) {
        if (bt == null) return null;
        var sp = bt.getSanPham();
        return DonMuaHangCongNccDto.BienThe.builder()
                .id(bt.getId())
                .tenBienThe(tenBienThe(bt))
                .tenSanPham(sp != null ? sp.getTenSanPham() : null)
                .sanPhamId(sp != null ? sp.getId() : null)
                .maSku(bt.getMaSku())
                .mauSac(bt.getMauSac() == null ? null
                        : DonMuaHangCongNccDto.Ten.builder().tenMau(bt.getMauSac().getTenMau()).build())
                .size(bt.getSize() == null ? null
                        : DonMuaHangCongNccDto.Ten.builder().tenSize(bt.getSize().getTenSize()).build())
                .chatLieu(bt.getChatLieu() == null ? null
                        : DonMuaHangCongNccDto.Ten.builder().tenChatLieu(bt.getChatLieu().getTenChatLieu()).build())
                .build();
    }

    /** Cùng định dạng BienTheSanPhamMapper.buildTenBienThe: "TênSảnPhẩm - TênMàu / TênSize", trống thì mã SKU. */
    private static String tenBienThe(BienTheSanPham bt) {
        StringBuilder sb = new StringBuilder();
        if (bt.getSanPham() != null && bt.getSanPham().getTenSanPham() != null) {
            sb.append(bt.getSanPham().getTenSanPham());
        }
        if (bt.getMauSac() != null) sb.append(" - ").append(bt.getMauSac().getTenMau());
        if (bt.getSize() != null) sb.append(" / ").append(bt.getSize().getTenSize());
        String ten = sb.toString().trim();
        return ten.isEmpty() ? bt.getMaSku() : ten;
    }
}
