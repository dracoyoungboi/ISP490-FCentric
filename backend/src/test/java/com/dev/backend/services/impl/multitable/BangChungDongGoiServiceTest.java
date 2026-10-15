package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.LoaiBangChungDongGoi;
import com.dev.backend.dto.response.customize.ThongTinBangChungDonDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BangChungDongGoiRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.TepTinService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BangChungDongGoiServiceTest {

    @Mock
    private BangChungDongGoiRepository bangChungDongGoiRepository;

    @Mock
    private DonBanHangRepository donBanHangRepository;

    @Mock
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Mock
    private NguoiDungRepository nguoiDungRepository;

    @Mock
    private TepTinService tepTinService;

    @Mock
    private MinioService minioService;

    @InjectMocks
    private BangChungDongGoiServiceImpl bangChungDongGoiService;

    private Kho kho1;
    private DonBanHang donDuoi1Tr;
    private DonBanHang donTu1Tr;

    @BeforeEach
    void setUp() {
        kho1 = Kho.builder().id(1).tenKho("Kho Tổng").build();

        donDuoi1Tr = DonBanHang.builder()
                .id(101)
                .soDonHang("SO-001")
                .tongCong(new BigDecimal("750000.00"))
                .khoXuat(kho1)
                .trangThai(1)
                .build();

        donTu1Tr = DonBanHang.builder()
                .id(102)
                .soDonHang("SO-002")
                .tongCong(new BigDecimal("1500000.00"))
                .khoXuat(kho1)
                .trangThai(1)
                .build();

        NguoiDungAuthInfo auth = new NguoiDungAuthInfo();
        auth.setId(1);
        auth.setTenDangNhap("nvkho");
        auth.setVaiTro(Set.of("nhan_vien_kho"));
        SecurityContextHolder.setUser(auth);
        SecurityContextHolder.setKhoId(1);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    @DisplayName("TC-01: Đơn < 1tr yêu cầu 2 ảnh đóng gói")
    void testLayThongTinBangChung_DonDuoi1Trieu_YeuCau2Anh() {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1))
                .thenReturn(Collections.emptyList());

        ThongTinBangChungDonDto res = bangChungDongGoiService.layThongTinBangChung(101);

        assertNotNull(res);
        assertFalse(res.getYeuCauVideo());
        assertEquals("ANH_2_BUOC", res.getLoaiYeuCau());
        assertEquals(2, res.getSoLuongYeuCau());
        assertFalse(res.getDaDuBangChung());
    }

    @Test
    @DisplayName("TC-02: Đơn >= 1tr yêu cầu 1 video 15-30s")
    void testLayThongTinBangChung_DonTu1Trieu_YeuCauVideo() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                .thenReturn(Collections.emptyList());

        ThongTinBangChungDonDto res = bangChungDongGoiService.layThongTinBangChung(102);

        assertNotNull(res);
        assertTrue(res.getYeuCauVideo());
        assertEquals("VIDEO_15_30S", res.getLoaiYeuCau());
        assertEquals(1, res.getSoLuongYeuCau());
        assertFalse(res.getDaDuBangChung());
    }

    @Test
    @DisplayName("TC-03 & TC-04: Ngưỡng biên 999.999đ vs 1.000.000đ")
    void testNguongBienGiaTriDonHang() {
        DonBanHang don999k = DonBanHang.builder().id(103).tongCong(new BigDecimal("999999.00")).khoXuat(kho1).build();
        DonBanHang don1Tr = DonBanHang.builder().id(104).tongCong(new BigDecimal("1000000.00")).khoXuat(kho1).build();

        when(donBanHangRepository.findById(103)).thenReturn(Optional.of(don999k));
        when(donBanHangRepository.findById(104)).thenReturn(Optional.of(don1Tr));

        ThongTinBangChungDonDto res999 = bangChungDongGoiService.layThongTinBangChung(103);
        ThongTinBangChungDonDto res1Tr = bangChungDongGoiService.layThongTinBangChung(104);

        assertFalse(res999.getYeuCauVideo(), "Đơn 999.999đ không yêu cầu video");
        assertTrue(res1Tr.getYeuCauVideo(), "Đơn đúng 1.000.000đ bắt buộc yêu cầu video");
    }

    @Test
    @DisplayName("TC-05 & TC-06: Video 15s và 30s hợp lệ; TC-07 & TC-08: Video <15s hoặc >30s bị chặn")
    void testKiemTraVideoThoiLuong() {
        // Video 10s: thiếu thời lượng
        BangChungDongGoi video10s = BangChungDongGoi.builder()
                .loaiBangChung(LoaiBangChungDongGoi.VIDEO_DONG_GOI.name())
                .thoiLuongGiay(10)
                .build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                .thenReturn(List.of(video10s));
        assertFalse(bangChungDongGoiService.kiemTraDaDuBangChung(donTu1Tr), "Video 10s chưa đủ điều kiện");

        // Video 20s: hợp lệ
        BangChungDongGoi video20s = BangChungDongGoi.builder()
                .loaiBangChung(LoaiBangChungDongGoi.VIDEO_DONG_GOI.name())
                .thoiLuongGiay(20)
                .build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                .thenReturn(List.of(video20s));
        assertTrue(bangChungDongGoiService.kiemTraDaDuBangChung(donTu1Tr), "Video 20s hợp lệ");
    }

    @Test
    @DisplayName("TC-09 & TC-10: Đơn < 1tr thiếu ảnh hoặc upload trùng loại ảnh")
    void testKiemTraAnhDonDuoi1Trieu() {
        // Chỉ có ảnh 1
        BangChungDongGoi anh1 = BangChungDongGoi.builder()
                .loaiBangChung(LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name())
                .build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1))
                .thenReturn(List.of(anh1));
        assertFalse(bangChungDongGoiService.kiemTraDaDuBangChung(donDuoi1Tr), "Chỉ có 1 ảnh chưa đủ điều kiện");

        // Có đủ ảnh 1 và ảnh 2
        BangChungDongGoi anh2 = BangChungDongGoi.builder()
                .loaiBangChung(LoaiBangChungDongGoi.ANH_NIEM_PHONG_TEM_VC.name())
                .build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1))
                .thenReturn(List.of(anh1, anh2));
        assertTrue(bangChungDongGoiService.kiemTraDaDuBangChung(donDuoi1Tr), "Đủ 2 ảnh khác loại thì hợp lệ");
    }

    @Test
    @DisplayName("TC-11: Đơn >= 1tr upload ảnh bị từ chối")
    void testUploadBangChung_DonTu1TrieuUploadAnh_NemNgoaiLe() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));

        MockMultipartFile fileAnh = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[100]);

        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileAnh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
    }

    @Test
    @DisplayName("TC-12: Video sai thời lượng (< 15s hoặc > 30s) khi upload bị từ chối")
    void testUploadBangChung_VideoSaiThoiLuong_NemNgoaiLe() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));

        MockMultipartFile fileVideo = new MockMultipartFile("file", "test.mp4", "video/mp4", new byte[1000]);

        // Video 10s
        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 10));

        // Video 35s
        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 35));
    }

    @Test
    @DisplayName("Batch lookup chống N+1 queries cho màn hình Pick List")
    void testBatchKiemTraDaDuBangChung_ChongNPlus1() {
        List<Integer> ids = List.of(101, 102);
        when(bangChungDongGoiRepository.findByDonBanHangIdInAndTrangThai(ids, 1)).thenReturn(Collections.emptyList());
        when(donBanHangRepository.findAllById(ids)).thenReturn(List.of(donDuoi1Tr, donTu1Tr));

        Map<Integer, Boolean> map = bangChungDongGoiService.kiemTraDaDuBangChungTheoDanhSachDon(ids);

        assertEquals(2, map.size());
        assertFalse(map.get(101));
        assertFalse(map.get(102));
        verify(bangChungDongGoiRepository, times(1)).findByDonBanHangIdInAndTrangThai(ids, 1);
    }
}
