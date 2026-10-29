package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Địa chỉ nhận hàng của đơn hàng TikTok Shop v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokRecipientAddressDto implements Serializable {

    @JsonProperty("name")
    String name;

    @JsonProperty("phone_number")
    String phoneNumber;

    @JsonProperty("full_address")
    String fullAddress;

    @JsonProperty("postal_code")
    String postalCode;

    @JsonProperty("region")
    String region;

    @JsonProperty("district")
    String district;

    @JsonProperty("town")
    String town;
}
