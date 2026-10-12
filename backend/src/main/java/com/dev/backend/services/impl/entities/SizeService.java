package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.Size;
import com.dev.backend.repository.SizeRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SizeService extends BaseServiceImpl<Size, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public SizeService(SizeRepository repository) {
        super(repository);
    }

    /** Toàn bộ kích cỡ theo thứ tự hiển thị chuẩn (thu_tu_sap_xep, cùng thứ tự thì theo id). */
    public List<Size> getAllTheoThuTu() {
        return repository.findAll(Sort.by("thuTuSapXep").and(Sort.by("id")));
    }
}
