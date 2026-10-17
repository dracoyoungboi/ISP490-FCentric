package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhatHanhBienBanRequest {
    String phuongAn;
    String ghiChu;
    List<ItemLoiRequest> items;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ItemLoiRequest {
        Integer bienTheSanPhamId;
        String maLo;
        String lyDo;
        Integer soLuong;
        String anhBangChungUrl;
        String ghiChu;
    }
}

