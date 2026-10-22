package com.dev.backend.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/** Kết quả POST /don-mua-hang/{id}/gui-lai-yeu-cau. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GuiLaiYeuCauDto implements Serializable {
    boolean daDuaVaoHangDoi;
}
