package com.dev.backend.exception.customize;

import com.dev.backend.i18n.CoThongDiep;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Lỗi nghiệp vụ có mã ổn định để giao diện xử lý theo mã, không dò câu chữ (mã ở {@link MaLoi}).
 * Bộ xử lý chung trả: HTTP = status; body {status, error: ma, message, data: {code: ma, ...duLieu}}.
 * message hiện nguyên văn ở giao diện: viết tiếng Việt, không có chữ "bị khóa" (apiClient coi đó là tài khoản bị khóa).
 */
public class LoiCoMaException extends RuntimeException implements CoThongDiep {

    private final HttpStatus status;
    private final String ma;
    private final Map<String, Object> duLieu;
    private final transient ThongDiep thongDiep;

    public LoiCoMaException(HttpStatus status, String ma, String message) {
        this(status, ma, message, null);
    }

    public LoiCoMaException(HttpStatus status, String ma, String message, Map<String, Object> duLieu) {
        this(status, ma, message, duLieu, null);
    }

    /** Câu theo khóa (đa ngôn ngữ); getMessage() vẫn là câu tiếng Việt. */
    public LoiCoMaException(HttpStatus status, String ma, ThongDiep thongDiep) {
        this(status, ma, thongDiep.tiengViet(), null, thongDiep);
    }

    public LoiCoMaException(HttpStatus status, String ma, ThongDiep thongDiep, Map<String, Object> duLieu) {
        this(status, ma, thongDiep.tiengViet(), duLieu, thongDiep);
    }

    private LoiCoMaException(HttpStatus status, String ma, String message, Map<String, Object> duLieu, ThongDiep thongDiep) {
        super(message);
        this.status = Objects.requireNonNull(status, "status");
        this.ma = Objects.requireNonNull(ma, "ma");
        this.duLieu = duLieu == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(duLieu));
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMa() {
        return ma;
    }

    /** Dữ liệu thêm (không gồm code). */
    public Map<String, Object> getDuLieu() {
        return duLieu;
    }

    /** data trả về: code đứng đầu, sau đó dữ liệu thêm (dữ liệu thêm không ghi đè được code). */
    public Map<String, Object> getData() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("code", ma);
        duLieu.forEach((k, v) -> {
            if (!"code".equals(k)) data.put(k, v);
        });
        return data;
    }
}
