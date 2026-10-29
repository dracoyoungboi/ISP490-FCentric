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
    public String getWarehouseId() { return id; }
    public String getWarehouseName() { return name; }
    public String getWarehouseType() { return type; }
    public String getWarehouseSubType() { return subType; }
    public String getWarehouseEffectStatus() { return effectStatus; }
    public void setWarehouseId(String id) { this.id = id; }
    public void setWarehouseName(String name) { this.name = name; }
    public void setWarehouseType(String type) { this.type = type; }
    public void setWarehouseSubType(String subType) { this.subType = subType; }
    public void setWarehouseEffectStatus(String effectStatus) { this.effectStatus = effectStatus; }
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
