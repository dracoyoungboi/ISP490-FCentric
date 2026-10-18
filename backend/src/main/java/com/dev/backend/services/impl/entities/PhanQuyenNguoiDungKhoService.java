package com.dev.backend.services.impl.entities;


import com.dev.backend.dto.response.entities.KhoPhuTrachInfoDto;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
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
}
