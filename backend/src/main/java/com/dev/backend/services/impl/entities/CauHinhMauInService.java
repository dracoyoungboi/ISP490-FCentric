package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IPrintTemplateConfig;
import com.dev.backend.dto.request.MigratePrintConfigsRequest;
import com.dev.backend.dto.request.PrintTemplateConfigRequest;
import com.dev.backend.dto.response.PrintConfigBundleDto;
import com.dev.backend.dto.response.PrintTemplateConfigDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.CauHinhMauIn;
import com.dev.backend.entities.MauInDangApDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhMauInRepository;
import com.dev.backend.repository.MauInDangApDungRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Cấu hình mẫu in: đọc/ghi cấu hình từng biến thể + mẫu đang áp dụng.
 * - Mỗi (documentType, templateId) là một biến thể riêng; khổ giấy phải
 *   khớp hậu tố của templateId nên A5 không thể lưu dưới id A4.
 * - mau_in_dang_ap_dung có PK = documentType -> đúng 1 mẫu đang áp dụng
 *   cho mỗi loại chứng từ (đổi mẫu = upsert theo PK).
 * - migrate chỉ nhận dữ liệu của loại chứng từ CHƯA có cấu hình trên server.
 */
@Service
@Slf4j
public class CauHinhMauInService {

    @Autowired
    private CauHinhMauInRepository cauHinhMauInRepository;
    @Autowired
    private MauInDangApDungRepository mauInDangApDungRepository;
    @Autowired
    private ObjectMapper objectMapper;

    private static final int CONFIG_VERSION = 2;
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    // ── Đọc ────────────────────────────────────────────────────────────────

    public PrintConfigBundleDto getBundle() {
        List<PrintTemplateConfigDto> configs = new ArrayList<>();
        for (CauHinhMauIn entity : cauHinhMauInRepository.findAll()) {
            configs.add(toDto(entity));
        }
        Map<String, String> active = new HashMap<>();
        for (MauInDangApDung row : mauInDangApDungRepository.findAll()) {
            active.put(row.getDocumentType(), row.getTemplateId());
        }
        return PrintConfigBundleDto.builder().configs(configs).active(active).build();
    }

    public List<PrintTemplateConfigDto> getByDocumentType(String documentType) {
        validateDocumentType(documentType);
        List<PrintTemplateConfigDto> templates = new ArrayList<>();
        for (CauHinhMauIn entity : cauHinhMauInRepository.findAllByDocumentType(documentType)) {
            templates.add(toDto(entity));
        }
        return templates;
    }

    public String getActiveTemplateId(String documentType) {
        validateDocumentType(documentType);
        return mauInDangApDungRepository.findById(documentType)
                .map(MauInDangApDung::getTemplateId)
                .orElse(null);
    }

    // ── Ghi ────────────────────────────────────────────────────────────────

    @Transactional
    public PrintTemplateConfigDto upsertConfig(String documentType, String templateId, PrintTemplateConfigRequest req) {
        validateDocumentType(documentType);
        validateTemplateIdForSave(documentType, templateId);
        validateConfig(req, templateId);

        CauHinhMauIn entity = cauHinhMauInRepository
                .findByDocumentTypeAndTemplateId(documentType, templateId)
                .orElseGet(CauHinhMauIn::new);
        entity.setDocumentType(documentType);
        entity.setTemplateId(templateId);
        entity.setName(req.getName().trim());
        entity.setPaperSize(req.getPaperSize());
        entity.setOrientation(req.getOrientation());
        entity.setMargin(req.getMargin());
        entity.setAccentColor(req.getAccentColor());
        entity.setBrandingJson(writeJson(req.getBranding()));
        entity.setSectionsJson(writeJson(req.getSections()));
        entity.setColumnsJson(writeJson(req.getColumns()));
        entity.setVersion(CONFIG_VERSION);
        entity.setNgayCapNhat(Instant.now());
        entity.setNguoiCapNhatId(currentUserId());
        CauHinhMauIn saved = cauHinhMauInRepository.save(entity);

        // Mô hình một-mẫu: LƯU CẤU HÌNH = biến thể này trở thành mẫu dùng cho in
        // thật (không cần bước kích hoạt riêng). Upsert theo PK document_type
        // nên mỗi loại chứng từ luôn có đúng một biến thể đang dùng.
        MauInDangApDung active = mauInDangApDungRepository.findById(documentType)
                .orElseGet(() -> MauInDangApDung.builder().documentType(documentType).build());
        active.setTemplateId(templateId);
        active.setNgayCapNhat(Instant.now());
        active.setNguoiCapNhatId(currentUserId());
        mauInDangApDungRepository.save(active);

        return toDto(saved);
    }

    /** Xóa cấu hình đã lưu của một biến thể -> quay về mặc định registry. KHÔNG đụng bảng active. */
    @Transactional
    public void resetConfig(String documentType, String templateId) {
        validateDocumentType(documentType);
        cauHinhMauInRepository.findByDocumentTypeAndTemplateId(documentType, templateId)
                .ifPresent(cauHinhMauInRepository::delete);
    }

    /** Đặt mẫu đang áp dụng — upsert theo PK document_type nên luôn đúng 1 mẫu/loại chứng từ. */
    @Transactional
    public MauInDangApDung setActive(String documentType, String templateId) {
        validateDocumentType(documentType);
        boolean savedExists = cauHinhMauInRepository
                .findByDocumentTypeAndTemplateId(documentType, templateId).isPresent();
        if (!savedExists && !IPrintTemplateConfig.isRegistryTemplateId(documentType, templateId)) {
            throw new CommonException("Định danh mẫu không hợp lệ: " + templateId);
        }
        MauInDangApDung row = mauInDangApDungRepository.findById(documentType)
                .orElseGet(() -> MauInDangApDung.builder().documentType(documentType).build());
        row.setTemplateId(templateId);
        row.setNgayCapNhat(Instant.now());
        row.setNguoiCapNhatId(currentUserId());
        return mauInDangApDungRepository.save(row);
    }

    /**
     * Nhận dữ liệu legacy (localStorage cũ). Mỗi loại chứng từ chỉ được nhận
     * khi server CHƯA có cấu hình nào của loại đó — không bao giờ ghi đè dữ
     * liệu server bằng dữ liệu local. Sau đó điền mẫu đang áp dụng cho các
     * loại chưa có (từ active legacy, fallback <docType>_default_A4).
     */
    @Transactional
    public Map<String, Object> migrate(MigratePrintConfigsRequest req) {
        List<String> migrated = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> activeSet = new ArrayList<>();

        Map<String, Map<String, PrintTemplateConfigRequest>> configs =
                req.getConfigs() != null ? req.getConfigs() : Map.of();
        Map<String, String> activeMap = req.getActive() != null ? req.getActive() : Map.of();

        for (String documentType : IPrintTemplateConfig.PRINT_DOCUMENT_TYPES) {
            Map<String, PrintTemplateConfigRequest> typeConfigs = configs.get(documentType);
            if (typeConfigs == null || typeConfigs.isEmpty()) {
                continue; // Không có dữ liệu legacy của loại này
            }
            if (cauHinhMauInRepository.countByDocumentType(documentType) > 0) {
                skipped.add(documentType); // Server đã có dữ liệu — giữ nguyên, không ghi đè
                continue;
            }
            for (Map.Entry<String, PrintTemplateConfigRequest> entry : typeConfigs.entrySet()) {
                upsertConfig(documentType, entry.getKey(), entry.getValue());
            }
            migrated.add(documentType);
        }

        for (String documentType : IPrintTemplateConfig.PRINT_DOCUMENT_TYPES) {
            if (mauInDangApDungRepository.findById(documentType).isPresent()) {
                continue;
            }
            String candidate = activeMap.get(documentType);
            boolean candidateValid = candidate != null
                    && (cauHinhMauInRepository.findByDocumentTypeAndTemplateId(documentType, candidate).isPresent()
                    || IPrintTemplateConfig.isRegistryTemplateId(documentType, candidate));
            String templateId = candidateValid ? candidate : IPrintTemplateConfig.defaultTemplateId(documentType);
            MauInDangApDung row = MauInDangApDung.builder()
                    .documentType(documentType)
                    .templateId(templateId)
                    .ngayCapNhat(Instant.now())
                    .nguoiCapNhatId(currentUserId())
                    .build();
            mauInDangApDungRepository.save(row);
            activeSet.add(documentType);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("migrated", migrated);
        result.put("skipped", skipped);
        result.put("activeSet", activeSet);
        return result;
    }

    // ── Validate ───────────────────────────────────────────────────────────

    private void validateDocumentType(String documentType) {
        if (documentType == null || !IPrintTemplateConfig.PRINT_DOCUMENT_TYPES.contains(documentType)) {
            throw new CommonException("Loại chứng từ không hợp lệ: " + documentType);
        }
    }

    private void validateTemplateIdForSave(String documentType, String templateId) {
        if (templateId == null || templateId.isBlank()) {
            throw new CommonException("Định danh mẫu không được để trống");
        }
        boolean savedExists = cauHinhMauInRepository
                .findByDocumentTypeAndTemplateId(documentType, templateId).isPresent();
        if (!savedExists && !IPrintTemplateConfig.isRegistryTemplateId(documentType, templateId)) {
            throw new CommonException("Định danh mẫu không hợp lệ: " + templateId);
        }
    }

    private void validateConfig(PrintTemplateConfigRequest req, String templateId) {
        if (req == null) {
            throw new CommonException("Cấu hình mẫu in không được để trống");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new CommonException("Tên mẫu in không được để trống");
        }
        if (req.getName().length() > 200) {
            throw new CommonException("Tên mẫu in không được quá 200 ký tự");
        }
        if (req.getPaperSize() == null || !IPrintTemplateConfig.PAPER_SIZES.contains(req.getPaperSize())) {
            throw new CommonException("Khổ giấy không hợp lệ: " + req.getPaperSize());
        }
        // Chốt chặn lỗi "đổi khổ giấy giữ nguyên id": paperSize phải khớp hậu tố templateId
        if (!templateId.endsWith("_" + req.getPaperSize())) {
            throw new CommonException("Khổ giấy " + req.getPaperSize() + " không khớp với định danh mẫu " + templateId);
        }
        if (req.getOrientation() == null || !IPrintTemplateConfig.ORIENTATIONS.contains(req.getOrientation())) {
            throw new CommonException("Hướng giấy không hợp lệ: " + req.getOrientation());
        }
        if (req.getMargin() == null || !IPrintTemplateConfig.MARGINS.contains(req.getMargin())) {
            throw new CommonException("Lề giấy không hợp lệ: " + req.getMargin());
        }
        if (req.getAccentColor() == null || !HEX_COLOR.matcher(req.getAccentColor()).matches()) {
            throw new CommonException("Màu nhấn không hợp lệ (cần mã hex #RRGGBB)");
        }
        if (req.getSections() == null || req.getSections().isEmpty()) {
            throw new CommonException("Nội dung chứng từ (sections) không được để trống");
        }
    }

    // ── Mapper ─────────────────────────────────────────────────────────────

    private PrintTemplateConfigDto toDto(CauHinhMauIn entity) {
        return PrintTemplateConfigDto.builder()
                .documentType(entity.getDocumentType())
                .templateId(entity.getTemplateId())
                .name(entity.getName())
                .paperSize(entity.getPaperSize())
                .orientation(entity.getOrientation())
                .margin(entity.getMargin())
                .accentColor(entity.getAccentColor())
                .branding(readJson(entity.getBrandingJson(), new TypeReference<Map<String, Boolean>>() {}))
                .sections(readJson(entity.getSectionsJson(), new TypeReference<Map<String, Object>>() {}))
                .columns(readJson(entity.getColumnsJson(), new TypeReference<Map<String, Boolean>>() {}))
                .version(entity.getVersion())
                .ngayCapNhat(entity.getNgayCapNhat())
                .build();
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.error("Lỗi serialize JSON cấu hình mẫu in", e);
            throw new CommonException("Dữ liệu cấu hình mẫu in không hợp lệ");
        }
    }

    private <T> T readJson(String json, TypeReference<T> type) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            log.warn("JSON cấu hình mẫu in lỗi, bỏ qua: {}", json);
            return null;
        }
    }

    private Integer currentUserId() {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        return user != null ? user.getId() : null;
    }
}
