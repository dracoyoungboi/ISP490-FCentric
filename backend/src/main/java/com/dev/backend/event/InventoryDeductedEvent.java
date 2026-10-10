package com.dev.backend.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;

@Getter
public class InventoryDeductedEvent extends ApplicationEvent {
    private final Integer bienTheSanPhamId;
    private final BigDecimal soLuongTonConLai;
    private final Integer khoId;

    public InventoryDeductedEvent(Object source, Integer bienTheSanPhamId, BigDecimal soLuongTonConLai, Integer khoId) {
        super(source);
        this.bienTheSanPhamId = bienTheSanPhamId;
        this.soLuongTonConLai = soLuongTonConLai;
        this.khoId = khoId;
    }
}

