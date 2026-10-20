package com.dev.backend.services.impl.entities;


import com.dev.backend.dto.response.entities.KhoPhuTrachHieuLucDto;
import com.dev.backend.dto.response.entities.KhoPhuTrachInfoDto;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class PhanQuyenNguoiDungKhoService extends BaseServiceImpl<PhanQuyenNguoiDungKho, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public PhanQuyenNguoiDungKhoService(PhanQuyenNguoiDungKhoRepository repository) {
        super(repository);
    }

    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository = (PhanQuyenNguoiDungKhoRepository) getRepository();

    public List<PhanQuyenNguoiDungKho> findByNguoiDungIdAndActive(Integer id) {
        return phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndActive(id);
    }

    /** Phân quyền đang hoạt động, chưa hết hạn, kể cả chưa tới ngày bắt đầu (quy tắc tối đa một kho). */
    public List<PhanQuyenNguoiDungKho> findGiuChoByNguoiDungId(Integer id) {
        return phanQuyenNguoiDungKhoRepository.findGiuChoByNguoiDungId(id, java.time.Instant.now());
    }

    public Optional<PhanQuyenNguoiDungKho> findByNguoiDungIdAndKhoId(Integer nguoiDungId, Integer khoId) {
        return phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(nguoiDungId, khoId);
    }

    public List<KhoPhuTrachInfoDto> findActiveKhoInfoByNguoiDungId(Integer nguoiDungId) {
        return phanQuyenNguoiDungKhoRepository.findActiveKhoInfoByNguoiDungId(nguoiDungId);
    }

    /**
     * Kho phụ trách đang hiệu lực của từng người dùng (danh sách Người dùng), một truy vấn cho cả trang.
     * Người không có kho hiệu lực thì không có trong kết quả; dữ liệu cũ còn nhiều kho thì lấy kho đầu.
     */
    public Map<Integer, KhoPhuTrachHieuLucDto> layKhoPhuTrachHieuLucTheoNguoiDung(Collection<Integer> nguoiDungIds) {
        if (nguoiDungIds == null || nguoiDungIds.isEmpty()) {
            return Map.of();
        }
        Map<Integer, KhoPhuTrachHieuLucDto> ketQua = new HashMap<>();
        for (Object[] dong : phanQuyenNguoiDungKhoRepository.layKhoHieuLucTheoNguoiDung(nguoiDungIds, Instant.now())) {
            ketQua.putIfAbsent((Integer) dong[0], KhoPhuTrachHieuLucDto.builder()
                    .maKho((String) dong[1])
                    .tenKho((String) dong[2])
                    .ngayKetThuc((Instant) dong[3])
                    .build());
        }
        return ketQua;
    }
}
