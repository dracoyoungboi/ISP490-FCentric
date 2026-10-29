package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.MinioService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Ảnh chụp đính kèm biên bản giao nhận (mockup B.4, phương án A1–A6 đã duyệt): quyền thêm / xóa theo kho nhận, khóa sau
 * khi xử lý chênh lệch, tối đa 6 ảnh (đếm sau khi khóa dòng biên bản), loại / cỡ tệp, tải MinIO ngoài giao dịch CSDL,
 * lưu lỗi thì xóa tệp vừa tải, xóa ảnh xóa cả tep_tin rồi mới xóa MinIO, dữ liệu trả về chi tiết phiếu.
 * Kho tổng = 1 (kho xuất), Cửa hàng 1 = 2 (kho nhận), Cửa hàng 2 = 3. Phiếu 50, biên bản 80, người đăng nhập 7.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnhBienBanGiaoNhanServiceTest {

    private static final int PCK = 50, BB = 80, NGUOI = 7, NGUOI_KHAC = 9;
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};
    private static final String URL_MINIO = "http://171.244.142.43:9000/fashion/";

    @Mock private PhieuChuyenKhoRepository pckRepo;
    @Mock private BienBanGiaoNhanRepository bbRepo;
    @Mock private BienBanGiaoNhanAnhRepository anhRepo;
    @Mock private TepTinRepository tepRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private PhanQuyenNguoiDungKhoRepository pqRepo;
    @Mock private LichSuThayDoiService nhatKy;
    @Mock private MinioService minio;
    @Mock private PlatformTransactionManager txManager;

    private AnhBienBanGiaoNhanService service;
    private Kho khoTong, cuaHang, khoKhac;
    private PhieuChuyenKho phieu;
    private BienBanGiaoNhan bb;

    @BeforeEach
    void setUp() throws Exception {
        khoTong = Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho tổng").loaiKho("kho_tong").trangThai(1).build();
        cuaHang = Kho.builder().id(2).maKho("CH_01").tenKho("Cửa hàng 1").loaiKho("cua_hang").trangThai(1).build();
        khoKhac = Kho.builder().id(3).maKho("CH_02").tenKho("Cửa hàng 2").loaiKho("cua_hang").trangThai(1).build();
        phieu = PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-202610281").khoXuat(khoTong).khoNhap(cuaHang)
                .trangThai(IChuyenKho.CHO_XU_LY_LECH).build();
        bb = BienBanGiaoNhan.builder().id(BB).soBienBan("BBGN-20261028-001").phieuChuyenKho(phieu)
                .phuongAnXuLy(IChuyenKho.CHUA_XU_LY).build();
        when(pckRepo.findById(PCK)).thenReturn(Optional.of(phieu));
        when(bbRepo.findFirstByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(Optional.of(bb));
        when(bbRepo.khoaTheoId(BB)).thenReturn(Optional.of(bb));
        when(bbRepo.docPhuongAnXuLy(BB)).thenAnswer(i -> bb.getPhuongAnXuLy());
        when(anhRepo.countByBienBan_Id(BB)).thenReturn(0L);
        when(ndRepo.findById(any())).thenAnswer(i -> Optional.of(NguoiDung.builder().id(i.getArgument(0)).hoTen("Người " + i.getArgument(0)).build()));
        when(tepRepo.save(any(TepTin.class))).thenAnswer(i -> {
            TepTin t = i.getArgument(0);
            if (t.getId() == null) t.setId(300);
            return t;
        });
        when(anhRepo.save(any(BienBanGiaoNhanAnh.class))).thenAnswer(i -> {
            BienBanGiaoNhanAnh a = i.getArgument(0);
            if (a.getId() == null) a.setId(400);
            return a;
        });
        when(minio.upload(any(), anyString())).thenAnswer(i -> i.getArgument(1));
        when(minio.getPublicUrl(anyString())).thenAnswer(i -> URL_MINIO + i.getArgument(0));
        when(minio.delete(anyString())).thenReturn(true);
        when(txManager.getTransaction(any())).thenAnswer(i -> new SimpleTransactionStatus());

        service = new AnhBienBanGiaoNhanService(pckRepo, bbRepo, anhRepo, tepRepo, ndRepo, pqRepo, nhatKy, minio, txManager);
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    // ══════════════════════════ Dữ liệu và tiện ích ══════════════════════════

    private NguoiDungAuthInfo dangNhap(String vaiTro, Kho khoDangChon, Kho... duocPhan) {
        SecurityContextHolder.clear();
        NguoiDungAuthInfo user = NguoiDungAuthInfo.builder().id(NGUOI).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(duocPhan)
                        .map(k -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(k.getId()).build()).build())
                        .toList())
                .build();
        SecurityContextHolder.setUser(user);
        if (khoDangChon != null) SecurityContextHolder.setKhoId(khoDangChon.getId());
        when(pqRepo.findByNguoiDungIdAndActive(NGUOI)).thenReturn(Arrays.stream(duocPhan)
                .map(k -> PhanQuyenNguoiDungKho.builder().kho(k).trangThai(1).build()).toList());
        return user;
    }

    private NguoiDungAuthInfo nhanVienKhoNhan() {
        return dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
    }

    private static MockMultipartFile tep(byte[] noiDung, String ten) {
        return new MockMultipartFile("file", ten, "image/jpeg", noiDung);
    }

    private static MockMultipartFile anhJpeg() {
        return tep(JPEG, "IMG_0001.jpg");
    }

    private BienBanGiaoNhanAnh anh(int id, int nguoiChupId) {
        TepTin t = TepTin.builder().id(id + 1000).tenLuuTru("bien-ban-giao-nhan/80/" + id + ".jpg")
                .duongDan(URL_MINIO + "bien-ban-giao-nhan/80/" + id + ".jpg").build();
        BienBanGiaoNhanAnh a = BienBanGiaoNhanAnh.builder().id(id).bienBan(bb).tepTin(t).moTa("Ảnh " + id)
                .nguoiChup(NguoiDung.builder().id(nguoiChupId).hoTen("Người " + nguoiChupId).build())
                .ngayChup(Instant.parse("2026-10-28T03:00:00Z")).build();
        when(anhRepo.findById(id)).thenReturn(Optional.of(a));
        return a;
    }

    private static CommonException loi(HttpStatus status, Executable viec) {
        CommonException ex = assertThrows(CommonException.class, viec);
        assertEquals(status, ex.getHttpStatus(), ex.getMessage());
        return ex;
    }

    private void khongTaiLen() throws Exception {
        verify(minio, never()).upload(any(), anyString());
        verify(tepRepo, never()).save(any());
        verify(anhRepo, never()).save(any());
    }

    // ══════════════════════════ Thêm ảnh ══════════════════════════

    @Test
    @DisplayName("Kho nhận thêm ảnh: kiểm trước → tải MinIO ngoài giao dịch → giao dịch READ_COMMITTED khóa biên bản, đếm, lưu tep_tin + ảnh, nhật ký")
    void them_khoNhan_luuAnhVaTepTin() throws Exception {
        nhanVienKhoNhan();

        PhieuChuyenKhoDto.AnhBienBan kq = service.them(PCK, anhJpeg(), "  Thùng móp góc  ");

        ArgumentCaptor<String> ten = ArgumentCaptor.forClass(String.class);
        verify(minio).upload(any(), ten.capture());
        assertTrue(ten.getValue().matches("^bien-ban-giao-nhan/80/[0-9a-f-]{36}\\.jpg$"), ten.getValue());

        ArgumentCaptor<TepTin> tep = ArgumentCaptor.forClass(TepTin.class);
        verify(tepRepo).save(tep.capture());
        assertEquals(ten.getValue(), tep.getValue().getTenLuuTru());
        assertEquals(URL_MINIO + ten.getValue(), tep.getValue().getDuongDan());
        assertEquals("IMAGE", tep.getValue().getLoaiTepTin());
        assertEquals("jpg", tep.getValue().getDuoiTep());
        assertEquals(JPEG.length, tep.getValue().getKichCo());

        ArgumentCaptor<BienBanGiaoNhanAnh> anh = ArgumentCaptor.forClass(BienBanGiaoNhanAnh.class);
        verify(anhRepo).save(anh.capture());
        assertSame(bb, anh.getValue().getBienBan());
        assertSame(tep.getValue(), anh.getValue().getTepTin());
        assertEquals("Thùng móp góc", anh.getValue().getMoTa());
        assertEquals(NGUOI, anh.getValue().getNguoiChup().getId());
        assertNotNull(anh.getValue().getNgayChup());

        ArgumentCaptor<LichSuThayDoi> nk = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(nhatKy).create(nk.capture());
        assertEquals(IHanhDong.them_anh_bien_ban, nk.getValue().getHanhDong());
        assertEquals(ITable.phieu_chuyen_kho, nk.getValue().getLoaiThamChieu());
        assertEquals(PCK, nk.getValue().getIdThamChieu());
        assertTrue(nk.getValue().getGhiChu().contains("BBGN-20261028-001"));

        assertEquals(400, kq.getId());
        assertEquals("https://minio.slmglobal.vn/fashion/" + ten.getValue(), kq.getUrl(), "URL công khai đổi sang HTTPS");
        assertEquals("Thùng móp góc", kq.getMoTa());
        assertEquals("Người 7", kq.getNguoiChup());
        assertTrue(kq.isDuocXoa(), "người vừa tải lên xóa được ảnh của mình");

        // Thứ tự: giao dịch kiểm trước (chỉ đọc) xong rồi mới tải MinIO; giao dịch ghi mở sau khi tải, khóa rồi mới đếm
        InOrder thuTu = inOrder(txManager, minio, bbRepo, anhRepo, tepRepo);
        thuTu.verify(txManager).getTransaction(any());
        thuTu.verify(txManager).commit(any());
        thuTu.verify(minio).upload(any(), anyString());
        thuTu.verify(txManager).getTransaction(any());
        thuTu.verify(bbRepo).khoaTheoId(BB);
        thuTu.verify(anhRepo).countByBienBan_Id(BB);
        thuTu.verify(tepRepo).save(any());
        thuTu.verify(anhRepo).save(any());
        thuTu.verify(txManager).commit(any());
        verify(minio, never()).delete(anyString());

        ArgumentCaptor<TransactionDefinition> dn = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager, times(2)).getTransaction(dn.capture());
        assertTrue(dn.getAllValues().get(0).isReadOnly(), "bước kiểm trước chỉ đọc");
        assertEquals(TransactionDefinition.ISOLATION_READ_COMMITTED, dn.getAllValues().get(1).getIsolationLevel());
    }

    @Test
    @DisplayName("Quyền thêm ảnh: kho nhận, quản trị viên được; kho xuất, Quản lý Kho tổng (không thuộc kho nhận), đứng sai kho bị 403; cờ khớp")
    void them_quyenTheoKhoNhan() throws Exception {
        Map<String, Runnable> nguoi = new LinkedHashMap<>();
        nguoi.put("Nhân viên kho nhận", () -> dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang));
        nguoi.put("Quản lý kho nhận", () -> dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang));
        nguoi.put("Quản trị viên", () -> dangNhap(IRoleType.quan_tri_vien, null));
        nguoi.put("Nhân viên kho xuất", () -> dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong));
        nguoi.put("Quản lý Kho tổng", () -> dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong));
        nguoi.put("Kho thứ ba", () -> dangNhap(IRoleType.quan_ly_kho, khoKhac, khoKhac));
        List<String> duoc = List.of("Nhân viên kho nhận", "Quản lý kho nhận", "Quản trị viên");

        for (Map.Entry<String, Runnable> ai : nguoi.entrySet()) {
            ai.getValue().run();
            clearInvocations(minio, tepRepo, anhRepo);
            boolean mongDoi = duoc.contains(ai.getKey());
            assertEquals(mongDoi, service.duocThem(SecurityContextHolder.getUser(), phieu, bb), ai.getKey());
            if (mongDoi) {
                assertNotNull(service.them(PCK, anhJpeg(), null), ai.getKey());
            } else {
                clearInvocations(bbRepo);
                CommonException ex = loi(HttpStatus.FORBIDDEN, () -> service.them(PCK, anhJpeg(), null));
                assertEquals("Chỉ người thuộc kho nhận của phiếu chuyển thêm được ảnh vào biên bản giao nhận",
                        ex.getMessage(), ai.getKey());
                khongTaiLen();
                // Bị chặn trước khi tìm biên bản: không biết phiếu có biên bản chưa
                verify(bbRepo, never()).findFirstByPhieuChuyenKho_IdOrderByIdDesc(any());
            }
        }

        // Thuộc cả kho nhận lẫn kho khác mà đang đứng ở kho khác: thấy nút, bấm thì được nhắc chọn đúng kho
        dangNhap(IRoleType.nhan_vien_kho, khoKhac, cuaHang, khoKhac);
        clearInvocations(minio, tepRepo, anhRepo);
        assertTrue(service.duocThem(SecurityContextHolder.getUser(), phieu, bb));
        assertTrue(loi(HttpStatus.FORBIDDEN, () -> service.them(PCK, anhJpeg(), null)).getMessage().contains("kho khác kho đang chọn"));
        khongTaiLen();

        // Không có biên bản: cờ tắt, bấm thì 404
        assertFalse(service.duocThem(SecurityContextHolder.getUser(), phieu, null));
        when(bbRepo.findFirstByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(Optional.empty());
        nhanVienKhoNhan();
        loi(HttpStatus.NOT_FOUND, () -> service.them(PCK, anhJpeg(), null));
    }

    @Test
    @DisplayName("Đã xử lý chênh lệch: 409, không tải lên; xử lý xong trong lúc đang tải thì 409 và xóa tệp vừa tải")
    void them_sauKhiXuLy_khoa() throws Exception {
        nhanVienKhoNhan();
        bb.setPhuongAnXuLy(IChuyenKho.GHI_GIAM_HAO_HUT);
        assertFalse(service.duocThem(SecurityContextHolder.getUser(), phieu, bb));
        assertEquals("Biên bản BBGN-20261028-001 đã xử lý chênh lệch, ảnh chỉ xem được, không thêm hay xóa",
                loi(HttpStatus.CONFLICT, () -> service.them(PCK, anhJpeg(), null)).getMessage());
        khongTaiLen();

        // Thực thể nạp đầu yêu cầu còn CHUA_XU_LY; trong CSDL đã GIAO_BU_HANG lúc giao dịch ghi đọc lại sau khóa
        bb.setPhuongAnXuLy(IChuyenKho.CHUA_XU_LY);
        when(bbRepo.docPhuongAnXuLy(BB)).thenReturn(IChuyenKho.GIAO_BU_HANG);
        clearInvocations(txManager, minio);
        loi(HttpStatus.CONFLICT, () -> service.them(PCK, anhJpeg(), null));
        ArgumentCaptor<String> ten = ArgumentCaptor.forClass(String.class);
        verify(minio).upload(any(), ten.capture());
        verify(minio).delete(ten.getValue());
        verify(tepRepo, never()).save(any());
        verify(txManager).rollback(any());
    }

    @Test
    @DisplayName("Tối đa 6 ảnh: đủ 6 thì 409 trước khi tải; lần tải song song lấp chỗ cuối (đếm lại sau khóa = 6) thì 409 và xóa tệp")
    void them_toiDaSauAnh() throws Exception {
        nhanVienKhoNhan();
        when(anhRepo.countByBienBan_Id(BB)).thenReturn(6L);
        assertEquals("Biên bản BBGN-20261028-001 đã đủ 6 ảnh. Xóa bớt ảnh nếu cần thêm ảnh khác.",
                loi(HttpStatus.CONFLICT, () -> service.them(PCK, anhJpeg(), null)).getMessage());
        khongTaiLen();

        // Lúc kiểm trước còn 5; sau khi chờ khóa dòng biên bản thì lần kia đã lưu ảnh thứ 6
        when(anhRepo.countByBienBan_Id(BB)).thenReturn(5L, 6L);
        loi(HttpStatus.CONFLICT, () -> service.them(PCK, anhJpeg(), null));
        ArgumentCaptor<String> ten = ArgumentCaptor.forClass(String.class);
        verify(minio).upload(any(), ten.capture());
        verify(minio).delete(ten.getValue());
        verify(tepRepo, never()).save(any());
        InOrder thuTu = inOrder(bbRepo, anhRepo);
        thuTu.verify(bbRepo).khoaTheoId(BB);
        thuTu.verify(anhRepo).countByBienBan_Id(BB);

        // Còn 5 cả hai lần: lưu được ảnh thứ 6
        clearInvocations(minio);
        when(anhRepo.countByBienBan_Id(BB)).thenReturn(5L);
        assertNotNull(service.them(PCK, anhJpeg(), null));
        verify(minio, never()).delete(anyString());
    }

    @Test
    @DisplayName("Loại tệp theo nội dung: JPEG / PNG / WebP được; HTML đổi đuôi .jpg, GIF, tệp trống, quá 10 MB, mô tả quá 255 ký tự bị 400")
    void them_loaiVaCoTep() throws Exception {
        nhanVienKhoNhan();
        assertEquals("Ảnh biên bản phải là ảnh JPEG, PNG hoặc WebP",
                loi(HttpStatus.BAD_REQUEST, () -> service.them(PCK, tep("<html><script>".getBytes(), "anh.jpg"), null)).getMessage());
        loi(HttpStatus.BAD_REQUEST, () -> service.them(PCK, tep("GIF89a......".getBytes(), "anh.gif"), null));
        assertEquals("Ảnh biên bản đang trống", loi(HttpStatus.BAD_REQUEST, () -> service.them(PCK, tep(new byte[0], "anh.jpg"), null)).getMessage());
        byte[] lon = Arrays.copyOf(JPEG, (int) AnhBienBanGiaoNhanService.DUNG_LUONG_TOI_DA + 1);
        assertEquals("Ảnh biên bản vượt quá 10 MB cho phép",
                loi(HttpStatus.BAD_REQUEST, () -> service.them(PCK, tep(lon, "lon.jpg"), null)).getMessage());
        assertEquals("Mô tả ảnh tối đa 255 ký tự",
                loi(HttpStatus.BAD_REQUEST, () -> service.them(PCK, anhJpeg(), "x".repeat(256))).getMessage());
        khongTaiLen();
        verify(txManager, never()).getTransaction(any());

        // PNG lưu với đuôi .png dù tên tệp ghi .jpg; đúng 10 MB vẫn nhận
        service.them(PCK, tep(PNG, "chup.jpg"), "x".repeat(255));
        ArgumentCaptor<String> ten = ArgumentCaptor.forClass(String.class);
        verify(minio).upload(any(), ten.capture());
        assertTrue(ten.getValue().endsWith(".png"), ten.getValue());
        service.them(PCK, tep(Arrays.copyOf(JPEG, (int) AnhBienBanGiaoNhanService.DUNG_LUONG_TOI_DA), "dung10.jpg"), null);
        verify(minio, times(2)).upload(any(), anyString());
    }

    @Test
    @DisplayName("Lưu CSDL lỗi: giao dịch rollback, xóa tệp vừa tải lên MinIO, báo lỗi; tải MinIO lỗi thì không mở giao dịch ghi")
    void them_luuLoi_xoaTepMinio() throws Exception {
        nhanVienKhoNhan();
        doThrow(new RuntimeException("Deadlock found")).when(tepRepo).save(any(TepTin.class));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.them(PCK, anhJpeg(), null));
        assertEquals("Deadlock found", ex.getMessage());
        ArgumentCaptor<String> ten = ArgumentCaptor.forClass(String.class);
        verify(minio).upload(any(), ten.capture());
        verify(minio).delete(ten.getValue());
        verify(txManager).rollback(any());
        verify(anhRepo, never()).save(any());

        // Xóa tệp cũng lỗi: vẫn báo lỗi lưu gốc, không ném lỗi MinIO
        doThrow(new RuntimeException("MinIO down")).when(minio).delete(anyString());
        assertEquals("Deadlock found", assertThrows(RuntimeException.class, () -> service.them(PCK, anhJpeg(), null)).getMessage());

        // MinIO lỗi khi tải: 500 câu dễ hiểu, chỉ có giao dịch kiểm trước
        clearInvocations(txManager);
        doThrow(new RuntimeException("Connection refused")).when(minio).upload(any(), anyString());
        assertEquals("Không lưu được ảnh lên kho tệp, thử lại sau",
                loi(HttpStatus.INTERNAL_SERVER_ERROR, () -> service.them(PCK, anhJpeg(), null)).getMessage());
        verify(txManager, times(1)).getTransaction(any());
    }

    // ══════════════════════════ Xóa ảnh ══════════════════════════

    @Test
    @DisplayName("Người tải lên xóa ảnh: xóa dòng ảnh rồi dòng tep_tin trong giao dịch, commit xong mới xóa tệp MinIO, nhật ký")
    void xoa_nguoiTaiLen_xoaDongTepVaMinio() {
        nhanVienKhoNhan();
        BienBanGiaoNhanAnh a = anh(11, NGUOI);
        TepTin t = a.getTepTin();

        service.xoa(PCK, 11);

        InOrder thuTu = inOrder(txManager, bbRepo, anhRepo, tepRepo, minio);
        thuTu.verify(txManager).getTransaction(any());
        thuTu.verify(bbRepo).khoaTheoId(BB);
        thuTu.verify(anhRepo).delete(a);
        thuTu.verify(anhRepo).flush();
        thuTu.verify(tepRepo).delete(t);
        thuTu.verify(txManager).commit(any());
        thuTu.verify(minio).delete("bien-ban-giao-nhan/80/11.jpg");

        ArgumentCaptor<LichSuThayDoi> nk = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(nhatKy).create(nk.capture());
        assertEquals(IHanhDong.xoa_anh_bien_ban, nk.getValue().getHanhDong());
        assertEquals(PCK, nk.getValue().getIdThamChieu());
    }

    @Test
    @DisplayName("Quyền xóa: người tải lên, quản lý kho nhận, quản trị viên được; nhân viên kho nhận khác, kho xuất, Quản lý Kho tổng bị 403; cờ khớp")
    void xoa_quyen() {
        Map<String, Runnable> nguoi = new LinkedHashMap<>();
        nguoi.put("Người tải lên (nhân viên kho nhận)", () -> dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang));
        nguoi.put("Quản lý kho nhận", () -> dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang));
        nguoi.put("Quản trị viên", () -> dangNhap(IRoleType.quan_tri_vien, null));
        nguoi.put("Nhân viên kho nhận khác", () -> dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang));
        nguoi.put("Nhân viên kho xuất", () -> dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong));
        nguoi.put("Quản lý Kho tổng", () -> dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong));
        List<String> duoc = List.of("Người tải lên (nhân viên kho nhận)", "Quản lý kho nhận", "Quản trị viên");

        for (Map.Entry<String, Runnable> ai : nguoi.entrySet()) {
            ai.getValue().run();
            clearInvocations(anhRepo, tepRepo, minio);
            // Người đăng nhập luôn id 7: ảnh của người khác (9), trừ ca người tải lên
            int nguoiChup = ai.getKey().startsWith("Người tải lên") ? NGUOI : NGUOI_KHAC;
            BienBanGiaoNhanAnh a = anh(11, nguoiChup);
            when(anhRepo.danhSachTheoBienBan(BB)).thenReturn(List.of(a));
            boolean mongDoi = duoc.contains(ai.getKey());
            assertEquals(mongDoi, service.danhSach(bb, phieu, SecurityContextHolder.getUser()).get(0).isDuocXoa(), ai.getKey());
            if (mongDoi) {
                service.xoa(PCK, 11);
                verify(tepRepo).delete(a.getTepTin());
            } else {
                clearInvocations(bbRepo);
                // Người kho nhận (xem được phiếu) được nêu tên kho; người ngoài kho nhận bị chặn trước khi tìm biên bản /
                // ảnh và trước khi khóa dòng, câu không nêu tên kho
                boolean thuocKhoNhan = ai.getKey().contains("kho nhận");
                assertEquals(thuocKhoNhan
                                ? "Chỉ người tải ảnh lên, quản lý Cửa hàng 1 hoặc quản trị viên xóa được ảnh này"
                                : "Chỉ người tải ảnh lên, quản lý kho nhận hoặc quản trị viên xóa được ảnh này",
                        loi(HttpStatus.FORBIDDEN, () -> service.xoa(PCK, 11)).getMessage(), ai.getKey());
                verify(anhRepo, never()).delete(any());
                verify(minio, never()).delete(anyString());
                if (!thuocKhoNhan) {
                    verify(bbRepo, never()).khoaTheoId(any());
                    verify(anhRepo, never()).findById(any());
                }
            }
        }

        // Quản lý kho nhận đang đứng ở kho khác: bị nhắc chọn đúng kho
        dangNhap(IRoleType.quan_ly_kho, khoKhac, cuaHang, khoKhac);
        anh(11, NGUOI_KHAC);
        assertTrue(loi(HttpStatus.FORBIDDEN, () -> service.xoa(PCK, 11)).getMessage().contains("kho khác kho đang chọn"));
    }

    @Test
    @DisplayName("Xóa sau khi xử lý chênh lệch: 409, không xóa gì; cờ xóa tắt với mọi người")
    void xoa_sauKhiXuLy_khoa() {
        dangNhap(IRoleType.quan_tri_vien, null);
        BienBanGiaoNhanAnh a = anh(11, NGUOI);
        bb.setPhuongAnXuLy(IChuyenKho.GHI_GIAM_HAO_HUT);
        when(anhRepo.danhSachTheoBienBan(BB)).thenReturn(List.of(a));
        assertFalse(service.danhSach(bb, phieu, SecurityContextHolder.getUser()).get(0).isDuocXoa());

        loi(HttpStatus.CONFLICT, () -> service.xoa(PCK, 11));
        verify(anhRepo, never()).delete(any());
        verify(tepRepo, never()).delete(any(TepTin.class));
        verify(minio, never()).delete(anyString());
        verify(txManager).rollback(any());
    }

    @Test
    @DisplayName("Xóa ảnh của biên bản khác hoặc không còn: 404; MinIO xóa lỗi sau commit chỉ ghi log")
    void xoa_khongThuocBienBan_vaMinioLoi() {
        nhanVienKhoNhan();
        BienBanGiaoNhan bbKhac = BienBanGiaoNhan.builder().id(81).soBienBan("BBGN-20261028-002").build();
        BienBanGiaoNhanAnh a = anh(12, NGUOI);
        a.setBienBan(bbKhac);
        loi(HttpStatus.NOT_FOUND, () -> service.xoa(PCK, 12));
        when(anhRepo.findById(13)).thenReturn(Optional.empty());
        loi(HttpStatus.NOT_FOUND, () -> service.xoa(PCK, 13));
        verify(anhRepo, never()).delete(any());

        anh(11, NGUOI);
        doThrow(new RuntimeException("MinIO down")).when(minio).delete(anyString());
        assertDoesNotThrow(() -> service.xoa(PCK, 11));
        verify(txManager, atLeastOnce()).commit(any());
        verify(minio).delete("bien-ban-giao-nhan/80/11.jpg");
        doReturn(false).when(minio).delete(anyString());
        anh(11, NGUOI);
        assertDoesNotThrow(() -> service.xoa(PCK, 11));
    }

    @Test
    @DisplayName("Người kho khác thêm / xóa: 403 trước khi tìm biên bản / ảnh, không khóa dòng; câu không lộ tên kho nhận, số biên bản")
    void khoKhac_chanTruocKhiTimVaKhoa() throws Exception {
        dangNhap(IRoleType.quan_ly_kho, khoKhac, khoKhac);
        anh(11, NGUOI_KHAC);
        when(anhRepo.findById(13)).thenReturn(Optional.empty());
        clearInvocations(bbRepo, anhRepo, txManager);

        String themBiChan = loi(HttpStatus.FORBIDDEN, () -> service.them(PCK, anhJpeg(), null)).getMessage();
        String xoaBiChan = loi(HttpStatus.FORBIDDEN, () -> service.xoa(PCK, 11)).getMessage();
        // Ảnh không có trong biên bản: trước đây 404 nêu số biên bản, giờ 403 như mọi ảnh
        assertEquals(xoaBiChan, loi(HttpStatus.FORBIDDEN, () -> service.xoa(PCK, 13)).getMessage());

        for (String cau : List.of(themBiChan, xoaBiChan)) {
            assertFalse(cau.contains("Cửa hàng 1"), cau);
            assertFalse(cau.contains("BBGN"), cau);
            assertFalse(cau.contains("PX-TRF"), cau);
        }
        verify(bbRepo, never()).findFirstByPhieuChuyenKho_IdOrderByIdDesc(any());
        verify(bbRepo, never()).khoaTheoId(any());
        verify(bbRepo, never()).docPhuongAnXuLy(any());
        verify(anhRepo, never()).findById(any());
        verify(anhRepo, never()).countByBienBan_Id(any());
        verify(anhRepo, never()).delete(any());
        khongTaiLen();

        // Phiếu không có: 404 không nêu gì thêm, cũng chưa tìm biên bản
        when(pckRepo.findById(99)).thenReturn(Optional.empty());
        nhanVienKhoNhan();
        assertEquals("Không tìm thấy phiếu chuyển kho id: 99", loi(HttpStatus.NOT_FOUND, () -> service.them(99, anhJpeg(), null)).getMessage());
        loi(HttpStatus.NOT_FOUND, () -> service.xoa(99, 11));
        verify(bbRepo, never()).findFirstByPhieuChuyenKho_IdOrderByIdDesc(any());
    }

    @Test
    @DisplayName("Xóa: kiểm thuộc kho nhận và kho đang chọn trước khi khóa dòng biên bản")
    void xoa_kiemQuyenTruocKhiKhoa() {
        nhanVienKhoNhan();
        anh(11, NGUOI);
        service.xoa(PCK, 11);
        InOrder thuTu = inOrder(pckRepo, pqRepo, bbRepo, anhRepo);
        thuTu.verify(pckRepo).findById(PCK);
        thuTu.verify(pqRepo).findByNguoiDungIdAndActive(NGUOI);
        thuTu.verify(bbRepo).findFirstByPhieuChuyenKho_IdOrderByIdDesc(PCK);
        thuTu.verify(bbRepo).khoaTheoId(BB);
        thuTu.verify(anhRepo).findById(11);

        // Thuộc kho nhận nhưng đang đứng ở kho khác: bị nhắc chọn đúng kho, chưa khóa dòng
        dangNhap(IRoleType.quan_ly_kho, khoKhac, cuaHang, khoKhac);
        clearInvocations(bbRepo, anhRepo);
        assertTrue(loi(HttpStatus.FORBIDDEN, () -> service.xoa(PCK, 11)).getMessage().contains("kho khác kho đang chọn"));
        verify(bbRepo, never()).khoaTheoId(any());
        verify(anhRepo, never()).findById(any());
    }

    // ══════════════════════════ Đọc ══════════════════════════

    @Test
    @DisplayName("Danh sách ảnh: chưa có bảng bien_ban_giao_nhan_anh (lỗi SQL) → rỗng, không ném lỗi; đọc trong giao dịch chỉ đọc REQUIRES_NEW riêng")
    void danhSach_loiBangChuaCo_traRong() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        when(anhRepo.danhSachTheoBienBan(BB)).thenThrow(new InvalidDataAccessResourceUsageException(
                "Table 'fashion_system.bien_ban_giao_nhan_anh' doesn't exist"));

        List<PhieuChuyenKhoDto.AnhBienBan> ds = assertDoesNotThrow(() -> service.danhSach(bb, phieu, SecurityContextHolder.getUser()));

        assertTrue(ds.isEmpty());
        // Truy vấn lỗi nằm trong giao dịch riêng (tạm treo giao dịch của chi tiết phiếu) và chỉ giao dịch đó hoàn tác
        ArgumentCaptor<TransactionDefinition> dn = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager).getTransaction(dn.capture());
        assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, dn.getValue().getPropagationBehavior());
        assertTrue(dn.getValue().isReadOnly());
        verify(txManager).rollback(any());
        verify(txManager, never()).commit(any());

        // Đọc được: giao dịch riêng commit, trả ảnh như thường
        reset(anhRepo);
        clearInvocations(txManager);
        BienBanGiaoNhanAnh a = anh(11, NGUOI);
        when(anhRepo.danhSachTheoBienBan(BB)).thenReturn(List.of(a));
        assertEquals(1, service.danhSach(bb, phieu, SecurityContextHolder.getUser()).size());
        verify(txManager).commit(any());
        verify(txManager, never()).rollback(any());

        // Lỗi không phải truy cập dữ liệu (lỗi lập trình) vẫn ném ra, không nuốt
        when(anhRepo.danhSachTheoBienBan(BB)).thenThrow(new IllegalStateException("lỗi khác"));
        assertThrows(IllegalStateException.class, () -> service.danhSach(bb, phieu, SecurityContextHolder.getUser()));
    }

    @Test
    @DisplayName("Danh sách ảnh cho chi tiết phiếu: URL HTTPS (thiếu đường dẫn thì dựng từ tên đối tượng), mô tả, người, ngày chụp")
    void danhSach_dto() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong); // kho xuất: xem được, không xóa được
        BienBanGiaoNhanAnh a1 = anh(11, NGUOI);
        BienBanGiaoNhanAnh a2 = anh(12, NGUOI_KHAC);
        a2.getTepTin().setDuongDan(null);
        when(anhRepo.danhSachTheoBienBan(BB)).thenReturn(List.of(a1, a2));

        List<PhieuChuyenKhoDto.AnhBienBan> ds = service.danhSach(bb, phieu, SecurityContextHolder.getUser());

        assertEquals(2, ds.size());
        assertEquals(11, ds.get(0).getId());
        assertEquals("https://minio.slmglobal.vn/fashion/bien-ban-giao-nhan/80/11.jpg", ds.get(0).getUrl());
        assertEquals("https://minio.slmglobal.vn/fashion/bien-ban-giao-nhan/80/12.jpg", ds.get(1).getUrl());
        assertEquals("Ảnh 11", ds.get(0).getMoTa());
        assertEquals("Người 9", ds.get(1).getNguoiChup());
        assertEquals(Instant.parse("2026-10-28T03:00:00Z"), ds.get(0).getNgayChup());
        assertFalse(ds.get(0).isDuocXoa(), "kho xuất không xóa được kể cả ảnh mang id của mình");

        assertTrue(service.danhSach(null, phieu, SecurityContextHolder.getUser()).isEmpty());
    }
}
