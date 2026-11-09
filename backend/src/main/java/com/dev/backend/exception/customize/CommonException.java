package com.dev.backend.exception.customize;

import com.dev.backend.i18n.CoThongDiep;
import com.dev.backend.i18n.ThongDiep;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CommonException extends RuntimeException implements CoThongDiep {
    HttpStatus httpStatus;
    Object data;
    /** Câu theo khóa (đa ngôn ngữ); null khi tạo bằng câu chữ thường. getMessage() luôn là câu tiếng Việt. */
    transient ThongDiep thongDiep;

    /** Lỗi nghiệp vụ 400 với câu theo khóa: {@code new CommonException(ThongDiep.of("kho.khongTimThay", id))}. */
    public CommonException(ThongDiep thongDiep) {
        this(HttpStatus.BAD_REQUEST, thongDiep);
    }

    public CommonException(HttpStatus httpStatus, ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.httpStatus = httpStatus;
        this.thongDiep = thongDiep;
    }

    public CommonException(ThongDiep thongDiep, HttpStatus httpStatus, Object data) {
        super(thongDiep.tiengViet());
        this.httpStatus = httpStatus;
        this.data = data;
        this.thongDiep = thongDiep;
    }

    public CommonException(ThongDiep thongDiep, Throwable cause) {
        super(thongDiep.tiengViet(), cause);
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        this.thongDiep = thongDiep;
    }

    public CommonException(String message, Throwable cause) {
        super(message, cause);
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    public CommonException(String message) {
        super(message);
        this.httpStatus = HttpStatus.BAD_REQUEST;
    }

    public CommonException(HttpStatus httpStatus, String message) {
        super(message);
        this.httpStatus = httpStatus;
    }

    public HttpStatus getStatus() {
        return httpStatus != null ? httpStatus : HttpStatus.BAD_REQUEST;
    }

    /** Lỗi nghiệp vụ với HTTP status + data có cấu trúc (ví dụ price-change của POS). */
    public CommonException(String message, HttpStatus httpStatus, Object data) {
        super(message);
        this.httpStatus = httpStatus;
        this.data = data;
    }
}
