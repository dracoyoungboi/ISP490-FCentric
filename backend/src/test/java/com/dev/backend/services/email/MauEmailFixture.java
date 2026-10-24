package com.dev.backend.services.email;

import com.dev.backend.config.EmailTemplateConfig;
import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.entities.*;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.email.DonMuaHangEmailRepository;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;

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

    final DungMauEmail dungMau = new DungMauEmail(EmailTemplateConfig.taoEngine());
    final EmailDispatcher dispatcher = mock(EmailDispatcher.class);
    final NguoiDungRepository nguoiDungRepository = mock(NguoiDungRepository.class);
    final DonMuaHangEmailRepository donMuaHangEmailRepository = mock(DonMuaHangEmailRepository.class);
    final DuongDanEmail duongDan = new DuongDanEmail("https://fcentric.net", new MockEnvironment());
    final EmailNghiepVuServiceImpl service = new EmailNghiepVuServiceImpl(dispatcher, duongDan, nguoiDungRepository,
            donMuaHangEmailRepository, Clock.fixed(BAY_GIO, ZoneOffset.UTC));

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
