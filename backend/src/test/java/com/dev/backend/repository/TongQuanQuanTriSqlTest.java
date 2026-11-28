package com.dev.backend.repository;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Luật nghiệp vụ trong câu SQL của Tổng quan quản trị (đặc tả bản 2): doanh thu bỏ thuế GTGT và phí vận chuyển, đơn hoàn
 * trừ ở ngày hoàn, trả tại quầy chỉ cộng lại giá vốn hàng còn bán được, các lỗi đếm cũ của Cần xử lý đã sửa (mục 9).
 */
class TongQuanQuanTriSqlTest {

    @Test
    void doanhThu_khongGomThueVaPhiShip_ghiNhanDon356() {
        String ty = TongQuanQuanTriRepository.TY_LE_VAT;
        assertTrue(ty.contains("d.tien_thue_gtgt") && ty.contains("d.phi_van_chuyen"));
        String sql = new TongQuanQuanTriRepositoryProbe().cteSuKien();
        assertTrue(sql.contains("d.tong_cong - COALESCE(d.phi_van_chuyen, 0)"), "tiền hàng bỏ phí vận chuyển");
        assertTrue(sql.contains("don.gross - don.vat AS dt"), "doanh thu bỏ thuế GTGT");
        assertTrue(sql.contains("d.trang_thai IN (3, 5, 6)"), "đơn bị hoàn vẫn là doanh thu ở ngày xuất");
        assertTrue(sql.contains("d.trang_thai = 6"), "phần hoàn trừ riêng");
        assertTrue(sql.contains("so_phieu_nhap LIKE 'PN-RET%'") && sql.contains("DATE_ADD(d.ngay_cap_nhat, INTERVAL :lechCsdl MINUTE)"),
                "ngày hoàn: phiếu nhập hàng hoàn, chưa có thì ngày cập nhật đơn (cột MySQL tự điền)");
        assertTrue(sql.contains("c.tinh_trang = 'dat'") && sql.contains("c.tinh_trang = 'loi'"),
                "trả tại quầy: cộng lại giá vốn phần còn bán được, phần lỗi tách riêng");
        assertTrue(sql.contains("pth.kho_ban_id"), "trả tại quầy trừ ở kho bán");
        assertFalse(sql.contains("{"), "đã thay hết chỗ giữ");
    }

    @Test
    void donHoan_chiTruDonDaGhiNhanBan_ghepPhieuNhapHoanDungSoPhieu() {
        String sql = new TongQuanQuanTriRepositoryProbe().cteSuKien();
        assertTrue(sql.contains("d.ngay_giao_hang IS NOT NULL\n")
                        && sql.contains("OR EXISTS (SELECT 1 FROM phieu_xuat_kho p WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3))"),
                "đơn sàn đổi sang 6 khi chưa xuất thì chưa từng được cộng, không trừ");
        assertTrue(sql.contains("d.ngay_cap_nhat >= :tuCsdl"), "lọc sớm đơn hoàn theo kỳ");
        assertFalse(sql.contains("px.so_phieu_xuat, '%')"), "không ghép theo phần đầu số phiếu");
        assertTrue(sql.contains(TongQuanQuanTriRepository.SO_PX_PN_RET + " = px.so_phieu_xuat"));
        // Ghi chú phiếu nhập hoàn: "Nhập hoàn trả từ phiếu xuất: PX1 (Đơn: SO1)" -> PX1; PX1 không khớp phiếu của PX12
        String soPx = TongQuanQuanTriRepository.SO_PX_PN_RET;
        assertTrue(soPx.contains("' ', 1), '(', 1)"), "số phiếu dừng ở dấu cách hoặc \"(\"");
    }

    @Test
    void baoCaoDoanhThu_truDonHoanDaGiao_ghepDungSoPhieu_truSoDon() throws Exception {
        for (String ten : new String[]{"theoKenh", "theoNhanVien", "hangTraTheoNgay"}) {
            java.lang.reflect.Method m = java.util.Arrays.stream(DoanhThuReportRepository.class.getMethods())
                    .filter(x -> x.getName().equals(ten)).findFirst().orElseThrow();
            String sql = m.getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            assertTrue(sql.contains("dbh.trang_thai = 6 AND dbh.ngay_giao_hang IS NOT NULL"), ten + ": chỉ trừ đơn đã giao");
            assertFalse(sql.contains("px.so_phieu_xuat, '%')"), ten + ": không ghép theo phần đầu số phiếu");
            if (!ten.equals("hangTraTheoNgay")) {
                assertTrue(sql.contains("THEN -1 ELSE 0 END"), ten + ": đơn trả hết tại quầy trừ 1 đơn");
            }
        }
    }

    @Test
    void tongTheoNhom_soDonTruDonTraHet() {
        String sql = TongQuanQuanTriRepository.SQL_TONG_THEO_NHOM;
        assertTrue(sql.contains("SUM(s.don_xuat)") && sql.contains("SUM(s.don_tra)"));
        assertTrue(sql.contains("s.tg >= :tu AND s.tg < :den"), "so trên giờ Việt Nam đã đổi");
    }

    @Test
    void canXuLy_suaLoiDemCu() {
        assertTrue(TongQuanQuanTriRepository.SQL_VIEC_DON_KHO.contains("NOT LIKE :coHuy"), "đơn kho bỏ đơn khách yêu cầu hủy");
        assertTrue(TongQuanQuanTriRepository.SQL_VIEC_NHAP.contains("NOT LIKE :coShopee"), "đơn nháp bỏ đơn Shopee chờ xác nhận");
        assertTrue(TongQuanQuanTriRepository.SQL_VIEC_MUA_QUA_HAN.contains("pn.don_mua_hang_id = dm.id AND pn.trang_thai = 0"),
                "đơn mua đang kiểm đếm không còn là quá hạn");
        assertTrue(TongQuanQuanTriRepository.SQL_LOI_DONG_BO.contains("t.ma_san_pham_kenh IS NOT NULL"),
                "chỉ lỗi đẩy tồn (mã đã có trên sàn), bỏ lỗi tạo sản phẩm");
        assertTrue(TongQuanQuanTriRepository.SQL_LOI_DONG_BO.contains("_TU_DONG_DAY_TON"), "bỏ kênh đã tắt tự động đẩy tồn");
        assertTrue(TongQuanQuanTriRepository.SQL_VIEC_TRE_HEN.contains("p.kho_xuat_id = :khoId OR p.kho_nhap_id = :khoId"),
                "chuyển kho theo kho gửi hoặc kho nhận");
        assertTrue(TongQuanQuanTriRepository.SQL_VIEC_TRA_NCC.contains("bb.nha_cung_cap_id AS tham_chieu_id"),
                "hàng lỗi chờ trả mở thẻ Trả hàng của nhà cung cấp");
    }

    @Test
    void hoatDong_gomDonTrangThai0_chuyenKhoHaiKho_traHangOKhoNhan() {
        String sql = new TongQuanQuanTriRepositoryProbe().sqlHoatDong();
        assertFalse(sql.contains("trang_thai NOT IN (0, 4)"), "đơn sàn mới (trạng thái 0) phải hiện");
        assertTrue(sql.contains("pck.kho_xuat_id = :khoId OR pck.kho_nhap_id = :khoId"));
        assertTrue(sql.contains("pth.kho_nhan_id = :khoId"));
        assertTrue(sql.contains("so_phieu_nhap NOT LIKE 'PN-RET%'"), "phiếu nhập hàng trả tự sinh không thành dòng riêng");
    }

    @Test
    void ton_coTheBanTruGiuHang_duVuotMotRuoiLanNguong() {
        String sql = new TongQuanQuanTriRepositoryProbe().cteTon();
        assertTrue(sql.contains("cap.kha_dung - GREATEST(COALESCE(g.giu_don, 0), 0) - GREATEST(COALESCE(g.giu_chuyen, 0), 0)"));
        assertTrue(sql.contains("WHEN co_the_ban > nguong * 1.5 THEN 'du'"), "dư: vượt 1,5 lần ngưỡng, như Báo cáo tồn kho");
        assertTrue(sql.contains("p.trang_thai IN ('CHO_DUYET', 'DA_DUYET')"));
    }

    /** Dựng repository không nối CSDL: chỉ để lấy chuỗi SQL (máy kiểm thử coi như có đủ bảng, cột). */
    static class TongQuanQuanTriRepositoryProbe extends TongQuanQuanTriRepository {
        TongQuanQuanTriRepositoryProbe() {
            super(null, new TongQuanAdminRepository(null) {
                @Override
                public boolean coBang(String tenBang) {
                    return true;
                }

                @Override
                public boolean coCot(String tenBang, String tenCot) {
                    return true;
                }
            });
        }
    }
}
