package com.dev.backend.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class MauSacCreating {
    String maMau;
    String tenMau;
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Mã màu phải có dạng #RRGGBB")
    String maMauHex;
}
