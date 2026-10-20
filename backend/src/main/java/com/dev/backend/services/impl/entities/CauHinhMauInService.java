package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IPrintTemplateConfig;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.MigratePrintConfigsRequest;
import com.dev.backend.dto.request.PrintTemplateConfigRequest;
import com.dev.backend.dto.response.LichSuMauInDto;
import com.dev.backend.dto.response.PrintConfigBundleDto;
import com.dev.backend.dto.response.PrintTemplateConfigDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.CauHinhMauIn;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.MauInDangApDung;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhMauInRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.MauInDangApDungRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.utils.SauCommit;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Cấu hình mẫu in: đọc/ghi cấu hình từng biến thể + mẫu đang áp dụng.
 * - Mỗi (documentType, templateId) là một biến thể riêng; khổ giấy phải
 *   khớp hậu tố của templateId nên A5 không thể lưu dưới id A4.
 * - Chỉ lưu / kích hoạt biến thể frontend in được (IPrintTemplateConfig.isFrontendTemplateId).
 * - mau_in_dang_ap_dung có PK = documentType -> đúng 1 mẫu đang áp dụng
 *   cho mỗi loại chứng từ (đổi mẫu = upsert theo PK).
 * - migrate chỉ nhận dữ liệu của loại chứng từ CHƯA có cấu hình trên server.
 * - Mỗi lần lưu ghi một phiên bản vào lich_su_thay_doi (sau khi commit, giao dịch riêng): ảnh chụp
 *   cấu hình mới + cấu hình đang dùng ngay trước đó — nguồn của "Lịch sử chỉnh sửa" và "Khôi phục".
 *   Ghi lịch sử lỗi chỉ ghi log, không làm hỏng lần lưu.
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
    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;
    @Autowired
    private LichSuThayDoiRepository lichSuThayDoiRepository;
    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    private static final int CONFIG_VERSION = 2;
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    /** gia_tri_cu / gia_tri_moi là cột TEXT (tối đa 65.535 byte). */
    private static final int HISTORY_JSON_MAX_BYTES = 65_000;
    /**
     * Tổng byte JSON branding + sections + columns tối đa của một cấu hình: ảnh chụp lịch sử chứa cả ba
     * cộng tên mẫu và các trường ngắn (dưới 2.000 byte) nên luôn vừa HISTORY_JSON_MAX_BYTES.
     */
    private static final int CONFIG_JSON_MAX_BYTES = 60_000;

    // ── Đọc ────────────────────────────────────────────────────────────────

    public PrintConfigBundleDto getBundle() {
        List<PrintTemplateConfigDto> configs = new ArrayList<>();
        // Sắp theo id: frontend lấy "cấu hình đã lưu đầu tiên" theo thứ tự này khi biến thể đang áp dụng
        // chưa có cấu hình — phải khớp quy tắc activeSnapshotJson (id nhỏ nhất)
        for (CauHinhMauIn entity : cauHinhMauInRepository.findAll(Sort.by(Sort.Direction.ASC, "id"))) {
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

        // Ảnh chụp cấu hình đang dùng TRƯỚC khi ghi (có thể chính là dòng sắp sửa — chụp trước khi đổi)
        String truocKhiLuu = activeSnapshotJson(documentType);

        CauHinhMauIn entity = cauHinhMauInRepository
                .findByDocumentTypeAndTemplateId(documentType, templateId)
                .orElseGet(CauHinhMauIn::new);
        entity.setDocumentType(documentType);
        entity.setTemplateId(templateId);
        entity.setName(req.getName().trim());
        entity.setPaperSize(req.getPaperSize());
        // Khổ nhiệt luôn in khổ dọc (frontend ép dọc khi đọc và khi lưu) — quy về "portrait" thay vì chặn:
        // migrate localStorage cũ và tab còn frontend cũ vẫn có thể gửi "landscape" cho K80
        entity.setOrientation(IPrintTemplateConfig.THERMAL_PAPER_SIZES.contains(req.getPaperSize())
                ? "portrait" : req.getOrientation());
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

        ghiLichSu(saved, truocKhiLuu);
        return toDto(saved);
    }

    /**
     * Lịch sử chỉnh sửa mẫu in của một loại chứng từ (mọi biến thể khổ giấy), mới nhất trước,
     * tối đa {@link IPrintTemplateConfig#HISTORY_LIMIT} phiên bản.
     */
    @Transactional(readOnly = true)
    public List<LichSuMauInDto> getHistory(String documentType) {
        validateDocumentType(documentType);
        List<Integer> ids = new ArrayList<>();
        for (CauHinhMauIn entity : cauHinhMauInRepository.findAllByDocumentType(documentType)) {
            Integer id = idThamChieu(entity);
            if (id != null) ids.add(id);
        }
        List<LichSuMauInDto> result = new ArrayList<>();
        if (ids.isEmpty()) return result;
        List<LichSuThayDoi> rows = lichSuThayDoiRepository
                .findByLoaiThamChieuAndIdThamChieuInAndHanhDongOrderByNgayThucHienDescIdDesc(
                        ITable.cau_hinh_mau_in, ids, IHanhDong.cap_nhat_mau_in,
                        PageRequest.of(0, IPrintTemplateConfig.HISTORY_LIMIT));
        for (LichSuThayDoi row : rows) {
            Map<String, Object> cauHinh = readJson(row.getGiaTriMoi(), new TypeReference<Map<String, Object>>() {});
            Map<String, Object> cauHinhTruoc = readJson(row.getGiaTriCu(), new TypeReference<Map<String, Object>>() {});
            NguoiDung nguoi = row.getNguoiThucHien();
            Object templateId = cauHinh != null ? cauHinh.get("templateId") : null;
            result.add(LichSuMauInDto.builder()
                    .id(row.getId())
                    .luc(row.getNgayThucHien())
                    .nguoiThucHien(nguoi != null ? nguoi.getHoTen() : null)
                    .vaiTro(nguoi != null ? nguoi.getVaiTro() : null)
                    .templateId(templateId instanceof String ? (String) templateId : null)
                    .cauHinh(cauHinh)
                    .cauHinhTruoc(cauHinhTruoc)
                    .build());
        }
        return result;
    }

    /** Xóa cấu hình đã lưu của một biến thể -> quay về mặc định registry. KHÔNG đụng bảng active. */
    @Transactional
    public void resetConfig(String documentType, String templateId) {
        validateDocumentType(documentType);
        cauHinhMauInRepository.findByDocumentTypeAndTemplateId(documentType, templateId)
                .ifPresent(cauHinhMauInRepository::delete);
    }

    /**
     * Đặt mẫu đang áp dụng — upsert theo PK document_type nên luôn đúng 1 mẫu/loại chứng từ.
     * Chỉ nhận biến thể frontend in được, kể cả khi DB còn dòng cũ khác khổ (vd. sales_invoice_default_K80
     * trước khi tách mẫu tại quầy): trỏ mẫu đang áp dụng vào biến thể đó thì frontend bỏ qua, không in.
     */
    @Transactional
    public MauInDangApDung setActive(String documentType, String templateId) {
        validateDocumentType(documentType);
        requireFrontendTemplateId(documentType, templateId);
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
     * loại chưa có (từ active legacy nếu frontend in được, fallback mẫu mặc định của loại —
     * IPrintTemplateConfig.defaultTemplateId).
     */
    @Transactional
    public Map<String, Object> migrate(MigratePrintConfigsRequest req) {
        List<String> migrated = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        // Mục cũ bị bỏ qua vì không qua được validate ("<documentType>/<templateId>"): frontend xóa localStorage
        // khi nhận 200 nên phải báo lại — không thì dữ liệu mục đó mất mà không ai biết
        List<String> invalid = new ArrayList<>();
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
            boolean daNhan = false;
            for (Map.Entry<String, PrintTemplateConfigRequest> entry : typeConfigs.entrySet()) {
                // Biến thể frontend không còn in (vd. sales_invoice_default_K80 trong localStorage do bản
                // frontend cũ gửi lên): bỏ qua thay vì để upsertConfig chặn làm hỏng cả lần chuyển dữ liệu
                if (!IPrintTemplateConfig.isFrontendTemplateId(documentType, entry.getKey())) {
                    log.warn("Bỏ qua cấu hình mẫu in cũ {}/{} khi chuyển dữ liệu: frontend không dùng biến thể này",
                            documentType, entry.getKey());
                    continue;
                }
                // Mục cũ không qua được validate (vd. vượt CONFIG_JSON_MAX_BYTES): bỏ qua như mục khác khổ thay
                // vì làm hỏng cả lần chuyển (frontend sẽ gửi lại mỗi lần mở trình sửa). Chỉ chạy các bước kiểm
                // tra thuần, TRƯỚC mọi lệnh ghi của mục này và không qua proxy giao dịch, nên lỗi bắt ở đây không
                // đánh dấu rollback giao dịch migrate; upsertConfig kiểm tra lại đúng các bước đó nên sẽ qua.
                try {
                    validateTemplateIdForSave(documentType, entry.getKey());
                    validateConfig(entry.getValue(), entry.getKey());
                } catch (CommonException e) {
                    log.warn("Bỏ qua cấu hình mẫu in cũ {}/{} khi chuyển dữ liệu: {}",
                            documentType, entry.getKey(), e.getMessage());
                    invalid.add(documentType + "/" + entry.getKey());
                    continue;
                }
                upsertConfig(documentType, entry.getKey(), entry.getValue());
                daNhan = true;
            }
            if (daNhan) migrated.add(documentType);
        }

        for (String documentType : IPrintTemplateConfig.PRINT_DOCUMENT_TYPES) {
            if (mauInDangApDungRepository.findById(documentType).isPresent()) {
                continue;
            }
            String candidate = activeMap.get(documentType);
            // Như setActive: chỉ nhận biến thể frontend in được, kể cả khi DB còn dòng cũ khác khổ
            boolean candidateValid = IPrintTemplateConfig.isFrontendTemplateId(documentType, candidate);
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
        result.put("invalid", invalid);
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
        // Lưu = biến thể này thành mẫu đang áp dụng, nên chỉ nhận biến thể frontend in được (khớp paperProfiles
        // của printSchemas.js): pos_invoice_default_A4, sales_invoice_default_K57… (gọi API thẳng, tab còn
        // frontend cũ) không bao giờ được in. Chặn cả dòng cũ khác khổ còn trong DB (vd. sales_invoice_default_K80
        // trước khi tách mẫu tại quầy): frontend hiện tại không còn luồng nào gửi định danh đó.
        requireFrontendTemplateId(documentType, templateId);
    }

    /**
     * Chỉ nhận biến thể frontend in được. Định danh đúng dạng registry nhưng khác khổ (tab còn frontend cũ
     * gửi sales_invoice_default_K80…) báo lỗi người dùng hiểu được thay vì lỗi kỹ thuật; vẫn là lỗi 400.
     * Gọi sau validateDocumentType (documentType khác null).
     */
    private static void requireFrontendTemplateId(String documentType, String templateId) {
        if (IPrintTemplateConfig.isFrontendTemplateId(documentType, templateId)) return;
        if (IPrintTemplateConfig.isRegistryTemplateId(documentType, templateId)) {
            throw new CommonException("Khổ giấy này không còn dùng cho loại chứng từ này. Tải lại trang rồi thử lại.");
        }
        throw new CommonException("Định danh mẫu không hợp lệ: " + templateId);
    }

    /**
     * Kiểm tra sections._tuyChinh — cùng giới hạn với trình sửa mẫu (frontend chặn trước, đây là chốt
     * chặn thật): chỉ các khóa đã biết, chuỗi đúng độ dài, cỡ chữ / mã số phiếu đúng giá trị, nhãn
     * "<section>.<mục>" không rỗng, tối đa 60 ký tự.
     */
    private void validateCustomOptions(Map<String, Object> sections) {
        if (sections == null || !sections.containsKey(IPrintTemplateConfig.CUSTOM_SECTION_KEY)) return;
        Object raw = sections.get(IPrintTemplateConfig.CUSTOM_SECTION_KEY);
        if (raw == null) return;
        if (!(raw instanceof Map<?, ?> custom)) {
            throw new CommonException("Tùy chỉnh mẫu in không hợp lệ");
        }
        for (Map.Entry<?, ?> entry : custom.entrySet()) {
            Object key = entry.getKey();
            Object value = entry.getValue();
            if (!(key instanceof String name) || !IPrintTemplateConfig.CUSTOM_OPTION_KEYS.contains(name)) {
                throw new CommonException("Tùy chỉnh mẫu in không hợp lệ: " + key);
            }
            if (value == null) continue;
            switch (name) {
                case "loiChanPhieu" -> requireText(value, IPrintTemplateConfig.FOOTER_NOTE_MAX_LENGTH,
                        "Lời chân phiếu không được quá " + IPrintTemplateConfig.FOOTER_NOTE_MAX_LENGTH + " ký tự");
                case "tieuDe" -> requireText(value, IPrintTemplateConfig.TITLE_MAX_LENGTH,
                        "Tiêu đề chứng từ không được quá " + IPrintTemplateConfig.TITLE_MAX_LENGTH + " ký tự");
                case "coChu" -> {
                    if (!(value instanceof String size) || !IPrintTemplateConfig.FONT_SIZES.contains(size)) {
                        throw new CommonException("Cỡ chữ không hợp lệ: " + value);
                    }
                }
                case "maSoPhieu" -> {
                    if (!(value instanceof String mode) || !IPrintTemplateConfig.DOC_CODE_MODES.contains(mode)) {
                        throw new CommonException("Kiểu mã số phiếu không hợp lệ: " + value);
                    }
                }
                case "nhan" -> validateLabels(value);
                default -> throw new CommonException("Tùy chỉnh mẫu in không hợp lệ: " + name);
            }
        }
    }

    private void validateLabels(Object value) {
        if (!(value instanceof Map<?, ?> labels)) {
            throw new CommonException("Nhãn tự đặt của mẫu in không hợp lệ");
        }
        if (labels.size() > IPrintTemplateConfig.MAX_CUSTOM_LABELS) {
            throw new CommonException("Mẫu in có quá nhiều nhãn tự đặt");
        }
        for (Map.Entry<?, ?> entry : labels.entrySet()) {
            if (!(entry.getKey() instanceof String key) || !IPrintTemplateConfig.LABEL_KEY.matcher(key).matches()) {
                throw new CommonException("Khóa nhãn không hợp lệ: " + entry.getKey());
            }
            if (!(entry.getValue() instanceof String label) || label.isBlank()) {
                throw new CommonException("Nhãn tự đặt không được để trống");
            }
            if (label.length() > IPrintTemplateConfig.LABEL_MAX_LENGTH) {
                throw new CommonException("Mỗi nhãn không được quá " + IPrintTemplateConfig.LABEL_MAX_LENGTH + " ký tự");
            }
        }
    }

    private static void requireText(Object value, int maxLength, String tooLongMessage) {
        if (!(value instanceof String text)) {
            throw new CommonException("Tùy chỉnh mẫu in không hợp lệ");
        }
        if (text.length() > maxLength) {
            throw new CommonException(tooLongMessage);
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
        validateCustomOptions(req.getSections());
        // Mỗi lần lưu ghi ảnh chụp cả cấu hình vào lich_su_thay_doi (cột TEXT): quá lớn thì phiên bản không ghi
        // được và lần lưu sau mất ảnh chụp "trước" — chặn ngay thay vì lưu mà mất lịch sử
        int kichThuoc = utf8Length(writeJson(req.getBranding()))
                + utf8Length(writeJson(req.getSections()))
                + utf8Length(writeJson(req.getColumns()));
        if (kichThuoc > CONFIG_JSON_MAX_BYTES) {
            throw new CommonException("Cấu hình mẫu in quá lớn, vui lòng bớt nhãn tự đặt hoặc nội dung tùy chỉnh");
        }
    }

    private static int utf8Length(String json) {
        return json == null ? 0 : json.getBytes(StandardCharsets.UTF_8).length;
    }

    // ── Lịch sử chỉnh sửa ──────────────────────────────────────────────────

    /**
     * Ảnh chụp JSON cấu hình đang dùng cho in thật của loại chứng từ (null nếu chưa lưu lần nào).
     * Chọn biến thể giống frontend (resolveInUseTemplateId): chỉ xét biến thể frontend in được
     * (isFrontendTemplateId); biến thể đang áp dụng nếu nó có cấu hình đã lưu, ngược lại cấu hình đã lưu
     * đầu tiên (id nhỏ nhất, cùng thứ tự getBundle) — để "trước khi lưu" khớp đúng mẫu đang in ra.
     */
    private String activeSnapshotJson(String documentType) {
        List<CauHinhMauIn> saved = new ArrayList<>();
        for (CauHinhMauIn entity : cauHinhMauInRepository.findAllByDocumentType(documentType)) {
            if (IPrintTemplateConfig.isFrontendTemplateId(documentType, entity.getTemplateId())) saved.add(entity);
        }
        if (saved.isEmpty()) return null;
        String activeId = mauInDangApDungRepository.findById(documentType)
                .map(MauInDangApDung::getTemplateId)
                .orElse(null);
        CauHinhMauIn inUse = saved.stream()
                .filter(entity -> Objects.equals(entity.getTemplateId(), activeId))
                .findFirst()
                .orElseGet(() -> saved.stream()
                        .min(Comparator.comparing(CauHinhMauIn::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                        .orElse(null));
        return inUse != null ? snapshotJson(inUse) : null;
    }

    /** id_tham_chieu của lich_su_thay_doi là INT: id vượt quá thì không ghi / không tra lịch sử được. */
    private static Integer idThamChieu(CauHinhMauIn entity) {
        Long id = entity.getId();
        if (id == null || id < 1 || id > Integer.MAX_VALUE) return null;
        return id.intValue();
    }

    /** Ảnh chụp đầy đủ một biến thể — cùng dạng với cấu hình frontend gửi lên, kèm templateId. */
    private String snapshotJson(CauHinhMauIn entity) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("documentType", entity.getDocumentType());
        snapshot.put("templateId", entity.getTemplateId());
        snapshot.put("name", entity.getName());
        snapshot.put("paperSize", entity.getPaperSize());
        snapshot.put("orientation", entity.getOrientation());
        snapshot.put("margin", entity.getMargin());
        snapshot.put("accentColor", entity.getAccentColor());
        snapshot.put("branding", readJson(entity.getBrandingJson(), new TypeReference<Map<String, Object>>() {}));
        snapshot.put("sections", readJson(entity.getSectionsJson(), new TypeReference<Map<String, Object>>() {}));
        snapshot.put("columns", readJson(entity.getColumnsJson(), new TypeReference<Map<String, Object>>() {}));
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            log.warn("Không chụp được cấu hình mẫu in {}/{}", entity.getDocumentType(), entity.getTemplateId(), e);
            return null;
        }
    }

    private static boolean fitsTextColumn(String json) {
        return json != null && json.getBytes(StandardCharsets.UTF_8).length <= HISTORY_JSON_MAX_BYTES;
    }

    /**
     * Ghi một phiên bản vào lich_su_thay_doi SAU KHI giao dịch lưu commit, trong giao dịch riêng:
     * lưu bị rollback thì không có phiên bản ma; ghi lịch sử lỗi (thiếu người thực hiện, ảnh chụp quá
     * lớn…) chỉ ghi log — mẫu in vẫn được lưu.
     */
    private void ghiLichSu(CauHinhMauIn saved, String truocKhiLuu) {
        Integer nguoiId = currentUserId();
        String sauKhiLuu = snapshotJson(saved);
        Integer idThamChieu = idThamChieu(saved);
        if (nguoiId == null || !fitsTextColumn(sauKhiLuu) || idThamChieu == null) {
            log.warn("Bỏ qua ghi lịch sử mẫu in {}/{} (thiếu người thực hiện, id hoặc ảnh chụp không hợp lệ)",
                    saved.getDocumentType(), saved.getTemplateId());
            return;
        }
        String giaTriCu = fitsTextColumn(truocKhiLuu) ? truocKhiLuu : null;
        String ghiChu = "Lưu mẫu in " + saved.getDocumentType() + " (" + saved.getTemplateId() + ")";
        SauCommit.chay(ghiChu, () -> {
            NguoiDung nguoi = nguoiDungRepository.findById(nguoiId).orElse(null);
            if (nguoi == null) {
                log.warn("Bỏ qua ghi lịch sử mẫu in: không tìm thấy người dùng {}", nguoiId);
                return;
            }
            lichSuThayDoiService.createGiaoDichRieng(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.cau_hinh_mau_in)
                    .idThamChieu(idThamChieu)
                    .hanhDong(IHanhDong.cap_nhat_mau_in)
                    .giaTriCu(giaTriCu)
                    .giaTriMoi(sauKhiLuu)
                    .nguoiThucHien(nguoi)
                    .ngayThucHien(Instant.now())
                    .ghiChu(ghiChu)
                    .build());
        });
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
