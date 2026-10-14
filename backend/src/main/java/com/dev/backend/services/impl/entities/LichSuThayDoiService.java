package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LichSuThayDoiService extends BaseServiceImpl<LichSuThayDoi,Integer> {
    @Autowired
    private EntityManager entityManager;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public LichSuThayDoiService(LichSuThayDoiRepository repository) {
        super(repository);
    }

    /**
     * Ghi nhật ký trong giao dịch RIÊNG — dùng khi ghi sau commit (utils/SauCommit). Lúc afterCommit giao dịch
     * nghiệp vụ đã commit nhưng vẫn gắn với luồng, nên create() (REQUIRED) sẽ nhập vào giao dịch đó và
     * không bao giờ được commit (bản ghi mất mà không báo lỗi).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public LichSuThayDoi createGiaoDichRieng(LichSuThayDoi entity) {
        return repository.save(entity);
    }

}
