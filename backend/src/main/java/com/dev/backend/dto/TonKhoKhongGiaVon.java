package com.dev.backend.dto;

import java.math.BigDecimal;

/**
 * Một dòng tồn kho tổng hợp cho người không được xem giá vốn (nhân viên bán hàng — SRS 2.4.1, XemGiaVon): mọi số giữ
 * nguyên, riêng giá trị tồn (tính theo giá vốn lô) trả null. Máy chủ không gửi số này, không chỉ ẩn trên giao diện.
 */
public final class TonKhoKhongGiaVon implements TonKhoProjection {

    private final TonKhoProjection goc;

    public TonKhoKhongGiaVon(TonKhoProjection goc) {
        this.goc = goc;
    }

    @Override
    public Integer getBienTheId() {
        return goc.getBienTheId();
    }

    @Override
    public String getMaSku() {
        return goc.getMaSku();
    }

    @Override
    public String getMaSanPham() {
        return goc.getMaSanPham();
    }

    @Override
    public String getTenSanPham() {
        return goc.getTenSanPham();
    }

    @Override
    public String getTenMau() {
        return goc.getTenMau();
    }

    @Override
    public String getMaSize() {
        return goc.getMaSize();
    }

    @Override
    public String getTenChatLieu() {
        return goc.getTenChatLieu();
    }

    @Override
    public Integer getMucTonToiThieu() {
        return goc.getMucTonToiThieu();
    }

    @Override
    public Integer getKhoId() {
        return goc.getKhoId();
    }

    @Override
    public String getTenKho() {
        return goc.getTenKho();
    }

    @Override
    public BigDecimal getOnHand() {
        return goc.getOnHand();
    }

    @Override
    public BigDecimal getIncoming() {
        return goc.getIncoming();
    }

    @Override
    public BigDecimal getOutgoing() {
        return goc.getOutgoing();
    }

    @Override
    public BigDecimal getFreeToUse() {
        return goc.getFreeToUse();
    }

    @Override
    public BigDecimal getTongGiaTri() {
        return null;
    }
}
