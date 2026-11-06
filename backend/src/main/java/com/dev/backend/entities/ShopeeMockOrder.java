package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "shopee_mock_order")
public class ShopeeMockOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @Size(max = 50)
    @Column(name = "order_sn", nullable = false, unique = true, length = 50)
    String orderSn;

    @NotNull
    @Builder.Default
    @Size(max = 50)
    @Column(name = "order_status", nullable = false, length = 50)
    String orderStatus = "READY_TO_SHIP";

    @NotNull
    @Size(max = 100)
    @Column(name = "buyer_name", nullable = false, length = 100)
    String buyerName;

    @Size(max = 30)
    @Column(name = "buyer_phone", length = 30)
    String buyerPhone;

    @NotNull
    @Column(name = "shipping_address", nullable = false, columnDefinition = "TEXT")
    String shippingAddress;

    @Builder.Default
    @Size(max = 50)
    @Column(name = "payment_method", length = 50)
    String paymentMethod = "CASH_ON_DELIVERY";

    @Size(max = 50)
    @Column(name = "tracking_number", length = 50)
    String trackingNumber;

    @Builder.Default
    @Size(max = 50)
    @Column(name = "shipping_carrier", length = 50)
    String shippingCarrier = "Shopee Xpress";

    @NotNull
    @Builder.Default
    @Column(name = "total_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal totalAmount = BigDecimal.ZERO;

    @NotNull
    @Builder.Default
    @Column(name = "shipping_fee", precision = 15, scale = 2, nullable = false)
    BigDecimal shippingFee = BigDecimal.valueOf(25000);

    @NotNull
    @Column(name = "items_json", nullable = false, columnDefinition = "JSON")
    String itemsJson;

    @Size(max = 255)
    @Column(name = "cancel_reason")
    String cancelReason;

    @Size(max = 50)
    @Column(name = "cancel_user", length = 50)
    String cancelUser;

    @NotNull
    @Column(name = "create_time", nullable = false)
    Long createTime;

    @NotNull
    @Column(name = "update_time", nullable = false)
    Long updateTime;
}
