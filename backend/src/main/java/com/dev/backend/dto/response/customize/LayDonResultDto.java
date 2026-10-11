package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LayDonResultDto {
    int soDonMoi;
    int soDonCapNhat;
    String thongDiep;
}

