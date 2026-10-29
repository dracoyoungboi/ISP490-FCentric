package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TikTokWarehouseDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("name")
    String name;

    @JsonProperty("type")
    String type;

    @JsonProperty("sub_type")
    String subType;

    @JsonProperty("is_default")
    Boolean isDefault;

    @JsonProperty("effect_status")
    String effectStatus;

    /**
     * Trường chuẩn hóa tương thích bộ chọn kho sàn trên giao diện FCentric
     */
    public String getMaKhoSan() {
        return id;
    }

    public String getTenKhoSan() {
        return name;
    }

    public boolean isMacDinh() {
        return Boolean.TRUE.equals(isDefault);
    }

    public boolean isHieuLuc() {
        return "EFFECTIVE".equalsIgnoreCase(effectStatus);
    }
}
