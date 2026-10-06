package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Cấu hình mẫu in đã lưu của một biến thể (A4/A5/K80) của một loại chứng từ.
 * Mỗi dòng = một biến thể; UNIQUE(document_type, template_id).
 * Các cột JSON lưu dạng String — parse bằng Jackson trong service.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "cau_hinh_mau_in")
public class CauHinhMauIn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @Size(max = 50)
    @NotNull
    @Column(name = "document_type", nullable = false, length = 50)
    String documentType;

    @Size(max = 100)
    @NotNull
    @Column(name = "template_id", nullable = false, length = 100)
    String templateId;

    @Size(max = 200)
    @Column(name = "name", length = 200)
    String name;

    @Size(max = 10)
    @Column(name = "paper_size", length = 10)
    String paperSize;

    @Size(max = 10)
    @Column(name = "orientation", length = 10)
    String orientation;

    @Size(max = 20)
    @Column(name = "margin", length = 20)
    String margin;

    @Size(max = 9)
    @Column(name = "accent_color", length = 9)
    String accentColor;

    @Column(name = "branding_json", columnDefinition = "json")
    String brandingJson;

    @Column(name = "sections_json", columnDefinition = "json")
    String sectionsJson;

    @Column(name = "columns_json", columnDefinition = "json")
    String columnsJson;

    @NotNull
    @Column(name = "version", nullable = false)
    Integer version;

    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    @Column(name = "nguoi_cap_nhat_id")
    Integer nguoiCapNhatId;
}
