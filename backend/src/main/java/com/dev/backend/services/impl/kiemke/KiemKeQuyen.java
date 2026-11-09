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
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.LichSuKiemKeRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import com.dev.backend.i18n.ThongDiep;

import java.util.List;

/**
 * Ai được làm gì với đợt kiểm kê (chốt Đ7). Controller đã chặn theo vai trò / quyền tại kho đang chọn; ở đây tính cờ
 * cho giao diện và kiểm thêm theo đợt.
 * <ul>
 *   <li>Tạo, sửa nháp, xem trước phạm vi: quản lý kho của kho, hoặc nhân viên kho có quyền {@code tao_dot_kiem_ke} tại kho
 *   (BA mục 3, chốt 10/11); nhân viên chỉ sửa nháp do chính mình lập.</li>
 *   <li>Bắt đầu, Hủy: quản lý kho của kho.</li>
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
    private final LichSuKiemKeRepository nhatKyRepo;

    public KiemKeQuyen(NguoiDungRepository nguoiDungRepository, JwtService jwtService, LichSuKiemKeRepository nhatKyRepo) {
        this.nguoiDungRepository = nguoiDungRepository;
        this.jwtService = jwtService;
        this.nhatKyRepo = nhatKyRepo;
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

    /** Quản trị viên / quản lý kho: lập đợt sẵn theo vai trò. Nhân viên kho: cần quyền tao_dot_kiem_ke tại kho. */
    public boolean duocLapDot(NguoiDungAuthInfo u, Integer khoId) {
        if (laQuanTri(u) || co(u, IRoleType.quan_ly_kho)) return true;
        return co(u, IRoleType.nhan_vien_kho) && khoId != null
                && jwtService.hasAnyPermissionInWorkSpace(khoId, u, IPermissionType.tao_dot_kiem_ke);
    }

    /** Chặn lập / sửa nháp / xem trước phạm vi khi người đang đăng nhập không được lập đợt ở kho {@code khoId}. */
    public void batBuocLapDot(Integer khoId) {
        if (!duocLapDot(nguoiXem(), khoId)) {
            throw new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.STK_INVALID_STATE,
                    ThongDiep.of("khoVanHanh.khongCoQuyenLapDotKiemKe"));
        }
    }

    /** Lập đợt nhờ quyền tao_dot_kiem_ke (không phải quản trị viên / quản lý kho). */
    static boolean lapNhoQuyen(NguoiDungAuthInfo u) {
        return !laQuanTri(u) && !co(u, IRoleType.quan_ly_kho) && co(u, IRoleType.nhan_vien_kho);
    }

    /** Người lập đợt (theo nhật ký "Tạo đợt"); null nếu không có nhật ký. */
    Integer nguoiLap(DotKiemKe dot) {
        List<Integer> ds = nhatKyRepo.nguoiThucHienTheoHanhDong(dot.getId(), IKiemKe.HD_TAO);
        return ds.isEmpty() ? null : ds.get(0);
    }

    /**
     * Sửa nháp (chưa xét trạng thái): quản trị viên; quản lý kho của kho; nhân viên kho có quyền lập đợt tại kho, chỉ với
     * nháp do chính mình lập (Đ2 chốt 10/11).
     */
    public boolean duocSuaNhap(NguoiDungAuthInfo u, DotKiemKe dot) {
        if (laQuanTri(u)) return true;
        if (!dungKho(u, dot)) return false;
        if (co(u, IRoleType.quan_ly_kho)) return true;
        return lapNhoQuyen(u) && duocLapDot(u, dot.getKho().getId()) && u.getId() != null
                && u.getId().equals(nguoiLap(dot));
    }

    /** Chặn sửa nháp: báo đúng lý do (chưa có quyền lập đợt / nháp của người khác). */
    public void batBuocSuaNhap(DotKiemKe dot) {
        NguoiDungAuthInfo u = nguoiXem();
        if (duocSuaNhap(u, dot)) return;
        boolean coQuyenLap = dungKho(u, dot) && duocLapDot(u, dot.getKho().getId());
        throw new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.STK_INVALID_STATE, ThongDiep.of(
                coQuyenLap ? "khoVanHanh.chiSuaNhapDoMinhLap" : "khoVanHanh.khongCoQuyenLapDotKiemKe"));
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
                moi && tt == IKiemKe.NHAP && (quanLy || duocSuaNhap(u, dot)),
                moi && tt == IKiemKe.NHAP && quanLy,
                moi && tt == IKiemKe.DANG_KIEM_KE && dem,
                moi && tt == IKiemKe.DANG_KIEM_KE && dem,
                moi && tt == IKiemKe.CHO_DUYET && duocDuyet(u, dot),
                moi && tt == IKiemKe.CHO_DUYET && duocDuyet(u, dot),
                moi && (tt == IKiemKe.NHAP || tt == IKiemKe.DANG_KIEM_KE || tt == IKiemKe.CHO_DUYET) && quanLy);
    }
}
