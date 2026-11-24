package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.dto.request.inbound.GiaoTraHangLoiRequest;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.email.EmailNghiepVuService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.BooleanSupplier;

import static com.dev.backend.services.impl.entities.DonMuaHangFixture.loiMa;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Trả hàng lỗi nhà cung cấp (BienBanTraHangServiceImpl): kho lập biên bản, NHÀ CUNG CẤP quyết mọi việc trên Cổng nhà cung
 * cấp (không ai chốt thay), kho làm theo. Bảng biên bản chỉ giữ trạng thái hàng lỗi + phương án, chi tiết từng việc nằm ở
 * nhật ký (NhatKyTraHangNcc, dùng bản thật trên lich_su_thay_doi giả để đọc lại đúng dữ liệu đã ghi). Hàng lỗi trừ tiền
 * CỘNG vào "đã nhận" của dòng đơn mua, nên bất biến mỗi dòng: còn thiếu = đặt − đã nhận.
 * <p>
 * Gồm: nhà cung cấp trả lời hai câu (cách bù, hàng lỗi) trước / sau nhập kho, lựa chọn còn mở, nhập kho áp lựa chọn, đóng
 * đơn, kho ghi giao trả / tiêu hủy theo lựa chọn của nhà cung cấp, hạn trả lời (nhắc, quá hạn tự trừ tiền), lập biên bản
 * (trả ngay cho tài xế, email E7, lập lại xóa câu trả lời, hủy + M6), số trừ tiền theo biến thể của đơn, DTO dựng từ nhật ký.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TraHangNccChotTest {

    @Mock private BienBanTraHangNccRepository bienBanRepo;
    @Mock private ChiTietTraHangNccRepository chiTietTraHangRepo;
    @Mock private PhieuNhapKhoRepository phieuNhapRepo;
    @Mock private NguoiDungRepository nguoiDungRepo;
    @Mock private ChiTietPhieuNhapKhoRepository ctPhieuRepo;
    @Mock private ChiTietLoiLoHangRepository ctLoiRepo;
    @Mock private ThongBaoMuaHangService thongBao;
    @Mock private ChiTietDonMuaHangRepository ctDonRepo;
    @Mock private EntityManager entityManager;
    @Mock private EmailNghiepVuService email;

    private BienBanTraHangServiceImpl service;
    private NhatKyTraHangGia gia;

    private NhaCungCap ncc;
    private NguoiDung nguoiChot;
    private NguoiDung nguoiKho;
    private BienTheSanPham btA;
    private BienTheSanPham btB;
    private DonMuaHang don;
    /** Áo A: đặt 10, đã nhận 8 (còn thiếu 2), 100.000 ₫. */
    private ChiTietDonMuaHang dongA;
    /** Áo B: đặt 5, đã nhận 4 (còn thiếu 1), 50.000 ₫. */
    private ChiTietDonMuaHang dongB;
    /** Phiếu 1 đã nhập kho: 2 lỗi áo A, 1 lỗi áo B. */
    private PhieuNhapKho phieu;
    private BienBanTraHangNcc bb;
    /** Số lỗi theo biến thể của từng phiếu (thay câu truy vấn soLoiTheoBienThe). */
    private final Map<Integer, Map<Integer, Integer>> loiTheoPhieu = new HashMap<>();
    /** Biên bản trả về từ timChoDanhSach (danh sách / trừ tiền theo đơn). */
    private final List<BienBanTraHangNcc> dsBienBan = new ArrayList<>();
    /**
     * Dòng của từng biên bản (thay câu truy vấn timTheoBienBan, nơi duy nhất máy chủ đọc dòng để tính lựa chọn). Biên bản
     * mặc định 200: dòng 301 (áo A × 2), 302 (áo B × 1), khớp số lỗi của phiếu 1.
     */
    private final Map<Integer, List<ChiTietTraHangNcc>> dongBienBan = new HashMap<>();
    private final Map<Integer, BienTheSanPham> bienTheTheoId = new HashMap<>();

    @BeforeEach
    void setUp() {
        nguoiChot = NguoiDung.builder().id(7).hoTen("Trần Mua").build();
        nguoiKho = NguoiDung.builder().id(61).hoTen("Lê Kho").build();
        gia = new NhatKyTraHangGia(nguoiChot, nguoiKho);
        service = new BienBanTraHangServiceImpl(bienBanRepo, chiTietTraHangRepo, phieuNhapRepo, nguoiDungRepo, ctPhieuRepo,
                ctLoiRepo, ctDonRepo, gia.nhatKy);
        ReflectionTestUtils.setField(service, "thongBaoMuaHangService", thongBao);
        ReflectionTestUtils.setField(service, "emailNghiepVuService", email);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        NhatKyTraHangGia.dangNhap(7);

        Kho kho = Kho.builder().id(1).tenKho("Kho tổng").build();
        ncc = NhaCungCap.builder().id(5).maNhaCungCap("NCC05").tenNhaCungCap("May Việt Tiến").email("ncc05@viettien.vn").build();
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Polo").build();
        btA = BienTheSanPham.builder().id(10).maSku("POLO-A").sanPham(sp).build();
        btB = BienTheSanPham.builder().id(11).maSku("POLO-B").sanPham(sp).build();
        bienTheTheoId.put(10, btA);
        bienTheTheoId.put(11, btB);
        dongA = ChiTietDonMuaHang.builder().id(101).bienTheSanPham(btA).soLuongDat(new BigDecimal("10"))
                .soLuongDaNhan(new BigDecimal("8")).donGia(new BigDecimal("100000")).build();
        dongB = ChiTietDonMuaHang.builder().id(102).bienTheSanPham(btB).soLuongDat(new BigDecimal("5"))
                .soLuongDaNhan(new BigDecimal("4")).donGia(new BigDecimal("50000")).build();
        don = DonMuaHang.builder().id(50).soDonMua("PO-50").khoNhap(kho).nhaCungCap(ncc).trangThai(3)
                .chiTietDonMuaHangs(new ArrayList<>(List.of(dongA, dongB))).build();
        dongA.setDonMuaHang(don);
        dongB.setDonMuaHang(don);
        phieu = PhieuNhapKho.builder().id(1).soPhieuNhap("PN202611201").kho(kho).nhaCungCap(ncc).donMuaHang(don)
                .trangThai(3).ngayNhap(Instant.now().minus(Duration.ofDays(1))).build();
        loiTheoPhieu.put(1, new LinkedHashMap<>(Map.of(10, 2, 11, 1)));
        bb = bienBan(200, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
        dsBienBan.add(bb);

        when(bienBanRepo.findById(200)).thenAnswer(inv -> Optional.of(bb));
        when(bienBanRepo.khoaTheoId(200)).thenAnswer(inv -> Optional.of(bb));
        when(bienBanRepo.timChoDanhSach(any(), any())).thenAnswer(inv -> new ArrayList<>(dsBienBan));
        when(bienBanRepo.timTheoDonMua(anyCollection())).thenAnswer(inv -> new ArrayList<>(dsBienBan));
        when(nguoiDungRepo.findById(7)).thenReturn(Optional.of(nguoiChot));
        when(ctDonRepo.khoaTheoDonMua(50)).thenAnswer(inv -> List.of(dongA, dongB));
        when(ctDonRepo.findByDonMuaHang_IdIn(any())).thenAnswer(inv -> List.of(dongA, dongB));
        when(ctPhieuRepo.soLoiTheoBienThe(anyCollection())).thenAnswer(inv -> {
            List<Object[]> kq = new ArrayList<>();
            for (Integer phieuId : inv.<Collection<Integer>>getArgument(0)) {
                loiTheoPhieu.getOrDefault(phieuId, Map.of()).forEach((bt, sl) -> kq.add(new Object[]{phieuId, bt, (long) sl}));
            }
            return kq;
        });
        when(chiTietTraHangRepo.findDetailByBienBanId(any())).thenReturn(List.of());
        when(chiTietTraHangRepo.timTheoBienBan(anyCollection())).thenAnswer(inv -> {
            Collection<Integer> ids = inv.getArgument(0);
            return dongBienBan.entrySet().stream().filter(e -> ids.contains(e.getKey()))
                    .flatMap(e -> e.getValue().stream())
                    .sorted(Comparator.comparing(ChiTietTraHangNcc::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    /**
     * Biên bản {@code id} của phiếu {@code p}, kèm dòng theo số lỗi của phiếu lúc lập ({@link #loiTheoPhieu}): mỗi biến thể
     * một dòng theo thứ tự id biến thể, id dòng = 301 + (id − 200) × 10 + thứ tự (biên bản 200: dòng 301 áo A, 302 áo B).
     * Phiếu chưa có số lỗi thì biên bản không có dòng (dữ liệu cũ, máy chủ theo cột của biên bản).
     */
    private BienBanTraHangNcc bienBan(int id, PhieuNhapKho p, String phuongAn) {
        BienBanTraHangNcc b = BienBanTraHangNcc.builder().id(id).maBienBan("RTV-20261120-00" + (id % 10)).phieuNhapKho(p)
                .nhaCungCap(ncc).nguoiTao(nguoiKho).tongSoLuongLoi(3)
                .phuongAnXuLy(phuongAn).ngayTao(Instant.now().minus(Duration.ofDays(2))).build();
        List<ChiTietTraHangNcc> ds = new ArrayList<>();
        int i = 0;
        for (Map.Entry<Integer, Integer> e : new TreeMap<>(loiTheoPhieu.getOrDefault(p.getId(), Map.of())).entrySet()) {
            BienTheSanPham bt = bienTheTheoId.get(e.getKey());
            ds.add(ChiTietTraHangNcc.builder().id(301 + (id - 200) * 10 + i).bienBanTraHangNcc(b).bienTheSanPham(bt)
                    .maLo("LO-" + bt.getMaSku()).lyDoLoi(i == 0 ? "Rách vải" : "Lệch đường may").soLuongLoi(e.getValue())
                    .build());
            i++;
        }
        if (ds.isEmpty()) dongBienBan.remove(id);
        else dongBienBan.put(id, ds);
        return b;
    }

    /** Một dòng biên bản tự dựng (dùng khi cần biến thể có nhiều dòng, ví dụ tách theo lý do lỗi). */
    private static ChiTietTraHangNcc dongMoi(BienBanTraHangNcc b, int id, BienTheSanPham bt, int soLuong, String lyDo) {
        return ChiTietTraHangNcc.builder().id(id).bienBanTraHangNcc(b).bienTheSanPham(bt).maLo("LO-" + bt.getMaSku())
                .lyDoLoi(lyDo).soLuongLoi(soLuong).build();
    }

    /** Dòng biên bản theo id. */
    private ChiTietTraHangNcc dong(int dongId) {
        return dongBienBan.values().stream().flatMap(List::stream).filter(d -> d.getId() == dongId).findFirst().orElseThrow();
    }

    private static BienBanTraHangService.LuaChonDong chon(int dongId, String phuongAn, String hangLoi) {
        return new BienBanTraHangService.LuaChonDong(dongId, phuongAn, hangLoi);
    }

    /** Nhà cung cấp 5 trả lời theo từng dòng trên cổng (phiên bản đang có, người xác nhận Nguyễn Lan, đã đánh dấu cam kết). */
    private BienBanTraHangDto traLoiDong(int id, BienBanTraHangService.LuaChonDong... ds) {
        return service.traLoiTuCong(id, Set.of(5), phienBan(id), List.of(ds), null, null, "Nguyễn Lan", null, true);
    }

    /** Dòng của DTO chi tiết theo id dòng. */
    private static BienBanTraHangDto.ChiTietItemDto muc(BienBanTraHangDto dto, int dongId) {
        return dto.getItems().stream().filter(i -> i.getId() == dongId).findFirst().orElseThrow();
    }

    private PhieuNhapKho phieuKhac(int id, int trangThai) {
        return PhieuNhapKho.builder().id(id).soPhieuNhap("PN20261120" + id).kho(phieu.getKho()).nhaCungCap(ncc)
                .donMuaHang(don).trangThai(trangThai).ngayNhap(trangThai == 3 ? Instant.now().minus(Duration.ofDays(1)) : null)
                .build();
    }

    /** Đại diện nhà cung cấp ký biên bản khi test không cần tên tài xế cụ thể. */
    private static final String DAI_DIEN = "Đỗ Văn Giao";

    /**
     * Ghi nhật ký lập biên bản như kho (Lê Kho) đã lập, rồi kho ghi người giao hàng đã ký: biên bản đã gửi nhà cung cấp.
     * Không truyền tài xế thì đại diện nhà cung cấp {@link #DAI_DIEN} ký (biên bản nào cũng có người ký).
     */
    private Integer lap(BienBanTraHangNcc b, String cachXuLy, String taiXe, String bienSo) {
        NhatKyTraHangGia.dangNhap(61);
        gia.nhatKy.ghiLap(b, cachXuLy, new NhatKyTraHangNcc.NguoiKy(BienBanTraHangNcc.BEN_KY_NCC,
                taiXe == null ? DAI_DIEN : taiXe, bienSo, null), false);
        Integer id = gia.nhatKy.idLapCuoi(b.getId());
        gia.nhatKy.ghiKy(b);
        NhatKyTraHangGia.dangNhap(7);
        return id;
    }

    private BienBanTraHangDto xem(BienBanTraHangNcc b) {
        when(bienBanRepo.findById(b.getId())).thenReturn(Optional.of(b));
        return service.chiTiet(b.getId());
    }

    /** Lần lập nhà cung cấp đang xem trên cổng (id dòng nhật ký lập cuối). */
    private Integer phienBan(int id) {
        return gia.nhatKy.idLapCuoi(id);
    }

    /** Nhà cung cấp 5 trả lời trên cổng (phiên bản đang có, người xác nhận Nguyễn Lan). */
    private BienBanTraHangDto traLoi(int id, String phuongAn, String hangLoi) {
        return service.traLoiTuCong(id, Set.of(5), phienBan(id), phuongAn, hangLoi, "Nguyễn Lan", null);
    }

    /**
     * Ghi thẳng câu trả lời hàng lỗi của nhà cung cấp vào nhật ký (như traLoiTuCong ghi khi chỉ đổi hàng lỗi), đặt lúc
     * {@code luc}: dùng khi chỉ cần dựng tình huống cho kho, không cần đi qua luồng cổng.
     */
    private void nccChonHangLoi(BienBanTraHangNcc b, String hangLoi, Instant luc) {
        gia.nhatKy.ghiTraLoi(b, NhatKyTraHangNcc.TraLoi.ghi(b.phuongAn(), b.phuongAn(), hangLoi,
                NhatKyTraHangNcc.NGUON_CONG_NCC, "Chị Lan", Map.of(), BigDecimal.ZERO, null));
        dongCuoi().setNgayThucHien(luc);
    }

    /** Email biên bản đã gửi được (nhật ký gửi email loại {@code loai}) lúc {@code luc}. */
    private void daGuiEmail(BienBanTraHangNcc b, String loai, Instant luc) {
        gia.nhatKy.ghiDaGuiEmail(b.getId(), b.getMaBienBan(), 1, loai, "ncc05@viettien.vn");
        dongCuoi().setNgayThucHien(luc);
    }

    private LichSuThayDoi dongCuoi() {
        return gia.dong.get(gia.dong.size() - 1);
    }

    private static CommonException loi(HttpStatus status, Executable viec) {
        CommonException ex = assertThrows(CommonException.class, viec);
        assertEquals(status, ex.getStatus(), ex.getMessage());
        return ex;
    }

    private static LoiCoMaException loiCong(HttpStatus status, String ma, Executable viec) {
        LoiCoMaException ex = loiMa(ma, viec);
        assertEquals(status, ex.getStatus(), ex.getMessage());
        return ex;
    }

    private static void soBang(String ky, Object giaTri, String moTa) {
        assertNotNull(giaTri, moTa);
        assertEquals(0, new BigDecimal(ky).compareTo(new BigDecimal(giaTri.toString())), moTa + ": " + giaTri);
    }

    private void khongDoiGi() {
        soBang("8", dongA.getSoLuongDaNhan(), "đã nhận áo A");
        soBang("4", dongB.getSoLuongDaNhan(), "đã nhận áo B");
        verify(ctDonRepo, never()).save(any());
        verify(bienBanRepo, never()).save(any());
        assertEquals(3, don.getTrangThai());
        assertTrue(gia.theo(200, IHanhDong.chot_tra_hang_ncc).isEmpty(), "không ghi nhật ký trả lời");
        assertTrue(gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc).isEmpty());
    }

    // ═══════════════════════ Nhà cung cấp trả lời sau nhập kho ═══════════════════════

    @Nested
    @DisplayName("Nhà cung cấp trả lời sau nhập kho (traLoiTuCong): áp ngay vào đơn mua, lựa chọn khóa dần")
    class TraLoiSauNhapKho {

        @Test
        @DisplayName("Trừ tiền + nhận lại: cộng số lỗi vào đã nhận từng dòng đơn, nhật ký một dòng ghi cả hai câu, số / tiền trừ; mọi dòng hết thiếu → đơn Nhận đủ (5)")
        void truTienDuThiNhanDu() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            BienBanTraHangDto dto = service.traLoiTuCong(200, Set.of(4, 5), phienBan(200), "TRU_CONG_NO", "NHAN_LAI",
                    "  Chị   Lan ", " trừ kỳ 11 ");

            soBang("10", dongA.getSoLuongDaNhan(), "8 đạt + 2 lỗi trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "4 đạt + 1 lỗi trừ tiền");
            assertEquals(0, dongA.conThieu().signum());
            assertEquals(0, dongB.conThieu().signum());
            verify(ctDonRepo).save(dongA);
            verify(ctDonRepo).save(dongB);
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            verify(bienBanRepo).save(bb);
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai(), "hàng lỗi vẫn ở kho chờ kho giao trả");

            List<LichSuThayDoi> nk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(1, nk.size(), "một lần trả lời = một dòng nhật ký");
            Map<String, Object> m = gia.moi(nk.get(0));
            assertEquals("TRU_CONG_NO", m.get("phuongAn"));
            assertEquals("CHO_CHOT", m.get("phuongAnCu"));
            assertFalse(m.containsKey("hangLoi"), "ghi theo dòng: lựa chọn hàng lỗi nằm ở theoDong");
            assertEquals(Map.of("301", Map.of("cachBu", "TRU_CONG_NO", "hangLoi", "NHAN_LAI"),
                    "302", Map.of("cachBu", "TRU_CONG_NO", "hangLoi", "NHAN_LAI")), m.get("theoDong"),
                    "cách gửi cũ (một lựa chọn) áp cho mọi dòng");
            assertFalse(m.containsKey("camKet"), "cách gửi cũ không có câu cam kết");
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, m.get("nguon"));
            assertEquals("Chị Lan", m.get("nguoiXacNhan"));
            assertEquals(Map.of("10", 2, "11", 1), m.get("truTheoBienThe"));
            soBang("250000", m.get("tienTru"), "2 × 100.000 + 1 × 50.000");
            assertEquals("trừ kỳ 11", nk.get(0).getGhiChu());
            assertEquals(INguonNhatKy.nha_cung_cap, nk.get(0).getNguon());
            assertNull(nk.get(0).getNguoiThucHien(), "nhà cung cấp không có tài khoản: không ghi người đang đăng nhập");

            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, dto.getPhuongAn());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, dto.getNguonChot());
            assertEquals("Chị Lan", dto.getNguoiXacNhanNcc());
            assertEquals("trừ kỳ 11", dto.getGhiChuChot());
            assertNull(dto.getNguoiChot());
            assertNotNull(dto.getThoiDiemChot());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, dto.getHangLoiNcc());
            assertEquals("Chị Lan", dto.getNguoiChonHangLoi());
            assertEquals("trừ kỳ 11", dto.getGhiChuChonHangLoi());
            assertNotNull(dto.getThoiDiemChonHangLoi());
            assertFalse(dto.getChoNccChonCachBu());
            assertFalse(dto.getChoNccChonHangLoi());
            assertEquals(List.of(), dto.getCachBuMo(), "trừ tiền sau nhập kho là chốt cuối");
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), dto.getHangLoiMo(), "hàng còn ở kho: đổi được");
            assertEquals(3, dto.getSoLuongTruTien());
            soBang("250000", dto.getTienTruTien(), "tiền trừ trên DTO");
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, dto.getTrangThaiHienThi(), "đã trả lời xong, kho giao trả");
            assertEquals(5, don.getTrangThai());
            verify(entityManager).merge(don);
            verify(thongBao).donMuaDaNhanDu(don, null, null);
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 3, 0, null);
            verify(thongBao).nccDaTraLoi(bb, phieu, 0, 3, 3, 0, false);
            ArgumentCaptor<BienBanTraHangDto> m5 = ArgumentCaptor.forClass(BienBanTraHangDto.class);
            verify(email).guiDaGhiNhanTraLoi(same(bb), m5.capture(), eq(false));
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, m5.getValue().getPhuongAn());

            // Khóa dòng đơn → đơn → biên bản (nạp lại bản đã đọc, cùng thứ tự với nhập kho và đóng đơn) → nạp lại phiếu
            InOrder thuTu = inOrder(ctDonRepo, entityManager);
            thuTu.verify(ctDonRepo).khoaTheoDonMua(50);
            thuTu.verify(entityManager).refresh(don, LockModeType.PESSIMISTIC_WRITE);
            thuTu.verify(entityManager).refresh(bb, LockModeType.PESSIMISTIC_WRITE);
            thuTu.verify(entityManager).refresh(phieu);
        }

        @Test
        @DisplayName("Đọc trước thấy chờ chọn, nạp lại sau khóa đã trừ tiền (quá hạn tự chuyển): chỉ đổi cách bù → 409 cách bù đã chốt; gửi kèm đổi hàng lỗi thì bỏ qua cách bù đã chốt, chỉ ghi hàng lỗi, không trừ lần hai")
        void napLaiSauKhoaDaTruTien() {
            doAnswer(inv -> {
                inv.<BienBanTraHangNcc>getArgument(0).setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
                return null;
            }).when(entityManager).refresh(same(bb), eq(LockModeType.PESSIMISTIC_WRITE));
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(1)));

            LoiCoMaException ex = loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> traLoi(200, "DOI_HANG", "NHAN_LAI"));
            assertTrue(ex.getMessage().contains("đã chốt, không đổi được"), ex.getMessage());
            soBang("8", dongA.getSoLuongDaNhan(), "không trừ");
            assertEquals(1, gia.theo(200, IHanhDong.chot_tra_hang_ncc).size(), "chỉ có lần chọn hàng lỗi dựng sẵn");
            verify(thongBao, never()).nccDaTraLoi(any(), any(), anyInt(), anyInt(), anyInt(), anyInt(), anyBoolean());

            // Giao bù (đã chốt: bỏ qua) + đổi hàng lỗi: chỉ ghi hàng lỗi, không cộng số lỗi lần nữa
            BienBanTraHangDto dto = traLoi(200, "DOI_HANG", "TIEU_HUY");
            soBang("8", dongA.getSoLuongDaNhan(), "không trừ lần hai");
            soBang("4", dongB.getSoLuongDaNhan(), "không trừ lần hai");
            verify(ctDonRepo, never()).save(any());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy(), "cách bù đã chốt giữ nguyên");
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(1));
            assertEquals("TRU_CONG_NO", m.get("phuongAn"));
            assertEquals("TRU_CONG_NO", m.get("phuongAnCu"), "cách bù không đổi");
            assertEquals(Map.of("301", Map.of("hangLoi", "TIEU_HUY"), "302", Map.of("hangLoi", "TIEU_HUY")), m.get("theoDong"),
                    "không ghi cách bù đã chốt");
            assertEquals(Map.of(), m.get("truTheoBienThe"));
            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, dto.getHangLoiNcc());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, dto.getTrangThaiHienThi());
            verify(thongBao).nccDaTraLoi(bb, phieu, 0, 3, 0, 3, false);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 0, 3, null);
        }

        @Test
        @DisplayName("Nạp lại sau khóa: biên bản vừa bị hủy → 409 đã hủy; kho vừa giao trả hàng lỗi → cách bù vẫn ghi, phần hàng lỗi bỏ qua; gửi lại chỉ còn đổi hàng lỗi → 409 hàng lỗi đã xử lý")
        void napLaiTrangThaiMoiNhat() {
            doAnswer(inv -> {
                inv.<BienBanTraHangNcc>getArgument(0).setTrangThai(BienBanTraHangNcc.DA_HUY);
                return null;
            }).when(entityManager).refresh(same(bb), eq(LockModeType.PESSIMISTIC_WRITE));
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, "DOI_HANG", "NHAN_LAI"))
                    .getMessage().contains("đã hủy"));
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
            khongDoiGi();

            doAnswer(inv -> {
                inv.<BienBanTraHangNcc>getArgument(0).setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
                return null;
            }).when(entityManager).refresh(same(bb), eq(LockModeType.PESSIMISTIC_WRITE));
            // Hàng lỗi đã rời kho: chỉ còn câu cách bù; lựa chọn hàng lỗi gửi kèm bị bỏ qua
            BienBanTraHangDto dto = traLoi(200, "DOI_HANG", "TIEU_HUY");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            assertNull(dto.getHangLoiNcc());
            assertEquals(Map.of("301", Map.of("cachBu", "DOI_HANG"), "302", Map.of("cachBu", "DOI_HANG")),
                    gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0)).get("theoDong"));

            // Gửi lại: cách bù không đổi, chỉ còn hàng lỗi mà hàng đã rời kho
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, "DOI_HANG", "TIEU_HUY"))
                    .getMessage().contains("đã được giao trả hoặc tiêu hủy"));
            assertEquals(1, gia.theo(200, IHanhDong.chot_tra_hang_ncc).size());
            verify(ctDonRepo, never()).save(any());
        }

        @Test
        @DisplayName("Trừ tiền mà dòng đơn còn thiếu thêm ngoài phần lỗi: đơn vẫn Đang vận chuyển")
        void truTienConThieuKhac() {
            dongA.setSoLuongDat(new BigDecimal("12"));
            traLoi(200, "TRU_CONG_NO", "NHAN_LAI");

            soBang("10", dongA.getSoLuongDaNhan(), "đã nhận áo A");
            assertEquals(0, dongA.conThieu().compareTo(new BigDecimal("2")));
            assertEquals(3, don.getTrangThai());
            verify(thongBao, never()).donMuaDaNhanDu(any(), any(), any());
        }

        @Test
        @DisplayName("Trừ tiền bị chặn khi phiếu Nháp cùng đơn đang giữ phần còn thiếu: 409 câu cho NCC (không lộ số phiếu nội bộ), không đổi gì, không email")
        void truTienPhieuNhapDangGiu() {
            when(ctPhieuRepo.sumDuKienPhieuNhapCungDon(50, 10)).thenReturn(BigDecimal.ONE);
            when(ctPhieuRepo.soPhieuNhapGiuCungDon(50, 10)).thenReturn(List.of("PN202611202"));

            LoiCoMaException ex = loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> traLoi(200, "TRU_CONG_NO", "NHAN_LAI"));
            assertTrue(ex.getMessage().contains("Chưa ghi nhận được trừ tiền"), ex.getMessage());
            assertFalse(ex.getMessage().contains("PN202611202"), "không lộ số phiếu nội bộ cho NCC: " + ex.getMessage());
            khongDoiGi();
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
            verify(thongBao, never()).nccDaTraLoi(any(), any(), anyInt(), anyInt(), anyInt(), anyInt(), anyBoolean());
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Trừ tiền vượt phần còn thiếu của dòng đơn (hàng đã giao đủ ở đợt sau): 409, không trừ dòng nào")
        void truTienVuotConThieu() {
            dongB.setSoLuongDaNhan(new BigDecimal("5"));

            loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, "TRU_CONG_NO", "NHAN_LAI"));
            soBang("8", dongA.getSoLuongDaNhan(), "áo A không bị cộng dù đứng trước");
            verify(ctDonRepo, never()).save(any());
            verify(bienBanRepo, never()).save(any());
            assertTrue(gia.theo(200, IHanhDong.chot_tra_hang_ncc).isEmpty());
        }

        @Test
        @DisplayName("Giao bù + tiêu hủy: không đụng dòng đơn (lỗi vẫn là còn thiếu), nhật ký không có số trừ, báo kho tiêu hủy; giao bù còn đổi sang trừ tiền khi chưa có hàng về")
        void giaoBu() {
            BienBanTraHangDto dto = traLoi(200, "DOI_HANG", "TIEU_HUY");

            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            assertEquals(0, dto.getSoLuongTruTien());
            assertEquals(0, dto.getTienTruTien().signum());
            assertEquals(Map.of(), gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0)).get("truTheoBienThe"));
            verify(ctDonRepo, never()).save(any());
            assertEquals(3, don.getTrangThai());
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 0, 3, null);
            assertFalse(dto.getBuXong(), "còn thiếu 2 áo A, 1 áo B chờ hàng bù");
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, dto.getTrangThaiHienThi());
            assertEquals(List.of("TRU_CONG_NO"), dto.getCachBuMo(), "giao bù chỉ còn đổi sang trừ tiền");
            // Giao bù đổi được hay không xét theo từng biến thể của dòng
            verify(ctPhieuRepo, atLeastOnce()).datNhapSau(eq(50), eq(phieu.getNgayNhap()), eq(Set.of(10)));
            verify(ctPhieuRepo, atLeastOnce()).datNhapSau(eq(50), eq(phieu.getNgayNhap()), eq(Set.of(11)));
        }

        @Test
        @DisplayName("Giao bù → trừ tiền bị chặn khi đã có hàng đạt của các biến thể nhập về sau phiếu gốc: 409 cách bù đã chốt")
        void doiHangSangTruTienDaCoHangVe() {
            traLoi(200, "DOI_HANG", "NHAN_LAI");
            clearInvocations(bienBanRepo, ctDonRepo, thongBao, email);
            when(ctPhieuRepo.datNhapSau(eq(50), eq(phieu.getNgayNhap()), any())).thenReturn(1L);

            LoiCoMaException ex = loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> traLoi(200, "TRU_CONG_NO", null));
            assertTrue(ex.getMessage().contains("đã chốt"), ex.getMessage());
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "không trừ");
            verify(ctDonRepo, never()).save(any());
            assertEquals(1, gia.theo(200, IHanhDong.chot_tra_hang_ncc).size());
            assertEquals(List.of(), xem(bb).getCachBuMo(), "đã có hàng về: cách bù khóa");
        }

        @Test
        @DisplayName("Giao bù → trừ tiền khi chưa có hàng nào về sau: được, trừ như chọn mới, phương án cũ ghi là giao bù, hàng lỗi giữ lựa chọn trước")
        void doiHangSangTruTienChuaCoHangVe() {
            traLoi(200, "DOI_HANG", "NHAN_LAI");
            when(ctPhieuRepo.datNhapSau(any(), any(), any())).thenReturn(0L);

            BienBanTraHangDto dto = traLoi(200, "TRU_CONG_NO", null);
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            soBang("10", dongA.getSoLuongDaNhan(), "đã nhận áo A");
            assertEquals(5, don.getTrangThai());
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(1));
            assertEquals("DOI_HANG", m.get("phuongAnCu"));
            assertFalse(m.containsKey("hangLoi"), "lần này không đổi hàng lỗi");
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, dto.getHangLoiNcc(), "giữ lựa chọn hàng lỗi trước");
            verify(thongBao).nccDaTraLoi(bb, phieu, 0, 3, 3, 0, false);
        }

        @Test
        @DisplayName("Trừ tiền sau nhập kho là chốt cuối (cả mã cũ trả tài xế); đã xử lý xong thì 409 không còn gì để chọn; gửi lại đúng lựa chọn cũ: 400 không có gì thay đổi")
        void khongDoiLai() {
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(1)));
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, "DOI_HANG", "NHAN_LAI"))
                    .getMessage().contains("không đổi được"));

            // Mã cũ TRA_TAI_XE: trừ tiền + hàng đã theo tài xế về → không còn gì để chọn
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_CU_TRA_TAI_XE);
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, "DOI_HANG", null))
                    .getMessage().contains("đã xử lý xong"));

            // Đã giao bù + nhận lại, gửi lại y như cũ
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            int truoc = gia.dong.size();
            LoiCoMaException ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoi(200, "DOI_HANG", "NHAN_LAI"));
            assertTrue(ex.getMessage().contains("không có gì để lưu"), ex.getMessage());
            assertEquals(truoc, gia.dong.size(), "không ghi thêm nhật ký");
            loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, () -> traLoi(200, null, null));
            verify(ctDonRepo, never()).save(any());
            verify(bienBanRepo, never()).save(any());
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Đơn mua đã đóng / hủy: đổi cách bù 409 đơn đã kết thúc; gửi kèm đổi hàng lỗi thì cách bù bỏ qua, hàng lỗi còn ở kho vẫn đổi được")
        void donKetThuc() {
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(1)));
            for (int tt : new int[]{6, 7}) {
                don.setTrangThai(tt);
                assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                        () -> traLoi(200, "TRU_CONG_NO", "NHAN_LAI")).getMessage().contains("đã kết thúc"), "đơn " + tt);
            }
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());

            BienBanTraHangDto dto = traLoi(200, "TRU_CONG_NO", "TIEU_HUY");
            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, dto.getHangLoiNcc());
            assertEquals(List.of(), dto.getCachBuMo());
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            verify(ctDonRepo, never()).save(any());

            // Đơn kết thúc và hàng lỗi đã rời kho: không còn gì để chọn
            bb.setTrangThai(BienBanTraHangNcc.DA_TIEU_HUY);
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, () -> traLoi(200, null, "NHAN_LAI"))
                    .getMessage().contains("đã kết thúc"));
        }

        @Test
        @DisplayName("Hàng lỗi còn ở kho đổi được (nhận lại → tiêu hủy) khi cách bù đã chốt; dòng nhật ký giữ nguyên cách bù, trạng thái chờ tiêu hủy")
        void doiHangLoiKhiConOKho() {
            traLoi(200, "TRU_CONG_NO", "NHAN_LAI");
            Instant lucChot = xem(bb).getThoiDiemChot();
            clearInvocations(thongBao, email);

            BienBanTraHangDto dto = service.traLoiTuCong(200, Set.of(5), phienBan(200), null, "TIEU_HUY", "Phạm Hòa", "tiêu hủy giúp");
            List<LichSuThayDoi> nk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(2, nk.size());
            Map<String, Object> m = gia.moi(nk.get(1));
            assertEquals("TRU_CONG_NO", m.get("phuongAn"));
            assertEquals("TRU_CONG_NO", m.get("phuongAnCu"));
            assertEquals(Map.of("301", Map.of("hangLoi", "TIEU_HUY"), "302", Map.of("hangLoi", "TIEU_HUY")), m.get("theoDong"));
            assertEquals(Map.of(), m.get("truTheoBienThe"), "không trừ thêm");
            soBang("10", dongA.getSoLuongDaNhan(), "chỉ trừ một lần");

            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, dto.getHangLoiNcc());
            assertEquals("Phạm Hòa", dto.getNguoiChonHangLoi());
            assertEquals("tiêu hủy giúp", dto.getGhiChuChonHangLoi());
            assertEquals("Nguyễn Lan", dto.getNguoiXacNhanNcc(), "cách bù vẫn là lần trả lời trước");
            assertEquals(lucChot, dto.getThoiDiemChot());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, dto.getTrangThaiHienThi());
            verify(thongBao).nccDaTraLoi(bb, phieu, 0, 3, 0, 3, false);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 0, 3, null);
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(false));
        }
    }

    // ═══════════════════════ Cổng nhà cung cấp: quyền, dữ liệu gửi lên, lần đầu trả lời ═══════════════════════

    @Nested
    @DisplayName("Nhà cung cấp trả lời trên cổng: quyền, dữ liệu gửi lên, lần đầu phải trả lời đủ")
    class TraLoiTrenCong {

        @Test
        @DisplayName("Sai nhà cung cấp / không có biên bản / phiếu không thuộc đơn mua: 404 KHONG_TIM_THAY, không lộ là có biên bản")
        void khongTimThay() {
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                    () -> service.traLoiTuCong(200, Set.of(6), phienBan(200), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null));
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                    () -> service.traLoiTuCong(999, Set.of(5), phienBan(999), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null));
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                    () -> service.traLoiTuCong(null, Set.of(5), null, "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null));
            phieu.setDonMuaHang(null);
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY, () -> traLoi(200, "DOI_HANG", "NHAN_LAI"));
            phieu.setDonMuaHang(don);
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY, () -> service.chiTietChoCong(200, Set.of(6)));
            khongDoiGi();
            verify(ctDonRepo, never()).khoaTheoDonMua(any());
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Không cần người dùng đăng nhập / phân quyền kho: phiên cổng đã xác thực nhà cung cấp")
        void khongCanDangNhap() {
            SecurityContextHolder.clear();
            assertDoesNotThrow(() -> traLoi(200, "DOI_HANG", "NHAN_LAI"));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            assertNull(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0).getNguoiThucHien());
        }

        @Test
        @DisplayName("Lần đầu phải trả lời mọi câu còn mở: thiếu cách bù → 400 ô phuongAn, thiếu hàng lỗi → 400 ô hangLoi; hàng lỗi đã rời kho thì chỉ cần cách bù")
        void lanDauPhaiTraLoiDu() {
            assertEquals("hangLoi", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoi(200, "TRU_CONG_NO", null)).getDuLieu().get("o"));
            assertEquals("phuongAn", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoi(200, null, "NHAN_LAI")).getDuLieu().get("o"));
            assertEquals("phuongAn", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoi(200, null, null)).getDuLieu().get("o"));
            khongDoiGi();
            verifyNoInteractions(email);

            // Phiếu còn Nháp: vẫn phải trả lời đủ hai câu
            phieu.setTrangThai(0);
            loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, () -> traLoi(200, "DOI_HANG", null));

            // Hàng lỗi đã giao luôn cho tài xế: không còn câu hàng lỗi
            phieu.setTrangThai(3);
            bb.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            BienBanTraHangDto dto = traLoi(200, "DOI_HANG", null);
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, dto.getPhuongAn());
            assertEquals(List.of(), dto.getHangLoiMo());
            assertNull(dto.getHangLoiNcc());
            assertFalse(dto.getChoNccChonHangLoi());
        }

        @Test
        @DisplayName("Biên bản có lần lập mà không gửi phiên bản: 409 như kho vừa lập lại, không ghi câu trả lời")
        void khongGuiPhienBan() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            assertNotNull(phienBan(200));
            loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> service.traLoiTuCong(200, Set.of(5), null, "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null));
            assertTrue(gia.theo(200, IHanhDong.chot_tra_hang_ncc).isEmpty());
        }

        @Test
        @DisplayName("Người xác nhận \"Tài xế 01\" / trống / quá 100 ký tự, cách bù / hàng lỗi lạ, ghi chú 256 ký tự: 400 TRA_LOI_KHONG_HOP_LE kèm ô lỗi, trước khi khóa")
        void kiemDauVao() {
            LoiCoMaException ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> service.traLoiTuCong(200, Set.of(5), phienBan(200), "DOI_HANG", "NHAN_LAI", "Tài xế 01", null));
            assertEquals("nguoiXacNhan", ex.getDuLieu().get("o"));
            assertEquals("nguoiXacNhan", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> service.traLoiTuCong(200, Set.of(5), phienBan(200), "DOI_HANG", "NHAN_LAI", "   ", null)).getDuLieu().get("o"));
            loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> service.traLoiTuCong(200, Set.of(5), phienBan(200), "DOI_HANG", "NHAN_LAI", "a".repeat(101), null));

            for (String pa : Arrays.asList("CHO_CHOT", "XYZ")) {
                assertEquals("phuongAn", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                        () -> traLoi(200, pa, "NHAN_LAI")).getDuLieu().get("o"));
            }
            for (String hl : Arrays.asList("GIU_KHO", "TRA_NGAY", "xyz")) {
                assertEquals("hangLoi", loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                        () -> traLoi(200, "DOI_HANG", hl)).getDuLieu().get("o"));
            }
            ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> service.traLoiTuCong(200, Set.of(5), phienBan(200), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", "ư".repeat(256)));
            assertEquals("ghiChu", ex.getDuLieu().get("o"));
            assertTrue(ex.getMessage().contains("255"), ex.getMessage());
            verify(ctDonRepo, never()).khoaTheoDonMua(any());
            khongDoiGi();

            // 255 ký tự (sau khi cắt hai đầu) được nhận; mã gửi lên có khoảng trắng hai đầu vẫn nhận
            assertDoesNotThrow(() -> service.traLoiTuCong(200, Set.of(5), phienBan(200), " DOI_HANG ", " NHAN_LAI ", "Nguyễn Lan",
                    "  " + "ư".repeat(255) + "  "));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
        }

        @Test
        @DisplayName("Nhà cung cấp mở trang khi phiếu còn Nháp, bấm lúc phiếu vừa nhập kho: theo trạng thái mới nhất, trừ tiền áp ngay vào đơn")
        void phieuVuaNhapKho() {
            phieu.setTrangThai(0);
            doAnswer(inv -> {
                inv.<PhieuNhapKho>getArgument(0).setTrangThai(3);
                return null;
            }).when(entityManager).refresh(same(phieu));

            BienBanTraHangDto dto = traLoi(200, "TRU_CONG_NO", "NHAN_LAI");
            soBang("10", dongA.getSoLuongDaNhan(), "áp trừ tiền theo phiếu vừa nhập");
            assertEquals(3, dto.getSoLuongTruTien());
            assertTrue(dto.getPhieuDaNhap());
        }

        @Test
        @DisplayName("Trước nhập kho: chọn tự do, đổi qua lại được; chỉ ghi lựa chọn, không đụng đơn mua")
        void truocNhapKhoDoiTuDo() {
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);
            BienBanTraHangDto a = traLoi(200, "TRU_CONG_NO", "TIEU_HUY");
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), a.getCachBuMo());
            assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, a.getTrangThaiHienThi());
            BienBanTraHangDto b = traLoi(200, "DOI_HANG", "NHAN_LAI");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, b.getPhuongAn());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, b.getHangLoiNcc());
            traLoi(200, "TRU_CONG_NO", null);
            assertEquals(3, gia.theo(200, IHanhDong.chot_tra_hang_ncc).size());
            soBang("8", dongA.getSoLuongDaNhan(), "chưa nhập kho: chưa trừ");
            verify(ctDonRepo, never()).save(any());
            verify(ctPhieuRepo, never()).datNhapSau(any(), any(), any());
            verify(thongBao, never()).bienBanDaChotXong(any());
            verify(thongBao, never()).hangLoiCanXuLy(any(), any(), anyInt(), anyInt(), any());
            verify(email, times(3)).guiDaGhiNhanTraLoi(same(bb), any(), eq(false));
        }
    }

    // ═══════════════════════ Nhập kho ═══════════════════════

    @Nested
    @DisplayName("Nhập kho áp lựa chọn của nhà cung cấp (khiNhapKho)")
    class NhapKho {

        @BeforeEach
        void phieuConNhap() {
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
        }

        private void nhapKho() {
            phieu.setTrangThai(3);
            phieu.setNgayNhap(Instant.now());
            service.khiNhapKho(bb, phieu, 61);
        }

        @Test
        @DisplayName("Chưa trả lời: biên bản chờ nhà cung cấp, báo mua hàng; không đụng dòng đơn, không báo kho")
        void choChot() {
            nhapKho();
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
            verify(thongBao).bienBanTraHang(bb, phieu, 61);
            verify(thongBao, never()).hangLoiCanXuLy(any(), any(), anyInt(), anyInt(), any());
            verify(ctDonRepo, never()).khoaTheoDonMua(any());
            verify(ctDonRepo, never()).save(any());
            verify(bienBanRepo, never()).save(any());
        }

        @Test
        @DisplayName("Biên bản đã hủy / phiếu không thuộc đơn mua / không có biên bản: không làm gì")
        void khongLamGi() {
            bb.setTrangThai(BienBanTraHangNcc.DA_HUY);
            nhapKho();
            bb.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            phieu.setDonMuaHang(null);
            service.khiNhapKho(bb, phieu, 61);
            service.khiNhapKho(null, phieu, 61);
            verifyNoInteractions(bienBanRepo, thongBao, ctDonRepo);
            assertEquals(2, gia.dong.size(), "chỉ có dòng lập và dòng ghi ký, không ghi gì thêm");
        }

        @Test
        @DisplayName("NCC chọn trừ tiền + nhận lại trước nhập kho: chỉ ghi lựa chọn; nhập kho mới cộng số lỗi vào đã nhận, nhật ký trừ tiền, báo kho giao trả")
        void nccChonTruTienTruocNhapKho() {
            BienBanTraHangDto chon = service.traLoiTuCong(200, Set.of(5), phienBan(200), "TRU_CONG_NO", "NHAN_LAI",
                    "  Nguyễn Thị   Lan ", " Trừ vào kỳ sau ");

            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "chưa nhập kho: chưa trừ");
            soBang("4", dongB.getSoLuongDaNhan(), "chưa nhập kho: chưa trừ");
            verify(ctDonRepo, never()).save(any());
            assertEquals(3, don.getTrangThai());
            assertFalse(chon.getPhieuDaNhap());
            assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, chon.getTrangThaiHienThi());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, chon.getNguonChot());
            assertEquals(0, chon.getSoLuongTruTien());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), chon.getCachBuMo(), "chưa nhập kho: còn đổi");
            assertEquals(Map.of(), gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0)).get("truTheoBienThe"));
            verify(thongBao).nccDaTraLoi(bb, phieu, 0, 3, 3, 0, false);
            verify(thongBao, never()).bienBanDaChotXong(any());
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(false));

            nhapKho();

            soBang("10", dongA.getSoLuongDaNhan(), "8 đạt + 2 lỗi trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "4 đạt + 1 lỗi trừ tiền");
            assertTrue(don.getChiTietDonMuaHangs().stream().allMatch(c -> c.conThieu().signum() == 0),
                    "hết còn thiếu: PhieuNhapKhoService xét nhận đủ ngay sau khiNhapKho");
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            List<LichSuThayDoi> tru = gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc);
            assertEquals(1, tru.size());
            assertEquals(Map.of("10", 2, "11", 1), gia.moi(tru.get(0)).get("truTheoBienThe"));
            soBang("250000", gia.moi(tru.get(0)).get("tienTru"), "tiền trừ lúc nhập kho");
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 3, 0, 61);
            verify(thongBao, never()).bienBanTraHang(any(), any(), any());

            BienBanTraHangDto dto = xem(bb);
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, dto.getNguonChot());
            assertEquals("Nguyễn Thị Lan", dto.getNguoiXacNhanNcc());
            assertEquals("Trừ vào kỳ sau", dto.getGhiChuChot());
            assertEquals(3, dto.getSoLuongTruTien());
            soBang("250000", dto.getTienTruTien(), "DTO tiền trừ");
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, dto.getTrangThaiHienThi());
            assertEquals(List.of(), dto.getCachBuMo(), "đã nhập kho: trừ tiền là chốt cuối");
            assertEquals(Map.of(10, 2, 11, 1), service.truTienTheoBienThe(50));
        }

        @Test
        @DisplayName("NCC chọn giao bù + tiêu hủy trước nhập kho: nhập kho không đổi đơn (lỗi vẫn là còn thiếu), báo kho tiêu hủy")
        void nccChonGiaoBuTruocNhapKho() {
            traLoi(200, "DOI_HANG", "TIEU_HUY");
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(false));

            nhapKho();

            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "đã nhận áo A");
            soBang("4", dongB.getSoLuongDaNhan(), "đã nhận áo B");
            verify(ctDonRepo, never()).save(any());
            assertEquals(3, don.getTrangThai());
            assertTrue(gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc).isEmpty());
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 0, 3, 61);
            verify(thongBao, never()).bienBanTraHang(any(), any(), any());
            assertTrue(service.truTienTheoBienThe(50).isEmpty());
            BienBanTraHangDto dto = xem(bb);
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, dto.getTrangThaiHienThi());
            assertFalse(dto.getBuXong());
        }

        @Test
        @DisplayName("Trước nhập kho NCC đổi lựa chọn được (giao bù → trừ tiền); nhập kho áp lựa chọn cuối, hàng lỗi giữ lựa chọn trước")
        void nccDoiLuaChonTruocNhapKho() {
            traLoi(200, "DOI_HANG", "NHAN_LAI");
            service.traLoiTuCong(200, Set.of(5), phienBan(200), "TRU_CONG_NO", null, "Nguyễn Lan", "đổi ý");

            List<LichSuThayDoi> chotNk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(2, chotNk.size());
            assertEquals("DOI_HANG", gia.moi(chotNk.get(1)).get("phuongAnCu"));
            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(200);
            assertEquals("TRU_CONG_NO", nk.cachBu().phuongAn());
            assertNull(nk.luaChonHangLoi(), "chọn theo dòng: không còn lựa chọn chung của cả biên bản");
            assertEquals("NHAN_LAI", nk.hangLoiDong(301).giaTri(), "hàng lỗi giữ lựa chọn trước");
            assertEquals("NHAN_LAI", nk.hangLoiDong(302).giaTri());
            assertEquals("TRU_CONG_NO", nk.cachBuDong(301).giaTri());

            nhapKho();
            soBang("10", dongA.getSoLuongDaNhan(), "áp trừ tiền");
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 3, 0, 61);
        }

        @Test
        @DisplayName("Trừ tiền NCC đã chọn vượt phần còn thiếu ở một biến thể (phiếu Nháp khác đang giữ): biến thể trừ được vẫn áp, dòng của biến thể vượt về chờ chọn, email chọn lại đúng các dòng đó, báo mua hàng + kho; NCC chọn lại sau nhập kho được")
        void truTienVuotKhiNhapKho() {
            traLoi(200, "TRU_CONG_NO", "NHAN_LAI");
            clearInvocations(bienBanRepo, ctDonRepo, thongBao, email);
            when(ctPhieuRepo.sumDuKienPhieuNhapCungDon(50, 10)).thenReturn(BigDecimal.ONE);

            nhapKho();

            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy(), "còn dòng áo A chờ chọn");
            verify(bienBanRepo).save(bb);
            soBang("8", dongA.getSoLuongDaNhan(), "áo A vượt: không trừ");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ được: 4 đạt + 1 lỗi trừ tiền");
            verify(ctDonRepo, never()).save(dongA);
            verify(ctDonRepo).save(dongB);
            List<LichSuThayDoi> tru = gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc);
            assertEquals(1, tru.size());
            assertEquals(Map.of("11", 1), gia.moi(tru.get(0)).get("truTheoBienThe"));
            soBang("50000", gia.moi(tru.get(0)).get("tienTru"), "chỉ tiền áo B");
            List<LichSuThayDoi> chotNk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(2, chotNk.size(), "lựa chọn của NCC + lần nhập kho đưa dòng áo A về chờ chọn");
            Map<String, Object> veChoChot = gia.moi(chotNk.get(1));
            assertEquals(NhatKyTraHangNcc.NGUON_NHAP_KHO, veChoChot.get("nguon"));
            assertEquals("CHO_CHOT", veChoChot.get("phuongAn"));
            assertEquals("TRU_CONG_NO", veChoChot.get("phuongAnCu"));
            assertEquals(Map.of("301", Map.of("cachBu", "CHO_CHOT")), veChoChot.get("theoDong"),
                    "chỉ dòng áo A, không đụng lựa chọn hàng lỗi");
            assertTrue(chotNk.get(1).getGhiChu().contains("POLO-A"), chotNk.get(1).getGhiChu());
            assertFalse(chotNk.get(1).getGhiChu().contains("POLO-B"), chotNk.get(1).getGhiChu());
            verify(email).guiCanChonLaiCachBu(same(bb), any(BienBanTraHangDto.class), eq(List.of(301)));
            verify(thongBao).bienBanTraHang(bb, phieu, 61);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 3, 0, 61);
            verify(thongBao, never()).bienBanDaChotXong(any());
            BienBanTraHangDto dto = xem(bb);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, dto.getPhuongAn());
            assertNull(dto.getNguonChot(), "chờ chọn: không hiện lần chọn của cả biên bản");
            assertNull(dto.getNguoiXacNhanNcc());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, dto.getHangLoiNcc());
            assertTrue(dto.getChoNccChonCachBu());
            assertFalse(dto.getChoNccChonHangLoi());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, dto.getTrangThaiHienThi());
            assertEquals(1, dto.getSoLuongTruTien());
            assertEquals(2, dto.getSoLuongChoChonCachBu());
            BienBanTraHangDto.ChiTietItemDto a = muc(dto, 301);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, a.getCachBu());
            assertEquals(NhatKyTraHangNcc.NGUON_NHAP_KHO, a.getNguonCachBu());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), a.getCachBuMo());
            BienBanTraHangDto.ChiTietItemDto b = muc(dto, 302);
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, b.getCachBu());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, b.getNguonCachBu());
            assertEquals(List.of(), b.getCachBuMo(), "đã trừ tiền sau nhập kho: chốt");

            // Nhà cung cấp chọn lại giao bù theo cách gửi cũ: áp cho dòng còn chờ, dòng áo B đã trừ tiền bỏ qua
            traLoi(200, "DOI_HANG", null);
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy(), "áo A giao bù, áo B trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "không trừ lại áo B");
        }

        @Test
        @DisplayName("Biên bản cũ không có nhật ký lập (phương án do kho chọn, NCC chưa được hỏi): nhập kho đưa về chờ chọn, không tự trừ tiền")
        void duLieuCuVeChoChot() {
            for (String pa : List.of(BienBanTraHangNcc.PA_TRU_CONG_NO, BienBanTraHangNcc.PA_CU_TRA_TAI_XE,
                    BienBanTraHangNcc.PA_DOI_HANG, "DOI_HANG_MOI")) {
                BienBanTraHangNcc cu = bienBan(213, phieu, pa);
                clearInvocations(bienBanRepo, thongBao);
                phieu.setTrangThai(3);
                service.khiNhapKho(cu, phieu, 61);
                assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, cu.getPhuongAnXuLy(), pa);
                boolean taiXe = BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(pa);
                assertEquals(taiXe ? BienBanTraHangNcc.DA_TRA_HANG : BienBanTraHangNcc.CHO_TRA_HANG, cu.getTrangThai(),
                        "mã cũ trả tài xế: hàng lỗi vẫn là đã rời kho sau khi bỏ mã");
                BienBanTraHangDto dto = xem(cu);
                assertEquals(taiXe ? BienBanTraHangNcc.TRA_NGAY : BienBanTraHangNcc.GIU_KHO, dto.getCachXuLyHang(), pa);
                assertEquals(taiXe ? BienBanTraHangNcc.HANG_DA_TRA : BienBanTraHangNcc.HANG_O_KHO, dto.getTrangThaiHang(), pa);
                verify(bienBanRepo).save(cu);
                verify(thongBao).bienBanTraHang(cu, phieu, 61);
                verify(thongBao, never()).bienBanDaChotXong(any());
            }
            soBang("8", dongA.getSoLuongDaNhan(), "không tự trừ tiền");
            soBang("4", dongB.getSoLuongDaNhan(), "không tự trừ tiền");
            verify(ctDonRepo, never()).save(any());
            assertTrue(gia.theo(213, IHanhDong.tru_tien_tra_hang_ncc).isEmpty());
        }
    }

    // ═══════════════════════ Đóng đơn ═══════════════════════

    @Nested
    @DisplayName("Đóng đơn chuyển hàng lỗi chưa xong sang trừ tiền (chuyenTruTienKhiDongDon)")
    class DongDon {

        @Test
        @DisplayName("Chờ chọn → trừ tiền tối đa phần còn thiếu mỗi biến thể (cộng vào đã nhận), nguồn Đóng đơn, ghi người đóng và lý do")
        void choChotSangTruTien() {
            dongA.setSoLuongDaNhan(new BigDecimal("9")); // áo A chỉ còn thiếu 1 dù lỗi 2
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(bb));

            service.chuyenTruTienKhiDongDon(don, nguoiChot, "NCC hết hàng");

            soBang("10", dongA.getSoLuongDaNhan(), "min(lỗi 2, còn thiếu 1)");
            soBang("5", dongB.getSoLuongDaNhan(), "đã nhận áo B");
            assertEquals(0, dongA.conThieu().signum());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            verify(bienBanRepo).save(bb);
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao, never()).hangLoiCanXuLy(any(), any(), anyInt(), anyInt(), any());

            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0));
            assertEquals(Map.of("10", 1, "11", 1), m.get("truTheoBienThe"));
            assertFalse(m.containsKey("hangLoi"));
            BienBanTraHangDto dto = xem(bb);
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, dto.getNguonChot());
            assertEquals(2, dto.getSoLuongTruTien());
            soBang("150000", dto.getTienTruTien(), "1 × 100.000 + 1 × 50.000");
            assertEquals("NCC hết hàng", dto.getGhiChuChot());
            assertEquals("Trần Mua", dto.getNguoiChot());
            assertEquals(Map.of(10, 1, 11, 1), service.truTienTheoBienThe(50));
            assertTrue(dto.getChoNccChonHangLoi(), "hàng lỗi vẫn chờ nhà cung cấp chọn, đóng đơn không tự xử lý");
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, dto.getTrangThaiHienThi());
        }

        @Test
        @DisplayName("Nhà cung cấp đã chọn nhận lại: đóng đơn chuyển trừ tiền rồi báo kho giao trả")
        void daChonHangLoi_baoKho() {
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now());
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(bb));
            service.chuyenTruTienKhiDongDon(don, nguoiChot, "Đóng");
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 3, 0, 7);
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, xem(bb).getTrangThaiHienThi());
        }

        @Test
        @DisplayName("Giao bù chưa xong → trừ tiền phần còn thiếu theo từng dòng (dòng đã hết thiếu giữ giao bù: hỗn hợp); giao bù đã xong và trừ tiền thì giữ nguyên")
        void giaoBuVaTruTien() {
            PhieuNhapKho phieu2 = phieuKhac(2, 3);
            PhieuNhapKho phieu3 = phieuKhac(3, 3);
            loiTheoPhieu.put(2, Map.of(11, 1));
            loiTheoPhieu.put(3, Map.of(10, 1));
            BienBanTraHangNcc giaoBuChuaXong = bienBan(201, phieu, BienBanTraHangNcc.PA_DOI_HANG);
            BienBanTraHangNcc giaoBuXong = bienBan(202, phieu2, BienBanTraHangNcc.PA_DOI_HANG);
            BienBanTraHangNcc daTru = bienBan(203, phieu3, BienBanTraHangNcc.PA_TRU_CONG_NO);
            dongB.setSoLuongDaNhan(new BigDecimal("5")); // áo B đã giao bù đủ
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(giaoBuChuaXong, giaoBuXong, daTru));

            service.chuyenTruTienKhiDongDon(don, nguoiChot, "Đóng");

            assertEquals(BienBanTraHangNcc.PA_HON_HOP, giaoBuChuaXong.getPhuongAnXuLy(),
                    "dòng áo A trừ tiền, dòng áo B đã giao bù đủ giữ giao bù");
            verify(bienBanRepo).save(giaoBuChuaXong);
            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(201);
            assertEquals(2, nk.soTru(), "áo A trừ 2, áo B hết thiếu nên không trừ");
            assertEquals(Map.of(10, 2), nk.truTheoBienThe());
            assertEquals("DOI_HANG", nk.cachBu().phuongAnCu());
            assertEquals("HON_HOP", nk.cachBu().phuongAn());
            assertEquals("TRU_CONG_NO", nk.cachBuDong(311).giaTri());
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, nk.cachBuDong(311).lan().nguon());
            assertEquals("DOI_HANG", nk.cachBuDong(312).giaTri(), "dòng áo B giữ giao bù");
            assertEquals(NhatKyTraHangNcc.NGUON_DU_LIEU_CU, nk.cachBuDong(312).lan().nguon(),
                    "cột biên bản đổi sang hỗn hợp: cách bù cũ của dòng áo B chép xuống nhật ký trước");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, muc(xem(giaoBuChuaXong), 312).getCachBu());
            assertNull(muc(xem(giaoBuChuaXong), 312).getThoiDiemCachBu(), "chép từ dữ liệu cũ: không có lúc chọn");
            soBang("10", dongA.getSoLuongDaNhan(), "đã nhận áo A");
            soBang("5", dongB.getSoLuongDaNhan(), "đã nhận áo B không đổi");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, giaoBuXong.getPhuongAnXuLy());
            assertNull(gia.nhatKy.doc(202).cachBu());
            assertNull(gia.nhatKy.doc(203).cachBu());
            verify(bienBanRepo, never()).save(giaoBuXong);
            verify(bienBanRepo, never()).save(daTru);
        }

        @Test
        @DisplayName("Chờ chọn mà mọi biến thể lỗi đã hết thiếu (NCC giao đủ đợt sau): coi như đã bù, không trừ tiền")
        void choChotKhongConThieu() {
            dongA.setSoLuongDaNhan(new BigDecimal("10"));
            dongB.setSoLuongDaNhan(new BigDecimal("5"));
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(bb));

            service.chuyenTruTienKhiDongDon(don, nguoiChot, "Đóng");

            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(200);
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, nk.cachBu().nguon());
            assertEquals(0, nk.soTru());
            verify(ctDonRepo, never()).save(any());
        }

        @Test
        @DisplayName("Lý do dài hơn 255 ký tự: ghi chú cắt còn 255")
        void lyDoDai() {
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(bb));
            service.chuyenTruTienKhiDongDon(don, nguoiChot, "x".repeat(300));
            assertEquals(255, gia.nhatKy.doc(200).cachBu().ghiChu().length());
        }
    }

    // ═══════════════════════ Kho ghi giao trả / tiêu hủy theo lựa chọn của nhà cung cấp ═══════════════════════

    @Nested
    @DisplayName("Kho ghi đã giao trả / tiêu hủy hàng lỗi theo lựa chọn của nhà cung cấp")
    class GiaoTra {

        private GiaoTraHangLoiRequest.GiaoTraHangLoiRequestBuilder giao(String cach) {
            return GiaoTraHangLoiRequest.builder().cachGiao(cach).nguoiNhan("Giao Hàng Nhanh").maVanDon("GHN123")
                    .thoiDiem(Instant.now().minus(Duration.ofHours(1)));
        }

        private GiaoTraHangLoiRequest.GiaoTraHangLoiRequestBuilder huy() {
            return GiaoTraHangLoiRequest.builder().thoiDiem(Instant.now().minus(Duration.ofMinutes(30)));
        }

        @Test
        @DisplayName("Giao trả chỉ khi NCC đã chọn nhận lại: chưa chọn / chọn tiêu hủy → 409, không lưu")
        void giaoTraCanNccNhanLai() {
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()))
                    .getMessage().contains("chưa chọn nhận lại"));
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_TIEU_HUY, Instant.now().minus(Duration.ofHours(2)));
            loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()));
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, bb.maHangLoi());
            verify(bienBanRepo, never()).save(any());
            assertTrue(gia.theo(200, IHanhDong.giao_tra_hang_loi).isEmpty());

            // NCC đổi sang nhận lại (hàng còn ở kho): giao trả được
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            service.ghiDaGiaoTra(200, giao("NCC_LAY").build());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, bb.maHangLoi());
        }

        @Test
        @DisplayName("Gửi vận chuyển: thiếu mã vận đơn hoặc đơn vị vận chuyển 400; đủ thì hàng thành đã trả, chi tiết ở nhật ký, báo xong việc giao trả")
        void vanChuyen() {
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("VAN_CHUYEN").maVanDon("  ").build()))
                    .getMessage().contains("mã vận đơn"));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("VAN_CHUYEN").nguoiNhan(null).build()));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("VAN_CHUYEN").maVanDon("x".repeat(51)).build()));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("TAI_XE").build()));
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, bb.maHangLoi());
            verify(bienBanRepo, never()).save(any());
            assertTrue(gia.theo(200, IHanhDong.giao_tra_hang_loi).isEmpty());

            Instant luc = Instant.now().minus(Duration.ofHours(1));
            BienBanTraHangDto dto = service.ghiDaGiaoTra(200, giao("VAN_CHUYEN").thoiDiem(luc).ghiChu(" gửi kèm biên bản ").build());
            assertEquals(BienBanTraHangNcc.DA_TRA_HANG, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, dto.getTrangThaiHang());
            assertEquals(BienBanTraHangNcc.GIAO_VAN_CHUYEN, dto.getCachGiao());
            assertEquals("GHN123", dto.getMaVanDon());
            assertEquals("Giao Hàng Nhanh", dto.getNguoiNhanHang());
            assertEquals(luc, dto.getThoiDiemTra());
            assertEquals("gửi kèm biên bản", dto.getGhiChuTra());
            assertEquals("Trần Mua", dto.getNguoiGhiTra());
            assertEquals(List.of(), dto.getHangLoiMo(), "hàng đã rời kho: không đổi lựa chọn hàng lỗi được nữa");
            assertEquals(1, gia.theo(200, IHanhDong.giao_tra_hang_loi).size());
            verify(thongBao).hangLoiDaRoiKho(bb);
        }

        @Test
        @DisplayName("Nhà cung cấp đến lấy: không lưu mã vận đơn; thiếu người nhận 400")
        void nccLay() {
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").nguoiNhan(" ").build()));
            BienBanTraHangDto dto = service.ghiDaGiaoTra(200, giao("NCC_LAY").nguoiNhan("Anh Tú").build());
            assertEquals(BienBanTraHangNcc.GIAO_NCC_LAY, dto.getCachGiao());
            assertEquals("Anh Tú", dto.getNguoiNhanHang());
            assertNull(dto.getMaVanDon());
            assertFalse(gia.moi(gia.theo(200, IHanhDong.giao_tra_hang_loi).get(0)).containsKey("maVanDon"));
        }

        @Test
        @DisplayName("Thời điểm: thiếu, trước lúc lập biên bản, sau hiện tại quá 5 phút thì 400; lệch đồng hồ 4 phút vẫn nhận")
        void thoiDiem() {
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").thoiDiem(null).build()));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").thoiDiem(bb.getNgayTao().minus(Duration.ofMinutes(5))).build()));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").thoiDiem(Instant.now().plus(Duration.ofMinutes(10))).build()));
            assertDoesNotThrow(() -> service.ghiDaGiaoTra(200, giao("NCC_LAY").thoiDiem(Instant.now().plus(Duration.ofMinutes(4))).build()));
        }

        @Test
        @DisplayName("Phiếu chưa nhập kho, hàng đã trả / tiêu hủy, biên bản cũ trả tài xế, biên bản đã hủy: 409; hàng còn ở kho thì ghi được")
        void dieuKienHang() {
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            phieu.setTrangThai(0);
            loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()));
            phieu.setTrangThai(3);

            bb.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()))
                    .getMessage().contains("không còn ở kho"));
            bb.setTrangThai(BienBanTraHangNcc.DA_TIEU_HUY);
            loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()));
            bb.setTrangThai(BienBanTraHangNcc.DA_HUY);
            loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()));

            // Biên bản lập trước 22/11 mã TRA_TAI_XE: hàng lỗi đã theo tài xế về dù trang_thai còn chờ trả
            bb.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_CU_TRA_TAI_XE);
            loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao("NCC_LAY").build()));
            verify(bienBanRepo, never()).save(any());

            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            service.ghiDaGiaoTra(200, giao("NCC_LAY").build());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, bb.maHangLoi());
        }

        @Test
        @DisplayName("Tiêu hủy chỉ khi NCC đã đồng ý: chưa chọn / chọn nhận lại → 409 (cả khi cách bù đã chốt)")
        void tieuHuyCanNccDongY() {
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiTieuHuy(200, huy().build()))
                    .getMessage().contains("chưa đồng ý tiêu hủy"));
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(2)));
            loi(HttpStatus.CONFLICT, () -> service.ghiTieuHuy(200, huy().build()));
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, bb.maHangLoi());
            verify(bienBanRepo, never()).save(any());
            assertTrue(gia.theo(200, IHanhDong.tieu_huy_hang_loi).isEmpty());
        }

        @Test
        @DisplayName("Tiêu hủy: người đồng ý lấy từ câu trả lời của NCC (bỏ người nhận / cách giao / mã vận đơn gửi lên); thời điểm trước lúc đồng ý quá 1 phút → 400")
        void tieuHuy() {
            Instant dongY = Instant.now().minus(Duration.ofHours(2));
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_TIEU_HUY, dongY);

            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.ghiTieuHuy(200, huy().thoiDiem(dongY.minus(Duration.ofMinutes(5)))
                    .build())).getMessage().contains("trước lúc nhà cung cấp đồng ý"));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiTieuHuy(200, huy().thoiDiem(null).build()));
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiTieuHuy(200, huy().ghiChu("x".repeat(256)).build()));
            verify(bienBanRepo, never()).save(any());

            // Lệch đồng hồ dưới 1 phút trước lúc đồng ý vẫn nhận
            Instant luc = dongY.minus(Duration.ofSeconds(30));
            BienBanTraHangDto dto = service.ghiTieuHuy(200, GiaoTraHangLoiRequest.builder().nguoiNhan("Ai đó")
                    .cachGiao("VAN_CHUYEN").maVanDon("GHN1").thoiDiem(luc).ghiChu(" đốt tại kho ").build());
            assertEquals(BienBanTraHangNcc.DA_TIEU_HUY, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_DA_TIEU_HUY, dto.getTrangThaiHang());
            assertEquals("Chị Lan", dto.getNguoiNhanHang(), "người đồng ý bên nhà cung cấp");
            assertNull(dto.getCachGiao());
            assertNull(dto.getMaVanDon());
            assertEquals(luc, dto.getThoiDiemTra());
            assertEquals("đốt tại kho", dto.getGhiChuTra());
            assertEquals("Trần Mua", dto.getNguoiGhiTra());
            List<LichSuThayDoi> nk = gia.theo(200, IHanhDong.tieu_huy_hang_loi);
            assertEquals(1, nk.size());
            assertEquals("Chị Lan", gia.moi(nk.get(0)).get("nguoiDongY"));
            assertFalse(gia.moi(nk.get(0)).containsKey("nguoiNhan"));
            verify(thongBao).hangLoiDaRoiKho(bb);

            // Đã tiêu hủy: không ghi lại được
            loi(HttpStatus.CONFLICT, () -> service.ghiTieuHuy(200, huy().build()));
        }
    }

    // ═══════════════════════ Trạng thái hiển thị ═══════════════════════

    /** Nhật ký chỉ có lựa chọn hàng lỗi của nhà cung cấp cho cả biên bản (cách ghi cũ; null: chưa chọn). */
    private static NhatKyTraHangNcc.NhatKy nkHangLoi(String hangLoi) {
        NhatKyTraHangNcc.TraLoi t = hangLoi == null ? null : new NhatKyTraHangNcc.TraLoi(null, null, hangLoi,
                NhatKyTraHangNcc.NGUON_CONG_NCC, "Chị Lan", null, null, null, Instant.now(), null, null, false);
        NhatKyTraHangNcc.LuaChon chung = t == null ? null : new NhatKyTraHangNcc.LuaChon(hangLoi, t);
        return new NhatKyTraHangNcc.NhatKy(null, null, null, t, null, null, null, false, false, Map.of(), 0, BigDecimal.ZERO,
                null, Map.of(), chung, Map.of(), null, Map.of());
    }

    /** Trạng thái hiển thị tính trên dòng của biên bản (dựng từ nhật ký + cột như máy chủ); {@code buXong}: giao bù đã đủ. */
    private String trangThai(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk, boolean buXong) {
        List<BienBanTraHangServiceImpl.Dong> ds = BienBanTraHangServiceImpl.dungDong(b, nk,
                dongBienBan.getOrDefault(b.getId(), List.of()));
        return BienBanTraHangServiceImpl.trangThaiHienThi(b, nk, ds, d -> buXong);
    }

    @Test
    @DisplayName("Trạng thái hiển thị: hủy > mới lập (phiếu Nháp) > chờ NCC trả lời (cách bù hoặc hàng lỗi) > chờ giao trả / chờ tiêu hủy > chờ hàng bù > hoàn tất; mã cũ quy đổi")
    void trangThaiHienThi() {
        BienBanTraHangNcc b = bienBan(300, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
        NhatKyTraHangNcc.NhatKy trong = NhatKyTraHangNcc.NhatKy.TRONG;
        NhatKyTraHangNcc.NhatKy nhanLai = nkHangLoi(BienBanTraHangNcc.HL_NHAN_LAI);
        NhatKyTraHangNcc.NhatKy tieuHuy = nkHangLoi(BienBanTraHangNcc.HL_TIEU_HUY);

        b.setTrangThai(BienBanTraHangNcc.DA_HUY);
        assertEquals(BienBanTraHangServiceImpl.TT_DA_HUY, trangThai(b, nhanLai, true));
        b.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);

        phieu.setTrangThai(0);
        assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, trangThai(b, nhanLai, false),
                "phiếu Nháp: mới lập dù NCC đã trả lời");
        phieu.setTrangThai(3);

        // Chờ nhà cung cấp: còn cách bù hoặc còn hàng lỗi ở kho chưa chọn
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, trangThai(b, nhanLai, false));
        b.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, trangThai(b, trong, false),
                "trả ngay cho tài xế vẫn chờ chọn cách bù");
        b.setPhuongAnXuLy("");
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, trangThai(b, trong, false),
                "trống = chờ chọn");
        b.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
        b.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, trangThai(b, trong, true),
                "đã chọn cách bù nhưng hàng lỗi ở kho chưa chọn");

        // Kho làm theo lựa chọn hàng lỗi
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, trangThai(b, nhanLai, true));
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, trangThai(b, tieuHuy, true));
        b.setPhuongAnXuLy("DOI_HANG_MOI");
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, trangThai(b, nhanLai, true),
                "mã cũ = giao bù");
        b.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_HANG_BU, trangThai(b, nhanLai, false));
        assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, trangThai(b, nhanLai, true));

        b.setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
        assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, trangThai(b, trong, false));
        b.setTrangThai(BienBanTraHangNcc.DA_TIEU_HUY);
        assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, trangThai(b, tieuHuy, false));
        b.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
        b.setPhuongAnXuLy(BienBanTraHangNcc.PA_CU_TRA_TAI_XE);
        assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, trangThai(b, trong, false),
                "mã cũ trả tài xế: đã trừ tiền, hàng đã theo tài xế về");

        // Đơn mua đã đóng: không còn hỏi cách bù; hàng lỗi ở kho chưa chọn vẫn chờ nhà cung cấp
        b.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
        don.setTrangThai(6);
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, trangThai(b, trong, true));
        assertEquals(BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, trangThai(b, tieuHuy, true));
        b.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
        assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, trangThai(b, trong, true));
    }

    // ═══════════════════════ Hạn trả lời ═══════════════════════

    @Test
    @DisplayName("Hạn trả lời: hết ngày (23:59:59 giờ Việt Nam) thứ 7 kể từ ngày gửi email đầu theo giờ Việt Nam; nhắc trước 2 ngày")
    void hanTraLoi() {
        assertEquals(7, BienBanTraHangServiceImpl.HAN_TRA_LOI_NGAY);
        assertEquals(2, BienBanTraHangServiceImpl.NHAC_TRUOC_HAN_NGAY);
        // 17:00 ngày 20/11 giờ VN → hết ngày 27/11 giờ VN
        assertEquals(Instant.parse("2026-11-27T16:59:59Z"),
                BienBanTraHangServiceImpl.hanTraLoi(Instant.parse("2026-11-20T10:00:00Z")));
        // 01:30 ngày 21/11 giờ VN (vẫn là 20/11 theo UTC) → tính theo ngày VN: hết ngày 28/11
        assertEquals(Instant.parse("2026-11-28T16:59:59Z"),
                BienBanTraHangServiceImpl.hanTraLoi(Instant.parse("2026-11-20T18:30:00Z")));
        // 00:00 đúng ngày 21/11 giờ VN
        assertEquals(Instant.parse("2026-11-28T16:59:59Z"),
                BienBanTraHangServiceImpl.hanTraLoi(Instant.parse("2026-11-20T17:00:00Z")));
        // Qua tháng
        assertEquals(Instant.parse("2026-12-05T16:59:59Z"),
                BienBanTraHangServiceImpl.hanTraLoi(Instant.parse("2026-11-28T03:00:00Z")));
    }

    @Nested
    @DisplayName("Xét hạn trả lời (xetHanTraLoi, dsChoNccTraLoi): nhắc một lần, quá hạn tự trừ tiền, hàng lỗi không bao giờ tự tiêu hủy")
    class XetHan {

        /** Email biên bản đầu gửi lúc 10:00 ngày 10/11 giờ VN → hạn hết ngày 17/11 giờ VN. */
        private final Instant emailDau = Instant.parse("2026-11-10T03:00:00Z");
        private final Instant han = Instant.parse("2026-11-17T16:59:59Z");

        @BeforeEach
        void daGuiBienBan() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
        }

        private int soDong() {
            return gia.dong.size();
        }

        @Test
        @DisplayName("DTO có hạn trả lời tính từ email đầu; email gửi lại / cập nhật không dời hạn")
        void dtoCoHan() {
            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, emailDau.plus(Duration.ofDays(3)));
            BienBanTraHangDto dto = xem(bb);
            assertEquals(han, dto.getHanTraLoi());
            assertFalse(dto.getDaNhacHan());
            assertEquals(emailDau.plus(Duration.ofDays(3)), dto.getEmailGuiLuc(), "lần gửi gần nhất");
        }

        @Test
        @DisplayName("Còn xa hạn: không làm gì")
        void conXaHan() {
            int truoc = soDong();
            service.xetHanTraLoi(200, han.minus(Duration.ofDays(5)));
            verifyNoInteractions(email, thongBao);
            assertEquals(truoc, soDong());
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
        }

        @Test
        @DisplayName("Còn 2 ngày tới hạn: gửi email nhắc (loại NHAC, đúng hạn) một lần; gửi được rồi thì lần xét sau không nhắc nữa")
        void nhacMotLan() {
            service.xetHanTraLoi(200, han.minus(Duration.ofDays(1)));
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            ArgumentCaptor<BooleanSupplier> conHieuLuc = ArgumentCaptor.forClass(BooleanSupplier.class);
            verify(email).guiBienBanTraHang(same(bb), any(BienBanTraHangDto.class), eq(NhatKyTraHangNcc.EMAIL_NHAC), eq(han),
                    isNull(), conHieuLuc.capture(), khiGuiDuoc.capture());
            assertTrue(conHieuLuc.getValue().getAsBoolean(), "vẫn là lần lập hiện hành");
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy(), "nhắc không đổi gì");
            verifyNoInteractions(thongBao);
            khiGuiDuoc.getValue().run();
            assertEquals(NhatKyTraHangNcc.EMAIL_NHAC, gia.moi(dongCuoi()).get("loai"));
            assertTrue(xem(bb).getDaNhacHan());
            assertEquals(han, xem(bb).getHanTraLoi(), "email nhắc không dời hạn");

            clearInvocations(email);
            service.xetHanTraLoi(200, han.minus(Duration.ofHours(3)));
            verifyNoInteractions(email);

            // Đúng mốc 2 ngày trước hạn cũng nhắc (biên bản khác chưa nhắc)
            gia.dong.removeIf(d -> IHanhDong.gui_email_bien_ban_tra_hang.equals(d.getHanhDong())
                    && NhatKyTraHangNcc.EMAIL_NHAC.equals(gia.moi(d).get("loai")));
            service.xetHanTraLoi(200, han.minus(Duration.ofDays(2)));
            verify(email).guiBienBanTraHang(same(bb), any(), eq(NhatKyTraHangNcc.EMAIL_NHAC), eq(han), any(), any(), any());
        }

        @Test
        @DisplayName("Thư nhắc đã xếp hàng mà nhà cung cấp trả lời đủ trước lúc gửi (kể cả lúc thử lại): thư nhắc bỏ, không gửi")
        void nhacBoKhiDaTraLoiTruocLucGui() {
            service.xetHanTraLoi(200, han.minus(Duration.ofDays(1)));
            ArgumentCaptor<BooleanSupplier> conHieuLuc = ArgumentCaptor.forClass(BooleanSupplier.class);
            verify(email).guiBienBanTraHang(same(bb), any(), eq(NhatKyTraHangNcc.EMAIL_NHAC), eq(han), any(),
                    conHieuLuc.capture(), any());
            assertTrue(conHieuLuc.getValue().getAsBoolean());
            // Chọn cách bù rồi nhưng hàng lỗi còn ở kho chưa chọn: vẫn nhắc
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            assertTrue(conHieuLuc.getValue().getAsBoolean(), "còn câu hàng lỗi");
            // Hàng lỗi đã rời kho: không còn gì phải trả lời
            bb.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            assertFalse(conHieuLuc.getValue().getAsBoolean(), "đã trả lời đủ thì bỏ thư nhắc");
        }

        @Test
        @DisplayName("Nhắc khi hàng lỗi đã giao luôn cho tài xế: email ghi tài xế, biển số")
        void nhacCoMoTaTaiXe() {
            BienBanTraHangNcc traNgay = bienBan(215, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
            traNgay.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            when(bienBanRepo.findById(215)).thenReturn(Optional.of(traNgay));
            lap(traNgay, BienBanTraHangNcc.TRA_NGAY, "Nguyễn Văn Hùng", "30K-288.23");
            daGuiEmail(traNgay, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            service.xetHanTraLoi(215, han.minus(Duration.ofDays(1)));
            verify(email).guiBienBanTraHang(same(traNgay), any(), eq("NHAC"), eq(han),
                    eq("Người giao hàng Nguyễn Văn Hùng · biển số 30K-288.23"), any(), any());
        }

        @Test
        @DisplayName("Quá hạn, chưa chọn cách bù, phiếu đã nhập: tự chuyển trừ tiền nguồn TU_DONG, áp vào đơn (nhận đủ), báo mua hàng, email M5 tự động; hàng lỗi vẫn ở kho chờ NCC")
        void quaHanTuTruTien() {
            service.xetHanTraLoi(200, han.plusSeconds(1));

            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            verify(bienBanRepo).save(bb);
            soBang("10", dongA.getSoLuongDaNhan(), "8 đạt + 2 lỗi trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "4 đạt + 1 lỗi trừ tiền");
            assertEquals(5, don.getTrangThai());
            verify(thongBao).donMuaDaNhanDu(don, null, null);

            List<LichSuThayDoi> nk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(1, nk.size());
            Map<String, Object> m = gia.moi(nk.get(0));
            assertEquals("TRU_CONG_NO", m.get("phuongAn"));
            assertEquals("CHO_CHOT", m.get("phuongAnCu"));
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, m.get("nguon"));
            assertFalse(m.containsKey("hangLoi"), "không tự chọn hàng lỗi");
            assertFalse(m.containsKey("nguoiXacNhan"));
            assertEquals(Map.of("10", 2, "11", 1), m.get("truTheoBienThe"));
            soBang("250000", m.get("tienTru"), "tiền trừ quá hạn");
            assertEquals(INguonNhatKy.he_thong, nk.get(0).getNguon());
            assertNull(nk.get(0).getNguoiThucHien());

            // Hàng lỗi KHÔNG tự tiêu hủy
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
            assertTrue(gia.theo(200, IHanhDong.tieu_huy_hang_loi).isEmpty());
            assertNull(gia.nhatKy.doc(200).luaChonHangLoi());

            verify(thongBao).quaHanTruTien(bb, phieu, 3, 0);
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao, never()).hangLoiCanXuLy(any(), any(), anyInt(), anyInt(), any());
            ArgumentCaptor<BienBanTraHangDto> m5 = ArgumentCaptor.forClass(BienBanTraHangDto.class);
            verify(email).guiDaGhiNhanTraLoi(same(bb), m5.capture(), eq(true));
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, m5.getValue().getNguonChot());
            verify(email, never()).guiBienBanTraHang(any(), any(), any(), any(), any(), any(), any());

            BienBanTraHangDto dto = xem(bb);
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, dto.getNguonChot());
            assertNull(dto.getNguoiXacNhanNcc());
            assertEquals(3, dto.getSoLuongTruTien());
            assertFalse(dto.getChoNccChonCachBu());
            assertTrue(dto.getChoNccChonHangLoi(), "hàng lỗi vẫn chờ nhà cung cấp chọn");
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, dto.getTrangThaiHienThi());

            // Lần xét sau: còn chờ hàng lỗi nhưng không làm gì thêm (không trừ lần hai, không nhắc sau hạn)
            clearInvocations(email, thongBao, ctDonRepo);
            int truoc = soDong();
            service.xetHanTraLoi(200, han.plus(Duration.ofDays(3)));
            assertEquals(truoc, soDong());
            verify(ctDonRepo, never()).save(any());
            verifyNoInteractions(email, thongBao);
        }

        @Test
        @DisplayName("Quá hạn khi phiếu còn Nháp: chỉ ghi trừ tiền (chưa áp), nhập kho mới cộng vào đơn")
        void quaHanPhieuChuaNhap() {
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);
            service.xetHanTraLoi(200, han.plusSeconds(1));
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "chưa nhập kho: chưa trừ");
            assertEquals(Map.of(), gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0)).get("truTheoBienThe"));
            assertEquals(3, don.getTrangThai());
            verify(thongBao).quaHanTruTien(bb, phieu, 3, 0);
            verify(thongBao, never()).bienBanDaChotXong(any());
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(true));

            phieu.setTrangThai(3);
            phieu.setNgayNhap(Instant.now());
            service.khiNhapKho(bb, phieu, 61);
            soBang("10", dongA.getSoLuongDaNhan(), "nhập kho áp trừ tiền");
            assertEquals(1, gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc).size());
        }

        @Test
        @DisplayName("Quá hạn mà dòng đơn của một biến thể không còn chờ số lỗi (đã giao đủ đợt sau): dòng đó coi như đã giao bù (TU_DONG), dòng còn lại trừ tiền; biên bản hỗn hợp, không kẹt ở chờ chọn")
        void quaHanVuotConThieu() {
            dongB.setSoLuongDaNhan(new BigDecimal("5"));
            service.xetHanTraLoi(200, han.plusSeconds(1));

            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            verify(bienBanRepo).save(bb);
            soBang("10", dongA.getSoLuongDaNhan(), "áo A: 8 đạt + 2 lỗi trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B không trừ thêm");
            verify(ctDonRepo, never()).save(dongB);
            assertEquals(5, don.getTrangThai(), "mọi dòng hết thiếu: đơn nhận đủ");

            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0));
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, m.get("nguon"));
            assertEquals("HON_HOP", m.get("phuongAn"));
            assertEquals(Map.of("301", Map.of("cachBu", "TRU_CONG_NO"), "302", Map.of("cachBu", "DOI_HANG")), m.get("theoDong"));
            assertEquals(Map.of("10", 2), m.get("truTheoBienThe"));
            soBang("200000", m.get("tienTru"), "chỉ áo A");
            verify(thongBao).quaHanTruTien(bb, phieu, 2, 1);
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(true));

            BienBanTraHangDto dto = xem(bb);
            assertFalse(dto.getChoNccChonCachBu(), "không còn dòng chờ chọn cách bù");
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, muc(dto, 302).getNguonCachBu());
            assertEquals(List.of(), muc(dto, 302).getCachBuMo(), "hệ thống đã chuyển: nhà cung cấp không đổi được");
            assertEquals(List.of(), muc(dto, 301).getCachBuMo());
            assertTrue(muc(dto, 302).getBuXong(), "dòng đơn áo B đã nhận đủ");
        }

        @Test
        @DisplayName("Quá hạn mà cách bù đã chọn (giao bù), chỉ còn hàng lỗi chưa chọn: không đổi gì, không tiêu hủy")
        void quaHanChiConHangLoi() {
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            int truoc = soDong();
            service.xetHanTraLoi(200, han.plus(Duration.ofDays(10)));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
            assertEquals(truoc, soDong());
            verifyNoInteractions(email, thongBao);
            verify(ctDonRepo, never()).khoaTheoDonMua(any());
        }

        @Test
        @DisplayName("Nạp lại sau khóa: NCC vừa trả lời trong lúc chờ khóa → không tự trừ tiền")
        void napLaiNccVuaTraLoi() {
            doAnswer(inv -> {
                inv.<BienBanTraHangNcc>getArgument(0).setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
                return null;
            }).when(entityManager).refresh(same(bb), eq(LockModeType.PESSIMISTIC_WRITE));
            service.xetHanTraLoi(200, han.plusSeconds(1));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "không trừ");
            verify(bienBanRepo, never()).save(any());
            verifyNoInteractions(email, thongBao);
        }

        @Test
        @DisplayName("Không làm gì: chưa gửi được email (chưa có mốc hạn), NCC đã trả lời xong, biên bản đã hủy, đơn đã đóng mà hàng đã rời kho, không có biên bản")
        void khongLamGi() {
            gia.dong.removeIf(d -> IHanhDong.gui_email_bien_ban_tra_hang.equals(d.getHanhDong()));
            service.xetHanTraLoi(200, han.plus(Duration.ofDays(30)));
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy(), "chưa gửi email: không tính hạn");

            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, emailDau.plus(Duration.ofDays(1)));
            service.xetHanTraLoi(200, han.minus(Duration.ofDays(1)));
            service.xetHanTraLoi(200, han.plusSeconds(1));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());

            BienBanTraHangNcc huy = bienBan(216, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
            huy.setTrangThai(BienBanTraHangNcc.DA_HUY);
            when(bienBanRepo.findById(216)).thenReturn(Optional.of(huy));
            daGuiEmail(huy, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            service.xetHanTraLoi(216, han.plusSeconds(1));
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, huy.getPhuongAnXuLy());

            BienBanTraHangNcc donDong = bienBan(217, phieuKhac(9, 3), BienBanTraHangNcc.PA_CHO_CHOT);
            donDong.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            DonMuaHang dong = DonMuaHang.builder().id(51).trangThai(6).build();
            donDong.getPhieuNhapKho().setDonMuaHang(dong);
            when(bienBanRepo.findById(217)).thenReturn(Optional.of(donDong));
            daGuiEmail(donDong, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            service.xetHanTraLoi(217, han.plusSeconds(1));
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, donDong.getPhuongAnXuLy());

            assertDoesNotThrow(() -> service.xetHanTraLoi(999, han.plusSeconds(1)));
            verify(ctDonRepo, never()).save(any());
            verify(bienBanRepo, never()).save(any());
            verifyNoInteractions(email, thongBao);
        }

        @Test
        @DisplayName("dsChoNccTraLoi: chỉ biên bản đã gửi được email và còn câu chờ NCC (cách bù hoặc hàng lỗi)")
        void dsChoNccTraLoi() {
            // 200: đã gửi email, chờ cả hai câu → có
            BienBanTraHangNcc chuaGui = bienBan(221, phieuKhac(21, 3), BienBanTraHangNcc.PA_CHO_CHOT);
            BienBanTraHangNcc xong = bienBan(222, phieuKhac(22, 3), BienBanTraHangNcc.PA_DOI_HANG);
            daGuiEmail(xong, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            nccChonHangLoi(xong, BienBanTraHangNcc.HL_TIEU_HUY, emailDau);
            loiTheoPhieu.put(23, Map.of(10, 3));
            BienBanTraHangNcc conHangLoi = bienBan(223, phieuKhac(23, 3), BienBanTraHangNcc.PA_TRU_CONG_NO);
            daGuiEmail(conHangLoi, NhatKyTraHangNcc.EMAIL_CAP_NHAT, emailDau);
            // Biên bản cũ không có dòng: nhà cung cấp không chọn được gì trên cổng, không nhắc / không tự chuyển
            BienBanTraHangNcc khongDong = bienBan(226, phieuKhac(26, 3), BienBanTraHangNcc.PA_CHO_CHOT);
            daGuiEmail(khongDong, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            BienBanTraHangNcc daHuy = bienBan(224, phieuKhac(24, 3), BienBanTraHangNcc.PA_CHO_CHOT);
            daHuy.setTrangThai(BienBanTraHangNcc.DA_HUY);
            daGuiEmail(daHuy, NhatKyTraHangNcc.EMAIL_GUI, emailDau);
            BienBanTraHangNcc chiNhac = bienBan(225, phieuKhac(25, 3), BienBanTraHangNcc.PA_CHO_CHOT);
            daGuiEmail(chiNhac, NhatKyTraHangNcc.EMAIL_NHAC, emailDau);
            when(bienBanRepo.timDangChoXuLy()).thenReturn(List.of(bb, chuaGui, xong, conHangLoi, daHuy, chiNhac, khongDong));

            assertEquals(List.of(200, 223), service.dsChoNccTraLoi());

            when(bienBanRepo.timDangChoXuLy()).thenReturn(List.of());
            assertTrue(service.dsChoNccTraLoi().isEmpty());
        }

        @Test
        @DisplayName("Việc định kỳ HanTraLoiTraHangNcc: xét từng biên bản, một biên bản lỗi không chặn các biên bản khác")
        void viecDinhKy() {
            com.dev.backend.services.BienBanTraHangService sv = mock(com.dev.backend.services.BienBanTraHangService.class);
            when(sv.dsChoNccTraLoi()).thenReturn(List.of(1, 2, 3));
            doThrow(new IllegalStateException("hỏng")).when(sv).xetHanTraLoi(eq(2), any());
            new HanTraLoiTraHangNcc(sv).chay();
            verify(sv).xetHanTraLoi(eq(1), any());
            verify(sv).xetHanTraLoi(eq(2), any());
            verify(sv).xetHanTraLoi(eq(3), any());
        }
    }

    // ═══════════════════════ Số trừ tiền theo biến thể của đơn ═══════════════════════

    @Test
    @DisplayName("traHangTheoDon: đếm sản phẩm lỗi chưa chốt cách bù (số phải trả còn có thể giảm); chốt xong hoặc đơn đã đóng thì 0")
    void traHangTheoDonDemChoChot() {
        BienBanTraHangService.TraHangTheoDon dau = service.traHangTheoDon(List.of(50)).get(50);
        assertEquals(3, dau.soLoiChoChot(), "áo A × 2 + áo B × 1 chờ chọn");
        assertTrue(dau.truTheoBienThe().isEmpty());

        don.setTrangThai(6);
        assertEquals(0, service.traHangTheoDon(List.of(50)).get(50).soLoiChoChot(), "đơn đã đóng: không còn chờ");
        don.setTrangThai(3);

        traLoi(200, "DOI_HANG", "NHAN_LAI");
        assertEquals(0, service.traHangTheoDon(List.of(50)).get(50).soLoiChoChot(), "đã chọn giao bù");
        assertTrue(service.traHangTheoDon(List.of()).isEmpty());
    }

    @Test
    @DisplayName("truTienTheoBienThe: cộng nhật ký trừ tiền của mọi biên bản hiệu lực; biên bản trừ tiền cũ không nhật ký (đã nhập) = toàn bộ số lỗi")
    void truTienTheoBienThe() {
        // bb: nhà cung cấp chọn trừ tiền sau nhập kho {A:2, B:1}
        traLoi(200, "TRU_CONG_NO", "NHAN_LAI");

        PhieuNhapKho p2 = phieuKhac(2, 3);
        PhieuNhapKho p3 = phieuKhac(3, 3);
        PhieuNhapKho p4 = phieuKhac(4, 3);
        PhieuNhapKho p5 = phieuKhac(5, 0);
        PhieuNhapKho p6 = phieuKhac(6, 3);
        PhieuNhapKho p7 = phieuKhac(7, 3);
        loiTheoPhieu.put(2, Map.of(10, 1));
        loiTheoPhieu.put(3, Map.of(11, 1));
        loiTheoPhieu.put(4, Map.of(10, 3));
        loiTheoPhieu.put(5, Map.of(10, 4));
        loiTheoPhieu.put(6, Map.of(10, 5));
        loiTheoPhieu.put(7, Map.of(10, 2, 11, 2));
        BienBanTraHangNcc cuTru = bienBan(201, p2, BienBanTraHangNcc.PA_TRU_CONG_NO);          // dữ liệu cũ: +A1
        BienBanTraHangNcc cuTaiXe = bienBan(202, p3, BienBanTraHangNcc.PA_CU_TRA_TAI_XE);     // mã cũ: +B1
        BienBanTraHangNcc giaoBu = bienBan(203, p4, BienBanTraHangNcc.PA_DOI_HANG);           // giao bù: 0
        BienBanTraHangNcc chuaNhap = bienBan(204, p5, BienBanTraHangNcc.PA_TRU_CONG_NO);      // phiếu Nháp: 0
        BienBanTraHangNcc daHuy = bienBan(205, p6, BienBanTraHangNcc.PA_TRU_CONG_NO);         // đã hủy: bỏ
        daHuy.setTrangThai(BienBanTraHangNcc.DA_HUY);
        BienBanTraHangNcc dongDon = bienBan(206, p7, BienBanTraHangNcc.PA_TRU_CONG_NO);       // nhật ký mới: +A1
        lap(giaoBu, BienBanTraHangNcc.GIU_KHO, null, null);
        gia.nhatKy.ghiTraLoi(giaoBu, NhatKyTraHangNcc.TraLoi.ghi("DOI_HANG", "CHO_CHOT", "NHAN_LAI",
                NhatKyTraHangNcc.NGUON_CONG_NCC, "Chị Lan", Map.of(), BigDecimal.ZERO, null));
        gia.nhatKy.ghiTruTien(daHuy, Map.of(10, 5), new BigDecimal("500000"));
        lap(dongDon, BienBanTraHangNcc.GIU_KHO, null, null);
        gia.nhatKy.ghiTraLoi(dongDon, NhatKyTraHangNcc.TraLoi.ghi("TRU_CONG_NO", "DOI_HANG", null,
                NhatKyTraHangNcc.NGUON_DONG_DON, null, Map.of(10, 1), new BigDecimal("100000"), "Đóng"));
        dsBienBan.addAll(List.of(cuTru, cuTaiXe, giaoBu, chuaNhap, daHuy, dongDon));

        assertEquals(Map.of(10, 4, 11, 2), service.truTienTheoBienThe(50), "A: 2 + 1 + 1; B: 1 + 1");
        verify(bienBanRepo).timTheoDonMua(Set.of(50));

        dsBienBan.clear();
        assertTrue(service.truTienTheoBienThe(50).isEmpty(), "đơn không có biên bản");
    }

    // ═══════════════════════ DTO dựng từ nhật ký ═══════════════════════

    @Nested
    @DisplayName("DTO dựng từ nhật ký")
    class DtoTuNhatKy {

        @Test
        @DisplayName("Giao luôn tài xế: cách xử lý, tài xế, biển số, lúc trả, người ghi đọc từ nhật ký lập; chỉ còn hỏi cách bù")
        void giaoLuonTaiXe() {
            BienBanTraHangNcc b = bienBan(207, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
            b.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            lap(b, BienBanTraHangNcc.TRA_NGAY, "Nguyễn Văn Hùng", "30K-288.23");
            Instant lucKy = gia.theo(207, IHanhDong.ky_bien_ban_tra_hang).get(0).getNgayThucHien();

            BienBanTraHangDto dto = xem(b);
            assertEquals(BienBanTraHangNcc.TRA_NGAY, dto.getCachXuLyHang());
            assertEquals("Nguyễn Văn Hùng", dto.getNguoiNhanHang());
            assertEquals("30K-288.23", dto.getBienSoXe());
            assertEquals(BienBanTraHangNcc.GIAO_TAI_XE, dto.getCachGiao());
            assertEquals(lucKy, dto.getThoiDiemTra(), "giao luôn: hàng rời kho lúc tài xế ký nhận");
            assertEquals("Lê Kho", dto.getNguoiGhiTra());
            assertEquals("Nguyễn Văn Hùng", dto.getNguoiGiao());
            assertEquals("DA_KY", dto.getKyBienBan());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, dto.getTrangThaiHang());
            assertFalse(dto.getDuLieuCu());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, dto.getTrangThaiHienThi());
            assertTrue(dto.getChoNccChonCachBu());
            assertFalse(dto.getChoNccChonHangLoi(), "hàng đã theo tài xế về: không hỏi hàng lỗi");
            assertEquals(List.of(), dto.getHangLoiMo());
        }

        @Test
        @DisplayName("Giữ ở kho: đại diện NCC đã ký nhưng chưa ai nhận hàng lỗi, chưa có cách giao cho tới khi kho ghi giao trả; chưa gửi email thì chưa có hạn")
        void giuKho() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            BienBanTraHangDto dto = xem(bb);
            assertEquals(BienBanTraHangNcc.GIU_KHO, dto.getCachXuLyHang());
            assertNull(dto.getNguoiNhanHang(), "người ký biên bản không nhận hàng lỗi khi giữ kho");
            assertNull(dto.getBienSoXe());
            assertEquals(DAI_DIEN, dto.getNguoiGiao());
            assertEquals(BienBanTraHangNcc.BEN_KY_NCC, dto.getBenKy());
            assertEquals("DA_KY", dto.getKyBienBan());
            assertEquals("Lê Kho", dto.getNguoiGhiKy());
            assertNull(dto.getCachGiao());
            assertNull(dto.getThoiDiemTra());
            assertFalse(dto.getDuLieuCu());
            assertNull(dto.getEmailGuiLuc());
            assertNull(dto.getHanTraLoi());
            assertFalse(dto.getDaNhacHan());
            assertTrue(dto.getChoNccChonCachBu());
            assertTrue(dto.getChoNccChonHangLoi());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), dto.getCachBuMo());
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), dto.getHangLoiMo());
            assertNull(dto.getHangLoiNcc());
        }

        @Test
        @DisplayName("Dữ liệu cũ: dòng nhật ký lập ghi bên ký KHONG_AI (bỏ từ 23/11) đọc lại không lỗi, không có bước ký, không chờ ký; NCC vẫn trả lời được; ghi ký 409")
        void lapCuKhongAiKy() {
            NhatKyTraHangGia.dangNhap(61);
            gia.nhatKy.ghiLap(bb, BienBanTraHangNcc.GIU_KHO, new NhatKyTraHangNcc.NguoiKy("KHONG_AI", null, null, null), false);
            NhatKyTraHangGia.dangNhap(7);
            assertEquals("KHONG_AI", gia.moi(gia.theo(200, IHanhDong.lap_bien_ban_tra_hang).get(0)).get("benKy"));

            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(200);
            assertNotNull(nk.lap());
            assertFalse(nk.lap().nguoiKy().canKy());
            assertNull(nk.kyBienBan(), "bên ký lạ: như biên bản lập trước khi có bước ký");
            assertFalse(nk.choKy());

            BienBanTraHangDto dto = xem(bb);
            assertNull(dto.getKyBienBan());
            assertEquals("KHONG_AI", dto.getBenKy());
            assertNull(dto.getNguoiGiao());
            assertNull(dto.getThoiDiemKy());
            assertFalse(dto.getDuLieuCu(), "đã có nhật ký lập");
            assertNotEquals(BienBanTraHangServiceImpl.TT_CHO_KY, dto.getTrangThaiHienThi());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_CHOT, dto.getTrangThaiHienThi());
            assertTrue(dto.getChoNccChonCachBu(), "biên bản cũ đã gửi nhà cung cấp: vẫn chờ trả lời");
            assertFalse(service.choNguoiGiaoKy(bb));

            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiKy(200)).getMessage().contains("không còn chờ"));
            assertTrue(gia.theo(200, IHanhDong.ky_bien_ban_tra_hang).isEmpty());
            verifyNoInteractions(email);
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, traLoi(200, "DOI_HANG", "NHAN_LAI").getPhuongAn());
        }

        @Test
        @DisplayName("Danh sách: không tính lựa chọn còn mở (chỉ màn chi tiết), vẫn có cờ chờ NCC và hạn")
        void danhSachKhongCoLuaChonMo() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, Instant.parse("2026-11-10T03:00:00Z"));
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            List<BienBanTraHangDto> ds = service.danhSach(null, null, null, null).getItems();
            assertEquals(1, ds.size());
            assertNull(ds.get(0).getCachBuMo());
            assertNull(ds.get(0).getHangLoiMo());
            assertFalse(ds.get(0).getChoNccChonCachBu());
            assertTrue(ds.get(0).getChoNccChonHangLoi());
            assertEquals(Instant.parse("2026-11-17T16:59:59Z"), ds.get(0).getHanTraLoi());
            verify(ctPhieuRepo, never()).datNhapSau(any(), any(), any());
            assertEquals(1, service.danhSach(null, null, BienBanTraHangServiceImpl.TT_CHO_CHOT, null).getItems().size());
            assertTrue(service.danhSach(null, null, BienBanTraHangServiceImpl.TT_CHO_TIEU_HUY, null).getItems().isEmpty());
        }

        @Test
        @DisplayName("Không có nhật ký (biên bản lập trước khi có nhật ký): duLieuCu, suy cách xử lý từ mã cũ")
        void duLieuCu() {
            BienBanTraHangDto dto = xem(bb);
            assertTrue(dto.getDuLieuCu());
            assertEquals(BienBanTraHangNcc.GIU_KHO, dto.getCachXuLyHang());
            assertNull(dto.getNguonChot());
            assertNull(dto.getEmailGuiLuc());

            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_CU_TRA_TAI_XE);
            dto = xem(bb);
            assertTrue(dto.getDuLieuCu());
            assertEquals(BienBanTraHangNcc.TRA_NGAY, dto.getCachXuLyHang());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, dto.getTrangThaiHang());
            assertEquals(BienBanTraHangNcc.GIAO_TAI_XE, dto.getCachGiao());
            assertNull(dto.getNguoiNhanHang(), "dữ liệu cũ không có tên tài xế");
            assertNull(dto.getKyBienBan(), "biên bản cũ không có bước ký");
            assertNull(dto.getBienSoXe());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, dto.getPhuongAn());
            assertEquals(NhatKyTraHangNcc.NGUON_DU_LIEU_CU, dto.getNguonChot());
            assertEquals(3, dto.getSoLuongTruTien(), "trừ tiền cũ không nhật ký: toàn bộ số lỗi");
            soBang("250000", dto.getTienTruTien(), "tiền trừ cũ");
            assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, dto.getTrangThaiHienThi());
        }

        @Test
        @DisplayName("Nguồn cách bù: CONG_NCC / DONG_DON / TU_DONG từ nhật ký; DU_LIEU_CU khi đã nhập kho mà không có nhật ký; chờ chọn / phiếu Nháp không nhật ký: null")
        void nguonChot() {
            // Nhà cung cấp chọn trên cổng sau nhập kho
            traLoi(200, "DOI_HANG", "NHAN_LAI");
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, xem(bb).getNguonChot());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, service.chiTietChoCong(200, Set.of(5)).getNguonChot());

            // Đóng đơn
            BienBanTraHangNcc dong = bienBan(209, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(dong));
            service.chuyenTruTienKhiDongDon(don, nguoiChot, "Đóng");
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, xem(dong).getNguonChot());

            // Quá hạn tự chuyển
            BienBanTraHangNcc quaHan = bienBan(208, phieuKhac(8, 0), BienBanTraHangNcc.PA_TRU_CONG_NO);
            gia.nhatKy.ghiTraLoi(quaHan, NhatKyTraHangNcc.TraLoi.ghi("TRU_CONG_NO", "CHO_CHOT", null,
                    NhatKyTraHangNcc.NGUON_TU_DONG, null, Map.of(), BigDecimal.ZERO, null));
            BienBanTraHangDto dtoQuaHan = xem(quaHan);
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, dtoQuaHan.getNguonChot());
            assertNull(dtoQuaHan.getNguoiChot(), "hệ thống, không có người");

            // Dữ liệu cũ: giao bù không nhật ký → nguồn cũ, không có số trừ
            BienBanTraHangNcc cu = bienBan(210, phieu, BienBanTraHangNcc.PA_DOI_HANG);
            BienBanTraHangDto dtoCu = xem(cu);
            assertEquals(NhatKyTraHangNcc.NGUON_DU_LIEU_CU, dtoCu.getNguonChot());
            assertEquals(0, dtoCu.getSoLuongTruTien());
            assertNull(dtoCu.getNguoiXacNhanNcc());

            // Chờ chọn; phiếu Nháp đã có phương án mà không nhật ký: không có nguồn
            assertNull(xem(bienBan(211, phieu, BienBanTraHangNcc.PA_CHO_CHOT)).getNguonChot());
            assertNull(xem(bienBan(212, phieuKhac(8, 0), BienBanTraHangNcc.PA_DOI_HANG)).getNguonChot());
        }
    }

    // ═══════════════════════ Lập biên bản: trả ngay, email, lập lại, hủy ═══════════════════════

    @Nested
    @DisplayName("Lập biên bản (phatHanh): trả ngay cho tài xế, email E7 kèm hạn, lập lại, hủy + M6")
    class PhatHanh {

        private PhieuNhapKho nhap;
        private ChiTietPhieuNhapKho duKien;
        /** Biên bản vừa lưu (saveAndFlush). */
        private BienBanTraHangNcc daLuu;
        private LoHang lo;
        /** Dòng biên bản vừa lưu (saveAll), đọc lại khi lập lại. */
        private final List<ChiTietTraHangNcc> dongDaLuu = new ArrayList<>();
        /** Id cấp cho dòng biên bản lúc lưu (như cơ sở dữ liệu: lập lại đổi hàng lỗi thì dòng mới, id mới). */
        private int idDongMoi = 501;

        @BeforeEach
        void phieuNhap() {
            nhap = PhieuNhapKho.builder().id(2).soPhieuNhap("PN202611221").kho(phieu.getKho()).nhaCungCap(ncc)
                    .donMuaHang(don).trangThai(0).build();
            duKien = ChiTietPhieuNhapKho.builder().id(900).phieuNhapKho(nhap).bienTheSanPham(btA)
                    .soLuongNhap(new BigDecimal("10")).build();
            nhap.setChiTietPhieuNhapKhos(new ArrayList<>(List.of(duKien)));
            lo = LoHang.builder().id(70).maLo("LO-1").bienTheSanPham(btA).soLuongNhap(8).soLuongLoi(2).build();
            when(ctPhieuRepo.findAllByPhieuNhapKhoIdAndCoLo(2)).thenReturn(List.of(ChiTietPhieuNhapKho.builder().id(901)
                    .phieuNhapKho(nhap).bienTheSanPham(btA).loHang(lo).soLuongNhap(new BigDecimal("8")).build()));
            loiTheoPhieu.put(2, Map.of(10, 2));
            when(ctLoiRepo.findByLoHangIds(anyCollection())).thenReturn(List.of());
            when(phieuNhapRepo.khoaTheoId(2)).thenReturn(Optional.of(nhap));
            when(bienBanRepo.findByPhieuNhapKho_Id(2)).thenReturn(Optional.empty());
            when(bienBanRepo.findMaBienBanTheoTienTo(anyString())).thenReturn(List.of());
            when(bienBanRepo.saveAndFlush(any(BienBanTraHangNcc.class))).thenAnswer(inv -> {
                BienBanTraHangNcc b = inv.getArgument(0);
                if (b.getId() == null) b.setId(210);
                daLuu = b;
                return b;
            });
            when(bienBanRepo.findById(210)).thenAnswer(inv -> Optional.ofNullable(daLuu));
            when(bienBanRepo.khoaTheoId(210)).thenAnswer(inv -> Optional.ofNullable(daLuu));
            when(chiTietTraHangRepo.saveAll(any())).thenAnswer(inv -> {
                dongDaLuu.clear();
                inv.<List<ChiTietTraHangNcc>>getArgument(0).forEach(dongDaLuu::add);
                for (ChiTietTraHangNcc d : dongDaLuu) if (d.getId() == null) d.setId(idDongMoi++);
                dongBienBan.put(210, new ArrayList<>(dongDaLuu));
                return dongDaLuu;
            });
            when(chiTietTraHangRepo.findByBienBanTraHangNcc_Id(210)).thenAnswer(inv -> new ArrayList<>(dongDaLuu));
        }

        /** Kho kiểm lại: lô lỗi thêm 1 cái (hàng lỗi đổi so với biên bản đang có). */
        private void doiSoLoi() {
            lo.setSoLuongLoi(3);
            lo.setSoLuongNhap(7);
        }

        /** Lần sau phiếu đã có biên bản vừa lập (lập lại / hủy). */
        private void daCoBienBan() {
            when(bienBanRepo.findByPhieuNhapKho_Id(2)).thenAnswer(inv -> Optional.ofNullable(daLuu));
        }

        private PhatHanhBienBanRequest.PhatHanhBienBanRequestBuilder traNgay() {
            return PhatHanhBienBanRequest.builder().cachXuLy("TRA_NGAY").nguoiNhanHang("  Phạm  Văn Hùng ").bienSoXe("51C-123.45");
        }

        /** Giữ ở kho, tài xế có mặt ký biên bản: chờ ghi kết quả ký rồi mới gửi. */
        private PhatHanhBienBanRequest.PhatHanhBienBanRequestBuilder giuKhoTaiXe() {
            return PhatHanhBienBanRequest.builder().cachXuLy("GIU_KHO").nguoiNhanHang("Lê Văn Tài").bienSoXe("29C-123.45");
        }

        /** Kho (Trần Mua) ghi tài xế đã ký biên bản 210. */
        private BienBanTraHangDto ky() {
            return service.ghiKy(210);
        }

        /**
         * Giữ ở kho, tài xế ký biên bản rồi kho ghi đã ký: email E7 đi lúc ghi ký (lập không bao giờ gửi). Trả DTO sau khi
         * ghi ký.
         */
        private BienBanTraHangDto lapGiuKhoDaKy() {
            assertEquals("CHO_KY", service.phatHanh(2, giuKhoTaiXe().build(), 7).getKyBienBan());
            return ky();
        }

        /** Hạn của lần gửi đầu khi chưa gửi được email nào: tính từ hôm nay. */
        private Instant hanHomNay() {
            return BienBanTraHangServiceImpl.hanTraLoi(Instant.now());
        }

        @Test
        @DisplayName("Giao luôn: lập xong hàng vẫn ở kho, chờ tài xế ký, chưa gửi; tài xế ký nhận thì hàng rời kho (lúc ký, người ghi), chờ NCC chọn cách bù, E7 có mô tả tài xế + hạn")
        void traNgayThanhCong() {
            BienBanTraHangDto dto = service.phatHanh(2, traNgay().build(), 7);

            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, daLuu.getTrangThai(), "tài xế chưa ký nhận: hàng còn ở kho");
            assertEquals(BienBanTraHangNcc.TRA_NGAY, dto.getCachXuLyHang());
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, dto.getTrangThaiHang());
            assertEquals("CHO_KY", dto.getKyBienBan());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_KY, dto.getTrangThaiHienThi());
            assertEquals("Phạm Văn Hùng", dto.getNguoiGiao());
            assertEquals("51C-123.45", dto.getBienSoXe());
            assertNull(dto.getNguoiNhanHang(), "chưa ai nhận hàng lỗi");
            assertNull(dto.getCachGiao());
            assertNull(dto.getThoiDiemTra());
            assertFalse(dto.getChoNccChonCachBu(), "chưa gửi nhà cung cấp");
            assertFalse(dto.getChoNccChonHangLoi());
            daCoBienBan();
            assertNull(service.bienBanTraNgayCuaPhieu(2), "hàng chưa rời kho: phiếu chưa bị khóa");
            Map<String, Object> m = gia.moi(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).get(0));
            assertEquals("TRA_NGAY", m.get("cachXuLy"));
            assertEquals("Phạm Văn Hùng", m.get("nguoiNhan"));
            assertEquals("51C-123.45", m.get("bienSoXe"));
            assertEquals("DAI_DIEN_NCC", m.get("benKy"));
            verifyNoInteractions(email);

            BienBanTraHangDto daKy = ky();
            assertEquals(BienBanTraHangNcc.DA_TRA_HANG, daLuu.getTrangThai());
            verify(bienBanRepo).save(daLuu);
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, daKy.getTrangThaiHang());
            assertEquals(BienBanTraHangNcc.GIAO_TAI_XE, daKy.getCachGiao());
            assertEquals("Phạm Văn Hùng", daKy.getNguoiNhanHang());
            assertEquals("DA_KY", daKy.getKyBienBan());
            LichSuThayDoi dongKy = gia.theo(210, IHanhDong.ky_bien_ban_tra_hang).get(0);
            assertEquals(dongKy.getNgayThucHien(), daKy.getThoiDiemTra());
            assertEquals(dongKy.getNgayThucHien(), daKy.getThoiDiemKy());
            assertEquals("Trần Mua", daKy.getNguoiGhiTra());
            assertEquals("Trần Mua", daKy.getNguoiGhiKy());
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, daKy.getPhuongAn());
            assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, daKy.getTrangThaiHienThi());
            assertTrue(daKy.getChoNccChonCachBu());
            assertFalse(daKy.getChoNccChonHangLoi(), "hàng đã giao tài xế: không hỏi hàng lỗi");
            assertSame(daLuu, service.bienBanTraNgayCuaPhieu(2), "hàng đã rời kho: phiếu khóa sửa lô / hủy");
            verifyNoInteractions(thongBao);
            ArgumentCaptor<BienBanTraHangDto> ban = ArgumentCaptor.forClass(BienBanTraHangDto.class);
            ArgumentCaptor<Instant> han = ArgumentCaptor.forClass(Instant.class);
            verify(email).guiBienBanTraHang(same(daLuu), ban.capture(), eq(NhatKyTraHangNcc.EMAIL_GUI), han.capture(),
                    eq("Người giao hàng Phạm Văn Hùng · biển số 51C-123.45"), any(), any());
            assertEquals("DA_KY", ban.getValue().getKyBienBan(), "PDF dựng sau khi ghi ký");
            assertEquals(2, ban.getValue().getTongSoLuongLoi());
            assertTrue(Math.abs(Duration.between(hanHomNay(), han.getValue()).toDays()) <= 1,
                    "chưa gửi email nào: hạn tính từ hôm nay " + han.getValue());
        }

        @Test
        @DisplayName("Lập trả ngay rồi kiểm đếm không còn đủ (lô đạt bị xóa) mà ghi đã ký: 409, hàng chưa rời kho, chưa gửi")
        void kyKhiKiemDemKhongConDu() {
            service.phatHanh(2, traNgay().build(), 7);
            duKien.setSoLuongNhap(new BigDecimal("12"));
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiKy(210)).getMessage().contains("Kiểm đếm xong"));
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, daLuu.getTrangThai());
            assertTrue(gia.theo(210, IHanhDong.ky_bien_ban_tra_hang).isEmpty());
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Chưa kiểm đếm xong (đạt + lỗi < cần nhập, chưa bấm hoàn tất): 409, không lưu")
        void chuaKiemXong() {
            duKien.setSoLuongNhap(new BigDecimal("12"));
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.phatHanh(2, traNgay().build(), 7))
                    .getMessage().contains("Kiểm đếm xong"));
            verify(bienBanRepo, never()).saveAndFlush(any());

            // Bấm hoàn tất kiểm đếm (nhận thiếu) thì được
            duKien.setTrangThaiKiemDem("DA_HOAN_TAT");
            assertDoesNotThrow(() -> service.phatHanh(2, traNgay().build(), 7));
        }

        @Test
        @DisplayName("Người ký bắt buộc cả khi giữ kho (thiếu / quá dài / biển số sai: 400); bên ký lạ 400; giữ kho có tài xế: chờ ký, chưa gửi")
        void kiemNguoiNhan() {
            loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang("  ").build(), 7));
            loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang("x".repeat(101)).build(), 7));
            loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().bienSoXe("x".repeat(21)).build(), 7));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, PhatHanhBienBanRequest.builder()
                    .cachXuLy("GIU_KHO").build(), 7)).getMessage().contains("Nhập họ tên người giao hàng"), "giữ kho vẫn phải có tài xế ký");
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().benKy("TAI_XE").build(), 7))
                    .getMessage().contains("Chọn ai ký"), "bên ký lạ");
            verify(bienBanRepo, never()).saveAndFlush(any());

            // Giữ kho có tài xế: ghi tài xế, biển số; chưa ai nhận hàng lỗi; chưa gửi
            BienBanTraHangDto dto = service.phatHanh(2, giuKhoTaiXe().build(), 7);
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, dto.getTrangThaiHang());
            assertNull(dto.getNguoiNhanHang());
            assertEquals("Lê Văn Tài", dto.getNguoiGiao());
            assertEquals("29C-123.45", dto.getBienSoXe());
            assertEquals("CHO_KY", dto.getKyBienBan());
            Map<String, Object> m = gia.moi(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).get(0));
            assertEquals("Lê Văn Tài", m.get("nguoiNhan"));
            assertEquals("DAI_DIEN_NCC", m.get("benKy"));
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Bên ký KHONG_AI (không ai ký, đã bỏ): 400 'Chọn ai ký…' cả khi giữ kho lẫn giao luôn, kể cả có gửi tên người ký; không lưu, không ghi nhật ký, không gửi")
        void khongAiKyBiTuChoi() {
            CommonException giu = loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, PhatHanhBienBanRequest.builder()
                    .cachXuLy("GIU_KHO").benKy("KHONG_AI").build(), 7));
            assertEquals("chungTuKho.benKyKhongHopLe", giu.getThongDiep().khoa());
            assertEquals("Chọn ai ký biên bản bên giao hàng.", giu.getMessage());

            CommonException giuCoTen = loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, giuKhoTaiXe().benKy("KHONG_AI")
                    .build(), 7));
            assertEquals("chungTuKho.benKyKhongHopLe", giuCoTen.getThongDiep().khoa());

            CommonException giaoLuon = loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().benKy("KHONG_AI")
                    .build(), 7));
            assertEquals("chungTuKho.benKyKhongHopLe", giaoLuon.getThongDiep().khoa());

            verify(bienBanRepo, never()).saveAndFlush(any());
            verify(chiTietTraHangRepo, never()).saveAll(any());
            assertTrue(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).isEmpty());
            verifyNoInteractions(email);

            // Bỏ trống bên ký: mặc định đại diện nhà cung cấp
            assertEquals(BienBanTraHangNcc.BEN_KY_NCC, service.phatHanh(2, giuKhoTaiXe().benKy("  ").build(), 7).getBenKy());
        }

        @Test
        @DisplayName("Trả ngay mà người ký là bên vận chuyển: 400 'Bên vận chuyển không nhận hàng lỗi thay nhà cung cấp…'; không lưu, không ghi nhật ký, không gửi. Bên vận chuyển giữ ở kho vẫn lập được")
        void traNgayBenVanChuyenBiTuChoi() {
            CommonException ex = loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().benKy("VAN_CHUYEN")
                    .donViVanChuyen("Nhà xe Phương Trang").build(), 7));
            assertEquals("chungTuKho.traNgayKhongChoVanChuyen", ex.getThongDiep().khoa());
            assertEquals("Bên vận chuyển không nhận hàng lỗi thay nhà cung cấp. Chọn giữ ở kho, trả sau.", ex.getMessage());
            verify(bienBanRepo, never()).saveAndFlush(any());
            verify(chiTietTraHangRepo, never()).saveAll(any());
            assertTrue(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).isEmpty());
            verifyNoInteractions(email);

            BienBanTraHangDto giu = service.phatHanh(2, giuKhoTaiXe().benKy("VAN_CHUYEN").donViVanChuyen("Nhà xe Phương Trang")
                    .build(), 7);
            assertEquals(BienBanTraHangNcc.BEN_KY_VAN_CHUYEN, giu.getBenKy());
            assertEquals(BienBanTraHangNcc.GIU_KHO, giu.getCachXuLyHang());
        }

        @Test
        @DisplayName("Tên tài xế theo luật họ tên: có số / ký hiệu / 1 ký tự thì 400 kèm câu đúng; tên có dấu nháy, gạch được nhận")
        void kiemTenNguoiKy() {
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang("Tài xế 01").build(), 7))
                    .getMessage().contains("chỉ gồm chữ cái"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang("Hùng@GHN").build(), 7))
                    .getMessage().contains("chỉ gồm chữ cái"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang(" H ").build(), 7))
                    .getMessage().contains("ít nhất 2"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang("​ ").build(), 7))
                    .getMessage().contains("Nhập họ tên người giao hàng"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().nguoiNhanHang(null).build(), 7))
                    .getMessage().contains("Nhập họ tên người giao hàng"));
            verify(bienBanRepo, never()).saveAndFlush(any());

            BienBanTraHangDto dto = service.phatHanh(2, traNgay().nguoiNhanHang("Nguyễn Văn  O'Neil-Hùng").build(), 7);
            assertEquals("Nguyễn Văn O'Neil-Hùng", dto.getNguoiGiao());
        }

        @Test
        @DisplayName("Biển số tài xế: không bắt buộc; sai mẫu / mã tỉnh sai thì 400 'Biển số xe: …'; đúng thì lưu cách viết chuẩn")
        void kiemBienSo() {
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().bienSoXe("ABC").build(), 7))
                    .getMessage().startsWith("Biển số xe:"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().bienSoXe("13A-123.45").build(), 7))
                    .getMessage().contains("13"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().bienSoXe("30A-000.00").build(), 7))
                    .getMessage().startsWith("Biển số xe:"));
            verify(bienBanRepo, never()).saveAndFlush(any());

            assertEquals("51C-123.45", service.phatHanh(2, traNgay().bienSoXe(" 51c 12345 ").build(), 7).getBienSoXe());
            assertEquals("29-AB 123.45", service.phatHanh(2, traNgay().bienSoXe("29-ab12345").build(), 7).getBienSoXe());
            assertNull(service.phatHanh(2, traNgay().bienSoXe("   ").build(), 7).getBienSoXe());
            assertNull(service.phatHanh(2, traNgay().bienSoXe(null).build(), 7).getBienSoXe());
        }

        @Test
        @DisplayName("Ghi chú gửi nhà cung cấp tối đa 255 ký tự (đếm theo ký tự, sau khi cắt hai đầu); giữ kho cũng kiểm")
        void kiemGhiChuPhatHanh() {
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, traNgay().ghiChu("a".repeat(256)).build(), 7))
                    .getMessage().contains("255"));
            loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, giuKhoTaiXe().ghiChu("ư".repeat(256)).build(), 7));
            verify(bienBanRepo, never()).saveAndFlush(any());

            assertDoesNotThrow(() -> service.phatHanh(2, giuKhoTaiXe().ghiChu("  " + "ư".repeat(255) + "  ").build(), 7));
        }

        @Test
        @DisplayName("Đã trả ngay: lập lại (kể cả đổi sang giữ kho) hay hủy do hết hàng lỗi đều 409; phiếu bị khóa sửa lô / hủy")
        void daTraNgayKhongLapLai() {
            BienBanTraHangNcc daTra = bienBan(210, nhap, BienBanTraHangNcc.PA_CHO_CHOT);
            daTra.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            when(bienBanRepo.findByPhieuNhapKho_Id(2)).thenReturn(Optional.of(daTra));

            assertTrue(loi(HttpStatus.CONFLICT, () -> service.phatHanh(2, PhatHanhBienBanRequest.builder().build(), 7))
                    .getMessage().contains("đã trả cho người giao hàng"));
            loi(HttpStatus.CONFLICT, () -> service.phatHanh(2, traNgay().build(), 7));
            when(ctPhieuRepo.findAllByPhieuNhapKhoIdAndCoLo(2)).thenReturn(List.of());
            loi(HttpStatus.CONFLICT, () -> service.phatHanh(2, PhatHanhBienBanRequest.builder().build(), 7));
            assertEquals(BienBanTraHangNcc.DA_TRA_HANG, daTra.getTrangThai(), "không bị hủy");
            verify(bienBanRepo, never()).saveAndFlush(any());
            verify(bienBanRepo, never()).save(any());
            verifyNoInteractions(email);

            // Phiếu nhập dùng để chặn sửa lô / hủy phiếu
            assertSame(daTra, service.bienBanTraNgayCuaPhieu(2));
            daTra.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            assertNull(service.bienBanTraNgayCuaPhieu(2));
            daTra.setPhuongAnXuLy(BienBanTraHangNcc.PA_CU_TRA_TAI_XE);
            assertSame(daTra, service.bienBanTraNgayCuaPhieu(2), "mã cũ trả tài xế cũng là hàng đã rời kho");
            daTra.setTrangThai(BienBanTraHangNcc.DA_HUY);
            assertNull(service.bienBanTraNgayCuaPhieu(2));
        }

        @Test
        @DisplayName("Email E7 đi lúc ghi ký: lần đầu GUI, lập lại CAP_NHAT; thư lần cũ bị bỏ; gửi được mới ghi nhật ký, hiện lúc gửi và hạn trả lời; lập lại tính hạn lại từ lần gửi mới")
        void emailLapVaLapLai() {
            ArgumentCaptor<BooleanSupplier> conHieuLuc = ArgumentCaptor.forClass(BooleanSupplier.class);
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);

            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            verifyNoInteractions(email);
            ky();
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), isNull(),
                    conHieuLuc.capture(), khiGuiDuoc.capture());
            BooleanSupplier hieuLuc1 = conHieuLuc.getValue();
            Runnable gui1 = khiGuiDuoc.getValue();
            assertTrue(hieuLuc1.getAsBoolean());
            assertNull(service.chiTiet(210).getEmailGuiLuc(), "chưa gửi được thì chưa hiện");
            assertNull(service.chiTiet(210).getHanTraLoi(), "chưa gửi được thì chưa có hạn");
            gui1.run();
            List<LichSuThayDoi> guiNk = gia.theo(210, IHanhDong.gui_email_bien_ban_tra_hang);
            assertEquals(1, guiNk.size());
            assertEquals(NhatKyTraHangNcc.EMAIL_GUI, gia.moi(guiNk.get(0)).get("loai"));
            assertEquals("ncc05@viettien.vn", gia.moi(guiNk.get(0)).get("email"));
            assertEquals(INguonNhatKy.he_thong, guiNk.get(0).getNguon());
            assertNotNull(service.chiTiet(210).getEmailGuiLuc());
            assertEquals(BienBanTraHangServiceImpl.hanTraLoi(guiNk.get(0).getNgayThucHien()), service.chiTiet(210).getHanTraLoi());

            // Lập lại có đổi hàng lỗi: email báo cập nhật; thư của lần lập trước (nếu còn đang thử lại) bị bỏ
            daCoBienBan();
            doiSoLoi();
            clearInvocations(email);
            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            assertFalse(hieuLuc1.getAsBoolean(), "không còn là lần lập cuối");
            verifyNoInteractions(email);
            ky();
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_CAP_NHAT), any(), isNull(),
                    conHieuLuc.capture(), khiGuiDuoc.capture());
            assertTrue(conHieuLuc.getValue().getAsBoolean());
            assertNull(service.chiTiet(210).getEmailGuiLuc(), "lập lại: chưa gửi bản mới");
            assertNull(service.chiTiet(210).getHanTraLoi(), "lập lại: hạn tính lại từ lần gửi bản mới");
            khiGuiDuoc.getValue().run();
            assertEquals(NhatKyTraHangNcc.EMAIL_CAP_NHAT,
                    gia.moi(gia.theo(210, IHanhDong.gui_email_bien_ban_tra_hang).get(1)).get("loai"));
            assertNotNull(service.chiTiet(210).getEmailGuiLuc());
            assertNotNull(service.chiTiet(210).getHanTraLoi());

            // Biên bản bị hủy trước khi thư đi: không gửi nữa
            daLuu.setTrangThai(BienBanTraHangNcc.DA_HUY);
            assertFalse(conHieuLuc.getValue().getAsBoolean());
        }

        @Test
        @DisplayName("Lập lại có đổi hàng lỗi xóa câu trả lời của nhà cung cấp (cả cách bù lẫn hàng lỗi): về chờ chọn, nhật ký cũ không còn hiện (vẫn giữ trong lịch sử)")
        void lapLaiXoaCauTraLoi() {
            lapGiuKhoDaKy();
            BienBanTraHangDto chon = service.traLoiTuCong(210, Set.of(5), phienBan(210), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan",
                    "giao bù tuần sau");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, chon.getPhuongAn());
            assertEquals("Nguyễn Lan", chon.getNguoiXacNhanNcc());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, chon.getHangLoiNcc());

            daCoBienBan();
            doiSoLoi();
            assertEquals("CHO_KY", service.phatHanh(2, giuKhoTaiXe().build(), 7).getKyBienBan(), "tờ mới: ký lại");
            BienBanTraHangDto lapLai = ky();

            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, daLuu.getPhuongAnXuLy());
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, lapLai.getPhuongAn());
            assertNull(lapLai.getNguonChot());
            assertNull(lapLai.getNguoiXacNhanNcc());
            assertNull(lapLai.getGhiChuChot());
            assertNull(lapLai.getHangLoiNcc(), "lựa chọn hàng lỗi cũng bị xóa");
            assertTrue(lapLai.getChoNccChonCachBu());
            assertTrue(lapLai.getChoNccChonHangLoi());
            assertNull(gia.nhatKy.doc(210).cachBu(), "lần lập cuối chưa có câu trả lời");
            assertNull(gia.nhatKy.doc(210).luaChonHangLoi());
            assertEquals(1, gia.theo(210, IHanhDong.chot_tra_hang_ncc).size(), "dòng trả lời cũ vẫn ở lịch sử");

            // Nhà cung cấp trả lời lại cho bản mới: phải trả lời đủ, phương án cũ là chờ chọn
            loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> service.traLoiTuCong(210, Set.of(5), phienBan(210), "TRU_CONG_NO", null, "Nguyễn Lan", null));
            service.traLoiTuCong(210, Set.of(5), phienBan(210), "TRU_CONG_NO", "TIEU_HUY", "Nguyễn Lan", null);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, gia.nhatKy.doc(210).cachBu().phuongAnCu());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, service.chiTiet(210).getPhuongAn());
        }

        @Test
        @DisplayName("Hủy theo phiếu nhập: báo mua hàng, ghi nhật ký; M6 chỉ khi nhà cung cấp đã nhận E7 của lần lập hiện tại")
        void huyVaM6() {
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            lapGiuKhoDaKy(); // E7 chưa gửi được
            daCoBienBan();

            service.huyTheoPhieuNhap(nhap, 7);
            assertEquals(BienBanTraHangNcc.DA_HUY, daLuu.getTrangThai());
            verify(thongBao).bienBanDaHuy(daLuu, nhap, true, 7);
            verify(email, never()).guiBienBanDaHuy(any());
            assertEquals("Hủy phiếu nhập PN202611221", gia.theo(210, IHanhDong.huy_bien_ban_tra_hang).get(0).getGhiChu());
            assertNull(service.layTheoPhieuNhap(2), "đã hủy thì không còn hiện theo phiếu");

            // Lập lại (giữ số cũ, coi như lập mới) rồi gửi được E7, sau đó hủy: có M6
            clearInvocations(email);
            lapGiuKhoDaKy();
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), isNull(), any(),
                    khiGuiDuoc.capture());
            khiGuiDuoc.getValue().run();
            service.huyTheoPhieuNhap(nhap, 7);
            verify(email).guiBienBanDaHuy(daLuu);

            // Đã hủy rồi: hủy phiếu lần nữa không làm gì
            clearInvocations(email, thongBao);
            service.huyTheoPhieuNhap(nhap, 7);
            verifyNoInteractions(email, thongBao);
        }

        @Test
        @DisplayName("Phiếu hết hàng lỗi sau khi đã gửi E7: lập lại thành hủy biên bản và gửi M6")
        void hetHangLoiSauKhiGuiE7() {
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            lapGiuKhoDaKy();
            verify(email).guiBienBanTraHang(any(), any(), any(), any(), any(), any(), khiGuiDuoc.capture());
            khiGuiDuoc.getValue().run();
            daCoBienBan();
            when(ctPhieuRepo.findAllByPhieuNhapKhoIdAndCoLo(2)).thenReturn(List.of());

            assertNull(service.phatHanh(2, giuKhoTaiXe().build(), 7));
            assertEquals(BienBanTraHangNcc.DA_HUY, daLuu.getTrangThai());
            verify(email).guiBienBanDaHuy(daLuu);
            verify(thongBao).bienBanDaHuy(daLuu, nhap, false, 7);
            assertEquals("Phiếu nhập không còn hàng lỗi", gia.theo(210, IHanhDong.huy_bien_ban_tra_hang).get(0).getGhiChu());
        }

        @Test
        @DisplayName("Lập lại mà hàng lỗi không đổi (chỉ sửa ghi chú): giữ câu trả lời của NCC, không ghi lần lập mới, không gửi email")
        void lapLaiKhongDoiHang() {
            lapGiuKhoDaKy();
            Integer lap1 = gia.nhatKy.idLapCuoi(210);
            service.traLoiTuCong(210, Set.of(5), lap1, "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null);
            daCoBienBan();
            clearInvocations(email);

            BienBanTraHangDto dto = service.phatHanh(2, giuKhoTaiXe().ghiChu(" Kèm ảnh chụp ").build(), 7);

            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, daLuu.getPhuongAnXuLy());
            assertEquals("Kèm ảnh chụp", daLuu.getGhiChu());
            assertEquals("Kèm ảnh chụp", dto.getGhiChu());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, dto.getNguonChot());
            assertEquals("Nguyễn Lan", dto.getNguoiXacNhanNcc());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, dto.getHangLoiNcc(), "giữ cả lựa chọn hàng lỗi");
            assertEquals("DA_KY", dto.getKyBienBan(), "cùng người ký: giữ kết quả ký");
            assertEquals(1, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size(), "không ghi lần lập mới");
            assertEquals(lap1, gia.nhatKy.idLapCuoi(210), "phiên bản NCC đang xem vẫn đúng");
            verifyNoInteractions(email);
            assertEquals(1, dongDaLuu.size());
            assertEquals(2, dongDaLuu.get(0).getSoLuongLoi(), "dòng biên bản lập lại vẫn đủ số lỗi");
            // Giữ đúng các dòng cũ (lựa chọn của nhà cung cấp gắn theo id dòng): không xóa, không lưu lại dòng
            verify(chiTietTraHangRepo, times(1)).saveAll(any());
            verify(chiTietTraHangRepo, never()).deleteAll(any());
            assertEquals(501, dongDaLuu.get(0).getId());
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, muc(dto, 501).getCachBu());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, muc(dto, 501).getHangLoiNcc());
        }

        @Test
        @DisplayName("Hàng lỗi không đổi nhưng biên bản chưa có nhật ký lập, hoặc chuyển sang trả ngay: vẫn lập lại như mới, về chờ chọn; nhà cung cấp chưa nhận bản nào thì thư là lập mới; trả ngay thì chờ tài xế ký mới gửi")
        void lapLaiKhongDoiHangNhungChuaCoNhatKy() {
            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            gia.dong.clear(); // biên bản lập trước khi có nhật ký
            daLuu.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            daCoBienBan();
            clearInvocations(email);

            BienBanTraHangDto lapMoi = service.phatHanh(2, giuKhoTaiXe().build(), 7);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, daLuu.getPhuongAnXuLy());
            assertEquals(1, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            assertEquals("CHO_KY", lapMoi.getKyBienBan());
            verifyNoInteractions(email);
            ky();
            // Chưa có nhật ký gửi email nào: nhà cung cấp chưa nhận bản nào nên là thư lập mới
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), isNull(), any(),
                    khiGuiDuoc.capture());
            khiGuiDuoc.getValue().run();

            // Cùng hàng lỗi nhưng đổi sang trả ngay cho tài xế: là biên bản mới (hàng rời kho)
            daLuu.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            clearInvocations(email);
            BienBanTraHangDto dto = service.phatHanh(2, traNgay().build(), 7);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, dto.getPhuongAn());
            assertEquals(2, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            assertEquals("CHO_KY", dto.getKyBienBan());
            verifyNoInteractions(email);
            ky();
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_CAP_NHAT), any(),
                    eq("Người giao hàng Phạm Văn Hùng · biển số 51C-123.45"), any(), any());
        }

        @Test
        @DisplayName("Phiên bản trên cổng: kho lập lại (đổi số lỗi) lúc NCC đang xem → 409 BIEN_BAN_KHONG_CON_NHAN; đúng lần lập cuối hoặc không gửi phiên bản thì nhận")
        void phienBanCong() {
            BienBanTraHangDto dto1 = lapGiuKhoDaKy();
            Integer lap1 = gia.nhatKy.idLapCuoi(210);
            assertNotNull(dto1.getLapCuoiLuc());
            assertEquals(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).get(0).getNgayThucHien(), dto1.getLapCuoiLuc());

            daCoBienBan();
            doiSoLoi();
            BienBanTraHangDto dto2 = lapGiuKhoDaKy();
            Integer lap2 = gia.nhatKy.idLapCuoi(210);
            assertNotEquals(lap1, lap2);
            assertEquals(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).get(1).getNgayThucHien(), dto2.getLapCuoiLuc());

            LoiCoMaException ex = loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> service.traLoiTuCong(210, Set.of(5), lap1, "TRU_CONG_NO", "NHAN_LAI", "Nguyễn Lan", null));
            assertTrue(ex.getMessage().contains("Tải lại trang"), ex.getMessage());
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, daLuu.getPhuongAnXuLy());
            assertTrue(gia.theo(210, IHanhDong.chot_tra_hang_ncc).isEmpty());
            verify(thongBao, never()).nccDaTraLoi(any(), any(), anyInt(), anyInt(), anyInt(), anyInt(), anyBoolean());

            service.traLoiTuCong(210, Set.of(5), lap2, "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null);
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, daLuu.getPhuongAnXuLy());
            service.traLoiTuCong(210, Set.of(5), phienBan(210), "TRU_CONG_NO", null, "Nguyễn Lan", null);
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, daLuu.getPhuongAnXuLy(), "không gửi phiên bản: không kiểm");
        }

        @Test
        @DisplayName("M6 khi NCC đã từng nhận E7: lập → gửi E7 → lập lại (đổi số lỗi) chưa gửi được → hủy vẫn gửi M6")
        void m6SauLapLaiChuaGui() {
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            lapGiuKhoDaKy();
            verify(email).guiBienBanTraHang(any(), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), any(), any(),
                    khiGuiDuoc.capture());
            khiGuiDuoc.getValue().run();
            daCoBienBan();
            doiSoLoi();
            lapGiuKhoDaKy(); // thư cập nhật chưa gửi được

            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(210);
            assertNull(nk.emailGuiLuc(), "bản mới chưa gửi");
            assertNull(nk.emailDauLuc(), "bản mới chưa có mốc hạn");
            assertTrue(nk.daTungGuiEmail());

            service.huyTheoPhieuNhap(nhap, 7);
            assertEquals(BienBanTraHangNcc.DA_HUY, daLuu.getTrangThai());
            verify(email).guiBienBanDaHuy(daLuu);
        }

        // ─────────────── Tài xế ký biên bản giấy (ghiKy) ───────────────

        @Test
        @DisplayName("Giữ kho có tài xế: chờ ký thì chưa gửi, cổng không thấy, không gửi lại, không trả lời được; ghi đã ký thì gửi E7 và nhà cung cấp mới trả lời")
        void giuKhoChoKyRoiDaKy() {
            BienBanTraHangDto dto = service.phatHanh(2, giuKhoTaiXe().build(), 7);
            dsBienBan.add(daLuu);
            when(bienBanRepo.timTheoNhaCungCap(any())).thenAnswer(inv -> List.of(daLuu));

            assertEquals("CHO_KY", dto.getKyBienBan());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_KY, dto.getTrangThaiHienThi());
            assertFalse(dto.getChoNccChonCachBu());
            assertFalse(dto.getChoNccChonHangLoi());
            assertNull(dto.getHanTraLoi());
            assertTrue(service.choNguoiGiaoKy(daLuu), "phiếu chưa nhập kho được");
            assertEquals(1, service.danhSach(null, null, BienBanTraHangServiceImpl.TT_CHO_KY, null).getItems().size());
            assertTrue(service.dsChoCong(Set.of(5)).isEmpty(), "chưa gửi nhà cung cấp: cổng không thấy");
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY, () -> service.chiTietChoCong(210, Set.of(5)));
            loiCong(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                    () -> service.traLoiTuCong(210, Set.of(5), phienBan(210), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null));
            ((Map<?, ?>) ReflectionTestUtils.getField(BienBanTraHangServiceImpl.class, "GUI_LAI_EMAIL")).clear();
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.guiLaiEmail(210)).getMessage()
                    .contains("chưa ghi người giao hàng đã ký"));
            assertTrue(gia.theo(210, IHanhDong.chot_tra_hang_ncc).isEmpty());
            verifyNoInteractions(email);
            // Việc định kỳ không xét biên bản chưa gửi
            when(bienBanRepo.timDangChoXuLy()).thenReturn(List.of(daLuu));
            assertFalse(service.dsChoNccTraLoi().contains(210));

            BienBanTraHangDto daKy = ky();
            assertEquals("DA_KY", daKy.getKyBienBan());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, daLuu.getTrangThai(), "giữ kho: ký xong hàng vẫn ở kho");
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, daKy.getTrangThaiHang());
            assertNull(daKy.getNguoiNhanHang());
            assertEquals("Trần Mua", daKy.getNguoiGhiKy());
            assertNotNull(daKy.getThoiDiemKy());
            assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, daKy.getTrangThaiHienThi());
            assertTrue(daKy.getChoNccChonCachBu());
            assertTrue(daKy.getChoNccChonHangLoi());
            assertFalse(service.choNguoiGiaoKy(daLuu));
            ArgumentCaptor<BienBanTraHangDto> ban = ArgumentCaptor.forClass(BienBanTraHangDto.class);
            verify(email).guiBienBanTraHang(same(daLuu), ban.capture(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), isNull(),
                    any(), any());
            assertEquals("Lê Văn Tài", ban.getValue().getNguoiGiao());
            assertEquals(1, service.dsChoCong(Set.of(5)).size());
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG,
                    service.traLoiTuCong(210, Set.of(5), phienBan(210), "DOI_HANG", "NHAN_LAI", "Nguyễn Lan", null).getPhuongAn());

            // Ghi ký lần nữa: không còn chờ ký
            assertTrue(loi(HttpStatus.CONFLICT, () -> ky()).getMessage().contains("không còn chờ"));
        }

        @Test
        @DisplayName("Ghi ký: lô đổi sau khi lập 409; biên bản đã hủy hoặc đã ghi ký rồi (không còn chờ ký) 409 — không ghi gì, không gửi thêm")
        void kyKiemDauVao() {
            service.phatHanh(2, giuKhoTaiXe().build(), 7);

            // Kiểm đếm đổi sau khi lập: tờ tài xế ký không còn đúng
            doiSoLoi();
            assertTrue(loi(HttpStatus.CONFLICT, () -> ky()).getMessage().contains("Kiểm đếm đã đổi"));
            assertTrue(gia.theo(210, IHanhDong.ky_bien_ban_tra_hang).isEmpty());
            verifyNoInteractions(email);

            // Lập lại theo số kiểm đếm mới nhưng biên bản bị hủy trước khi ghi ký
            daCoBienBan();
            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            daLuu.setTrangThai(BienBanTraHangNcc.DA_HUY);
            loi(HttpStatus.CONFLICT, () -> ky());
            assertTrue(gia.theo(210, IHanhDong.ky_bien_ban_tra_hang).isEmpty());
            assertFalse(service.choNguoiGiaoKy(daLuu));
            verifyNoInteractions(email);

            // Đã ghi ký rồi: ghi lần nữa thì không còn chờ ký, không gửi thêm thư
            daLuu.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            ky();
            clearInvocations(email);
            assertTrue(loi(HttpStatus.CONFLICT, () -> ky()).getMessage().contains("không còn chờ"));
            assertEquals(1, gia.theo(210, IHanhDong.ky_bien_ban_tra_hang).size());
            assertFalse(service.choNguoiGiaoKy(daLuu));
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Bên vận chuyển ký: thiếu / quá dài đơn vị 400; chờ ký, ghi đã ký thì gửi E7; DTO có bên ký, đơn vị; trả ngay cho bên vận chuyển 400, biên bản cũ giữ nguyên")
        void benVanChuyenKy() {
            PhatHanhBienBanRequest.PhatHanhBienBanRequestBuilder vc = PhatHanhBienBanRequest.builder().cachXuLy("GIU_KHO")
                    .benKy("VAN_CHUYEN").nguoiNhanHang("Lê Văn Tài").bienSoXe("29C-123.45");
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, vc.build(), 7)).getMessage()
                    .contains("Nhập đơn vị vận chuyển"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, vc.donViVanChuyen("   ").build(), 7)).getMessage()
                    .contains("Nhập đơn vị vận chuyển"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, vc.donViVanChuyen("ư".repeat(101)).build(), 7))
                    .getMessage().contains("100"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2, vc.donViVanChuyen("Nhà xe Phương Trang")
                    .nguoiNhanHang(null).build(), 7)).getMessage().contains("Nhập họ tên người giao hàng"));
            verify(bienBanRepo, never()).saveAndFlush(any());

            BienBanTraHangDto dto = service.phatHanh(2, vc.donViVanChuyen("  Nhà xe Phương Trang ").nguoiNhanHang("Lê Văn Tài")
                    .build(), 7);
            assertEquals("CHO_KY", dto.getKyBienBan());
            assertEquals("VAN_CHUYEN", dto.getBenKy());
            assertEquals("Nhà xe Phương Trang", dto.getDonViVanChuyen());
            assertEquals("Lê Văn Tài", dto.getNguoiGiao());
            Map<String, Object> m = gia.moi(gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).get(0));
            assertEquals("VAN_CHUYEN", m.get("benKy"));
            assertEquals("Nhà xe Phương Trang", m.get("donViVanChuyen"));
            verifyNoInteractions(email);

            BienBanTraHangDto daKy = ky();
            assertEquals("DA_KY", daKy.getKyBienBan());
            ArgumentCaptor<BienBanTraHangDto> ban = ArgumentCaptor.forClass(BienBanTraHangDto.class);
            verify(email).guiBienBanTraHang(same(daLuu), ban.capture(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), isNull(),
                    any(), any());
            assertEquals("VAN_CHUYEN", ban.getValue().getBenKy());
            assertTrue(com.dev.backend.services.email.PdfBienBanTraHang.cauKy(ban.getValue(), true)
                    .contains("không đại diện cho Quý công ty"));

            // Lập lại thành trả ngay cho người của bên vận chuyển: 400, biên bản đã ký giữ nguyên, không lập lần mới
            daCoBienBan();
            doiSoLoi();
            assertEquals("chungTuKho.traNgayKhongChoVanChuyen", loi(HttpStatus.BAD_REQUEST, () -> service.phatHanh(2,
                    traNgay().benKy("VAN_CHUYEN").donViVanChuyen("GHN").build(), 7)).getThongDiep().khoa());
            assertEquals(1, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
        }

        @Test
        @DisplayName("Lập lại cùng hàng lỗi nhưng đổi bên ký (đại diện NCC → bên vận chuyển → đổi đơn vị → lại đại diện NCC): mỗi lần là lần lập mới, chờ ký lại, chưa gửi")
        void lapLaiDoiBenKy() {
            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            ky();
            daCoBienBan();
            BienBanTraHangDto vc = service.phatHanh(2, giuKhoTaiXe().benKy("VAN_CHUYEN").donViVanChuyen("GHN").build(), 7);
            assertEquals(2, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            assertEquals("CHO_KY", vc.getKyBienBan(), "tờ mới: ký lại");
            BienBanTraHangDto vcKhacDonVi = service.phatHanh(2, giuKhoTaiXe().benKy("VAN_CHUYEN").donViVanChuyen("GHTK")
                    .build(), 7);
            assertEquals(3, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size(), "đổi đơn vị vận chuyển cũng là tờ mới");
            assertEquals("GHTK", vcKhacDonVi.getDonViVanChuyen());
            clearInvocations(email);
            BienBanTraHangDto veNcc = service.phatHanh(2, giuKhoTaiXe().build(), 7);
            assertEquals(4, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            assertEquals(BienBanTraHangNcc.BEN_KY_NCC, veNcc.getBenKy());
            assertEquals("CHO_KY", veNcc.getKyBienBan(), "tờ mới: ký lại");
            assertNull(veNcc.getDonViVanChuyen());
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Lập lại đã ký: cùng hàng lỗi, tài xế, biển số thì giữ kết quả ký, không gửi; đổi tài xế là tờ mới: chờ ký lại, ký xong gửi thư cập nhật")
        void lapLaiSauKhiKy() {
            service.phatHanh(2, giuKhoTaiXe().build(), 7);
            ky();
            ArgumentCaptor<Runnable> khiGuiDuoc = ArgumentCaptor.forClass(Runnable.class);
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), any(), any(),
                    khiGuiDuoc.capture());
            khiGuiDuoc.getValue().run();
            daCoBienBan();
            clearInvocations(email);

            BienBanTraHangDto giu = service.phatHanh(2, giuKhoTaiXe().ghiChu("Kèm ảnh").build(), 7);
            assertEquals("DA_KY", giu.getKyBienBan());
            assertEquals(1, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            verifyNoInteractions(email);

            BienBanTraHangDto moi = service.phatHanh(2, giuKhoTaiXe().nguoiNhanHang("Trần Văn Bình").build(), 7);
            assertEquals("CHO_KY", moi.getKyBienBan());
            assertEquals("Trần Văn Bình", moi.getNguoiGiao());
            assertEquals(2, gia.theo(210, IHanhDong.lap_bien_ban_tra_hang).size());
            assertNull(moi.getThoiDiemKy(), "kết quả ký của tờ cũ không còn");
            verifyNoInteractions(email);
            ky();
            verify(email).guiBienBanTraHang(same(daLuu), any(), eq(NhatKyTraHangNcc.EMAIL_CAP_NHAT), any(), isNull(), any(), any());
        }
    }

    // ═══════════════════════ Lựa chọn theo từng dòng ═══════════════════════

    @Nested
    @DisplayName("Nhà cung cấp chọn theo TỪNG DÒNG biên bản (dòng 301 áo A × 2, dòng 302 áo B × 1), kho làm theo từng dòng")
    class TheoTungDong {

        @BeforeEach
        void daGuiBienBan() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
        }

        private GiaoTraHangLoiRequest.GiaoTraHangLoiRequestBuilder giao(List<Integer> dongIds) {
            return GiaoTraHangLoiRequest.builder().cachGiao("NCC_LAY").nguoiNhan("Anh Tú")
                    .thoiDiem(Instant.now().minus(Duration.ofMinutes(20))).dongIds(dongIds);
        }

        private GiaoTraHangLoiRequest.GiaoTraHangLoiRequestBuilder huy(List<Integer> dongIds, Instant luc) {
            return GiaoTraHangLoiRequest.builder().thoiDiem(luc).dongIds(dongIds);
        }

        /** Đặt lúc ghi của lần trả lời thứ {@code i} (0 là lần đầu) của biên bản 200. */
        private void datLucTraLoi(int i, Instant luc) {
            gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(i).setNgayThucHien(luc);
        }

        private BienBanTraHangDto.TheoBienTheDto theoBienThe(BienBanTraHangDto dto, int bienTheId) {
            return dto.getTheoBienThe().stream().filter(t -> t.getBienTheSanPhamId() == bienTheId).findFirst().orElseThrow();
        }

        // ─────────────── Nhà cung cấp trả lời ───────────────

        @Test
        @DisplayName("Trước nhập kho chọn khác nhau theo dòng (áo A trừ tiền + nhận lại, áo B giao bù + tiêu hủy): biên bản hỗn hợp, nhật ký ghi theoDong + cam kết, chưa đụng đơn; nhập kho chỉ cộng đã nhận của áo A")
        void honHopTruocNhapKho() {
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);

            BienBanTraHangDto dto = traLoiDong(200, chon(301, "TRU_CONG_NO", "NHAN_LAI"), chon(302, "DOI_HANG", "TIEU_HUY"));

            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
            verify(bienBanRepo).save(bb);
            soBang("8", dongA.getSoLuongDaNhan(), "chưa nhập kho: chưa trừ");
            soBang("4", dongB.getSoLuongDaNhan(), "giao bù: không đụng");
            verify(ctDonRepo, never()).save(any());
            List<LichSuThayDoi> nk = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(1, nk.size());
            Map<String, Object> m = gia.moi(nk.get(0));
            assertEquals("HON_HOP", m.get("phuongAn"));
            assertEquals("CHO_CHOT", m.get("phuongAnCu"));
            assertEquals(Map.of("301", Map.of("cachBu", "TRU_CONG_NO", "hangLoi", "NHAN_LAI"),
                    "302", Map.of("cachBu", "DOI_HANG", "hangLoi", "TIEU_HUY")), m.get("theoDong"));
            assertFalse(m.containsKey("hangLoi"));
            assertEquals(Boolean.TRUE, m.get("camKet"), "người xác nhận đã đánh dấu câu cam kết");
            assertEquals(Map.of(), m.get("truTheoBienThe"), "chưa nhập kho: trừ tiền áp lúc nhập kho");
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, dto.getPhuongAn());
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, dto.getHangLoiNcc());
            assertEquals(1, dto.getSoLuongGiaoBu());
            assertEquals(0, dto.getSoLuongChoChonCachBu());
            assertEquals(2, dto.getSoLuongNhanLai());
            assertEquals(1, dto.getSoLuongTieuHuy());
            soBang("200000", dto.getGiaTriTruTien(), "giá trị các dòng trừ tiền (dự kiến)");
            assertEquals(0, dto.getSoLuongTruTien(), "chưa áp vào đơn");
            assertEquals(BienBanTraHangServiceImpl.TT_MOI_LAP, dto.getTrangThaiHienThi());
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), muc(dto, 301).getCachBuMo(), "chưa nhập kho: đổi tự do");
            verify(thongBao).nccDaTraLoi(bb, phieu, 1, 2, 2, 1, false);
            verify(thongBao, never()).hangLoiCanXuLy(any(), any(), anyInt(), anyInt(), any());
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(false));

            phieu.setTrangThai(3);
            phieu.setNgayNhap(Instant.now());
            service.khiNhapKho(bb, phieu, 61);

            soBang("10", dongA.getSoLuongDaNhan(), "áo A: 8 đạt + 2 lỗi trừ tiền");
            soBang("4", dongB.getSoLuongDaNhan(), "áo B giao bù: đơn vẫn chờ 1");
            verify(ctDonRepo, never()).save(dongB);
            List<LichSuThayDoi> tru = gia.theo(200, IHanhDong.tru_tien_tra_hang_ncc);
            assertEquals(1, tru.size());
            assertEquals(Map.of("10", 2), gia.moi(tru.get(0)).get("truTheoBienThe"));
            soBang("200000", gia.moi(tru.get(0)).get("tienTru"), "2 × 100.000");
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 2, 1, 61);
            verify(thongBao, never()).bienBanTraHang(any(), any(), any());
            verify(email, never()).guiCanChonLaiCachBu(any(), any(), any());
            assertEquals(Map.of(10, 2), service.truTienTheoBienThe(50));

            BienBanTraHangDto sau = xem(bb);
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, sau.getTrangThaiHienThi());
            assertEquals(2, sau.getSoLuongTruTien());
            soBang("200000", sau.getTienTruTien(), "tiền đã trừ");
            assertEquals(1, sau.getSoLuongChoHangBu(), "áo B còn chờ 1 hàng bù");
            assertEquals(List.of(), muc(sau, 301).getCachBuMo(), "đã nhập kho: trừ tiền là chốt cuối");
            assertEquals(List.of("TRU_CONG_NO"), muc(sau, 302).getCachBuMo(), "giao bù còn đổi sang trừ tiền khi chưa có hàng về");
        }

        @Test
        @DisplayName("Sau nhập kho chọn khác nhau theo dòng: dòng đơn của biến thể trừ tiền cộng đã nhận ngay, biến thể giao bù không đổi, đơn chưa nhận đủ; báo mua hàng / kho bằng số theo từng việc")
        void honHopSauNhapKho() {
            BienBanTraHangDto dto = traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "TRU_CONG_NO", "TIEU_HUY"));

            soBang("8", dongA.getSoLuongDaNhan(), "áo A giao bù: không đổi");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B: 4 đạt + 1 lỗi trừ tiền");
            verify(ctDonRepo).save(dongB);
            verify(ctDonRepo, never()).save(dongA);
            assertEquals(3, don.getTrangThai(), "áo A còn chờ 2 hàng bù: đơn chưa nhận đủ");
            verify(thongBao, never()).donMuaDaNhanDu(any(), any(), any());
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0));
            assertEquals(Map.of("11", 1), m.get("truTheoBienThe"));
            soBang("50000", m.get("tienTru"), "1 × 50.000");
            assertEquals(Map.of("301", Map.of("cachBu", "DOI_HANG", "hangLoi", "NHAN_LAI"),
                    "302", Map.of("cachBu", "TRU_CONG_NO", "hangLoi", "TIEU_HUY")), m.get("theoDong"));
            verify(thongBao).nccDaTraLoi(bb, phieu, 2, 1, 2, 1, false);
            verify(thongBao).bienBanDaChotXong(bb);
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 2, 1, null);
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, dto.getTrangThaiHienThi());
            assertEquals(1, dto.getSoLuongTruTien());
            soBang("50000", dto.getTienTruTien(), "tiền đã trừ");
            assertEquals(2, dto.getSoLuongChoHangBu());
            assertEquals(Map.of(11, 1), service.truTienTheoBienThe(50));
        }

        @Test
        @DisplayName("Lần đầu phải trả lời đủ mọi dòng: thiếu cách bù / hàng lỗi của dòng 302 → 400 kèm ô và id dòng; dòng gửi lặp, mã lạ của một dòng → 400; không ghi gì")
        void lanDauThieuDong() {
            LoiCoMaException ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI")));
            assertEquals("phuongAn", ex.getDuLieu().get("o"));
            assertEquals(302, ex.getDuLieu().get("dong"));
            ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "DOI_HANG", null)));
            assertEquals("hangLoi", ex.getDuLieu().get("o"));
            assertEquals(302, ex.getDuLieu().get("dong"));

            ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, () -> traLoiDong(200,
                    chon(301, "DOI_HANG", "NHAN_LAI"), chon(301, "TRU_CONG_NO", "NHAN_LAI"), chon(302, "DOI_HANG", "NHAN_LAI")));
            assertEquals("dong", ex.getDuLieu().get("o"));
            assertEquals(301, ex.getDuLieu().get("dong"));
            assertTrue(ex.getMessage().contains("bị lặp"), ex.getMessage());
            ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "CHO_CHOT", "NHAN_LAI")));
            assertEquals("phuongAn", ex.getDuLieu().get("o"));
            assertEquals(302, ex.getDuLieu().get("dong"));
            ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoiDong(200, chon(301, "DOI_HANG", "GIU_KHO"), chon(302, "DOI_HANG", "NHAN_LAI")));
            assertEquals("hangLoi", ex.getDuLieu().get("o"));
            assertEquals(301, ex.getDuLieu().get("dong"));
            khongDoiGi();
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Gửi id dòng không thuộc biên bản (dòng của biên bản khác / không tồn tại): 400 kèm id dòng, không ghi gì")
        void dongKhongThuocBienBan() {
            bienBan(201, phieu, BienBanTraHangNcc.PA_CHO_CHOT); // dòng 311, 312 thuộc biên bản khác
            for (int la : new int[]{311, 999}) {
                LoiCoMaException ex = loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, () -> traLoiDong(200,
                        chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "DOI_HANG", "NHAN_LAI"), chon(la, "DOI_HANG", "NHAN_LAI")));
                assertEquals("dong", ex.getDuLieu().get("o"));
                assertEquals(la, ex.getDuLieu().get("dong"));
                assertTrue(ex.getMessage().contains("không còn trong biên bản"), ex.getMessage());
            }
            khongDoiGi();
            verifyNoInteractions(email);
        }

        @Test
        @DisplayName("Sau lần đầu chỉ cần gửi dòng muốn đổi: đổi cách bù dòng 302 sang trừ tiền (áp ngay áo B), rồi đổi hàng lỗi dòng 301; dòng kia giữ lựa chọn và lần ghi cũ; gửi lại y như cũ 400")
        void doiRiengMotDong() {
            traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "DOI_HANG", "NHAN_LAI"));
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, bb.getPhuongAnXuLy());
            clearInvocations(thongBao, ctDonRepo);

            BienBanTraHangDto dto = service.traLoiTuCong(200, Set.of(5), phienBan(200),
                    List.of(chon(302, "TRU_CONG_NO", null)), null, null, "Phạm Hòa", "đổi áo B", true);
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            soBang("8", dongA.getSoLuongDaNhan(), "áo A vẫn giao bù");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ tiền");
            verify(ctDonRepo).save(dongB);
            verify(ctDonRepo, never()).save(dongA);
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(1));
            assertEquals(Map.of("302", Map.of("cachBu", "TRU_CONG_NO")), m.get("theoDong"), "chỉ ghi dòng đổi");
            assertEquals("HON_HOP", m.get("phuongAn"));
            assertEquals("DOI_HANG", m.get("phuongAnCu"));
            assertEquals(Map.of("11", 1), m.get("truTheoBienThe"));
            assertEquals("Nguyễn Lan", muc(dto, 301).getNguoiXacNhanCachBu(), "dòng 301 giữ lần ghi đầu");
            assertEquals("Phạm Hòa", muc(dto, 302).getNguoiXacNhanCachBu());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, muc(dto, 302).getHangLoiNcc(), "hàng lỗi dòng 302 không đổi");
            verify(thongBao).nccDaTraLoi(bb, phieu, 2, 1, 3, 0, false);

            clearInvocations(thongBao);
            dto = service.traLoiTuCong(200, Set.of(5), phienBan(200), List.of(chon(301, null, "TIEU_HUY")), null, null,
                    "Phạm Hòa", null, true);
            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, muc(dto, 301).getHangLoiNcc());
            assertEquals("Phạm Hòa", muc(dto, 301).getNguoiChonHangLoi());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, muc(dto, 302).getHangLoiNcc());
            assertEquals("Nguyễn Lan", muc(dto, 302).getNguoiChonHangLoi());
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, dto.getHangLoiNcc());
            assertEquals(Map.of("301", Map.of("hangLoi", "TIEU_HUY")),
                    gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(2)).get("theoDong"));
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 1, 2, null);

            int truoc = gia.dong.size();
            assertTrue(loiCong(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    () -> traLoiDong(200, chon(301, null, "TIEU_HUY"))).getMessage().contains("không có gì để lưu"));
            assertEquals(truoc, gia.dong.size());
        }

        @Test
        @DisplayName("Quá hạn khi phiếu còn Nháp: dòng chưa chọn chuyển trừ tiền (TU_DONG) và khóa với nhà cung cấp ngay, không đợi nhập kho; hàng lỗi vẫn chọn được; nhập kho áp trừ tiền")
        void tuDongKhoaTruocNhapKho() {
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);
            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, Instant.parse("2026-11-10T03:00:00Z"));
            service.xetHanTraLoi(200, Instant.parse("2026-11-17T17:00:00Z"));

            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0));
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, m.get("nguon"));
            assertEquals(Map.of("301", Map.of("cachBu", "TRU_CONG_NO"), "302", Map.of("cachBu", "TRU_CONG_NO")),
                    m.get("theoDong"));
            verify(thongBao).quaHanTruTien(bb, phieu, 3, 0);
            BienBanTraHangDto dto = xem(bb);
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, muc(dto, 301).getNguonCachBu());
            assertEquals(List.of(), muc(dto, 301).getCachBuMo(), "hệ thống đã chuyển: khóa dù phiếu còn Nháp");
            assertEquals(List.of(), dto.getCachBuMo());
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), dto.getHangLoiMo());

            LoiCoMaException ex = loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, null, "NHAN_LAI")));
            assertTrue(ex.getMessage().contains("đã chốt"), ex.getMessage());
            assertEquals(1, gia.theo(200, IHanhDong.chot_tra_hang_ncc).size());

            // Cách gửi cũ: cách bù đã khóa bị bỏ qua, hàng lỗi vẫn ghi
            BienBanTraHangDto sau = traLoi(200, "DOI_HANG", "TIEU_HUY");
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, sau.getPhuongAn());
            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, sau.getHangLoiNcc());
            assertEquals(Map.of("301", Map.of("hangLoi", "TIEU_HUY"), "302", Map.of("hangLoi", "TIEU_HUY")),
                    gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(1)).get("theoDong"));
            verify(ctDonRepo, never()).save(any());

            phieu.setTrangThai(3);
            phieu.setNgayNhap(Instant.now());
            service.khiNhapKho(bb, phieu, 61);
            soBang("10", dongA.getSoLuongDaNhan(), "nhập kho áp trừ tiền áo A");
            soBang("5", dongB.getSoLuongDaNhan(), "nhập kho áp trừ tiền áo B");
        }

        // ─────────────── Nhập kho, quá hạn, đóng đơn ───────────────

        @Test
        @DisplayName("Biên bản cũ chỉ có cách bù ở cột biên bản (trừ tiền, chưa có lựa chọn trong nhật ký): nhập kho đưa dòng áo A về chờ chọn thì dòng áo B vẫn trừ tiền, không nhảy theo cột về chờ chọn")
        void bienBanCuNhapKhoVuotGiuDongKhac() {
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
            when(ctPhieuRepo.sumDuKienPhieuNhapCungDon(50, 10)).thenReturn(BigDecimal.ONE); // áo A chỉ còn trừ được 1 < 2

            service.khiNhapKho(bb, phieu, 61);

            soBang("8", dongA.getSoLuongDaNhan(), "áo A vượt: không trừ");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ");
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
            List<LichSuThayDoi> traLoi = gia.theo(200, IHanhDong.chot_tra_hang_ncc);
            assertEquals(2, traLoi.size(), "chép dòng áo B từ cột biên bản, rồi đưa dòng áo A về chờ chọn");
            Map<String, Object> chep = gia.moi(traLoi.get(0));
            assertEquals(NhatKyTraHangNcc.NGUON_DU_LIEU_CU, chep.get("nguon"));
            assertEquals(Map.of("302", Map.of("cachBu", "TRU_CONG_NO")), chep.get("theoDong"));
            assertEquals(Map.of("301", Map.of("cachBu", "CHO_CHOT")), gia.moi(traLoi.get(1)).get("theoDong"));

            BienBanTraHangDto dto = xem(bb);
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, muc(dto, 301).getCachBu());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, muc(dto, 302).getCachBu(), "dòng áo B giữ trừ tiền");
            assertEquals(List.of(), muc(dto, 302).getCachBuMo(), "đã nhập kho và đã trừ: không đổi được");
            assertEquals(List.of("DOI_HANG", "TRU_CONG_NO"), muc(dto, 301).getCachBuMo());
            assertEquals(NhatKyTraHangNcc.NGUON_NHAP_KHO, gia.nhatKy.doc(200).cachBu().nguon(),
                    "lần chép không tính là một lần trả lời");
            verify(email).guiCanChonLaiCachBu(same(bb), any(BienBanTraHangDto.class), eq(List.of(301)));
        }

        @Test
        @DisplayName("Nhập kho: biến thể vượt có hai dòng (áo A tách theo lý do) thì cả hai dòng về chờ chọn, email chọn lại gửi đúng hai id; áo B vẫn trừ")
        void nhapKhoVuotHaiDongCungBienThe() {
            dongBienBan.put(200, new ArrayList<>(List.of(dong(301), dong(302), dongMoi(bb, 303, btA, 1, "Ố bẩn"))));
            loiTheoPhieu.put(1, new LinkedHashMap<>(Map.of(10, 3, 11, 1)));
            dongA.setSoLuongDat(new BigDecimal("11")); // áo A còn thiếu 3
            phieu.setTrangThai(0);
            phieu.setNgayNhap(null);
            traLoi(200, "TRU_CONG_NO", "NHAN_LAI");
            assertEquals(3, gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0)).get("theoDong") instanceof Map<?, ?> t
                    ? t.size() : -1, "cách gửi cũ áp cho cả ba dòng");
            when(ctPhieuRepo.sumDuKienPhieuNhapCungDon(50, 10)).thenReturn(BigDecimal.ONE); // chỉ còn trừ được 2 < 3

            phieu.setTrangThai(3);
            phieu.setNgayNhap(Instant.now());
            service.khiNhapKho(bb, phieu, 61);

            soBang("8", dongA.getSoLuongDaNhan(), "áo A vượt: không trừ dòng nào của áo A");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ");
            assertEquals(BienBanTraHangNcc.PA_CHO_CHOT, bb.getPhuongAnXuLy());
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(1));
            assertEquals(NhatKyTraHangNcc.NGUON_NHAP_KHO, m.get("nguon"));
            assertEquals(Map.of("301", Map.of("cachBu", "CHO_CHOT"), "303", Map.of("cachBu", "CHO_CHOT")), m.get("theoDong"));
            verify(email).guiCanChonLaiCachBu(same(bb), any(BienBanTraHangDto.class), eq(List.of(301, 303)));
            verify(thongBao).bienBanTraHang(bb, phieu, 61);
            BienBanTraHangDto dto = xem(bb);
            assertEquals(3, dto.getSoLuongChoChonCachBu());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, muc(dto, 302).getCachBu());
            assertEquals(NhatKyTraHangNcc.NGUON_NHAP_KHO, muc(dto, 303).getNguonCachBu());
        }

        @Test
        @DisplayName("Quá hạn sau nhập kho, áo A còn thiếu 1 mà dòng lỗi 2: dòng áo A coi như giao bù (TU_DONG), dòng áo B trừ tiền; báo số trừ / số bù")
        void quaHanMotPhanTheoDong() {
            dongA.setSoLuongDaNhan(new BigDecimal("9"));
            daGuiEmail(bb, NhatKyTraHangNcc.EMAIL_GUI, Instant.parse("2026-11-10T03:00:00Z"));
            service.xetHanTraLoi(200, Instant.parse("2026-11-17T17:00:00Z"));

            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, bb.getPhuongAnXuLy());
            soBang("10", dongA.getSoLuongDaNhan(), "áo A trừ 1 (phần đơn còn thiếu), 1 coi như đã giao bù");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ 1");
            Map<String, Object> m = gia.moi(gia.theo(200, IHanhDong.chot_tra_hang_ncc).get(0));
            assertEquals(Map.of("301", Map.of("cachBu", "TRU_CONG_NO", "soTru", 1), "302", Map.of("cachBu", "TRU_CONG_NO")),
                    m.get("theoDong"));
            assertEquals(Map.of("10", 1, "11", 1), m.get("truTheoBienThe"));
            verify(thongBao).quaHanTruTien(bb, phieu, 2, 1);
            verify(email).guiDaGhiNhanTraLoi(same(bb), any(), eq(true));
            BienBanTraHangDto dto = xem(bb);
            assertEquals(NhatKyTraHangNcc.NGUON_TU_DONG, muc(dto, 301).getNguonCachBu());
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, muc(dto, 301).getCachBu());
            assertEquals(1, muc(dto, 301).getSoLuongTru(), "dòng áo A chỉ trừ 1 trong 2");
            assertEquals(List.of(), muc(dto, 301).getCachBuMo(), "hệ thống đã chuyển: nhà cung cấp không đổi được");
            assertEquals(0, dto.getSoLuongChoHangBu(), "đơn không còn chờ hàng bù");
            assertFalse(dto.getChoNccChonCachBu());
        }

        @Test
        @DisplayName("Đóng đơn: phần còn thiếu của biến thể chia cho các dòng theo thứ tự id — dòng được chia thì trừ tiền, dòng không còn gì thì coi như đã giao bù")
        void dongDonChiaTheoDong() {
            dongBienBan.put(200, new ArrayList<>(List.of(dong(301), dong(302), dongMoi(bb, 303, btA, 1, "Ố bẩn"))));
            loiTheoPhieu.put(1, new LinkedHashMap<>(Map.of(10, 3, 11, 1)));
            dongA.setSoLuongDat(new BigDecimal("11"));
            dongA.setSoLuongDaNhan(new BigDecimal("9")); // áo A còn thiếu 2: nhà cung cấp đã giao bù 1
            when(bienBanRepo.khoaTheoDonMua(50)).thenReturn(List.of(bb));

            service.chuyenTruTienKhiDongDon(don, nguoiChot, "NCC hết hàng");

            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            soBang("11", dongA.getSoLuongDaNhan(), "áo A: 2 lỗi của dòng 301 trừ tiền");
            soBang("5", dongB.getSoLuongDaNhan(), "áo B: 1 lỗi trừ tiền");
            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(200);
            assertEquals("TRU_CONG_NO", nk.cachBuDong(301).giaTri());
            assertEquals("TRU_CONG_NO", nk.cachBuDong(302).giaTri());
            assertEquals("DOI_HANG", nk.cachBuDong(303).giaTri(), "áo A hết thiếu trước khi tới dòng 303");
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, nk.cachBuDong(303).lan().nguon());
            assertEquals(Map.of(10, 2, 11, 1), nk.truTheoBienThe());
            BienBanTraHangDto dto = xem(bb);
            assertTrue(muc(dto, 303).getBuXong(), "dòng đơn áo A hết thiếu");
            assertEquals(NhatKyTraHangNcc.NGUON_DONG_DON, muc(dto, 303).getNguonCachBu());
            assertEquals("NCC hết hàng", nk.cachBuDong(301).lan().ghiChu());
        }

        // ─────────────── Kho giao trả / tiêu hủy theo dòng ───────────────

        @Test
        @DisplayName("Giao trả theo dòng: ghi riêng dòng 301 thì biên bản vẫn chờ trả (dòng 302 còn ở kho), ghi lại dòng đã giao 409, dòng lạ 400; ghi nốt (mặc định: các dòng còn ở kho nhận lại) thì đã trả hết")
        void giaoTraMotPhan() {
            traLoiDong(200, chon(301, "DOI_HANG", "NHAN_LAI"), chon(302, "DOI_HANG", "NHAN_LAI"));
            clearInvocations(thongBao, bienBanRepo);

            BienBanTraHangDto dto = service.ghiDaGiaoTra(200, giao(List.of(301)).build());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, dto.getTrangThaiHang(), "còn dòng ở kho");
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, muc(dto, 301).getTrangThaiHang());
            assertEquals("Anh Tú", muc(dto, 301).getNguoiNhanHang());
            assertEquals(BienBanTraHangNcc.GIAO_NCC_LAY, muc(dto, 301).getCachGiao());
            assertNotNull(muc(dto, 301).getThoiDiemRoiKho());
            assertEquals(List.of(), muc(dto, 301).getHangLoiMo(), "đã rời kho: không đổi được");
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, muc(dto, 302).getTrangThaiHang());
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_GIAO_TRA, dto.getTrangThaiHienThi());
            assertEquals(List.of(301), gia.moi(gia.theo(200, IHanhDong.giao_tra_hang_loi).get(0)).get("dong"));
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 1, 0, null);
            verify(thongBao, never()).hangLoiDaRoiKho(any());
            verify(bienBanRepo, never()).save(any());

            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao(List.of(301)).build()))
                    .getMessage().contains("không còn ở kho"));
            assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.ghiDaGiaoTra(200, giao(List.of(302, 999)).build()))
                    .getMessage().contains("không thuộc biên bản"));
            assertEquals(1, gia.theo(200, IHanhDong.giao_tra_hang_loi).size());

            dto = service.ghiDaGiaoTra(200, giao(null).build());
            assertEquals(BienBanTraHangNcc.DA_TRA_HANG, bb.getTrangThai());
            verify(bienBanRepo).save(bb);
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, dto.getTrangThaiHang());
            assertEquals(List.of(302), gia.moi(gia.theo(200, IHanhDong.giao_tra_hang_loi).get(1)).get("dong"),
                    "mặc định: chỉ dòng còn ở kho");
            verify(thongBao).hangLoiDaRoiKho(bb);
            assertEquals(BienBanTraHangServiceImpl.TT_CHO_HANG_BU, dto.getTrangThaiHienThi(), "đã trả hết, còn chờ hàng bù");
        }

        @Test
        @DisplayName("Dòng nhận lại, dòng tiêu hủy: giao trả (mặc định chỉ dòng nhận lại) rồi tiêu hủy dòng còn lại → biên bản DA_XU_LY; báo kho theo số còn lại; không ghi thêm được, cổng không còn gì để chọn")
        void giaoTraRoiTieuHuyThanhDaXuLy() {
            traLoiDong(200, chon(301, "TRU_CONG_NO", "NHAN_LAI"), chon(302, "TRU_CONG_NO", "TIEU_HUY"));
            datLucTraLoi(0, Instant.now().minus(Duration.ofHours(2)));
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 2, 1, null);
            clearInvocations(thongBao);

            service.ghiDaGiaoTra(200, GiaoTraHangLoiRequest.builder().cachGiao("VAN_CHUYEN").nguoiNhan("Giao Hàng Nhanh")
                    .maVanDon("GHN9").thoiDiem(Instant.now().minus(Duration.ofMinutes(20))).build());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai(), "dòng tiêu hủy còn ở kho");
            assertEquals(List.of(301), gia.moi(gia.theo(200, IHanhDong.giao_tra_hang_loi).get(0)).get("dong"));
            verify(thongBao).hangLoiCanXuLy(bb, phieu, 0, 1, null);
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao(List.of(302)).build()))
                    .getMessage().contains("chưa chọn nhận lại"), "dòng đồng ý tiêu hủy không giao trả được");

            BienBanTraHangDto dto = service.ghiTieuHuy(200, huy(null, Instant.now().minus(Duration.ofMinutes(10))).build());
            assertEquals(BienBanTraHangNcc.DA_XU_LY, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_DA_XU_LY, bb.maHangLoi());
            assertFalse(bb.hangConOKho());
            assertEquals(BienBanTraHangNcc.HANG_DA_XU_LY, dto.getTrangThaiHang());
            assertEquals(BienBanTraHangNcc.HANG_DA_TRA, muc(dto, 301).getTrangThaiHang());
            assertEquals("GHN9", muc(dto, 301).getMaVanDon());
            assertEquals(BienBanTraHangNcc.GIAO_VAN_CHUYEN, muc(dto, 301).getCachGiao());
            assertEquals(BienBanTraHangNcc.HANG_DA_TIEU_HUY, muc(dto, 302).getTrangThaiHang());
            assertEquals("Nguyễn Lan", muc(dto, 302).getNguoiNhanHang(), "tiêu hủy: người đồng ý bên nhà cung cấp");
            assertNull(muc(dto, 302).getCachGiao());
            assertEquals(BienBanTraHangServiceImpl.TT_HOAN_TAT, dto.getTrangThaiHienThi(), "trừ tiền cả hai, hàng đã rời kho hết");
            Map<String, Object> huyNk = gia.moi(gia.theo(200, IHanhDong.tieu_huy_hang_loi).get(0));
            assertEquals(List.of(302), huyNk.get("dong"));
            assertEquals("Nguyễn Lan", huyNk.get("nguoiDongY"));
            verify(thongBao).hangLoiDaRoiKho(bb);

            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiDaGiaoTra(200, giao(null).build()))
                    .getMessage().contains("không còn ở kho"));
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.ghiTieuHuy(200, huy(null, Instant.now().minus(Duration.ofMinutes(5)))
                    .build())).getMessage().contains("không còn ở kho"));
            assertTrue(loiCong(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN,
                    () -> traLoiDong(200, chon(301, null, "TIEU_HUY"))).getMessage().contains("đã xử lý xong"));
        }

        @Test
        @DisplayName("Tiêu hủy nhiều dòng: thời điểm không được trước lần đồng ý MUỘN NHẤT của các dòng ghi; chỉ ghi dòng đồng ý sớm thì theo lúc đồng ý của dòng đó")
        void tieuHuyTruocLucDongYMuonNhat() {
            Instant t1 = Instant.now().minus(Duration.ofHours(3));
            Instant t2 = Instant.now().minus(Duration.ofHours(1));
            traLoiDong(200, chon(301, "DOI_HANG", "TIEU_HUY"), chon(302, "DOI_HANG", "NHAN_LAI"));
            datLucTraLoi(0, t1);
            traLoiDong(200, chon(302, null, "TIEU_HUY"));
            datLucTraLoi(1, t2);
            Instant giua = Instant.now().minus(Duration.ofHours(2));

            CommonException ex = loi(HttpStatus.BAD_REQUEST, () -> service.ghiTieuHuy(200, huy(null, giua).build()));
            assertTrue(ex.getMessage().contains("trước lúc nhà cung cấp đồng ý"), ex.getMessage());
            String lucT2 = java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")
                    .format(t2.atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
            assertTrue(ex.getMessage().contains(lucT2), "nêu lúc đồng ý muộn nhất: " + ex.getMessage());
            loi(HttpStatus.BAD_REQUEST, () -> service.ghiTieuHuy(200, huy(List.of(302), giua).build()));
            assertTrue(gia.theo(200, IHanhDong.tieu_huy_hang_loi).isEmpty());

            BienBanTraHangDto dto = service.ghiTieuHuy(200, huy(List.of(301), giua).build());
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_DA_TIEU_HUY, muc(dto, 301).getTrangThaiHang());
            assertEquals(giua, muc(dto, 301).getThoiDiemRoiKho());
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, muc(dto, 302).getTrangThaiHang());

            dto = service.ghiTieuHuy(200, huy(null, Instant.now().minus(Duration.ofMinutes(30))).build());
            assertEquals(BienBanTraHangNcc.DA_TIEU_HUY, bb.getTrangThai());
            assertEquals(BienBanTraHangNcc.HANG_DA_TIEU_HUY, dto.getTrangThaiHang());
            assertEquals(List.of(302), gia.moi(gia.theo(200, IHanhDong.tieu_huy_hang_loi).get(1)).get("dong"));
        }

        // ─────────────── Nhật ký cách ghi cũ, DTO, tổng ───────────────

        @Test
        @DisplayName("Nhật ký cách ghi cũ (một lựa chọn cho cả biên bản, không có theoDong) vẫn đọc là lựa chọn của mọi dòng; đổi riêng một dòng sau đó chỉ đè dòng đó")
        void nhatKyCachGhiCu() {
            gia.nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.ghi("DOI_HANG", "CHO_CHOT", "NHAN_LAI",
                    NhatKyTraHangNcc.NGUON_CONG_NCC, "Chị Lan", Map.of(), BigDecimal.ZERO, null));
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            BienBanTraHangDto dto = xem(bb);
            for (int id : new int[]{301, 302}) {
                assertEquals(BienBanTraHangNcc.PA_DOI_HANG, muc(dto, id).getCachBu());
                assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, muc(dto, id).getNguonCachBu());
                assertEquals("Chị Lan", muc(dto, id).getNguoiXacNhanCachBu());
                assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, muc(dto, id).getHangLoiNcc());
            }
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, dto.getHangLoiNcc());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, gia.nhatKy.doc(200).luaChonHangLoi());
            assertFalse(dto.getChoNccChonCachBu());
            assertFalse(dto.getChoNccChonHangLoi());

            // Đổi riêng dòng 302 sang trừ tiền: dòng 301 vẫn theo lựa chọn chung
            traLoiDong(200, chon(302, "TRU_CONG_NO", null));
            NhatKyTraHangNcc.NhatKy nk = gia.nhatKy.doc(200);
            assertEquals("DOI_HANG", nk.cachBuDong(301).giaTri());
            assertEquals("TRU_CONG_NO", nk.cachBuDong(302).giaTri());
            assertEquals("NHAN_LAI", nk.luaChonHangLoi(), "chưa đổi hàng lỗi theo dòng: vẫn là lựa chọn chung");
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, bb.getPhuongAnXuLy());
            soBang("5", dongB.getSoLuongDaNhan(), "áo B trừ tiền");

            // Đổi hàng lỗi riêng dòng 301: không còn lựa chọn chung, dòng 302 vẫn nhận lại
            traLoiDong(200, chon(301, null, "TIEU_HUY"));
            nk = gia.nhatKy.doc(200);
            assertNull(nk.luaChonHangLoi());
            assertEquals("NHAN_LAI", nk.hangLoiDong(302).giaTri());
            assertEquals("TIEU_HUY", nk.hangLoiDong(301).giaTri());
            service.ghiDaGiaoTra(200, giao(null).build());
            assertEquals(List.of(302), gia.moi(gia.theo(200, IHanhDong.giao_tra_hang_loi).get(0)).get("dong"),
                    "kho giao trả mặc định: chỉ dòng nhận lại");
            assertEquals(BienBanTraHangNcc.CHO_TRA_HANG, bb.getTrangThai());
        }

        @Test
        @DisplayName("Dòng nhật ký giao trả cách ghi cũ (không có danh sách dòng) áp cho mọi dòng")
        void giaoTraCachGhiCu() {
            gia.nhatKy.ghiGiaoTra(bb, "NCC_LAY", "Anh Tú", null, Instant.now().minus(Duration.ofHours(1)), null);
            BienBanTraHangDto dto = xem(bb);
            for (int id : new int[]{301, 302}) {
                assertEquals(BienBanTraHangNcc.HANG_DA_TRA, muc(dto, id).getTrangThaiHang());
                assertEquals("Anh Tú", muc(dto, id).getNguoiNhanHang());
                assertEquals(BienBanTraHangNcc.GIAO_NCC_LAY, muc(dto, id).getCachGiao());
                assertEquals(List.of(), muc(dto, id).getHangLoiMo());
            }
        }

        @Test
        @DisplayName("DTO từng dòng: đơn giá / giá trị, cách bù + nguồn + người xác nhận, hàng lỗi, nơi hàng, lựa chọn còn mở; khung tóm tắt, số theo biến thể; giao bù xong theo dòng; danh sách không kèm dòng")
        void dtoTungDong() {
            traLoiDong(200, chon(301, "TRU_CONG_NO", "NHAN_LAI"), chon(302, "DOI_HANG", "TIEU_HUY"));
            BienBanTraHangDto dto = xem(bb);

            BienBanTraHangDto.ChiTietItemDto a = muc(dto, 301);
            assertEquals(10, a.getBienTheSanPhamId());
            assertEquals("POLO-A", a.getSku());
            assertEquals("Áo Polo", a.getTenBienThe());
            assertEquals("LO-POLO-A", a.getMaLo());
            assertEquals("Rách vải", a.getLyDo());
            assertEquals(2, a.getSoLuong());
            soBang("100000", a.getDonGia(), "đơn giá dòng đơn áo A");
            soBang("200000", a.getGiaTri(), "2 × 100.000");
            assertEquals(BienBanTraHangNcc.PA_TRU_CONG_NO, a.getCachBu());
            assertEquals(NhatKyTraHangNcc.NGUON_CONG_NCC, a.getNguonCachBu());
            assertEquals("Nguyễn Lan", a.getNguoiXacNhanCachBu());
            assertNotNull(a.getThoiDiemCachBu());
            assertFalse(a.getBuXong());
            assertEquals(BienBanTraHangNcc.HL_NHAN_LAI, a.getHangLoiNcc());
            assertEquals("Nguyễn Lan", a.getNguoiChonHangLoi());
            assertNotNull(a.getThoiDiemChonHangLoi());
            assertEquals(BienBanTraHangNcc.HANG_O_KHO, a.getTrangThaiHang());
            assertNull(a.getThoiDiemRoiKho());
            assertEquals(List.of(), a.getCachBuMo(), "trừ tiền sau nhập kho: chốt");
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), a.getHangLoiMo());

            BienBanTraHangDto.ChiTietItemDto b = muc(dto, 302);
            soBang("50000", b.getGiaTri(), "1 × 50.000");
            assertEquals(BienBanTraHangNcc.PA_DOI_HANG, b.getCachBu());
            assertEquals(List.of("TRU_CONG_NO"), b.getCachBuMo());
            assertFalse(b.getBuXong(), "áo B còn thiếu 1");
            assertEquals(BienBanTraHangNcc.HL_TIEU_HUY, b.getHangLoiNcc());

            assertEquals(1, dto.getSoLuongGiaoBu());
            assertEquals(0, dto.getSoLuongChoChonCachBu());
            assertEquals(2, dto.getSoLuongNhanLai());
            assertEquals(1, dto.getSoLuongTieuHuy());
            soBang("200000", dto.getGiaTriTruTien(), "giá trị dòng trừ tiền");
            assertEquals(1, dto.getSoLuongChoHangBu());
            assertEquals(List.of("TRU_CONG_NO"), dto.getCachBuMo(), "hợp các lựa chọn còn mở của mọi dòng");
            assertEquals(List.of("NHAN_LAI", "TIEU_HUY"), dto.getHangLoiMo());
            assertFalse(dto.getBuXong());
            assertEquals(0, theoBienThe(dto, 10).getSoLuongGiaoBu());
            assertEquals(0, theoBienThe(dto, 10).getSoLuongChoChon());
            assertEquals(1, theoBienThe(dto, 11).getSoLuongGiaoBu());

            // Hàng bù áo B về đủ: dòng 302 giao bù xong
            dongB.setSoLuongDaNhan(new BigDecimal("5"));
            dto = xem(bb);
            assertTrue(muc(dto, 302).getBuXong());
            assertTrue(dto.getBuXong());
            assertEquals(0, dto.getSoLuongChoHangBu());

            // Danh sách: không kèm dòng, không tính lựa chọn còn mở; khung tóm tắt vẫn có
            BienBanTraHangDto ds = service.danhSach(null, null, null, null).getItems().get(0);
            assertNull(ds.getItems());
            assertNull(ds.getCachBuMo());
            assertEquals(1, ds.getSoLuongGiaoBu());
            assertEquals(BienBanTraHangNcc.PA_HON_HOP, ds.getPhuongAn());
        }

        @Test
        @DisplayName("Tổng của biên bản từ các dòng: cách bù (chờ chọn khi còn dòng chưa có, hỗn hợp khi khác nhau), nơi hàng lỗi (DA_XU_LY khi vừa trả vừa hủy), lựa chọn hàng lỗi")
        void tongTuCacDong() {
            ChiTietTraHangNcc c1 = dong(301);
            ChiTietTraHangNcc c2 = dong(302);
            java.util.function.BiFunction<ChiTietTraHangNcc, String[], BienBanTraHangServiceImpl.Dong> d =
                    (ct, x) -> new BienBanTraHangServiceImpl.Dong(ct, x[0], null, x[1], null, x[2], null);
            String o = BienBanTraHangNcc.HANG_O_KHO;
            String tra = BienBanTraHangNcc.HANG_DA_TRA;
            String huy = BienBanTraHangNcc.HANG_DA_TIEU_HUY;

            assertEquals("CHO_CHOT", BienBanTraHangServiceImpl.tongCachBu(List.of()));
            assertEquals("CHO_CHOT", BienBanTraHangServiceImpl.tongCachBu(List.of(
                    d.apply(c1, new String[]{"TRU_CONG_NO", null, o}), d.apply(c2, new String[]{"CHO_CHOT", null, o}))));
            assertEquals("TRU_CONG_NO", BienBanTraHangServiceImpl.tongCachBu(List.of(
                    d.apply(c1, new String[]{"TRU_CONG_NO", null, o}), d.apply(c2, new String[]{"TRU_CONG_NO", null, o}))));
            assertEquals("HON_HOP", BienBanTraHangServiceImpl.tongCachBu(List.of(
                    d.apply(c1, new String[]{"TRU_CONG_NO", null, o}), d.apply(c2, new String[]{"DOI_HANG", null, o}))));

            assertEquals("CHO_TRA_HANG", BienBanTraHangServiceImpl.tongViTri(List.of()));
            assertEquals("CHO_TRA_HANG", BienBanTraHangServiceImpl.tongViTri(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "NHAN_LAI", tra}), d.apply(c2, new String[]{"DOI_HANG", "NHAN_LAI", o}))));
            assertEquals("DA_TRA_HANG", BienBanTraHangServiceImpl.tongViTri(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "NHAN_LAI", tra}), d.apply(c2, new String[]{"DOI_HANG", "NHAN_LAI", tra}))));
            assertEquals("DA_TIEU_HUY", BienBanTraHangServiceImpl.tongViTri(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "TIEU_HUY", huy}), d.apply(c2, new String[]{"DOI_HANG", "TIEU_HUY", huy}))));
            assertEquals("DA_XU_LY", BienBanTraHangServiceImpl.tongViTri(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "NHAN_LAI", tra}), d.apply(c2, new String[]{"DOI_HANG", "TIEU_HUY", huy}))));

            assertNull(BienBanTraHangServiceImpl.tongHangLoi(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", null, o}), d.apply(c2, new String[]{"DOI_HANG", null, o}))));
            assertEquals("NHAN_LAI", BienBanTraHangServiceImpl.tongHangLoi(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "NHAN_LAI", o}), d.apply(c2, new String[]{"DOI_HANG", null, o}))));
            assertEquals("HON_HOP", BienBanTraHangServiceImpl.tongHangLoi(List.of(
                    d.apply(c1, new String[]{"DOI_HANG", "NHAN_LAI", o}), d.apply(c2, new String[]{"DOI_HANG", "TIEU_HUY", o}))));
        }
    }

    // ═══════════════════════ Gửi lại email biên bản ═══════════════════════

    @Nested
    @DisplayName("Gửi lại email biên bản (guiLaiEmail)")
    class GuiLaiEmail {

        @BeforeEach
        void xoaChan() {
            ((Map<?, ?>) ReflectionTestUtils.getField(BienBanTraHangServiceImpl.class, "GUI_LAI_EMAIL")).clear();
        }

        private String moTaGuiLai() {
            ArgumentCaptor<String> moTa = ArgumentCaptor.forClass(String.class);
            verify(email).guiBienBanTraHang(same(bb), any(), eq(NhatKyTraHangNcc.EMAIL_GUI), any(), moTa.capture(), any(), any());
            clearInvocations(email);
            ((Map<?, ?>) ReflectionTestUtils.getField(BienBanTraHangServiceImpl.class, "GUI_LAI_EMAIL")).clear();
            return moTa.getValue();
        }

        @Test
        @DisplayName("Mô tả hàng lỗi theo nơi hàng đã đi: tài xế + biển số / NCC đến lấy / gửi vận chuyển + mã vận đơn; còn ở kho: null")
        void moTaHangLoi() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            service.guiLaiEmail(200);
            assertNull(moTaGuiLai());

            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now().minus(Duration.ofHours(1)));
            service.ghiDaGiaoTra(200, GiaoTraHangLoiRequest.builder().cachGiao("NCC_LAY").nguoiNhan("Anh Tú")
                    .thoiDiem(Instant.now().minus(Duration.ofMinutes(5))).build());
            service.guiLaiEmail(200);
            assertEquals("Anh Tú đến lấy", moTaGuiLai());

            // Dựng lại tình huống (hàng còn ở kho, chưa giao lần nào) để thử cách giao khác: bỏ lần giao trả vừa ghi
            bb.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            gia.dong.removeIf(d -> IHanhDong.giao_tra_hang_loi.equals(d.getHanhDong()));
            service.ghiDaGiaoTra(200, GiaoTraHangLoiRequest.builder().cachGiao("VAN_CHUYEN").nguoiNhan("Giao Hàng Nhanh")
                    .maVanDon("GHN123").thoiDiem(Instant.now().minus(Duration.ofMinutes(5))).build());
            service.guiLaiEmail(200);
            assertEquals("Gửi Giao Hàng Nhanh · mã vận đơn GHN123", moTaGuiLai());

            BienBanTraHangNcc traNgay = bienBan(214, phieu, BienBanTraHangNcc.PA_CHO_CHOT);
            traNgay.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            bb = traNgay;
            when(bienBanRepo.findById(214)).thenReturn(Optional.of(traNgay));
            lap(traNgay, BienBanTraHangNcc.TRA_NGAY, "Nguyễn Văn Hùng", "30K-288.23");
            service.guiLaiEmail(214);
            assertEquals("Người giao hàng Nguyễn Văn Hùng · biển số 30K-288.23", moTaGuiLai());
        }

        @Test
        @DisplayName("Gửi lại khi còn câu chờ NCC (kể cả chỉ còn hàng lỗi); đã trả lời xong / đã hủy / NCC chưa có email / bấm lại trong 60 giây: 409")
        void chan() {
            lap(bb, BienBanTraHangNcc.GIU_KHO, null, null);
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_DOI_HANG);
            assertDoesNotThrow(() -> service.guiLaiEmail(200), "cách bù đã chọn nhưng hàng lỗi còn chờ");
            ((Map<?, ?>) ReflectionTestUtils.getField(BienBanTraHangServiceImpl.class, "GUI_LAI_EMAIL")).clear();
            clearInvocations(email);

            nccChonHangLoi(bb, BienBanTraHangNcc.HL_NHAN_LAI, Instant.now());
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.guiLaiEmail(200)).getMessage().contains("không còn chờ"));
            bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
            bb.setTrangThai(BienBanTraHangNcc.DA_HUY);
            loi(HttpStatus.CONFLICT, () -> service.guiLaiEmail(200));
            bb.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
            ncc.setEmail("  ");
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.guiLaiEmail(200)).getMessage().contains("chưa có email"));
            verifyNoInteractions(email);

            ncc.setEmail("ncc05@viettien.vn");
            service.guiLaiEmail(200);
            assertTrue(loi(HttpStatus.CONFLICT, () -> service.guiLaiEmail(200)).getMessage().contains("1 phút"));
            verify(email, times(1)).guiBienBanTraHang(any(), any(), any(), any(), any(), any(), any());
        }
    }
}
