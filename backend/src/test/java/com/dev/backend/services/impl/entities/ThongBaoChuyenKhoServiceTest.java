package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.BienBanGiaoNhan;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuChuyenKho;
import com.dev.backend.entities.ThongBao;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.PhieuChuyenKhoRepository;
import com.dev.backend.repository.ThongBaoRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.invocation.Invocation;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Luật người nhận thông báo chuyển kho (SRS UC 7.2 bước 10 và A1 bước 4) và cách ghi: sau commit, giao dịch mới, bỏ
 * người thao tác, bỏ trùng, gọi lặp không tạo trùng, lỗi chỉ ghi log.
 * Kho: Kho tổng = 1, Cửa hàng 1 = 2 (kho nhận), Cửa hàng 2 = 3 (kho xuất của phiếu mẫu, để quản lý kho xuất khác Quản
 * lý Kho tổng). Người: quản trị viên 1, 2; Quản lý Kho tổng 11, 12; quản lý Cửa hàng 1: 21, 23; quản lý Cửa hàng 2: 31;
 * người tạo phiếu 22 (nhân viên Cửa hàng 1).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ThongBaoChuyenKhoServiceTest {

    private static final int KHO_TONG = 1, CUA_HANG = 2, CUA_HANG_2 = 3, PCK = 50;

    @Mock private ThongBaoRepository thongBaoRepo;
    @Mock private PlatformTransactionManager txManager;
    @Mock private PhanQuyenNguoiDungKhoRepository pqRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private KhoRepository khoRepo;
    @Mock private PhieuChuyenKhoRepository pckRepo;
    @Mock private DieuHanhHeThongService cauHinh;

    private ThongBaoChuyenKhoService service;
    private Kho khoTong, cuaHang, cuaHang2;

    @BeforeEach
    void setUp() {
        ThongBaoService thongBao = new ThongBaoService(thongBaoRepo, txManager);
        service = new ThongBaoChuyenKhoService(thongBao, pqRepo, ndRepo, khoRepo, pckRepo, cauHinh);

        khoTong = Kho.builder().id(KHO_TONG).tenKho("Kho tổng").loaiKho("kho_tong").build();
        cuaHang = Kho.builder().id(CUA_HANG).tenKho("Cửa hàng 1").loaiKho("cua_hang").build();
        cuaHang2 = Kho.builder().id(CUA_HANG_2).tenKho("Cửa hàng 2").loaiKho("cua_hang").build();
        when(khoRepo.findAllById(any())).thenReturn(List.of(khoTong, cuaHang, cuaHang2));

        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(11, 12));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(KHO_TONG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(11, 12));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(21, 23));
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG_2)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(31));
        when(ndRepo.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien)).thenReturn(List.of(1, 2));
        when(thongBaoRepo.nguoiDaCoSuKien(anyString(), any())).thenReturn(List.of());
        cheDo(null);
    }

    @AfterEach
    void donDongBo() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ══════════════════════════ Dữ liệu và tiện ích ══════════════════════════

    private PhieuChuyenKho phieu(String trangThai) {
        return PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-202610281")
                .khoXuat(cuaHang2).khoNhap(cuaHang).trangThai(trangThai)
                .nguoiTao(NguoiDung.builder().id(22).build()).build();
    }

    private static NguoiDung nguoi(int id, String vaiTro) {
        return NguoiDung.builder().id(id).vaiTro(vaiTro).hoTen("Người " + id).build();
    }

    private void cheDo(String giaTri) {
        when(cauHinh.getCauHinhString(eq(DieuHanhHeThongServiceImpl.CAU_HINH_CHUYEN_KHO_QUYEN_XU_LY_LECH), anyString()))
                .thenReturn(giaTri == null ? IChuyenKho.XU_LY_LECH_QL_KHO_TONG : giaTri);
    }

    /** Các thông báo đã lưu (mỗi người một lần save, trong giao dịch riêng). */
    private List<ThongBao> daLuu() {
        List<ThongBao> tatCa = new ArrayList<>();
        for (Invocation lan : mockingDetails(thongBaoRepo).getInvocations()) {
            if ("save".equals(lan.getMethod().getName())) tatCa.add(lan.getArgument(0));
        }
        return tatCa;
    }

    private Set<Integer> nguoiNhan() {
        List<ThongBao> ds = daLuu();
        Set<Integer> ids = new TreeSet<>();
        ds.forEach(t -> ids.add(t.getNguoiNhanId()));
        assertEquals(ids.size(), ds.size(), "mỗi người nhận chỉ một thông báo");
        return ids;
    }

    private ThongBao motThongBao() {
        List<ThongBao> ds = daLuu();
        assertFalse(ds.isEmpty(), "phải có thông báo");
        return ds.get(0);
    }

    // ══════════════════════════ Tạo / giao bù → Quản lý Kho tổng ══════════════════════════

    @Test
    @DisplayName("Tạo phiếu: Quản lý Kho tổng nhận, người tạo không nhận; câu có số phiếu, đường dẫn và khóa sự kiện")
    void choDuyet_quanLyKhoTong() {
        service.choDuyet(phieu(IChuyenKho.CHO_DUYET), nguoi(21, IRoleType.quan_ly_kho));

        assertEquals(Set.of(11, 12), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("phe_duyet", t.getLoai());
        assertEquals("info", t.getTone());
        assertEquals("Phiếu chuyển PX-TRF-202610281 chờ duyệt", t.getTieuDe());
        assertTrue(t.getMoTa().startsWith("Cửa hàng 2 → Cửa hàng 1"), t.getMoTa());
        assertEquals("/transfer-tickets/50", t.getDuongDan());
        assertEquals("phieu_chuyen_kho", t.getLoaiThamChieu());
        assertEquals(PCK, t.getIdThamChieu());
        assertEquals("PCK:50:CHO_DUYET", t.getKhoaSuKien());
        assertNotNull(t.getNgayTao());
        assertFalse(t.getDaDoc());
    }

    @Test
    @DisplayName("Quản lý Kho tổng tự tạo phiếu (đẩy hàng): chỉ Quản lý Kho tổng còn lại nhận")
    void choDuyet_quanLyKhoTongTuTao_boNguoiThaoTac() {
        service.choDuyet(phieu(IChuyenKho.CHO_DUYET), nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(12), nguoiNhan());
    }

    @Test
    @DisplayName("Phiếu giao bù (Chờ duyệt): Quản lý Kho tổng nhận, câu nêu phiếu gốc")
    void choDuyet_giaoBu_neuPhieuGoc() {
        PhieuChuyenKho bu = phieu(IChuyenKho.CHO_DUYET);
        bu.setId(51);
        bu.setSoPhieuChuyen("PX-TRF-202610282");
        bu.setPhieuGoc(PhieuChuyenKho.builder().id(PCK).build());
        when(pckRepo.findById(PCK)).thenReturn(Optional.of(PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-202610281").build()));

        service.choDuyet(bu, nguoi(1, IRoleType.quan_tri_vien));

        assertEquals(Set.of(11, 12), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("Phiếu giao bù PX-TRF-202610282 chờ duyệt", t.getTieuDe());
        assertTrue(t.getMoTa().startsWith("Giao bù cho PX-TRF-202610281: Cửa hàng 2 → Cửa hàng 1"), t.getMoTa());
        assertEquals("PCK:51:CHO_DUYET", t.getKhoaSuKien());
        assertEquals("/transfer-tickets/51", t.getDuongDan());
    }

    // ══════════════════════════ Duyệt → quản lý kho xuất + người tạo ══════════════════════════

    @Test
    @DisplayName("Duyệt: quản lý kho xuất và người tạo nhận; kho nhận, Quản lý Kho tổng khác, quản trị viên không nhận")
    void daDuyet_khoXuatVaNguoiTao() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        p.setSoLenhDieuDong("LDD-20261028-003");

        service.daDuyet(p, nguoi(11, IRoleType.quan_ly_kho));

        assertEquals(Set.of(22, 31), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("success", t.getTone());
        assertEquals("Phiếu chuyển PX-TRF-202610281 đã được duyệt", t.getTieuDe());
        assertEquals("Lệnh điều động LDD-20261028-003. Cửa hàng 2 nhặt và xuất hàng cho Cửa hàng 1.", t.getMoTa());
        assertEquals("PCK:50:DUYET", t.getKhoaSuKien());
        verify(ndRepo, never()).idDangHoatDongTheoVaiTro(any());
    }

    @Test
    @DisplayName("Duyệt phiếu cũ không lưu người tạo: chỉ quản lý kho xuất nhận")
    void daDuyet_phieuCuKhongCoNguoiTao() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        p.setNguoiTao(null);
        service.daDuyet(p, nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(31), nguoiNhan());
    }

    // ══════════════════════════ Hủy / từ chối ══════════════════════════

    @Test
    @DisplayName("Từ chối: Quản lý Kho tổng hủy phiếu Chờ duyệt của người khác → \"bị từ chối\", báo người tạo + quản lý kho nhận, không báo kho xuất")
    void daHuy_choDuyet_quanLyKhoTong_tuChoi() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        p.setLyDoHuy("Kho tổng hết hàng");

        service.daHuy(p, IChuyenKho.CHO_DUYET, nguoi(11, IRoleType.quan_ly_kho));

        assertEquals(Set.of(21, 22, 23), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("Phiếu chuyển PX-TRF-202610281 bị từ chối", t.getTieuDe());
        assertEquals("danger", t.getTone());
        assertEquals("Cửa hàng 2 → Cửa hàng 1. Lý do: Kho tổng hết hàng.", t.getMoTa());
        assertEquals("PCK:50:HUY", t.getKhoaSuKien());
    }

    @Test
    @DisplayName("Từ chối: quản trị viên hủy phiếu Chờ duyệt cũng ghi \"bị từ chối\"")
    void daHuy_choDuyet_quanTriVien_tuChoi() {
        service.daHuy(phieu(IChuyenKho.DA_HUY), IChuyenKho.CHO_DUYET, nguoi(1, IRoleType.quan_tri_vien));
        assertEquals("Phiếu chuyển PX-TRF-202610281 bị từ chối", motThongBao().getTieuDe());
        assertEquals(Set.of(21, 22, 23), nguoiNhan());
    }

    @Test
    @DisplayName("Người tạo tự hủy phiếu Chờ duyệt → \"đã hủy\", người tạo không nhận, quản lý kho nhận nhận")
    void daHuy_nguoiTaoTuHuy_daHuy() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        p.setNguoiTao(NguoiDung.builder().id(21).build());

        service.daHuy(p, IChuyenKho.CHO_DUYET, nguoi(21, IRoleType.quan_ly_kho));

        assertEquals(Set.of(23), nguoiNhan(), "người tạo cũng là quản lý kho nhận: bỏ cả hai lần (người thao tác)");
        ThongBao t = motThongBao();
        assertEquals("Phiếu chuyển PX-TRF-202610281 đã hủy", t.getTieuDe());
        assertEquals("warning", t.getTone());
        assertEquals("Cửa hàng 2 → Cửa hàng 1.", t.getMoTa(), "không có lý do thì không ghi Lý do");
    }

    @Test
    @DisplayName("Quản lý kho nhận (không phải người tạo) hủy phiếu Chờ duyệt → \"bị từ chối\": mọi người không phải người tạo")
    void daHuy_quanLyKhoNhanHuy_khongPhaiNguoiTao_tuChoi() {
        service.daHuy(phieu(IChuyenKho.DA_HUY), IChuyenKho.CHO_DUYET, nguoi(23, IRoleType.quan_ly_kho));
        assertEquals("Phiếu chuyển PX-TRF-202610281 bị từ chối", motThongBao().getTieuDe());
        assertEquals(Set.of(21, 22), nguoiNhan());
        verify(pqRepo, never()).nguoiDungTheoLoaiKhoTai(any(), any(), any());
    }

    @Test
    @DisplayName("Phiếu cũ không lưu người tạo bị hủy khi Chờ duyệt → \"bị từ chối\", chỉ quản lý kho nhận nhận")
    void daHuy_phieuCuKhongCoNguoiTao() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        p.setNguoiTao(null);
        service.daHuy(p, IChuyenKho.CHO_DUYET, nguoi(11, IRoleType.quan_ly_kho));
        assertEquals("Phiếu chuyển PX-TRF-202610281 bị từ chối", motThongBao().getTieuDe());
        assertEquals(Set.of(21, 23), nguoiNhan());
    }

    @Test
    @DisplayName("Hủy phiếu Đã duyệt: thêm quản lý kho xuất; câu \"đã hủy\" (không phải từ chối) dù người hủy là Kho tổng")
    void daHuy_daDuyet_themKhoXuat() {
        service.daHuy(phieu(IChuyenKho.DA_HUY), IChuyenKho.DA_DUYET, nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(21, 22, 23, 31), nguoiNhan());
        assertEquals("Phiếu chuyển PX-TRF-202610281 đã hủy", motThongBao().getTieuDe());
    }

    @Test
    @DisplayName("Hủy khi đang vận chuyển: thêm quản lý kho xuất, câu nhắc kho xuất nhập hoàn trả")
    void daHuy_dangVanChuyen_nhacNhapHoanTra() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        p.setLyDoHuy("Xe hỏng");

        service.daHuy(p, IChuyenKho.DANG_VAN_CHUYEN, nguoi(11, IRoleType.quan_ly_kho));

        assertEquals(Set.of(21, 22, 23, 31), nguoiNhan());
        assertEquals("Cửa hàng 2 → Cửa hàng 1. Lý do: Xe hỏng. Hàng đang trên đường, Cửa hàng 2 nhập hoàn trả.",
                motThongBao().getMoTa());
    }

    // ══════════════════════════ Xác nhận xuất → quản lý kho nhận ══════════════════════════

    @Test
    @DisplayName("Xác nhận xuất: quản lý kho nhận nhận, kèm giờ dự kiến đến theo giờ Việt Nam")
    void daXuat_khoNhan_gioDuKien() {
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        p.setNgayDuKienDen(Instant.parse("2026-10-29T08:30:00Z"));

        service.daXuat(p, nguoi(31, IRoleType.quan_ly_kho));

        assertEquals(Set.of(21, 23), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("Phiếu chuyển PX-TRF-202610281 đang trên đường đến", t.getTieuDe());
        assertEquals("Từ Cửa hàng 2, dự kiến đến 15:30 29/10/2026.", t.getMoTa());
        assertEquals("PCK:50:XUAT", t.getKhoaSuKien());
        assertEquals(CUA_HANG, t.getKhoId());
    }

    @Test
    @DisplayName("Xác nhận xuất không hẹn giờ đến: câu ghi chưa hẹn giờ")
    void daXuat_khongHenGio() {
        service.daXuat(phieu(IChuyenKho.DANG_VAN_CHUYEN), nguoi(31, IRoleType.nhan_vien_kho));
        assertEquals("Từ Cửa hàng 2, chưa hẹn giờ đến.", motThongBao().getMoTa());
    }

    // ══════════════════════════ Nhận lệch → người xử lý chênh lệch theo cấu hình ══════════════════════════

    private BienBanGiaoNhan bienBan() {
        return BienBanGiaoNhan.builder().id(70).soBienBan("BBGN-20261028-001").tongSoLuongThieu(2).tongSoLuongHong(1).build();
    }

    @Test
    @DisplayName("Nhận lệch, mặc định QL_KHO_TONG: Quản lý Kho tổng nhận; quản lý kho xuất, quản trị viên không")
    void nhanLech_macDinh_quanLyKhoTong() {
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));

        assertEquals(Set.of(11, 12), nguoiNhan());
        ThongBao t = motThongBao();
        assertEquals("warning", t.getTone());
        assertEquals("Phiếu chuyển PX-TRF-202610281 nhận lệch, chờ xử lý", t.getTieuDe());
        assertEquals("Biên bản BBGN-20261028-001: thiếu 2, hỏng 1. Chọn ghi giảm hao hụt hoặc giao bù.", t.getMoTa());
        assertEquals("PCK:50:NHAN_LECH", t.getKhoaSuKien());
    }

    @Test
    @DisplayName("Nhận lệch, QL_KHO_TONG_VA_KHO_XUAT: thêm quản lý kho xuất")
    void nhanLech_themKhoXuat() {
        cheDo(IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT);
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(11, 12, 31), nguoiNhan());
    }

    @Test
    @DisplayName("Nhận lệch, QL_KHO_TONG_VA_KHO_XUAT khi kho xuất là Kho tổng: không nhận hai lần")
    void nhanLech_khoXuatLaKhoTong_khongTrung() {
        cheDo(IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT);
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        p.setKhoXuat(khoTong);
        service.nhanLech(p, bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(11, 12), nguoiNhan());
    }

    @Test
    @DisplayName("Nhận lệch, CHI_QUAN_TRI: chỉ quản trị viên đang hoạt động nhận (chỉ họ xử lý được)")
    void nhanLech_chiQuanTri() {
        cheDo(IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI);
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(1, 2), nguoiNhan());
        verify(pqRepo, never()).nguoiDungTheoLoaiKhoTai(any(), any(), any());
    }

    @Test
    @DisplayName("Nhận lệch, cấu hình giá trị lạ: theo mặc định Quản lý Kho tổng")
    void nhanLech_cauHinhLa_macDinh() {
        cheDo("KHONG_RO");
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(11, 12), nguoiNhan());
    }

    // ══════════════════════════ Ghi: trùng, lỗi, sau commit ══════════════════════════

    @Test
    @DisplayName("Gọi lặp cùng sự kiện: người đã có thông báo cùng khóa không nhận thêm; tất cả đã có thì không ghi")
    void goiLap_khongTaoTrung() {
        when(thongBaoRepo.nguoiDaCoSuKien(eq("PCK:50:DUYET"), any())).thenReturn(List.of(31));
        service.daDuyet(phieu(IChuyenKho.DA_DUYET), nguoi(11, IRoleType.quan_ly_kho));
        assertEquals(Set.of(22), nguoiNhan());

        reset(thongBaoRepo);
        when(thongBaoRepo.nguoiDaCoSuKien(eq("PCK:50:DUYET"), any())).thenReturn(List.of(22, 31));
        service.daDuyet(phieu(IChuyenKho.DA_DUYET), nguoi(11, IRoleType.quan_ly_kho));
        verify(thongBaoRepo, never()).save(any());
    }

    @Test
    @DisplayName("Không có ai nhận (chỉ người thao tác): không truy vấn trùng, không ghi, không chuyển sang quản trị viên")
    void khongAiNhan_khongGhi() {
        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of(11));
        service.choDuyet(phieu(IChuyenKho.CHO_DUYET), nguoi(11, IRoleType.quan_ly_kho));
        verify(thongBaoRepo, never()).nguoiDaCoSuKien(any(), any());
        verify(thongBaoRepo, never()).save(any());
        verify(ndRepo, never()).idDangHoatDongTheoVaiTro(any());
    }

    // ══════════════════════════ Kho tổng không có quản lý → quản trị viên ══════════════════════════

    @Test
    @DisplayName("Kho tổng không có quản lý nào đang hiệu lực: phiếu chờ duyệt / giao bù gửi quản trị viên đang hoạt động")
    void choDuyet_khoTongKhongCoQuanLy_guiQuanTri() {
        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        service.choDuyet(phieu(IChuyenKho.CHO_DUYET), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(1, 2), nguoiNhan());
        assertEquals("PCK:50:CHO_DUYET", motThongBao().getKhoaSuKien());

        // Quản trị viên tự tạo: các quản trị viên còn lại nhận
        reset(thongBaoRepo);
        service.choDuyet(phieu(IChuyenKho.CHO_DUYET), nguoi(1, IRoleType.quan_tri_vien));
        assertEquals(Set.of(2), nguoiNhan());
    }

    @Test
    @DisplayName("Nhận lệch, mặc định QL_KHO_TONG, Kho tổng không có quản lý: gửi quản trị viên")
    void nhanLech_macDinh_khoTongKhongCoQuanLy_guiQuanTri() {
        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(1, 2), nguoiNhan());
        assertEquals("PCK:50:NHAN_LECH", motThongBao().getKhoaSuKien());
    }

    @Test
    @DisplayName("Nhận lệch, QL_KHO_TONG_VA_KHO_XUAT, Kho tổng không có quản lý: quản lý kho xuất nhận; cả hai trống thì quản trị viên")
    void nhanLech_khoXuat_khoTongKhongCoQuanLy() {
        cheDo(IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT);
        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(31), nguoiNhan(), "còn quản lý kho xuất xử lý được: không cần quản trị viên");
        verify(ndRepo, never()).idDangHoatDongTheoVaiTro(any());

        reset(thongBaoRepo);
        when(pqRepo.nguoiDungTheoKhoTai(eq(List.of(CUA_HANG_2)), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), bienBan(), nguoi(21, IRoleType.quan_ly_kho));
        assertEquals(Set.of(1, 2), nguoiNhan());
    }

    @Test
    @DisplayName("Kho tổng không có quản lý: các sự kiện không gửi Quản lý Kho tổng (duyệt, xuất) không chuyển sang quản trị viên")
    void suKienKhac_khongChuyenQuanTri() {
        when(pqRepo.nguoiDungTheoLoaiKhoTai(eq("kho_tong"), eq(IRoleType.quan_ly_kho), any())).thenReturn(List.of());
        service.daDuyet(phieu(IChuyenKho.DA_DUYET), nguoi(11, IRoleType.quan_ly_kho));
        service.daXuat(phieu(IChuyenKho.DANG_VAN_CHUYEN), nguoi(31, IRoleType.quan_ly_kho));
        assertEquals(Set.of(21, 22, 23, 31), new TreeSet<>(daLuu().stream().map(ThongBao::getNguoiNhanId).toList()));
        verify(ndRepo, never()).idDangHoatDongTheoVaiTro(any());
    }

    @Test
    @DisplayName("Lỗi ghi thông báo (bảng chưa tạo), lỗi tìm người nhận, phiếu null: chỉ ghi log, không ném lỗi ra nghiệp vụ")
    void loiGhi_khongNemRa() {
        when(thongBaoRepo.nguoiDaCoSuKien(anyString(), any()))
                .thenThrow(new InvalidDataAccessResourceUsageException("Table 'fashion_system.thong_bao' doesn't exist"));
        assertDoesNotThrow(() -> service.daDuyet(phieu(IChuyenKho.DA_DUYET), nguoi(11, IRoleType.quan_ly_kho)));
        verify(txManager).rollback(any());

        when(pqRepo.nguoiDungTheoKhoTai(any(), any(), any())).thenThrow(new IllegalStateException("CSDL mất kết nối"));
        assertDoesNotThrow(() -> service.daXuat(phieu(IChuyenKho.DANG_VAN_CHUYEN), nguoi(31, IRoleType.quan_ly_kho)));
        assertDoesNotThrow(() -> service.choDuyet(null, nguoi(1, IRoleType.quan_tri_vien)));
        assertDoesNotThrow(() -> service.nhanLech(phieu(IChuyenKho.CHO_XU_LY_LECH), null, null));
    }

    @Test
    @DisplayName("Trong giao dịch nghiệp vụ: không đọc / ghi CSDL; chỉ ghi sau commit, trong giao dịch REQUIRES_NEW; rollback thì không ghi")
    void chiGhiSauCommit_giaoDichMoi() {
        TransactionSynchronizationManager.initSynchronization();
        service.daDuyet(phieu(IChuyenKho.DA_DUYET), nguoi(11, IRoleType.quan_ly_kho));

        verifyNoInteractions(thongBaoRepo, pqRepo, khoRepo, ndRepo, txManager);
        List<TransactionSynchronization> dangCho = TransactionSynchronizationManager.getSynchronizations();
        assertEquals(1, dangCho.size());

        // Rollback: chỉ afterCompletion, không afterCommit → không ghi
        dangCho.forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(thongBaoRepo, txManager);

        // Commit → soạn trong một giao dịch mới, rồi mỗi người nhận ghi trong một giao dịch mới riêng
        dangCho.forEach(TransactionSynchronization::afterCommit);
        ArgumentCaptor<TransactionDefinition> dinhNghia = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager, times(3)).getTransaction(dinhNghia.capture());
        assertTrue(dinhNghia.getAllValues().stream()
                .allMatch(d -> d.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(txManager, times(3)).commit(any());
        verify(txManager, never()).rollback(any());
        assertEquals(Set.of(22, 31), nguoiNhan());
    }
}
