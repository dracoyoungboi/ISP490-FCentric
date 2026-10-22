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
    @DisplayName("TC-02: Đơn >= 1tr yêu cầu 1 video 15 giây – 3 phút, trả kèm khoảng thời lượng")
    void testLayThongTinBangChung_DonTu1Trieu_YeuCauVideo() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                .thenReturn(Collections.emptyList());

        ThongTinBangChungDonDto res = bangChungDongGoiService.layThongTinBangChung(102);

        assertNotNull(res);
        assertTrue(res.getYeuCauVideo());
        assertEquals("VIDEO_15_30S", res.getLoaiYeuCau());
        assertEquals(15, res.getThoiLuongVideoToiThieu());
        assertEquals(180, res.getThoiLuongVideoToiDa());
        assertEquals("Đơn hàng giá trị từ 1.000.000đ trở lên: Bắt buộc quay 1 video dài 15 giây – 3 phút, "
                + "từ lúc cho đồ vào đến khi niêm phong.", res.getHuongDan());
        assertEquals(1, res.getSoLuongYeuCau());
        assertFalse(res.getDaDuBangChung());
    }

    @Test
    @DisplayName("Câu khoảng thời lượng dựng từ hằng: giây / phút / phút lẻ giây")
    void testMoTaKhoangVideo() {
        assertEquals("từ 15 giây đến 3 phút", BangChungDongGoiServiceImpl.moTaKhoangVideo());
        assertEquals("15 giây – 3 phút", BangChungDongGoiServiceImpl.khoangVideoNgan());
        assertEquals("59 giây", BangChungDongGoiServiceImpl.chuThoiLuong(59));
        assertEquals("1 phút", BangChungDongGoiServiceImpl.chuThoiLuong(60));
        assertEquals("2 phút 30 giây", BangChungDongGoiServiceImpl.chuThoiLuong(150));
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
    @DisplayName("TC-05 & TC-06: Video 15s, 35s, 180s hợp lệ; TC-07 & TC-08: Video <15s hoặc >180s bị chặn")
    void testKiemTraVideoThoiLuong() {
        Map<Integer, Boolean> mongDoi = new LinkedHashMap<>();
        mongDoi.put(10, false);
        mongDoi.put(14, false);
        mongDoi.put(15, true);
        mongDoi.put(35, true); // quy tắc cũ (15–30 giây) chặn, quy tắc mới cho qua
        mongDoi.put(180, true);
        mongDoi.put(181, false);
        mongDoi.forEach((giay, hopLe) -> {
            BangChungDongGoi video = BangChungDongGoi.builder()
                    .loaiBangChung(LoaiBangChungDongGoi.VIDEO_DONG_GOI.name())
                    .thoiLuongGiay(giay)
                    .build();
            when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                    .thenReturn(List.of(video));
            assertEquals(hopLe, bangChungDongGoiService.kiemTraDaDuBangChung(donTu1Tr), "Video " + giay + "s");
        });

        // Video không có thời lượng: chưa đủ
        BangChungDongGoi videoKhongRo = BangChungDongGoi.builder()
                .loaiBangChung(LoaiBangChungDongGoi.VIDEO_DONG_GOI.name())
                .build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(102, 1))
                .thenReturn(List.of(videoKhongRo));
        assertFalse(bangChungDongGoiService.kiemTraDaDuBangChung(donTu1Tr), "Video không rõ thời lượng");
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
    @DisplayName("TC-12: Video sai thời lượng (< 15s hoặc > 180s) khi upload bị từ chối")
    void testUploadBangChung_VideoSaiThoiLuong_NemNgoaiLe() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));

        MockMultipartFile fileVideo = new MockMultipartFile("file", "test.mp4", "video/mp4", new byte[1000]);

        // Video 10s, 14s (sát mốc dưới)
        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 10));
        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 14));

        // Video 181s
        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 181));
        assertEquals("Thời lượng video đóng gói phải từ 15 giây đến 3 phút (Nhận được: 181 giây)!", loi.getMessage());

        // Không gửi thời lượng
        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), null));
        verifyNoInteractions(minioService);
    }

    @Test
    @DisplayName("Upload video 15s, 35s và 180s (trong khoảng 15 giây – 3 phút) được nhận")
    void testUploadBangChung_VideoTrongKhoang_ThanhCong() throws Exception {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndLoaiBangChungAndTrangThai(eq(102), anyString(), eq(1)))
                .thenReturn(Optional.empty());
        when(minioService.upload(any(), anyString())).thenReturn("packing-proofs/102/uuid.webm");
        when(minioService.getPublicUrl(anyString())).thenReturn("http://171.244.142.43:9000/fashion/packing-proofs/102/uuid.webm");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bangChungDongGoiRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile fileVideo = new MockMultipartFile("file", "video.webm", "video/webm", new byte[1000]);
        for (int giay : new int[]{15, 35, 180}) {
            var dto = bangChungDongGoiService.uploadBangChung(102, fileVideo, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), giay);
            assertEquals(giay, dto.getThoiLuongGiay());
        }
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

    @Test
    @DisplayName("Upload ảnh thành công: sinh URL công khai HTTPS qua getPublicUrl và PublicAssetUrl")
    void testUploadBangChung_ThanhCong_SinhUrlPublicHttps() throws Exception {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndLoaiBangChungAndTrangThai(eq(101), anyString(), eq(1)))
                .thenReturn(Optional.empty());
        when(minioService.upload(any(), anyString())).thenReturn("packing-proofs/101/uuid.jpg");
        when(minioService.getPublicUrl(anyString())).thenReturn("http://171.244.142.43:9000/fashion/packing-proofs/101/uuid.jpg");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bangChungDongGoiRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile fileAnh = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[100]);
        var dto = bangChungDongGoiService.uploadBangChung(101, fileAnh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null);

        assertNotNull(dto);
        assertEquals("https://minio.slmglobal.vn/fashion/packing-proofs/101/uuid.jpg", dto.getUrlPublic());
        assertEquals("https://minio.slmglobal.vn/fashion/packing-proofs/101/uuid.jpg", dto.getDuongDanMinio());
        verify(minioService, times(1)).getPublicUrl(anyString());
    }

    @Test
    @DisplayName("Backward Compatibility: Bản ghi cũ lưu đường dẫn tương đối tự động sinh HTTPS URL")
    void testLayThongTinBangChung_DuLieuCuTuDongChuyenHttps() {
        BangChungDongGoi bcCu = BangChungDongGoi.builder()
                .id(99)
                .donBanHang(donDuoi1Tr)
                .loaiBangChung(LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name())
                .duongDanMinio("packing-proofs/101/old.jpg")
                .trangThai(1)
                .build();
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1))
                .thenReturn(List.of(bcCu));
        when(minioService.getPublicUrl("packing-proofs/101/old.jpg"))
                .thenReturn("http://171.244.142.43:9000/fashion/packing-proofs/101/old.jpg");

        ThongTinBangChungDonDto res = bangChungDongGoiService.layThongTinBangChung(101);

        assertNotNull(res);
        assertEquals(1, res.getDanhSachBangChung().size());
        assertEquals("https://minio.slmglobal.vn/fashion/packing-proofs/101/old.jpg",
                res.getDanhSachBangChung().get(0).getUrlPublic());
    }
}
