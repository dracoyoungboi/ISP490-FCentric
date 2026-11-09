package com.dev.backend.exception;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.InvalidFieldException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.i18n.BoThongDiep;
import com.dev.backend.i18n.CoThongDiep;
import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.NgonNgu;
import com.dev.backend.i18n.ThongDiep;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestControllerAdvice
public class RestControllerGlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(RestControllerGlobalExceptionHandler.class);

    // Câu thông báo trả về màn hình (chọn bằng tiếng Việt, theoNgonNgu dịch ở bước cuối), không lộ chi tiết kỹ thuật.
    // Câu gốc của exception vẫn được ghi vào log để lập trình viên tra cứu.
    private static final String MSG_INVALID_DATA = ThongDiep.vi("chung.duLieuKhongHopLe");
    private static final String MSG_BAD_FORMAT = ThongDiep.vi("chung.duLieuSaiDinhDang");
    private static final String MSG_METHOD_NOT_SUPPORTED = ThongDiep.vi("chung.thaoTacKhongHoTro");
    private static final String MSG_FORBIDDEN = ThongDiep.vi("chung.khongCoQuyen");
    private static final String MSG_UNAUTHORIZED = ThongDiep.vi("chung.phienKhongHopLe");
    private static final String MSG_NOT_FOUND = ThongDiep.vi("chung.khongTimThayDuLieu");
    private static final String MSG_CONFLICT = ThongDiep.vi("chung.duLieuTrung");
    private static final String MSG_SERVER_ERROR = ThongDiep.vi("chung.loiMayChu");

    private static final Pattern VIETNAMESE_CHAR = Pattern.compile("[\\u00C0-\\u024F\\u1E00-\\u1EFF]");
    private static final Pattern TECHNICAL_TEXT = Pattern.compile(
            "(?i)(exception|sql|duplicate entry|could not|java\\.|org\\.|constraint|null|failed to|cannot|unable to)");

    @ExceptionHandler({CommonException.class})
    public ResponseEntity<ResponseData<?>> handleCommonException(CommonException e, WebRequest request) {
        return ResponseEntity.status(e.getHttpStatus())
                .body(theoNgonNgu(ResponseData.builder()
                        .status(e.getHttpStatus().value())
                        .message(e.getMessage())
                        .data(e.getData())
                        .path(getPath(request))
                        .error(e.getHttpStatus().getReasonPhrase())
                        .build(), e));
    }

    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<ResponseData<?>> handleAccountDisabled(AccountDisabledException e, WebRequest request) {
        return ResponseEntity.status(e.getHttpStatus())
                .body(theoNgonNgu(ResponseData.builder()
                        .status(e.getHttpStatus().value())
                        .message(e.getMessage())
                        .data(e.getData())
                        .path(getPath(request))
                        .error("ACCOUNT_DISABLED")
                        .build(), e));
    }

    /** Lỗi nghiệp vụ có mã: error = mã, data = {code: mã, ...dữ liệu thêm}; message hiện nguyên văn ở giao diện. */
    @ExceptionHandler(LoiCoMaException.class)
    public ResponseEntity<ResponseData<?>> handleLoiCoMa(LoiCoMaException e, WebRequest request) {
        log.debug("Lỗi nghiệp vụ {} ({}) tại {}", e.getMa(), e.getStatus().value(), getPath(request));
        return ResponseEntity.status(e.getStatus())
                .body(theoNgonNgu(ResponseData.builder()
                        .status(e.getStatus().value())
                        .message(e.getMessage())
                        .data(e.getData())
                        .path(getPath(request))
                        .error(e.getMa())
                        .build(), e));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseData<?>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, WebRequest request) {
        Map<String, String> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage, (a, b) -> a));
        String firstMessage = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse(null);
        log.debug("Dữ liệu không hợp lệ: {}", ex.getMessage());
        ResponseData<Map<String, String>> body = ResponseData.<Map<String, String>>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(viOr(firstMessage, MSG_INVALID_DATA))
                .data(fieldErrors)
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ResponseData<?>> handleConstraintViolation(ConstraintViolationException ex, WebRequest request) {
        List<String> violations = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.toList());
        Map<String, Object> data = new HashMap<>();
        data.put("violations", violations);
        String firstMessage = ex.getConstraintViolations().stream()
                .map(v -> v.getMessage())
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse(null);
        log.debug("Dữ liệu vi phạm ràng buộc: {}", ex.getMessage());
        ResponseData<Map<String, Object>> body = ResponseData.<Map<String, Object>>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(viOr(firstMessage, MSG_INVALID_DATA))
                .data(data)
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ResponseData<?>> handleNotReadable(HttpMessageNotReadableException ex, WebRequest request) {
        log.debug("Không đọc được dữ liệu gửi lên: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(MSG_BAD_FORMAT)
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(theoNgonNgu(body, ex));
    }

    /**
     * Hai thao tác cùng sửa một chứng từ cùng lúc (deadlock, chờ khóa quá lâu, phiên bản dữ liệu đã đổi):
     * dữ liệu không bị ghi sai (giao dịch đã quay lui), người dùng chỉ cần thao tác lại — không phải lỗi máy chủ.
     */
    @ExceptionHandler(ConcurrencyFailureException.class)
    public ResponseEntity<ResponseData<?>> handleThaoTacDongThoi(ConcurrencyFailureException ex, WebRequest request) {
        log.warn("Thao tác đồng thời trên cùng dữ liệu: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.CONFLICT.value())
                .message(ThongDiep.vi("chung.thaoTacDongThoi"))
                .error("Conflict")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(theoNgonNgu(body, ex));
    }

    /** Thiếu tham số, tham số sai kiểu (vd. ?nhaCungCapId=abc) hoặc sắp xếp theo trường không có: lỗi của request, không phải lỗi máy chủ. */
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            PropertyReferenceException.class})
    public ResponseEntity<ResponseData<?>> handleThamSoSai(Exception ex, WebRequest request) {
        log.debug("Tham số không hợp lệ: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(ThongDiep.vi("chung.thamSoKhongHopLe"))
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ResponseData<?>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, WebRequest request) {
        log.debug("Phương thức không được hỗ trợ: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.METHOD_NOT_ALLOWED.value())
                .message(MSG_METHOD_NOT_SUPPORTED)
                .error("Method Not Allowed")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ResponseData<?>> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        log.debug("Từ chối truy cập: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.FORBIDDEN.value())
                .message(viOr(ex.getMessage(), MSG_FORBIDDEN))
                .error("Forbidden")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ResponseData<?>> handleAuth(AuthenticationException ex, WebRequest request) {
        log.debug("Lỗi xác thực: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.UNAUTHORIZED.value())
                .message(viOr(ex.getMessage(), MSG_UNAUTHORIZED))
                .error("Unauthorized")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler({EntityNotFoundException.class, NoSuchElementException.class})
    public ResponseEntity<ResponseData<?>> handleNotFound(RuntimeException ex, WebRequest request) {
        log.debug("Không tìm thấy dữ liệu: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.NOT_FOUND.value())
                .message(viOr(ex.getMessage(), MSG_NOT_FOUND))
                .error("Not Found")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ResponseData<?>> handleConflict(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Vi phạm ràng buộc dữ liệu: {}", ex.getMostSpecificCause().getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.CONFLICT.value())
                .message(MSG_CONFLICT)
                .error("Conflict")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(InvalidFieldException.class)
    public ResponseEntity<ResponseData<?>> handleInvalidField(InvalidFieldException ex, WebRequest request) {
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(viOr(ex.getMessage(), MSG_INVALID_DATA))
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(theoNgonNgu(body, ex));
    }

    // URL không khớp API nào (thường do FE gọi sai đường dẫn): Spring ném NoResourceFoundException
    // ("No static resource ..."). Trả 404 kèm thông báo rõ ràng thay vì rơi xuống handler chung (500).
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ResponseData<?>> handleNoResourceFound(NoResourceFoundException ex, WebRequest request) {
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.NOT_FOUND.value())
                .message(ThongDiep.vi("chung.khongTimThayApi", ex.getHttpMethod(), getPath(request)))
                .error("Not Found")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(theoNgonNgu(body, ex));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseData<?>> handleGeneric(Exception ex, WebRequest request) {
        if (isVietnameseMessage(ex.getMessage())) {
            log.warn("{} ({})", ex.getMessage(), getPath(request));
        } else {
            log.error("Lỗi chưa xử lý tại {}", getPath(request), ex);
        }
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .message(viOr(ex.getMessage(), MSG_SERVER_ERROR))
                .error("Internal Server Error")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(theoNgonNgu(body, ex));
    }

    /**
     * Đa ngôn ngữ: mọi bước ở trên chọn câu TIẾNG VIỆT như cũ; tới đây mới đổi sang ngôn ngữ của request
     * (header Accept-Language, xem {@link NgonNgu}). Câu theo khóa ({@link CoThongDiep}) dịch theo khóa; câu chữ thường
     * (annotation kiểm dữ liệu, câu dự phòng ở trên, câu chưa chuyển khóa) dịch nếu có trong kho câu. Đã dịch thì
     * giữ câu Việt ở {@code messageGoc}. Request tiếng Việt: không đổi gì.
     */
    static <T> ResponseData<T> theoNgonNgu(ResponseData<T> body, Throwable loi) {
        if (body == null || !NgonNgu.laTiengAnh()) return body;
        String cauViet = body.getMessage();
        String cauAnh = null;
        if (loi instanceof CoThongDiep coThongDiep && coThongDiep.getThongDiep() != null
                && cauViet != null && loi.getMessage() != null && cauViet.trim().equals(loi.getMessage().trim())) {
            cauAnh = coThongDiep.getThongDiep().theoNgonNgu(NgonNgu.EN);
        } else if (cauViet != null) {
            // DichCauDaLuu: như dichCauViet, thêm tách câu "bọc" câu khác (vd. "Đã nhận tiền nhưng chưa tạo được đơn: <câu>"
            // của payOS PAID_ERROR). Không nhận ra thì trả nguyên câu → điều kiện dưới bỏ qua, như null trước đây.
            cauAnh = DichCauDaLuu.dich(cauViet, NgonNgu.EN);
        }
        if (cauAnh != null && !cauAnh.equals(cauViet)) {
            body.setMessage(cauAnh);
            body.setMessageGoc(cauViet);
        }
        if (loi instanceof MethodArgumentNotValidException && body.getData() instanceof Map<?, ?> theoO) {
            Map<Object, Object> daDich = new java.util.LinkedHashMap<>();
            theoO.forEach((o, cau) -> {
                String anh = cau instanceof String s ? BoThongDiep.dichCauViet(s, NgonNgu.EN) : null;
                daDich.put(o, anh != null ? anh : cau);
            });
            @SuppressWarnings("unchecked")
            T moi = (T) daDich;
            body.setData(moi);
        }
        // ConstraintViolation: data.violations = ["truong: câu"] → dịch phần câu
        if (loi instanceof ConstraintViolationException && body.getData() instanceof Map<?, ?> duLieu
                && duLieu.get("violations") instanceof List<?> ds) {
            List<Object> daDich = ds.stream().map(x -> {
                if (!(x instanceof String s)) return x;
                int hai = s.indexOf(": ");
                String truong = hai >= 0 ? s.substring(0, hai + 2) : "";
                String cau = hai >= 0 ? s.substring(hai + 2) : s;
                String anh = BoThongDiep.dichCauViet(cau, NgonNgu.EN);
                return anh != null ? truong + anh : s;
            }).collect(Collectors.<Object>toList());
            Map<Object, Object> moiMap = new java.util.LinkedHashMap<>(duLieu);
            moiMap.put("violations", daDich);
            @SuppressWarnings("unchecked")
            T moi = (T) moiMap;
            body.setData(moi);
        }
        return body;
    }

    /**
     * Giữ câu thông báo gốc nếu đó là câu tiếng Việt do service viết (ví dụ "Không đủ tồn kho"),
     * ngược lại trả câu dự phòng tiếng Việt để người dùng không thấy câu lỗi kỹ thuật tiếng Anh.
     */
    static String viOr(String message, String fallback) {
        return isVietnameseMessage(message) ? message.trim() : fallback;
    }

    static boolean isVietnameseMessage(String message) {
        if (message == null) return false;
        String m = message.trim();
        if (m.isEmpty() || m.length() > 500) return false;
        if (!VIETNAMESE_CHAR.matcher(m).find()) return false;
        return !TECHNICAL_TEXT.matcher(m).find();
    }

    private String getPath(WebRequest request) {
        try {
            if (request instanceof ServletWebRequest servletWebRequest) {
                return servletWebRequest.getRequest().getRequestURI();
            }
        } catch (Exception ignored) {}
        return request.getDescription(false);
    }
}
