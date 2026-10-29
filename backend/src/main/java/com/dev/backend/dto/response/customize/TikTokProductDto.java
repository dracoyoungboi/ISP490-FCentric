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
public class TikTokProductDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("title")
    String title;

    @JsonProperty("status")
    String status;

    @JsonProperty("skus")
    List<TikTokSkuDto> skus;
}
