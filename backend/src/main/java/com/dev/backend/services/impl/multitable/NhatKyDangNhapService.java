package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.entities.CanChuYDangNhapDto;
import com.dev.backend.dto.response.entities.DongDangNhapHeThongDto;
import com.dev.backend.dto.response.entities.NhatKyDangNhapNguoiDungDto;
import com.dev.backend.dto.response.entities.NhatKyDangNhapNguoiDungDto.DongDangNhap;
import com.dev.backend.dto.response.entities.NhatKyDangNhapNguoiDungDto.TomTat;
import com.dev.backend.dto.response.entities.PhienDangNhapDto;
import com.dev.backend.dto.response.entities.TrangThaiDangNhapDto;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.PhienDangNhapService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Đọc nhật ký đăng nhập của MỘT người dùng cho quản trị viên (tab "Đăng nhập" ở Chi tiết người dùng). Chỉ đọc, không
 * thêm bảng (ràng buộc BA 23/11): ghép các dòng đăng nhập có sẵn trong lich_su_thay_doi với phiên trong phien_dang_nhap.
 * <ul>
 *   <li>Kết quả một dòng suy ra từ hành động và ghi chú: thành công, sai mật khẩu, hoặc đúng mật khẩu khi tài khoản đang
 *   khóa.</li>
 *   <li>Địa chỉ IP tách từ ghi chú ("… IP x.x.x.x"); không có thiết bị cho từng dòng vì chỉ IP được lưu.</li>
 *   <li>Không có dòng "đăng xuất" (hệ thống không ghi) — đúng quyết định "bỏ đăng xuất, không tính".</li>
 * </ul>
 */
@Service
public class NhatKyDangNhapService {

    /** Trần số dòng đọc; đủ cho 90 ngày của một tài khoản dùng bình thường. */
    static final int GIOI_HAN_DOC = 300;
    static final Duration CUA_SO_HIEN = Duration.ofDays(90);
    static final Duration CUA_SO_24H = Duration.ofHours(24);
    /** Ngưỡng "sai mật khẩu nhiều lần", khớp LoginRateLimiter (5 lần trong 15 phút). */
    static final int NGUONG_SAI = 5;
    /** Ghi chú của dòng "đúng mật khẩu nhưng tài khoản đang khóa" (NguoiDungService.login). */
    static final String TIEN_TO_KHOA_DUNG_MK = "Đúng mật khẩu";

    private final LichSuThayDoiRepository lichSuRepo;
    private final PhienDangNhapService phienDangNhapService;
    private final NguoiDungRepository nguoiDungRepository;

    public NhatKyDangNhapService(LichSuThayDoiRepository lichSuRepo, PhienDangNhapService phienDangNhapService,
                                 NguoiDungRepository nguoiDungRepository) {
        this.lichSuRepo = lichSuRepo;
        this.phienDangNhapService = phienDangNhapService;
        this.nguoiDungRepository = nguoiDungRepository;
    }

    @Transactional(readOnly = true)
    public NhatKyDangNhapNguoiDungDto cuaNguoiDung(Integer nguoiDungId) {
        if (nguoiDungId == null || !nguoiDungRepository.existsById(nguoiDungId)) {
            throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("heThong.nguoiDungKhongTimThay"));
        }
        Instant now = Instant.now();
        Instant moc90 = now.minus(CUA_SO_HIEN);
        Instant moc24 = now.minus(CUA_SO_24H);

        List<LichSuThayDoi> rows = lichSuRepo
                .findByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        ITable.nguoi_dung, nguoiDungId,
                        List.of(IHanhDong.dang_nhap, IHanhDong.dang_nhap_that_bai),
                        PageRequest.of(0, GIOI_HAN_DOC));

        List<DongDangNhap> lichSu = new ArrayList<>();
        Instant lanGanNhat = null;
        String lanGanNhatIp = null;
        int soSai24h = 0;
        int soSaiMatKhau24h = 0;
        boolean khoaDungMk24h = false;

        for (LichSuThayDoi l : rows) {
            Instant luc = l.getNgayThucHien();
            if (luc == null || luc.isBefore(moc90)) continue; // chỉ hiện 90 ngày
            String ketQua = ketQua(l);
            String ip = tachIp(l.getGhiChu());
            lichSu.add(DongDangNhap.builder().id(l.getId()).luc(luc).ketQua(ketQua).diaChiIp(ip).build());

            if ("thanh_cong".equals(ketQua)) {
                if (lanGanNhat == null) { // danh sách đã mới-nhất-trước
                    lanGanNhat = luc;
                    lanGanNhatIp = ip;
                }
            } else if (!luc.isBefore(moc24)) {
                soSai24h++;
                if ("tai_khoan_khoa".equals(ketQua)) khoaDungMk24h = true;
                else soSaiMatKhau24h++;
            }
        }

        boolean nhieuLanSai = soSaiMatKhau24h >= NGUONG_SAI;
        boolean canChuY = nhieuLanSai || khoaDungMk24h;
        // Tài khoản khóa nhập đúng mật khẩu là tín hiệu nặng hơn → ưu tiên hiện trước
        String lyDo = khoaDungMk24h ? "khoa_dung_mat_khau" : nhieuLanSai ? "nhieu_lan_sai" : null;

        List<PhienDangNhapDto> phien = phienDangNhapService.dsPhienHieuLuc(nguoiDungId).stream()
                .map(p -> PhienDangNhapDto.builder()
                        .id(p.getId())
                        .thietBiNay(false) // quản trị viên xem người khác: không có "thiết bị này"
                        .userAgent(p.getUserAgent())
                        .diaChiIp(p.getDiaChiIp())
                        .viTri(p.getViTri())
                        .taoLuc(p.getTaoLuc())
                        .truyCapCuoi(p.getTruyCapCuoi())
                        .build())
                .toList();

        TomTat tomTat = TomTat.builder()
                .lanGanNhat(lanGanNhat)
                .lanGanNhatIp(lanGanNhatIp)
                .soThietBi(phien.size())
                .soSai24h(soSai24h)
                .canChuY(canChuY)
                .lyDoChuY(lyDo)
                .soLanSaiGanDay(nhieuLanSai && !khoaDungMk24h ? soSaiMatKhau24h : null)
                .build();

        return NhatKyDangNhapNguoiDungDto.builder()
                .tomTat(tomTat)
                .phien(phien)
                .lichSu(lichSu)
                .build();
    }

    /**
     * Trạng thái đăng nhập tóm tắt cho nhiều người (danh sách người dùng gắn biểu tượng bất thường — PA C). Hai truy vấn
     * gộp trên trang hiện tại (≤ cỡ trang) nên nhẹ: đếm sai mật khẩu 24 giờ + lần đăng nhập cuối.
     */
    @Transactional(readOnly = true)
    public List<TrangThaiDangNhapDto> trangThaiNhieuNguoi(Collection<Integer> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        Instant moc24 = Instant.now().minus(CUA_SO_24H);

        Map<Integer, int[]> dem = new HashMap<>(); // [số sai mật khẩu, khóa-đúng-mật-khẩu 0/1]
        for (Object[] r : lichSuRepo.idVaGhiChuTheoHanhDongTuNgay(
                ITable.nguoi_dung, IHanhDong.dang_nhap_that_bai, ids, moc24)) {
            Integer id = (Integer) r[0];
            if (id == null) continue;
            int[] v = dem.computeIfAbsent(id, k -> new int[2]);
            if (laKhoaDungMatKhau((String) r[1])) v[1] = 1;
            else v[0]++;
        }

        Map<Integer, Instant> cuoi = new HashMap<>();
        for (Object[] r : lichSuRepo.lanCuoiTheoHanhDong(ITable.nguoi_dung, IHanhDong.dang_nhap, ids)) {
            cuoi.put((Integer) r[0], asInstant(r[1]));
        }

        List<TrangThaiDangNhapDto> out = new ArrayList<>(ids.size());
        for (Integer id : ids) {
            int[] v = dem.get(id);
            boolean khoaDung = v != null && v[1] == 1;
            boolean nhieuSai = v != null && v[0] >= NGUONG_SAI;
            out.add(TrangThaiDangNhapDto.builder()
                    .id(id)
                    .canChuY(khoaDung || nhieuSai)
                    .lyDoChuY(khoaDung ? "khoa_dung_mat_khau" : nhieuSai ? "nhieu_lan_sai" : null)
                    .lanDangNhapCuoi(cuoi.get(id))
                    .build());
        }
        return out;
    }

    /** Màn Nhật ký đăng nhập toàn hệ thống: lọc theo từ khóa, kết quả, khoảng ngày; mới nhất trước; phân trang. */
    @Transactional(readOnly = true)
    public Page<DongDangNhapHeThongDto> heThong(String tuKhoa, String ketQuaLoc, int soNgay, Pageable pageable) {
        List<String> hanhDongs = switch (ketQuaLoc == null ? "all" : ketQuaLoc) {
            case "thanh_cong" -> List.of(IHanhDong.dang_nhap);
            case "that_bai" -> List.of(IHanhDong.dang_nhap_that_bai);
            default -> List.of(IHanhDong.dang_nhap, IHanhDong.dang_nhap_that_bai);
        };
        Instant tu = Instant.now().minus(Duration.ofDays(gioiHanNgay(soNgay)));
        String q = (tuKhoa == null || tuKhoa.isBlank()) ? null : "%" + tuKhoa.trim().toLowerCase() + "%";
        int size = pageable.getPageSize() <= 0 ? 20 : Math.min(pageable.getPageSize(), 100);
        Pageable pq = PageRequest.of(Math.max(pageable.getPageNumber(), 0), size,
                Sort.by(Sort.Order.desc("ngayThucHien"), Sort.Order.desc("id")));
        return lichSuRepo.nhatKyDangNhapHeThong(ITable.nguoi_dung, hanhDongs, tu, q, pq).map(this::toDongHeThong);
    }

    /** Khung "Cần chú ý" của màn Nhật ký đăng nhập: tài khoản sai mật khẩu nhiều lần / khóa-đúng-mật-khẩu trong 24 giờ. */
    @Transactional(readOnly = true)
    public List<CanChuYDangNhapDto> canChuYHeThong() {
        Instant moc24 = Instant.now().minus(CUA_SO_24H);
        List<LichSuThayDoi> rows = lichSuRepo.toanHeThongTheoHanhDongTuNgay(
                ITable.nguoi_dung, IHanhDong.dang_nhap_that_bai, moc24);

        Map<Integer, int[]> dem = new HashMap<>();
        Map<Integer, NguoiDung> nguoi = new HashMap<>();
        for (LichSuThayDoi l : rows) {
            NguoiDung n = l.getNguoiThucHien();
            Integer id = n != null ? n.getId() : l.getIdThamChieu();
            if (id == null) continue;
            if (n != null) nguoi.putIfAbsent(id, n);
            int[] v = dem.computeIfAbsent(id, k -> new int[2]);
            if (laKhoaDungMatKhau(l.getGhiChu())) v[1] = 1;
            else v[0]++;
        }

        List<CanChuYDangNhapDto> out = new ArrayList<>();
        for (Map.Entry<Integer, int[]> e : dem.entrySet()) {
            int[] v = e.getValue();
            boolean khoaDung = v[1] == 1;
            boolean nhieuSai = v[0] >= NGUONG_SAI;
            if (!khoaDung && !nhieuSai) continue;
            NguoiDung n = nguoi.get(e.getKey());
            out.add(CanChuYDangNhapDto.builder()
                    .nguoiDungId(e.getKey())
                    .hoTen(n == null ? null : n.getHoTen())
                    .tenDangNhap(n == null ? null : n.getTenDangNhap())
                    .lyDo(khoaDung ? "khoa_dung_mat_khau" : "nhieu_lan_sai")
                    .soLan(v[0])
                    .build());
        }
        // Khóa-đúng-mật-khẩu (nặng hơn) lên trước, rồi số lần sai giảm dần
        out.sort((a, b) -> {
            int wa = "khoa_dung_mat_khau".equals(a.getLyDo()) ? 0 : 1;
            int wb = "khoa_dung_mat_khau".equals(b.getLyDo()) ? 0 : 1;
            return wa != wb ? wa - wb : b.getSoLan() - a.getSoLan();
        });
        return out;
    }

    private DongDangNhapHeThongDto toDongHeThong(LichSuThayDoi l) {
        NguoiDung n = l.getNguoiThucHien();
        return DongDangNhapHeThongDto.builder()
                .id(l.getId())
                .luc(l.getNgayThucHien())
                .nguoiDungId(n != null ? n.getId() : l.getIdThamChieu())
                .hoTen(n == null ? null : n.getHoTen())
                .tenDangNhap(n == null ? null : n.getTenDangNhap())
                .ketQua(ketQua(l))
                .diaChiIp(tachIp(l.getGhiChu()))
                .build();
    }

    /** Khoảng ngày hợp lệ cho màn nhật ký: 1 / 7 / 30 / 90; mặc định 7. */
    private static int gioiHanNgay(int soNgay) {
        return switch (soNgay) {
            case 1, 7, 30, 90 -> soNgay;
            default -> 7;
        };
    }

    private static boolean laKhoaDungMatKhau(String ghiChu) {
        return ghiChu != null && ghiChu.startsWith(TIEN_TO_KHOA_DUNG_MK);
    }

    /** MAX(ngayThucHien) có thể trả Instant hoặc Timestamp tùy driver — đưa về Instant. */
    private static Instant asInstant(Object o) {
        if (o instanceof Instant i) return i;
        if (o instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (o instanceof java.util.Date d) return d.toInstant();
        return null;
    }

    /** Kết quả một lần đăng nhập suy từ hành động + ghi chú. */
    private static String ketQua(LichSuThayDoi l) {
        if (IHanhDong.dang_nhap.equals(l.getHanhDong())) return "thanh_cong";
        String g = l.getGhiChu();
        if (g != null && g.startsWith(TIEN_TO_KHOA_DUNG_MK)) return "tai_khoan_khoa";
        return "sai_mat_khau";
    }

    /** Tách IP từ ghi chú dạng "…, IP x.x.x.x"; null khi không có. */
    static String tachIp(String ghiChu) {
        if (ghiChu == null) return null;
        int i = ghiChu.lastIndexOf("IP ");
        if (i < 0) return null;
        String ip = ghiChu.substring(i + 3).trim();
        return ip.isEmpty() ? null : ip;
    }
}
