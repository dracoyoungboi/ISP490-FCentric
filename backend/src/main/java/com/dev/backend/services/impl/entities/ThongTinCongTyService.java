package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.variables.IPrintTemplateConfig;
import com.dev.backend.dto.request.ThongTinCongTyRequest;
import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.services.MinioService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.regex.Pattern;

/**
 * Hồ sơ công ty dùng chung (bảng một dòng, id = 1).
 * Logo tải lên qua MinIO (pattern SanPhamQuanAoService) và lưu đường dẫn
 * công khai vào logo_duong_dan.
 */
@Service
@Slf4j
public class ThongTinCongTyService {

    @Autowired
    private ThongTinCongTyRepository thongTinCongTyRepository;
    @Autowired
    private MinioService minioService;
    @Autowired
    private TepTinService tepTinService;

    private static final int PROFILE_ID = 1;
    private static final int PROFILE_VERSION = 1;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+\\-\\s()]{6,20}$");

    /** Đọc hồ sơ; chưa có dòng nào trong DB -> trả hồ sơ mặc định (không persist). */
    public ThongTinCongTyDto getProfile() {
        return thongTinCongTyRepository.findById(PROFILE_ID)
                .map(this::toDto)
                .orElseGet(() -> ThongTinCongTyDto.builder()
                        .id(PROFILE_ID)
                        .name("FCentric")
                        .logoAsset(IPrintTemplateConfig.DEFAULT_LOGO_PATH)
                        .version(PROFILE_VERSION)
                        .build());
    }

    /** Cập nhật thông tin (không đổi logo). */
    @Transactional
    public ThongTinCongTyDto updateProfile(ThongTinCongTyRequest req) {
        if (req == null) {
            throw new CommonException("Hồ sơ công ty không được để trống");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new CommonException("Tên công ty không được để trống");
        }
        if (req.getName().length() > 255) {
            throw new CommonException("Tên công ty không được quá 255 ký tự");
        }
        if (req.getEmail() != null && !req.getEmail().isBlank() && !EMAIL.matcher(req.getEmail().trim()).matches()) {
            throw new CommonException("Email công ty không hợp lệ");
        }
        if (req.getPhone() != null && !req.getPhone().isBlank() && !PHONE.matcher(req.getPhone().trim()).matches()) {
            throw new CommonException("Số điện thoại công ty không hợp lệ");
        }

        ThongTinCongTy entity = thongTinCongTyRepository.findById(PROFILE_ID)
                .orElseGet(() -> ThongTinCongTy.builder().id(PROFILE_ID).build());
        entity.setTenCongTy(req.getName().trim());
        entity.setEmail(blankToNull(req.getEmail()));
        entity.setSoDienThoai(blankToNull(req.getPhone()));
        entity.setDiaChi(blankToNull(req.getAddress()));
        entity.setVersion(PROFILE_VERSION);
        entity.setNgayCapNhat(Instant.now());
        return toDto(thongTinCongTyRepository.save(entity));
    }

    /**
     * Upload logo qua MinIO rồi lưu metadata vào tep_tin (chuẩn như ảnh sản phẩm).
     * Thay logo: upload tệp mới TRƯỚC, xóa tệp cũ (dòng tep_tin + object MinIO) SAU.
     */
    @Transactional
    public ThongTinCongTyDto updateLogo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CommonException("Không tìm thấy tệp logo");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new CommonException("Tệp logo phải là ảnh");
        }
        try {
            ThongTinCongTy entity = thongTinCongTyRepository.findById(PROFILE_ID)
                    .orElseGet(() -> ThongTinCongTy.builder().id(PROFILE_ID).build());
            if (entity.getTenCongTy() == null || entity.getTenCongTy().isBlank()) {
                entity.setTenCongTy("FCentric");
            }

            TepTin tepTinCu = entity.getTepTin();

            // Upload object mới lên MinIO và tạo dòng tep_tin tương ứng
            String objectName = minioService.upload(file);
            String duoiTep = minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension");
            TepTin tepTinMoi = tepTinService.create(TepTin.builder()
                    .tenTepGoc(objectName)
                    .tenTaiLen(objectName)
                    .tenLuuTru(objectName)
                    .duongDan(minioService.getPublicUrl(objectName))
                    .loaiTepTin(FileType.IMAGE.toString())
                    .duoiTep(duoiTep)
                    .trangThai(1)
                    .ngayTao(Instant.now())
                    .build());

            entity.setTepTin(tepTinMoi);
            entity.setVersion(PROFILE_VERSION);
            entity.setNgayCapNhat(Instant.now());
            ThongTinCongTy saved = thongTinCongTyRepository.save(entity);

            // Xóa tệp cũ (dòng tep_tin + object MinIO) sau khi đã gắn tệp mới thành công
            if (tepTinCu != null) {
                tepTinService.hardDeleteNoMessage(tepTinCu.getId());
            }

            return toDto(saved);
        } catch (CommonException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi upload logo lên MinIO", e);
            throw new CommonException("Không thể tải logo lên, vui lòng thử lại");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ThongTinCongTyDto toDto(ThongTinCongTy entity) {
        // Logo ưu tiên từ tep_tin (chuẩn quản lý tệp); fallback cột cũ logo_duong_dan, rồi asset mặc định
        String logoAsset = entity.getTepTin() != null && entity.getTepTin().getDuongDan() != null
                ? entity.getTepTin().getDuongDan()
                : (entity.getLogoDuongDan() != null ? entity.getLogoDuongDan() : IPrintTemplateConfig.DEFAULT_LOGO_PATH);
        return ThongTinCongTyDto.builder()
                .id(entity.getId())
                .name(entity.getTenCongTy())
                .logoAsset(logoAsset)
                .email(entity.getEmail())
                .phone(entity.getSoDienThoai())
                .address(entity.getDiaChi())
                .version(entity.getVersion())
                .ngayCapNhat(entity.getNgayCapNhat())
                .build();
    }
}
