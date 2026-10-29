package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TikTokWarehousesResponse implements Serializable {

    @JsonProperty("code")
    Integer code;

    @JsonProperty("message")
    String message;

    @JsonProperty("request_id")
    String requestId;

    @JsonProperty("data")
    WarehouseData data;

    public List<TikTokWarehouseDto> getWarehouses() {
        return data != null ? data.getWarehouses() : null;
    }

    public void setWarehouses(List<TikTokWarehouseDto> warehouses) {
        if (this.data == null) {
            this.data = new WarehouseData();
        }
        this.data.setWarehouses(warehouses);
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class WarehouseData implements Serializable {
        @JsonProperty("warehouses")
        List<TikTokWarehouseDto> warehouses;
    }
}
