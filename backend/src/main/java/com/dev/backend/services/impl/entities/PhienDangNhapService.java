package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.PhienDangNhap;
import com.dev.backend.repository.PhienDangNhapRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Phiên đăng nhập (bảng phien_dang_nhap): ghi khi đăng nhập, thu hồi khi đăng xuất / đổi mật khẩu.
 *
 * Mỗi thao tác GHI chạy trong GIAO DỊCH RIÊNG (REQUIRES_NEW): bảng chưa có (chưa chạy migration) hoặc DB lỗi thì chỉ
 * giao dịch này rollback, KHÔNG kéo theo giao dịch đăng nhập / đổi mật khẩu bên ngoài. Nơi gọi bắt lỗi, ghi log rồi đi
 * tiếp (đăng nhập không có sid -> AuthInterceptor bỏ qua kiểm phiên, tương thích ngược giống claim "cv").
 */
@Service
public class PhienDangNhapService {

    @Autowired
    private PhienDangNhapRepository phienDangNhapRepository;

    /** Ghi một phiên mới, trả về mã phiên (sid) để nhúng vào JWT. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String taoPhien(Integer nguoiDungId, String userAgent, String diaChiIp, Instant now, Instant hetHanLuc) {
        PhienDangNhap phien = PhienDangNhap.builder()
                .phienId(UUID.randomUUID().toString())
                .nguoiDungId(nguoiDungId)
                .userAgent(catChuoi(userAgent, 512))
                .diaChiIp(catChuoi(diaChiIp, 64))
                .taoLuc(now)
                .truyCapCuoi(now)
                .hetHanLuc(hetHanLuc)
                .build();
        phienDangNhapRepository.save(phien);
        return phien.getPhienId();
    }

    /** Thu hồi một phiên (đăng xuất thiết bị hiện tại). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void thuHoiPhien(String sid) {
        phienDangNhapRepository.thuHoiTheoSid(sid, Instant.now());
    }

    /** Thu hồi mọi phiên của người dùng TRỪ phiên hiện tại (sau khi đổi mật khẩu). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void thuHoiCacPhienKhac(Integer nguoiDungId, String truSid) {
        phienDangNhapRepository.thuHoiCacPhienKhac(nguoiDungId, truSid, Instant.now());
    }

    /** Thu hồi toàn bộ phiên của người dùng (đặt lại mật khẩu bằng mã, hoặc buộc đăng xuất). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void thuHoiTatCa(Integer nguoiDungId) {
        phienDangNhapRepository.thuHoiTatCa(nguoiDungId, Instant.now());
    }

    /** Các phiên còn hiệu lực của một người (chưa thu hồi, chưa hết hạn), mới hoạt động xếp trước. */
    public List<PhienDangNhap> dsPhienHieuLuc(Integer nguoiDungId) {
        return phienDangNhapRepository
                .findByNguoiDungIdAndThuHoiLucIsNullAndHetHanLucAfterOrderByTruyCapCuoiDesc(nguoiDungId, Instant.now());
    }

    /** Đăng xuất một phiên cụ thể của chính người đó; trả số dòng đổi (0 = không có / không phải của họ / đã thu hồi). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int thuHoiTheoId(Integer id, Integer nguoiDungId) {
        return phienDangNhapRepository.thuHoiTheoIdCuaNguoiDung(id, nguoiDungId, Instant.now());
    }

    /** Cập nhật "hoạt động cuối" của một phiên (gọi có tiết chế từ AuthInterceptor). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void chamTruyCap(String sid, Instant luc) {
        phienDangNhapRepository.chamTruyCap(sid, luc);
    }

    /** Gia hạn phiên hiện tại sau khi đổi mật khẩu để khớp hạn với token mới (24h). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void giaHanPhien(String sid, Instant hetHanMoi) {
        phienDangNhapRepository.giaHan(sid, Instant.now(), hetHanMoi);
    }

    private static String catChuoi(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
