package com.dev.backend.constant.enums;

public enum LoaiBangChungDongGoi {
    ANH_HANG_TRONG_HOP("Ảnh hàng đã cho vào hộp/túi"),
    ANH_NIEM_PHONG_TEM_VC("Ảnh hộp dán băng keo niêm phong kèm tem vận chuyển"),
    VIDEO_DONG_GOI("Video đóng gói từ lúc cho đồ vào đến khi niêm phong");

    private final String moTa;

    LoaiBangChungDongGoi(String moTa) {
        this.moTa = moTa;
    }

    public String getMoTa() {
        return moTa;
    }
}
