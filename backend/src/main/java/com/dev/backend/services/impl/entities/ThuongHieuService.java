package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.ThuongHieuCreating;
import com.dev.backend.dto.request.ThuongHieuUpdating;
import com.dev.backend.dto.response.entities.ThuongHieuDto;
import com.dev.backend.entities.ThuongHieu;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ThuongHieuMapper;
import com.dev.backend.repository.ThuongHieuRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@Slf4j
public class ThuongHieuService extends BaseServiceImpl<ThuongHieu, Integer> {

    private final ThuongHieuRepository repository;
    private final ThuongHieuMapper mapper;
    private final EntityManager entityManager;

    @Autowired
    private MinioService minioService;

    @Autowired
    public ThuongHieuService(ThuongHieuRepository repository,
                             ThuongHieuMapper mapper,
                             EntityManager entityManager) {
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
    }

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    // Lấy toàn bộ danh sách thương hiệu (kèm trạng thái) cho selector/dropdown
    public List<ThuongHieuDto> getAllDtos() {
        return mapper.toDtoList(repository.findAll(Sort.by(Sort.Direction.ASC, "tenThuongHieu")));
    }

    // Tạo mới thương hiệu
    @Transactional
    public ThuongHieuDto create(ThuongHieuCreating creating) {
        String ma = creating.getMaThuongHieu().trim();
        String ten = creating.getTenThuongHieu().trim();

        if (repository.existsByMaThuongHieu(ma)) {
            throw new CommonException("Mã thương hiệu đã tồn tại");
        }

        ThuongHieu entity = mapper.toEntity(creating);
        entity.setMaThuongHieu(ma);
        entity.setTenThuongHieu(ten);
        entity.setMoTa(blankToNull(creating.getMoTa()));
        // Mặc định hoạt động nếu FE không truyền trạng thái
        entity.setTrangThai(creating.getTrangThai() == null ? 1 : creating.getTrangThai());

        return mapper.toDto(repository.save(entity));
    }

    // Cập nhật thương hiệu (partial update, bỏ qua field null)
    @Transactional
    public ThuongHieuDto update(Integer id, ThuongHieuUpdating updating) {

        ThuongHieu entity = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy thương hiệu với ID: " + id));

        // Nếu có sửa mã thì kiểm tra trùng (trừ chính bản ghi đang sửa)
        if (updating.getMaThuongHieu() != null
                && !updating.getMaThuongHieu().trim().isEmpty()
                && repository.existsByMaThuongHieuAndIdNot(updating.getMaThuongHieu().trim(), id)) {
            throw new CommonException("Mã thương hiệu đã tồn tại");
        }

        mapper.partialUpdate(updating, entity);

        // Trim mã/tên nếu được cập nhật
        if (updating.getMaThuongHieu() != null) {
            entity.setMaThuongHieu(updating.getMaThuongHieu().trim());
        }
        if (updating.getTenThuongHieu() != null) {
            entity.setTenThuongHieu(updating.getTenThuongHieu().trim());
        }

        return mapper.toDto(repository.save(entity));
    }

    // Upload logo lên MinIO và lưu đường dẫn công khai vào logo_url
    @Transactional
    public ThuongHieuDto updateLogo(Integer id, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CommonException("Không tìm thấy tệp logo");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new CommonException("Tệp logo phải là ảnh");
        }
        try {
            ThuongHieu entity = repository.findById(id)
                    .orElseThrow(() -> new CommonException("Không tìm thấy thương hiệu với ID: " + id));

            String objectName = minioService.upload(file);
            String publicUrl = minioService.getPublicUrl(objectName);

            // Xóa object cũ best-effort (không để rác MinIO khi thay logo)
            String oldUrl = entity.getLogoUrl();
            if (oldUrl != null && !oldUrl.isBlank()) {
                try {
                    String oldObjectName = oldUrl.substring(oldUrl.lastIndexOf('/') + 1);
                    if (!oldObjectName.isBlank()) {
                        minioService.delete(oldObjectName);
                    }
                } catch (Exception e) {
                    log.warn("Không xóa được logo cũ của thương hiệu id {}: {}", id, e.getMessage());
                }
            }

            entity.setLogoUrl(publicUrl);
            return mapper.toDto(repository.save(entity));
        } catch (CommonException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi upload logo thương hiệu lên MinIO", e);
            throw new CommonException("Không thể tải logo lên, vui lòng thử lại");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}