package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ThongTinCongTyRequest;
import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.services.MinioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * ThongTinCongTyService: đọc hồ sơ (không còn mặc định "FCentric" / logo phần mềm), cập nhật theo thẻ
 * (null = giữ nguyên, chuỗi trắng = xóa, tên và tên đăng ký trắng thì lỗi, chưa có hồ sơ thì phải lưu tên trước),
 * chuẩn hóa mã số thuế, tải logo (chỉ PNG/JPEG theo byte đầu, tối đa 2 MB, phải có hồ sơ trước).
 * Mock hoàn toàn repository/storage — không đụng DB hay MinIO thật.
 */
@ExtendWith(MockitoExtension.class)
class ThongTinCongTyServiceTest {

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);

    @Mock
    private ThongTinCongTyRepository repository;
    @Mock
    private MinioService minioService;
    @Mock
    private TepTinService tepTinService;

    private ThongTinCongTyService service;

    @BeforeEach
    void setUp() {
        service = new ThongTinCongTyService();
        ReflectionTestUtils.setField(service, "thongTinCongTyRepository", repository);
        ReflectionTestUtils.setField(service, "minioService", minioService);
        ReflectionTestUtils.setField(service, "tepTinService", tepTinService);
    }

    /** Hồ sơ đã nhập đủ phần Pháp lý và liên hệ. */
    private static ThongTinCongTy hoSoDayDu() {
        return ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("Thời trang Linh Lan")
                .tenDangKyKinhDoanh("Công ty TNHH Thời trang Linh Lan")
                .maSoThue("0109123456")
                .email("lienhe@linhlan.vn")
                .soDienThoai("02439998888")
                .diaChi("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội")
                .version(1)
                .build();
    }

    private void coHoSo(ThongTinCongTy entity) {
        when(repository.findById(1)).thenReturn(Optional.ofNullable(entity));
    }

    private void luuTraVeChinhNo() {
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private CommonException loiKhiLuu(ThongTinCongTyRequest req) {
        CommonException e = assertThrows(CommonException.class, () -> service.updateProfile(req));
        verify(repository, never()).save(any());
        return e;
    }

    // ── Đọc hồ sơ ────────────────────────────────────────────────────────────────

    @Test
    void getProfile_uuTienTepTin_doiOriginLegacySangHttps() {
        coHoSo(ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/company/logo.png")
                        .build())
                .logoDuongDan("http://cu.example.com/old.png")
                .build());

        ThongTinCongTyDto dto = service.getProfile();

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo.png", dto.getLogoAsset());
    }

    @Test
    void getProfile_fallbackLogoDuongDanCu_cungDuocChuanHoa() {
        coHoSo(ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .logoDuongDan("http://171.244.142.43:9000/fashion/company/legacy.png")
                .build());

        assertEquals("https://minio.slmglobal.vn/fashion/company/legacy.png",
                service.getProfile().getLogoAsset());
    }

    @Test
    void getProfile_khongCoLogo_logoNull_khongDungLogoPhanMem() {
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy("Thời trang Linh Lan").build());

        assertNull(service.getProfile().getLogoAsset());
    }

    @Test
    void getProfile_traDuTenDangKyKinhDoanh() {
        coHoSo(hoSoDayDu());

        ThongTinCongTyDto dto = service.getProfile();

        assertEquals("Thời trang Linh Lan", dto.getName());
        assertEquals("Công ty TNHH Thời trang Linh Lan", dto.getLegalName());
        assertEquals("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội", dto.getAddress());
    }

    @Test
    void getProfile_chuaCoDong_traDoiTuongId1Version1_khongTuDatFCentric() {
        when(repository.findById(1)).thenReturn(Optional.empty());

        ThongTinCongTyDto dto = service.getProfile();

        assertNotNull(dto);
        assertEquals(1, dto.getId());
        assertEquals(1, dto.getVersion());
        assertNull(dto.getName());
        assertNull(dto.getLegalName());
        assertNull(dto.getTaxCode());
        assertNull(dto.getLogoAsset());
        assertNull(dto.getAddress());
        assertNull(dto.getEmail());
        assertNull(dto.getPhone());
        assertNull(dto.getNgayCapNhat());
    }

    @Test
    void cauLoi_dungChuDemo_khongChuaChuBiKhoa() {
        // Giao diện hiện nguyên văn câu máy chủ (demo-cua-hang/Main.dc.html, soát chéo 3.4)
        assertEquals("Nhập tên cửa hàng.", ThongTinCongTyService.LOI_THIEU_TEN);
        assertEquals("Nhập tên đăng ký kinh doanh.", ThongTinCongTyService.LOI_THIEU_TEN_DANG_KY);
        assertEquals("Lưu tên cửa hàng trước.", ThongTinCongTyService.LOI_CHUA_CO_TEN);
        assertEquals("Tên cửa hàng tối đa 255 ký tự.", ThongTinCongTyService.LOI_TEN_QUA_DAI);
        assertEquals("Tên đăng ký kinh doanh tối đa 255 ký tự.", ThongTinCongTyService.LOI_TEN_DANG_KY_QUA_DAI);
        assertEquals("Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số.", ThongTinCongTyService.LOI_MA_SO_THUE);
        assertEquals("Email không hợp lệ.", ThongTinCongTyService.LOI_EMAIL);
        assertEquals("Số điện thoại không hợp lệ.", ThongTinCongTyService.LOI_DIEN_THOAI);
        assertEquals("Chỉ nhận ảnh PNG hoặc JPG.", ThongTinCongTyService.LOI_LOGO_SAI_LOAI);
        assertEquals("Ảnh lớn hơn 2 MB.", ThongTinCongTyService.LOI_LOGO_QUA_LON);
        assertEquals("Lưu tên cửa hàng trước khi tải logo.", ThongTinCongTyService.LOI_LOGO_CHUA_CO_HO_SO);
        for (String cau : new String[]{ThongTinCongTyService.LOI_THIEU_TEN, ThongTinCongTyService.LOI_THIEU_TEN_DANG_KY,
                ThongTinCongTyService.LOI_CHUA_CO_TEN, ThongTinCongTyService.LOI_LOGO_CHUA_CO_HO_SO,
                ThongTinCongTyService.LOI_LOGO_TRONG, ThongTinCongTyService.LOI_LOGO_TAI_LEN}) {
            // apiClient.js đá người dùng ra trang đăng nhập khi câu lỗi chứa "bị khóa"
            assertFalse(cau.contains("bị khóa"), cau);
        }
    }

    // ── Cập nhật: thẻ Tên và logo ────────────────────────────────────────────────

    @Test
    void updateProfile_traVeLogoDaChuanHoa() {
        coHoSo(ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/company/logo.png")
                        .build())
                .build());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder().name("FCentric").build());

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo.png", dto.getLogoAsset());
    }

    @Test
    void updateProfile_theTenVaLogo_chiGuiTen_giuNguyenToanBoPhanPhapLy() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder().name("  Linh Lan Store  ").build());

        assertEquals("Linh Lan Store", dto.getName());
        assertEquals("Công ty TNHH Thời trang Linh Lan", dto.getLegalName());
        assertEquals("0109123456", dto.getTaxCode());
        assertEquals("lienhe@linhlan.vn", dto.getEmail());
        assertEquals("02439998888", dto.getPhone());
        assertEquals("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội", dto.getAddress());
    }

    @Test
    void updateProfile_cuaHangMoi_luuTenLanDau_taoHoSo() {
        when(repository.findById(1)).thenReturn(Optional.empty());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder().name("Thời trang Linh Lan").build());

        ArgumentCaptor<ThongTinCongTy> luu = ArgumentCaptor.forClass(ThongTinCongTy.class);
        verify(repository).save(luu.capture());
        assertEquals(1, luu.getValue().getId());
        assertEquals(1, luu.getValue().getVersion());
        assertNotNull(luu.getValue().getNgayCapNhat());
        assertEquals("Thời trang Linh Lan", dto.getName());
        assertNull(dto.getLegalName());
    }

    @Test
    void updateProfile_tenTrang_baoLoi() {
        CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder().name("   ").build());
        assertEquals(ThongTinCongTyService.LOI_THIEU_TEN, e.getMessage());
    }

    @Test
    void updateProfile_tenQua255KyTu_baoLoi() {
        CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder().name("a".repeat(256)).build());
        assertEquals(ThongTinCongTyService.LOI_TEN_QUA_DAI, e.getMessage());
    }

    @Test
    void updateProfile_ten255KyTu_hopLe() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        assertEquals(255, service.updateProfile(ThongTinCongTyRequest.builder().name("a".repeat(255)).build())
                .getName().length());
    }

    // ── Cập nhật: thẻ Pháp lý và liên hệ ─────────────────────────────────────────

    @Test
    void updateProfile_thePhapLy_khongGuiTen_giuTenCuaHang() {
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy("FCentric").maSoThue("040204000494").build());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .legalName(" Hộ kinh doanh Nguyễn Văn A ")
                .taxCode("040204000494")
                .address(" 12 Lê Lợi, phường Bến Thành, TP Hồ Chí Minh ")
                .phone("02873009999")
                .email("contact@example.vn")
                .build());

        assertEquals("FCentric", dto.getName());
        assertEquals("Hộ kinh doanh Nguyễn Văn A", dto.getLegalName());
        assertEquals("12 Lê Lợi, phường Bến Thành, TP Hồ Chí Minh", dto.getAddress());
        assertEquals("02873009999", dto.getPhone());
        assertEquals("contact@example.vn", dto.getEmail());
    }

    @Test
    void updateProfile_tenDangKyChuoiTrang_baoLoiVaKhongLuu() {
        coHoSo(hoSoDayDu());

        CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder().legalName("   ").address("Hà Nội").build());

        assertEquals(ThongTinCongTyService.LOI_THIEU_TEN_DANG_KY, e.getMessage());
    }

    @Test
    void updateProfile_tenDangKyQua255KyTu_baoLoi() {
        coHoSo(hoSoDayDu());

        CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder().legalName("b".repeat(256)).address("Hà Nội").build());

        assertEquals(ThongTinCongTyService.LOI_TEN_DANG_KY_QUA_DAI, e.getMessage());
    }

    @Test
    void updateProfile_diaChiChuoiTrang_xoaDiaChi() {
        // Soát chéo 3.4: chuỗi trắng ở address = xóa (bắt buộc địa chỉ nằm ở giao diện và ở bước gửi yêu cầu báo giá)
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .legalName("Công ty TNHH Thời trang Linh Lan").address("  ").build());

        assertNull(dto.getAddress());
        assertEquals("Công ty TNHH Thời trang Linh Lan", dto.getLegalName());
    }

    @Test
    void updateProfile_thePhapLy_chuaCoDiaChi_khongGuiDiaChi_vanLuu() {
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy("FCentric").build());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .legalName("Công ty TNHH Thời trang Linh Lan").taxCode("0109123456").build());

        assertEquals("Công ty TNHH Thời trang Linh Lan", dto.getLegalName());
        assertEquals("0109123456", dto.getTaxCode());
        assertNull(dto.getAddress());
    }

    @Test
    void updateProfile_giaoDienCu_khongGuiTenDangKy_giuNullVaLuuPhanConLai() {
        // Client cũ gửi name + taxCode/email/phone/address (không có legalName): legalName null = giữ nguyên
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy("FCentric").maSoThue("040204000494").email("a@b.vn").build());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .name("FCentric").taxCode("").email("").phone("").address("Hà Nội").build());

        assertNull(dto.getLegalName());
        assertNull(dto.getTaxCode());
        assertNull(dto.getEmail());
        assertNull(dto.getPhone());
        assertEquals("Hà Nội", dto.getAddress());
    }

    @Test
    void updateProfile_giaoDienCu_khongGuiTenDangKy_daCo_giuNguyen() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .name("Thời trang Linh Lan").taxCode("0109123456").email("lienhe@linhlan.vn")
                .phone("02439998888").address("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội").build());

        assertEquals("Công ty TNHH Thời trang Linh Lan", dto.getLegalName());
    }

    @Test
    void updateProfile_chuaCoHoSo_khongGuiTen_baoLuuTenTruoc() {
        when(repository.findById(1)).thenReturn(Optional.empty());

        CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder()
                .legalName("Công ty TNHH Thời trang Linh Lan").address("Hà Nội").build());

        assertEquals(ThongTinCongTyService.LOI_CHUA_CO_TEN, e.getMessage());
    }

    @Test
    void updateProfile_hopThoaiSuaNhanh_guiDu6O_cuaHangMoi_taoHoSo() {
        when(repository.findById(1)).thenReturn(Optional.empty());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .name("Thời trang Linh Lan")
                .legalName("Công ty TNHH Thời trang Linh Lan")
                .taxCode("0109.123.456")
                .address("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội")
                .email("")
                .phone("")
                .build());

        assertEquals("Thời trang Linh Lan", dto.getName());
        assertEquals("0109123456", dto.getTaxCode());
        assertNull(dto.getEmail());
        assertNull(dto.getPhone());
    }

    @Test
    void updateProfile_emailVaDienThoaiChuoiTrang_xoaGiaTriDaLuu() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder()
                .legalName("Công ty TNHH Thời trang Linh Lan").email("  ").phone("").build());

        assertNull(dto.getEmail());
        assertNull(dto.getPhone());
        assertEquals("0109123456", dto.getTaxCode());
        assertEquals("Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội", dto.getAddress());
    }

    @Test
    void updateProfile_emailSai_baoLoi() {
        coHoSo(hoSoDayDu());
        assertEquals(ThongTinCongTyService.LOI_EMAIL,
                loiKhiLuu(ThongTinCongTyRequest.builder().email("lienhe@linhlan").build()).getMessage());
    }

    @Test
    void updateProfile_emailQua100KyTu_baoLoi() {
        coHoSo(hoSoDayDu());
        String email = "a".repeat(95) + "@x.vn"; // 100 ký tự: hợp lệ
        luuTraVeChinhNo();
        assertEquals(email, service.updateProfile(ThongTinCongTyRequest.builder().email(email).build()).getEmail());

        reset(repository);
        coHoSo(hoSoDayDu());
        assertEquals(ThongTinCongTyService.LOI_EMAIL,
                loiKhiLuu(ThongTinCongTyRequest.builder().email("a" + email).build()).getMessage());
    }

    @Test
    void updateProfile_dienThoaiSai_baoLoi() {
        coHoSo(hoSoDayDu());
        assertEquals(ThongTinCongTyService.LOI_DIEN_THOAI,
                loiKhiLuu(ThongTinCongTyRequest.builder().phone("12").build()).getMessage());
    }

    // ── Mã số thuế ───────────────────────────────────────────────────────────────

    @Test
    void updateProfile_maSoThueSaiDinhDang_baoLoiVaKhongLuu() {
        for (String sai : new String[]{"12345", "01091234567", "0109123456-01", "MST0109123456", "0109123456-0012"}) {
            reset(repository);
            coHoSo(hoSoDayDu());
            CommonException e = loiKhiLuu(ThongTinCongTyRequest.builder().taxCode(sai).build());
            assertEquals(ThongTinCongTyService.LOI_MA_SO_THUE, e.getMessage(), sai);
        }
    }

    @Test
    void updateProfile_maSoThueCoChamVaKhoangTrang_luuDaChuanHoa() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        assertEquals("0109123456",
                service.updateProfile(ThongTinCongTyRequest.builder().taxCode(" 0109.123.456 ").build()).getTaxCode());
        assertEquals("0312345678-001",
                service.updateProfile(ThongTinCongTyRequest.builder().taxCode(" 0312 345 678-001 ").build()).getTaxCode());
        assertEquals("001203012345",
                service.updateProfile(ThongTinCongTyRequest.builder().taxCode("001.203.012.345").build()).getTaxCode());
    }

    @Test
    void updateProfile_khongGuiMaSoThue_giuNguyenMaDaLuu() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        ThongTinCongTyDto dto = service.updateProfile(ThongTinCongTyRequest.builder().name("Thời trang Mộc An").build());

        assertEquals("0109123456", dto.getTaxCode());
        assertEquals("Thời trang Mộc An", dto.getName());
    }

    @Test
    void updateProfile_maSoThueChuoiTrang_xoaMaDaLuu() {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();

        assertNull(service.updateProfile(ThongTinCongTyRequest.builder().taxCode("  ").build()).getTaxCode());
    }

    @Test
    void chuanHoaMaSoThue_boKhoangTrangVaDauCham() {
        assertEquals("0109123456", ThongTinCongTyService.chuanHoaMaSoThue("0109.123.456"));
        assertEquals("0109123456-001", ThongTinCongTyService.chuanHoaMaSoThue(" 0109 123 456-001 "));
        assertEquals("", ThongTinCongTyService.chuanHoaMaSoThue(" . "));
        assertNull(ThongTinCongTyService.chuanHoaMaSoThue(null));
    }

    // ── Logo ─────────────────────────────────────────────────────────────────────

    private void giaLapUpload(String objectName) throws Exception {
        when(minioService.upload(any())).thenReturn(objectName);
        when(minioService.getObjectInfo(objectName))
                .thenReturn(FileObjectInfo.builder()
                        .userMetadata(Map.of("file-extension", ".png"))
                        .build());
        // getPublicUrl trả URL legacy (đúng cấu hình MinIO đang lưu vào DB)
        when(minioService.getPublicUrl(objectName))
                .thenReturn("http://171.244.142.43:9000/" + objectName);
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void updateLogo_png_traVeLogoHttps_tuUploadMoi() throws Exception {
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy("FCentric").build());
        luuTraVeChinhNo();
        giaLapUpload("fashion/company/logo-new.png");

        ThongTinCongTyDto dto = service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", PNG));

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo-new.png", dto.getLogoAsset());
        verify(tepTinService).create(any(TepTin.class));
    }

    @Test
    void updateLogo_jpeg_nhan() throws Exception {
        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();
        giaLapUpload("fashion/company/logo.jpg");

        ThongTinCongTyDto dto = service.updateLogo(new MockMultipartFile("file", "logo.jpg", "image/jpeg", JPEG));

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo.jpg", dto.getLogoAsset());
    }

    @Test
    void updateLogo_thayLogo_xoaTepCuSauKhiGanTepMoi() throws Exception {
        ThongTinCongTy entity = hoSoDayDu();
        entity.setTepTin(TepTin.builder().id(7).duongDan("https://minio.slmglobal.vn/fashion/cu.png").build());
        coHoSo(entity);
        luuTraVeChinhNo();
        giaLapUpload("fashion/company/moi.png");

        service.updateLogo(new MockMultipartFile("file", "moi.png", "image/png", PNG));

        verify(tepTinService).hardDeleteNoMessage(7);
    }

    @Test
    void updateLogo_svg_baoLoiVaKhongTaiLen() throws Exception {
        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.svg", "image/svg+xml", SVG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_SAI_LOAI, e.getMessage());
        verify(minioService, never()).upload(any());
    }

    @Test
    void updateLogo_khaiPngNhungNoiDungKhongPhaiPng_baoLoi() throws Exception {
        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", SVG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_SAI_LOAI, e.getMessage());
        verify(minioService, never()).upload(any());
    }

    @Test
    void updateLogo_khaiJpegNhungNoiDungPng_baoLoi() throws Exception {
        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.jpg", "image/jpeg", PNG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_SAI_LOAI, e.getMessage());
        verify(minioService, never()).upload(any());
    }

    @Test
    void updateLogo_tepQuaNgan_baoLoi() throws Exception {
        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", new byte[]{(byte) 0x89, 0x50})));

        assertEquals(ThongTinCongTyService.LOI_LOGO_SAI_LOAI, e.getMessage());
    }

    @Test
    void updateLogo_lonHon2MB_baoLoi_dung2MB_nhan() throws Exception {
        byte[] qua = Arrays.copyOf(PNG, (int) ThongTinCongTyService.LOGO_TOI_DA_BYTE + 1);
        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", qua)));
        assertEquals(ThongTinCongTyService.LOI_LOGO_QUA_LON, e.getMessage());
        verify(minioService, never()).upload(any());

        coHoSo(hoSoDayDu());
        luuTraVeChinhNo();
        giaLapUpload("fashion/company/vua.png");
        byte[] vua = Arrays.copyOf(PNG, (int) ThongTinCongTyService.LOGO_TOI_DA_BYTE);
        assertNotNull(service.updateLogo(new MockMultipartFile("file", "vua.png", "image/png", vua)).getLogoAsset());
    }

    @Test
    void updateLogo_chuaCoHoSo_baoLuuTenTruoc_khongTuDatTen() throws Exception {
        when(repository.findById(1)).thenReturn(Optional.empty());

        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", PNG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_CHUA_CO_HO_SO, e.getMessage());
        verify(minioService, never()).upload(any());
        verify(repository, never()).save(any());
    }

    @Test
    void updateLogo_hoSoChuaCoTen_baoLuuTenTruoc() throws Exception {
        coHoSo(ThongTinCongTy.builder().id(1).tenCongTy(" ").build());

        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", PNG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_CHUA_CO_HO_SO, e.getMessage());
        verify(minioService, never()).upload(any());
    }

    @Test
    void updateLogo_tepRong_baoLoi() {
        MultipartFile rong = new MockMultipartFile("file", "logo.png", "image/png", new byte[0]);
        assertEquals(ThongTinCongTyService.LOI_LOGO_TRONG,
                assertThrows(CommonException.class, () -> service.updateLogo(rong)).getMessage());
        assertEquals(ThongTinCongTyService.LOI_LOGO_TRONG,
                assertThrows(CommonException.class, () -> service.updateLogo(null)).getMessage());
    }

    @Test
    void updateLogo_minioLoi_baoLoiChung() throws Exception {
        coHoSo(hoSoDayDu());
        when(minioService.upload(any())).thenThrow(new RuntimeException("mất kết nối"));

        CommonException e = assertThrows(CommonException.class,
                () -> service.updateLogo(new MockMultipartFile("file", "logo.png", "image/png", PNG)));

        assertEquals(ThongTinCongTyService.LOI_LOGO_TAI_LEN, e.getMessage());
        verify(repository, never()).save(any());
    }
}
