package com.dev.backend.services.email;

import com.dev.backend.config.EmailTemplateConfig;
import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.email.DonMuaHangEmailRepository;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.mockito.Mockito.*;

/**
 * Dữ liệu mẫu giống demo đã duyệt (cửa hàng giả định "Thời trang Linh Lan", đơn PO202610195101) và cách dựng thư
 * thật: entity -> EmailNghiepVuServiceImpl (dựng record) -> DungMauEmail (engine Thymeleaf thật, không Spring).
 */
final class MauEmailFixture {

    static final String MA_DON = "PO202610195101";
    static final Integer ID_DON = 1287;
    static final String EMAIL_NCC = "lan.tran@xuongmayhoanganh.vn";
    /** Giờ "hiện tại" của các thư: 14:22 ngày 19/10/2026 giờ Việt Nam. */
    static final Instant BAY_GIO = Instant.parse("2026-10-19T07:22:00Z");
    /** Mã trong liên kết đặt mật khẩu (E2, E3): 43 ký tự base64url như mã thật. */
    static final String MA_LIEN_KET = "Zx9_-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab";
    static final String LIEN_KET_DAT_MAT_KHAU = "https://fcentric.net/set-password#t=" + MA_LIEN_KET;
    /** Hạn liên kết: 14:22 ngày 20/10/2026 giờ Việt Nam (sau giờ "hiện tại" 24 giờ, thư còn hiệu lực để gửi). */
    static final Instant HET_HAN_LIEN_KET = Instant.parse("2026-10-20T07:22:00Z");

    final DungMauEmail dungMau = new DungMauEmail(EmailTemplateConfig.taoEngine());
    final EmailDispatcher dispatcher = mock(EmailDispatcher.class);
    final NguoiDungRepository nguoiDungRepository = mock(NguoiDungRepository.class);
    final DonMuaHangEmailRepository donMuaHangEmailRepository = mock(DonMuaHangEmailRepository.class);
    final DuongDanEmail duongDan = new DuongDanEmail("https://fcentric.net");
    /** PDF biên bản thật (dựng lúc gửi qua EmailGui.dinhKem, test gọi hàm đó mới dựng). */
    final PdfBienBanTraHang pdf = new PdfBienBanTraHang();
    final EmailNghiepVuServiceImpl service = new EmailNghiepVuServiceImpl(dispatcher, duongDan, nguoiDungRepository,
            donMuaHangEmailRepository, pdf, Clock.fixed(BAY_GIO, ZoneOffset.UTC));

    // ---------------- Cửa hàng ----------------

    static CuaHangEmail cuaHang() {
        return new CuaHangEmail("Thời trang Linh Lan", "Công ty TNHH Thời trang Linh Lan", "0109123456",
                "Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội", "024 3999 8888", "lienhe@linhlan.vn", null);
    }

    static CuaHangEmail cuaHangCoLogo() {
        CuaHangEmail c = cuaHang();
        return new CuaHangEmail(c.tenHienThi(), c.tenDangKy(), c.maSoThue(), c.diaChiDangKy(), c.dienThoai(),
                c.email(), "https://minio.slmglobal.vn/fashion/logo-linh-lan.png");
    }

    /** Chỉ có tên cửa hàng và địa chỉ đăng ký: không logo, mã số thuế, điện thoại, email, tên đăng ký. */
    static CuaHangEmail cuaHangThieu() {
        return new CuaHangEmail("Thời trang Linh Lan", null, null, "Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội",
                null, null, null);
    }

    // ---------------- Nhân sự ----------------

    static NguoiDung nhanSu(String vaiTro) {
        return NguoiDung.builder().id(15).tenDangNhap("minhanh").hoTen("Nguyễn Minh Anh")
                .email("minhanh@linhlan.vn").vaiTro(vaiTro).trangThai(1).matKhauHash("$2a$10$bam.mat.khau").build();
    }

    // ---------------- Đơn mua ----------------

    static NguoiDung nguoiPhuTrach() {
        return NguoiDung.builder().id(3).tenDangNhap("hapt").hoTen("Phạm Thu Hà").vaiTro("nhan_vien_mua_hang")
                .soDienThoai("0912345678").email("ha.pham@linhlan.vn").trangThai(1).build();
    }

    static ChiTietDonMuaHang dong(int id, String ten, String mau, String co, String sku, int soLuong, Integer donGia,
                                  String donViTinh) {
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(id * 10).tenSanPham(ten).donViTinh(donViTinh).build();
        BienTheSanPham bt = BienTheSanPham.builder().id(id * 100).sanPham(sp)
                .mauSac(MauSac.builder().tenMau(mau).build()).size(Size.builder().tenSize(co).build()).maSku(sku)
                .build();
        return ChiTietDonMuaHang.builder().id(id).bienTheSanPham(bt).soLuongDat(new BigDecimal(soLuong + ".000"))
                .donGia(donGia == null ? null : new BigDecimal(donGia + ".00")).build();
    }

    /** Đơn như demo: 4 dòng, cùng đơn vị "Cái", tổng 51.400.000 khi đã có giá. */
    static DonMuaHang don(boolean coGia) {
        List<ChiTietDonMuaHang> ds = new ArrayList<>();
        // cố ý đưa dòng id lớn trước: email phải xếp theo id dòng
        ds.add(dong(904, "Áo thun nữ cổ tròn", "Đen", "S", "ATN-NU-DEN-S", 100, coGia ? 98000 : null, "Cái"));
        ds.add(dong(901, "Áo polo nam cơ bản", "Trắng", "M", "APL-NAM-TRANG-M", 120, coGia ? 145000 : null, "Cái"));
        ds.add(dong(902, "Áo polo nam cơ bản", "Xanh navy", "L", "APL-NAM-NAVY-L", 80, coGia ? 145000 : null, "Cái"));
        ds.add(dong(903, "Quần kaki nam slim", "Be", "31", "QKK-NAM-BE-31", 60, coGia ? 210000 : null, "Cái"));
        return DonMuaHang.builder().id(ID_DON).soDonMua(MA_DON).trangThai(2)
                .nhaCungCap(NhaCungCap.builder().id(7).tenNhaCungCap("Xưởng May Hoàng Anh").email(EMAIL_NCC).build())
                .khoNhap(Kho.builder().id(1).tenKho("Kho tổng").diaChi("Lô B2, KCN Quang Minh, xã Quang Minh, Hà Nội").build())
                .ngayDatHang(Instant.parse("2026-10-19T02:00:00Z"))
                .ngayGuiYeuCau(Instant.parse("2026-10-19T02:00:05Z"))
                // 26/10/2026 giờ Việt Nam
                .ngayGiaoDuKien(Instant.parse("2026-10-25T17:00:00Z"))
                .tongTien(coGia ? new BigDecimal("51400000.00") : null)
                .nguoiTao(nguoiPhuTrach())
                .chiTietDonMuaHangs(ds)
                .build();
    }

    /** Đơn đã có báo giá lúc 14:35 ngày 19/10/2026. */
    static DonMuaHang donDaBaoGia(String ghiChu) {
        DonMuaHang d = don(true);
        d.setNgayBaoGia(Instant.parse("2026-10-19T07:35:00Z"));
        d.setGhiChuNhaCungCap(ghiChu);
        return d;
    }

    static final String GHI_CHU = "Hàng đóng gói 20 cái mỗi thùng, ngoài thùng ghi mã SKU.";

    // ---------------- Biên bản trả hàng ----------------

    static final String MA_BIEN_BAN = "RTV-20261021-003";
    static final Integer ID_BIEN_BAN = 12;
    static final String SO_PHIEU_NHAP = "PN202610210004";
    static final String TEN_NCC = "Xưởng May Hoàng Anh";

    /**
     * Biên bản của đơn đã có giá (đơn giá lấy từ dòng đơn cùng biến thể): 2 Áo polo trắng M × 145.000, 1 Áo polo navy
     * L × 145.000, 1 Quần kaki be 31 × 210.000 = 4 cái, 645.000 ₫. Dòng biên bản cố ý không theo thứ tự id.
     */
    static BienBanTraHangNcc bienBan(String trangThai) {
        DonMuaHang don = donDaBaoGia(null);
        don.setTrangThai(3);
        PhieuNhapKho phieu = PhieuNhapKho.builder().id(88).soPhieuNhap(SO_PHIEU_NHAP).kho(don.getKhoNhap())
                .donMuaHang(don).nhaCungCap(don.getNhaCungCap()).build();
        List<ChiTietTraHangNcc> ds = new ArrayList<>();
        ds.add(dongLoi(53, bienThe(don, 903), 1, "Ố bẩn"));
        ds.add(dongLoi(51, bienThe(don, 901), 2, "Lỗi phụ liệu"));
        ds.add(dongLoi(52, bienThe(don, 902), 1, "Rách vải"));
        BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(ID_BIEN_BAN).maBienBan(MA_BIEN_BAN).phieuNhapKho(phieu)
                .nhaCungCap(don.getNhaCungCap()).nguoiTao(nhanSu("nhan_vien_kho")).tongSoLuongLoi(4)
                .phuongAnXuLy("CHO_CHOT").trangThai(trangThai).ngayTao(Instant.parse("2026-10-21T03:21:00Z"))
                .chiTiets(ds).build();
        ds.forEach(ct -> ct.setBienBanTraHangNcc(bb));
        return bb;
    }

    static BienBanTraHangNcc bienBan() {
        return bienBan("CHO_TRA_HANG");
    }

    static BienTheSanPham bienThe(DonMuaHang don, int idDong) {
        return don.getChiTietDonMuaHangs().stream().filter(ct -> ct.getId() == idDong).findFirst().orElseThrow()
                .getBienTheSanPham();
    }

    static ChiTietTraHangNcc dongLoi(int id, BienTheSanPham bt, int soLuong, String lyDo) {
        return ChiTietTraHangNcc.builder().id(id).bienTheSanPham(bt).soLuongLoi(soLuong).lyDoLoi(lyDo)
                .maLo("LO-" + id).build();
    }

    /** Hạn trả lời: hết ngày 28/10/2026 giờ Việt Nam (7 ngày sau ngày gửi email 21/10). */
    static final Instant HAN_TRA_LOI = Instant.parse("2026-10-28T16:59:59Z");

    /**
     * Bản DTO của {@link #bienBan()} như BienBanTraHangServiceImpl dựng cho email / PDF: phiếu còn Nháp, chưa trả lời gì,
     * nhà cung cấp còn phải chọn cách bù và hàng lỗi (cả hai lựa chọn còn mở), hạn {@link #HAN_TRA_LOI}.
     */
    static BienBanTraHangDto ban() {
        DonMuaHang don = donDaBaoGia(null);
        List<BienBanTraHangDto.ChiTietItemDto> items = new ArrayList<>();
        List<BienBanTraHangDto.TheoBienTheDto> theoBienThe = new ArrayList<>();
        int[][] loi = {{51, 901, 2}, {52, 902, 1}, {53, 903, 1}};
        String[] lyDo = {"Lỗi phụ liệu", "Rách vải", "Ố bẩn"};
        for (int i = 0; i < loi.length; i++) {
            int idDong = loi[i][1];
            ChiTietDonMuaHang ct = don.getChiTietDonMuaHangs().stream().filter(c -> c.getId() == idDong).findFirst()
                    .orElseThrow();
            BienTheSanPham bt = ct.getBienTheSanPham();
            items.add(BienBanTraHangDto.ChiTietItemDto.builder().id(loi[i][0]).bienTheSanPhamId(bt.getId())
                    .sku(bt.getMaSku()).tenBienThe(bt.getSanPham().getTenSanPham()).mauSac(bt.getMauSac().getTenMau())
                    .kichCo(bt.getSize().getTenSize()).maLo("LO-" + loi[i][0]).lyDo(lyDo[i]).soLuong(loi[i][2]).build());
            theoBienThe.add(BienBanTraHangDto.TheoBienTheDto.builder().bienTheSanPhamId(bt.getId()).sku(bt.getMaSku())
                    .soLuongLoi(loi[i][2]).donGia(ct.getDonGia()).build());
        }
        return BienBanTraHangDto.builder().id(ID_BIEN_BAN).soBienBan(MA_BIEN_BAN).phieuNhapKhoId(88)
                .soPhieuNhap(SO_PHIEU_NHAP).phieuDaNhap(false).donMuaHangId(ID_DON).soDonMua(MA_DON).trangThaiDonMua(3)
                .khoId(1).tenKho("Kho tổng").nhaCungCapId(7).maNhaCungCap("NCC07").tenNhaCungCap(TEN_NCC)
                .nguoiLienHeNcc("Trần Thị Lan").dienThoaiNcc("0987654321").emailNcc(EMAIL_NCC)
                .phuongAn("CHO_CHOT").buXong(false).choNccChonCachBu(true).choNccChonHangLoi(true)
                .hanTraLoi(HAN_TRA_LOI).daNhacHan(false)
                .cachBuMo(List.of("DOI_HANG", "TRU_CONG_NO")).hangLoiMo(List.of("NHAN_LAI", "TIEU_HUY"))
                .soLuongTruTien(0).tienTruTien(BigDecimal.ZERO).ngayLap(Instant.parse("2026-10-21T03:21:00Z"))
                .nguoiLap("Nguyễn Minh Anh").tongSoLuongLoi(4).giaTriLoi(new BigDecimal("645000.00"))
                .trangThai("CHO_TRA_HANG").trangThaiHienThi("MOI_LAP").cachXuLyHang("GIU_KHO").trangThaiHang("O_KHO")
                .duLieuCu(false).theoBienThe(theoBienThe).items(items).build();
    }

    /**
     * {@link #ban()} sau khi nhà cung cấp trả lời trên cổng ({@code nguoi} lúc {@link #BAY_GIO}): cách bù / hàng lỗi
     * null là chưa chọn (vẫn còn chờ). Trừ tiền thì số trừ = toàn bộ 4 sản phẩm, 645.000 ₫.
     */
    static BienBanTraHangDto banDaTraLoi(String phuongAn, String hangLoi, String nguoi) {
        BienBanTraHangDto b = ban();
        if (phuongAn != null) {
            b.setPhuongAn(phuongAn);
            b.setNguonChot("CONG_NCC");
            b.setNguoiXacNhanNcc(nguoi);
            b.setThoiDiemChot(BAY_GIO);
            b.setChoNccChonCachBu(false);
            if ("TRU_CONG_NO".equals(phuongAn)) {
                b.setSoLuongTruTien(4);
                b.setTienTruTien(new BigDecimal("645000.00"));
            }
        }
        if (hangLoi != null) {
            b.setHangLoiNcc(hangLoi);
            b.setNguoiChonHangLoi(nguoi);
            b.setThoiDiemChonHangLoi(BAY_GIO);
            b.setChoNccChonHangLoi(false);
        }
        return b;
    }

    // ---------------- Dựng thư ----------------

    /** Gọi một hàm của service, bắt EmailGui đưa cho dispatcher (guiSauCommit hoặc guiNgay). */
    EmailGui bat(Consumer<EmailNghiepVuServiceImpl> goi) {
        clearInvocations(dispatcher);
        goi.accept(service);
        ArgumentCaptor<EmailGui> sauCommit = ArgumentCaptor.forClass(EmailGui.class);
        verify(dispatcher, atLeast(0)).guiSauCommit(sauCommit.capture());
        ArgumentCaptor<EmailGui> ngay = ArgumentCaptor.forClass(EmailGui.class);
        verify(dispatcher, atLeast(0)).guiNgay(ngay.capture());
        List<EmailGui> ds = new ArrayList<>(sauCommit.getAllValues());
        ds.addAll(ngay.getAllValues());
        if (ds.size() != 1) {
            throw new AssertionError("Mong 1 email, có " + ds.size());
        }
        return ds.get(0);
    }

    BanThu dung(Consumer<EmailNghiepVuServiceImpl> goi, CuaHangEmail cuaHang) {
        return dungMau.dung(bat(goi), cuaHang);
    }
}
