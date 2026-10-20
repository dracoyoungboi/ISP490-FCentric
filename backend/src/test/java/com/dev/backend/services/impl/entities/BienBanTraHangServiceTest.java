package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Biên bản trả hàng NCC: dòng biên bản lấy từ hàng không đạt đã lưu theo lô, không lấy từ request của trình duyệt.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BienBanTraHangServiceTest {

    @Mock
    private BienBanTraHangNccRepository bienBanTraHangNccRepository;
    @Mock
    private ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    @Mock
    private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Mock
    private ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;

    private BienBanTraHangServiceImpl service;

    private PhieuNhapKho phieu;
    private NguoiDung nguoiDung;
    private BienTheSanPham bienThe;
    private LoHang loA;
    private LoHang loB;
    private LoHang loDat;
    private final List<ChiTietTraHangNcc> dongDaLuu = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new BienBanTraHangServiceImpl(
                bienBanTraHangNccRepository,
                chiTietTraHangNccRepository,
                phieuNhapKhoRepository,
                nguoiDungRepository,
                chiTietPhieuNhapKhoRepository,
                chiTietLoiLoHangRepository
        );

        NhaCungCap ncc = NhaCungCap.builder().id(5).tenNhaCungCap("NCC Việt").build();
        nguoiDung = NguoiDung.builder().id(99).hoTen("Trần Kho").build();
        phieu = PhieuNhapKho.builder().id(1).soPhieuNhap("PN2026101701").nhaCungCap(ncc).trangThai(0)
                .kho(Kho.builder().id(1).build()).build();

        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Polo").build();
        bienThe = BienTheSanPham.builder().id(10).maSku("POLO-01").sanPham(sp).build();
        loA = LoHang.builder().id(50).maLo("LO-PN2026101701-01").bienTheSanPham(bienThe).soLuongNhap(9).soLuongLoi(3).build();
        loB = LoHang.builder().id(51).maLo("LO-PN2026101701-02").bienTheSanPham(bienThe).soLuongNhap(0).soLuongLoi(2).build();
        loDat = LoHang.builder().id(52).maLo("LO-PN2026101701-03").bienTheSanPham(bienThe).soLuongNhap(10).soLuongLoi(0).build();

        when(phieuNhapKhoRepository.findById(1)).thenReturn(Optional.of(phieu));
        // Lập biên bản khóa dòng phiếu (SELECT ... FOR UPDATE) thay vì đọc thường
        when(phieuNhapKhoRepository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(nguoiDungRepository.findById(99)).thenReturn(Optional.of(nguoiDung));
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.empty());
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(
                ct(loB), ct(loA), ct(loDat)));
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(2).build(),
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Ố bẩn").soLuong(1).ghiChu("vết dầu").build(),
                ChiTietLoiLoHang.builder().loHang(loB).lyDo("Rách vải").soLuong(2).build()));
        when(bienBanTraHangNccRepository.saveAndFlush(any(BienBanTraHangNcc.class))).thenAnswer(inv -> {
            BienBanTraHangNcc b = inv.getArgument(0);
            if (b.getId() == null) b.setId(200);
            return b;
        });
        // Đã cấp 003 và 006 trong ngày (biên bản 004, 005 đã bị hủy): số tiếp theo là 007, không đếm tổng
        when(bienBanTraHangNccRepository.findMaBienBanTheoTienTo(anyString()))
                .thenAnswer(inv -> List.of(inv.<String>getArgument(0) + "006", inv.<String>getArgument(0) + "003"));
        when(chiTietTraHangNccRepository.saveAll(any())).thenAnswer(inv -> {
            dongDaLuu.clear();
            inv.<List<ChiTietTraHangNcc>>getArgument(0).forEach(dongDaLuu::add);
            return dongDaLuu;
        });
        when(chiTietTraHangNccRepository.findDetailByBienBanId(200)).thenAnswer(inv -> dongDaLuu);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private ChiTietPhieuNhapKho ct(LoHang lo) {
        return ChiTietPhieuNhapKho.builder().id(lo.getId() + 1000).loHang(lo).bienTheSanPham(bienThe)
                .soLuongNhap(BigDecimal.valueOf(lo.getSoLuongNhap())).build();
    }

    @Test
    @DisplayName("Phát hành: dòng lấy từ chi tiết lỗi đã lưu, gắn đúng lô theo id; bỏ qua items gửi lên")
    void testPhatHanhBienBan_ThanhCong() {
        PhatHanhBienBanRequest.ItemLoiRequest itemGia = PhatHanhBienBanRequest.ItemLoiRequest.builder()
                .bienTheSanPhamId(10).maLo("LO-KHAC").lyDo("Khác").soLuong(99).build();
        PhatHanhBienBanRequest req = PhatHanhBienBanRequest.builder()
                .phuongAn("TRU_CONG_NO").ghiChu("  Trừ vào kỳ thanh toán  ").items(List.of(itemGia)).build();

        BienBanTraHangDto res = service.phatHanh(1, req, 99);

        assertEquals("RTV-" + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + "-007", res.getSoBienBan());
        assertEquals("TRU_CONG_NO", res.getPhuongAn());
        assertEquals("Trừ vào kỳ thanh toán", res.getGhiChu());
        assertEquals(5, res.getTongSoLuongLoi(), "3 (lô 01) + 2 (lô 02), không tính items gửi lên");
        assertEquals(3, dongDaLuu.size());
        assertSame(loA, dongDaLuu.get(0).getLoHang(), "lô sắp theo id: lô 01 trước");
        assertEquals("Bung chỉ", dongDaLuu.get(0).getLyDoLoi());
        assertEquals(2, dongDaLuu.get(0).getSoLuongLoi());
        assertEquals("vết dầu", dongDaLuu.get(1).getGhiChu());
        assertSame(loB, dongDaLuu.get(2).getLoHang());
        assertEquals("LO-PN2026101701-02", dongDaLuu.get(2).getMaLo());
        dongDaLuu.forEach(d -> assertEquals(200, d.getBienBanTraHangNcc().getId()));
    }

    @Test
    @DisplayName("Lô khóa trước khi có bảng chi tiết lỗi: phần thiếu lý do vào dòng \"Chưa ghi lý do\" để tổng khớp")
    void testPhatHanh_LoCuChuaCoLyDo() {
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(1).build()));

        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);

        assertEquals(5, res.getTongSoLuongLoi());
        assertEquals("DOI_HANG", res.getPhuongAn(), "mặc định Đổi hàng mới");
        assertEquals(List.of("Bung chỉ", "Chưa ghi lý do", "Chưa ghi lý do"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList());
        assertEquals(List.of(1, 2, 2), dongDaLuu.stream().map(ChiTietTraHangNcc::getSoLuongLoi).toList());
    }

    @Test
    @DisplayName("Lập lại biên bản: giữ số biên bản, thay toàn bộ dòng cũ")
    void testLapLai_GiuSoBienBan() {
        BienBanTraHangNcc cu = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).nguoiTao(nguoiDung).tongSoLuongLoi(9).phuongAnXuLy("DOI_HANG").build();
        List<ChiTietTraHangNcc> dongCu = List.of(ChiTietTraHangNcc.builder().id(1).build());
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(cu));
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(dongCu);

        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("TRA_TAI_XE").build(), 99);

        verify(chiTietTraHangNccRepository).deleteAll(dongCu);
        assertEquals("RTV-20261018-003", res.getSoBienBan());
        assertEquals(5, res.getTongSoLuongLoi());
        assertEquals("TRA_TAI_XE", res.getPhuongAn());
    }

    @Test
    @DisplayName("Không còn hàng lỗi: có biên bản thì hủy (giữ dòng, trạng thái DA_HUY để số không bị cấp lại), chưa có thì 400")
    void testKhongConHangLoi() {
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ct(loDat)));
        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());

        BienBanTraHangNcc cu = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu).build();
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(cu));
        assertNull(service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(BienBanTraHangNcc.DA_HUY, cu.getTrangThai());
        verify(bienBanTraHangNccRepository).save(cu);
        verify(bienBanTraHangNccRepository, never()).delete(any(BienBanTraHangNcc.class));

        // Đã hủy rồi mà vẫn không có hàng lỗi: 400 như chưa có biên bản
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99)).getStatus());
        // Đã hủy thì không còn hiện theo phiếu
        assertNull(service.layTheoPhieuNhap(1));
    }

    @Test
    @DisplayName("Biên bản đã hủy của phiếu có hàng lỗi trở lại: lập lại dùng đúng số cũ, không cấp số mới")
    void testLapLaiSauKhiHuy_GiuSo() {
        BienBanTraHangNcc daHuy = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).nguoiTao(nguoiDung).trangThai(BienBanTraHangNcc.DA_HUY).build();
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(daHuy));

        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);

        assertEquals("RTV-20261018-003", res.getSoBienBan());
        assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, daHuy.getTrangThai());
        verify(bienBanTraHangNccRepository, never()).findMaBienBanTheoTienTo(anyString());
    }

    @Test
    @DisplayName("Phương án không hợp lệ: 400 (câu báo không lộ mã kỹ thuật); phiếu không còn Nháp: 400")
    void testKiemTraDauVao() {
        CommonException ex = assertThrows(CommonException.class,
                () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("XYZ").build(), 99));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertFalse(ex.getMessage().contains("TRU_CONG_NO"), ex.getMessage());

        phieu.setTrangThai(3);
        ex = assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        verify(bienBanTraHangNccRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Lập biên bản khóa dòng phiếu trước (cùng thứ tự với khóa lô / nhập kho), không đọc phiếu thường")
    void testPhatHanh_KhoaDongPhieuTruoc() {
        service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);
        org.mockito.InOrder thuTu = inOrder(phieuNhapKhoRepository, chiTietPhieuNhapKhoRepository, bienBanTraHangNccRepository);
        thuTu.verify(phieuNhapKhoRepository).khoaTheoId(1);
        thuTu.verify(chiTietPhieuNhapKhoRepository).findAllByPhieuNhapKhoIdAndCoLo(1);
        thuTu.verify(bienBanTraHangNccRepository).saveAndFlush(any(BienBanTraHangNcc.class));
        verify(phieuNhapKhoRepository, never()).findById(anyInt());
    }

    @Test
    @DisplayName("Lập biên bản cho phiếu không tồn tại: 404")
    void testPhatHanh_PhieuKhongTonTai_404() {
        when(phieuNhapKhoRepository.khoaTheoId(77)).thenReturn(Optional.empty());
        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(77, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    @DisplayName("Phát hành biên bản RTV báo lỗi khi phiếu nhập không có NCC")
    void testPhatHanhBienBan_KhongCoNcc_BaoLoi() {
        phieu.setNhaCungCap(null);
        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("không có thông tin Nhà cung cấp"));
    }

    @Test
    @DisplayName("Nhân viên kho khác: 403 khi lập biên bản phiếu của kho khác")
    void testKhoKhac_403() {
        SecurityContextHolder.setUser(com.dev.backend.dto.response.entities.NguoiDungAuthInfo.builder()
                .id(99).vaiTro(java.util.Set.of("nhan_vien_kho")).phanQuyenNguoiDungKhos(List.of()).build());
        SecurityContextHolder.setKhoId(2);
        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        ArgumentCaptor<BienBanTraHangNcc> cap = ArgumentCaptor.forClass(BienBanTraHangNcc.class);
        verify(bienBanTraHangNccRepository, never()).saveAndFlush(cap.capture());
    }

    @Test
    @DisplayName("Biên bản khớp hàng lỗi hiện tại: cùng lô, lý do, số lượng; lô bị xóa (mất liên kết) hay đổi số thì không khớp")
    void testKhopHangLoiHienTai() {
        BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(200).phieuNhapKho(phieu).build();
        List<ChiTietTraHangNcc> dongBb = new ArrayList<>(List.of(
                ChiTietTraHangNcc.builder().loHang(loA).lyDoLoi("Ố bẩn").soLuongLoi(1).build(),
                ChiTietTraHangNcc.builder().loHang(loA).lyDoLoi("Bung chỉ").soLuongLoi(2).build(),
                ChiTietTraHangNcc.builder().loHang(loB).lyDoLoi("Rách vải").soLuongLoi(2).build()));
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(dongBb);
        assertTrue(service.khopHangLoiHienTai(bb), "khác thứ tự vẫn khớp");

        dongBb.set(2, ChiTietTraHangNcc.builder().loHang(null).maLo("LO-PN2026101701-02").lyDoLoi("Rách vải").soLuongLoi(2).build());
        assertFalse(service.khopHangLoiHienTai(bb), "lô đã bị xóa rồi khóa lại cùng số vẫn phải lập lại");

        dongBb.set(2, ChiTietTraHangNcc.builder().loHang(loB).lyDoLoi("Rách vải").soLuongLoi(1).build());
        assertFalse(service.khopHangLoiHienTai(bb));

        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ct(loDat)));
        assertFalse(service.khopHangLoiHienTai(bb), "hết hàng lỗi mà còn dòng biên bản");
    }

    @Test
    @DisplayName("Biên bản lập bằng bản cũ + lô khóa bằng bản cũ (chưa có chi tiết lỗi): dòng biên bản của lô đúng tổng số lỗi thì khớp")
    void testKhop_BienBanCuLoChuaCoChiTietLoi() {
        // Lô 02 khóa trước khi có bảng chi tiết lỗi: chỉ lô 01 có chi tiết
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(2).build(),
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Ố bẩn").soLuong(1).build()));
        BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(200).phieuNhapKho(phieu).trangThai(BienBanTraHangNcc.CHO_TRA_HANG).build();
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(
                ChiTietTraHangNcc.builder().loHang(loA).lyDoLoi("Bung chỉ").soLuongLoi(2).build(),
                ChiTietTraHangNcc.builder().loHang(loA).lyDoLoi("Ố bẩn").soLuongLoi(1).build(),
                ChiTietTraHangNcc.builder().loHang(loB).lyDoLoi("Rách vải").soLuongLoi(1).build(),
                ChiTietTraHangNcc.builder().loHang(loB).lyDoLoi("Sai màu").soLuongLoi(1).build()));

        assertTrue(service.khopHangLoiHienTai(bb), "lý do người kiểm nhập trên biên bản cũ không bị thay bằng \"Chưa ghi lý do\"");

        // Lô 02 khóa lại với số lỗi khác: dòng cũ (tổng 2) không còn đúng lô, phải lập lại
        loB.setSoLuongLoi(3);
        assertFalse(service.khopHangLoiHienTai(bb));
        loB.setSoLuongLoi(2);

        // Biên bản đã hủy: không lấy lý do từ biên bản hủy
        bb.setTrangThai(BienBanTraHangNcc.DA_HUY);
        assertFalse(service.khopHangLoiHienTai(bb));
    }

    @Test
    @DisplayName("Lập lại biên bản cũ: lô chưa có chi tiết lỗi giữ lý do / ghi chú / ảnh của dòng biên bản (dòng mới), sau đó vẫn khớp")
    void testLapLai_GiuLyDoBienBanCu() {
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(3).build()));
        BienBanTraHangNcc cu = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).nguoiTao(nguoiDung).tongSoLuongLoi(5).phuongAnXuLy("DOI_HANG")
                .trangThai(BienBanTraHangNcc.CHO_TRA_HANG).build();
        ChiTietTraHangNcc dongCuLoB = ChiTietTraHangNcc.builder().id(7).bienBanTraHangNcc(cu).bienTheSanPham(bienThe).loHang(loB)
                .maLo(loB.getMaLo()).lyDoLoi("Rách vải").soLuongLoi(2).ghiChu("góc trái").anhBangChungUrl("/anh/rach.jpg").build();
        List<ChiTietTraHangNcc> dongCu = List.of(
                ChiTietTraHangNcc.builder().id(6).bienBanTraHangNcc(cu).bienTheSanPham(bienThe).loHang(loA)
                        .lyDoLoi("Khác").soLuongLoi(3).build(),
                dongCuLoB);
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(cu));
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(dongCu);

        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("DOI_HANG").build(), 99);

        verify(chiTietTraHangNccRepository).deleteAll(dongCu);
        assertEquals("RTV-20261018-003", res.getSoBienBan());
        assertEquals(5, res.getTongSoLuongLoi());
        assertEquals(List.of("Bung chỉ", "Rách vải"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList(),
                "lô có chi tiết lỗi lấy từ chi tiết; lô cũ giữ lý do trên biên bản, không thành \"Chưa ghi lý do\"");
        ChiTietTraHangNcc moi = dongDaLuu.get(1);
        assertNotSame(dongCuLoB, moi, "dòng cũ bị xóa khi lập lại: phải là dòng mới");
        assertNull(moi.getId());
        assertSame(loB, moi.getLoHang());
        assertEquals("LO-PN2026101701-02", moi.getMaLo());
        assertEquals(2, moi.getSoLuongLoi());
        assertEquals("góc trái", moi.getGhiChu());
        assertEquals("/anh/rach.jpg", moi.getAnhBangChungUrl());
        assertEquals(200, moi.getBienBanTraHangNcc().getId());

        // Biên bản vừa lập lại khớp hàng lỗi hiện tại: không bị chặn nhập kho
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(new ArrayList<>(dongDaLuu));
        assertTrue(service.khopHangLoiHienTai(cu));
    }

    @Test
    @DisplayName("Không lấy lý do cũ khi biên bản đã hủy hoặc dòng cũ không đúng tổng số lỗi của lô: phần lỗi vào \"Chưa ghi lý do\"")
    void testLapLai_KhongLayLyDoCuKhiKhongDuDieuKien() {
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(3).build()));
        BienBanTraHangNcc cu = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).nguoiTao(nguoiDung).trangThai(BienBanTraHangNcc.DA_HUY).build();
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(cu));
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(
                ChiTietTraHangNcc.builder().id(7).bienTheSanPham(bienThe).loHang(loB).lyDoLoi("Rách vải").soLuongLoi(2).build()));

        service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);
        assertEquals(List.of("Bung chỉ", "Chưa ghi lý do"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList(), "biên bản đã hủy");

        // Biên bản còn hiệu lực (vừa lập lại) nhưng dòng cũ của lô 02 chỉ có 1 trong 2 cái lỗi
        assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, cu.getTrangThai());
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(
                ChiTietTraHangNcc.builder().id(8).bienTheSanPham(bienThe).loHang(loB).lyDoLoi("Rách vải").soLuongLoi(1).build()));
        service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);
        assertEquals(List.of("Bung chỉ", "Chưa ghi lý do"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList(),
                "dòng cũ không đủ số lỗi của lô");
        assertEquals(List.of(3, 2), dongDaLuu.stream().map(ChiTietTraHangNcc::getSoLuongLoi).toList());
    }

    private BienBanTraHangNcc bienBanCuDangHieuLuc() {
        BienBanTraHangNcc cu = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261018-003").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).nguoiTao(nguoiDung).tongSoLuongLoi(5).phuongAnXuLy("DOI_HANG")
                .trangThai(BienBanTraHangNcc.CHO_TRA_HANG).build();
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(cu));
        // Chỉ lô 01 có chi tiết lỗi; các lô lỗi khác khóa bằng bản cũ
        when(chiTietLoiLoHangRepository.findByLoHangIds(anyCollection())).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(loA).lyDo("Bung chỉ").soLuong(3).build()));
        return cu;
    }

    @Test
    @DisplayName("Lập lại biên bản cũ: dòng cũ không gắn lô (bản cũ tìm lô theo mã) vẫn ghép đúng lô theo biến thể + mã lô, giữ lý do")
    void testLapLai_DongCuKhongGanLo() {
        BienBanTraHangNcc cu = bienBanCuDangHieuLuc();
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(
                ChiTietTraHangNcc.builder().id(7).bienBanTraHangNcc(cu).bienTheSanPham(bienThe).loHang(null)
                        .maLo("  lo-pn2026101701-02 ").lyDoLoi("Rách vải").soLuongLoi(2).ghiChu("góc trái").build()));

        service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("DOI_HANG").build(), 99);

        assertEquals(List.of("Bung chỉ", "Rách vải"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList(),
                "mã lô khác hoa thường / khoảng trắng vẫn là lô 02 của cùng biến thể");
        ChiTietTraHangNcc moi = dongDaLuu.get(1);
        assertSame(loB, moi.getLoHang(), "dòng mới gắn đúng lô");
        assertEquals("LO-PN2026101701-02", moi.getMaLo());
        assertEquals(2, moi.getSoLuongLoi());
        assertEquals("góc trái", moi.getGhiChu());
    }

    @Test
    @DisplayName("Lập lại biên bản cũ: dòng cũ gắn nhầm lô của biến thể khác trùng mã lô — ghép theo biến thể, không ghép một dòng cho hai lô")
    void testLapLai_DongCuGanNhamLoBienTheKhac() {
        BienTheSanPham bienThe2 = BienTheSanPham.builder().id(11).maSku("POLO-02").sanPham(bienThe.getSanPham()).build();
        // Biến thể 2 có lô trùng mã với lô 02 của biến thể 1 (bản cũ findFirstByMaLo trả lô này cho cả hai dòng)
        LoHang loC = LoHang.builder().id(53).maLo("LO-PN2026101701-02").bienTheSanPham(bienThe2).soLuongNhap(0).soLuongLoi(2).build();
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ct(loB), ct(loA), ct(loDat), ct(loC)));
        BienBanTraHangNcc cu = bienBanCuDangHieuLuc();
        ChiTietTraHangNcc dongBienThe1 = ChiTietTraHangNcc.builder().id(7).bienBanTraHangNcc(cu).bienTheSanPham(bienThe).loHang(loC)
                .maLo("LO-PN2026101701-02").lyDoLoi("Rách vải").soLuongLoi(2).build();
        ChiTietTraHangNcc dongBienThe2 = ChiTietTraHangNcc.builder().id(8).bienBanTraHangNcc(cu).bienTheSanPham(bienThe2).loHang(loC)
                .maLo("LO-PN2026101701-02").lyDoLoi("Sai màu").soLuongLoi(2).build();
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(dongBienThe1, dongBienThe2));

        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("DOI_HANG").build(), 99);

        assertEquals(7, res.getTongSoLuongLoi());
        assertEquals(List.of("Bung chỉ", "Rách vải", "Sai màu"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList());
        assertEquals(List.of(loA, loB, loC), dongDaLuu.stream().map(ChiTietTraHangNcc::getLoHang).toList());
        assertEquals(List.of(10, 10, 11), dongDaLuu.stream().map(d -> d.getBienTheSanPham().getId()).toList());

        // Lô của biến thể 2 không có dòng riêng: không lấy dòng của biến thể 1 (dù dòng đó gắn lô này và đúng tổng 2)
        when(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(200)).thenReturn(List.of(dongBienThe1));
        service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("DOI_HANG").build(), 99);
        assertEquals(List.of("Bung chỉ", "Rách vải", "Chưa ghi lý do"), dongDaLuu.stream().map(ChiTietTraHangNcc::getLyDoLoi).toList());
        assertSame(loC, dongDaLuu.get(2).getLoHang());
    }

    @Test
    @DisplayName("Mã phương án cũ DOI_HANG_MOI (biên bản lập trước khi đổi tên) được nhận như Đổi hàng khi lập lại / hủy")
    void testPhuongAnCu() {
        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().phuongAn("DOI_HANG_MOI").build(), 99);
        assertEquals("DOI_HANG", res.getPhuongAn());
    }

    @Test
    @DisplayName("Số biên bản theo số lớn nhất đã cấp trong ngày: biên bản bị hủy không làm cấp trùng số đang có")
    void testSoBienBanKhongTrung() {
        when(bienBanTraHangNccRepository.findMaBienBanTheoTienTo(anyString()))
                .thenAnswer(inv -> List.of(inv.<String>getArgument(0) + "001", inv.<String>getArgument(0) + "009", "RTV-khac-mau"));
        BienBanTraHangDto res = service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99);
        assertTrue(res.getSoBienBan().endsWith("-010"), res.getSoBienBan());
    }

    @Test
    @DisplayName("Hai biên bản lập cùng lúc được cùng số: 409 kèm hướng dẫn lập lại, không phải lỗi chung")
    void testTrungSoCungLuc() {
        when(bienBanTraHangNccRepository.saveAndFlush(any(BienBanTraHangNcc.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("Duplicate entry"));
        CommonException ex = assertThrows(CommonException.class, () -> service.phatHanh(1, PhatHanhBienBanRequest.builder().build(), 99));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("lập biên bản lại"), ex.getMessage());
    }

    @Test
    @DisplayName("Xem biên bản: người kho khác bị 403; danh sách theo NCC chỉ có biên bản của kho được phân quyền")
    void testXemKhoKhac() {
        BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(200).maBienBan("RTV-20261019-001").phieuNhapKho(phieu)
                .nhaCungCap(phieu.getNhaCungCap()).build();
        when(bienBanTraHangNccRepository.findById(200)).thenReturn(Optional.of(bb));
        when(bienBanTraHangNccRepository.findByNhaCungCap_IdOrderByNgayTaoDesc(any())).thenReturn(List.of(bb));
        SecurityContextHolder.setUser(com.dev.backend.dto.response.entities.NguoiDungAuthInfo.builder()
                .id(98).vaiTro(java.util.Set.of("nhan_vien_kho")).phanQuyenNguoiDungKhos(List.of()).build());
        SecurityContextHolder.setKhoId(2);

        CommonException ex = assertThrows(CommonException.class, () -> service.chiTiet(200));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(service.dsTheoNhaCungCap(5).isEmpty());
    }
}
