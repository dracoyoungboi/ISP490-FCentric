package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.dto.response.congncc.CuaHangCongDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.exception.RestControllerGlobalExceptionHandler;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.congncc.CongNhaCungCapService;
import com.dev.backend.services.impl.entities.ChiTietDonMuaHangService;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.entities.NhatKyTraHangNcc;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.services.impl.entities.ThongBaoMuaHangService;
import com.dev.backend.services.impl.entities.ThongTinCuaHangMuaHang;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.dev.backend.services.impl.entities.DonMuaHangFixture.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cổng nhà cung cấp qua HTTP (controller + CongNhaCungCapService + DonMuaHangService + bộ xử lý lỗi thật; repository,
 * email, biên bản giả): mã HTTP, error = mã, data.code, dữ liệu kèm (guiLaiSauGiay, hetHanGiay, conLaiLanThu), header
 * phiên X-Phien-Cong-Ncc, câu lỗi không có "bị khóa" / "OTP" / email người dùng gõ, phản hồi không lộ dữ liệu nội bộ.
 * Thêm xét báo giá và gửi lại yêu cầu (API nội bộ) cho cùng đơn.
 */
@ExtendWith(MockitoExtension.class)
class CongNhaCungCapFlowTest {

    private static final String CONG = "/api/v1/cong-ncc";
    private static final String NOI_BO = "/api/v1/nghiep-vu/don-mua-hang";
    private static final String EMAIL = "lan.tran@xuongmay.vn";

    @Mock
    private DonMuaHangRepository repository;
    @Mock
    private NhaCungCapRepository nhaCungCapRepository;
    @Mock
    private BienBanTraHangService bienBanTraHangService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private CalcService calcService;
    @Mock
    private EmailNghiepVuService email;
    @Mock
    private ChiTietDonMuaHangService chiTietDonMuaHangService;
    @Mock
    private ThongTinCuaHangMuaHang thongTinCuaHang;
    @Mock
    private NguoiDungService nguoiDungService;
    @Mock
    private YeuCauMuaHangService yeuCauMuaHangService;
    @Mock
    private NhatKyTraHangNcc nhatKy;

    private MockMvc mockMvc;
    private final ObjectMapper om = new ObjectMapper();
    private YeuCauMuaHang yc;
    private NhaCungCap ncc;
    private DonMuaHang don;
    private final List<String> cauLoi = new ArrayList<>();

    @BeforeEach
    void setUp() {
        xoaBoNho();
        DonMuaHangService service = new DonMuaHangService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "calcService", calcService);
        ReflectionTestUtils.setField(service, "emailNghiepVuService", email);
        ReflectionTestUtils.setField(service, "chiTietDonMuaHangService", chiTietDonMuaHangService);
        ReflectionTestUtils.setField(service, "thongTinCuaHangMuaHang", thongTinCuaHang);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "yeuCauMuaHangService", yeuCauMuaHangService);
        ReflectionTestUtils.setField(service, "thongBaoMuaHangService", mock(ThongBaoMuaHangService.class));
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", mock(LichSuThayDoiService.class));

        CongNhaCungCapService cong = new CongNhaCungCapService(nhaCungCapRepository, repository, service,
                bienBanTraHangService, email, calcService, thongTinCuaHang, nhatKy);
        NghiepVuSanPhamController noiBo = new NghiepVuSanPhamController();
        ReflectionTestUtils.setField(noiBo, "donMuaHangService", service);
        mockMvc = MockMvcBuilders.standaloneSetup(new CongNhaCungCapController(cong), noiBo)
                .setControllerAdvice(new RestControllerGlobalExceptionHandler())
                .build();

        yc = yeuCau(10, YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
        ncc = ncc(5, "Xưởng May Hoàng Anh", EMAIL);
        don = don(101, yc, ncc, 2, dong(11, "AO-TR-M", "120", "0"), dong(12, "AO-TR-L", "2", "0"));
        don.setNguoiDuyet(NguoiDung.builder().id(9).hoTen("Quản lý kho").matKhauHash("$2a$hash").build());
        DonMuaHang donKhac = don(202, yc, ncc(8, "Công ty Khác", "khac@cty.vn"), 2, dong(21, "QU-DE-30", "40", "0"));
        lenient().when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of(ncc));
        lenient().when(repository.findById(101)).thenReturn(Optional.of(don));
        lenient().when(repository.findById(202)).thenReturn(Optional.of(donKhac));
        lenient().when(repository.findById(999)).thenReturn(Optional.empty());
        lenient().when(calcService.getRandomActiveCode(6L)).thenReturn("246810");
        lenient().when(thongTinCuaHang.choCongNhaCungCap()).thenReturn(CuaHangCongDto.builder().ten("Linh Lan").build());
        lenient().when(repository.layIdYeuCau(101)).thenReturn(Optional.of(10));
        lenient().when(entityManager.find(YeuCauMuaHang.class, 10, LockModeType.PESSIMISTIC_WRITE)).thenReturn(yc);
        lenient().when(repository.findByIdForUpdate(101)).thenReturn(Optional.of(don));
        lenient().when(repository.khoaTheoYeuCau(10)).thenReturn(List.of(don));
    }

    @AfterEach
    void tearDown() {
        xoaBoNho();
        SecurityContextHolder.clear();
    }

    private static void xoaBoNho() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        GlobalCache.PHIEN_CONG_NCC.clear();
        GlobalCache.LUOT_GUI_MA_NCC.clear();
        GlobalCache.GUI_LAI_YEU_CAU.clear();
    }

    private ResultActions postJson(String path, String body) throws Exception {
        return mockMvc.perform(post(CONG + path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** Ghi lại câu lỗi để kiểm chung ở cuối mỗi test. */
    private JsonNode loi(MvcResult kq) throws Exception {
        JsonNode body = om.readTree(kq.getResponse().getContentAsString(StandardCharsets.UTF_8));
        cauLoi.add(body.path("message").asText());
        return body;
    }

    private void kiemCauLoi(String... chuNguoiDungGo) {
        for (String c : cauLoi) {
            assertFalse(c.toLowerCase().contains("bị khóa"), c);
            assertFalse(c.toLowerCase().contains("otp"), c);
            for (String go : chuNguoiDungGo) assertFalse(c.contains(go), "câu lỗi lặp lại chữ người dùng gõ: " + c);
        }
    }

    private String dangNhap() throws Exception {
        postJson("/dang-nhap/lay-ma", "{\"email\":\"" + EMAIL + "\"}").andExpect(status().isOk());
        MvcResult kq = postJson("/dang-nhap/xac-nhan", "{\"email\":\"" + EMAIL + "\",\"ma\":\"246810\"}")
                .andExpect(status().isOk()).andReturn();
        return om.readTree(kq.getResponse().getContentAsString(StandardCharsets.UTF_8)).at("/data/phien").asText();
    }

    @Test
    void layMa_xinLai429_xacNhanSai400_dung200_xemDon403Roi200_guiBaoGia200() throws Exception {
        postJson("/dang-nhap/lay-ma", "{\"email\":\"LAN.TRAN@xuongmay.vn\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hetHanGiay").value(300))
                .andExpect(jsonPath("$.data.guiLaiSauGiay").value(60));

        JsonNode b429 = loi(postJson("/dang-nhap/lay-ma", "{\"email\":\"" + EMAIL + "\"}")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("MA_CU_CON_HIEU_LUC"))
                .andExpect(jsonPath("$.data.code").value("MA_CU_CON_HIEU_LUC"))
                .andReturn());
        assertTrue(b429.at("/data/guiLaiSauGiay").asInt() > 0);
        assertTrue(b429.at("/data/hetHanGiay").asInt() > 0);

        postJson("/dang-nhap/xac-nhan", "{\"email\":\"" + EMAIL + "\",\"ma\":\"000000\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MA_SAI"))
                .andExpect(jsonPath("$.data.code").value("MA_SAI"))
                .andExpect(jsonPath("$.data.conLaiLanThu").value(4))
                .andDo(r -> loi(r));

        MvcResult xacNhan = postJson("/dang-nhap/xac-nhan", "{\"email\":\"" + EMAIL + "\",\"ma\":\"246810\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nhaCungCap.ten").value("Xưởng May Hoàng Anh"))
                .andExpect(jsonPath("$.data.nhaCungCap.email").value(EMAIL))
                .andExpect(jsonPath("$.data.cuaHang.ten").value("Linh Lan"))
                .andReturn();
        String phien = om.readTree(xacNhan.getResponse().getContentAsString(StandardCharsets.UTF_8)).at("/data/phien").asText();
        assertFalse(phien.isBlank());
        assertTrue(GlobalCache.PHIEN_CONG_NCC.containsKey(phien));

        mockMvc.perform(get(CONG + "/don-mua/101"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("PHIEN_HET_HAN"))
                .andDo(r -> loi(r));
        MvcResult xemDon = mockMvc.perform(get(CONG + "/don-mua/101").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.donMua.id").value(101))
                .andExpect(jsonPath("$.data.donMua.nguoiTao.hoTen").value("Trần Mua"))
                .andExpect(jsonPath("$.data.cuaHang.ten").value("Linh Lan"))
                .andReturn();
        String json = xemDon.getResponse().getContentAsString(StandardCharsets.UTF_8);
        for (String cam : new String[]{"nguoiDuyet", "giaVon", "giaBan", "soNganHang", "matKhau", "yeuCauMuaHang"}) {
            assertFalse(json.contains(cam), "R9: không lộ " + cam);
        }

        String baoGia = "{\"id\":101,\"ghiChu\":\"Giá gồm vận chuyển\",\"chiTietDonMuaHangBaoGias\":["
                + "{\"id\":11,\"chiTietDonMuaHangId\":11,\"donGia\":150000},{\"id\":12,\"chiTietDonMuaHangId\":12,\"donGia\":90000}]}";
        mockMvc.perform(post(CONG + "/don-mua/101/bao-gia").contentType(MediaType.APPLICATION_JSON).content(baoGia))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("PHIEN_HET_HAN"))
                .andDo(r -> loi(r));
        mockMvc.perform(post(CONG + "/don-mua/101/bao-gia").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .contentType(MediaType.APPLICATION_JSON).content(baoGia))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tongTien").value(18180000.00))
                .andExpect(jsonPath("$.data.daGuiEmailXacNhan").value(true))
                .andExpect(jsonPath("$.data.emailXacNhan").value(EMAIL));
        verify(email).guiDaNhanBaoGia(don);
        kiemCauLoi("LAN.TRAN", EMAIL);
    }

    @Test
    void emailKhongThuocNhaCungCapNao_400EmailKhongCo_khongLapLaiEmailGo() throws Exception {
        String go = "nguoi.la@khac.vn";
        loi(postJson("/dang-nhap/lay-ma", "{\"email\":\"" + go + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMAIL_KHONG_CO"))
                .andExpect(jsonPath("$.data.code").value("EMAIL_KHONG_CO"))
                .andReturn());
        loi(postJson("/dang-nhap/lay-ma", "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMAIL_KHONG_CO"))
                .andReturn());
        postJson("/dang-nhap/xac-nhan", "{\"email\":\"" + go + "\",\"ma\":\"123456\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("EMAIL_KHONG_CO"))
                .andDo(r -> loi(r));
        verifyNoInteractions(email);
        kiemCauLoi(go);
    }

    @Test
    void xemDonCuaNhaCungCapKhac_hoacKhongCo_404CungMotCau() throws Exception {
        String phien = dangNhap();
        JsonNode khac = loi(mockMvc.perform(get(CONG + "/don-mua/202").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("KHONG_TIM_THAY"))
                .andReturn());
        JsonNode khongCo = loi(mockMvc.perform(get(CONG + "/don-mua/999").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.data.code").value("KHONG_TIM_THAY"))
                .andReturn());
        assertEquals(khac.path("message").asText(), khongCo.path("message").asText());
        mockMvc.perform(post(CONG + "/don-mua/202/bao-gia").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chiTietDonMuaHangBaoGias\":[{\"chiTietDonMuaHangId\":21,\"donGia\":1000}]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("KHONG_TIM_THAY"))
                .andDo(r -> loi(r));
        verify(repository, never()).save(any());
        kiemCauLoi("202", "999");
    }

    @Test
    void doiEmailNhaCungCap_phienCu403() throws Exception {
        String phien = dangNhap();
        when(nhaCungCapRepository.timTheoEmail(EMAIL)).thenReturn(List.of());
        mockMvc.perform(get(CONG + "/viec-can-lam").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("PHIEN_HET_HAN"))
                .andDo(r -> loi(r));
        assertFalse(GlobalCache.PHIEN_CONG_NCC.containsKey(phien));
        kiemCauLoi();
    }

    @Test
    void dangXuat_200_sauDoPhien403() throws Exception {
        String phien = dangNhap();
        mockMvc.perform(get(CONG + "/viec-can-lam").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nhaCungCap.ten").value("Xưởng May Hoàng Anh"))
                .andExpect(jsonPath("$.data.bienBanCho").isArray())
                .andExpect(jsonPath("$.data.donChoBaoGia").isArray())
                .andExpect(jsonPath("$.data.soLieu30Ngay.baoGiaDaGui").value(0));
        mockMvc.perform(post(CONG + "/dang-xuat").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isOk());
        mockMvc.perform(post(CONG + "/dang-xuat")).andExpect(status().isOk());
        mockMvc.perform(get(CONG + "/viec-can-lam").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("PHIEN_HET_HAN"))
                .andDo(r -> loi(r));
        kiemCauLoi();
    }

    @Test
    void lichSu_nhanTuNgayVaTuKhoa_ngaySaiDinhDang400() throws Exception {
        String phien = dangNhap();
        when(repository.choCongNhaCungCap(Set.of(5))).thenReturn(List.of(don));
        don.setNgayGuiYeuCau(Instant.now());
        mockMvc.perform(get(CONG + "/lich-su/bao-gia").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .param("tuNgay", LocalDate.now().minusMonths(1).toString()).param("tuKhoa", "po2026102200101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(101))
                .andExpect(jsonPath("$.data.items[0].ketQua").value("CHO_BAO_GIA"))
                .andExpect(jsonPath("$.data.tomTat.choBaoGia").value(1));
        mockMvc.perform(get(CONG + "/lich-su/tra-hang").header(CongNhaCungCapController.HEADER_PHIEN, phien))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tomTat.bienBan").value(0));
        verify(bienBanTraHangService).dsChoCong(Set.of(5));
        mockMvc.perform(get(CONG + "/lich-su/bao-gia").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .param("tuNgay", "23/11/2026"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void traLoiBienBan_guiPhienBanTrongThan_traBienBanMoi() throws Exception {
        String phien = dangNhap();
        when(nhatKy.idLapCuoi(12)).thenReturn(7012);
        when(bienBanTraHangService.traLoiTuCong(12, Set.of(5), 7012, null, "TRU_CONG_NO", "TIEU_HUY", "Trần Thị Thu Hà",
                null, false))
                .thenReturn(BienBanTraHangDto.builder().id(12).soBienBan("RTV-20261123-003").phuongAn("TRU_CONG_NO")
                        .trangThai("CHO_TRA_HANG").phieuDaNhap(false).nguonChot("CONG_NCC")
                        .nguoiXacNhanNcc("Trần Thị Thu Hà").hangLoiNcc("TIEU_HUY").nguoiChonHangLoi("Trần Thị Thu Hà")
                        .choNccChonCachBu(false).choNccChonHangLoi(false)
                        .cachBuMo(java.util.List.of("DOI_HANG", "TRU_CONG_NO")).hangLoiMo(java.util.List.of("NHAN_LAI", "TIEU_HUY"))
                        .hanTraLoi(java.time.Instant.parse("2026-11-30T16:59:59Z"))
                        .giaTriLoi(new java.math.BigDecimal("1820000")).tienTruTien(java.math.BigDecimal.ZERO).build());
        mockMvc.perform(post(CONG + "/bien-ban/12/xac-nhan").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phuongAn\":\"TRU_CONG_NO\",\"hangLoi\":\"TIEU_HUY\",\"nguoiXacNhan\":\"Trần Thị Thu Hà\","
                                + "\"phienBan\":7012}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.trangThai").value("DA_XAC_NHAN"))
                .andExpect(jsonPath("$.data.cachBuMo[0]").value("DOI_HANG"))
                .andExpect(jsonPath("$.data.hangLoiMo[1]").value("TIEU_HUY"))
                .andExpect(jsonPath("$.data.cachBuDaChon.giaTri").value("TRU_CONG_NO"))
                .andExpect(jsonPath("$.data.cachBuDaChon.nguoiXacNhan").value("Trần Thị Thu Hà"))
                .andExpect(jsonPath("$.data.hangLoiDaChon.giaTri").value("TIEU_HUY"))
                .andExpect(jsonPath("$.data.hanTraLoi").exists())
                .andExpect(jsonPath("$.data.phienBan").value(7012))
                .andExpect(jsonPath("$.data.tienTru").value(1820000));
        mockMvc.perform(post(CONG + "/bien-ban/12/xac-nhan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phuongAn\":\"DOI_HANG\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("PHIEN_HET_HAN"));
        verify(bienBanTraHangService, times(1)).traLoiTuCong(any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean());
    }

    @Test
    void traLoiBienBan_theoTungDong_camKet_truyenDungLuaChonTungDong() throws Exception {
        String phien = dangNhap();
        when(nhatKy.idLapCuoi(12)).thenReturn(7012);
        java.util.List<com.dev.backend.services.BienBanTraHangService.LuaChonDong> theoDong = java.util.List.of(
                new com.dev.backend.services.BienBanTraHangService.LuaChonDong(301, "TRU_CONG_NO", "NHAN_LAI"),
                new com.dev.backend.services.BienBanTraHangService.LuaChonDong(302, "DOI_HANG", "TIEU_HUY"));
        when(bienBanTraHangService.traLoiTuCong(12, Set.of(5), 7012, theoDong, null, null, "Trần Thị Thu Hà", null, true))
                .thenReturn(BienBanTraHangDto.builder().id(12).soBienBan("RTV-20261123-003").phuongAn("HON_HOP")
                        .trangThai("CHO_TRA_HANG").phieuDaNhap(false).nguonChot("CONG_NCC")
                        .nguoiXacNhanNcc("Trần Thị Thu Hà").choNccChonCachBu(false).choNccChonHangLoi(false)
                        .cachBuMo(java.util.List.of("DOI_HANG", "TRU_CONG_NO")).hangLoiMo(java.util.List.of("NHAN_LAI", "TIEU_HUY"))
                        .giaTriLoi(new java.math.BigDecimal("1820000")).tienTruTien(java.math.BigDecimal.ZERO)
                        .giaTriTruTien(new java.math.BigDecimal("1000000")).soLuongChoHangBu(2)
                        .items(java.util.List.of(
                                BienBanTraHangDto.ChiTietItemDto.builder().id(301).bienTheSanPhamId(901).tenBienThe("Áo sơ mi")
                                        .soLuong(2).donGia(new java.math.BigDecimal("500000")).cachBu("TRU_CONG_NO")
                                        .nguonCachBu("CONG_NCC").hangLoiNcc("NHAN_LAI").trangThaiHang("O_KHO")
                                        .cachBuMo(java.util.List.of("DOI_HANG", "TRU_CONG_NO"))
                                        .hangLoiMo(java.util.List.of("NHAN_LAI", "TIEU_HUY")).build(),
                                BienBanTraHangDto.ChiTietItemDto.builder().id(302).bienTheSanPhamId(902).tenBienThe("Áo sơ mi")
                                        .soLuong(2).donGia(new java.math.BigDecimal("410000")).cachBu("DOI_HANG")
                                        .nguonCachBu("CONG_NCC").hangLoiNcc("TIEU_HUY").trangThaiHang("O_KHO")
                                        .cachBuMo(java.util.List.of("DOI_HANG", "TRU_CONG_NO"))
                                        .hangLoiMo(java.util.List.of("NHAN_LAI", "TIEU_HUY")).build()))
                        .build());
        mockMvc.perform(post(CONG + "/bien-ban/12/xac-nhan").header(CongNhaCungCapController.HEADER_PHIEN, phien)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nguoiXacNhan\":\"Trần Thị Thu Hà\",\"phienBan\":7012,\"camKet\":true,\"dong\":["
                                + "{\"id\":301,\"phuongAn\":\"TRU_CONG_NO\",\"hangLoi\":\"NHAN_LAI\"},"
                                + "{\"id\":302,\"phuongAn\":\"DOI_HANG\",\"hangLoi\":\"TIEU_HUY\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phuongAn").value("HON_HOP"))
                .andExpect(jsonPath("$.data.dong[0].id").value(301))
                .andExpect(jsonPath("$.data.dong[0].cachBu").value("TRU_CONG_NO"))
                .andExpect(jsonPath("$.data.dong[0].hangLoi").value("NHAN_LAI"))
                .andExpect(jsonPath("$.data.dong[0].giaTri").value(1000000))
                .andExpect(jsonPath("$.data.dong[1].id").value(302))
                .andExpect(jsonPath("$.data.dong[1].cachBu").value("DOI_HANG"))
                .andExpect(jsonPath("$.data.dong[1].hangLoi").value("TIEU_HUY"))
                .andExpect(jsonPath("$.data.dong[1].cachBuMo[1]").value("TRU_CONG_NO"))
                .andExpect(jsonPath("$.data.tienTru").value(1000000))
                .andExpect(jsonPath("$.data.conChoGiao").value(2));
        verify(bienBanTraHangService).traLoiTuCong(12, Set.of(5), 7012, theoDong, null, null, "Trần Thị Thu Hà", null, true);
    }

    @Test
    void guiMaLoi_503() throws Exception {
        doThrow(new com.dev.backend.services.email.EmailKhongGuiDuocException("SMTP", null))
                .when(email).guiMaDangNhapCong(anyString(), any(), anyString(), any());
        postJson("/dang-nhap/lay-ma", "{\"email\":\"" + EMAIL + "\"}")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("CHUA_GUI_DUOC_MA"))
                .andExpect(jsonPath("$.message").value("Chưa gửi được mã xác nhận. Vui lòng thử lại sau ít phút."))
                .andDo(r -> loi(r));
        kiemCauLoi(EMAIL);
    }

    // ── API nội bộ cho cùng đơn (không thuộc cổng, giữ từ bộ test cũ) ──

    @Test
    void xetBaoGia_bodyIso_409BaoGiaDaDoi_400ThieuNgay_409YeuCauKhongConMo() throws Exception {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of("nhan_vien_mua_hang")).build());
        lenient().when(nguoiDungService.getOne(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        don.setNgayBaoGia(Instant.parse("2026-10-21T08:15:30Z"));

        mockMvc.perform(put(NOI_BO + "/duyet-don/101/3").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ngayBaoGiaDaXem\":\"2026-10-21T08:10:00Z\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("BAO_GIA_DA_DOI"))
                .andExpect(jsonPath("$.data.code").value("BAO_GIA_DA_DOI"))
                .andDo(r -> loi(r));
        mockMvc.perform(put(NOI_BO + "/duyet-don/101/4").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andDo(r -> loi(r));

        yc.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC);
        mockMvc.perform(put(NOI_BO + "/duyet-don/101/3").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ngayBaoGiaDaXem\":\"2026-10-21T08:15:30.400Z\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("YEU_CAU_KHONG_CON_MO"))
                .andDo(r -> loi(r));

        yc.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
        mockMvc.perform(put(NOI_BO + "/duyet-don/101/4").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lyDo\":\"Giá cao\",\"ngayBaoGiaDaXem\":\"2026-10-21T08:15:30.400Z\"}"))
                .andExpect(status().isOk());
        assertEquals(4, don.getTrangThai());
        assertEquals("Giá cao", don.getLyDoTuChoi());
        verify(email).guiKetQuaBaoGia(don);
        // Báo giá duy nhất của yêu cầu bị từ chối: yêu cầu về Đã duyệt để gửi nhà cung cấp khác
        assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
        kiemCauLoi("101");
    }

    @Test
    void guiLai_409CoMa_quaHttp() throws Exception {
        don.setNgayGuiYeuCau(Instant.now());
        mockMvc.perform(post(NOI_BO + "/101/gui-lai-yeu-cau"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("KHONG_GUI_LAI_DUOC"))
                .andExpect(jsonPath("$.data.code").value("KHONG_GUI_LAI_DUOC"))
                .andDo(r -> loi(r));
        don.setNgayGuiYeuCau(null);
        don.setNgayTao(Instant.now().minusSeconds(3600));
        mockMvc.perform(post(NOI_BO + "/101/gui-lai-yeu-cau"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.daDuaVaoHangDoi").value(true));
        ArgumentCaptor<DonMuaHang> gui = ArgumentCaptor.forClass(DonMuaHang.class);
        verify(email).guiYeuCauBaoGia(gui.capture(), isNull());
        assertSame(don, gui.getValue());
        kiemCauLoi("101");
    }
}
