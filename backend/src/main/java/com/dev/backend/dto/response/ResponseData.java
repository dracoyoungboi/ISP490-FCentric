package com.dev.backend.dto.response;

import com.dev.backend.config.SecurityContextHolder;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.util.Date;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ResponseData<T> implements Serializable {
    int status;
    T data;
    String error;
    String message;
    /** Câu gốc tiếng Việt khi `message` đã được dịch (giao diện tiếng Anh); để giao diện so khớp câu cũ nếu cần. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    String messageGoc;
    @Builder.Default
    Date timestamp = new Date();
    @Builder.Default
    String path = SecurityContextHolder.getPath();

    public ResponseData(int status, T data, String error, String message) {
        this.status = status;
        this.data = data;
        this.error = error;
        this.message = message;
        this.timestamp = new Date();
    }

    public ResponseData(int status, T data, String error, String message, String path) {
        this.status = status;
        this.data = data;
        this.error = error;
        this.message = message;
        this.path = path;
        this.timestamp = new Date();
    }
}
