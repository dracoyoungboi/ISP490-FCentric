package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Hai bảng liên kết của phạm vi kiểm kê, cùng dạng (đợt, id):
 * <ul>
 *   <li>{@link KhuVuc}: dot_kiem_ke_khu_vuc — các khu vực của đợt theo khu vực (lưu từ lúc nháp).</li>
 *   <li>{@link DanhMuc}: dot_kiem_ke_danh_muc — danh mục gốc + mọi hậu duệ, chốt lúc bắt đầu.</li>
 * </ul>
 */
public final class DotKiemKePhamVi {

    private DotKiemKePhamVi() {
    }

    @EqualsAndHashCode
    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class KhuVucId implements Serializable {
        Integer dotKiemKeId;
        Integer khuVucKhoId;
    }

    @EqualsAndHashCode
    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DanhMucId implements Serializable {
        Integer dotKiemKeId;
        Integer danhMucId;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Entity(name = "DotKiemKeKhuVuc")
    @IdClass(KhuVucId.class)
    @Table(name = "dot_kiem_ke_khu_vuc")
    public static class KhuVuc {
        @Id
        @Column(name = "dot_kiem_ke_id", nullable = false)
        Integer dotKiemKeId;

        @Id
        @Column(name = "khu_vuc_kho_id", nullable = false)
        Integer khuVucKhoId;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Entity(name = "DotKiemKeDanhMuc")
    @IdClass(DanhMucId.class)
    @Table(name = "dot_kiem_ke_danh_muc")
    public static class DanhMuc {
        @Id
        @Column(name = "dot_kiem_ke_id", nullable = false)
        Integer dotKiemKeId;

        @Id
        @Column(name = "danh_muc_id", nullable = false)
        Integer danhMucId;
    }
}
