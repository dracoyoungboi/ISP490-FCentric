package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Kiện hàng của đơn hàng TikTok Shop Open API v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokPackageItemDto implements Serializable {

    @JsonProperty("package_id")
    String packageId;

    @JsonProperty("package_status")
    String packageStatus;
}

