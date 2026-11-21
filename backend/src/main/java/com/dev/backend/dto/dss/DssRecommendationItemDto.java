package com.dev.backend.dto.dss;

import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssRecommendationItemDto {
    private Integer sanPhamId;
    private Integer bienTheSanPhamId;
    private String maSanPham;
    private String maSku;
    private String tenSanPham;
    private String tenMau;
    private String maMauHex;
    private String tenSize;
    private String tenChatLieu;
    private String tenDanhMuc;
    private String anh;

    // 4-state inventory at target warehouse
    private long onHand;
    private long outgoing;
    private long incoming;
    private long ftu;

    // Velocity & revenue over observation window N days
    private double avgDailyDemand;
    private double maxDailyDemand;
    private double demandStdDev;
    private long totalSoldN;
    private long revenueN;
    private Map<String, Long> soldByChannel;

    // Supplier lead time over last M receipts
    private double leadTimeAvg;
    private double leadTimeMax;
    private int leadTimeSampleCount;

    // ABC classification & slow-moving indicator
    private String abcClass;
    private double revenueSharePercent;
    private double cumulativeRevenuePercent;
    private boolean deadStock;
    private boolean daTungNhap;

    // Decision engine outputs
    private String appliedPreset;
    private long safetyStock;
    private long reorderPoint;
    private long suggestedOrderQty;
    private long excessStock;
    private Double daysOfInventory;
    private String estimatedStockoutDate;
    private String latestOrderDate;
    private String urgencyLevel;
    private boolean needsReorder;
    private boolean flashSaleRecommended;
    private boolean prCreationLocked;

    // Operational metadata
    private String openPrCode;
    private Integer openPrCount;
    private BigDecimal donGiaNhapGanNhat;
}

