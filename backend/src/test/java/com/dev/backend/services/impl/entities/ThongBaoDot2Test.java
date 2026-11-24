package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.entities.*;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import com.dev.backend.services.impl.entities.ThongBaoService.TomTat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Thông báo đợt 2: hạ tầng (dòng tóm tắt, đánh dấu đã xử lý, gửi sau rollback) và các sự kiện M4–M7, X1, X4, X4b, X5,
 * B2–B4. Bảng thong_bao là một danh sách trong bộ nhớ (repository giả có giữ trạng thái, có khóa duy nhất (người, khóa)).
 * Kho: Kho tổng = 1 (quản lý 11, nhân viên kho 61, nhân viên mua hàng 45), Cửa hàng 1 = 2 (quản lý 21, nhân viên kho 62).
 * Quản trị viên 1, 2. Nhân viên mua hàng 40, 50. Nhân viên bán hàng 70.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ThongBaoDot2Test {

    private static final int KHO_TONG = 1, CUA_HANG = 2;

    @Mock private ThongBaoRepository thongBaoRepo;
    @Mock private PlatformTransactionManager txManager;
    @Mock private PhanQuyenNguoiDungKhoRepository pqRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private KhoRepository khoRepo;
    @Mock private DonBanHangRepository donRepo;
    @Mock private ChiTietNhatHangRepository ctnRepo;
    @Mock private QuyenHanRepository quyenHanRepo;
    private ThongBaoThanhToanService thanhToan;
    private ThongBaoHeThongService heThong;

    private ThongBaoService thongBao;
    private ThongBaoMuaHangService muaHang;
    private ThongBaoXuatKhoService xuatKho;
    private Kho khoTong, cuaHang;
    /** Bảng thong_bao giả. */
    private final List<ThongBao> bang = new ArrayList<>();
    private long idKe = 1;

    @BeforeEach
    void setUp() {
        thongBao = new ThongBaoService(thongBaoRepo, txManager);
        NguoiNhanThongBao nguoiNhan = new NguoiNhanThongBao(pqRepo, ndRepo);
        muaHang = new ThongBaoMuaHangService(thongBao, nguoiNhan, khoRepo, ndRepo);
        xuatKho = new ThongBaoXuatKhoService(thongBao, nguoiNhan, khoRepo, ndRepo, donRepo, ctnRepo);
        thanhToan = new ThongBaoThanhToanService(thongBao, nguoiNhan, khoRepo, ndRepo);
        heThong = new ThongBaoHeThongService(thongBao, nguoiNhan, quyenHanRepo);

        khoTong = Kho.builder().id(KHO_TONG).tenKho("Kho tổng").loaiKho("kho_tong").build();
        cuaHang = Kho.builder().id(CUA_HANG).tenKho("Cửa hàng 1").loaiKho("cua_hang").build();
        when(khoRepo.findById(KHO_TONG)).thenReturn(Optional.of(khoTong));
        when(khoRepo.findById(CUA_HANG)).thenReturn(Optional.of(cuaHang));
        theoKho(KHO_TONG, IRoleType.quan_ly_kho, 11);
        theoKho(KHO_TONG, IRoleType.nhan_vien_kho, 61);
        theoKho(KHO_TONG, IRoleType.nhan_vien_mua_hang, 45);
        theoKho(CUA_HANG, IRoleType.quan_ly_kho, 21);
        theoKho(CUA_HANG, IRoleType.nhan_vien_kho, 62);
        when(ndRepo.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien)).thenReturn(List.of(1, 2));
        vaiTro(IRoleType.quan_tri_vien, 1, 2);
        vaiTro(IRoleType.nhan_vien_mua_hang, 40, 45, 50);
        vaiTro(IRoleType.nhan_vien_kho, 60, 61, 62);
        vaiTro(IRoleType.quan_ly_kho, 11, 21);
        vaiTro(IRoleType.nhan_vien_ban_hang, 70);
        bangGia();
    }

    @AfterEach
    void donDongBo() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ══════════════════════════ Bảng thong_bao giả ══════════════════════════

    private void theoKho(int kho, String vt, Integer... ids) {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(kho)), eq(vt), any())).thenReturn(List.of(ids));
    }

    private void vaiTro(String vt, int... ids) {
        for (int id : ids) {
            when(ndRepo.findById(id)).thenReturn(Optional.of(
                    NguoiDung.builder().id(id).vaiTro(vt).hoTen("Người " + id).trangThai(1).build()));
        }
    }

    /** Repository giả có trạng thái: save thêm/sửa (khóa duy nhất (người, khóa)), các câu đọc / sửa theo id. */
    private void bangGia() {
        when(thongBaoRepo.save(any(ThongBao.class))).thenAnswer(inv -> {
            ThongBao t = inv.getArgument(0);
            if (t.getId() == null) {
                boolean trung = bang.stream().anyMatch(x -> x.getNguoiNhanId().equals(t.getNguoiNhanId())
                        && x.getKhoaSuKien().equals(t.getKhoaSuKien()));
                if (trung) throw new org.springframework.dao.DataIntegrityViolationException("uk_thong_bao_nguoi_su_kien");
                t.setId(idKe++);
                bang.add(t);
            }
            return t;
        });
        when(thongBaoRepo.nguoiDaCoSuKien(anyString(), any())).thenAnswer(inv -> {
            String k = inv.getArgument(0);
            Collection<Integer> ids = inv.getArgument(1);
            return bang.stream().filter(x -> x.getKhoaSuKien().equals(k) && ids.contains(x.getNguoiNhanId()))
                    .map(ThongBao::getNguoiNhanId).toList();
        });
        when(thongBaoRepo.findByNguoiNhanIdAndKhoaSuKien(anyInt(), anyString())).thenAnswer(inv -> bang.stream()
                .filter(x -> x.getNguoiNhanId().equals(inv.getArgument(0)) && x.getKhoaSuKien().equals(inv.getArgument(1)))
                .findFirst());
        when(thongBaoRepo.idTheoKhoa(anyString())).thenAnswer(inv -> bang.stream()
                .filter(x -> x.getKhoaSuKien().equals(inv.getArgument(0))).map(ThongBao::getId).toList());
        when(thongBaoRepo.idChuaDocTheoKhoa(anyString())).thenAnswer(inv -> bang.stream()
                .filter(x -> x.getKhoaSuKien().equals(inv.getArgument(0)) && !x.getDaDoc()).map(ThongBao::getId).toList());
        when(thongBaoRepo.idChuaDocTheoTienTo(anyString())).thenAnswer(inv -> {
            String mau = inv.getArgument(0);
            String tienTo = mau.substring(0, mau.length() - 1).replace("\\_", "_").replace("\\%", "%").replace("\\\\", "\\");
            return bang.stream().filter(x -> x.getKhoaSuKien().startsWith(tienTo) && !x.getDaDoc()).map(ThongBao::getId).toList();
        });
        when(thongBaoRepo.danhDauDaDocTheoIds(any())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            int n = 0;
            for (ThongBao x : bang) if (ids.contains(x.getId()) && !x.getDaDoc()) { x.setDaDoc(true); n++; }
            return n;
        });
        when(thongBaoRepo.capNhatChuCacDong(any(), any(), any(), any(), any())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            for (ThongBao x : bang) {
                if (ids.contains(x.getId())) {
                    x.setTone(inv.getArgument(1));
                    x.setTieuDe(inv.getArgument(2));
                    x.setMoTa(inv.getArgument(3));
                    x.setDuongDan(inv.getArgument(4));
                }
            }
            return ids.size();
        });
    }

    private List<ThongBao> cua(String khoa) {
        return bang.stream().filter(t -> t.getKhoaSuKien().equals(khoa)).toList();
    }

    private Set<Integer> nguoiNhan(String khoa) {
        return cua(khoa).stream().map(ThongBao::getNguoiNhanId).collect(Collectors.toCollection(TreeSet::new));
    }

    private ThongBao cuaNguoi(String khoa, int id) {
        return cua(khoa).stream().filter(t -> t.getNguoiNhanId() == id).findFirst()
                .orElseThrow(() -> new AssertionError("Người " + id + " không có thông báo " + khoa));
    }

    private Set<Integer> nguoiNhanTienTo(String tienTo) {
        return bang.stream().filter(t -> t.getKhoaSuKien().startsWith(tienTo)).map(ThongBao::getNguoiNhanId)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private static NoiDung nd(String khoa, String tieuDe) {
        return new NoiDung(ThongBaoService.LOAI_DON_BAN_HANG, ThongBaoService.TONE_INFO, tieuDe, "mô tả", "/x",
                ThongBaoService.LOAI_DON_BAN_HANG, null, null, khoa);
    }

    private void giaoDichDangMo() {
        TransactionSynchronizationManager.initSynchronization();
    }

    private void ketThucGiaoDich(int trangThai) {
        List<TransactionSynchronization> ds = TransactionSynchronizationManager.getSynchronizations();
        TransactionSynchronizationManager.clearSynchronization();
        for (TransactionSynchronization s : ds) {
            if (trangThai == TransactionSynchronization.STATUS_COMMITTED) s.afterCommit();
            s.afterCompletion(trangThai);
        }
    }

    // ══════════════════════════ Hạ tầng: dòng tóm tắt ══════════════════════════

    @Test
    @DisplayName("Tóm tắt: lần đầu thêm dòng cho người nhận (trừ người thao tác); lần sau sửa chữ, hiện lại chưa đọc, giữ 1 dòng")
    void tomTat_themRoiSua() {
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61, 70), 70, nd("DCX:1", "2 đơn"), true));
        assertEquals(Set.of(11, 61), nguoiNhan("DCX:1"));

        cuaNguoi("DCX:1", 11).setDaDoc(true);
        Instant cu = cuaNguoi("DCX:1", 11).getNgayTao();
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61), null, nd("DCX:1", "3 đơn"), true));
        assertEquals(2, cua("DCX:1").size());
        ThongBao t = cuaNguoi("DCX:1", 11);
        assertEquals("3 đơn", t.getTieuDe());
        assertFalse(t.getDaDoc());
        assertFalse(t.getNgayTao().isBefore(cu));
    }

    @Test
    @DisplayName("Tóm tắt baoMoi=false: chỉ sửa chữ, giữ trạng thái đã đọc; người chưa có dòng thì không thêm")
    void tomTat_chiSuaChu() {
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11), null, nd("DCX:1", "3 đơn"), true));
        cuaNguoi("DCX:1", 11).setDaDoc(true);
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61), null, nd("DCX:1", "1 đơn"), false));
        assertEquals(Set.of(11), nguoiNhan("DCX:1"));
        assertEquals("1 đơn", cuaNguoi("DCX:1", 11).getTieuDe());
        assertTrue(cuaNguoi("DCX:1", 11).getDaDoc());
    }

    @Test
    @DisplayName("Tóm tắt: người thao tác không bị đẩy lên chưa đọc nhưng vẫn thấy số mới")
    void tomTat_nguoiThaoTacThaySoMoi() {
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61), null, nd("DCX:1", "2 đơn"), true));
        cuaNguoi("DCX:1", 61).setDaDoc(true);
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61), 61, nd("DCX:1", "5 đơn"), true));
        assertEquals("5 đơn", cuaNguoi("DCX:1", 61).getTieuDe());
        assertTrue(cuaNguoi("DCX:1", 61).getDaDoc());
        assertFalse(cuaNguoi("DCX:1", 11).getDaDoc());
    }

    @Test
    @DisplayName("Tóm tắt hết việc (nội dung null): mọi dòng của khóa thành đã đọc")
    void tomTat_hetViec() {
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11, 61), null, nd("DCX:1", "2 đơn"), true));
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(), null, null, false));
        assertTrue(cua("DCX:1").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("Tóm tắt: hai máy cùng thêm (vướng khóa duy nhất) → máy sau sửa lại dòng có sẵn, không lỗi")
    void tomTat_vuongKhoaDuyNhat() {
        bang.add(ThongBao.builder().id(idKe++).nguoiNhanId(11).khoaSuKien("DCX:1").tieuDe("cũ").moTa("").loai("don_hang")
                .daDoc(true).ngayTao(Instant.EPOCH).build());
        // Lần tìm đầu không thấy (máy kia vừa thêm xong) → thêm vướng khóa → thử lại thì thấy và sửa
        when(thongBaoRepo.findByNguoiNhanIdAndKhoaSuKien(11, "DCX:1")).thenReturn(Optional.empty())
                .thenAnswer(inv -> bang.stream().filter(x -> x.getNguoiNhanId() == 11).findFirst());
        assertDoesNotThrow(() -> thongBao.capNhatTomTatSauCommit("t",
                () -> new TomTat("DCX:1", List.of(11), null, nd("DCX:1", "4 đơn"), true)));
        assertEquals(1, cua("DCX:1").size());
        assertEquals("4 đơn", cuaNguoi("DCX:1", 11).getTieuDe());
        assertFalse(cuaNguoi("DCX:1", 11).getDaDoc());
    }

    @Test
    @DisplayName("Tóm tắt trong giao dịch: chỉ ghi sau commit; rollback không ghi")
    void tomTat_sauCommit() {
        giaoDichDangMo();
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11), null, nd("DCX:1", "1 đơn"), true));
        assertTrue(bang.isEmpty());
        ketThucGiaoDich(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertTrue(bang.isEmpty());

        giaoDichDangMo();
        thongBao.capNhatTomTatSauCommit("t", () -> new TomTat("DCX:1", List.of(11), null, nd("DCX:1", "1 đơn"), true));
        ketThucGiaoDich(TransactionSynchronization.STATUS_COMMITTED);
        assertEquals(Set.of(11), nguoiNhan("DCX:1"));
    }

    // ══════════════════════════ Hạ tầng: đã xử lý, gửi sau rollback ══════════════════════════

    @Test
    @DisplayName("daXuLy: đúng khóa thành đã đọc; theo tiền tố không lẫn khóa khác số (PL:1: không chạm PL:12:)")
    void daXuLy() {
        thongBao.guiSauCommit("a", () -> List.of(
                new GuiDi(List.of(11, 21), null, nd("YCNH:5:CHO_DUYET", "a")),
                new GuiDi(List.of(11), null, nd("PL:1:THIEU_LO:7:20261101", "b")),
                new GuiDi(List.of(11), null, nd("PL:12:THIEU_LO:7:20261101", "c"))));
        thongBao.daXuLySauCommit("YCNH:5:CHO_DUYET");
        thongBao.daXuLyTheoTienToSauCommit("PL:1:THIEU_LO:");
        assertTrue(cua("YCNH:5:CHO_DUYET").stream().allMatch(ThongBao::getDaDoc));
        assertTrue(cuaNguoi("PL:1:THIEU_LO:7:20261101", 11).getDaDoc());
        assertFalse(cuaNguoi("PL:12:THIEU_LO:7:20261101", 11).getDaDoc());
    }

    @Test
    @DisplayName("mauBatDauBang: thoát _ % \\ để LIKE không khớp nhầm")
    void mauBatDauBang() {
        assertEquals("PL:1:THIEU\\_LO:%", ThongBaoService.mauBatDauBang("PL:1:THIEU_LO:"));
        assertEquals("A\\%B\\\\%", ThongBaoService.mauBatDauBang("A%B\\"));
    }

    @Test
    @DisplayName("guiSauRollback: giao dịch hoàn tác thì gửi, commit thì không; không có giao dịch thì gửi ngay")
    void guiSauRollback() {
        Supplier<List<GuiDi>> lap = () -> List.of(new GuiDi(List.of(11), null, nd("X:1", "lỗi")));
        giaoDichDangMo();
        thongBao.guiSauRollback("r", lap);
        ketThucGiaoDich(TransactionSynchronization.STATUS_COMMITTED);
        assertTrue(bang.isEmpty());

        giaoDichDangMo();
        thongBao.guiSauRollback("r", lap);
        assertTrue(bang.isEmpty());
        ketThucGiaoDich(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertEquals(Set.of(11), nguoiNhan("X:1"));

        bang.clear();
        thongBao.guiSauRollback("r", lap);
        assertEquals(Set.of(11), nguoiNhan("X:1"));
    }

    @Test
    @DisplayName("Nhóm loại mới: đủ tên nhóm và quy về cột loai_thong_bao hợp lệ")
    void loaiMoi() {
        for (String ma : List.of(ThongBaoService.LOAI_PHIEU_XUAT_KHO, ThongBaoService.LOAI_THANH_TOAN_QR,
                ThongBaoService.LOAI_KENH_BAN_HANG, ThongBaoService.LOAI_NGUOI_DUNG)) {
            assertNotNull(ThongBaoService.NHOM_THEO_LOAI.get(ma), ma);
            assertTrue(ThongBaoService.LOAI_LUOC_DO.contains(ThongBaoService.LOAI_LUOC_DO_THEO_MA.get(ma)), ma);
        }
    }

    // ══════════════════════════ M4 / M5 / M6 / M7 ══════════════════════════

    private YeuCauMuaHang yeuCau() {
        return YeuCauMuaHang.builder().id(5).soYeuCauMuaHang("PR202611010005").khoNhap(khoTong)
                .nguoiTao(NguoiDung.builder().id(40).build()).build();
    }

    private DonMuaHang donMua(int id, int nguoiTao) {
        return DonMuaHang.builder().id(id).soDonMua("DM010" + id).khoNhap(khoTong)
                .nhaCungCap(NhaCungCap.builder().id(8).tenNhaCungCap("May Việt Tiến").build())
                .nguoiTao(NguoiDung.builder().id(nguoiTao).build()).yeuCauMuaHang(yeuCau())
                .ngayGiaoDuKien(Instant.parse("2026-11-05T03:00:00Z")).build();
    }

    @Test
    @DisplayName("M4 + M5: chấp nhận báo giá → báo giá của mọi đơn cùng yêu cầu thành đã đọc; kho nhập nhận 'chuẩn bị nhận hàng'")
    void m5_chotBaoGia() {
        muaHang.baoGiaMoi(donMua(30, 50), yeuCau(), Instant.parse("2026-11-01T03:00:00Z"), false);
        muaHang.baoGiaMoi(donMua(31, 50), yeuCau(), Instant.parse("2026-11-01T04:00:00Z"), false);
        muaHang.daXetBaoGia(donMua(30, 50), List.of(donMua(31, 50)), true, NguoiDung.builder().id(50).hoTen("Người 50").build());

        assertTrue(bang.stream().filter(t -> t.getKhoaSuKien().startsWith("DMH:30:BAO_GIA:")
                || t.getKhoaSuKien().startsWith("DMH:31:BAO_GIA:")).allMatch(ThongBao::getDaDoc));
        assertEquals(Set.of(11, 61), nguoiNhan("DMH:30:CHAP_NHAN"));
        ThongBao t = cuaNguoi("DMH:30:CHAP_NHAN", 61);
        assertEquals("Đơn mua hàng DM01030 đã chốt, chờ nhận hàng", t.getTieuDe());
        assertEquals("May Việt Tiến, giao dự kiến 05/11/2026. Tạo phiếu nhập khi hàng về.", t.getMoTa());
        assertEquals("/purchase-orders/30", t.getDuongDan());
    }

    @Test
    @DisplayName("M4: không chấp nhận báo giá → chỉ đánh dấu đã đọc, không báo kho")
    void m4_khongChapNhan() {
        muaHang.baoGiaMoi(donMua(30, 50), yeuCau(), Instant.parse("2026-11-01T03:00:00Z"), false);
        muaHang.daXetBaoGia(donMua(30, 50), List.of(), false, NguoiDung.builder().id(50).build());
        assertTrue(bang.stream().allMatch(ThongBao::getDaDoc));
        assertTrue(cua("DMH:30:CHAP_NHAN").isEmpty());
    }

    @Test
    @DisplayName("M5: không có ngày giao dự kiến thì bỏ vế ngày")
    void m5_khongNgayGiao() {
        DonMuaHang d = donMua(30, 50);
        d.setNgayGiaoDuKien(null);
        muaHang.daXetBaoGia(d, List.of(), true, null);
        assertEquals("May Việt Tiến. Tạo phiếu nhập khi hàng về.", cuaNguoi("DMH:30:CHAP_NHAN", 11).getMoTa());
    }

    private PhieuNhapKho phieuNhap(DonMuaHang don) {
        return PhieuNhapKho.builder().id(80).soPhieuNhap("PN202611010001").kho(khoTong).donMuaHang(don)
                .nhaCungCap(don == null ? null : don.getNhaCungCap()).build();
    }

    private BienBanTraHangNcc bienBan(String phuongAn, int soLoi) {
        BienBanTraHangNcc bb = new BienBanTraHangNcc();
        bb.setId(90);
        bb.setMaBienBan("RTV-202611-0001");
        bb.setPhuongAnXuLy(phuongAn);
        bb.setTongSoLuongLoi(soLoi);
        return bb;
    }

    @Test
    @DisplayName("M6 (lúc nhập kho): người lập đơn mua là NV mua hàng → nhận 'chờ nhà cung cấp trả lời'; nhân viên kho vừa nhập kho không nhận")
    void m6_nguoiLapDonMua() {
        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 6), phieuNhap(donMua(30, 50)), 61);
        assertEquals(Set.of(50), nguoiNhan("BBTH:90"));
        ThongBao t = cuaNguoi("BBTH:90", 50);
        assertEquals("Hàng lỗi đơn mua DM01030 chờ nhà cung cấp trả lời", t.getTieuDe());
        assertEquals("6 sản phẩm lỗi ở phiếu nhập PN202611010001 (biên bản RTV-202611-0001, May Việt Tiến). "
                + "Nhà cung cấp chọn trên Cổng nhà cung cấp trong 7 ngày từ khi nhận email; quá hạn thì tự chuyển trừ tiền.",
                t.getMoTa());
        assertEquals("/purchase-orders/30", t.getDuongDan());
        assertEquals(ThongBaoService.TONE_WARNING, t.getTone());
    }

    @Test
    @DisplayName("M6: người lập đơn mua là nhân viên kho (không chốt được với NCC) → NV mua hàng kho nhập")
    void m6_nguoiLapLaNhanVienKho() {
        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 2), phieuNhap(donMua(30, 60)), 61);
        assertEquals(Set.of(45), nguoiNhan("BBTH:90"));
        ThongBao t = cuaNguoi("BBTH:90", 45);
        assertTrue(t.getMoTa().startsWith("2 sản phẩm lỗi ở phiếu nhập PN202611010001"), t.getMoTa());
        assertTrue(t.getMoTa().endsWith("quá hạn thì tự chuyển trừ tiền."), t.getMoTa());
        assertFalse(t.getMoTa().contains("chốt tay"), "không còn ai bên mua chốt thay nhà cung cấp");
    }

    @Test
    @DisplayName("M6: người lập đơn mua tự lập biên bản → không còn ai thì NV mua hàng kho nhập; không có thì quản trị viên")
    void m6_nhanThay() {
        muaHang.bienBanTraHang(bienBan("DOI_HANG", 1), phieuNhap(donMua(30, 50)), 50);
        assertEquals(Set.of(45), nguoiNhan("BBTH:90"));

        bang.clear();
        theoKho(KHO_TONG, IRoleType.nhan_vien_mua_hang);
        muaHang.bienBanTraHang(bienBan("DOI_HANG", 1), phieuNhap(donMua(30, 50)), 50);
        assertEquals(Set.of(1, 2), nguoiNhan("BBTH:90"));
    }

    @Test
    @DisplayName("M6: báo lại không đổi gì → chỉ sửa chữ (giữ đã đọc); có thay đổi → báo lại chưa đọc; hủy → 'đã hủy' + đã đọc")
    void m6_lapLaiVaHuy() {
        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 6), phieuNhap(donMua(30, 50)), 61);
        cuaNguoi("BBTH:90", 50).setDaDoc(true);

        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 4), phieuNhap(donMua(30, 50)), 61);
        assertFalse(cuaNguoi("BBTH:90", 50).getDaDoc());
        assertEquals("Hàng lỗi đơn mua DM01030 chờ nhà cung cấp trả lời", cuaNguoi("BBTH:90", 50).getTieuDe());
        assertTrue(cuaNguoi("BBTH:90", 50).getMoTa().startsWith("4 sản phẩm lỗi"));
        assertEquals(ThongBaoService.TONE_WARNING, cuaNguoi("BBTH:90", 50).getTone());
        assertEquals(1, cua("BBTH:90").size(), "cùng một dòng, không gửi trùng");

        muaHang.bienBanDaHuy(bienBan("CHO_CHOT", 6), phieuNhap(donMua(30, 50)), false, 61);
        ThongBao t = cuaNguoi("BBTH:90", 50);
        assertEquals("Biên bản trả hàng RTV-202611-0001 đã hủy", t.getTieuDe());
        assertTrue(t.getDaDoc());
        assertEquals(1, cua("BBTH:90").size());
    }

    private BienBanTraHangNcc bienBanCoNcc(int id, String phuongAn, int soLoi) {
        BienBanTraHangNcc bb = bienBan(phuongAn, soLoi);
        bb.setId(id);
        bb.setNhaCungCap(NhaCungCap.builder().id(8).tenNhaCungCap("May Việt Tiến").build());
        return bb;
    }

    @Test
    @DisplayName("M6c: nhà cung cấp trả lời trên cổng → báo người lập đơn mua (một dòng, trả lời lại thì sửa chữ); có cách bù thì 'chờ nhà cung cấp' đã đọc")
    void m6c_nccDaTraLoi() {
        PhieuNhapKho nhap = phieuNhap(donMua(30, 50));
        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 6), nhap, 61);
        assertFalse(cuaNguoi("BBTH:90", 50).getDaDoc());

        // Chỉ chọn hàng lỗi (cách bù còn chờ, phiếu còn Nháp): chưa coi như xong
        muaHang.nccDaTraLoi(bienBanCoNcc(90, "CHO_CHOT", 6), nhap, 0, 0, 6, 0, true);
        assertEquals(Set.of(50), nguoiNhan("BBTH:90:NCC"));
        ThongBao t = cuaNguoi("BBTH:90:NCC", 50);
        assertEquals("May Việt Tiến trả lời biên bản trả hàng RTV-202611-0001", t.getTieuDe());
        assertEquals("6 sản phẩm lỗi ở phiếu nhập PN202611010001, đơn mua DM01030: nhận lại hàng lỗi. "
                + "Áp vào đơn mua khi phiếu nhập kho.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_INFO, t.getTone());
        assertEquals("/purchase-orders/30", t.getDuongDan());
        assertFalse(cuaNguoi("BBTH:90", 50).getDaDoc(), "cách bù còn chờ");

        // Phiếu đã nhập, chọn trừ tiền + tiêu hủy: sửa cùng dòng, báo lại chưa đọc; 'chờ nhà cung cấp' đã đọc
        t.setDaDoc(true);
        nhap.setTrangThai(3);
        muaHang.nccDaTraLoi(bienBanCoNcc(90, "TRU_CONG_NO", 6), nhap, 0, 6, 0, 6, false);
        assertEquals(1, cua("BBTH:90:NCC").size());
        t = cuaNguoi("BBTH:90:NCC", 50);
        assertEquals("6 sản phẩm lỗi ở phiếu nhập PN202611010001, đơn mua DM01030: trừ tiền hàng, đồng ý tiêu hủy hàng lỗi. "
                + "Đã áp vào đơn mua.", t.getMoTa());
        assertFalse(t.getDaDoc());
        assertTrue(cuaNguoi("BBTH:90", 50).getDaDoc());

        muaHang.nccDaTraLoi(bienBanCoNcc(90, "DOI_HANG", 6), nhap, 6, 0, 0, 0, false);
        assertTrue(cuaNguoi("BBTH:90:NCC", 50).getMoTa().contains(": giao bù hàng. "), cuaNguoi("BBTH:90:NCC", 50).getMoTa());

        // Chọn khác nhau theo dòng: kèm số sản phẩm của từng cách
        muaHang.nccDaTraLoi(bienBanCoNcc(90, "HON_HOP", 6), nhap, 4, 2, 5, 1, false);
        assertEquals("6 sản phẩm lỗi ở phiếu nhập PN202611010001, đơn mua DM01030: giao bù 4 sản phẩm, trừ tiền 2 sản phẩm, "
                + "nhận lại 5 sản phẩm lỗi, đồng ý tiêu hủy 1 sản phẩm lỗi. Đã áp vào đơn mua.",
                cuaNguoi("BBTH:90:NCC", 50).getMoTa());
        assertEquals(1, cua("BBTH:90:NCC").size(), "vẫn sửa cùng một thông báo");

        // Phiếu không thuộc đơn mua: không báo
        bang.clear();
        muaHang.nccDaTraLoi(bienBanCoNcc(90, "DOI_HANG", 6), phieuNhap(null), 6, 0, 6, 0, false);
        assertTrue(bang.isEmpty());
    }

    @Test
    @DisplayName("M6c: quá hạn trả lời tự chuyển trừ tiền → báo mua hàng (cảnh báo, cùng khóa với câu trả lời của NCC); 'chờ nhà cung cấp' đã đọc")
    void m6c_quaHanTruTien() {
        PhieuNhapKho nhap = phieuNhap(donMua(30, 50));
        muaHang.bienBanTraHang(bienBan("CHO_CHOT", 6), nhap, 61);
        muaHang.quaHanTruTien(bienBanCoNcc(90, "TRU_CONG_NO", 6), nhap, 6, 0);
        assertEquals(Set.of(50), nguoiNhan("BBTH:90:NCC"));
        ThongBao t = cuaNguoi("BBTH:90:NCC", 50);
        assertEquals("Biên bản RTV-202611-0001 quá hạn trả lời, đã chuyển trừ tiền", t.getTieuDe());
        assertEquals("May Việt Tiến không trả lời trong 7 ngày. 6 sản phẩm lỗi ở phiếu nhập PN202611010001 chuyển sang "
                + "trừ tiền hàng.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_WARNING, t.getTone());
        assertTrue(cuaNguoi("BBTH:90", 50).getDaDoc());

        // Có dòng đơn đã nhận đủ (coi như đã giao bù): nói cả hai số, sửa cùng thông báo
        muaHang.quaHanTruTien(bienBanCoNcc(90, "HON_HOP", 6), nhap, 4, 2);
        assertEquals(1, cua("BBTH:90:NCC").size());
        assertEquals("May Việt Tiến không trả lời trong 7 ngày. Ở phiếu nhập PN202611010001: 4 sản phẩm lỗi chuyển sang "
                + "trừ tiền hàng, 2 sản phẩm coi như đã giao bù vì đơn đã nhận đủ số này.", cuaNguoi("BBTH:90:NCC", 50).getMoTa());
    }

    @Test
    @DisplayName("M6b: NCC chọn nhận lại → quản lý + nhân viên kho đi giao trả; đồng ý tiêu hủy → chỉ quản lý kho; bỏ người thao tác; kho ghi xong → đã đọc")
    void m6b_hangLoiCanXuLy() {
        PhieuNhapKho nhap = phieuNhap(donMua(30, 50));
        muaHang.hangLoiCanXuLy(bienBanCoNcc(90, "DOI_HANG", 6), nhap, 6, 0, null);
        assertEquals(Set.of(11, 61), nguoiNhan("BBTH:90:TRA"));
        ThongBao t = cuaNguoi("BBTH:90:TRA", 61);
        assertEquals("Giao trả hàng lỗi biên bản RTV-202611-0001", t.getTieuDe());
        assertEquals("6 sản phẩm lỗi của May Việt Tiến (phiếu nhập PN202611010001) đang ở kho. Nhà cung cấp chọn nhận "
                + "lại hàng lỗi.", t.getMoTa());
        assertEquals("/goods-receipts/80", t.getDuongDan());
        assertEquals(ThongBaoService.TONE_WARNING, t.getTone());

        muaHang.hangLoiCanXuLy(bienBanCoNcc(91, "TRU_CONG_NO", 2), nhap, 0, 2, null);
        assertEquals(Set.of(11), nguoiNhan("BBTH:91:TRA"), "tiêu hủy: chỉ quản lý kho được ghi");
        assertEquals("Tiêu hủy hàng lỗi biên bản RTV-202611-0001", cuaNguoi("BBTH:91:TRA", 11).getTieuDe());
        assertEquals("2 sản phẩm lỗi của May Việt Tiến (phiếu nhập PN202611010001) đang ở kho. Nhà cung cấp đồng ý tiêu "
                + "hủy.", cuaNguoi("BBTH:91:TRA", 11).getMoTa());

        // Người vừa thao tác (nhân viên kho nhập kho) không nhận
        muaHang.hangLoiCanXuLy(bienBanCoNcc(92, "DOI_HANG", 1), nhap, 1, 0, 61);
        assertEquals(Set.of(11), nguoiNhan("BBTH:92:TRA"));

        // Dòng nhận lại, dòng tiêu hủy: một thông báo nói cả hai việc, gửi cả nhân viên kho (có việc giao trả)
        muaHang.hangLoiCanXuLy(bienBanCoNcc(93, "HON_HOP", 3), nhap, 2, 1, null);
        assertEquals(Set.of(11, 61), nguoiNhan("BBTH:93:TRA"));
        assertEquals("Giao trả và tiêu hủy hàng lỗi biên bản RTV-202611-0001", cuaNguoi("BBTH:93:TRA", 11).getTieuDe());
        assertEquals("Hàng lỗi của May Việt Tiến (phiếu nhập PN202611010001) đang ở kho: giao trả 2 sản phẩm nhà cung cấp "
                + "nhận lại, tiêu hủy 1 sản phẩm nhà cung cấp đồng ý tiêu hủy.", cuaNguoi("BBTH:93:TRA", 11).getMoTa());

        // Không còn sản phẩm nào chờ kho: không báo
        muaHang.hangLoiCanXuLy(bienBanCoNcc(94, "DOI_HANG", 1), nhap, 0, 0, null);
        assertTrue(cua("BBTH:94:TRA").isEmpty());

        muaHang.hangLoiDaRoiKho(bienBanCoNcc(90, "DOI_HANG", 6));
        assertTrue(cua("BBTH:90:TRA").stream().allMatch(ThongBao::getDaDoc));
        assertFalse(cuaNguoi("BBTH:91:TRA", 11).getDaDoc());
    }

    @Test
    @DisplayName("M6: phiếu nhập không thuộc đơn mua → không báo")
    void m6_khongDonMua() {
        muaHang.bienBanTraHang(bienBan("DOI_HANG", 1), phieuNhap(null), 61);
        assertTrue(bang.isEmpty());
    }

    @Test
    @DisplayName("M7: đơn mua nhận đủ → người lập đơn + người lập yêu cầu; 'đã chốt' của kho thành đã đọc; kèm số lỗi trả NCC")
    void m7_nhanDu() {
        muaHang.daXetBaoGia(donMua(30, 50), List.of(), true, null);
        muaHang.donMuaDaNhanDu(donMua(30, 50), phieuNhap(donMua(30, 50)), NguoiDung.builder().id(61).build());

        assertTrue(cua("DMH:30:CHAP_NHAN").stream().allMatch(ThongBao::getDaDoc));
        assertEquals(Set.of(40, 50), nguoiNhan("DMH:30:DA_NHAN_DU"));
        ThongBao t = cuaNguoi("DMH:30:DA_NHAN_DU", 40);
        assertEquals("Đơn mua hàng DM01030 đã nhận đủ", t.getTieuDe());
        assertEquals("Phiếu nhập PN202611010001 tại Kho tổng.", t.getMoTa());
        assertEquals("/purchase-orders/30", t.getDuongDan());
    }

    @Test
    @DisplayName("M7: người lập yêu cầu là nhân viên bán hàng → nhận đường dẫn tới yêu cầu nhập hàng")
    void m7_nguoiLapYeuCauBanHang() {
        DonMuaHang d = donMua(30, 50);
        d.getYeuCauMuaHang().setNguoiTao(NguoiDung.builder().id(70).build());
        muaHang.donMuaDaNhanDu(d, phieuNhap(d), NguoiDung.builder().id(61).build());
        assertEquals("/purchase-orders/30", cuaNguoi("DMH:30:DA_NHAN_DU", 50).getDuongDan());
        assertEquals("/purchase-requests/5", cuaNguoi("DMH:30:DA_NHAN_DU", 70).getDuongDan());
        assertEquals("Phiếu nhập PN202611010001 tại Kho tổng.", cuaNguoi("DMH:30:DA_NHAN_DU", 70).getMoTa());
    }

    // ══════════════════════════ X1 / B3 / B4 / B2 ══════════════════════════

    private DonBanHang don(int id, Kho kho, Integer nguoiTao, KenhBanHang kenh, int trangThai) {
        return DonBanHang.builder().id(id).soDonHang("SO08" + id).khoXuat(kho).kenhBanHang(kenh).trangThai(trangThai)
                .nguoiTao(nguoiTao == null ? null : NguoiDung.builder().id(nguoiTao).build()).build();
    }

    private static KenhBanHang shopify() {
        return KenhBanHang.builder().id(3).maKenh("SHOPIFY").tenKenh("Shopify").build();
    }

    @Test
    @DisplayName("X1: gửi đơn sang kho → quản lý + nhân viên kho nhận 'N đơn chờ xuất'; tạo phiếu nhặt hết đơn → đã đọc")
    void x1_donChoXuat() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(3L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        assertEquals(Set.of(11, 61), nguoiNhan("DCX:1"));
        ThongBao t = cuaNguoi("DCX:1", 61);
        assertEquals("3 đơn chờ nhặt hàng ở Kho tổng", t.getTieuDe());
        assertEquals("Mới nhất: đơn SO0815. Tạo phiếu nhặt để xuất hàng.", t.getMoTa());
        assertEquals("/goods-issues/pending-orders", t.getDuongDan());

        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(1L);
        xuatKho.lamMoiDonChoXuat(KHO_TONG);
        assertEquals("1 đơn chờ nhặt hàng ở Kho tổng", cuaNguoi("DCX:1", 61).getTieuDe());
        assertFalse(cuaNguoi("DCX:1", 61).getDaDoc());

        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(0L);
        xuatKho.lamMoiDonChoXuat(KHO_TONG);
        assertTrue(cua("DCX:1").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("X1 đơn sàn: gửi sang kho làm giảm số 'đơn Shopify chờ gửi sang kho' của quản trị viên")
    void x1_donSanGiamB3() {
        when(donRepo.demDonSanChoGuiKho(3)).thenReturn(2L);
        xuatKho.donSanMoi(shopify());
        assertEquals(Set.of(1, 2), nguoiNhan("DSM:SHOPIFY"));
        assertEquals("2 đơn Shopify chờ gửi sang kho", cuaNguoi("DSM:SHOPIFY", 1).getTieuDe());
        assertEquals("/sales-orders?kenh=shopify&trangThai=nhap", cuaNguoi("DSM:SHOPIFY", 1).getDuongDan());

        when(donRepo.demDonSanChoGuiKho(3)).thenReturn(0L);
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(1L);
        xuatKho.donGuiSangKho(don(16, khoTong, null, shopify(), 1), 1);
        assertTrue(cua("DSM:SHOPIFY").stream().allMatch(ThongBao::getDaDoc));
        // Quản trị viên tự gửi: không phải người nhận của dòng kho nên không có DCX
        assertEquals(Set.of(11, 61), nguoiNhan("DCX:1"));
    }

    private ThongBao motDongTienTo(String tienTo, int nguoi) {
        return bang.stream().filter(t -> t.getKhoaSuKien().startsWith(tienTo) && t.getNguoiNhanId() == nguoi).findFirst()
                .orElseThrow(() -> new AssertionError("Người " + nguoi + " không có " + tienTo));
    }

    @Test
    @DisplayName("B4: gộp các đơn thiếu dòng của một lượt thành một thông báo cho quản trị viên, ghi số đơn")
    void b4_donThieuDong() {
        xuatKho.donSanThieuDong(shopify(), List.of(
                new ThongBaoXuatKhoService.DonThieuDong("SHP-1", new LinkedHashMap<>(Map.of("AO-1", 2)), false),
                new ThongBaoXuatKhoService.DonThieuDong("SHP-2", new LinkedHashMap<>(Map.of("AO-1", 1)), false),
                new ThongBaoXuatKhoService.DonThieuDong("SHP-3", Map.of(), true)));
        assertEquals(Set.of(1, 2), nguoiNhanTienTo("SKU:SHOPIFY:"));
        ThongBao t = motDongTienTo("SKU:SHOPIFY:", 1);
        assertEquals("3 đơn Shopify thiếu dòng hàng", t.getTieuDe());
        assertEquals("Đơn SHP-1, SHP-2, SHP-3. SKU chưa liên kết: AO-1 ×3. 1 đơn không lấy được dòng hàng. "
                + "Liên kết SKU để đơn sau đủ dòng; kiểm tra các đơn này trước khi gửi sang kho.", t.getMoTa());
        assertEquals("/channels/shopify/products", t.getDuongDan());
        assertEquals("Kênh bán hàng", ThongBaoService.dong(t).getNhom());
    }

    @Test
    @DisplayName("B4: nhiều đơn / nhiều mã thì ghi 3 cái đầu và số còn lại; lượt sau là thông báo mới, không đè lượt trước")
    void b4_nhieuMa() {
        Map<String, Integer> sku = new LinkedHashMap<>();
        for (int i = 1; i <= 7; i++) sku.put("M" + i, 1);
        List<ThongBaoXuatKhoService.DonThieuDong> ds = new ArrayList<>();
        for (int i = 1; i <= 5; i++) ds.add(new ThongBaoXuatKhoService.DonThieuDong("SHP-" + i, i == 1 ? sku : Map.of(), false));
        xuatKho.donSanThieuDong(shopify(), ds);
        assertTrue(motDongTienTo("SKU:SHOPIFY:", 1).getMoTa().startsWith(
                "Đơn SHP-1, SHP-2, SHP-3 và 2 đơn khác. SKU chưa liên kết: M1 ×1, M2 ×1, M3 ×1 và 4 mã khác."));
        try { Thread.sleep(2); } catch (InterruptedException ignored) { }
        xuatKho.donSanThieuDong(shopify(), List.of(new ThongBaoXuatKhoService.DonThieuDong("SHP-9", Map.of("X", 1), false)));
        // Cùng ngày: vẫn một dòng mỗi quản trị viên, chữ theo lượt mới nhất, hiện lại chưa đọc
        assertEquals(2, bang.stream().filter(t -> t.getKhoaSuKien().startsWith("SKU:SHOPIFY:")).count());
        assertEquals("1 đơn Shopify thiếu dòng hàng", motDongTienTo("SKU:SHOPIFY:", 1).getTieuDe());
        assertFalse(motDongTienTo("SKU:SHOPIFY:", 1).getDaDoc());
    }

    @Test
    @DisplayName("X1 / B3: hết việc → chữ đổi thành 'Không còn …' và đã đọc")
    void hetViec_doiChu() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(2L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(0L);
        xuatKho.lamMoiDonChoXuat(KHO_TONG);
        ThongBao t = cuaNguoi("DCX:1", 11);
        assertEquals("Không còn đơn chờ nhặt hàng ở Kho tổng", t.getTieuDe());
        assertEquals("Các đơn đã vào phiếu nhặt hoặc đã hủy.", t.getMoTa());
        assertTrue(t.getDaDoc());

        when(donRepo.demDonSanChoGuiKho(3)).thenReturn(1L);
        xuatKho.donSanMoi(shopify());
        when(donRepo.demDonSanChoGuiKho(3)).thenReturn(0L);
        xuatKho.lamMoiDonSanCho(shopify());
        assertEquals("Không còn đơn Shopify chờ gửi sang kho", cuaNguoi("DSM:SHOPIFY", 1).getTieuDe());
        assertTrue(cuaNguoi("DSM:SHOPIFY", 1).getDaDoc());
    }

    @Test
    @DisplayName("Tóm tắt: lần đếm đầu ra 0 nhưng đếm lại lúc đánh dấu đã có việc mới → không đánh dấu nhầm, báo việc mới")
    void tomTat_demLaiTruocKhiDanhDau() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(2L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        cuaNguoi("DCX:1", 11).setDaDoc(true);
        // Lần đếm 1 = 0 (đơn cuối vừa vào phiếu nhặt), lần đếm 2 = 1 (đơn mới vừa gửi sang kho chen giữa)
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(0L, 1L);
        xuatKho.lamMoiDonChoXuat(KHO_TONG);
        assertEquals("1 đơn chờ nhặt hàng ở Kho tổng", cuaNguoi("DCX:1", 11).getTieuDe());
        assertFalse(cuaNguoi("DCX:1", 61).getDaDoc());
    }

    @Test
    @DisplayName("SauCommit: việc đăng ký muộn (trong afterCommit) vẫn chạy đúng một lần ở afterCompletion")
    void sauCommit_dangKyMuon() {
        List<String> daChay = new ArrayList<>();
        giaoDichDangMo();
        com.dev.backend.utils.SauCommit.chay("ngoài", () -> {
            daChay.add("ngoài");
            com.dev.backend.utils.SauCommit.chay("trong", () -> daChay.add("trong"));
        });
        // Giả lập Spring: afterCommit chạy trên bản sao danh sách, afterCompletion lấy lại danh sách (có đồng bộ đăng ký muộn)
        List<TransactionSynchronization> truoc = new ArrayList<>(TransactionSynchronizationManager.getSynchronizations());
        for (TransactionSynchronization s : truoc) s.afterCommit();
        List<TransactionSynchronization> sau = new ArrayList<>(TransactionSynchronizationManager.getSynchronizations());
        TransactionSynchronizationManager.clearSynchronization();
        for (TransactionSynchronization s : sau) s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
        assertEquals(List.of("ngoài", "trong"), daChay);
    }

    @Test
    @DisplayName("guiNgay: ghi ngay kể cả khi đang trong giao dịch (không chờ commit)")
    void guiNgay() {
        giaoDichDangMo();
        thongBao.guiNgay("n", () -> List.of(new GuiDi(List.of(11), null, nd("N:1", "ngay"))));
        assertEquals(Set.of(11), nguoiNhan("N:1"));
    }

    @Test
    @DisplayName("B2: đơn còn Nháp → chỉ quản trị viên; đơn đã sang kho → thêm quản lý kho xuất; đơn đã xuất / hủy → không báo")
    void b2_khachYeuCauHuy() {
        KenhBanHang tiktok = KenhBanHang.builder().id(4).maKenh("TIKTOK").tenKenh("TikTok Shop").build();
        xuatKho.khachYeuCauHuy(don(20, khoTong, null, tiktok, 0), tiktok);
        assertEquals(Set.of(1, 2), nguoiNhan("DBH:20:KHACH_YEU_CAU_HUY"));
        assertEquals("Xử lý yêu cầu hủy trên TikTok Shop.", cuaNguoi("DBH:20:KHACH_YEU_CAU_HUY", 1).getMoTa());

        xuatKho.khachYeuCauHuy(don(21, cuaHang, null, tiktok, ITrangThaiDonBanHang.CHO_DONG_GOI), tiktok);
        assertEquals(Set.of(1, 2, 21), nguoiNhan("DBH:21:KHACH_YEU_CAU_HUY"));
        assertEquals("Khách yêu cầu hủy đơn SO0821", cuaNguoi("DBH:21:KHACH_YEU_CAU_HUY", 21).getTieuDe());
        assertEquals("Tạm dừng nhặt và đóng gói đơn này, chờ quản trị viên xử lý trên TikTok Shop.",
                cuaNguoi("DBH:21:KHACH_YEU_CAU_HUY", 21).getMoTa());
        assertEquals("Đơn đang bị chặn nhặt và xuất. Xử lý yêu cầu hủy trên TikTok Shop.",
                cuaNguoi("DBH:21:KHACH_YEU_CAU_HUY", 1).getMoTa());

        xuatKho.khachYeuCauHuy(don(22, cuaHang, null, tiktok, ITrangThaiDonBanHang.DA_XUAT_TOAN_BO), tiktok);
        xuatKho.khachYeuCauHuy(don(23, cuaHang, null, tiktok, ITrangThaiDonBanHang.DA_HUY), tiktok);
        assertTrue(cua("DBH:22:KHACH_YEU_CAU_HUY").isEmpty());
        assertTrue(cua("DBH:23:KHACH_YEU_CAU_HUY").isEmpty());
    }

    // ══════════════════════════ X4 / X4b / X5 ══════════════════════════

    @Test
    @DisplayName("X4: thiếu tồn theo lô → báo quản lý kho sau rollback, mỗi mã một lần/ngày; hoàn tất phiếu → đã đọc")
    void x4_thieuTonTheoLo() {
        giaoDichDangMo();
        xuatKho.thieuTonTheoLo(70, "PL-20261101-001", CUA_HANG, 7, "POLO-M", new BigDecimal("5"), new BigDecimal("3.000"), 62);
        assertTrue(bang.isEmpty());
        ketThucGiaoDich(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertEquals(Set.of(21), nguoiNhanTienTo("PL:70:THIEU_LO:7:"));
        ThongBao t = bang.get(0);
        assertEquals("Phiếu nhặt PL-20261101-001 thiếu tồn theo lô", t.getTieuDe());
        assertEquals("POLO-M: cần 5, theo lô còn 3. Phân bổ lại lô hoặc kiểm kê, rồi báo người nhặt.", t.getMoTa());
        assertEquals("/goods-issues/pick-lists/70", t.getDuongDan());

        // Bấm lại trong ngày: không thêm
        giaoDichDangMo();
        xuatKho.thieuTonTheoLo(70, "PL-20261101-001", CUA_HANG, 7, "POLO-M", new BigDecimal("5"), new BigDecimal("3"), 62);
        ketThucGiaoDich(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertEquals(1, bang.size());

        xuatKho.phieuNhatDaHoanTat(70);
        assertTrue(bang.get(0).getDaDoc());
    }

    @Test
    @DisplayName("X4: kho không có quản lý → quản trị viên")
    void x4_quanTriNhanThay() {
        theoKho(CUA_HANG, IRoleType.quan_ly_kho);
        xuatKho.thieuTonTheoLo(70, "PL-1", CUA_HANG, 7, "POLO-M", BigDecimal.ONE, BigDecimal.ZERO, 62);
        assertEquals(Set.of(1, 2), nguoiNhanTienTo("PL:70:THIEU_LO:"));
    }

    @Test
    @DisplayName("X4b: phiếu xuất cần sửa lô → quản lý kho; xuất kho / hủy phiếu → đã đọc")
    void x4b_canSuaLo() {
        xuatKho.phieuXuatCanSuaLo(55, "PXK-001", don(15, khoTong, 70, null, 7), KHO_TONG, List.of("AO-1", "AO-2"), 61);
        assertEquals(Set.of(11), nguoiNhan("PXK:55:CAN_SUA_LO"));
        ThongBao t = cuaNguoi("PXK:55:CAN_SUA_LO", 11);
        assertEquals("Phiếu xuất PXK-001 chưa đủ lô", t.getTieuDe());
        assertEquals("Đơn SO0815: AO-1, AO-2 chưa đủ lô. Chọn lô cho các dòng thiếu trước khi xuất.", t.getMoTa());
        assertEquals("/goods-issues/55", t.getDuongDan());
        assertEquals("Xuất kho", ThongBaoService.dong(t).getNhom());

        xuatKho.phieuXuatDaXong(55);
        assertTrue(t.getDaDoc());
    }

    @Test
    @DisplayName("X5: xuất đủ → người lập đơn nhận câu nhắc 'Xác nhận đã giao'; xuất một phần → không nhắc; đơn sàn → không báo")
    void x5_daXuatKho() {
        xuatKho.daXuatKho(55, "PXK-001", don(15, khoTong, 70, null, 3), ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, "GHN123", 61);
        ThongBao t = cuaNguoi("DBH:15:DA_XUAT:55", 70);
        assertEquals("Đơn SO0815 đã xuất kho", t.getTieuDe());
        assertEquals("Bấm Xác nhận đã giao khi khách nhận hàng. Phiếu xuất PXK-001, mã vận đơn GHN123.", t.getMoTa());
        assertEquals("/sales-orders/15", t.getDuongDan());
        assertEquals(ThongBaoService.TONE_SUCCESS, t.getTone());

        xuatKho.daXuatKho(56, "PXK-002", don(16, khoTong, 70, null, 2), ITrangThaiDonBanHang.DANG_XUAT_KHO, null, 61);
        assertEquals("Phiếu xuất PXK-002.", cuaNguoi("DBH:16:DA_XUAT:56", 70).getMoTa());
        assertEquals("Đơn SO0816 đã xuất một phần", cuaNguoi("DBH:16:DA_XUAT:56", 70).getTieuDe());

        xuatKho.daXuatKho(57, "PXK-003", don(17, khoTong, null, shopify(), 3), ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, null, 61);
        assertTrue(cua("DBH:17:DA_XUAT:57").isEmpty());
    }

    @Test
    @DisplayName("Hai máy: số đếm lúc soạn đã cũ (1) nhưng lúc ghi chữ đã là 2 → dòng ghi số mới nhất")
    void haiMay_ghiSoMoiNhat() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(1L, 2L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        assertEquals("2 đơn chờ nhặt hàng ở Kho tổng", cuaNguoi("DCX:1", 11).getTieuDe());
    }

    @Test
    @DisplayName("X3 cả phiếu bị hủy → thông báo thiếu tồn theo lô của phiếu thành đã đọc")
    void x3_huyPhieu_xoaThieuLo() {
        xuatKho.thieuTonTheoLo(70, "PL-1", CUA_HANG, 7, "A", BigDecimal.ONE, BigDecimal.ZERO, 62);
        DanhSachNhatHang pl = DanhSachNhatHang.builder().id(70).maPickList("PL-1").khoXuat(cuaHang)
                .nguoiNhat(NguoiDung.builder().id(62).build()).build();
        xuatKho.donHuyTrongPhieuNhat(pl, don(15, cuaHang, null, shopify(), 1),
                ThongBaoXuatKhoService.GiaiDoanHuy.DANG_NHAT, Map.of(), true);
        assertTrue(bang.stream().filter(t -> t.getKhoaSuKien().startsWith("PL:70:THIEU_LO:")).allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("H2 phân loại: mã 401/403 đứng riêng mới là lỗi xác thực; số dài có chứa 401 (40135 ms) là mất kết nối")
    void h2_phanLoaiMaHttp() {
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.XAC_THUC,
                ThongBaoHeThongService.phanLoaiLoiDayTon("Shopify trả 401 Unauthorized"));
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.XAC_THUC,
                ThongBaoHeThongService.phanLoaiLoiDayTon("HTTP 403"));
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.MAT_KET_NOI,
                ThongBaoHeThongService.phanLoaiLoiDayTon("Lỗi kết nối tới Lazada: Read timed out after 40135 ms"));
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.MAT_KET_NOI,
                ThongBaoHeThongService.phanLoaiLoiDayTon("request 1403-22 lỗi mạng"));
    }

    // ══════════════════════════ Sau review cuối ══════════════════════════

    @Test
    @DisplayName("Tóm tắt: ghi xong đếm lại thấy đã hết (máy khác vừa nhặt đơn) → tự sửa thành 'Không còn…' + đã đọc")
    void tomTat_ghiXongDemLaiThayHet() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(2L, 0L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        ThongBao t = cuaNguoi("DCX:1", 11);
        assertEquals("Không còn đơn chờ nhặt hàng ở Kho tổng", t.getTieuDe());
        assertTrue(cua("DCX:1").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("Tóm tắt: vừa đánh dấu hết mà đếm lại còn việc (đơn mới chen vào) → báo lại chưa đọc, không mất cảnh báo")
    void tomTat_hetRoiConViec() {
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(1L);
        xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70);
        cua("DCX:1").forEach(t -> t.setDaDoc(true));
        when(donRepo.demDonChoXuat(KHO_TONG)).thenReturn(0L, 1L);
        xuatKho.lamMoiDonChoXuat(KHO_TONG);
        assertEquals("1 đơn chờ nhặt hàng ở Kho tổng", cuaNguoi("DCX:1", 61).getTieuDe());
        assertFalse(cuaNguoi("DCX:1", 61).getDaDoc());
        assertFalse(cuaNguoi("DCX:1", 11).getDaDoc());
    }

    @Test
    @DisplayName("M1: đã xét yêu cầu → 'chờ duyệt' của mọi quản lý đã đọc; M4 gửi lại → báo giá cũ đã đọc, mới chưa đọc")
    void m1_m4_tuDanhDau() {
        muaHang.yeuCauChoDuyet(yeuCau(), NguoiDung.builder().id(40).hoTen("Người 40").build(), 2);
        muaHang.yeuCauDaXet(yeuCau(), true, null, NguoiDung.builder().id(11).hoTen("Người 11").build());
        assertTrue(cua("YCNH:5:CHO_DUYET").stream().allMatch(ThongBao::getDaDoc));

        muaHang.baoGiaMoi(donMua(30, 50), yeuCau(), Instant.parse("2026-11-01T03:00:00Z"), false);
        muaHang.baoGiaMoi(donMua(30, 50), yeuCau(), Instant.parse("2026-11-01T04:00:00Z"), true);
        List<ThongBao> cua50 = bang.stream()
                .filter(t -> t.getNguoiNhanId() == 50 && t.getKhoaSuKien().startsWith("DMH:30:BAO_GIA:")).toList();
        assertEquals(2, cua50.size());
        assertTrue(cua50.get(0).getDaDoc());
        assertFalse(cua50.get(1).getDaDoc());

        muaHang.yeuCauDaGuiBaoGia(5);
        assertTrue(cua("YCNH:5:DUYET").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("Hoàn trả: báo quản lý + nhân viên kho xuất lập phiếu nhập hoàn trả; B1, X5 của đơn đã đọc; lập phiếu → đã đọc")
    void hoanTra() {
        DonBanHang d = don(15, cuaHang, 70, shopify(), 3);
        xuatKho.sanHuyDonDaXuat(d, null);
        xuatKho.daXuatKho(55, "PXK-1", d, ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, null, 62);
        xuatKho.donHoanTra(d, 70);
        assertTrue(cua("DBH:15:SAN_HUY_DA_XUAT").stream().allMatch(ThongBao::getDaDoc));
        assertTrue(cua("DBH:15:DA_XUAT:55").stream().allMatch(ThongBao::getDaDoc));
        assertEquals(Set.of(21, 62), nguoiNhan("DBH:15:HOAN_TRA"));
        ThongBao t = cuaNguoi("DBH:15:HOAN_TRA", 62);
        assertEquals("Đơn SO0815 bị hoàn trả", t.getTieuDe());
        assertEquals("Khi hàng về Cửa hàng 1, lập phiếu nhập hoàn trả để cộng lại tồn.", t.getMoTa());
        assertEquals("/goods-receipts/create", t.getDuongDan());
        xuatKho.daLapPhieuNhapHoanTra(15);
        assertTrue(cua("DBH:15:HOAN_TRA").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("X5 xác nhận đã giao → đã đọc; B2 hủy đơn → đã đọc; B2 lấy tên kênh của job, không đọc proxy của đơn")
    void tuDanhDauGiaoHuy_vaTenKenh() {
        xuatKho.daXuatKho(55, "PXK-1", don(15, khoTong, 70, null, 3), ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, null, 61);
        xuatKho.donDaGiao(15);
        assertTrue(cuaNguoi("DBH:15:DA_XUAT:55", 70).getDaDoc());

        KenhBanHang proxyLoi = mock(KenhBanHang.class);
        when(proxyLoi.getTenKenh()).thenThrow(new org.hibernate.LazyInitializationException("no Session"));
        when(proxyLoi.getMaKenh()).thenThrow(new org.hibernate.LazyInitializationException("no Session"));
        KenhBanHang tiktok = KenhBanHang.builder().id(4).maKenh("TIKTOK").tenKenh("Tiktok shop tự đặt").build();
        xuatKho.khachYeuCauHuy(don(20, khoTong, null, proxyLoi, 0), tiktok);
        assertEquals("Xử lý yêu cầu hủy trên TikTok Shop.", cuaNguoi("DBH:20:KHACH_YEU_CAU_HUY", 1).getMoTa());
        xuatKho.donDaHuy(20);
        assertTrue(cua("DBH:20:KHACH_YEU_CAU_HUY").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("X1: kho không có quản lý / nhân viên kho → quản trị viên nhận thay")
    void x1_quanTriNhanThay() {
        theoKho(CUA_HANG, IRoleType.quan_ly_kho);
        theoKho(CUA_HANG, IRoleType.nhan_vien_kho);
        when(donRepo.demDonChoXuat(CUA_HANG)).thenReturn(1L);
        xuatKho.donGuiSangKho(don(15, cuaHang, 70, null, 1), 70);
        assertEquals(Set.of(1, 2), nguoiNhan("DCX:2"));
    }

    private static PosPayosPayment qr(String daNhan) {
        return PosPayosPayment.builder().id(55L).orderCode(1729000000456L).khoId(CUA_HANG).nguoiThuNganId(7)
                .soTien(new BigDecimal("100000")).soTienDaNhan(daNhan == null ? null : new BigDecimal(daNhan)).build();
    }

    @Test
    @DisplayName("T1: gọi lại (khách chuyển thêm) chỉ sửa chữ, không báo lại; xử lý xong → đã đọc")
    void t1_suaChuKhongBaoLai() {
        thanhToan.qrDaNhanTienChuaTaoDon(qr("60000"), "CHUYEN_THIEU", true);
        ThongBao t = cuaNguoi("PAYOS:1729000000456:PAID_ERROR", 1);
        t.setDaDoc(true);
        thanhToan.qrDaNhanTienChuaTaoDon(qr("100000"), "LOI_TAO_DON", false);
        assertEquals("Đã nhận tiền QR, chưa tạo được đơn", t.getTieuDe());
        assertTrue(t.getDaDoc());
        assertEquals(2, cua("PAYOS:1729000000456:PAID_ERROR").size());
        thanhToan.qrDaXuLy(1729000000456L);
        assertTrue(cua("PAYOS:1729000000456:PAID_ERROR").stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("H2: kênh không phải sàn (POS) và kênh chưa kết nối xong → không báo; ngắt kết nối → H1/H2 đã đọc")
    void h2_boKenhKhongPhaiSan() {
        KenhBanHang pos = KenhBanHang.builder().id(1).maKenh("POS").tenKenh("Bán hàng tại quầy").build();
        KenhBanHang lazada = KenhBanHang.builder().id(2).maKenh("LAZADA").tenKenh("Lazada").build();
        for (int i = 0; i < 3; i++) {
            heThong.ketQuaDayTon(pos, "Lỗi kết nối");
            heThong.ketQuaDayTon(lazada, "Chưa có App Key / App Secret / Access Token");
        }
        assertTrue(bang.isEmpty());
        heThong.ketQuaDayTon(lazada, "Lỗi kết nối tới Lazada");
        heThong.ketQuaDayTon(lazada, "Lỗi kết nối tới Lazada");
        assertEquals(Set.of(1, 2), nguoiNhanTienTo("KENH:LAZADA:DAY_TON:"));
        heThong.kenhDaNgat("LAZADA");
        assertTrue(bang.stream().allMatch(ThongBao::getDaDoc));
    }

    @Test
    @DisplayName("H1 Shopify từ chối làm mới khi khóa còn hơn 48 giờ → không báo; còn ≤ 48 giờ → báo ngay")
    void h1_shopifyConHan() {
        heThong.kenhCanUyQuyenLai("SHOPIFY", null, 3, Instant.now().plus(java.time.Duration.ofDays(20)));
        assertTrue(bang.isEmpty());
        heThong.kenhCanUyQuyenLai("SHOPIFY", null, 3, Instant.now().plus(java.time.Duration.ofHours(10)));
        assertEquals(Set.of(1, 2), nguoiNhanTienTo("KENH:SHOPIFY:TOKEN:"));
    }

    @Test
    @DisplayName("H3: lên quản trị viên → câu toàn quyền, không ghi 'không còn làm việc ở kho / bỏ quyền'")
    void h3_lenQuanTri() {
        String moTa = ThongBaoHeThongService.moTaDoiQuyen(
                new ThongBaoHeThongService.AnhQuyen(IRoleType.nhan_vien_kho, 1, "Kho tổng", null, Set.of("tao_phieu_nhap")),
                new ThongBaoHeThongService.AnhQuyen(IRoleType.quan_tri_vien, null, null, null, Set.of()), Map.of());
        assertTrue(moTa.startsWith("Đăng nhập lại để dùng quyền mới. Vai trò: "), moTa);
        assertTrue(moTa.endsWith("(toàn quyền)."), moTa);
        assertFalse(moTa.contains("Bỏ quyền"));
    }

    @Test
    @DisplayName("H2 phân loại: số thường có chứa 401 (12.401 giây, mã yêu cầu) không phải lỗi xác thực")
    void h2_phanLoaiChatHon() {
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.MAT_KET_NOI,
                ThongBaoHeThongService.phanLoaiLoiDayTon("Hết thời gian chờ sau 12.401 giây"));
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.MAT_KET_NOI,
                ThongBaoHeThongService.phanLoaiLoiDayTon("trace=ab401cd lỗi mạng"));
        assertEquals(ThongBaoHeThongService.NhomLoiDayTon.XAC_THUC,
                ThongBaoHeThongService.phanLoaiLoiDayTon("Shopify trả HTTP 401"));
    }

    @Test
    @DisplayName("mocDuyNhat: gọi liền nhau (cùng mili giây) vẫn ra khóa khác nhau")
    void mocDuyNhat() {
        Set<String> moc = new HashSet<>();
        for (int i = 0; i < 50; i++) moc.add(ThongBaoService.mocDuyNhat());
        assertEquals(50, moc.size());
    }

    // ══════════════════════════ Chung ══════════════════════════

    @Test
    @DisplayName("Lỗi CSDL khi soạn / ghi → không ném ra ngoài")
    void loiKhongNem() {
        when(donRepo.demDonChoXuat(anyInt())).thenThrow(new RuntimeException("mất kết nối"));
        when(pqRepo.nguoiDungTheoKhoTai(any(), any(), any())).thenThrow(new RuntimeException("mất kết nối"));
        assertDoesNotThrow(() -> xuatKho.donGuiSangKho(don(15, khoTong, 70, null, 1), 70));
        assertDoesNotThrow(() -> xuatKho.thieuTonTheoLo(70, "PL-1", CUA_HANG, 7, "A", BigDecimal.ONE, BigDecimal.ZERO, 62));
        assertDoesNotThrow(() -> muaHang.daXetBaoGia(donMua(30, 50), List.of(), true, null));
        assertDoesNotThrow(() -> muaHang.bienBanTraHang(bienBan("DOI_HANG", 1), phieuNhap(donMua(30, 60)), 61));
        assertDoesNotThrow(() -> xuatKho.donGuiSangKho(null, 1));
        assertDoesNotThrow(() -> muaHang.donMuaDaNhanDu(null, null, null));
        assertTrue(bang.isEmpty());
    }
}
