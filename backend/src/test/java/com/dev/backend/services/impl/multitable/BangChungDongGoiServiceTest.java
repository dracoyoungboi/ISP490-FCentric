package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.LoaiBangChungDongGoi;
import com.dev.backend.dto.response.customize.ThongTinBangChungDonDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
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

    // Máy chủ nhận dạng ảnh / video theo byte đầu tệp, không theo tên tệp hay Content-Type
    private static final byte[] JPEG = coDau(100, 0xFF, 0xD8, 0xFF, 0xE0);
    private static final byte[] MP4 = coDau(1000, 0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm');
    private static final byte[] WEBM = coDau(1000, 0x1A, 0x45, 0xDF, 0xA3);

    private static byte[] coDau(int doDai, int... dau) {
        byte[] b = new byte[doDai];
        for (int i = 0; i < dau.length; i++) b[i] = (byte) dau[i];
        return b;
    }

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
        // Xem bằng chứng theo phạm vi chi tiết đơn: người kho được phân công kho xuất của đơn
        auth.setPhanQuyenNguoiDungKhos(List.of(PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(1).build()).build()));
        SecurityContextHolder.setUser(auth);
        SecurityContextHolder.setKhoId(1);

        // Đọc lại trạng thái trong CSDL lúc lưu: mặc định trùng thực thể (không ai đổi trong lúc tải tệp)
        lenient().when(bangChungDongGoiRepository.docTrangThaiDon(anyInt())).thenAnswer(inv ->
                ((Integer) inv.getArgument(0)) == 101 ? donDuoi1Tr.getTrangThai() : donTu1Tr.getTrangThai());
        lenient().when(bangChungDongGoiRepository.docTrangThaiPhieuCuaDon(anyInt())).thenAnswer(inv ->
                phieuXuatKhoRepository.findByDonBanHangId(inv.getArgument(0)).stream().map(PhieuXuatKho::getTrangThai).toList());
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

        MockMultipartFile fileAnh = new MockMultipartFile("file", "test.jpg", "image/jpeg", JPEG);

        assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, fileAnh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
    }

    @Test
    @DisplayName("TC-12: Video sai thời lượng (< 15s hoặc > 180s) khi upload bị từ chối")
    void testUploadBangChung_VideoSaiThoiLuong_NemNgoaiLe() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));

        MockMultipartFile fileVideo = new MockMultipartFile("file", "test.mp4", "video/mp4", MP4);

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

        MockMultipartFile fileVideo = new MockMultipartFile("file", "video.webm", "video/webm", WEBM);
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

        MockMultipartFile fileAnh = new MockMultipartFile("file", "test.jpg", "image/jpeg", JPEG);
        var dto = bangChungDongGoiService.uploadBangChung(101, fileAnh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null);

        assertNotNull(dto);
        assertEquals("https://minio.slmglobal.vn/fashion/packing-proofs/101/uuid.jpg", dto.getUrlPublic());
        assertEquals("https://minio.slmglobal.vn/fashion/packing-proofs/101/uuid.jpg", dto.getDuongDanMinio());
        verify(minioService, times(1)).getPublicUrl(anyString());
    }

    @Test
    @DisplayName("Tệp HTML đặt tên .webm, khai video/webm bị từ chối, không tải lên MinIO")
    void testUploadBangChung_HtmlGiaVideo_BiTuChoi() {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));
        MockMultipartFile html = new MockMultipartFile("file", "video.webm", "video/webm",
                "<html><script>alert(1)</script></html>".getBytes());

        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(102, html, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 30));
        assertTrue(loi.getMessage().contains("không phải video hợp lệ"), loi.getMessage());
        verifyNoInteractions(minioService);
    }

    @Test
    @DisplayName("Tệp SVG khai image/jpeg (đuôi .jpg) bị từ chối — trước đây lọt vì điều kiện HOẶC")
    void testUploadBangChung_SvgGiaAnh_BiTuChoi() {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        MockMultipartFile svg = new MockMultipartFile("file", "anh.jpg", "image/jpeg",
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes());

        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, svg, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        assertTrue(loi.getMessage().contains("không phải hình ảnh hợp lệ"), loi.getMessage());
        verifyNoInteractions(minioService);
    }

    @Test
    @DisplayName("Đuôi tên object lấy theo nội dung, không theo tên tệp client gửi")
    void testUploadBangChung_DuoiTheoNoiDung() throws Exception {
        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(donTu1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndLoaiBangChungAndTrangThai(eq(102), anyString(), eq(1)))
                .thenReturn(Optional.empty());
        when(minioService.upload(any(), anyString())).thenAnswer(inv -> inv.getArgument(1));
        when(minioService.getPublicUrl(anyString())).thenAnswer(inv -> "http://minio/fashion/" + inv.getArgument(0));
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bangChungDongGoiRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile tep = new MockMultipartFile("file", "../../x.html", "text/html", WEBM);
        bangChungDongGoiService.uploadBangChung(102, tep, LoaiBangChungDongGoi.VIDEO_DONG_GOI.name(), 30);

        verify(minioService).upload(eq(tep), matches("packing-proofs/102/[0-9a-f-]{36}\\.webm"));
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

    // ── Xem lại sau khi đơn đã đi: quyền xem, ngày tự xóa, khóa thêm / thay / xóa ─────────────────────────────

    private static final int DON_CHO_NHAT = 1, DON_DANG_XUAT = 2, DON_DA_XUAT = 3, DON_HUY = 4, DON_HOAN_THANH = 5,
            DON_CHO_DONG_GOI = 7, DON_DA_DONG_GOI = 8;
    private static final int PX_NHAP = 0, PX_DA_XUAT = 3, PX_CHO_XUAT = 6;

    private static PhieuXuatKho phieu(int id, int trangThai) {
        return PhieuXuatKho.builder().id(id).soPhieuXuat("PX-" + id).trangThai(trangThai).build();
    }

    private void dangNhapBanHang(int id) {
        NguoiDungAuthInfo auth = new NguoiDungAuthInfo();
        auth.setId(id);
        auth.setTenDangNhap("nvban");
        auth.setVaiTro(Set.of("nhan_vien_ban_hang"));
        SecurityContextHolder.setUser(auth);
        SecurityContextHolder.setKhoId(null);
    }

    @Test
    @DisplayName("Nhân viên bán hàng xem được bằng chứng đơn mình tạo, không cần kho đang chọn")
    void xem_BanHang_DonMinhTao_DuocXem() {
        dangNhapBanHang(7);
        donDuoi1Tr.setNguoiTao(NguoiDung.builder().id(7).build());
        donDuoi1Tr.setTrangThai(DON_DA_XUAT);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));

        assertNotNull(bangChungDongGoiService.layThongTinBangChung(101));
    }

    @Test
    @DisplayName("Nhân viên bán hàng xem đơn người khác tạo: 403, cùng phạm vi chi tiết đơn")
    void xem_BanHang_DonNguoiKhac_403() {
        dangNhapBanHang(7);
        donDuoi1Tr.setNguoiTao(NguoiDung.builder().id(8).build());
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));

        CommonException loi = assertThrows(CommonException.class, () -> bangChungDongGoiService.layThongTinBangChung(101));
        assertEquals(403, loi.getStatus().value());
        verifyNoInteractions(bangChungDongGoiRepository);
    }

    @Test
    @DisplayName("Người kho không được phân công kho xuất của đơn: 403 dù gửi kho đang chọn trùng (header không được tin)")
    void xem_NguoiKhoKhacKho_403() {
        SecurityContextHolder.getUser().setPhanQuyenNguoiDungKhos(
                List.of(PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(2).build()).build()));
        SecurityContextHolder.setKhoId(1);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));

        CommonException loi = assertThrows(CommonException.class, () -> bangChungDongGoiService.layThongTinBangChung(101));
        assertEquals(403, loi.getStatus().value());
    }

    @Test
    @DisplayName("Hết tệp sau hạn lưu: ngayTuXoa = hạn muộn nhất của tệp đã gắn phiếu đóng gói xong")
    void xem_HetHan_TraNgayTuXoa() {
        Instant hanCu = Instant.now().minusSeconds(40L * 86400);
        Instant hanCuoi = Instant.now().minusSeconds(5L * 86400);
        Instant hanTuongLai = Instant.now().plusSeconds(5L * 86400);
        PhieuXuatKho daXuat = phieu(51, PX_DA_XUAT);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThai(101, 0)).thenReturn(List.of(
                BangChungDongGoi.builder().phieuXuatKho(daXuat).ngayHetHan(hanCu).build(),        // bị thay lúc đóng gói
                BangChungDongGoi.builder().phieuXuatKho(daXuat).ngayHetHan(hanCuoi).build(),      // tệp cuối, đã dọn
                BangChungDongGoi.builder().phieuXuatKho(phieu(52, PX_NHAP)).ngayHetHan(hanCuoi.plusSeconds(60)).build(),
                BangChungDongGoi.builder().phieuXuatKho(daXuat).ngayHetHan(hanTuongLai).build(),  // xóa tay, chưa tới hạn
                BangChungDongGoi.builder().ngayHetHan(hanCuoi.plusSeconds(120)).build()));        // chưa gắn phiếu

        assertEquals(hanCuoi, bangChungDongGoiService.layThongTinBangChung(101).getNgayTuXoa());
    }

    @Test
    @DisplayName("Đơn chưa từng có bằng chứng (xuất trước khi có bước đóng gói), hoặc còn tệp: ngayTuXoa null")
    void xem_KhongCoTepDaDon_NgayTuXoaNull() {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        assertNull(bangChungDongGoiService.layThongTinBangChung(101).getNgayTuXoa());

        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1))
                .thenReturn(List.of(BangChungDongGoi.builder().loaiBangChung("ANH_HANG_TRONG_HOP").trangThai(1).build()));
        assertNull(bangChungDongGoiService.layThongTinBangChung(101).getNgayTuXoa());
        verify(bangChungDongGoiRepository, times(1)).findByDonBanHangIdAndTrangThai(101, 0);
    }

    @Test
    @DisplayName("Đơn đã qua bước đóng gói (Chờ xuất kho, Đã xuất, Hoàn thành): tải lên bị chặn 409, không chạm MinIO")
    void taiLen_DonQuaDongGoi_409() {
        for (int tt : new int[]{DON_DA_DONG_GOI, DON_DA_XUAT, DON_HOAN_THANH, 6, 0}) {
            donDuoi1Tr.setTrangThai(tt);
            when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
            MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
            CommonException loi = assertThrows(CommonException.class, () ->
                    bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null), "trạng thái " + tt);
            assertEquals(409, loi.getStatus().value(), "trạng thái " + tt);
            assertTrue(loi.getMessage().contains("chỉ được xem"), loi.getMessage());
        }
        verifyNoInteractions(minioService);
    }

    @Test
    @DisplayName("Đã xuất một phần: còn phiếu nháp đang đóng gói thì tải được, không còn thì 409")
    void taiLen_XuatMotPhan_TheoPhieuNhap() throws Exception {
        donDuoi1Tr.setTrangThai(DON_DANG_XUAT);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(phieuXuatKhoRepository.findByDonBanHangId(101)).thenReturn(List.of(phieu(51, PX_DA_XUAT)));
        MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);

        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        assertEquals(409, loi.getStatus().value());
        verifyNoInteractions(minioService);

        when(phieuXuatKhoRepository.findByDonBanHangId(101)).thenReturn(List.of(phieu(51, PX_DA_XUAT), phieu(52, PX_NHAP)));
        when(minioService.getPublicUrl(anyString())).thenReturn("http://minio/fashion/x.jpg");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bangChungDongGoiRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertNotNull(bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
    }

    @Test
    @DisplayName("Tệp cũ cùng loại đã dùng hoàn tất phiếu xuất (Chờ xuất): không thay được, tệp cũ còn nguyên")
    void taiLen_ThayTepDaHoanTat_409() {
        donDuoi1Tr.setTrangThai(DON_DANG_XUAT);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(phieuXuatKhoRepository.findByDonBanHangId(101)).thenReturn(List.of(phieu(51, PX_CHO_XUAT), phieu(52, PX_NHAP)));
        BangChungDongGoi cu = BangChungDongGoi.builder().id(9).phieuXuatKho(phieu(51, PX_CHO_XUAT))
                .loaiBangChung(LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name()).trangThai(1).build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndLoaiBangChungAndTrangThai(101, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), 1))
                .thenReturn(Optional.of(cu));

        MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        assertEquals(409, loi.getStatus().value());
        assertTrue(loi.getMessage().contains("PX-51"), loi.getMessage());
        verifyNoInteractions(minioService, tepTinService);
        verify(bangChungDongGoiRepository, never()).save(any());
        assertEquals(1, cu.getTrangThai());
    }

    @Test
    @DisplayName("Đơn được đóng gói xong trong lúc đang tải tệp: lưu bị chặn 409 và tệp vừa tải lên MinIO bị xóa")
    void taiLen_DongGoiXongLucDangTai_XoaTepMoi() throws Exception {
        // Như máy thật (open-in-view): thực thể trong phiên vẫn Chờ nhặt, chỉ CSDL đã sang Chờ xuất kho
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.docTrangThaiDon(101)).thenReturn(DON_DA_DONG_GOI);
        when(minioService.getPublicUrl(anyString())).thenReturn("http://minio/fashion/x.jpg");

        MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        assertEquals(409, loi.getStatus().value());
        verify(minioService).upload(eq(anh), matches("packing-proofs/101/.*\\.jpg"));
        verify(minioService).delete(matches("packing-proofs/101/.*\\.jpg"));
        verify(bangChungDongGoiRepository, never()).save(any());
        assertEquals(1, donDuoi1Tr.getTrangThai(), "thực thể trong phiên vẫn cũ — chặn được là nhờ đọc CSDL");
    }

    @Test
    @DisplayName("Tệp cũ được gắn phiếu vừa hoàn tất trong lúc đang tải: thay bị chặn 409, tệp cũ còn, tệp mới bị xóa")
    void taiLen_TepCuVuaHoanTatLucDangTai_409() throws Exception {
        donDuoi1Tr.setTrangThai(DON_CHO_DONG_GOI);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        // Thực thể trong phiên: tệp cũ chưa gắn phiếu; CSDL: đã gắn phiếu Chờ xuất (hoanTat commit lúc đang tải)
        BangChungDongGoi cu = BangChungDongGoi.builder().id(9).loaiBangChung(LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name())
                .tepTin(TepTin.builder().id(70).tenLuuTru("packing-proofs/101/cu.jpg").build()).trangThai(1).build();
        when(bangChungDongGoiRepository.findByDonBanHangIdAndLoaiBangChungAndTrangThai(101, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), 1))
                .thenReturn(Optional.of(cu));
        when(bangChungDongGoiRepository.docTrangThaiPhieuCuaBangChung(9)).thenReturn(PX_CHO_XUAT);
        when(minioService.getPublicUrl(anyString())).thenReturn("http://minio/fashion/x.jpg");

        MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
        CommonException loi = assertThrows(CommonException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        assertEquals(409, loi.getStatus().value());
        verify(minioService, never()).delete("packing-proofs/101/cu.jpg");
        verify(minioService).delete(matches("packing-proofs/101/[0-9a-f-]{36}\\.jpg"));
        verify(tepTinService, never()).hardDeleteNoMessage(any());
        assertEquals(1, cu.getTrangThai());
    }

    @Test
    @DisplayName("Lỗi CSDL lúc lưu (không phải CommonException): tệp vừa tải lên MinIO vẫn được dọn")
    void taiLen_LoiCsdlLucLuu_DonTepMoi() throws Exception {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(minioService.getPublicUrl(anyString())).thenReturn("http://minio/fashion/x.jpg");
        when(tepTinService.create(any(TepTin.class))).thenThrow(new org.springframework.dao.DataIntegrityViolationException("hỏng"));

        MockMultipartFile anh = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () ->
                bangChungDongGoiService.uploadBangChung(101, anh, LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null));
        verify(minioService).delete(matches("packing-proofs/101/.*\\.jpg"));
    }

    @Test
    @DisplayName("ngayTuXoa: bản ghi cũ thiếu hạn thì tính ngày tạo + 90 ngày")
    void xem_HetHan_ThieuNgayHetHan_TinhTheoNgayTao() {
        Instant tao = Instant.now().minusSeconds(100L * 86400);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThai(101, 0)).thenReturn(List.of(
                BangChungDongGoi.builder().phieuXuatKho(phieu(51, PX_DA_XUAT)).ngayTao(tao).build()));

        assertEquals(tao.plusSeconds(90L * 86400), bangChungDongGoiService.layThongTinBangChung(101).getNgayTuXoa());
    }

    @Test
    @DisplayName("Hạn lưu thật = muộn hơn trong hạn đã ghi và ngày tạo + 90: tệp cũ hạn 30 ngày được giữ đủ 90 không cần sửa CSDL")
    void hanLuuThucTe_tepCuVaTepDaGiaHan() {
        Instant tao = Instant.parse("2026-10-20T03:00:00Z");
        BangChungDongGoi cu = BangChungDongGoi.builder().ngayTao(tao).ngayHetHan(tao.plusSeconds(30L * 86400)).build();
        assertEquals(tao.plusSeconds(90L * 86400), BangChungDongGoiServiceImpl.hanLuuThucTe(cu));

        BangChungDongGoi daGiaHan = BangChungDongGoi.builder().ngayTao(tao).ngayHetHan(tao.plusSeconds(120L * 86400)).build();
        assertEquals(tao.plusSeconds(120L * 86400), BangChungDongGoiServiceImpl.hanLuuThucTe(daGiaHan));

        assertEquals(tao.plusSeconds(90L * 86400), BangChungDongGoiServiceImpl.hanLuuThucTe(BangChungDongGoi.builder().ngayTao(tao).build()));

        // Màn hình nhận hạn thật, không phải hạn + 30 còn ghi trong CSDL
        cu.setId(5);
        cu.setLoaiBangChung(LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name());
        cu.setTrangThai(1);
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(bangChungDongGoiRepository.findByDonBanHangIdAndTrangThaiOrderByNgayTaoAsc(101, 1)).thenReturn(List.of(cu));
        assertEquals(tao.plusSeconds(90L * 86400), bangChungDongGoiService.layThongTinBangChung(101).getDanhSachBangChung().get(0).getNgayHetHan());
    }

    @Test
    @DisplayName("Hạn lưu: tải lên = hôm nay + 90 ngày; gia hạn = mốc (ngày xuất kho / hoàn trả) + 90 ngày")
    void hanLuu_90NgayVaGiaHanTheoMoc() throws Exception {
        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(donDuoi1Tr));
        when(minioService.getPublicUrl(anyString())).thenReturn("http://minio/fashion/x.jpg");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bangChungDongGoiRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Instant truoc = Instant.now();
        var dto = bangChungDongGoiService.uploadBangChung(101,
                new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG), LoaiBangChungDongGoi.ANH_HANG_TRONG_HOP.name(), null);
        long ngay = java.time.Duration.between(truoc, dto.getNgayHetHan()).toDays();
        assertTrue(ngay >= 89 && ngay <= 90, "hạn lúc tải lên ≈ 90 ngày, thực tế " + ngay);

        Instant xuat = Instant.parse("2026-10-28T03:00:00Z");
        bangChungDongGoiService.giaHanLuuTu(101, xuat);
        verify(bangChungDongGoiRepository).keoDaiHanLuu(101, xuat.plusSeconds(90L * 86400));

        bangChungDongGoiService.giaHanLuuTu(null, xuat);
        verify(bangChungDongGoiRepository, times(1)).keoDaiHanLuu(anyInt(), any());
    }

    @Test
    @DisplayName("Xóa bằng chứng khi đơn đã xuất / đã hủy: 409; phiếu đã đóng gói xong: 409; đang chờ đóng gói: xóa được")
    void xoa_TheoTrangThai() throws Exception {
        BangChungDongGoi bc = BangChungDongGoi.builder().id(5).donBanHang(donDuoi1Tr).trangThai(1).build();
        when(bangChungDongGoiRepository.findById(5)).thenReturn(Optional.of(bc));

        for (int tt : new int[]{DON_DA_XUAT, DON_HUY, DON_DA_DONG_GOI}) {
            donDuoi1Tr.setTrangThai(tt);
            CommonException loi = assertThrows(CommonException.class, () -> bangChungDongGoiService.xoaBangChung(5));
            assertEquals(409, loi.getStatus().value(), "trạng thái " + tt);
        }

        donDuoi1Tr.setTrangThai(DON_CHO_DONG_GOI);
        bc.setPhieuXuatKho(phieu(51, PX_CHO_XUAT));
        CommonException loi = assertThrows(CommonException.class, () -> bangChungDongGoiService.xoaBangChung(5));
        assertEquals(409, loi.getStatus().value());
        verifyNoInteractions(minioService);

        bc.setPhieuXuatKho(phieu(52, PX_NHAP));
        bangChungDongGoiService.xoaBangChung(5);
        assertEquals(0, bc.getTrangThai());

        donDuoi1Tr.setTrangThai(DON_CHO_NHAT);
        bc.setTrangThai(1);
        bangChungDongGoiService.xoaBangChung(5);
        assertEquals(0, bc.getTrangThai());
    }
}
