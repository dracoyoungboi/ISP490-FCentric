package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LayDonHangKenhRequest {
    String tu;
    String den;
}

