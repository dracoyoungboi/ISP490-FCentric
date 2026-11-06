package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "shopee_mock_product", uniqueConstraints = {
        @UniqueConstraint(name = "uk_shopee_item_model", columnNames = {"item_id", "model_id"})
})
public class ShopeeMockProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @NotNull
    @Column(name = "item_id", nullable = false)
    Long itemId;

    @NotNull
    @Column(name = "model_id", nullable = false)
    Long modelId;

    @NotNull
    @Size(max = 100)
    @Column(name = "item_sku", nullable = false, length = 100)
    String itemSku;

    @NotNull
    @Size(max = 100)
    @Column(name = "model_sku", nullable = false, length = 100)
    String modelSku;

    @NotNull
    @Size(max = 255)
    @Column(name = "item_name", nullable = false)
    String itemName;

    @Size(max = 100)
    @Column(name = "tier_variation", length = 100)
    String tierVariation;

    @NotNull
    @Builder.Default
    @Column(name = "price", precision = 15, scale = 2, nullable = false)
    BigDecimal price = BigDecimal.ZERO;

    @NotNull
    @Builder.Default
    @Column(name = "stock_quantity", nullable = false)
    Integer stockQuantity = 0;

    @Column(name = "image_url", columnDefinition = "TEXT")
    String imageUrl;

    @Builder.Default
    @Column(name = "trang_thai", length = 50)
    String trangThai = "NORMAL";

    @Builder.Default
    @Column(name = "ngay_cap_nhat")
    LocalDateTime ngayCapNhat = LocalDateTime.now();

    @PrePersist
    @PreUpdate
    public void preUpdate() {
        this.ngayCapNhat = LocalDateTime.now();
    }
}

