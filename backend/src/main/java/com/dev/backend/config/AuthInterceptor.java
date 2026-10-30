package com.dev.backend.config;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhienDangNhap;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.SessionRevokedException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.PhienDangNhapRepository;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.impl.entities.PhienDangNhapService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    @Autowired
    private PhienDangNhapRepository phienDangNhapRepository;

    @Autowired
    private PhienDangNhapService phienDangNhapService;

    private static final Logger log = LoggerFactory.getLogger(AuthInterceptor.class);

    // Cập nhật "hoạt động cuối" của phiên có tiết chế: chỉ ghi khi lần trước đã cũ hơn mốc này (không ghi DB mỗi request)
    private static final java.time.Duration NGUONG_CHAM_TRUY_CAP = java.time.Duration.ofMinutes(2);

    static final String LOI_PHIEN_KHONG_HOP_LE = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
    static final String LOI_QUYEN_DA_DOI = "Quyền của bạn vừa được quản trị viên thay đổi. Vui lòng đăng nhập lại.";

    @Override
    public boolean preHandle(HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) {
        // Luồng Tomcat được dùng lại cho request sau: không để request không gửi token thừa hưởng người dùng còn sót
        SecurityContextHolder.clear();
        try {
            return napNguCanh(request);
        } catch (RuntimeException e) {
            // preHandle ném lỗi (kể cả lỗi CSDL sau khi đã setUser) → afterCompletion không chạy, phải tự xóa
            SecurityContextHolder.clear();
            throw e;
        }
    }

    private boolean napNguCanh(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        String khoId = request.getHeader("kho_id");
        SecurityContextHolder.setPath(request.getRequestURI());
        if (authHeader != null) {
            String token = jwtService.getTokenFromAuthHeader(authHeader);
            // Header không theo dạng "Bearer <token>": phiên không hợp lệ (401), không để lỗi null thành 500
            if (token == null || token.isBlank()) {
                SecurityContextHolder.clear();
                throw new CommonException(HttpStatus.UNAUTHORIZED, LOI_PHIEN_KHONG_HOP_LE);
            }
            NguoiDungAuthInfo nguoiDungAuthInfo = jwtService.getNguoiDungAuthInfoFromToken(token);
            SecurityContextHolder.setUser(nguoiDungAuthInfo);

            // Kiểm tra trangThai và vai trò hiện tại từ DB — KHÔNG tin claim trong token (có thể đã cũ).
            // Tài khoản bị khóa hoặc không mang vai trò nhân sự thì phiên đang mở cũng dừng ngay.
            if (nguoiDungAuthInfo != null && nguoiDungAuthInfo.getId() != null) {
                NguoiDung nguoiDung = nguoiDungRepository.findById(nguoiDungAuthInfo.getId()).orElse(null);
                if (nguoiDung == null || !nguoiDung.duocDangNhap()) {
                    SecurityContextHolder.clear(); // preHandle throw → afterCompletion không chạy, phải tự clear
                    throw new AccountDisabledException();
                }
                // Token phát hành trước lần đổi/đặt lại mật khẩu gần nhất -> thu hồi (đăng xuất mọi phiên cũ).
                // Token cũ chưa có claim "cv" (phát hành trước bản này) vẫn dùng tới khi hết hạn 24h.
                String tokenCredential = nguoiDungAuthInfo.getCredentialVersion();
                if (tokenCredential != null
                        && !tokenCredential.equals(jwtService.credentialVersion(nguoiDung.getMatKhauHash()))) {
                    SecurityContextHolder.clear();
                    throw new SessionRevokedException();
                }
                // Token mang vai trò và quyền lúc đăng nhập (sống 24 giờ). Đổi vai trò, đổi/thu hồi kho, bỏ quyền
                // hoặc hết hạn hiệu lực thì token cũ không được dùng tiếp: buộc đăng nhập lại ngay ở request kế tiếp.
                // Quyền vừa được CẤP THÊM không làm thu hồi phiên (người dùng đăng nhập lại khi muốn dùng).
                List<Object[]> khoVaQuyen = IRoleType.quan_tri_vien.equals(nguoiDung.getVaiTro()) ? List.of()
                        : phanQuyenNguoiDungKhoRepository.layKhoVaQuyenHieuLuc(nguoiDung.getId(), Instant.now());
                if (tokenVuotQuyenHienTai(nguoiDungAuthInfo, nguoiDung.getVaiTro(), khoVaQuyen)) {
                    SecurityContextHolder.clear();
                    throw new SessionRevokedException(LOI_QUYEN_DA_DOI);
                }

                // Kiểm phiên đăng nhập: token phát hành sau khi có bảng phien_dang_nhap mang claim "sid". Phiên đã
                // đăng xuất / bị thu hồi (đổi-đặt lại mật khẩu) / hết hạn thì dừng ngay. Token cũ (không có sid)
                // bỏ qua bước này, tương thích ngược như claim "cv".
                String sid = nguoiDungAuthInfo.getPhienId();
                if (sid != null && !sid.isBlank()) {
                    try {
                        PhienDangNhap phien = phienDangNhapRepository.findByPhienId(sid).orElse(null);
                        Instant bayGio = Instant.now();
                        if (phien == null || phien.getThuHoiLuc() != null
                                || (phien.getHetHanLuc() != null && phien.getHetHanLuc().isBefore(bayGio))) {
                            SecurityContextHolder.clear();
                            throw new SessionRevokedException("Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.");
                        }
                        // Cập nhật "hoạt động cuối" có tiết chế: chỉ ghi khi đã cũ hơn NGUONG_CHAM_TRUY_CAP
                        if (phien.getTruyCapCuoi() == null
                                || phien.getTruyCapCuoi().isBefore(bayGio.minus(NGUONG_CHAM_TRUY_CAP))) {
                            phienDangNhapService.chamTruyCap(sid, bayGio);
                        }
                    } catch (SessionRevokedException e) {
                        throw e;
                    } catch (RuntimeException e) {
                        // Lỗi đọc/ghi bảng phiên (chưa chạy migration, hoặc DB chập chờn): chỉ ghi log, KHÔNG chặn request —
                        // các kiểm tra chính (trạng thái tài khoản, cv, quyền) đã chạy ở trên.
                        log.warn("Không kiểm được phiên đăng nhập (sid {}): {}", sid, e.getMessage());
                    }
                }
            }
        }
        if (khoId != null && !khoId.isBlank()) {
            try {
                SecurityContextHolder.setKhoId(Integer.parseInt(khoId.trim()));
            } catch (NumberFormatException e) {
                SecurityContextHolder.clear();
                throw new CommonException(HttpStatus.BAD_REQUEST, "Kho đang chọn không hợp lệ. Chọn lại kho rồi thử lại.");
            }
        }
        return true;
    }

    /**
     * Token có vai trò khác CSDL, hoặc có kho / quyền (đang bật) mà CSDL không còn cho phép.
     *
     * @param khoVaQuyenCsdl các dòng {khoId, maQuyen} của phân quyền kho đang hiệu lực (maQuyen null = kho chưa có quyền)
     */
    static boolean tokenVuotQuyenHienTai(NguoiDungAuthInfo token, String vaiTroCsdl, List<Object[]> khoVaQuyenCsdl) {
        Set<String> vaiTroToken = token.getVaiTro() == null ? Set.of() : token.getVaiTro();
        if (vaiTroCsdl == null || vaiTroToken.size() != 1 || !vaiTroToken.contains(vaiTroCsdl)) {
            return true;
        }
        if (IRoleType.quan_tri_vien.equals(vaiTroCsdl) || token.getPhanQuyenNguoiDungKhos() == null) {
            return false;
        }
        Set<Integer> khoCsdl = new HashSet<>();
        Set<String> quyenCsdl = new HashSet<>();
        for (Object[] dong : khoVaQuyenCsdl) {
            if (dong == null || dong.length < 2 || dong[0] == null) continue;
            Integer khoId = ((Number) dong[0]).intValue();
            khoCsdl.add(khoId);
            if (dong[1] != null) {
                quyenCsdl.add(khoId + ":" + dong[1]);
            }
        }
        for (PhanQuyenNguoiDungKhoDto pq : token.getPhanQuyenNguoiDungKhos()) {
            if (pq == null || pq.getKho() == null || pq.getKho().getId() == null) continue;
            Integer khoId = pq.getKho().getId();
            if (!khoCsdl.contains(khoId)) {
                return true;
            }
            if (pq.getChiTietQuyenKhos() == null) continue;
            for (ChiTietQuyenKhoDto ct : pq.getChiTietQuyenKhos()) {
                if (ct == null || !Integer.valueOf(1).equals(ct.getTrangThai()) || ct.getQuyenHan() == null
                        || ct.getQuyenHan().getMaQuyen() == null) continue;
                if (!quyenCsdl.contains(khoId + ":" + ct.getQuyenHan().getMaQuyen())) {
                    return true;
                }
            }
        }
        return false;
    }

    @Override
    public void afterCompletion(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler, Exception ex) {
        SecurityContextHolder.clear(); // Xóa sau khi xử lý xong
    }
}
