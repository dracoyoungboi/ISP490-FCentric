package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.TepTin;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.TepTinRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class TepTinService extends BaseServiceImpl<TepTin, Integer> {

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private MinioService minioService;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public TepTinService(TepTinRepository repository) {
        super(repository);
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> hardDelete(Integer id) {

        Optional<TepTin> tepTin = getOne(id);

        if (tepTin.isEmpty()) {
            throw new CommonException(ThongDiep.of("heThong.tepTinKhongTimThay", id));
        }

        minioService.delete(tepTin.get().getTenLuuTru());

        delete(id);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .error(null)
                        .data("Success")
                        .message("Success").build());
    }

    @Transactional
    public void hardDeleteNoMessage(Integer id) {
        Optional<TepTin> tepTin = getOne(id);

        if (tepTin.isEmpty()) {
            throw new CommonException(ThongDiep.of("heThong.tepTinKhongTimThay", id));
        }

        minioService.delete(tepTin.get().getTenLuuTru());

        delete(id);
    }
}
