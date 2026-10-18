package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.ChiTietQuyenKhoCreating;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.mapper.ChiTietQuyenKhoMapper;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.services.impl.entities.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * B1 · Lỗi đã biết (18/10/2026): bỏ tick quyền trong popup "Thêm phân quyền kho" không thu hồi được quyền.
 *
 * Các test này khẳng định HÀNH VI ĐÚNG, nên hiện đang ĐỎ. Sửa xong (API lưu đủ tập quyền, quyền vắng mặt
 * thì trang_thai = 0 và ghi lịch sử) thì phải XANH. CSDL thay bằng danh sách trong bộ nhớ qua Mockito.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PhanQuyenLoiDaBietTest {

    @Mock private KhoService khoService;
    @Mock private NguoiDungService nguoiDungService;
    @Mock private QuyenHanService quyenHanService;
    @Mock private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Mock private ChiTietQuyenKhoService chiTietQuyenKhoService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungMapper nguoiDungMapper;
    @Mock private ChiTietQuyenKhoMapper chiTietQuyenKhoMapper;
    @Spy private ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @InjectMocks
    private DieuHanhHeThongServiceImpl service;

    private final List<PhanQuyenNguoiDungKho> bangPhanQuyen = new ArrayList<>();
    private final List<ChiTietQuyenKho> bangChiTiet = new ArrayList<>();
    private final List<LichSuThayDoi> bangLichSu = new ArrayList<>();
    private static final List<Integer> MAU_NHAN_VIEN_KHO = List.of(1, 2, 4, 7, 12, 15);

    @BeforeEach
    void setUp() {
        NguoiDung admin = NguoiDung.builder().id(1).tenDangNhap("admin").vaiTro("quan_tri_vien").trangThai(1).build();
        NguoiDung nhanVien = NguoiDung.builder().id(52).tenDangNhap("nhanvienkhotong").vaiTro("nhan_vien_kho").trangThai(1).build();
        Kho khoTong = Kho.builder().id(22).maKho("KHO_TONG").tenKho("Kho tổng").trangThai(1).build();
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).vaiTro(Set.of("quan_tri_vien")).build());

        when(nguoiDungService.getOne(1)).thenReturn(Optional.of(admin));
        when(nguoiDungService.getOne(52)).thenReturn(Optional.of(nhanVien));
        when(nguoiDungService.update(anyInt(), any(NguoiDung.class))).thenAnswer(i -> i.getArgument(1));
        when(khoService.getOne(22)).thenReturn(Optional.of(khoTong));
        when(quyenHanService.getOne(anyInt())).thenAnswer(i -> {
            int id = i.getArgument(0);
            return Optional.of(QuyenHan.builder().id(id).maQuyen("q" + id).tenQuyen("q" + id).nhomQuyen("x").build());
        });

        when(phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(anyInt())).thenAnswer(i -> bangPhanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)) && Integer.valueOf(1).equals(p.getTrangThai()))
                .collect(Collectors.toList()));
        when(phanQuyenNguoiDungKhoService.findByNguoiDungIdAndKhoId(anyInt(), anyInt())).thenAnswer(i -> bangPhanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)) && p.getKho().getId().equals(i.getArgument(1)))
                .findFirst());
        when(phanQuyenNguoiDungKhoService.create(any(PhanQuyenNguoiDungKho.class))).thenAnswer(i -> {
            PhanQuyenNguoiDungKho p = i.getArgument(0);
            p.setId(100 + bangPhanQuyen.size());
            if (p.getChiTietQuyenKhos() == null) p.setChiTietQuyenKhos(new LinkedHashSet<>());
            bangPhanQuyen.add(p);
            return p;
        });
        when(phanQuyenNguoiDungKhoService.update(anyInt(), any(PhanQuyenNguoiDungKho.class))).thenAnswer(i -> i.getArgument(1));

        when(chiTietQuyenKhoService.findByPhanQuyenNguoiDungKhoIdAndQuyenHanId(anyInt(), anyInt())).thenAnswer(i -> bangChiTiet.stream()
                .filter(c -> c.getPhanQuyenNguoiDungKho().getId().equals(i.getArgument(0)) && c.getQuyenHan().getId().equals(i.getArgument(1)))
                .findFirst());
        when(chiTietQuyenKhoService.create(any(ChiTietQuyenKho.class))).thenAnswer(i -> {
            ChiTietQuyenKho c = i.getArgument(0);
            c.setId(1000 + bangChiTiet.size());
            bangChiTiet.add(c);
            // Như JPA ở request sau: tập chiTietQuyenKhos (mappedBy, lazy) đọc lại từ CSDL sẽ có dòng này
            if (c.getPhanQuyenNguoiDungKho().getChiTietQuyenKhos() != null) c.getPhanQuyenNguoiDungKho().getChiTietQuyenKhos().add(c);
            return c;
        });
        when(chiTietQuyenKhoService.update(anyInt(), any(ChiTietQuyenKho.class))).thenAnswer(i -> i.getArgument(1));
        when(lichSuThayDoiService.create(any(LichSuThayDoi.class))).thenAnswer(i -> {
            bangLichSu.add(i.getArgument(0));
            return i.getArgument(0);
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    /** Gửi đúng payload mà AssignWarehousePermissionModal.jsx đang gửi: chỉ quyền đang tick, trangThai = 1. */
    private void ganNhuPopup(List<Integer> quyenDangTick) {
        Set<ChiTietQuyenKhoCreating> ds = quyenDangTick.stream()
                .map(id -> new ChiTietQuyenKhoCreating(id, 1)).collect(Collectors.toCollection(LinkedHashSet::new));
        service.ganQuyenNhanVienKho(PhanQuyenNguoiDungKhoCreating.builder()
                .nguoiDungId(52).khoId(22).laQuanLyKho(0).ngayBatDau(Instant.now()).chiTietQuyenKhos(ds).build());
    }

    private List<Integer> quyenDangBat() {
        return bangChiTiet.stream().filter(c -> Integer.valueOf(1).equals(c.getTrangThai()))
                .map(c -> c.getQuyenHan().getId()).sorted().collect(Collectors.toList());
    }

    private static List<Integer> tu1Den23() {
        List<Integer> l = new ArrayList<>();
        for (int i = 1; i <= 23; i++) l.add(i);
        return l;
    }

    @Test
    @DisplayName("B1 · Bỏ tick 17 quyền rồi lưu: chỉ còn 6 quyền đang bật")
    void boTickQuyen_quyenKhongConTrongDanhSach_phaiBiThuHoi() {
        ganNhuPopup(tu1Den23());
        assertEquals(23, quyenDangBat().size(), "Chuẩn bị: lần đầu gán 23 quyền");

        ganNhuPopup(MAU_NHAN_VIEN_KHO);

        assertEquals(MAU_NHAN_VIEN_KHO, quyenDangBat(), "Quyền bị bỏ tick phải chuyển trang_thai = 0");
    }

    @Test
    @DisplayName("B1 · Thu hồi quyền phải được ghi vào lịch sử thay đổi")
    void thuHoiQuyen_phaiGhiLichSu() {
        ganNhuPopup(tu1Den23());
        int truoc = bangLichSu.size();

        ganNhuPopup(MAU_NHAN_VIEN_KHO);

        long soDongThuHoi = bangLichSu.subList(truoc, bangLichSu.size()).stream()
                .filter(l -> l.getGiaTriMoi() != null && l.getGiaTriMoi().contains("\"trangThai\":0")).count();
        assertEquals(17, soDongThuHoi, "Mỗi quyền bị thu hồi phải có một dòng lịch sử");
    }

    @Test
    @DisplayName("Đối chứng · Gán lần đầu 6 quyền thì có đúng 6 quyền")
    void doiChung_ganLanDau() {
        ganNhuPopup(MAU_NHAN_VIEN_KHO);
        assertEquals(MAU_NHAN_VIEN_KHO, quyenDangBat());
    }
}
