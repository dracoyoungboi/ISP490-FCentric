package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IPrintTemplateConfig;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.MigratePrintConfigsRequest;
import com.dev.backend.dto.request.PrintTemplateConfigRequest;
import com.dev.backend.dto.response.LichSuMauInDto;
import com.dev.backend.dto.response.PrintTemplateConfigDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.CauHinhMauIn;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.MauInDangApDung;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhMauInRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.MauInDangApDungRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.parser.PartTree;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Test cấu hình mẫu in: kiểm tra sections._tuyChinh (tiêu đề, nhãn, cỡ chữ, mã số phiếu, lời chân) và
 * lịch sử chỉnh sửa (mỗi lần lưu một phiên bản, kèm ảnh chụp cấu hình đang dùng ngay trước đó).
 * Mock hoàn toàn repository — không đụng DB. Không có giao dịch nên SauCommit chạy việc ghi lịch sử ngay
 * (trừ các ca giả lập giao dịch bằng TransactionSynchronizationManager).
 */
@ExtendWith(MockitoExtension.class)
class CauHinhMauInServiceTest {

    private static final String LOAI = "goods_receipt";
    private static final String MAU_A4 = "goods_receipt_default_A4";
    private static final String KHO_KHONG_CON_DUNG =
            "Khổ giấy này không còn dùng cho loại chứng từ này. Tải lại trang rồi thử lại.";

    @Mock
    private CauHinhMauInRepository cauHinhMauInRepository;
    @Mock
    private MauInDangApDungRepository mauInDangApDungRepository;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private LichSuThayDoiRepository lichSuThayDoiRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;

    private CauHinhMauInService service;

    @BeforeEach
    void setUp() {
        service = new CauHinhMauInService();
        ReflectionTestUtils.setField(service, "cauHinhMauInRepository", cauHinhMauInRepository);
        ReflectionTestUtils.setField(service, "mauInDangApDungRepository", mauInDangApDungRepository);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiRepository", lichSuThayDoiRepository);
        ReflectionTestUtils.setField(service, "nguoiDungRepository", nguoiDungRepository);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(5).build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private static PrintTemplateConfigRequest request(Map<String, Object> tuyChinh, String accent) {
        Map<String, Object> sections = new HashMap<>();
        sections.put("items", Map.of("show", true));
        if (tuyChinh != null) sections.put("_tuyChinh", tuyChinh);
        return PrintTemplateConfigRequest.builder()
                .name("Mẫu FCentric mặc định")
                .paperSize("A4")
                .orientation("portrait")
                .margin("default")
                .accentColor(accent)
                .branding(Map.of("showLogo", true))
                .sections(sections)
                .columns(Map.of("lot", false))
                .build();
    }

    private static CauHinhMauIn daLuu(long id, String accent) {
        return CauHinhMauIn.builder()
                .id(id)
                .documentType(LOAI)
                .templateId(MAU_A4)
                .name("Mẫu FCentric mặc định")
                .paperSize("A4")
                .orientation("portrait")
                .margin("default")
                .accentColor(accent)
                .brandingJson("{\"showLogo\":true}")
                .sectionsJson("{\"items\":{\"show\":true}}")
                .columnsJson("{}")
                .version(2)
                .build();
    }

    @Test
    void luuMau_tuyChinhHopLe_ghiPhienBanKemAnhChupTruocKhiSua() {
        CauHinhMauIn entity = daLuu(7L, "#111111");
        NguoiDung nguoi = NguoiDung.builder().id(5).hoTen("Nguyễn Văn An").vaiTro("quan_tri_vien").build();
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(entity));
        when(cauHinhMauInRepository.findAllByDocumentType(LOAI)).thenReturn(List.of(entity));
        when(mauInDangApDungRepository.findById(LOAI))
                .thenReturn(Optional.of(MauInDangApDung.builder().documentType(LOAI).templateId(MAU_A4).build()));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(nguoi));

        Map<String, Object> tuyChinh = new LinkedHashMap<>();
        tuyChinh.put("tieuDe", "Phiếu nhập hàng");
        tuyChinh.put("coChu", "lon");
        tuyChinh.put("maSoPhieu", "ma_vach");
        tuyChinh.put("loiChanPhieu", "");
        tuyChinh.put("nhan", Map.of("items.sku", "Mã hàng", "signatures.approver", "Trưởng kho duyệt"));
        PrintTemplateConfigDto dto = service.upsertConfig(LOAI, MAU_A4, request(tuyChinh, "#0F2A43"));

        assertEquals("#0F2A43", dto.getAccentColor());
        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).createGiaoDichRieng(captor.capture());
        LichSuThayDoi lichSu = captor.getValue();
        assertEquals(ITable.cau_hinh_mau_in, lichSu.getLoaiThamChieu());
        assertEquals(IHanhDong.cap_nhat_mau_in, lichSu.getHanhDong());
        assertEquals(7, lichSu.getIdThamChieu());
        assertSame(nguoi, lichSu.getNguoiThucHien());
        assertNotNull(lichSu.getNgayThucHien());
        // Ảnh chụp trước được chụp TRƯỚC khi dòng (cùng biến thể) bị sửa
        assertTrue(lichSu.getGiaTriCu().contains("\"accentColor\":\"#111111\""), lichSu.getGiaTriCu());
        assertTrue(lichSu.getGiaTriMoi().contains("\"accentColor\":\"#0F2A43\""), lichSu.getGiaTriMoi());
        assertTrue(lichSu.getGiaTriMoi().contains("\"templateId\":\"" + MAU_A4 + "\""));
        assertTrue(lichSu.getGiaTriMoi().contains("Mã hàng"));
        assertTrue(lichSu.getGiaTriMoi().contains("\"maSoPhieu\":\"ma_vach\""));
    }

    @Test
    void luuMau_lanDau_khongCoAnhChupTruoc() {
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.empty());
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> {
            CauHinhMauIn saved = inv.getArgument(0);
            saved.setId(11L);
            return saved;
        });
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));

        service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43"));

        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).createGiaoDichRieng(captor.capture());
        assertNull(captor.getValue().getGiaTriCu());
        assertEquals(11, captor.getValue().getIdThamChieu());
    }

    @Test
    void luuMau_mauDangApDungChuaLuu_anhChupTruocLaCauHinhDaLuuDauTien() {
        // Giống frontend: biến thể đang áp dụng chưa có cấu hình đã lưu -> mẫu in ra là cấu hình đã lưu
        // đầu tiên (id nhỏ nhất), nên "trước khi lưu" phải là cấu hình đó chứ không phải trống
        CauHinhMauIn a4 = daLuu(9L, "#222222");
        CauHinhMauIn a5 = daLuu(4L, "#111111");
        a5.setTemplateId("goods_receipt_default_A5");
        a5.setPaperSize("A5");
        CauHinhMauIn la = daLuu(2L, "#333333");
        la.setTemplateId("mau_tu_che");
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(a4));
        when(cauHinhMauInRepository.findAllByDocumentType(LOAI)).thenReturn(List.of(a4, a5, la));
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.of(
                MauInDangApDung.builder().documentType(LOAI).templateId("goods_receipt_default_K80").build()));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));

        service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43"));

        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).createGiaoDichRieng(captor.capture());
        String truoc = captor.getValue().getGiaTriCu();
        assertTrue(truoc.contains("\"templateId\":\"goods_receipt_default_A5\""), truoc);
        assertTrue(truoc.contains("\"accentColor\":\"#111111\""), truoc);
    }

    @Test
    void luuMau_chiCoMauCuKhacKho_anhChupTruocTrong() {
        // Hóa đơn bán hàng (khổ tờ A4/A5) còn dòng K80 cũ trong DB: frontend không in mẫu đó, mẫu đang
        // in là mặc định của registry -> không có ảnh chụp "trước" (tóm tắt "Lưu lần đầu…")
        CauHinhMauIn k80Cu = daLuu(2L, "#222222");
        k80Cu.setDocumentType("sales_invoice");
        k80Cu.setTemplateId("sales_invoice_default_K80");
        k80Cu.setPaperSize("K80");
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId("sales_invoice", "sales_invoice_default_A4")).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.findAllByDocumentType("sales_invoice")).thenReturn(List.of(k80Cu));
        when(mauInDangApDungRepository.findById("sales_invoice")).thenReturn(Optional.of(
                MauInDangApDung.builder().documentType("sales_invoice").templateId("sales_invoice_default_A4").build()));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> {
            CauHinhMauIn saved = inv.getArgument(0);
            saved.setId(20L);
            return saved;
        });
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));

        service.upsertConfig("sales_invoice", "sales_invoice_default_A4", request(null, "#0F2A43"));

        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).createGiaoDichRieng(captor.capture());
        assertNull(captor.getValue().getGiaTriCu());
    }

    @Test
    void luuMau_mauCuKhacKhoIdNhoHon_vanChonMauFrontendDangIn() {
        CauHinhMauIn k80Cu = daLuu(2L, "#222222");
        k80Cu.setDocumentType("sales_invoice");
        k80Cu.setTemplateId("sales_invoice_default_K80");
        k80Cu.setPaperSize("K80");
        CauHinhMauIn a5 = daLuu(9L, "#111111");
        a5.setDocumentType("sales_invoice");
        a5.setTemplateId("sales_invoice_default_A5");
        a5.setPaperSize("A5");
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId("sales_invoice", "sales_invoice_default_A4")).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.findAllByDocumentType("sales_invoice")).thenReturn(List.of(k80Cu, a5));
        when(mauInDangApDungRepository.findById("sales_invoice")).thenReturn(Optional.of(
                MauInDangApDung.builder().documentType("sales_invoice").templateId("sales_invoice_default_A4").build()));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> {
            CauHinhMauIn saved = inv.getArgument(0);
            saved.setId(21L);
            return saved;
        });
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));

        service.upsertConfig("sales_invoice", "sales_invoice_default_A4", request(null, "#0F2A43"));

        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).createGiaoDichRieng(captor.capture());
        String truoc = captor.getValue().getGiaTriCu();
        assertTrue(truoc.contains("\"templateId\":\"sales_invoice_default_A5\""), truoc);
    }

    @Test
    void bundle_sapTheoId() {
        // Frontend lấy "cấu hình đã lưu đầu tiên" theo thứ tự bundle — phải là id tăng dần như backend
        when(cauHinhMauInRepository.findAll(any(Sort.class))).thenReturn(List.of(daLuu(3L, "#111111"), daLuu(8L, "#111111")));
        when(mauInDangApDungRepository.findAll()).thenReturn(List.of());
        assertEquals(2, service.getBundle().getConfigs().size());
        ArgumentCaptor<Sort> sort = ArgumentCaptor.forClass(Sort.class);
        verify(cauHinhMauInRepository).findAll(sort.capture());
        Sort.Order order = sort.getValue().getOrderFor("id");
        assertNotNull(order);
        assertTrue(order.isAscending());
    }

    @Test
    void mauFrontend_khoTheoLoaiChungTu() {
        assertTrue(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("sales_invoice", "sales_invoice_default_A5"));
        assertFalse(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("sales_invoice", "sales_invoice_default_K80"));
        assertTrue(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("pos_invoice", "pos_invoice_default_K57"));
        assertFalse(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("pos_invoice", "pos_invoice_default_A4"));
        assertFalse(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("goods_receipt", "goods_receipt_default_A4x"));
        assertFalse(com.dev.backend.constant.variables.IPrintTemplateConfig.isFrontendTemplateId("goods_receipt", null));
    }

    @Test
    void mauMacDinh_hoaDonTaiQuayLaK80_moiLoaiDeuInDuoc() {
        assertEquals("pos_invoice_default_K80", IPrintTemplateConfig.defaultTemplateId("pos_invoice"));
        assertEquals("sales_invoice_default_A4", IPrintTemplateConfig.defaultTemplateId("sales_invoice"));
        // migrate dùng mẫu mặc định khi active cũ không hợp lệ — mẫu mặc định phải là biến thể frontend in được
        for (String loai : IPrintTemplateConfig.PRINT_DOCUMENT_TYPES) {
            assertTrue(IPrintTemplateConfig.isFrontendTemplateId(loai, IPrintTemplateConfig.defaultTemplateId(loai)), loai);
        }
    }

    @Test
    void luuMau_hoaDonTaiQuayK57_hopLe_thanhMauDangApDung() {
        String loai = "pos_invoice";
        String mau = "pos_invoice_default_K57";
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(loai, mau)).thenReturn(Optional.empty());
        when(mauInDangApDungRepository.findById(loai)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> {
            CauHinhMauIn saved = inv.getArgument(0);
            saved.setId(30L);
            return saved;
        });
        PrintTemplateConfigRequest req = request(null, "#0F2A43");
        req.setPaperSize("K57");

        PrintTemplateConfigDto dto = service.upsertConfig(loai, mau, req);

        assertEquals(mau, dto.getTemplateId());
        assertEquals("K57", dto.getPaperSize());
        ArgumentCaptor<MauInDangApDung> active = ArgumentCaptor.forClass(MauInDangApDung.class);
        verify(mauInDangApDungRepository).save(active.capture());
        assertEquals(loai, active.getValue().getDocumentType());
        assertEquals(mau, active.getValue().getTemplateId());
    }

    @Test
    void luuMau_khoNhietGuiHuongNgang_quyVeDoc_khoToGiuNguyen() {
        // Frontend luôn in khổ nhiệt khổ dọc; dữ liệu localStorage cũ / tab frontend cũ có thể gửi "landscape"
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        PrintTemplateConfigRequest k80 = request(null, "#0F2A43");
        k80.setPaperSize("K80");
        k80.setOrientation("landscape");
        assertEquals("portrait", service.upsertConfig("pos_invoice", "pos_invoice_default_K80", k80).getOrientation());

        PrintTemplateConfigRequest a4 = request(null, "#0F2A43");
        a4.setOrientation("landscape");
        assertEquals("landscape", service.upsertConfig(LOAI, MAU_A4, a4).getOrientation());
    }

    @Test
    void luuMau_khoKhongDungChoLoaiChungTu_bichan() {
        // Dòng cũ khác khổ còn trong DB (trước khi tách mẫu tại quầy) cũng không được lưu tiếp: lưu = kích hoạt,
        // mà frontend không bao giờ in biến thể đó
        lenient().when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId("sales_invoice", "sales_invoice_default_K80"))
                .thenReturn(Optional.of(daLuu(2L, "#222222")));
        List<String[]> sai = List.of(
                new String[]{"pos_invoice", "pos_invoice_default_A4", "A4"},
                new String[]{"pos_invoice", "pos_invoice_default_A5", "A5"},
                new String[]{"sales_invoice", "sales_invoice_default_K57", "K57"},
                new String[]{"sales_invoice", "sales_invoice_default_K80", "K80"},
                new String[]{"goods_receipt", "goods_receipt_default_K57", "K57"});
        for (String[] ca : sai) {
            PrintTemplateConfigRequest req = request(null, "#0F2A43");
            req.setPaperSize(ca[2]);
            CommonException loi = assertThrows(CommonException.class, () -> service.upsertConfig(ca[0], ca[1], req), ca[1]);
            // Đúng dạng registry nhưng khác khổ (tab còn frontend cũ): báo lỗi dễ hiểu, vẫn 400
            assertEquals(KHO_KHONG_CON_DUNG, loi.getMessage(), ca[1]);
            assertEquals(HttpStatus.BAD_REQUEST, loi.getStatus(), ca[1]);
        }
        verify(cauHinhMauInRepository, never()).save(any());
        verifyNoInteractions(mauInDangApDungRepository, lichSuThayDoiService);
    }

    @Test
    void luuMau_dinhDanhSaiDang_vanBaoDinhDanhKhongHopLe() {
        for (String sai : List.of("goods_receipt_default_A4x", "mau_tu_che", "sales_invoice_default_A4")) {
            PrintTemplateConfigRequest req = request(null, "#0F2A43");
            CommonException loi = assertThrows(CommonException.class, () -> service.upsertConfig(LOAI, sai, req), sai);
            assertEquals("Định danh mẫu không hợp lệ: " + sai, loi.getMessage());
            assertEquals(HttpStatus.BAD_REQUEST, loi.getStatus());
        }
        verify(cauHinhMauInRepository, never()).save(any());
        verifyNoInteractions(mauInDangApDungRepository, lichSuThayDoiService);
    }

    @Test
    void kichHoat_chiNhanMauFrontendInDuoc() {
        lenient().when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId("sales_invoice", "sales_invoice_default_K80"))
                .thenReturn(Optional.of(daLuu(2L, "#222222")));
        assertEquals(KHO_KHONG_CON_DUNG, assertThrows(CommonException.class,
                () -> service.setActive("pos_invoice", "pos_invoice_default_A4")).getMessage());
        assertEquals(KHO_KHONG_CON_DUNG, assertThrows(CommonException.class,
                () -> service.setActive("sales_invoice", "sales_invoice_default_K57")).getMessage());
        CommonException k80 = assertThrows(CommonException.class, () -> service.setActive("sales_invoice", "sales_invoice_default_K80"));
        assertEquals(KHO_KHONG_CON_DUNG, k80.getMessage());
        assertEquals(HttpStatus.BAD_REQUEST, k80.getStatus());
        assertEquals("Định danh mẫu không hợp lệ: null",
                assertThrows(CommonException.class, () -> service.setActive("goods_receipt", null)).getMessage());
        assertEquals("Định danh mẫu không hợp lệ: pos_invoice_default_K80",
                assertThrows(CommonException.class, () -> service.setActive("goods_receipt", "pos_invoice_default_K80")).getMessage());
        verifyNoInteractions(mauInDangApDungRepository);

        when(mauInDangApDungRepository.findById("pos_invoice")).thenReturn(Optional.empty());
        when(mauInDangApDungRepository.save(any(MauInDangApDung.class))).thenAnswer(inv -> inv.getArgument(0));
        MauInDangApDung row = service.setActive("pos_invoice", "pos_invoice_default_K57");
        assertEquals("pos_invoice", row.getDocumentType());
        assertEquals("pos_invoice_default_K57", row.getTemplateId());
    }

    @Test
    void chuyenDuLieuCu_boQuaMauKhongDungKho_mauDangApDungTheoFrontend() {
        // localStorage của bản frontend cũ (hóa đơn bán hàng còn K80): bỏ qua K80 thay vì làm hỏng cả lần chuyển
        Map<String, PrintTemplateConfigRequest> hoaDon = new LinkedHashMap<>();
        PrintTemplateConfigRequest k80 = request(null, "#0F2A43");
        k80.setPaperSize("K80");
        hoaDon.put("sales_invoice_default_K80", k80);
        hoaDon.put("sales_invoice_default_A4", request(null, "#0F2A43"));
        MigratePrintConfigsRequest req = MigratePrintConfigsRequest.builder()
                .configs(Map.of("sales_invoice", hoaDon))
                .active(Map.of(
                        "sales_invoice", "sales_invoice_default_K80",
                        "pos_invoice", "pos_invoice_default_A4",
                        "goods_receipt", "goods_receipt_default_A5"))
                .build();
        when(cauHinhMauInRepository.countByDocumentType("sales_invoice")).thenReturn(0L);
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> ketQua = service.migrate(req);

        assertEquals(List.of("sales_invoice"), ketQua.get("migrated"));
        // Biến thể frontend không còn in bị bỏ có chủ ý — không phải mục lỗi validate
        assertEquals(List.of(), ketQua.get("invalid"));
        ArgumentCaptor<CauHinhMauIn> cauHinh = ArgumentCaptor.forClass(CauHinhMauIn.class);
        verify(cauHinhMauInRepository).save(cauHinh.capture());
        assertEquals("sales_invoice_default_A4", cauHinh.getValue().getTemplateId());
        ArgumentCaptor<MauInDangApDung> active = ArgumentCaptor.forClass(MauInDangApDung.class);
        verify(mauInDangApDungRepository, atLeastOnce()).save(active.capture());
        Map<String, String> dangApDung = new HashMap<>();
        for (MauInDangApDung row : active.getAllValues()) dangApDung.put(row.getDocumentType(), row.getTemplateId());
        assertEquals("sales_invoice_default_A4", dangApDung.get("sales_invoice"));
        assertEquals("pos_invoice_default_K80", dangApDung.get("pos_invoice"));
        assertEquals("goods_receipt_default_A5", dangApDung.get("goods_receipt"));
    }

    @Test
    void chuyenDuLieuCu_mucLoiValidate_boQuaMucDo_vanChuyenPhanConLai() {
        // Một mục cũ vượt giới hạn byte (hoặc sai tùy chỉnh) không được làm hỏng cả lần chuyển: frontend chỉ
        // đánh dấu đã chuyển khi máy chủ trả 200 — lỗi thì gửi lại mỗi lần mở trình sửa
        PrintTemplateConfigRequest quaLon = request(null, "#0F2A43");
        quaLon.setPaperSize("A5");
        quaLon.getSections().put("notes", Map.of("ghiChu", "ữ".repeat(21_000)));
        Map<String, PrintTemplateConfigRequest> phieuNhap = new LinkedHashMap<>();
        phieuNhap.put("goods_receipt_default_A5", quaLon);
        phieuNhap.put(MAU_A4, request(null, "#0F2A43"));
        PrintTemplateConfigRequest tuyChinhSai = request(Map.of("coChu", "to"), "#0F2A43");
        MigratePrintConfigsRequest req = MigratePrintConfigsRequest.builder()
                .configs(Map.of(
                        LOAI, phieuNhap,
                        "purchase_order", Map.of("purchase_order_default_A4", tuyChinhSai)))
                .active(Map.of(LOAI, "goods_receipt_default_A5"))
                .build();
        when(cauHinhMauInRepository.countByDocumentType(LOAI)).thenReturn(0L);
        when(cauHinhMauInRepository.countByDocumentType("purchase_order")).thenReturn(0L);
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        // Bảng mẫu đang áp dụng giả (đọc lại được dòng vừa ghi như DB thật)
        Map<String, MauInDangApDung> bangDangApDung = new HashMap<>();
        when(mauInDangApDungRepository.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(bangDangApDung.get(inv.getArgument(0))));
        when(mauInDangApDungRepository.save(any(MauInDangApDung.class))).thenAnswer(inv -> {
            MauInDangApDung row = inv.getArgument(0);
            bangDangApDung.put(row.getDocumentType(), row);
            return row;
        });

        Map<String, Object> ketQua = assertDoesNotThrow(() -> service.migrate(req));

        // Loại còn mục hợp lệ vẫn được chuyển; loại chỉ có mục lỗi thì không (không có dòng nào được ghi)
        assertEquals(List.of(LOAI), ketQua.get("migrated"));
        // Mục bị bỏ qua được báo lại trong kết quả (frontend xóa localStorage khi nhận 200), theo thứ tự
        // PRINT_DOCUMENT_TYPES rồi thứ tự mục gửi lên
        assertEquals(List.of("purchase_order/purchase_order_default_A4", LOAI + "/goods_receipt_default_A5"),
                ketQua.get("invalid"));
        assertEquals(List.of(), ketQua.get("skipped"));
        ArgumentCaptor<CauHinhMauIn> cauHinh = ArgumentCaptor.forClass(CauHinhMauIn.class);
        verify(cauHinhMauInRepository).save(cauHinh.capture());
        assertEquals(MAU_A4, cauHinh.getValue().getTemplateId());
        verify(cauHinhMauInRepository, never()).findByDocumentTypeAndTemplateId(LOAI, "goods_receipt_default_A5");
        verify(cauHinhMauInRepository, never()).findByDocumentTypeAndTemplateId(eq("purchase_order"), anyString());
        // Mẫu đang áp dụng: lưu mục hợp lệ = mẫu đó thành mẫu đang dùng; loại không nhận mục nào vẫn có mẫu mặc định
        assertEquals(MAU_A4, bangDangApDung.get(LOAI).getTemplateId());
        assertEquals("purchase_order_default_A4", bangDangApDung.get("purchase_order").getTemplateId());
        assertEquals(IPrintTemplateConfig.PRINT_DOCUMENT_TYPES.size(), bangDangApDung.size());
    }

    @Test
    void luuMau_nhanTuDat_toiDa200() {
        Map<String, Object> nhan = new HashMap<>();
        for (int i = 0; i <= IPrintTemplateConfig.MAX_CUSTOM_LABELS; i++) nhan.put("items.c" + i, "Nhãn " + i);
        assertEquals(201, nhan.size());
        CommonException loi = assertThrows(CommonException.class,
                () -> service.upsertConfig(LOAI, MAU_A4, request(Map.of("nhan", nhan), "#0F2A43")));
        assertTrue(loi.getMessage().contains("quá nhiều nhãn"), loi.getMessage());
        verify(cauHinhMauInRepository, never()).save(any());

        nhan.remove("items.c0");
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        assertNotNull(service.upsertConfig(LOAI, MAU_A4, request(Map.of("nhan", nhan), "#0F2A43")));
    }

    @Test
    void luuMau_cauHinhQuaLon_bichan() {
        // Ảnh chụp lịch sử nằm trong cột TEXT: 21.000 ký tự nhưng 63.000 byte UTF-8 -> giới hạn tính theo byte
        PrintTemplateConfigRequest req = request(null, "#0F2A43");
        req.getSections().put("notes", Map.of("ghiChu", "ữ".repeat(21_000)));
        CommonException loi = assertThrows(CommonException.class, () -> service.upsertConfig(LOAI, MAU_A4, req));
        assertTrue(loi.getMessage().contains("quá lớn"), loi.getMessage());
        verify(cauHinhMauInRepository, never()).save(any());
        verifyNoInteractions(mauInDangApDungRepository, lichSuThayDoiService);
    }

    @Test
    void luuMau_giaoDichRollback_khongGhiLichSu() {
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(daLuu(7L, "#111111")));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43"));
            List<TransactionSynchronization> dangCho = TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, dangCho.size());
            // Giao dịch lưu rollback: Spring gọi beforeCompletion + afterCompletion(ROLLED_BACK), không gọi afterCommit
            for (TransactionSynchronization sync : dangCho) {
                sync.beforeCompletion();
                sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            verifyNoInteractions(lichSuThayDoiService, nguoiDungRepository);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void luuMau_trongGiaoDich_chiGhiLichSuSauCommit() {
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(daLuu(7L, "#111111")));
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43"));
            verifyNoInteractions(lichSuThayDoiService);
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
            verify(lichSuThayDoiService).createGiaoDichRieng(any(LichSuThayDoi.class));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void luuMau_idVuotKieuInt_vanLuu_boQuaLichSu() {
        // id_tham_chieu là INT: id quá lớn không được làm hỏng lần lưu (trước đây Math.toIntExact ném lỗi)
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.empty());
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> {
            CauHinhMauIn saved = inv.getArgument(0);
            saved.setId(3_000_000_000L);
            return saved;
        });

        assertEquals(MAU_A4, service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43")).getTemplateId());
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    void lichSu_boQuaIdVuotKieuInt() {
        when(cauHinhMauInRepository.findAllByDocumentType(LOAI)).thenReturn(List.of(daLuu(3_000_000_000L, "#111111"), daLuu(7L, "#111111")));
        when(lichSuThayDoiRepository.findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc(
                eq(ITable.cau_hinh_mau_in), eq(List.of(7)), eq(IHanhDong.cap_nhat_mau_in), any(Pageable.class)))
                .thenReturn(List.of());
        assertTrue(service.getHistory(LOAI).isEmpty());
    }

    @Test
    void luuMau_khongCoNguoiThucHien_vanLuu_khongGhiLichSu() {
        SecurityContextHolder.clear();
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(daLuu(7L, "#111111")));
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));

        assertNotNull(service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43")));
        verify(cauHinhMauInRepository).save(any(CauHinhMauIn.class));
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    void luuMau_ghiLichSuLoi_khongLamHongLanLuu() {
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(daLuu(7L, "#111111")));
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.of(NguoiDung.builder().id(5).build()));
        when(lichSuThayDoiService.createGiaoDichRieng(any())).thenThrow(new RuntimeException("Bảng lịch sử lỗi"));

        PrintTemplateConfigDto dto = service.upsertConfig(LOAI, MAU_A4, request(null, "#0F2A43"));
        assertEquals(MAU_A4, dto.getTemplateId());
    }

    @Test
    void luuMau_tuyChinhSai_bichan_khongLuu() {
        lenient().when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(anyString(), anyString())).thenReturn(Optional.empty());
        List<Object> sai = List.of(
                Map.of("tieuDe", "x".repeat(101)),
                Map.of("loiChanPhieu", "x".repeat(301)),
                Map.of("tieuDe", 12),
                Map.of("coChu", "to"),
                Map.of("maSoPhieu", "barcode"),
                Map.of("mauLa", "x"),
                Map.of("nhan", Map.of("items.sku", "x".repeat(61))),
                Map.of("nhan", Map.of("items.sku", "   ")),
                Map.of("nhan", Map.of("khongcocham", "Nhãn")),
                Map.of("nhan", Map.of("items.sku", 5)),
                Map.of("nhan", List.of("Nhãn")),
                List.of("khong-phai-object")
        );
        for (Object tuyChinh : sai) {
            Map<String, Object> sections = new HashMap<>();
            sections.put("items", Map.of("show", true));
            sections.put("_tuyChinh", tuyChinh);
            PrintTemplateConfigRequest req = request(null, "#0F2A43");
            req.setSections(sections);
            assertThrows(CommonException.class, () -> service.upsertConfig(LOAI, MAU_A4, req), String.valueOf(tuyChinh));
        }
        verify(cauHinhMauInRepository, never()).save(any());
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    void luuMau_tuyChinhDungGioiHan_duocLuu() {
        when(cauHinhMauInRepository.findByDocumentTypeAndTemplateId(LOAI, MAU_A4)).thenReturn(Optional.of(daLuu(7L, "#111111")));
        when(mauInDangApDungRepository.findById(LOAI)).thenReturn(Optional.empty());
        when(cauHinhMauInRepository.save(any(CauHinhMauIn.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(5)).thenReturn(Optional.empty());

        Map<String, Object> tuyChinh = new HashMap<>();
        tuyChinh.put("tieuDe", "x".repeat(100));
        tuyChinh.put("loiChanPhieu", "x".repeat(300));
        tuyChinh.put("coChu", "nho");
        tuyChinh.put("maSoPhieu", "ma_qr");
        tuyChinh.put("nhan", Map.of("notes.tieuDe", "x".repeat(60)));
        assertNotNull(service.upsertConfig(LOAI, MAU_A4, request(tuyChinh, "#0F2A43")));
        // Không tìm thấy người dùng thì bỏ qua lịch sử, không ghi bản ghi thiếu người thực hiện
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    void lichSu_traPhienBanMoiNhatTruoc_kemNguoiLuuVaAnhChup() {
        CauHinhMauIn a4 = daLuu(7L, "#111111");
        CauHinhMauIn a5 = daLuu(9L, "#111111");
        when(cauHinhMauInRepository.findAllByDocumentType(LOAI)).thenReturn(List.of(a4, a5));
        NguoiDung nguoi = NguoiDung.builder().id(5).hoTen("Lê Văn Cường").vaiTro("quan_ly_kho").build();
        LichSuThayDoi moi = LichSuThayDoi.builder().id(31).idThamChieu(9).nguoiThucHien(nguoi)
                .ngayThucHien(Instant.parse("2026-10-19T07:20:00Z"))
                .giaTriMoi("{\"templateId\":\"goods_receipt_default_A5\",\"paperSize\":\"A5\"}")
                .giaTriCu("{\"templateId\":\"goods_receipt_default_A4\",\"paperSize\":\"A4\"}")
                .build();
        LichSuThayDoi hong = LichSuThayDoi.builder().id(30).idThamChieu(7).nguoiThucHien(null)
                .ngayThucHien(Instant.parse("2026-10-18T07:20:00Z"))
                .giaTriMoi("không phải JSON")
                .build();
        when(lichSuThayDoiRepository.findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc(
                eq(ITable.cau_hinh_mau_in), eq(List.of(7, 9)), eq(IHanhDong.cap_nhat_mau_in), any(Pageable.class)))
                .thenReturn(List.of(moi, hong));

        List<LichSuMauInDto> lichSu = service.getHistory(LOAI);

        assertEquals(2, lichSu.size());
        LichSuMauInDto dau = lichSu.get(0);
        assertEquals(31, dau.getId());
        assertEquals("Lê Văn Cường", dau.getNguoiThucHien());
        assertEquals("quan_ly_kho", dau.getVaiTro());
        assertEquals("goods_receipt_default_A5", dau.getTemplateId());
        assertEquals("A5", dau.getCauHinh().get("paperSize"));
        assertEquals("A4", dau.getCauHinhTruoc().get("paperSize"));
        LichSuMauInDto sau = lichSu.get(1);
        assertNull(sau.getCauHinh());
        assertNull(sau.getTemplateId());
        assertNull(sau.getNguoiThucHien());
    }

    @Test
    void lichSu_chuaLuuLanNao_rong() {
        when(cauHinhMauInRepository.findAllByDocumentType(LOAI)).thenReturn(List.of());
        assertTrue(service.getHistory(LOAI).isEmpty());
        verifyNoInteractions(lichSuThayDoiRepository);
    }

    @Test
    void lichSu_loaiChungTuSai_bichan() {
        assertThrows(CommonException.class, () -> service.getHistory("khong_ton_tai"));
    }

    @Test
    void truyVanLichSu_tenPhuongThucHopLe() {
        // Spring Data dựng truy vấn từ tên phương thức lúc khởi động — tên sai thì ứng dụng không chạy được
        assertDoesNotThrow(() -> new PartTree(
                "findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc", LichSuThayDoi.class));
    }
}
