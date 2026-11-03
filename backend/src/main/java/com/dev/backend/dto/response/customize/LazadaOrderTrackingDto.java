package com.dev.backend.dto.response.customize;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Thông tin mã vận đơn và kiện hàng lấy trực tiếp từ Lazada Open Platform (/order/items/get).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LazadaOrderTrackingDto implements Serializable {
    private String trackingCode;
    private String packageId;
    private String shipmentProvider;
}

