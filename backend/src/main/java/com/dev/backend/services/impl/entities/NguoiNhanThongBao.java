package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Tìm người nhận thông báo theo kho và vai trò, dùng chung cho các service thông báo của từng nghiệp vụ. Chỉ gọi lúc soạn
 * thông báo (sau commit, trong giao dịch mới của {@link ThongBaoService#guiSauCommit}).
 * <p>
 * "Quản lý kho X" = tài khoản đang hoạt động vai trò quan_ly_kho có phân quyền hiệu lực ở kho X (cùng luật với
 * ThongBaoChuyenKhoService). Quản trị viên không gắn kho nên chỉ nhận khi được gọi đích danh hoặc nhận thay.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NguoiNhanThongBao {

    private final PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    private final NguoiDungRepository nguoiDungRepository;

    /** Người mang vai trò này đang được phân công ở kho; kho trống thì không ai. */
    public List<Integer> theoKho(Integer khoId, String vaiTro) {
        if (khoId == null) return List.of();
        return phanQuyenNguoiDungKhoRepository.nguoiDungTheoKhoTai(List.of(khoId), vaiTro, Instant.now());
    }

    /** Quản lý kho đang được phân công ở kho này. */
    public List<Integer> quanLyKho(Integer khoId) {
        return theoKho(khoId, IRoleType.quan_ly_kho);
    }

    /** Mọi quản trị viên đang hoạt động. */
    public List<Integer> quanTriVien() {
        return nguoiDungRepository.idDangHoatDongTheoVaiTro(IRoleType.quan_tri_vien);
    }

    /**
     * Người xử lý theo luật; không có ai (vd. kho chưa phân công quản lý nào đang hiệu lực) thì gửi các quản trị viên đang
     * hoạt động để việc không bị bỏ quên, kèm log warn để cấu hình lại phân quyền.
     */
    public List<Integer> hoacQuanTri(List<Integer> nguoiXuLy, String viec) {
        if (nguoiXuLy != null && nguoiXuLy.stream().anyMatch(id -> id != null)) return nguoiXuLy;
        log.warn("[THONG-BAO] {}: không có người xử lý nào đang hiệu lực, gửi quản trị viên", viec);
        return quanTriVien();
    }
}
