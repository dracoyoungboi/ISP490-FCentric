package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.KhoCreating;
import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Người quản lý chính của kho (Kho.quanLy tính từ dấu la_quan_ly_kho trên phân quyền): đổi ở form Sửa kho chỉ khi ô đổi,
 * chỉ chọn quản lý kho đang làm việc tại kho, kho ảo và kho mới không có người quản lý.
 */
class KhoServiceQuanLyChinhTest {

    private KhoRepository khoRepository;
    private PhanQuyenNguoiDungKhoRepository pqRepo;
    private EntityManager entityManager;
    private NguoiDungService nguoiDungService;
    private KhoService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        khoRepository = mock(KhoRepository.class);
        pqRepo = mock(PhanQuyenNguoiDungKhoRepository.class);
        entityManager = mock(EntityManager.class);
        nguoiDungService = mock(NguoiDungService.class);
        TypedQuery<Kho> khoTongKhac = mock(TypedQuery.class, RETURNS_SELF);
        when(khoTongKhac.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(anyString(), eq(Kho.class))).thenReturn(khoTongKhac);
        when(khoRepository.save(any(Kho.class))).thenAnswer(i -> i.getArgument(0));

        service = new KhoService(khoRepository);
        ReflectionTestUtils.setField(service, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoRepository", pqRepo);
        ReflectionTestUtils.setField(service, "khoMapper", mock(KhoMapper.class));
    }

    private static NguoiDung nguoi(int id, String vaiTro, int trangThai) {
        return NguoiDung.builder().id(id).hoTen("Người " + id).vaiTro(vaiTro).trangThai(trangThai).build();
    }

    /** Kho có người quản lý chính {@code quanLy}: cả ảnh lúc nạp (Kho.quanLy) lẫn câu đọc bản mới nhất sau khi khóa. */
    private Kho kho(int id, String ma, NguoiDung quanLy) {
        Kho k = Kho.builder().id(id).maKho(ma).tenKho("Kho " + ma).loaiKho(KhoService.KHO_BAN_HANG).trangThai(1)
                .quanLy(quanLy).build();
        when(khoRepository.findById(id)).thenReturn(Optional.of(k));
        when(khoRepository.findByMaKho(ma)).thenReturn(Optional.of(k));
        quanLyMoiNhat(id, quanLy);
        return k;
    }

    /** Câu đọc FOR SHARE trả người quản lý chính mới nhất (có thể khác ảnh lúc nạp kho). */
    private void quanLyMoiNhat(int khoId, NguoiDung quanLy) {
        List<Object[]> dong = quanLy == null ? List.of() : List.<Object[]>of(new Object[]{900 + quanLy.getId(), quanLy.getId()});
        when(pqRepo.dauQuanLyChinhMoiNhat(eq(khoId), any())).thenReturn(dong);
        if (quanLy != null) when(nguoiDungService.getOne(quanLy.getId())).thenReturn(Optional.of(quanLy));
    }

    private static KhoUpdating sua(Kho k, Integer quanLyId, Integer quanLyIdBanDau) {
        return KhoUpdating.builder().id(k.getId()).maKho(k.getMaKho()).tenKho(k.getTenKho()).diaChi("—")
                .loaiKho(KhoService.KHO_BAN_HANG).quanLyId(quanLyId).quanLyIdBanDau(quanLyIdBanDau).build();
    }

    private void lamViecTai(NguoiDung nd, int pqId, Kho k) {
        when(nguoiDungService.getOne(nd.getId())).thenReturn(Optional.of(nd));
        PhanQuyenNguoiDungKho pq = PhanQuyenNguoiDungKho.builder().id(pqId).nguoiDung(nd).kho(k).trangThai(1).build();
        when(pqRepo.findHieuLucTai(eq(nd.getId()), any())).thenReturn(List.of(pq));
    }

    @Test
    void oNguoiQuanLyKhongDoi_thiKhongDungToiDau() {
        Kho k = kho(3, "KHO01", nguoi(5, IRoleType.quan_ly_kho, 1));

        service.update(sua(k, 5, 5));

        verify(pqRepo, never()).boDauQuanLyChinhCuaKho(any());
        verify(pqRepo, never()).datDauQuanLyChinh(any());
    }

    @Test
    void formMoTuTruoc_khongDungO_thiGiuNguoiHienTai() {
        // Lúc mở form người quản lý là 5; người khác đã đổi thành 6; form chỉ sửa tên, gửi lại 5
        Kho k = kho(3, "KHO01", nguoi(6, IRoleType.quan_ly_kho, 1));

        assertDoesNotThrow(() -> service.update(sua(k, 5, 5)));

        verify(pqRepo, never()).boDauQuanLyChinhCuaKho(any());
    }

    @Test
    void formMoTuTruoc_coDoiO_maNguoiKhacVuaDoi_thiBaoXungDot() {
        Kho k = kho(3, "KHO01", nguoi(6, IRoleType.quan_ly_kho, 1));

        CommonException loi = assertThrows(CommonException.class, () -> service.update(sua(k, 8, 5)));

        assertTrue(loi.getMessage().contains("vừa được người khác thay đổi"), loi.getMessage());
        verify(khoRepository, never()).save(any());
        verify(pqRepo, never()).boDauQuanLyChinhCuaKho(any());
    }

    @Test
    void haiQuanTriVienDoiCungLuc_nguoiSauThayBanMoiNhatSauKhiKhoa_thiBaoXungDot() {
        // Ảnh lúc nạp kho còn ghi 5 (khớp form), nhưng sau khi khóa kho đọc bản mới nhất thì người kia đã đổi thành 6
        Kho k = kho(3, "KHO01", nguoi(5, IRoleType.quan_ly_kho, 1));
        quanLyMoiNhat(3, nguoi(6, IRoleType.quan_ly_kho, 1));

        CommonException loi = assertThrows(CommonException.class, () -> service.update(sua(k, 8, 5)));

        assertTrue(loi.getMessage().contains("vừa được người khác thay đổi"), loi.getMessage());
        InOrder thuTu = inOrder(entityManager, pqRepo);
        thuTu.verify(entityManager).lock(k, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(pqRepo).dauQuanLyChinhMoiNhat(eq(3), any());
        verify(pqRepo, never()).boDauQuanLyChinhCuaKho(any());
    }

    @Test
    void chonQuanLyKhoDangLamTaiKho_thiBoDauCuRoiGanDauMoi() {
        Kho k = kho(3, "KHO01", null);
        lamViecTai(nguoi(7, IRoleType.quan_ly_kho, 1), 70, k);

        service.update(sua(k, 7, null));

        InOrder thuTu = inOrder(entityManager, pqRepo);
        thuTu.verify(entityManager).lock(k, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(pqRepo).boDauQuanLyChinhCuaKho(3);
        thuTu.verify(pqRepo).datDauQuanLyChinh(70);
        thuTu.verify(entityManager).refresh(k);
    }

    @Test
    void boTrongNguoiQuanLy_thiChiBoDau() {
        Kho k = kho(3, "KHO01", nguoi(5, IRoleType.quan_ly_kho, 1));

        service.update(sua(k, null, 5));

        verify(pqRepo).boDauQuanLyChinhCuaKho(3);
        verify(pqRepo, never()).datDauQuanLyChinh(any());
    }

    @Test
    void tuChoiNguoiSaiVaiTro_biKhoa_hoacKhongLamTaiKho() {
        Kho k = kho(3, "KHO01", null);
        Kho khac = Kho.builder().id(4).maKho("KHO02").build();

        lamViecTai(nguoi(7, IRoleType.nhan_vien_kho, 1), 70, k);
        assertTrue(assertThrows(CommonException.class, () -> service.update(sua(k, 7, null)))
                .getMessage().contains("không có vai trò Quản lý kho"));

        lamViecTai(nguoi(8, IRoleType.quan_ly_kho, 0), 80, k);
        assertTrue(assertThrows(CommonException.class, () -> service.update(sua(k, 8, null)))
                .getMessage().contains("đang bị khóa"));

        lamViecTai(nguoi(9, IRoleType.quan_ly_kho, 1), 90, khac);
        assertTrue(assertThrows(CommonException.class, () -> service.update(sua(k, 9, null)))
                .getMessage().contains("chưa được phân làm việc tại"));

        verify(pqRepo, never()).boDauQuanLyChinhCuaKho(any());
    }

    @Test
    void khoAo_khongCoNguoiQuanLy() {
        Kho ao = kho(2, "KHO_TRANSIT", null);
        lamViecTai(nguoi(7, IRoleType.quan_ly_kho, 1), 70, ao);

        CommonException loi = assertThrows(CommonException.class, () -> service.update(sua(ao, 7, null)));

        assertTrue(loi.getMessage().contains("không có người quản lý"));
        assertEquals(List.of(), service.ungVienQuanLy(2));
        verify(pqRepo, never()).nguoiDungTheoKhoVaVaiTroTai(any(), any(), any());
    }

    @Test
    void ungVien_laQuanLyKhoDangLamTaiKho() {
        kho(3, "KHO01", null);
        NguoiDung an = nguoi(7, IRoleType.quan_ly_kho, 1);
        when(pqRepo.nguoiDungTheoKhoVaVaiTroTai(eq(3), eq(Set.of(IRoleType.quan_ly_kho)), any())).thenReturn(List.of(an));

        assertEquals(List.of(an), service.ungVienQuanLy(3));
    }

    @Test
    void taoKho_khongNhanNguoiQuanLy() {
        KhoCreating tao = KhoCreating.builder().maKho("KHO09").tenKho("Kho mới 09").diaChi("—").quanLyId(5).trangThai(1).build();

        CommonException loi = assertThrows(CommonException.class, () -> service.create(tao));

        assertTrue(loi.getMessage().contains("Kho mới chưa có ai làm việc"));
        verify(khoRepository, never()).save(any());
    }
}
