package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LoTrenKeDto {
    String maLo;
    String tenBienThe;
    Integer soLuong;
}

