package com.dev.backend.constant.variables;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Danh sách vai trò nhân sự: nguồn chung cho đăng nhập, tạo người dùng và phân quyền. */
class IRoleTypeTest {

    @Test
    @DisplayName("Đúng 5 vai trò nhân sự, không có khách hàng, không có 'all'")
    void noiBo_dungNamVaiTro() {
        assertEquals(Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_mua_hang), IRoleType.NOI_BO);
        assertFalse(IRoleType.NOI_BO.contains("khach_hang"));
        assertFalse(IRoleType.NOI_BO.contains(IRoleType.all));
    }

    @Test
    @DisplayName("Gửi yêu cầu báo giá và gửi lại email (K11): @RequireAuth trùng đúng IRoleType.GUI_YEU_CAU_BAO_GIA")
    void guiYeuCauBaoGia_vaGuiLai_dungTapVaiTroChung() throws Exception {
        assertEquals(Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_mua_hang,
                IRoleType.nhan_vien_kho), IRoleType.GUI_YEU_CAU_BAO_GIA);
        Class<?> c = com.dev.backend.controller.NghiepVuSanPhamController.class;
        java.lang.reflect.Method[] api = {
                c.getMethod("guiYeuCauDenNhaCungCap", com.dev.backend.dto.request.YeuCauDenNhaCungCapCreating.class),
                c.getMethod("guiLaiYeuCauBaoGia", Integer.class)
        };
        for (java.lang.reflect.Method m : api) {
            com.dev.backend.customizeanotation.RequireAuth quyen =
                    m.getAnnotation(com.dev.backend.customizeanotation.RequireAuth.class);
            assertTrue(quyen != null, m.getName() + " phải có @RequireAuth");
            assertEquals(IRoleType.GUI_YEU_CAU_BAO_GIA, Set.of(quyen.roles()), m.getName());
            assertEquals(quyen.roles().length, Set.of(quyen.roles()).size(), "không lặp vai trò: " + m.getName());
            assertEquals(com.dev.backend.customizeanotation.RequireAuth.LogicType.OR, quyen.rolesLogic(), m.getName());
        }
    }

    @Test
    @DisplayName("laNoiBo: null, chuỗi rỗng, vai trò cũ, sai chữ hoa hay thừa khoảng trắng đều là không")
    void laNoiBo() {
        IRoleType.NOI_BO.forEach(v -> assertTrue(IRoleType.laNoiBo(v), v));
        for (String v : new String[]{null, "", " ", "khach_hang", "all", "QUAN_TRI_VIEN", " quan_tri_vien"}) {
            assertFalse(IRoleType.laNoiBo(v), String.valueOf(v));
        }
    }
}
