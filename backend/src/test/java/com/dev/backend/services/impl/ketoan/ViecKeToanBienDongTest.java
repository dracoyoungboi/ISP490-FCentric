package com.dev.backend.services.impl.ketoan;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Mã việc và số liệu tách sẵn của biến động kho, ghép phiếu xuất ↔ phiếu nhập lại của đơn hủy (màn Tạo lô xuất). */
class ViecKeToanBienDongTest {

    private static NguonKeToan.BienDongKho bd(String nhom, String so, String kho, int tang, int giam, String ghiChu) {
        return new NguonKeToan.BienDongKho(nhom, "x", 1, so, kho, 1, BigDecimal.valueOf(tang), BigDecimal.valueOf(giam),
                Instant.EPOCH, ghiChu, null, null, null, so != null && so.startsWith("PXK") ? 9 : null);
    }

    private static DungChungTuAmis.VanDe xuat(String px, String don, int sl) {
        return XuatKeToanService.bienDong(bd("xuat_ban_khong_doanh_thu", px, "KHO_TONG", 0, sl, "Đơn " + don));
    }

    private static DungChungTuAmis.VanDe nhap(String pn, String px, String don, int sl) {
        return XuatKeToanService.bienDong(bd("nhap_hang_hoan", pn, "KHO_TONG", sl, 0,
                "Nhập hoàn trả từ phiếu xuất: " + px + (don == null ? "" : " (Đơn: " + don + ")")));
    }

    @Test
    void tachSoLieuCuaTungLoaiBienDong() {
        DungChungTuAmis.VanDe x = xuat("PXK-1", "SHP-1013", 2);
        assertEquals(ViecKeToan.XUAT_KHO_DON_HUY, x.viec());
        assertEquals("SHP-1013", x.chiTiet().get("soDon"));
        assertEquals("PXK-1", x.chiTiet().get("phieuXuat"));
        assertEquals(0, new BigDecimal("-2").compareTo((BigDecimal) x.chiTiet().get("soLuong")));
        assertEquals("KHO_TONG", x.chiTiet().get("maKho"));
        assertEquals("x", x.chiTiet().get("nguon"));
        assertEquals(9, x.chiTiet().get("idDon"));

        DungChungTuAmis.VanDe n = nhap("PN-RET-1", "PXK-1", "SHP-1013", 2);
        assertEquals(ViecKeToan.NHAP_HANG_HOAN, n.viec());
        assertEquals("PXK-1", n.chiTiet().get("phieuXuat"));
        assertEquals("SHP-1013", n.chiTiet().get("soDon"));

        DungChungTuAmis.VanDe h = XuatKeToanService.bienDong(new NguonKeToan.BienDongKho("ghi_giam_chuyen_kho",
                "phieu_dieu_chinh_kho", 7, "DCK-1", "KHO_TRANSIT", 1, BigDecimal.ZERO, BigDecimal.ONE, Instant.EPOCH,
                "Kho gửi giao bù", "GIAO_BU_HANG", "BB-1", "PCK-1", null));
        assertEquals(ViecKeToan.XUAT_KHO_HAO_HUT, h.viec());
        assertEquals("Kho gửi giao bù", h.chiTiet().get("ghiChu"));
        assertEquals("GIAO_BU_HANG", h.chiTiet().get("phuongAn"));
        assertEquals("BB-1", h.chiTiet().get("soBienBan"));
        assertEquals("PCK-1", h.chiTiet().get("soPhieuChuyen"));

        assertEquals(ViecKeToan.BIEN_DONG_KHAC, XuatKeToanService.bienDong(bd("khac", null, "K", 1, 0, null)).viec());
        // Câu đầy đủ (tệp hướng dẫn) giữ nguyên
        assertTrue(x.noiDung().startsWith("Phiếu xuất bán của đơn đã hủy / bị hoàn trả ở kho KHO_TONG: giảm 2"));
    }

    @Test
    void phieuNhapLaiGhiChuMacDinhKhongCoDonVanGhepDuoc() {
        List<DungChungTuAmis.VanDe> kq = XuatKeToanService.ghepDonHuy(List.of(xuat("PXK-2", "SHP-2", 1), nhap("PN-RET-2", "PXK-2", null, 1)));
        assertTrue(kq.stream().allMatch(v -> ViecKeToan.KHOP_DON_HUY.equals(v.viec()) && "PXK-2".equals(v.chiTiet().get("cap"))));
    }

    @Test
    void ghepTheoPhieuXuat() {
        List<DungChungTuAmis.VanDe> kq = XuatKeToanService.ghepDonHuy(List.of(
                xuat("PXK-A", "A", 1), nhap("PN-A", "PXK-A", "A", 1),                          // khớp
                xuat("PXK-B", "B", 1), nhap("PN-B1", "PXK-B", "B", 1), nhap("PN-B2", "PXK-B", "B", 1), // nhập dư
                xuat("PXK-C", "C", 1),                                                        // hàng không về
                nhap("PN-D", "PXK-CU", "D", 1)));                                             // phiếu xuất ở lô trước
        assertEquals(List.of(ViecKeToan.KHOP_DON_HUY, ViecKeToan.KHOP_DON_HUY,
                ViecKeToan.LECH_DON_HUY, ViecKeToan.LECH_DON_HUY, ViecKeToan.LECH_DON_HUY,
                ViecKeToan.XUAT_KHO_DON_HUY, ViecKeToan.NHAP_HANG_HOAN), kq.stream().map(DungChungTuAmis.VanDe::viec).toList());
        assertNull(kq.get(5).chiTiet().get("cap"));
        assertEquals("PXK-B", kq.get(4).chiTiet().get("cap"));
    }
}
