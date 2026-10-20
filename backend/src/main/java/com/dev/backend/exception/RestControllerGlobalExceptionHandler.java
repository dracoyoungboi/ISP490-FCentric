package com.dev.backend.exception;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.InvalidFieldException;
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

    // Câu thông báo trả về màn hình phải là tiếng Việt, không lộ chi tiết kỹ thuật.
    // Câu gốc của exception vẫn được ghi vào log để lập trình viên tra cứu.
    private static final String MSG_INVALID_DATA = "Dữ liệu gửi lên không hợp lệ.";
    private static final String MSG_BAD_FORMAT = "Dữ liệu gửi lên sai định dạng.";
    private static final String MSG_METHOD_NOT_SUPPORTED = "Thao tác này không được hỗ trợ.";
    private static final String MSG_FORBIDDEN = "Bạn không có quyền thực hiện thao tác này.";
    private static final String MSG_UNAUTHORIZED = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
    private static final String MSG_NOT_FOUND = "Không tìm thấy dữ liệu.";
    private static final String MSG_CONFLICT = "Dữ liệu bị trùng hoặc đang được dùng ở nơi khác.";
    private static final String MSG_SERVER_ERROR = "Có lỗi xảy ra, vui lòng thử lại sau.";

    private static final Pattern VIETNAMESE_CHAR = Pattern.compile("[\\u00C0-\\u024F\\u1E00-\\u1EFF]");
    private static final Pattern TECHNICAL_TEXT = Pattern.compile(
            "(?i)(exception|sql|duplicate entry|could not|java\\.|org\\.|constraint|null|failed to|cannot|unable to)");

    @ExceptionHandler({CommonException.class})
    public ResponseEntity<ResponseData<?>> handleCommonException(CommonException e, WebRequest request) {
        return ResponseEntity.status(e.getHttpStatus())
                .body(ResponseData.builder()
                        .status(e.getHttpStatus().value())
                        .message(e.getMessage())
                        .data(e.getData())
                        .path(getPath(request))
                        .error(e.getHttpStatus().getReasonPhrase())
                        .build());
    }

    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<ResponseData<?>> handleAccountDisabled(AccountDisabledException e, WebRequest request) {
        return ResponseEntity.status(e.getHttpStatus())
                .body(ResponseData.builder()
                        .status(e.getHttpStatus().value())
                        .message(e.getMessage())
                        .data(e.getData())
                        .path(getPath(request))
                        .error("ACCOUNT_DISABLED")
                        .build());
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
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
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
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
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
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
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
                .message("Dữ liệu này đang được thao tác ở máy khác. Tải lại trang rồi thử lại.")
                .error("Conflict")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /** Thiếu tham số, tham số sai kiểu (vd. ?nhaCungCapId=abc) hoặc sắp xếp theo trường không có: lỗi của request, không phải lỗi máy chủ. */
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            PropertyReferenceException.class})
    public ResponseEntity<ResponseData<?>> handleThamSoSai(Exception ex, WebRequest request) {
        log.debug("Tham số không hợp lệ: {}", ex.getMessage());
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message("Tham số gửi lên thiếu hoặc không hợp lệ. Tải lại trang rồi thử lại.")
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
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
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(body);
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
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
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
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
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
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
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
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InvalidFieldException.class)
    public ResponseEntity<ResponseData<?>> handleInvalidField(InvalidFieldException ex, WebRequest request) {
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message(viOr(ex.getMessage(), MSG_INVALID_DATA))
                .error("Bad Request")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // URL không khớp API nào (thường do FE gọi sai đường dẫn): Spring ném NoResourceFoundException
    // ("No static resource ..."). Trả 404 kèm thông báo rõ ràng thay vì rơi xuống handler chung (500).
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ResponseData<?>> handleNoResourceFound(NoResourceFoundException ex, WebRequest request) {
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(HttpStatus.NOT_FOUND.value())
                .message("Không tìm thấy API: " + ex.getHttpMethod() + " " + getPath(request))
                .error("Not Found")
                .path(getPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
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
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
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
