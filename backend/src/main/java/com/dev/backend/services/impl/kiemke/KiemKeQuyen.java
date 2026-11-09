package com.dev.backend.services.impl.kiemke;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.DotKiemKe;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import com.dev.backend.i18n.ThongDiep;

/**
 * Ai được làm gì với đợt kiểm kê (chốt Đ7). Controller đã chặn theo vai trò / quyền tại kho đang chọn; ở đây tính cờ
 * cho giao diện và kiểm thêm theo đợt.
 * <ul>
 *   <li>Tạo, sửa nháp, Bắt đầu, Hủy: quản lý kho của kho.</li>
 *   <li>Đếm, lô phát sinh, ảnh, Trình duyệt: nhân viên kho và quản lý kho của kho.</li>
 *   <li>Đếm lại, Phê duyệt: quản lý kho có quyền dieu_chinh_ton_kho tại kho.</li>
 *   <li>Quản trị viên làm được mọi bước, ở mọi kho.</li>
 * </ul>
 * Người chủ trì được tự duyệt đợt của mình (Đ8); nhật ký ghi rõ.
 */
@Component
public class KiemKeQuyen {

    private final NguoiDungRepository nguoiDungRepository;
    private final JwtService jwtService;

    public KiemKeQuyen(NguoiDungRepository nguoiDungRepository, JwtService jwtService) {
        this.nguoiDungRepository = nguoiDungRepository;
        this.jwtService = jwtService;
    }

    public NguoiDungAuthInfo nguoiXem() {
        return SecurityContextHolder.getUser();
    }

    public NguoiDung nguoiHienTai() {
        NguoiDungAuthInfo u = SecurityContextHolder.getUser();
        if (u == null || u.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("khoVanHanh.phienKhongHopLe"));
        }
        return nguoiDungRepository.findById(u.getId())
                .orElseThrow(() -> new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("khoVanHanh.khongTimThayNguoiDangNhap")));
    }

    public static boolean co(NguoiDungAuthInfo u, String vaiTro) {
        return u != null && u.getVaiTro() != null && u.getVaiTro().contains(vaiTro);
    }

    public static boolean laQuanTri(NguoiDungAuthInfo u) {
        return co(u, IRoleType.quan_tri_vien);
    }

    /** Đang làm việc ở đúng kho của đợt (quản trị viên luôn đúng). */
    public static boolean dungKho(NguoiDungAuthInfo u, DotKiemKe dot) {
        if (laQuanTri(u)) return true;
        Integer kho = SecurityContextHolder.getKhoId();
        return u != null && dot.getKho() != null && kho != null && kho.equals(dot.getKho().getId());
    }

    public boolean duocDuyet(NguoiDungAuthInfo u, DotKiemKe dot) {
        if (laQuanTri(u)) return true;
        return co(u, IRoleType.quan_ly_kho) && dungKho(u, dot)
                && jwtService.hasAnyPermissionInWorkSpace(dot.getKho().getId(), u, IPermissionType.dieu_chinh_ton_kho);
    }

    public KiemKeDto.Quyen quyen(DotKiemKe dot) {
        NguoiDungAuthInfo u = nguoiXem();
        byte tt = dot.getTrangThai() == null ? IKiemKe.NHAP : dot.getTrangThai();
        boolean quanLy = laQuanTri(u) || (co(u, IRoleType.quan_ly_kho) && dungKho(u, dot));
        boolean dem = laQuanTri(u) || ((co(u, IRoleType.quan_ly_kho) || co(u, IRoleType.nhan_vien_kho)) && dungKho(u, dot));
        boolean moi = Integer.valueOf(2).equals(dot.getPhienBanPhamVi());
        return new KiemKeDto.Quyen(
                moi && tt == IKiemKe.NHAP && quanLy,
                moi && tt == IKiemKe.NHAP && quanLy,
                moi && tt == IKiemKe.DANG_KIEM_KE && dem,
                moi && tt == IKiemKe.DANG_KIEM_KE && dem,
                moi && tt == IKiemKe.CHO_DUYET && duocDuyet(u, dot),
                moi && tt == IKiemKe.CHO_DUYET && duocDuyet(u, dot),
                moi && (tt == IKiemKe.NHAP || tt == IKiemKe.DANG_KIEM_KE || tt == IKiemKe.CHO_DUYET) && quanLy);
    }
}
