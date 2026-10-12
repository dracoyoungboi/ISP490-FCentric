package com.dev.backend.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;

/**
 * Sự kiện kích hoạt khi đơn hàng bị hủy hoặc hoàn kệ, làm hồi phục số lượng Free to Use.
 * Dùng để kích hoạt đẩy tồn khả dụng tức thời lên Shopify/Lazada/Shopee ngoài Transaction Boundary.
 */
@Getter
public class InventoryRestockedEvent extends ApplicationEvent {
    private final Integer bienTheSanPhamId;
    private final BigDecimal soLuongHoiPhuc;
    private final Integer khoId;

    public InventoryRestockedEvent(Object source, Integer bienTheSanPhamId, BigDecimal soLuongHoiPhuc, Integer khoId) {
        super(source);
        this.bienTheSanPhamId = bienTheSanPhamId;
        this.soLuongHoiPhuc = soLuongHoiPhuc;
        this.khoId = khoId;
    }

    public BigDecimal getSoLuongHoanLai() {
        return soLuongHoiPhuc;
    }
}

