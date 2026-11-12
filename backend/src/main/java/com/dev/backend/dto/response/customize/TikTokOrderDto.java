package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

/**
 * Đơn hàng TikTok Shop Open API v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokOrderDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("status")
    String status;

    @JsonProperty("create_time")
    Long createTime;

    @JsonProperty("update_time")
    Long updateTime;

    @JsonProperty("paid_time")
    Long paidTime;

    @JsonProperty("buyer_uid")
    String buyerUid;

    @JsonProperty("buyer_message")
    String buyerMessage;

    @JsonProperty("cancel_reason")
    String cancelReason;

    @JsonProperty("cancel_user")
    String cancelUser;

    @JsonProperty("is_on_hold")
    Boolean isOnHold;

    @JsonProperty("tracking_number")
    String trackingNumber;

    @JsonProperty("shipping_provider")
    String shippingProvider;

    @JsonProperty("payment_method_name")
    String paymentMethodName;

    /**
     * Thông tin thanh toán (API v202309 đặt các trường tài chính trong payment).
     */
    @JsonProperty("payment")
    TikTokPaymentDto payment;

    /**
     * Fallback nếu API trả total_amount trực tiếp ở root.
     */
    @JsonProperty("total_amount")
    String totalAmount;

    @JsonProperty("shipping_fee")
    String shippingFee;

    /**
     * Danh sách kiện hàng liên quan đến đơn (package_list hoặc packages).
     */
    @JsonProperty("package_list")
    List<TikTokPackageItemDto> packageList;

    @JsonProperty("packages")
    List<TikTokPackageItemDto> packages;

    @JsonProperty("recipient_address")
    TikTokRecipientAddressDto recipientAddress;

    @JsonProperty("line_items")
    List<TikTokOrderItemDto> lineItems;

    /**
     * Lấy ID kiện hàng đầu tiên để phục vụ fulfillment (ship package, lấy shipping label).
     */
    public String getFirstPackageId() {
        if (packageList != null && !packageList.isEmpty() && packageList.get(0).getPackageId() != null
                && !packageList.get(0).getPackageId().isBlank()) {
            return packageList.get(0).getPackageId().trim();
        }
        if (packages != null && !packages.isEmpty() && packages.get(0).getPackageId() != null
                && !packages.get(0).getPackageId().isBlank()) {
            return packages.get(0).getPackageId().trim();
        }
        return null;
    }

    /**
     * Lấy tổng tiền thanh toán thực tế của đơn hàng, chống triệt để lỗi 0đ khi thanh toán MoMo/Online:
     * 1. Ưu tiên đọc từ payment.total_amount
     * 2. Đọc từ total_amount ở root
     * 3. Fallback: tính tổng sale_price * quantity từ line_items
     */
    public String layTongTienThanhToan() {
        if (payment != null && payment.getTotalAmount() != null && !payment.getTotalAmount().isBlank()) {
            return payment.getTotalAmount().trim();
        }
        if (totalAmount != null && !totalAmount.isBlank()) {
            return totalAmount.trim();
        }
        if (lineItems != null && !lineItems.isEmpty()) {
            BigDecimal sum = BigDecimal.ZERO;
            for (TikTokOrderItemDto it : lineItems) {
                if (it.getSalePrice() != null && !it.getSalePrice().isBlank()) {
                    try {
                        BigDecimal p = new BigDecimal(it.getSalePrice().trim());
                        int q = it.getQuantity() != null ? it.getQuantity() : 1;
                        sum = sum.add(p.multiply(BigDecimal.valueOf(q)));
                    } catch (Exception ignored) {}
                }
            }
            if (sum.compareTo(BigDecimal.ZERO) > 0) {
                return sum.toPlainString();
            }
        }
        return "0";
    }

    /**
     * Lấy phí vận chuyển từ payment.shipping_fee hoặc shipping_fee ở root.
     */
    public String layPhiVanChuyen() {
        if (payment != null && payment.getShippingFee() != null && !payment.getShippingFee().isBlank()) {
            return payment.getShippingFee().trim();
        }
        if (shippingFee != null && !shippingFee.isBlank()) {
            return shippingFee.trim();
        }
        return "0";
    }

    /**
     * Kiểm tra xem đơn hàng có yêu cầu hủy từ phía người mua hay không.
     */
    public boolean laYeuCauHuy() {
        return (cancelReason != null && !cancelReason.isBlank())
                || "BUYER".equalsIgnoreCase(cancelUser)
                || Boolean.TRUE.equals(isOnHold);
    }
}
