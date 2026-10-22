package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LazadaOAuthCallbackRequest implements Serializable {

    @NotBlank(message = "Mã ủy quyền code không được để trống")
    String code;

    /**
     * App Key dùng để đối soát. Nếu để trống, hệ thống sẽ lấy App Key đã lưu trong cấu hình.
     */
    String appKey;
}
