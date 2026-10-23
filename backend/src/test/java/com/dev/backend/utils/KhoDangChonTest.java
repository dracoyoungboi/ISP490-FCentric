package com.dev.backend.utils;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.http.HttpStatus;

import java.util.Arrays;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** Kiểm "chứng từ thuộc kho": ghi theo kho đang chọn, xem theo kho được phân, chứng từ hai kho (phiếu chuyển). */
class KhoDangChonTest {

    private static final Kho A = Kho.builder().id(1).tenKho("Kho A").build();
    private static final Kho B = Kho.builder().id(2).tenKho("Kho B").build();
    private static final Kho C = Kho.builder().id(3).tenKho("Kho C").build();

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static void dangNhap(String vaiTro, Integer khoDangChon, Integer... khoDuocPhan) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(khoDuocPhan)
                        .map(id -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(id).build()).build())
                        .toList())
                .build());
        if (khoDangChon != null) SecurityContextHolder.setKhoId(khoDangChon);
    }

    private static CommonException biChan(Executable e) {
        CommonException ex = assertThrows(CommonException.class, e);
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        assertFalse(ex.getMessage().toLowerCase().contains("bị khóa") || ex.getMessage().toLowerCase().contains("bị khoá"),
                "frontend coi lỗi có 'bị khóa' là tài khoản bị khoá và đăng xuất");
        return ex;
    }

    // ===== ghi trên chứng từ hai kho =====

    @Test
    void motTrong_khoDangChonLaMotTrongHai_choQua() {
        dangNhap(IRoleType.quan_ly_kho, 1, 1);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
        dangNhap(IRoleType.quan_ly_kho, 2, 2);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
    }

    @Test
    void motTrong_khoThuBa_biChan_cauBaoLoiGiaoDienNhanDuoc() {
        dangNhap(IRoleType.quan_ly_kho, 3, 3);
        CommonException ex = biChan(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
        assertTrue(ex.getMessage().contains("thuộc kho khác"), "màn chi tiết nhận diện câu '… thuộc kho khác'");
    }

    @Test
    void motTrong_chuaChonKho_biChan() {
        dangNhap(IRoleType.quan_ly_kho, null, 1);
        biChan(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
    }

    @Test
    void motTrong_khoThuHaiNull_chiXetKhoThuNhat() {
        dangNhap(IRoleType.quan_ly_kho, 1, 1);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraMotTrong(A, null, "Phiếu xuất PX-1"));
        dangNhap(IRoleType.quan_ly_kho, 2, 2);
        biChan(() -> KhoDangChon.kiemTraMotTrong(A, null, "Phiếu xuất PX-1"));
    }

    @Test
    void motTrong_quanTriVienVaGoiNoiBo_choQua() {
        dangNhap(IRoleType.quan_tri_vien, null);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
        SecurityContextHolder.clear(); // gọi nội bộ, không qua HTTP
        assertDoesNotThrow(() -> KhoDangChon.kiemTraMotTrong(A, B, "Phiếu chuyển PX-1"));
    }

    // ===== xem chứng từ hai kho =====

    @Test
    void xemMotTrong_duocPhanMotTrongHai_choQua_khongCanDangChon() {
        dangNhap(IRoleType.nhan_vien_kho, 3, 3, 2); // đang chọn kho C, được phân thêm kho B (kho đích)
        assertDoesNotThrow(() -> KhoDangChon.kiemTraXemMotTrong(A, B, "Phiếu chuyển PX-1"));
    }

    @Test
    void xemMotTrong_khongDuocPhanKhoNao_biChan() {
        dangNhap(IRoleType.nhan_vien_kho, 3, 3);
        CommonException ex = biChan(() -> KhoDangChon.kiemTraXemMotTrong(A, B, "Phiếu chuyển PX-1"));
        assertEquals("Bạn không thuộc kho của phiếu chuyển PX-1.", ex.getMessage());
    }

    @Test
    void xemMotTrong_khoThuHaiNull_xetKhoThuNhat() {
        dangNhap(IRoleType.nhan_vien_kho, 3, 1);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraXemMotTrong(A, null, "Phiếu xuất PX-1"));
        biChan(() -> KhoDangChon.kiemTraXemMotTrong(B, null, "Phiếu xuất PX-1"));
    }

    // ===== hành vi cũ giữ nguyên =====

    @Test
    void kiemTra_cuGiuNguyen_ghiPhaiDungKhoDangChon() {
        dangNhap(IRoleType.quan_ly_kho, 1, 1, 2);
        assertDoesNotThrow(() -> KhoDangChon.kiemTra(A, "Phiếu xuất PX-1"));
        biChan(() -> KhoDangChon.kiemTra(B, "Phiếu xuất PX-1")); // được phân kho B nhưng không đang chọn
        biChan(() -> KhoDangChon.kiemTra(C, "Phiếu xuất PX-1"));
    }

    @Test
    void kiemTraXem_cuGiuNguyen_cauBaoLoiKhongDoi() {
        dangNhap(IRoleType.quan_ly_kho, 1, 1);
        assertDoesNotThrow(() -> KhoDangChon.kiemTraXem(A, "Phiếu xuất PX-1"));
        CommonException ex = biChan(() -> KhoDangChon.kiemTraXem(B, "Phiếu xuất PX-1"));
        assertEquals("Bạn không thuộc kho của phiếu xuất PX-1.", ex.getMessage());
    }
}
