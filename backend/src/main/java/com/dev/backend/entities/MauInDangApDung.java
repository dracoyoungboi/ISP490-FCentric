package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Mẫu in đang áp dụng của mỗi loại chứng từ.
 * PK = document_type -> mỗi loại chứng từ có ĐÚNG MỘT template đang áp dụng;
 * "đổi mẫu mặc định" chỉ là upsert theo PK (last-write-wins, không thể trùng).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "mau_in_dang_ap_dung")
public class MauInDangApDung {
    @Id
    @Size(max = 50)
    @NotNull
    @Column(name = "document_type", nullable = false, length = 50)
    String documentType;

    @Size(max = 100)
    @NotNull
    @Column(name = "template_id", nullable = false, length = 100)
    String templateId;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;
}
