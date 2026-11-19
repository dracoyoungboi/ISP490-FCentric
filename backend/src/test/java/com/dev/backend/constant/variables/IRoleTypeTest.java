package com.dev.backend.constant.variables;

import com.dev.backend.controller.*;
import com.dev.backend.customizeanotation.RequireAuth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.*;

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Vai trò nhân sự và phân quyền theo ma trận SRS mục 4.4 (F-ORWMS SRS v1.0). Quản trị viên tạm giữ toàn quyền
 * (AuthorizationAspect cho qua mọi kiểm); 4 vai trò còn lại theo từng dòng của ma trận và các điểm đã chốt:
 * Đ1 in tem cho quản lý kho, nhân viên kho, nhân viên bán hàng; Đ2 quản lý kho xem đơn bán chỉ đọc; Đ3 báo cáo theo
 * UC 11.3–11.5; Đ4 xuất kế toán MISA chỉ quản trị viên; Đ5 quản lý kho chỉ xem thông tin cửa hàng, mẫu in.
 */
class IRoleTypeTest {

    static final String QT = IRoleType.quan_tri_vien;
    static final String QLK = IRoleType.quan_ly_kho;
    static final String NVK = IRoleType.nhan_vien_kho;
    static final String NVMH = IRoleType.nhan_vien_mua_hang;
    static final String NVBH = IRoleType.nhan_vien_ban_hang;
    static final Set<String> TAT_CA = Set.of(QT, QLK, NVK, NVMH, NVBH);
    static final List<String> DONG_TU = List.of("GET", "POST", "PUT", "DELETE", "PATCH");
    // Hai controller không public: lấy theo tên
    static final Class<?> DIEU_HANH = lop("DieuHanhHeThongController");
    static final Class<?> DANH_MUC = lop("DanhMucQuanAoController");

    static Class<?> lop(String ten) {
        try {
            return Class.forName("com.dev.backend.controller." + ten);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }

    // ───────── tiện ích đọc @RequireAuth trên controller ─────────

    /** Mọi controller REST của ứng dụng. */
    static List<Class<?>> controller() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider quet = new ClassPathScanningCandidateComponentProvider(false);
        quet.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<Class<?>> ds = new ArrayList<>();
        for (BeanDefinition bd : quet.findCandidateComponents("com.dev.backend.controller")) {
            ds.add(Class.forName(bd.getBeanClassName()));
        }
        assertTrue(ds.size() > 30, "phải quét được các controller, thấy " + ds.size());
        return ds;
    }

    /** Đường dẫn khai báo trên phương thức cho động từ HTTP; null nếu phương thức không có mapping đó. */
    static List<String> duongDan(Method m, String dongTu) {
        Annotation a = switch (dongTu) {
            case "GET" -> m.getAnnotation(GetMapping.class);
            case "POST" -> m.getAnnotation(PostMapping.class);
            case "PUT" -> m.getAnnotation(PutMapping.class);
            case "DELETE" -> m.getAnnotation(DeleteMapping.class);
            case "PATCH" -> m.getAnnotation(PatchMapping.class);
            default -> null;
        };
        if (a == null) return null;
        List<String> ds = new ArrayList<>();
        try {
            ds.addAll(List.of((String[]) a.annotationType().getMethod("value").invoke(a)));
            ds.addAll(List.of((String[]) a.annotationType().getMethod("path").invoke(a)));
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return ds.isEmpty() ? List.of("") : ds;
    }

    /** Động từ HTTP của phương thức (null nếu không phải API). */
    static String dongTu(Method m) {
        return DONG_TU.stream().filter(d -> duongDan(m, d) != null).findFirst().orElse(null);
    }

    /** API chỉ đọc: GET, hoặc POST tra cứu danh sách (/filter). */
    static boolean chiDoc(Method m) {
        String d = dongTu(m);
        return "GET".equals(d) || ("POST".equals(d) && duongDan(m, d).contains("/filter"));
    }

    static RequireAuth yeuCau(Class<?> c, String dongTu, String duong) {
        for (Method m : c.getDeclaredMethods()) {
            List<String> ds = duongDan(m, dongTu);
            if (ds != null && ds.contains(duong)) {
                RequireAuth ra = m.getAnnotation(RequireAuth.class);
                assertNotNull(ra, c.getSimpleName() + " " + dongTu + " " + duong + " phải bắt buộc đăng nhập");
                return ra;
            }
        }
        throw new AssertionError("Không thấy " + dongTu + " " + duong + " trong " + c.getSimpleName());
    }

    static Set<String> vaiTro(Class<?> c, String dongTu, String duong) {
        RequireAuth ra = yeuCau(c, dongTu, duong);
        assertEquals(ra.roles().length, Set.of(ra.roles()).size(), "lặp vai trò: " + c.getSimpleName() + " " + duong);
        return Set.of(ra.roles());
    }

    static Set<String> vaiTro(Method m) {
        return Set.of(m.getAnnotation(RequireAuth.class).roles());
    }

    /** Mọi phương thức có mapping và @RequireAuth của một controller. */
    static List<Method> api(Class<?> c) {
        List<Method> ds = Arrays.stream(c.getDeclaredMethods())
                .filter(m -> dongTu(m) != null && m.isAnnotationPresent(RequireAuth.class))
                .toList();
        assertFalse(ds.isEmpty(), "không thấy API của " + c.getSimpleName());
        return ds;
    }

    static String ten(Method m) {
        String d = dongTu(m);
        return m.getDeclaringClass().getSimpleName() + "." + m.getName() + (d == null ? "" : " (" + d + " " + duongDan(m, d) + ")");
    }

    // ───────── Vai trò nhân sự ─────────

    @Test
    @DisplayName("Đúng 5 vai trò nhân sự, không có khách hàng, không có 'all'")
    void noiBo_dungNamVaiTro() {
        assertEquals(TAT_CA, IRoleType.NOI_BO);
        assertFalse(IRoleType.NOI_BO.contains("khach_hang"));
        assertFalse(IRoleType.NOI_BO.contains(IRoleType.all));
    }

    @Test
    @DisplayName("laNoiBo: null, chuỗi rỗng, vai trò cũ, sai chữ hoa hay thừa khoảng trắng đều là không")
    void laNoiBo() {
        IRoleType.NOI_BO.forEach(v -> assertTrue(IRoleType.laNoiBo(v), v));
        for (String v : new String[]{null, "", " ", "khach_hang", "all", "QUAN_TRI_VIEN", " quan_tri_vien"}) {
            assertFalse(IRoleType.laNoiBo(v), String.valueOf(v));
        }
    }

    @Test
    @DisplayName("Gửi yêu cầu báo giá và gửi lại email (K11): @RequireAuth trùng đúng IRoleType.GUI_YEU_CAU_BAO_GIA")
    void guiYeuCauBaoGia_vaGuiLai_dungTapVaiTroChung() throws Exception {
        // SRS 4.4 "RFQ – Create / View / Process": chỉ nhân viên mua hàng (và quản trị viên)
        assertEquals(Set.of(QT, NVMH), IRoleType.GUI_YEU_CAU_BAO_GIA);
        Class<?> c = NghiepVuSanPhamController.class;
        Method[] ds = {
                c.getMethod("guiYeuCauDenNhaCungCap", com.dev.backend.dto.request.YeuCauDenNhaCungCapCreating.class),
                c.getMethod("guiLaiYeuCauBaoGia", Integer.class)
        };
        for (Method m : ds) {
            RequireAuth quyen = m.getAnnotation(RequireAuth.class);
            assertNotNull(quyen, m.getName() + " phải có @RequireAuth");
            assertEquals(IRoleType.GUI_YEU_CAU_BAO_GIA, Set.of(quyen.roles()), m.getName());
            assertEquals(quyen.roles().length, Set.of(quyen.roles()).size(), "không lặp vai trò: " + m.getName());
            assertEquals(RequireAuth.LogicType.OR, quyen.rolesLogic(), m.getName());
        }
    }

    @Test
    @DisplayName("Mọi vai trò khai báo trong @RequireAuth của mọi API là vai trò nhân sự hoặc 'all', không lặp")
    void moiVaiTroTrongRequireAuthDeuHopLe() throws Exception {
        List<String> loi = new ArrayList<>();
        for (Class<?> c : controller()) {
            for (Method m : Arrays.stream(c.getDeclaredMethods()).filter(x -> x.isAnnotationPresent(RequireAuth.class)).toList()) {
                String[] ds = m.getAnnotation(RequireAuth.class).roles();
                if (ds.length != Set.of(ds).size()) loi.add(ten(m) + ": lặp vai trò");
                for (String v : ds) {
                    if (!IRoleType.laNoiBo(v) && !IRoleType.all.equals(v)) loi.add(ten(m) + ": " + v);
                }
            }
        }
        assertTrue(loi.isEmpty(), "Vai trò lạ: " + loi);
    }

    // ───────── Ma trận phân quyền SRS 4.4: các API chính ─────────

    static Stream<Arguments> maTranSrs() {
        return Stream.of(
                // User Account, Role & Permission: chỉ quản trị viên
                Arguments.of(AdminController.class, "GET", "/user-list", Set.of(QT)),
                Arguments.of(AdminController.class, "POST", "/add-user", Set.of(QT)),
                Arguments.of(AdminController.class, "PUT", "/users/{id}/phan-quyen", Set.of(QT)),
                Arguments.of(NguoiDungController.class, "POST", "/filter", Set.of(QT)),
                Arguments.of(DIEU_HANH, "GET", "/quyen-han/all", Set.of(QT)),
                Arguments.of(DIEU_HANH, "POST", "/quyen-han/gan-quyen", Set.of(QT)),
                Arguments.of(DIEU_HANH, "DELETE", "/quyen-han/xoa-quyen/{id}", Set.of(QT)),
                Arguments.of(DIEU_HANH, "GET", "/phan-quyen/cau-hinh", Set.of(QT)),
                Arguments.of(DIEU_HANH, "PUT", "/phan-quyen/mau-quyen/{vaiTro}", Set.of(QT)),
                Arguments.of(DIEU_HANH, "PUT", "/vai-tro/gan-vai-tro", Set.of(QT)),
                // Category, Color / Size / Material, Brand: thêm, sửa, xóa chỉ quản trị viên
                Arguments.of(DANH_MUC, "POST", "/create", Set.of(QT)),
                Arguments.of(MauSacController.class, "POST", "/create", Set.of(QT)),
                Arguments.of(MauSacController.class, "DELETE", "/delete/{id}", Set.of(QT)),
                Arguments.of(SizeController.class, "POST", "/update", Set.of(QT)),
                Arguments.of(ChatLieuController.class, "POST", "", Set.of(QT)),
                Arguments.of(ChatLieuController.class, "PUT", "/{id}", Set.of(QT)),
                Arguments.of(ThuongHieuController.class, "POST", "", Set.of(QT)),
                // Product, SKU: xem mọi vai trò; tạo, sửa, bật tắt, đổi giá chỉ quản trị viên
                Arguments.of(SanPhamQuanAoController.class, "POST", "/filter", TAT_CA),
                Arguments.of(SanPhamQuanAoController.class, "GET", "/get-by-id/{id}", TAT_CA),
                Arguments.of(SanPhamQuanAoController.class, "POST", "/create", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "PUT", "/update", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "PATCH", "/basic-info/{id}", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "PATCH", "/status/{id}", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "DELETE", "/soft-delete/{id}", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "PATCH", "/sku/gia-ban", Set.of(QT)),
                Arguments.of(SanPhamQuanAoController.class, "GET", "/{id}/lich-su", Set.of(QT, QLK)),
                Arguments.of(SanPhamQuanAoController.class, "GET", "/sku/{bienTheId}/lich-su-gia", Set.of(QT, QLK)),
                // Barcode (+ UC 2.7), Đ1: in tem cho quản lý kho, nhân viên kho, nhân viên bán hàng
                Arguments.of(SanPhamQuanAoController.class, "POST", "/gia-ban/filter", Set.of(QT, QLK, NVK, NVBH)),
                Arguments.of(TemSanPhamController.class, "GET", "/cau-hinh", Set.of(QT, QLK, NVK, NVBH)),
                Arguments.of(TemSanPhamController.class, "GET", "/tra-ma", Set.of(QT, QLK, NVK, NVBH)),
                // Warehouse: thêm, sửa, ngừng kho chỉ quản trị viên; quản lý kho xem kho của mình
                Arguments.of(KhoController.class, "POST", "/create", Set.of(QT)),
                Arguments.of(KhoController.class, "PUT", "/update", Set.of(QT)),
                Arguments.of(KhoController.class, "PUT", "/{id}/trang-thai", Set.of(QT)),
                Arguments.of(KhoController.class, "GET", "/get-by-id/{id}", Set.of(QT, QLK)),
                Arguments.of(ViTriKhoController.class, "POST", "/vi-tri", Set.of(QT, QLK)),
                Arguments.of(ViTriKhoController.class, "GET", "/vi-tri", Set.of(QT, QLK, NVK)),
                // Inventory: mọi vai trò xem tồn (kho mình)
                Arguments.of(ThongKeHeThongController.class, "GET", "/ton-kho-tong-quan", TAT_CA),
                Arguments.of(ThongKeHeThongController.class, "GET", "/ton-kho", TAT_CA),
                // Inventory Transaction, Lot: vai trò kho; lô hàng toàn hệ thống chỉ quản trị viên
                Arguments.of(LichSuGiaoDichKhoController.class, "GET", "", Set.of(QT, QLK, NVK)),
                Arguments.of(LoHangController.class, "GET", "/all", Set.of(QT)),
                Arguments.of(LoHangController.class, "POST", "/filter", Set.of(QT)),
                // Supplier: nhân viên mua hàng
                Arguments.of(NhaCungCapController.class, "POST", "", Set.of(QT, NVMH)),
                Arguments.of(NhaCungCapController.class, "PUT", "/{id}", Set.of(QT, NVMH)),
                Arguments.of(NhaCungCapController.class, "DELETE", "/{id}", Set.of(QT, NVMH)),
                // Purchase Request: lập quản lý kho, nhân viên kho; duyệt quản lý kho; nhân viên mua hàng chỉ xem
                Arguments.of(NghiepVuSanPhamController.class, "POST", "/yeu-cau-mua-hang/create", Set.of(QT, QLK, NVK)),
                Arguments.of(NghiepVuSanPhamController.class, "GET", "/yeu-cau-mua-hang/hang-kho-tong", Set.of(QT, QLK, NVK)),
                Arguments.of(NghiepVuSanPhamController.class, "PUT", "/yeu-cau-mua-hang/duyet-tu-choi/{id}/{trangThai}", Set.of(QT, QLK)),
                Arguments.of(YeuCauMuaHangController.class, "POST", "/filter", Set.of(QT, QLK, NVK, NVMH)),
                Arguments.of(YeuCauMuaHangController.class, "GET", "/get-by-id/{id}", Set.of(QT, QLK, NVK, NVMH)),
                // RFQ: nhân viên mua hàng; chốt báo giá thành đơn mua (Purchase Order – Approve): quản lý kho + UC 4.7
                Arguments.of(NghiepVuSanPhamController.class, "POST", "/don-mua-hang/gui-yeu-cau-bao-gia", Set.of(QT, NVMH)),
                Arguments.of(NghiepVuSanPhamController.class, "POST", "/don-mua-hang/{id}/gui-lai-yeu-cau", Set.of(QT, NVMH)),
                Arguments.of(NghiepVuSanPhamController.class, "PUT", "/don-mua-hang/duyet-don/{id}/{trangThai}", Set.of(QT, QLK, NVMH)),
                Arguments.of(DonMuaHangController.class, "POST", "/filter", Set.of(QT, QLK, NVMH, NVK)),
                Arguments.of(DonMuaHangController.class, "PUT", "/huy-don/{id}", Set.of(QT, NVMH)),
                Arguments.of(DonMuaHangController.class, "PUT", "/dong-don/{id}", Set.of(QT, NVMH)),
                // Goods Receipt: vai trò kho; nhân viên mua hàng chỉ xem
                Arguments.of(PhieuNhapKhoController.class, "POST", "/filter", Set.of(QT, QLK, NVK, NVMH)),
                Arguments.of(PhieuNhapKhoController.class, "GET", "/{id}/detail", Set.of(QT, QLK, NVK, NVMH)),
                Arguments.of(PhieuNhapKhoController.class, "GET", "/{phieuNhapKhoId}/bien-the/{bienTheSanPhamId}/lo-hang", Set.of(QT, QLK, NVK, NVMH)),
                Arguments.of(BienBanTraHangController.class, "GET", "/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang", Set.of(QT, QLK, NVK, NVMH)),
                Arguments.of(BienBanTraHangController.class, "POST", "/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang", Set.of(QT, QLK, NVK)),
                Arguments.of(PhieuNhapKhoController.class, "POST", "/create", Set.of(QT, QLK, NVK)),
                Arguments.of(PhieuNhapKhoController.class, "PUT", "/{id}/complete", Set.of(QT, QLK, NVK)),
                Arguments.of(PhieuNhapKhoController.class, "GET", "/{id}/so-luong-in-tem", Set.of(QT, QLK, NVK)),
                Arguments.of(KeToanController.class, "GET", "/hoa-don-dau-vao/{phieuNhapKhoId}", Set.of(QT, QLK, NVK, NVMH)),
                // Goods Issue, Stock Transfer, Stock Take, Adjustment: vai trò kho; duyệt, hủy quản lý kho
                Arguments.of(PhieuXuatKhoController.class, "POST", "/create", Set.of(QT, QLK, NVK)),
                Arguments.of(PhieuXuatKhoController.class, "PUT", "/{id}/cancel", Set.of(QT, QLK)),
                Arguments.of(PhieuXuatKhoController.class, "GET", "/{id}/view", Set.of(QT, QLK, NVK, NVBH)),
                Arguments.of(NhatHangController.class, "GET", "/pick-list/{id}/nguoi-nhat", Set.of(QT, QLK)),
                Arguments.of(PhieuChuyenKhoController.class, "POST", "/create", Set.of(QT, QLK, NVK)),
                Arguments.of(PhieuChuyenKhoController.class, "PUT", "/{id}/duyet", Set.of(QT, QLK)),
                Arguments.of(PhieuChuyenKhoController.class, "PUT", "/{id}/tu-choi", Set.of(QT, QLK)),
                Arguments.of(PhieuChuyenKhoController.class, "PUT", "/{id}/xu-ly-chenh-lech", Set.of(QT, QLK)),
                Arguments.of(KiemKeController.class, "POST", "", Set.of(QT, QLK, NVK)),
                Arguments.of(KiemKeController.class, "POST", "/{id}/bat-dau", Set.of(QT, QLK)),
                Arguments.of(KiemKeController.class, "POST", "/{id}/phe-duyet", Set.of(QT, QLK)),
                Arguments.of(KiemKeController.class, "POST", "/{id}/huy", Set.of(QT, QLK)),
                // Internal Bin Relocation: vai trò kho và nhân viên bán hàng
                Arguments.of(ChuyenKeNoiBoController.class, "POST", "", Set.of(QT, QLK, NVK, NVBH)),
                // Sales Order: nhân viên bán hàng; riêng send-to-warehouse mở thêm cho quản lý kho để service cô lập Quản lý Kho Tổng với đơn Shopify
                Arguments.of(DonBanHangController.class, "POST", "/filter", Set.of(QT, QLK, NVK, NVBH)),
                Arguments.of(DonBanHangController.class, "GET", "/{id}/detail", Set.of(QT, QLK, NVK, NVBH)),
                Arguments.of(DonBanHangController.class, "PUT", "/{id}/cancel", Set.of(QT, NVBH)),
                Arguments.of(DonBanHangController.class, "PUT", "/{id}/send-to-warehouse", Set.of(QT, NVBH, QLK)),
                Arguments.of(DonBanHangController.class, "GET", "/kpi-hom-nay", Set.of(QT, NVBH)),
                // Customer: nhân viên bán hàng
                Arguments.of(KhachHangController.class, "POST", "/filter", Set.of(QT, NVBH)),
                // POS Payment, thu tiền: nhân viên bán hàng; đối soát, hoàn tiền: quản trị viên
                Arguments.of(PosController.class, "POST", "/checkout", Set.of(QT, NVBH)),
                Arguments.of(PosController.class, "POST", "/payos/payment-links", Set.of(QT, NVBH)),
                Arguments.of(PosController.class, "GET", "/payment-methods", Set.of(QT, NVBH)),
                Arguments.of(ThanhToanController.class, "POST", "/don/{donId}/thu", Set.of(QT, NVBH)),
                Arguments.of(ThanhToanController.class, "POST", "/don/{donId}/hoan-tien", Set.of(QT)),
                // Reports (UC 11.3–11.5, Đ3), Administration Dashboard, MISA (Đ4)
                Arguments.of(AdminDashboardController.class, "GET", "", Set.of(QT)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/doanh-thu", Set.of(QT)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/doanh-thu/tong-hop", Set.of(QT, NVBH)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/doanh-thu/xuat-excel", Set.of(QT)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/san-pham", Set.of(QT, NVBH)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/san-pham/xuat-excel", Set.of(QT)),
                Arguments.of(AdminDashboardController.class, "GET", "/bao-cao/tien-thu", Set.of(QT, NVBH)),
                Arguments.of(NhatKyNhapXuatController.class, "GET", "/tong-hop", Set.of(QT, QLK, NVK)),
                Arguments.of(NhatKyNhapXuatController.class, "GET", "/xuat-excel", Set.of(QT, QLK, NVK)),
                Arguments.of(KhachHangReportController.class, "GET", "", Set.of(QT, NVBH)),
                Arguments.of(KhachHangReportController.class, "GET", "/xuat-excel", Set.of(QT, NVBH)),
                Arguments.of(KeToanController.class, "POST", "/lo-xuat", Set.of(QT)),
                // Cấu hình (Đ5): quản lý kho chỉ xem thông tin cửa hàng, mẫu in
                Arguments.of(ThongTinCongTyController.class, "GET", "", TAT_CA),
                Arguments.of(ThongTinCongTyController.class, "PUT", "", Set.of(QT)),
                Arguments.of(ThongTinCongTyController.class, "POST", "/logo", Set.of(QT)),
                Arguments.of(CauHinhMauInController.class, "GET", "", TAT_CA),
                Arguments.of(CauHinhMauInController.class, "PUT", "/{documentType}/{templateId}", Set.of(QT)),
                Arguments.of(CauHinhMauInController.class, "PUT", "/{documentType}/active", Set.of(QT)),
                Arguments.of(CauHinhMauInController.class, "POST", "/migrate", Set.of(QT)),
                Arguments.of(CauHinhMauInController.class, "GET", "/{documentType}/lich-su", Set.of(QT, QLK)),
                Arguments.of(CauHinhThanhToanController.class, "PUT", "", Set.of(QT)),
                // Omnichannel Integration: chỉ quản trị viên
                Arguments.of(KenhBanHangController.class, "GET", "/{maKenh}/ket-noi", Set.of(QT)),
                Arguments.of(KenhBanHangController.class, "DELETE", "/{maKenh}/ket-noi", Set.of(QT)),
                Arguments.of(KenhBanHangController.class, "POST", "/{maKenh}/day-ton", Set.of(QT)),
                Arguments.of(KenhBanHangController.class, "POST", "/dong-bo-tat-ca", Set.of(QT))
        );
    }

    @ParameterizedTest(name = "{0} {1} {2}")
    @MethodSource("maTranSrs")
    @DisplayName("Ma trận SRS 4.4: vai trò của API chính đúng dòng ma trận và điểm đã chốt")
    void maTranSrs_vaiTroApi(Class<?> c, String dongTu, String duong, Set<String> mongDoi) {
        assertEquals(mongDoi, vaiTro(c, dongTu, duong), c.getSimpleName() + " " + dongTu + " " + duong);
    }

    @Nested
    @DisplayName("Theo từng module")
    class TheoModule {

        @Test
        @DisplayName("Khách hàng: mọi API chỉ quản trị viên và nhân viên bán hàng")
        void khachHang_chiNguoiBan() {
            api(KhachHangController.class).forEach(m -> assertEquals(Set.of(QT, NVBH), vaiTro(m), ten(m)));
        }

        @Test
        @DisplayName("Trả hàng tại quầy: mọi API chỉ quản trị viên và nhân viên bán hàng (PIN quản lý nhập trên máy người bán)")
        void traHangTaiQuay_chiNguoiBan() {
            api(PosTraHangController.class).forEach(m -> assertEquals(Set.of(QT, NVBH), vaiTro(m), ten(m)));
        }

        @Test
        @DisplayName("Bán tại quầy: quản lý kho, nhân viên kho chỉ còn các API đọc tồn, tra mã, trạng thái kiểm kê")
        void banTaiQuay_khoChiDoc() {
            Set<String> doc = new TreeSet<>();
            for (Method m : api(PosController.class)) {
                Set<String> vt = vaiTro(m);
                assertFalse(vt.contains(NVMH), ten(m));
                if (vt.contains(QLK) || vt.contains(NVK)) {
                    assertEquals("GET", dongTu(m), "API ghi của POS không cho vai trò kho: " + ten(m));
                    doc.addAll(duongDan(m, "GET"));
                }
            }
            assertEquals(new TreeSet<>(Set.of("/catalog/groups", "/stock", "/kiem-ke", "/lookup")), doc);
        }

        @Test
        @DisplayName("Kênh bán hàng: ngoài quản trị viên chỉ còn API giao hàng, vận đơn Shopee cho người xuất kho")
        void kenhBan_khoChiConApiGiaoHang() {
            Set<String> cho = new TreeSet<>();
            for (Method m : api(KenhBanHangController.class)) {
                Set<String> vt = vaiTro(m);
                if (vt.equals(Set.of(QT))) continue;
                assertEquals(Set.of(QT, QLK, NVK), vt, ten(m));
                cho.addAll(duongDan(m, dongTu(m)));
            }
            assertEquals(new TreeSet<>(Set.of("/shopee/orders/{orderSn}/shipping-parameter", "/shopee/orders/{orderSn}/ship",
                    "/shopee/orders/{orderSn}/tracking-number", "/shopee/orders/{orderSn}/tracking-info",
                    "/shopee/orders/{orderSn}/shipping-document")), cho);
        }

        @Test
        @DisplayName("Thuộc tính, thương hiệu, danh mục: API ghi chỉ quản trị viên; API đọc cho mọi vai trò (ô chọn, bộ lọc)")
        void thuocTinh_ghiChiQuanTri_docChoMoiVaiTro() {
            for (Class<?> c : List.of(MauSacController.class, SizeController.class, ChatLieuController.class,
                    ThuongHieuController.class, DANH_MUC)) {
                for (Method m : api(c)) {
                    Set<String> vt = vaiTro(m);
                    if (chiDoc(m)) {
                        assertTrue(vt.contains(IRoleType.all) || vt.containsAll(TAT_CA), "đọc: " + ten(m));
                    } else {
                        assertEquals(Set.of(QT), vt, "ghi: " + ten(m));
                    }
                }
            }
        }

        @Test
        @DisplayName("Sản phẩm: API ghi chỉ quản trị viên (SRS: Product – Create / Update / Deactivate: Admin)")
        void sanPham_ghiChiQuanTri() {
            for (Method m : api(SanPhamQuanAoController.class)) {
                if (chiDoc(m) || duongDan(m, dongTu(m)).contains("/gia-ban/filter")) continue;
                assertEquals(Set.of(QT), vaiTro(m), ten(m));
            }
        }

        @Test
        @DisplayName("Chứng từ kho: nhân viên mua hàng, nhân viên bán hàng chỉ có API đọc")
        void chungTuKho_nguoiMuaNguoiBanChiDoc() {
            for (Class<?> c : List.of(PhieuNhapKhoController.class, PhieuXuatKhoController.class,
                    PhieuChuyenKhoController.class, KiemKeController.class, NhatHangController.class,
                    DongGoiController.class, ViTriKhoController.class, BienBanTraHangController.class,
                    LichSuGiaoDichKhoController.class, MaVachNhaCungCapController.class)) {
                for (Method m : api(c)) {
                    Set<String> vt = vaiTro(m);
                    if (vt.contains(NVMH) || vt.contains(NVBH)) assertTrue(chiDoc(m), "ghi chứng từ kho: " + ten(m));
                }
            }
        }

        @Test
        @DisplayName("Đơn bán (Đ2): nhân viên kho chỉ có API đọc; quản lý kho chỉ đọc trừ PUT send-to-warehouse (cô lập Quản lý Kho Tổng với Shopify ở service)")
        void donBan_vaiTroKhoChiDoc() {
            for (Method m : api(DonBanHangController.class)) {
                Set<String> vt = vaiTro(m);
                assertFalse(vt.contains(NVMH), ten(m));
                if (vt.contains(NVK)) assertTrue(chiDoc(m), ten(m));
                if (vt.contains(QLK) && !duongDan(m, dongTu(m)).contains("/{id}/send-to-warehouse")) {
                    assertTrue(chiDoc(m), ten(m));
                }
            }
        }

        @Test
        @DisplayName("Đơn mua, yêu cầu mua: nhân viên bán hàng không có API nào")
        void donMua_khongChoNguoiBan() {
            for (Class<?> c : List.of(DonMuaHangController.class, YeuCauMuaHangController.class,
                    NghiepVuSanPhamController.class)) {
                for (Method m : api(c)) assertFalse(vaiTro(m).contains(NVBH), ten(m));
            }
        }

        @Test
        @DisplayName("Lập yêu cầu nhập: theo kho đang chọn, không đòi quyền chi tiết nào")
        void lapYeuCauNhap_theoKho_khongDoiQuyen() {
            for (String[] a : new String[][]{{"POST", "/yeu-cau-mua-hang/create"}, {"GET", "/yeu-cau-mua-hang/hang-kho-tong"}}) {
                RequireAuth ra = yeuCau(NghiepVuSanPhamController.class, a[0], a[1]);
                assertTrue(ra.inWarehouse(), a[1]);
                assertEquals(0, ra.permissions().length, a[1]);
            }
        }

        @Test
        @DisplayName("Gán quyền kiểu cũ: chỉ quản trị viên, không còn dựa quyền 'Cấp quyền nhân viên' của quản lý kho")
        void ganQuyenCu_khongConQuyenCapQuyen() {
            for (String[] a : new String[][]{{"POST", "/quyen-han/gan-quyen"}, {"DELETE", "/quyen-han/xoa-quyen/{id}"},
                    {"GET", "/quyen-han/all"}}) {
                RequireAuth ra = yeuCau(DIEU_HANH, a[0], a[1]);
                assertEquals(0, ra.permissions().length, a[1]);
                assertEquals(Set.of(QT), Set.of(ra.roles()), a[1]);
            }
        }

        @Test
        @DisplayName("Kế toán (Đ4): lô xuất MISA, chứng từ, cấu hình, lưu bảng thuế suất chỉ quản trị viên")
        void keToan_chiQuanTri() {
            int dem = 0;
            for (Method m : api(KeToanController.class)) {
                String d = duongDan(m, dongTu(m)).get(0);
                // Hóa đơn đầu vào đi theo phiếu nhập; đọc bảng thuế suất phục vụ màn đó
                if (d.startsWith("/hoa-don-dau-vao") || ("/thue-suat".equals(d) && "GET".equals(dongTu(m)))) continue;
                assertEquals(Set.of(QT), vaiTro(m), ten(m));
                dem++;
            }
            assertTrue(dem >= 9, "phải kiểm đủ API lô xuất, chứng từ, cấu hình; thấy " + dem);
        }

        @Test
        @DisplayName("Báo cáo xuất Excel: quyền 'Xuất báo cáo' kèm theo kho đang chọn")
        void xuatExcel_doiQuyenXuatBaoCao() {
            for (Object[] a : new Object[][]{{AdminDashboardController.class, "/bao-cao/doanh-thu/xuat-excel"},
                    {AdminDashboardController.class, "/bao-cao/san-pham/xuat-excel"},
                    {NhatKyNhapXuatController.class, "/xuat-excel"}, {KhachHangReportController.class, "/xuat-excel"},
                    {ThongKeHeThongController.class, "/ton-kho-tong-quan/xuat-excel"}}) {
                RequireAuth ra = yeuCau((Class<?>) a[0], "GET", (String) a[1]);
                assertArrayEquals(new String[]{IPermissionType.xuat_bao_cao}, ra.permissions(), (String) a[1]);
                assertTrue(ra.inWarehouse(), (String) a[1]);
            }
        }

        @Test
        @DisplayName("Duyệt, hủy chứng từ đòi đúng quyền chi tiết của quản lý kho")
        void duyetHuy_doiQuyenChiTiet() {
            assertArrayEquals(new String[]{IPermissionType.huy_phieu_xuat},
                    yeuCau(PhieuXuatKhoController.class, "PUT", "/{id}/cancel").permissions());
            assertArrayEquals(new String[]{IPermissionType.huy_phieu_nhap},
                    yeuCau(PhieuNhapKhoController.class, "PUT", "/{id}/cancel").permissions());
            assertArrayEquals(new String[]{IPermissionType.dieu_chinh_ton_kho},
                    yeuCau(KiemKeController.class, "POST", "/{id}/phe-duyet").permissions());
            assertArrayEquals(new String[]{IPermissionType.tao_phieu_nhap},
                    yeuCau(PhieuNhapKhoController.class, "POST", "/create").permissions());
            assertArrayEquals(new String[]{IPermissionType.tao_phieu_xuat},
                    yeuCau(PhieuXuatKhoController.class, "POST", "/create").permissions());
        }
    }

    // ───────── Trần quyền chi tiết theo vai trò ─────────

    @Nested
    @DisplayName("Trần quyền chi tiết (IPermissionType.TRAN_THEO_VAI_TRO)")
    class TranQuyen {

        @Test
        @DisplayName("Đúng ma trận SRS 4.4 cho từng vai trò làm việc theo kho")
        void dungMaTran() {
            assertEquals(Set.of(QLK, NVK, NVMH, NVBH), IPermissionType.TRAN_THEO_VAI_TRO.keySet(),
                    "chỉ vai trò làm việc theo kho có trần; quản trị viên không dùng quyền chi tiết");
            assertEquals(Set.of("xem_ton_kho", "xem_chi_tiet_lo", "dieu_chinh_ton_kho", "chuyen_kho", "tao_don_mua_hang",
                    "duyet_don_mua_hang", "tao_phieu_nhap", "duyet_phieu_nhap", "huy_phieu_nhap", "tao_phieu_xuat",
                    "duyet_phieu_xuat", "huy_phieu_xuat", "xem_bao_cao_ton_kho", "xem_bao_cao_nhap_xuat", "xuat_bao_cao"),
                    IPermissionType.TRAN_THEO_VAI_TRO.get(QLK));
            assertEquals(Set.of("xem_ton_kho", "xem_chi_tiet_lo", "chuyen_kho", "tao_dot_kiem_ke", "tao_phieu_nhap",
                    "duyet_phieu_nhap", "huy_phieu_nhap", "tao_phieu_xuat", "duyet_phieu_xuat", "xem_bao_cao_nhap_xuat",
                    "xuat_bao_cao"), IPermissionType.TRAN_THEO_VAI_TRO.get(NVK));
            assertEquals(Set.of("xem_ton_kho", "tao_don_mua_hang", "duyet_don_mua_hang", "quan_ly_nha_cung_cap", "xuat_bao_cao"),
                    IPermissionType.TRAN_THEO_VAI_TRO.get(NVMH));
            assertEquals(Set.of("xem_ton_kho", "tao_don_ban_hang", "duyet_don_ban_hang", "xem_bao_cao_doanh_thu",
                    "quan_ly_khach_hang", "xuat_bao_cao"), IPermissionType.TRAN_THEO_VAI_TRO.get(NVBH));
        }

        @Test
        @DisplayName("Dòng 'No' của ma trận: không vai trò nào có quyền người dùng, cấp quyền, sửa sản phẩm")
        void quyenChiQuanTriVien() {
            for (String vt : IPermissionType.TRAN_THEO_VAI_TRO.keySet()) {
                for (String q : List.of(IPermissionType.cap_quyen_nhan_vien, IPermissionType.quan_ly_nhan_vien_kho,
                        IPermissionType.quan_ly_san_pham)) {
                    assertFalse(IPermissionType.trongTran(vt, q), vt + " / " + q);
                }
            }
        }

        @Test
        @DisplayName("Mỗi vai trò không chạm việc của vai trò khác")
        void khongChamViecVaiTroKhac() {
            assertFalse(IPermissionType.trongTran(QLK, IPermissionType.xem_bao_cao_doanh_thu), "UC 11.3");
            assertFalse(IPermissionType.trongTran(QLK, IPermissionType.quan_ly_khach_hang), "Customer: No");
            assertFalse(IPermissionType.trongTran(QLK, IPermissionType.tao_don_ban_hang), "Sales Order: chỉ xem");
            assertFalse(IPermissionType.trongTran(QLK, IPermissionType.quan_ly_nha_cung_cap), "Supplier: No");
            assertFalse(IPermissionType.trongTran(NVK, IPermissionType.dieu_chinh_ton_kho), "duyệt điều chỉnh: quản lý kho");
            assertFalse(IPermissionType.trongTran(NVK, IPermissionType.huy_phieu_xuat), "hủy phiếu xuất: quản lý kho");
            assertFalse(IPermissionType.trongTran(NVK, IPermissionType.tao_don_mua_hang), "Purchase Order: No");
            assertFalse(IPermissionType.trongTran(NVK, IPermissionType.xem_bao_cao_doanh_thu), "UC 11.3");
            assertFalse(IPermissionType.trongTran(NVMH, IPermissionType.tao_phieu_nhap), "Goods Receipt: chỉ xem");
            assertFalse(IPermissionType.trongTran(NVMH, IPermissionType.xem_chi_tiet_lo), "Lot: No");
            assertFalse(IPermissionType.trongTran(NVMH, IPermissionType.tao_don_ban_hang), "Sales Order: No");
            assertFalse(IPermissionType.trongTran(NVBH, IPermissionType.tao_phieu_xuat), "Goods Issue: No");
            assertFalse(IPermissionType.trongTran(NVBH, IPermissionType.chuyen_kho), "Stock Transfer: No");
            assertFalse(IPermissionType.trongTran(NVBH, IPermissionType.tao_don_mua_hang), "Purchase Order: No");
            assertFalse(IPermissionType.trongTran(NVBH, IPermissionType.xem_bao_cao_nhap_xuat), "UC 11.4");
        }

        @Test
        @DisplayName("trongTran: quản trị viên, vai trò lạ, null đều là không")
        void trongTran_bien() {
            assertFalse(IPermissionType.trongTran(QT, IPermissionType.xem_ton_kho), "quản trị viên không dùng quyền chi tiết");
            assertFalse(IPermissionType.trongTran("khach_hang", IPermissionType.xem_ton_kho));
            assertFalse(IPermissionType.trongTran(null, IPermissionType.xem_ton_kho));
            assertFalse(IPermissionType.trongTran(NVK, null));
            assertFalse(IPermissionType.trongTran(null, null));
            assertFalse(IPermissionType.trongTran(NVK, "khong_co"));
            assertFalse(IPermissionType.trongTran(NVK, "XEM_TON_KHO"));
            assertTrue(IPermissionType.trongTran(NVK, IPermissionType.xem_ton_kho));
        }

        @Test
        @DisplayName("Trần không sửa được lúc chạy")
        void tranBatBien() {
            assertThrows(UnsupportedOperationException.class, () -> IPermissionType.TRAN_THEO_VAI_TRO.put(QT, Set.of()));
            assertThrows(UnsupportedOperationException.class,
                    () -> IPermissionType.TRAN_THEO_VAI_TRO.get(NVBH).add(IPermissionType.tao_phieu_xuat));
        }

        @Test
        @DisplayName("Mọi mã trong trần là mã quyền khai báo ở IPermissionType; mọi vai trò xem được tồn kho mình")
        void maTrongTranLaMaThat() throws Exception {
            Set<String> ma = new HashSet<>();
            for (Field f : IPermissionType.class.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class) ma.add((String) f.get(null));
            }
            assertEquals(24, ma.size(), "23 quyền chi tiết của bảng quyen_han + tao_dot_kiem_ke");
            IPermissionType.TRAN_THEO_VAI_TRO.forEach((vt, ds) -> {
                assertFalse(ds.isEmpty(), vt);
                ds.forEach(q -> assertTrue(ma.contains(q), vt + " / " + q));
                assertTrue(ds.contains(IPermissionType.xem_ton_kho), "Inventory – View: " + vt);
                assertTrue(ds.contains(IPermissionType.xuat_bao_cao), "xuất Excel tồn kho mình: " + vt);
            });
        }

        @Test
        @DisplayName("Quyền API kiểm cho vai trò nào đều nằm trong trần của vai trò đó (không ai bị kẹt không cấp được)")
        void quyenApiNamTrongTran() throws Exception {
            List<String> loi = new ArrayList<>();
            int soApi = 0;
            for (Class<?> c : controller()) {
                for (Method m : c.getDeclaredMethods()) {
                    RequireAuth ra = m.getAnnotation(RequireAuth.class);
                    if (ra == null || ra.permissions().length == 0) continue;
                    soApi++;
                    for (String vt : ra.roles()) {
                        if (QT.equals(vt)) continue;
                        for (String q : ra.permissions()) {
                            if (!IPermissionType.trongTran(vt, q)) loi.add(ten(m) + ": " + vt + " / " + q);
                        }
                    }
                }
            }
            assertTrue(soApi >= 10, "phải có API kiểm quyền chi tiết, thấy " + soApi);
            assertTrue(loi.isEmpty(), "Quyền ngoài trần: " + loi);
        }

        @Test
        @DisplayName("Quyền kiểm trong service (kiểm kê) nằm trong trần")
        void quyenServiceNamTrongTran() {
            assertTrue(IPermissionType.trongTran(NVK, IPermissionType.tao_dot_kiem_ke), "KiemKeQuyen.duocLapDot");
            assertTrue(IPermissionType.trongTran(QLK, IPermissionType.dieu_chinh_ton_kho), "KiemKeQuyen.duocDuyet");
        }

        @Test
        @DisplayName("Mẫu quyền nạp lần đầu (CSDL mới) nằm trong trần, đủ 4 vai trò")
        void mauBanDauTrongTran() throws Exception {
            Map<String, List<String>> mau = mauBanDau();
            assertEquals(IPermissionType.TRAN_THEO_VAI_TRO.keySet(), mau.keySet());
            mau.forEach((vt, ds) -> {
                assertEquals(ds.size(), Set.copyOf(ds).size(), "lặp quyền: " + vt);
                ds.forEach(q -> assertTrue(IPermissionType.trongTran(vt, q), vt + " / " + q));
            });
        }

        @Test
        @DisplayName("Mẫu quyền nạp lần đầu tách người lập và người duyệt cùng một chứng từ")
        void mauBanDauTachLapVaDuyet() throws Exception {
            String[][] cap = {{"tao_phieu_nhap", "duyet_phieu_nhap"}, {"tao_phieu_xuat", "duyet_phieu_xuat"},
                    {"tao_don_mua_hang", "duyet_don_mua_hang"}, {"tao_don_ban_hang", "duyet_don_ban_hang"}};
            mauBanDau().forEach((vt, ds) -> {
                for (String[] c : cap) {
                    assertFalse(ds.contains(c[0]) && ds.contains(c[1]), vt + ": vừa " + c[0] + " vừa " + c[1]);
                }
            });
        }

        @SuppressWarnings("unchecked")
        Map<String, List<String>> mauBanDau() throws Exception {
            Field f = com.dev.backend.config.PhanQuyenTableInitializer.class.getDeclaredField("MAU_BAN_DAU");
            f.setAccessible(true);
            return (Map<String, List<String>>) f.get(null);
        }
    }
}
