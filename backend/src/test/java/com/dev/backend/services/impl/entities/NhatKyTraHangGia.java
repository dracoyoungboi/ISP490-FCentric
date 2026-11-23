package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;

import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Nhật ký trả hàng NCC thật ({@link NhatKyTraHangNcc} + {@link NhatKyNghiepVu}) trên lich_su_thay_doi giả lưu trong danh
 * sách: test đọc lại đúng dữ liệu đã ghi (dựng DTO, cộng dồn số trừ tiền) thay vì mock từng câu đọc.
 */
final class NhatKyTraHangGia {

    final List<LichSuThayDoi> dong = new ArrayList<>();
    final Map<Integer, NguoiDung> nguoi = new HashMap<>();
    final LichSuThayDoiRepository repository = mock(LichSuThayDoiRepository.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final ObjectMapper objectMapper = new ObjectMapper();
    final NhatKyTraHangNcc nhatKy;

    NhatKyTraHangGia(NguoiDung... dsNguoi) {
        for (NguoiDung n : dsNguoi) nguoi.put(n.getId(), n);
        when(repository.save(any(LichSuThayDoi.class))).thenAnswer(inv -> {
            LichSuThayDoi d = inv.getArgument(0);
            if (d.getId() == null) d.setId(dong.size() + 1);
            dong.add(d);
            return d;
        });
        when(repository.findByLoaiThamChieuAndIdThamChieuInOrderByIdAsc(anyString(), anyCollection())).thenAnswer(inv -> {
            String loai = inv.getArgument(0);
            Collection<Integer> ids = inv.getArgument(1);
            return dong.stream().filter(d -> loai.equals(d.getLoaiThamChieu()) && ids.contains(d.getIdThamChieu()))
                    .sorted(Comparator.comparing(LichSuThayDoi::getId)).toList();
        });
        when(repository.findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                anyString(), any(), anyCollection())).thenAnswer(inv -> {
            String loai = inv.getArgument(0);
            Integer id = inv.getArgument(1);
            Collection<String> hanhDong = inv.getArgument(2);
            return dong.stream()
                    .filter(d -> loai.equals(d.getLoaiThamChieu()) && Objects.equals(id, d.getIdThamChieu())
                            && hanhDong.contains(d.getHanhDong()))
                    .max(Comparator.comparing(LichSuThayDoi::getNgayThucHien).thenComparing(LichSuThayDoi::getId));
        });
        when(entityManager.getReference(eq(NguoiDung.class), any())).thenAnswer(inv -> {
            Integer id = inv.getArgument(1);
            return nguoi.getOrDefault(id, NguoiDung.builder().id(id).build());
        });
        when(entityManager.getReference(eq(Kho.class), any()))
                .thenAnswer(inv -> Kho.builder().id(inv.<Integer>getArgument(1)).build());
        nhatKy = new NhatKyTraHangNcc(new NhatKyNghiepVu(repository, entityManager, objectMapper), repository, objectMapper);
    }

    /** Đăng nhập người có quyền xem mọi kho (nhật ký ghi người này là người thực hiện). */
    static void dangNhap(int id) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(id)
                .vaiTro(Set.of(IRoleType.quan_tri_vien)).phanQuyenNguoiDungKhos(List.of()).build());
    }

    /** Các dòng nhật ký của một biên bản theo hành động, cũ trước. */
    List<LichSuThayDoi> theo(Integer bienBanId, String hanhDong) {
        return dong.stream().filter(d -> Objects.equals(bienBanId, d.getIdThamChieu()) && hanhDong.equals(d.getHanhDong()))
                .toList();
    }

    Map<String, Object> moi(LichSuThayDoi d) {
        try {
            return d.getGiaTriMoi() == null ? Map.of()
                    : objectMapper.readValue(d.getGiaTriMoi(), new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
