package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
public class TikTokProductCreateResponse implements Serializable {
    private int code;
    private String message;
    @JsonProperty("request_id")
    private String requestId;
    private ProductCreateData data;

    @Getter
    @Setter
    public static class ProductCreateData implements Serializable {
        @JsonProperty("product_id")
        private String productId;

        private List<CreatedSku> skus;
    }

    @Getter
    @Setter
    public static class CreatedSku implements Serializable {
        private String id;
        @JsonProperty("seller_sku")
        private String sellerSku;
    }
}

