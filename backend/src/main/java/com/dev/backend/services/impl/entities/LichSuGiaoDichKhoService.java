package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.LichSuGiaoDichKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.LichSuGiaoDichKhoMapper;
import com.dev.backend.repository.LichSuGiaoDichKhoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

@Service
@RequiredArgsConstructor
public class LichSuGiaoDichKhoService {

    private final LichSuGiaoDichKhoRepository repository;
    private final LichSuGiaoDichKhoMapper mapper;

    /**
     * Lấy danh sách lịch sử giao dịch theo phân quyền:
     *  - quan_tri_vien  → xem tất cả
     *  - quan_ly_kho    → chỉ xem kho mình được phân quyền (phan_quyen_nguoi_dung_kho, trangThai=1)
     *  - nhan_vien_kho  → chỉ xem kho mình được phân công (phan_quyen_nguoi_dung_kho, trangThai=1)
     */
    @Transactional(readOnly = true)
    public List<LichSuGiaoDichKhoDto> getAll() {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();

        boolean isAdmin    = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        boolean isQuanLy   = currentUser.getVaiTro().contains(IRoleType.quan_ly_kho);
        boolean isNhanVien = currentUser.getVaiTro().contains(IRoleType.nhan_vien_kho);

        List<LichSuGiaoDichKho> result;

        if (isAdmin) {
            result = repository.findAllWithDetails();

        } else if (isQuanLy) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByQuanLyId(currentUser.getId());

        } else if (isNhanVien) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByNhanVienId(currentUser.getId());

        } else {
            throw new CommonException(ThongDiep.of("chungTuKho.khongCoQuyenTruyCap"));
        }

        return result.stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LichSuGiaoDichKhoDto getChiTiet(Integer id) {
        LichSuGiaoDichKho entity = repository.findByIdWithDetails(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("chungTuKho.lichSuKhongTimThay", id)));
        return mapper.toDto(entity);
    }

    @Transactional
    public LichSuGiaoDichKho create(LichSuGiaoDichKho entity) {
        return repository.save(entity);
    }
}