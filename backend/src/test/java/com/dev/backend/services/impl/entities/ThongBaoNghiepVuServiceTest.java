package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.*;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.ThongBaoXuatKhoService.GiaiDoanHuy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.invocation.Invocation;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Luật người nhận và câu chữ của thông báo đợt 1: mua hàng (M1–M4), xuất kho (X2, X3, B1), kiểm kê (K1). Dùng
 * ThongBaoService thật (bỏ người thao tác, bỏ trùng, ghi từng người) trên repository giả.
 * Kho: Kho tổng = 1 (quản lý 11, 12; nhân viên mua hàng 45), Cửa hàng 1 = 2 (quản lý 21). Quản trị viên 1, 2. Nhân viên
 * mua hàng 40 (lập yêu cầu), 50 (gửi yêu cầu báo giá). Nhân viên kho 60, 61. Nhân viên bán hàng 70.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ThongBaoNghiepVuServiceTest {

    private static final int KHO_TONG = 1, CUA_HANG = 2;

    @Mock private ThongBaoRepository thongBaoRepo;
    @Mock private PlatformTransactionManager txManager;
    @Mock private PhanQuyenNguoiDungKhoRepository pqRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private KhoRepository khoRepo;
    @Mock private DonBanHangRepository donRepo;
    @Mock private ChiTietNhatHangRepository ctnRepo;

    private ThongBaoMuaHangService muaHang;
    private ThongBaoXuatKhoService xuatKho;
    private ThongBaoKiemKeService kiemKe;
    private Kho khoTong, cuaHang;

    @BeforeEach
    void setUp() {
        ThongBaoService thongBao = new ThongBaoService(thongBaoRepo, txManager);
        NguoiNhanThongBao nguoiNhan = new NguoiNhanThongBao(pqRepo, ndRepo);
        muaHang = new ThongBaoMuaHangService(thongBao, nguoiNhan, khoRepo, ndRepo);
        xuatKho = new ThongBaoXuatKhoService(thongBao, nguoiNhan, khoRepo, ndRepo, donRepo, ctnRepo);
        kiemKe = new ThongBaoKiemKeService(thongBao, nguoiNhan, khoRepo);

        khoTong = Kho.builder().id(KHO_TONG).tenKho("Kho tổng").loaiKho("kho_tong").build();
        cuaHang = Kho.builder().id(CUA_HANG).tenKho("Cửa hàng 1").loaiKho("cua_hang").build();
        when(khoRepo.findById(KHO_TONG)).thenReturn(Optional.of(khoTong));
        when(khoRepo.findById(CUA_HANG)).thenReturn(Optional.of(cuaHang));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(KHO_TONG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(11, 12));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(21));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(KHO_TONG)), eq(IRoleType.nhan_vien_mua_hang), any())).thenReturn(List.of(45));
        when(ndRepo.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien)).thenReturn(List.of(1, 2));
        for (int id : new int[]{40, 45, 50}) when(ndRepo.findById(id)).thenReturn(Optional.of(nguoi(id, IRoleType.nhan_vien_mua_hang)));
        for (int id : new int[]{60, 61}) when(ndRepo.findById(id)).thenReturn(Optional.of(nguoi(id, IRoleType.nhan_vien_kho)));
        when(ndRepo.findById(70)).thenReturn(Optional.of(nguoi(70, IRoleType.nhan_vien_ban_hang)));
        for (int id : new int[]{1, 2}) when(ndRepo.findById(id)).thenReturn(Optional.of(nguoi(id, IRoleType.quan_tri_vien)));
        when(thongBaoRepo.nguoiDaCoSuKien(anyString(), any())).thenReturn(List.of());
    }

    @AfterEach
    void donDongBo() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ══════════════════════════ Tiện ích ══════════════════════════

    private List<ThongBao> daLuu() {
        List<ThongBao> tatCa = new ArrayList<>();
        for (Invocation lan : mockingDetails(thongBaoRepo).getInvocations()) {
            if ("save".equals(lan.getMethod().getName())) tatCa.add(lan.getArgument(0));
        }
        return tatCa;
    }

    private Set<Integer> nguoiNhan() {
        Set<Integer> ids = new TreeSet<>();
        daLuu().forEach(t -> ids.add(t.getNguoiNhanId()));
        return ids;
    }

    private ThongBao cuaNguoi(int id) {
        return daLuu().stream().filter(t -> t.getNguoiNhanId() == id).findFirst()
                .orElseThrow(() -> new AssertionError("Người " + id + " không nhận thông báo"));
    }

    private static NguoiDung nguoi(int id, String vaiTro) {
        return NguoiDung.builder().id(id).vaiTro(vaiTro).hoTen("Người " + id).trangThai(1).build();
    }

    private YeuCauMuaHang yeuCau() {
        return YeuCauMuaHang.builder().id(5).soYeuCauMuaHang("YC2026110105").khoNhap(khoTong)
                .nguoiTao(NguoiDung.builder().id(40).build()).build();
    }

    private DanhSachNhatHang phieuNhat(Integer nguoiNhat) {
        return DanhSachNhatHang.builder().id(70).maPickList("PL-20261101-001").khoXuat(cuaHang)
                .nguoiNhat(nguoiNhat == null ? null : NguoiDung.builder().id(nguoiNhat).build()).build();
    }

    private DonBanHang don() {
        return DonBanHang.builder().id(90).soDonHang("SO0815").khoXuat(cuaHang)
                .kenhBanHang(KenhBanHang.builder().id(3).tenKenh("Shopify").build()).build();
    }

    // ══════════════════════════ M1–M3 Yêu cầu nhập hàng ══════════════════════════

    @Test
    @DisplayName("M1: yêu cầu chờ duyệt → quản lý Kho tổng + quản lý ghi trên kho, không gửi người lập")
    void m1_choDuyet() {
        khoTong.setQuanLy(nguoi(13, IRoleType.quan_ly_kho));
        muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 3);

        assertEquals(Set.of(11, 12, 13), nguoiNhan());
        ThongBao t = cuaNguoi(11);
        assertEquals("Yêu cầu nhập hàng YC2026110105 chờ duyệt", t.getTieuDe());
        assertEquals("Người 40 đề nghị nhập 3 mã hàng về Kho tổng.", t.getMoTa());
        assertEquals("/purchase-requests/5", t.getDuongDan());
        assertEquals("YCNH:5:CHO_DUYET", t.getKhoaSuKien());
        assertEquals("phe_duyet", t.getLoai());
        assertEquals("yeu_cau_mua_hang", t.getLoaiThamChieu());
        assertEquals(KHO_TONG, t.getKhoId());
        assertEquals("Mua hàng", ThongBaoService.dong(t).getNhom());
    }

    @Test
    @DisplayName("M1: quản lý ghi trên kho đã ngừng hoạt động hoặc không phải quản lý kho thì không nhận")
    void m1_quanLyGhiTrenKhoKhongHopLe() {
        NguoiDung nghi = nguoi(13, IRoleType.quan_ly_kho);
        nghi.setTrangThai(0);
        khoTong.setQuanLy(nghi);
        muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 1);
        assertEquals(Set.of(11, 12), nguoiNhan());

        clearInvocations(thongBaoRepo);
        khoTong.setQuanLy(nguoi(14, IRoleType.nhan_vien_kho));
        muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 1);
        assertEquals(Set.of(11, 12), nguoiNhan());
    }

    @Test
    @DisplayName("M1: Kho tổng không có quản lý nào đang hiệu lực → quản trị viên")
    void m1_khongCoQuanLy_guiQuanTri() {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(KHO_TONG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 2);
        assertEquals(Set.of(1, 2), nguoiNhan());
    }

    @Test
    @DisplayName("M2: duyệt → người lập, màu xanh, câu nhắc gửi yêu cầu báo giá")
    void m2_duyet() {
        muaHang.yeuCauDaXet(yeuCau(), true, null, nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(40), nguoiNhan());
        ThongBao t = cuaNguoi(40);
        assertEquals("Yêu cầu nhập hàng YC2026110105 đã được duyệt", t.getTieuDe());
        assertEquals("Người 11 đã duyệt. Gửi yêu cầu báo giá cho nhà cung cấp.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_SUCCESS, t.getTone());
        assertEquals("YCNH:5:DUYET", t.getKhoaSuKien());
    }

    @Test
    @DisplayName("M2: người lập là nhân viên bán hàng → họ nhận câu không nhắc việc, nhân viên mua hàng kho nhập nhận câu nhắc")
    void m2_nguoiLapBanHang_baoNhanVienMuaHang() {
        YeuCauMuaHang yc = yeuCau();
        yc.setNguoiTao(NguoiDung.builder().id(70).build());
        muaHang.yeuCauDaXet(yc, true, null, nguoi(11, IRoleType.quan_ly_kho));

        assertEquals(Set.of(45, 70), nguoiNhan());
        assertEquals("Người 11 đã duyệt.", cuaNguoi(70).getMoTa());
        assertEquals("Người 11 đã duyệt. Gửi yêu cầu báo giá cho nhà cung cấp.", cuaNguoi(45).getMoTa());
        assertEquals("Yêu cầu nhập hàng YC2026110105 đã được duyệt", cuaNguoi(45).getTieuDe());
    }

    @Test
    @DisplayName("M2: không đọc được vai trò người lập (không tìm thấy) → không lỗi, coi như không gửi được yêu cầu báo giá")
    void m2_khongTimThayNguoiLap() {
        YeuCauMuaHang yc = yeuCau();
        yc.setNguoiTao(NguoiDung.builder().id(99).build());
        muaHang.yeuCauDaXet(yc, true, null, nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(45, 99), nguoiNhan());
    }

    @Test
    @DisplayName("M3: từ chối → người lập, kèm lý do (bỏ dấu chấm cuối), màu đỏ")
    void m3_tuChoi() {
        muaHang.yeuCauDaXet(yeuCau(), false, " Đã đủ hàng.. ", nguoi(11, IRoleType.quan_ly_kho));
        ThongBao t = cuaNguoi(40);
        assertEquals("Yêu cầu nhập hàng YC2026110105 bị từ chối", t.getTieuDe());
        assertEquals("Người 11 từ chối. Lý do: Đã đủ hàng.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_DANGER, t.getTone());
        assertEquals("YCNH:5:TU_CHOI", t.getKhoaSuKien());
    }

    @Test
    @DisplayName("M2: người lập tự duyệt yêu cầu của mình (quản trị viên) → không ai nhận")
    void m2_tuDuyet_khongGui() {
        YeuCauMuaHang yc = yeuCau();
        yc.setNguoiTao(NguoiDung.builder().id(1).build());
        muaHang.yeuCauDaXet(yc, true, null, nguoi(1, IRoleType.quan_tri_vien));
        assertTrue(daLuu().isEmpty());
    }

    // ══════════════════════════ M4 Báo giá nhà cung cấp ══════════════════════════

    private DonMuaHang donMua() {
        return DonMuaHang.builder().id(30).soDonMua("DM0107").khoNhap(khoTong).tongTien(new BigDecimal("48500000.00"))
                .nhaCungCap(NhaCungCap.builder().id(8).tenNhaCungCap("May Việt Tiến").build())
                .nguoiTao(NguoiDung.builder().id(50).build()).build();
    }

    @Test
    @DisplayName("M4: nhà cung cấp gửi báo giá → người gửi yêu cầu báo giá + người lập yêu cầu")
    void m4_baoGiaMoi() {
        Instant luc = Instant.parse("2026-11-01T03:00:00Z");
        muaHang.baoGiaMoi(donMua(), yeuCau(), luc, false);

        assertEquals(Set.of(40, 50), nguoiNhan());
        ThongBao t = cuaNguoi(50);
        assertEquals("May Việt Tiến đã gửi báo giá", t.getTieuDe());
        assertEquals("Đơn mua hàng DM0107, yêu cầu nhập hàng YC2026110105, tổng 48.500.000 ₫.", t.getMoTa());
        assertEquals("/quotation/30", t.getDuongDan());
        assertEquals("DMH:30:BAO_GIA:" + luc.getEpochSecond(), t.getKhoaSuKien());
        assertEquals("don_mua_hang", ThongBaoService.dong(t).getLoai());
    }

    @Test
    @DisplayName("M4: gửi lại báo giá → câu 'gửi lại', khóa khác nên là thông báo mới")
    void m4_guiLai() {
        muaHang.baoGiaMoi(donMua(), yeuCau(), Instant.parse("2026-11-01T03:00:00Z"), false);
        muaHang.baoGiaMoi(donMua(), yeuCau(), Instant.parse("2026-11-01T04:00:00Z"), true);
        List<ThongBao> cua50 = daLuu().stream().filter(t -> t.getNguoiNhanId() == 50).toList();
        assertEquals(2, cua50.size());
        assertEquals("May Việt Tiến đã gửi lại báo giá", cua50.get(1).getTieuDe());
        assertNotEquals(cua50.get(0).getKhoaSuKien(), cua50.get(1).getKhoaSuKien());
    }

    @Test
    @DisplayName("M4: người gửi yêu cầu báo giá cũng là người lập yêu cầu → chỉ một thông báo")
    void m4_cungNguoi() {
        DonMuaHang d = donMua();
        d.setNguoiTao(NguoiDung.builder().id(40).build());
        muaHang.baoGiaMoi(d, yeuCau(), Instant.now(), false);
        assertEquals(1, daLuu().size());
    }

    @Test
    @DisplayName("M4: người gửi là nhân viên kho, người lập là nhân viên bán hàng → nhân viên kho + nhân viên mua hàng kho nhập")
    void m4_khongAiChotDuoc_themNhanVienMuaHang() {
        DonMuaHang d = donMua();
        d.setNguoiTao(NguoiDung.builder().id(60).build());
        YeuCauMuaHang yc = yeuCau();
        yc.setNguoiTao(NguoiDung.builder().id(70).build());
        muaHang.baoGiaMoi(d, yc, Instant.now(), false);
        assertEquals(Set.of(45, 60), nguoiNhan());
    }

    @Test
    @DisplayName("M4: không ai xem được, kho nhập không có nhân viên mua hàng → quản trị viên")
    void m4_quanTriNhanThay() {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(KHO_TONG)), eq(IRoleType.nhan_vien_mua_hang), any())).thenReturn(List.of());
        DonMuaHang d = donMua();
        d.setNguoiTao(null);
        YeuCauMuaHang yc = yeuCau();
        yc.setNguoiTao(NguoiDung.builder().id(70).build());
        muaHang.baoGiaMoi(d, yc, Instant.now(), false);
        assertEquals(Set.of(1, 2), nguoiNhan());
    }

    @Test
    @DisplayName("tien: làm tròn tới đồng, dấu chấm ngăn nghìn")
    void tien() {
        assertEquals("48.500.000 ₫", ThongBaoMuaHangService.tien(new BigDecimal("48500000.00")));
        assertEquals("1.000 ₫", ThongBaoMuaHangService.tien(new BigDecimal("999.5")));
        assertEquals("0 ₫", ThongBaoMuaHangService.tien(BigDecimal.ZERO));
    }

    // ══════════════════════════ X2 Giao phiếu nhặt ══════════════════════════

    @Test
    @DisplayName("X2: quản lý giao phiếu khi tạo → người được giao, kèm số đơn và số sản phẩm")
    void x2_giaoMoi() {
        when(donRepo.findByDanhSachNhatHang_Id(70)).thenReturn(List.of(don(), don()));
        when(ctnRepo.findByDanhSachNhatHang_Id(70)).thenReturn(List.of(
                ChiTietNhatHang.builder().soLuongCanNhat(new BigDecimal("4.000")).build(),
                ChiTietNhatHang.builder().soLuongCanNhat(new BigDecimal("8")).build()));
        xuatKho.daGiaoPhieuNhat(phieuNhat(60), null, 60, 21);

        assertEquals(Set.of(60), nguoiNhan());
        ThongBao t = cuaNguoi(60);
        assertEquals("Bạn được giao phiếu nhặt PL-20261101-001", t.getTieuDe());
        assertEquals("Cửa hàng 1, 2 đơn, 12 sản phẩm. Bắt đầu nhặt hàng.", t.getMoTa());
        assertEquals("/goods-issues/pick-lists/70", t.getDuongDan());
        assertTrue(t.getKhoaSuKien().startsWith("PL:70:GIAO:60:"));
        assertEquals("Nhặt hàng", ThongBaoService.dong(t).getNhom());
    }

    @Test
    @DisplayName("X2: đơn đã hủy vẫn nối với phiếu thì không đếm")
    void x2_khongDemDonHuy() {
        DonBanHang huy = don();
        huy.setTrangThai(com.dev.backend.constant.variables.ITrangThaiDonBanHang.DA_HUY);
        when(donRepo.findByDanhSachNhatHang_Id(70)).thenReturn(List.of(don(), huy));
        xuatKho.daGiaoPhieuNhat(phieuNhat(60), null, 60, 21);
        assertEquals("Cửa hàng 1, 1 đơn. Bắt đầu nhặt hàng.", cuaNguoi(60).getMoTa());
    }

    @Test
    @DisplayName("X2: nhân viên tự nhận phiếu → không ai nhận")
    void x2_tuNhan() {
        xuatKho.daGiaoPhieuNhat(phieuNhat(60), null, 60, 60);
        assertTrue(daLuu().isEmpty());
    }

    @Test
    @DisplayName("X2: giao lại cho người khác → người mới 'được giao', người cũ 'đã chuyển cho …'")
    void x2_giaoLai() {
        when(ndRepo.findById(61)).thenReturn(Optional.of(nguoi(61, IRoleType.nhan_vien_kho)));
        xuatKho.daGiaoPhieuNhat(phieuNhat(61), 60, 61, 21);

        assertEquals(Set.of(60, 61), nguoiNhan());
        assertEquals("Bạn được giao phiếu nhặt PL-20261101-001", cuaNguoi(61).getTieuDe());
        assertEquals("Phiếu nhặt PL-20261101-001 đã chuyển cho Người 61", cuaNguoi(60).getTieuDe());
        assertTrue(cuaNguoi(60).getKhoaSuKien().startsWith("PL:70:BO:60:"));
    }

    @Test
    @DisplayName("X2: giao lại đúng người đang giữ phiếu → không gửi gì")
    void x2_khongDoi() {
        xuatKho.daGiaoPhieuNhat(phieuNhat(60), 60, 60, 21);
        assertTrue(daLuu().isEmpty());
        verifyNoInteractions(thongBaoRepo);
    }

    // ══════════════════════════ X3 Đơn hủy trong phiếu nhặt ══════════════════════════

    private static Map<String, BigDecimal> catKe(Object... maVaSo) {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        for (int i = 0; i < maVaSo.length; i += 2) m.put((String) maVaSo[i], new BigDecimal(maVaSo[i + 1].toString()));
        return m;
    }

    @Test
    @DisplayName("X3: đơn hủy lúc đang nhặt, chưa quét gì → chỉ người nhặt, không báo quản lý")
    void x3_dangNhat_khongCatKe() {
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(60), don(), GiaiDoanHuy.DANG_NHAT, Map.of(), false);
        assertEquals(Set.of(60), nguoiNhan());
        ThongBao t = cuaNguoi(60);
        assertEquals("Đơn SO0815 bị hủy khi đang nhặt", t.getTieuDe());
        assertEquals("Số cần nhặt của phiếu PL-20261101-001 đã giảm.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_WARNING, t.getTone());
        assertEquals("PL:70:DON_HUY:90", t.getKhoaSuKien());
    }

    @Test
    @DisplayName("X3: có hàng phải cất về kệ → thêm quản lý kho xuất, câu ghi từng mã")
    void x3_dangNhat_coCatKe() {
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(60), don(), GiaiDoanHuy.DANG_NHAT, catKe("POLO-X", "3.000"), false);
        assertEquals(Set.of(21, 60), nguoiNhan());
        assertEquals("Số cần nhặt của phiếu PL-20261101-001 đã giảm. Cất về kệ: POLO-X ×3.", cuaNguoi(21).getMoTa());
    }

    @Test
    @DisplayName("X3: cả phiếu bị hủy lúc nhặt / lúc chờ đóng gói / một đơn hủy lúc chờ đóng gói → câu riêng")
    void x3_caPhieu_vaDongGoi() {
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(60), don(), GiaiDoanHuy.DANG_NHAT, Map.of(), true);
        assertEquals("Phiếu nhặt PL-20261101-001 đã hủy", cuaNguoi(60).getTieuDe());
        assertEquals("Mọi đơn trong phiếu đã bị hủy. Dừng nhặt. Không có hàng phải cất lại.", cuaNguoi(60).getMoTa());

        clearInvocations(thongBaoRepo);
        DonBanHang khac = don();
        khac.setId(91);
        khac.setSoDonHang("SO0816");
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(60), khac, GiaiDoanHuy.CHO_DONG_GOI, catKe("AO-1", 2), false);
        assertEquals("Đơn SO0816 bị hủy lúc chờ đóng gói", cuaNguoi(60).getTieuDe());
        assertEquals("Phiếu nhặt PL-20261101-001. Đơn không cần đóng gói nữa. Cất về kệ: AO-1 ×2.", cuaNguoi(21).getMoTa());

        clearInvocations(thongBaoRepo);
        DonBanHang cuoi = don();
        cuoi.setId(92);
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(60), cuoi, GiaiDoanHuy.CHO_DONG_GOI, catKe("AO-1", 1, "AO-2", 2), true);
        assertEquals("Mọi đơn trong phiếu đã bị hủy. Dừng đóng gói. Cất về kệ: AO-1 ×1, AO-2 ×2.", cuaNguoi(60).getMoTa());
    }

    @Test
    @DisplayName("X3: phiếu chưa giao ai, không có hàng phải cất → không ai nhận")
    void x3_khongNguoiNhat_khongCatKe() {
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(null), don(), GiaiDoanHuy.DANG_NHAT, Map.of(), false);
        assertTrue(daLuu().isEmpty());
    }

    @Test
    @DisplayName("X3: có hàng phải cất nhưng kho không có quản lý, phiếu chưa giao ai → quản trị viên")
    void x3_khongQuanLy_quanTriNhanThay() {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        xuatKho.donHuyTrongPhieuNhat(phieuNhat(null), don(), GiaiDoanHuy.DANG_NHAT, catKe("POLO-X", 1), false);
        assertEquals(Set.of(1, 2), nguoiNhan());
    }

    @Test
    @DisplayName("cauCatKe: tối đa 3 mã ghi từng mã, nhiều hơn thì ghi tổng; số lẻ dùng dấu phẩy")
    void cauCatKe() {
        assertEquals("Cất về kệ: A ×1, B ×2,5, C ×3.", ThongBaoXuatKhoService.cauCatKe(catKe("A", 1, "B", "2.50", "C", 3)));
        assertEquals("Cất 10 sản phẩm (4 mã) về kệ.", ThongBaoXuatKhoService.cauCatKe(catKe("A", 1, "B", 2, "C", 3, "D", 4)));
    }

    // ══════════════════════════ B1 Sàn hủy đơn đã xuất ══════════════════════════

    @Test
    @DisplayName("B1: sàn hủy đơn đã xuất → quản trị viên + quản lý kho xuất (+ người lập nếu có)")
    void b1_sanHuyDaXuat() {
        DonBanHang d = don();
        d.setNguoiTao(NguoiDung.builder().id(80).build());
        xuatKho.sanHuyDonDaXuat(d, "Hủy từ sàn Shopify: customer");

        // Quản lý kho không nhận lúc này: được báo khi đơn được ghi nhận hoàn trả
        assertEquals(Set.of(1, 2, 80), nguoiNhan());
        ThongBao t = cuaNguoi(1);
        assertEquals("Shopify hủy đơn SO0815 đã xuất kho", t.getTieuDe());
        assertEquals("Lý do: khách hủy. Nhận lại hàng hoàn rồi bấm Ghi nhận hoàn trả.", t.getMoTa());
        assertEquals(ThongBaoService.TONE_DANGER, t.getTone());
        assertEquals("/sales-orders/90", t.getDuongDan());
        assertEquals("DBH:90:SAN_HUY_DA_XUAT", t.getKhoaSuKien());
        assertEquals("Bán hàng", ThongBaoService.dong(t).getNhom());
    }

    @Test
    @DisplayName("B1: đồng bộ chạy lại → người đã có thông báo cùng khóa thì bỏ qua")
    void b1_chayLai_khongTrung() {
        when(thongBaoRepo.nguoiDaCoSuKien(eq("DBH:90:SAN_HUY_DA_XUAT"), any())).thenReturn(List.of(1, 2, 21));
        xuatKho.sanHuyDonDaXuat(don(), "Hủy từ sàn Lazada");
        assertTrue(daLuu().isEmpty());
    }

    @Test
    @DisplayName("B1: đơn đã ở Hoàn trả (hàng đã về) → không báo")
    void b1_daHoanTra_khongBao() {
        DonBanHang d = don();
        d.setTrangThai(com.dev.backend.constant.variables.ITrangThaiDonBanHang.BI_HOAN_TRA);
        xuatKho.sanHuyDonDaXuat(d, "Hủy từ sàn Lazada");
        verifyNoInteractions(thongBaoRepo);
    }

    @Test
    @DisplayName("Lý do dài có emoji ở chỗ cắt → không để lại nửa ký tự")
    void catKhongVoEmoji() {
        // "Lý do: " 7 ký tự + 491 = 498: emoji đầu tiên nằm đúng ô 498–499, chỗ cắt (giữ 499 ký tự + "…")
        String lyDo = "a".repeat(491) + "😀".repeat(5);
        xuatKho.sanHuyDonDaXuat(don(), lyDo);
        String moTa = cuaNguoi(1).getMoTa();
        assertTrue(moTa.length() <= 500);
        assertTrue(moTa.endsWith("…"));
        assertFalse(Character.isHighSurrogate(moTa.charAt(moTa.length() - 2)), moTa);
    }

    @Test
    @DisplayName("lyDoHuySan: bỏ tiền tố job tự thêm, đổi mã Shopify, giữ lý do TikTok")
    void lyDoHuySan() {
        assertEquals("", ThongBaoXuatKhoService.lyDoHuySan("Hủy từ sàn Lazada"));
        assertEquals("", ThongBaoXuatKhoService.lyDoHuySan("Hủy từ sàn Shopify: "));
        assertEquals("", ThongBaoXuatKhoService.lyDoHuySan("Hủy từ sàn Shopify: other"));
        assertEquals("hết hàng", ThongBaoXuatKhoService.lyDoHuySan("Hủy từ sàn Shopify: inventory"));
        assertEquals("Khách đặt nhầm size", ThongBaoXuatKhoService.lyDoHuySan("Khách đặt nhầm size."));
        assertEquals("", ThongBaoXuatKhoService.lyDoHuySan(null));
    }

    // ══════════════════════════ K1 Kiểm kê lệch ══════════════════════════

    private DotKiemKe dot() {
        DotKiemKe d = new DotKiemKe();
        d.setId(15);
        d.setMaDotKiemKe("KK0005");
        d.setKho(cuaHang);
        return d;
    }

    @Test
    @DisplayName("K1: có lô lệch → quản lý kho (trừ người hoàn thành), kèm tổng thừa / thiếu")
    void k1_coLech() {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(21, 22));
        kiemKe.daHoanThanh(dot(), 2, new BigDecimal("1"), new BigDecimal("3"), nguoi(22, IRoleType.quan_ly_kho));

        assertEquals(Set.of(21), nguoiNhan());
        ThongBao t = cuaNguoi(21);
        assertEquals("Đợt kiểm kê KK0005 lệch 2 lô", t.getTieuDe());
        assertEquals("Cửa hàng 1: thừa 1, thiếu 3 sản phẩm. Tồn kho đã cập nhật theo số đếm.", t.getMoTa());
        assertEquals("/stock-take/15", t.getDuongDan());
        assertEquals("ton_kho", t.getLoai());
        assertEquals("Kiểm kê", ThongBaoService.dong(t).getNhom());
    }

    @Test
    @DisplayName("K1: không lô nào lệch → không gửi")
    void k1_khongLech() {
        kiemKe.daHoanThanh(dot(), 0, BigDecimal.ZERO, BigDecimal.ZERO, nguoi(60, IRoleType.nhan_vien_kho));
        verifyNoInteractions(thongBaoRepo);
    }

    @Test
    @DisplayName("K1: kho không có quản lý → quản trị viên")
    void k1_khongQuanLy() {
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        kiemKe.daHoanThanh(dot(), 1, BigDecimal.ZERO, new BigDecimal("2"), nguoi(60, IRoleType.nhan_vien_kho));
        assertEquals(Set.of(1, 2), nguoiNhan());
    }

    // ══════════════════════════ Chung ══════════════════════════

    @Test
    @DisplayName("Đang trong giao dịch: chỉ ghi sau commit; rollback thì không ghi")
    void sauCommit() {
        TransactionSynchronizationManager.initSynchronization();
        muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 1);
        assertTrue(daLuu().isEmpty());
        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) {
            s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }
        assertTrue(daLuu().isEmpty());
        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) s.afterCommit();
        assertEquals(Set.of(11, 12), nguoiNhan());
    }

    @Test
    @DisplayName("Tìm người nhận lỗi (CSDL) → không ném ra ngoài, không ghi")
    void loiKhongNem() {
        when(pqRepo.nguoiDungTheoKhoTai(any(), any(), any())).thenThrow(new RuntimeException("mất kết nối"));
        when(ndRepo.idDangHoatDongTheoVaiTro(any())).thenThrow(new RuntimeException("mất kết nối"));
        assertDoesNotThrow(() -> muaHang.yeuCauChoDuyet(yeuCau(), nguoi(40, IRoleType.nhan_vien_mua_hang), 1));
        assertDoesNotThrow(() -> xuatKho.sanHuyDonDaXuat(don(), null));
        assertDoesNotThrow(() -> kiemKe.daHoanThanh(dot(), 1, BigDecimal.ONE, BigDecimal.ZERO, null));
        assertTrue(daLuu().isEmpty());
    }

    @Test
    @DisplayName("Dữ liệu chụp lỗi (phiếu null) → không ném ra ngoài")
    void chupLoiKhongNem() {
        assertDoesNotThrow(() -> muaHang.yeuCauChoDuyet(null, null, 0));
        assertDoesNotThrow(() -> xuatKho.donHuyTrongPhieuNhat(null, don(), GiaiDoanHuy.DANG_NHAT, catKe("A", 1), false));
        assertDoesNotThrow(() -> kiemKe.daHoanThanh(null, 1, null, null, null));
        verifyNoInteractions(thongBaoRepo);
    }
}
