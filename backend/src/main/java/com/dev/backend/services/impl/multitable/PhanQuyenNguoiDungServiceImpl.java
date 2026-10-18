package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ChiTietQuyenKhoCreating;
import com.dev.backend.dto.request.LuuPhanQuyenRequest;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.dto.response.phanquyen.CauHinhPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.KhoTomTatDto;
import com.dev.backend.dto.response.phanquyen.LichSuPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.QuyenCuaToiDto;
import com.dev.backend.entities.ChiTietQuyenKho;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.entities.QuyenHan;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietQuyenKhoRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.MauQuyenVaiTroRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.QuyenHanRepository;
import com.dev.backend.services.multitable.PhanQuyenNguoiDungService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Phân quyền người dùng theo hai lớp của hệ thống:
 * vai trò quyết định mở được màn hình nào; quyền tại kho quyết định được làm gì ở kho đó.
 * Mỗi người tối đa một phân quyền kho đang hiệu lực.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PhanQuyenNguoiDungServiceImpl implements PhanQuyenNguoiDungService {

    /** Vai trò được gán cho người dùng ("all" chỉ dùng trong @RequireAuth). */
    static final Set<String> VAI_TRO_HOP_LE = Set.of(
            IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_ban_hang, IRoleType.khach_hang);

    /** Vai trò không làm việc theo kho: Quản trị viên có toàn quyền, Khách hàng không dùng màn nội bộ. */
    static final Set<String> VAI_TRO_KHONG_DUNG_KHO = Set.of(IRoleType.quan_tri_vien, IRoleType.khach_hang);

    /** Vai trò nhân viên: quản lý kho chỉ phân quyền và thu hồi được cho những vai trò này. */
    static final Set<String> VAI_TRO_NHAN_VIEN = Set.of(
            IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_ban_hang);

    /** Vai trò có mẫu quyền. */
    static final List<String> VAI_TRO_CO_MAU = List.of(
            IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_ban_hang);

    /** Các hành động trong lich_su_thay_doi thuộc về phân quyền của một người dùng (gồm cả bản ghi cũ). */
    static final List<String> HANH_DONG_PHAN_QUYEN = List.of(
            IHanhDong.cap_nhat_phan_quyen, IHanhDong.cap_quyen, IHanhDong.cap_nhat_quyen,
            IHanhDong.thu_hoi_quyen, IHanhDong.nang_cap_chuc_vu);

    static final int SO_LICH_SU_TOI_DA = 200;

    /**
     * Lùi ngày bắt đầu của phân quyền mới một phút: truy vấn "đã tới ngày bắt đầu" so với giờ của CSDL,
     * nên không được để lệch đồng hồ giữa máy chủ ứng dụng và CSDL làm người dùng mất kho ngay sau khi lưu.
     */
    static final long LUI_NGAY_BAT_DAU_GIAY = 60;

    /** Kho ảo chứa hàng đang chuyển giữa các kho: không phân người (cùng quy tắc ở màn chọn kho). */
    static final String MA_KHO_AO = "KHO_TRANSIT";

    private final NguoiDungRepository nguoiDungRepository;
    private final KhoRepository khoRepository;
    private final QuyenHanRepository quyenHanRepository;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    private final ChiTietQuyenKhoRepository chiTietQuyenKhoRepository;
    private final LichSuThayDoiRepository lichSuThayDoiRepository;
    private final MauQuyenVaiTroRepository mauQuyenVaiTroRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationContext applicationContext;

    private Clock clock = Clock.systemUTC();

    /** Null khi chạy unit test dựng tay (không có JPA). */
    @PersistenceContext
    private EntityManager entityManager;

    /** Quyền đang được API kiểm chỉ đổi khi triển khai bản mới, nên quét một lần rồi giữ lại. */
    private volatile List<String> quyenDaApDungDaQuet;

    void setClock(Clock clock) {
        this.clock = clock;
    }

    // ───────────────────────────────── Lưu phân quyền ─────────────────────────────────

    @Override
    @Transactional
    public void luuPhanQuyen(Integer nguoiDungId, LuuPhanQuyenRequest request) {
        if (nguoiDungId == null || request == null) {
            throw new CommonException("Thông tin phân quyền không hợp lệ");
        }
        NguoiDung nguoiThucHien = nguoiDangDangNhap();
        NguoiDung nguoiDung = nguoiDungRepository.findById(nguoiDungId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        String vaiTroMoi = request.getVaiTro() == null ? "" : request.getVaiTro().trim();
        if (!VAI_TRO_HOP_LE.contains(vaiTroMoi)) {
            throw new CommonException("Vai trò không hợp lệ");
        }
        String vaiTroCu = nguoiDung.getVaiTro();
        if (nguoiDung.getId().equals(nguoiThucHien.getId()) && !vaiTroMoi.equals(vaiTroCu)) {
            throw new CommonException("Bạn không thể tự đổi vai trò của chính mình");
        }

        Instant bayGio = clock.instant();
        boolean dungKho = !VAI_TRO_KHONG_DUNG_KHO.contains(vaiTroMoi);
        Map<Integer, QuyenHan> quyenMoi = dungKho ? layQuyenHopLe(request.getQuyenHanIds()) : new LinkedHashMap<>();

        // Kể cả phân quyền hẹn ngày bắt đầu ở tương lai: đều tính vào quy tắc tối đa một kho
        List<PhanQuyenNguoiDungKho> dangCo = phanQuyenNguoiDungKhoRepository.findGiuChoByNguoiDungId(nguoiDung.getId(), bayGio);
        PhanQuyenNguoiDungKho pqTruoc = chonPhanQuyenChinh(dangCo, request.getKhoId());
        AnhChup truoc = chup(vaiTroCu, pqTruoc);

        if (!vaiTroMoi.equals(vaiTroCu)) {
            nguoiDung.setVaiTro(vaiTroMoi);
            nguoiDungRepository.save(nguoiDung);
        }

        PhanQuyenNguoiDungKho pqSau = null;
        if (!dungKho) {
            for (PhanQuyenNguoiDungKho pq : dangCo) {
                thuHoiPhanQuyenKho(pq, bayGio);
            }
        } else if (request.getKhoId() == null) {
            if (!dangCo.isEmpty()) {
                throw new CommonException("Hãy chọn kho phụ trách");
            }
            if (!quyenMoi.isEmpty()) {
                throw new CommonException("Hãy chọn kho phụ trách trước khi cấp quyền");
            }
        } else {
            pqSau = datKhoVaQuyen(nguoiDung, request, quyenMoi, dangCo, nguoiThucHien, vaiTroMoi, bayGio);
        }

        AnhChup sau = new AnhChup(vaiTroMoi,
                pqSau == null ? null : pqSau.getKho(),
                pqSau == null ? null : pqSau.getNgayKetThuc(),
                pqSau == null ? new TreeSet<>() : quyenMoi.values().stream()
                        .map(QuyenHan::getMaQuyen).collect(Collectors.toCollection(TreeSet::new)));

        if (!truoc.giongNhau(sau)) {
            ghiLichSuPhanQuyen(nguoiDung, truoc, sau, nguoiThucHien, bayGio);
        }

        // Controller đọc lại chi tiết ngay trong cùng request (open-in-view giữ nguyên phiên JPA). Phân quyền kho
        // tạo bằng builder không tự có danh sách quyền con, nên phải ghi xuống CSDL rồi bỏ bộ nhớ đệm để lần đọc
        // sau lấy đủ quyền vừa cấp. Thiếu bước này, trang chi tiết nhận 0 quyền và lần lưu kế tiếp thu hồi hết.
        if (entityManager != null) {
            entityManager.flush();
            entityManager.clear();
        }
    }

    private PhanQuyenNguoiDungKho datKhoVaQuyen(NguoiDung nguoiDung, LuuPhanQuyenRequest request,
                                               Map<Integer, QuyenHan> quyenMoi, List<PhanQuyenNguoiDungKho> dangCo,
                                               NguoiDung nguoiThucHien, String vaiTroMoi, Instant bayGio) {
        Kho kho = khoRepository.findById(request.getKhoId())
                .orElseThrow(() -> new CommonException("Không tìm thấy kho"));
        PhanQuyenNguoiDungKho pq = dangCo.stream()
                .filter(p -> p.getKho() != null && kho.getId().equals(p.getKho().getId()))
                .findFirst().orElse(null);
        if (pq == null && !Integer.valueOf(1).equals(kho.getTrangThai())) {
            throw new CommonException("Kho " + kho.getTenKho() + " đang ngừng hoạt động, không phân người được");
        }
        if (pq == null && MA_KHO_AO.equals(kho.getMaKho())) {
            throw new CommonException("Kho ảo chỉ chứa hàng đang chuyển giữa các kho, không phân người được");
        }
        // CSDL lưu tới giây: bỏ phần lẻ để lần lưu sau so sánh không bị lệch
        Instant ngayKetThuc = request.getNgayKetThuc() == null ? null
                : request.getNgayKetThuc().truncatedTo(ChronoUnit.SECONDS);
        if (ngayKetThuc != null && !ngayKetThuc.isAfter(bayGio)) {
            throw new CommonException("Ngày hết hiệu lực phải sau thời điểm hiện tại");
        }

        // Tối đa một kho đang hiệu lực: đổi kho thì thu hồi kho cũ trong cùng lần lưu
        for (PhanQuyenNguoiDungKho khac : dangCo) {
            if (khac != pq) {
                thuHoiPhanQuyenKho(khac, bayGio);
            }
        }

        // Phân quyền hẹn ngày bắt đầu ở tương lai (tạo từ API cũ) không hiện ở trang chi tiết; admin lưu lại kho
        // này nghĩa là cho làm việc ngay, nên kích hoạt như phân quyền mới.
        boolean kichHoatMoi = pq == null || (pq.getNgayBatDau() != null && pq.getNgayBatDau().isAfter(bayGio));
        if (kichHoatMoi) {
            if (pq == null) {
                pq = phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(nguoiDung.getId(), kho.getId())
                        .orElseGet(() -> PhanQuyenNguoiDungKho.builder().nguoiDung(nguoiDung).kho(kho).build());
            }
            pq.setNgayBatDau(bayGio.minusSeconds(LUI_NGAY_BAT_DAU_GIAY));
            pq.setNguoiCapQuyen(nguoiThucHien);
        }
        pq.setTrangThai(1);
        pq.setLaQuanLyKho(IRoleType.quan_ly_kho.equals(vaiTroMoi) ? 1 : 0);
        pq.setNgayKetThuc(ngayKetThuc);
        pq = phanQuyenNguoiDungKhoRepository.save(pq);
        if (!IRoleType.quan_ly_kho.equals(vaiTroMoi)) {
            boQuanLyKho(kho, nguoiDung);
        }

        datTapQuyen(pq, quyenMoi, nguoiThucHien, bayGio, kichHoatMoi);
        return pq;
    }

    /** Quyền có trong danh sách thì bật, quyền đang bật mà không có trong danh sách thì thu hồi. */
    private void datTapQuyen(PhanQuyenNguoiDungKho pq, Map<Integer, QuyenHan> quyenMoi, NguoiDung nguoiThucHien,
                             Instant bayGio, boolean kichHoatMoi) {
        Map<Integer, ChiTietQuyenKho> hienCo = new HashMap<>();
        for (ChiTietQuyenKho ct : chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(pq.getId())) {
            hienCo.putIfAbsent(ct.getQuyenHan().getId(), ct);
        }
        for (QuyenHan quyen : quyenMoi.values()) {
            ChiTietQuyenKho ct = hienCo.get(quyen.getId());
            if (ct == null) {
                chiTietQuyenKhoRepository.save(ChiTietQuyenKho.builder()
                        .phanQuyenNguoiDungKho(pq)
                        .quyenHan(quyen)
                        .trangThai(1)
                        .ngayCap(bayGio)
                        .nguoiCap(nguoiThucHien)
                        .build());
            } else if (!Integer.valueOf(1).equals(ct.getTrangThai()) || kichHoatMoi) {
                ct.setTrangThai(1);
                ct.setNgayCap(bayGio);
                ct.setNguoiCap(nguoiThucHien);
                chiTietQuyenKhoRepository.save(ct);
            }
        }
        for (ChiTietQuyenKho ct : hienCo.values()) {
            if (!quyenMoi.containsKey(ct.getQuyenHan().getId()) && Integer.valueOf(1).equals(ct.getTrangThai())) {
                ct.setTrangThai(0);
                chiTietQuyenKhoRepository.save(ct);
            }
        }
    }

    /** Thu hồi (không xóa) phân quyền kho và các quyền đang bật, để còn tra lại ai đã cấp gì. */
    private void thuHoiPhanQuyenKho(PhanQuyenNguoiDungKho pq, Instant bayGio) {
        pq.setTrangThai(0);
        if (pq.getNgayKetThuc() == null || pq.getNgayKetThuc().isAfter(bayGio)) {
            pq.setNgayKetThuc(bayGio);
        }
        phanQuyenNguoiDungKhoRepository.save(pq);
        boQuanLyKho(pq.getKho(), pq.getNguoiDung());
        for (ChiTietQuyenKho ct : chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(pq.getId())) {
            if (Integer.valueOf(1).equals(ct.getTrangThai())) {
                ct.setTrangThai(0);
                chiTietQuyenKhoRepository.save(ct);
            }
        }
    }

    /**
     * Người dùng không còn quản lý kho này (chuyển kho, thu hồi, đổi vai trò) thì bỏ khỏi kho.quan_ly_id:
     * cột này cho quyền duyệt yêu cầu mua hàng của kho (YeuCauMuaHangService.coQuyenDuyetKho).
     */
    private void boQuanLyKho(Kho kho, NguoiDung nguoiDung) {
        if (kho == null || nguoiDung == null || kho.getQuanLy() == null) return;
        if (Objects.equals(kho.getQuanLy().getId(), nguoiDung.getId())) {
            kho.setQuanLy(null);
            khoRepository.save(kho);
        }
    }

    private static PhanQuyenNguoiDungKho chonPhanQuyenChinh(List<PhanQuyenNguoiDungKho> dangCo, Integer khoId) {
        if (dangCo.isEmpty()) return null;
        return dangCo.stream()
                .filter(p -> khoId != null && p.getKho() != null && khoId.equals(p.getKho().getId()))
                .findFirst()
                .orElse(dangCo.get(0));
    }

    /** Id quyền gửi lên → quyền hạn, giữ thứ tự id; id không tồn tại thì báo lỗi. */
    private Map<Integer, QuyenHan> layQuyenHopLe(List<Integer> ids) {
        Map<Integer, QuyenHan> ketQua = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) return ketQua;
        Set<Integer> duyNhat = ids.stream().filter(Objects::nonNull).collect(Collectors.toCollection(TreeSet::new));
        Map<Integer, QuyenHan> tonTai = quyenHanRepository.findAllById(duyNhat).stream()
                .collect(Collectors.toMap(QuyenHan::getId, Function.identity()));
        for (Integer id : duyNhat) {
            QuyenHan quyen = tonTai.get(id);
            if (quyen == null) {
                throw new CommonException("Quyền không tồn tại: " + id);
            }
            ketQua.put(id, quyen);
        }
        return ketQua;
    }

    private AnhChup chup(String vaiTro, PhanQuyenNguoiDungKho pq) {
        if (pq == null) {
            return new AnhChup(vaiTro, null, null, new TreeSet<>());
        }
        TreeSet<String> quyen = chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(pq.getId()).stream()
                .filter(ct -> Integer.valueOf(1).equals(ct.getTrangThai()))
                .map(ct -> ct.getQuyenHan().getMaQuyen())
                .collect(Collectors.toCollection(TreeSet::new));
        return new AnhChup(vaiTro, pq.getKho(), pq.getNgayKetThuc(), quyen);
    }

    private void ghiLichSuPhanQuyen(NguoiDung nguoiDung, AnhChup truoc, AnhChup sau, NguoiDung nguoiThucHien,
                                    Instant bayGio) {
        lichSuThayDoiRepository.save(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.nguoi_dung)
                .idThamChieu(nguoiDung.getId())
                .kho(sau.kho() != null ? sau.kho() : truoc.kho())
                .hanhDong(IHanhDong.cap_nhat_phan_quyen)
                .giaTriCu(sangJson(truoc))
                .giaTriMoi(sangJson(sau))
                .nguoiThucHien(nguoiThucHien)
                .ngayThucHien(bayGio)
                .ghiChu("Cập nhật phân quyền cho " + ITable.nguoi_dung + " id: " + nguoiDung.getId())
                .build());
    }

    private String sangJson(AnhChup anh) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vaiTro", anh.vaiTro());
        if (anh.kho() == null) {
            m.put("kho", null);
        } else {
            Map<String, Object> kho = new LinkedHashMap<>();
            kho.put("id", anh.kho().getId());
            kho.put("maKho", anh.kho().getMaKho());
            kho.put("tenKho", anh.kho().getTenKho());
            kho.put("loaiKho", anh.kho().getLoaiKho());
            m.put("kho", kho);
        }
        m.put("ngayKetThuc", anh.ngayKetThuc() == null ? null : anh.ngayKetThuc().toString());
        m.put("quyen", new ArrayList<>(anh.quyen()));
        try {
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            log.warn("[PHAN-QUYEN] Không ghi được ảnh chụp phân quyền: {}", e.getMessage());
            return "{}";
        }
    }

    /** Vai trò, kho, hạn hiệu lực và mã các quyền đang bật tại một thời điểm. */
    record AnhChup(String vaiTro, Kho kho, Instant ngayKetThuc, TreeSet<String> quyen) {
        boolean giongNhau(AnhChup khac) {
            Integer khoId = kho == null ? null : kho.getId();
            Integer khoIdKhac = khac.kho == null ? null : khac.kho.getId();
            return Objects.equals(vaiTro, khac.vaiTro)
                    && Objects.equals(khoId, khoIdKhac)
                    && Objects.equals(ngayKetThuc, khac.ngayKetThuc)
                    && Objects.equals(quyen, khac.quyen);
        }
    }

    // ───────────────────────── API cũ: gán vai trò, gán quyền, xóa quyền ─────────────────────────

    /**
     * PUT /vai-tro/gan-vai-tro: đổi vai trò nhưng giữ kho, hạn và quyền hiện có, đi qua cùng luồng lưu
     * (vai trò không dùng kho thì thu hồi kho; có ghi lịch sử).
     */
    @Override
    @Transactional
    public void doiVaiTro(Integer nguoiDungId, String vaiTro) {
        if (nguoiDungId == null) {
            throw new CommonException("Thông tin gán vai trò không hợp lệ");
        }
        nguoiDungRepository.findById(nguoiDungId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));
        String vaiTroMoi = vaiTro == null ? "" : vaiTro.trim();
        PhanQuyenNguoiDungKho pq = phanQuyenNguoiDungKhoRepository
                .findGiuChoByNguoiDungId(nguoiDungId, clock.instant()).stream().findFirst().orElse(null);
        if (pq == null || pq.getKho() == null || VAI_TRO_KHONG_DUNG_KHO.contains(vaiTroMoi)) {
            luuPhanQuyen(nguoiDungId, new LuuPhanQuyenRequest(vaiTroMoi, null, null, List.of()));
            return;
        }
        List<Integer> quyenDangBat = chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(pq.getId()).stream()
                .filter(ct -> Integer.valueOf(1).equals(ct.getTrangThai()))
                .map(ct -> ct.getQuyenHan().getId())
                .toList();
        luuPhanQuyen(nguoiDungId, new LuuPhanQuyenRequest(vaiTroMoi, pq.getKho().getId(), pq.getNgayKetThuc(), quyenDangBat));
    }

    /**
     * Chặn trước khi chạy POST /quyen-han/gan-quyen (luồng cũ, giao diện không còn dùng).
     * Mọi người gọi: không phân kho cho quản trị viên/khách hàng, không phân vào kho ngừng hoạt động hay kho ảo,
     * hạn hiệu lực phải ở tương lai. Quản lý kho còn bị giới hạn: chỉ trong kho đang chọn, chỉ cho nhân viên
     * (không phải chính mình), không đặt quản lý kho, không cấp quyền mà chính mình không có.
     */
    @Override
    @Transactional(readOnly = true)
    public void kiemTraGanQuyenCu(Integer khoIdDangChon, PhanQuyenNguoiDungKhoCreating request) {
        if (request == null || request.getNguoiDungId() == null || request.getKhoId() == null) {
            throw new CommonException("Thông tin phân quyền không hợp lệ");
        }
        NguoiDung nguoiThucHien = nguoiDangDangNhap();
        NguoiDung nguoiDung = nguoiDungRepository.findById(request.getNguoiDungId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));
        Kho kho = khoRepository.findById(request.getKhoId())
                .orElseThrow(() -> new CommonException("Không tìm thấy kho"));
        Instant bayGio = clock.instant();

        if (VAI_TRO_KHONG_DUNG_KHO.contains(nguoiDung.getVaiTro())) {
            throw new CommonException("Quản trị viên và khách hàng không được phân kho");
        }
        List<PhanQuyenNguoiDungKho> giuCho = phanQuyenNguoiDungKhoRepository.findGiuChoByNguoiDungId(nguoiDung.getId(), bayGio);
        boolean daOKhoNay = giuCho.stream().anyMatch(p -> p.getKho() != null && kho.getId().equals(p.getKho().getId()));
        if (!daOKhoNay && !Integer.valueOf(1).equals(kho.getTrangThai())) {
            throw new CommonException("Kho " + kho.getTenKho() + " đang ngừng hoạt động, không phân người được");
        }
        if (!daOKhoNay && MA_KHO_AO.equals(kho.getMaKho())) {
            throw new CommonException("Kho ảo chỉ chứa hàng đang chuyển giữa các kho, không phân người được");
        }
        if (request.getNgayKetThuc() != null && !request.getNgayKetThuc().isAfter(bayGio)) {
            throw new CommonException("Ngày hết hiệu lực phải sau thời điểm hiện tại");
        }
        if (IRoleType.quan_tri_vien.equals(nguoiThucHien.getVaiTro())) {
            return;
        }

        if (!kho.getId().equals(khoIdDangChon)) {
            throw new CommonException("Bạn chỉ phân quyền được trong kho đang chọn");
        }
        if (nguoiDung.getId().equals(nguoiThucHien.getId())) {
            throw new CommonException("Bạn không thể tự cấp quyền cho chính mình");
        }
        if (!VAI_TRO_NHAN_VIEN.contains(nguoiDung.getVaiTro())) {
            throw new CommonException("Quản lý kho chỉ phân quyền được cho nhân viên");
        }
        if (Integer.valueOf(1).equals(request.getLaQuanLyKho())) {
            throw new CommonException("Chỉ quản trị viên được đặt quản lý kho");
        }
        Set<String> quyenCuaToi = phanQuyenNguoiDungKhoRepository.findHieuLucTai(nguoiThucHien.getId(), bayGio).stream()
                .filter(p -> p.getKho() != null && kho.getId().equals(p.getKho().getId()))
                .flatMap(p -> chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(p.getId()).stream())
                .filter(ct -> Integer.valueOf(1).equals(ct.getTrangThai()))
                .map(ct -> ct.getQuyenHan().getMaQuyen())
                .collect(Collectors.toSet());
        List<Integer> idCap = request.getChiTietQuyenKhos() == null ? List.of() : request.getChiTietQuyenKhos().stream()
                .filter(ct -> ct != null && Integer.valueOf(1).equals(ct.getTrangThai()))
                .map(ChiTietQuyenKhoCreating::getQuyenHanId)
                .toList();
        for (QuyenHan quyen : layQuyenHopLe(idCap).values()) {
            if (!quyenCuaToi.contains(quyen.getMaQuyen())) {
                throw new CommonException("Bạn không thể cấp quyền mà chính bạn không có: " + quyen.getTenQuyen());
            }
        }
    }

    /**
     * DELETE /quyen-han/xoa-quyen/{id}: thu hồi (không xóa) một phân quyền kho và ghi lịch sử.
     * Quản lý kho chỉ thu hồi được phân quyền của nhân viên trong kho đang chọn, không phải của chính mình.
     */
    @Override
    @Transactional
    public void thuHoiPhanQuyenKhoTheoId(Integer phanQuyenId, Integer khoIdDangChon) {
        NguoiDung nguoiThucHien = nguoiDangDangNhap();
        PhanQuyenNguoiDungKho pq = phanQuyenId == null ? null
                : phanQuyenNguoiDungKhoRepository.findById(phanQuyenId).orElse(null);
        if (pq == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phân quyền kho id: " + phanQuyenId);
        }
        NguoiDung nguoiDung = pq.getNguoiDung();
        if (!IRoleType.quan_tri_vien.equals(nguoiThucHien.getVaiTro())) {
            if (pq.getKho() == null || !pq.getKho().getId().equals(khoIdDangChon)) {
                throw new CommonException("Bạn chỉ thu hồi được phân quyền trong kho đang chọn");
            }
            if (nguoiDung == null || nguoiDung.getId().equals(nguoiThucHien.getId())) {
                throw new CommonException("Bạn không thể tự thu hồi phân quyền của chính mình");
            }
            if (!VAI_TRO_NHAN_VIEN.contains(nguoiDung.getVaiTro())) {
                throw new CommonException("Quản lý kho chỉ thu hồi được phân quyền của nhân viên");
            }
        }
        if (!Integer.valueOf(1).equals(pq.getTrangThai())) {
            return; // đã thu hồi trước đó
        }
        Instant bayGio = clock.instant();
        String vaiTro = nguoiDung == null ? null : nguoiDung.getVaiTro();
        AnhChup truoc = chup(vaiTro, pq);
        thuHoiPhanQuyenKho(pq, bayGio);
        if (nguoiDung != null) {
            ghiLichSuPhanQuyen(nguoiDung, truoc, new AnhChup(vaiTro, null, null, new TreeSet<>()), nguoiThucHien, bayGio);
        }
    }

    // ───────────────────────────────── Lịch sử ─────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<LichSuPhanQuyenDto> layLichSuPhanQuyen(Integer nguoiDungId) {
        if (nguoiDungId == null || !nguoiDungRepository.existsById(nguoiDungId)) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng");
        }
        List<LichSuThayDoi> banGhi = lichSuThayDoiRepository
                .findByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        ITable.nguoi_dung, nguoiDungId, HANH_DONG_PHAN_QUYEN, PageRequest.of(0, SO_LICH_SU_TOI_DA));

        Map<String, String> tenTheoMa = new HashMap<>();
        Map<Integer, String> maTheoId = new HashMap<>();
        Map<String, Integer> idTheoMa = new HashMap<>();
        for (QuyenHan q : quyenHanRepository.findAll()) {
            tenTheoMa.put(q.getMaQuyen(), q.getTenQuyen());
            maTheoId.put(q.getId(), q.getMaQuyen());
            idTheoMa.put(q.getMaQuyen(), q.getId());
        }

        List<LichSuPhanQuyenDto> ketQua = new ArrayList<>();
        LichSuPhanQuyenDto nhomCu = null;
        String khoaNhomCu = null;
        // Nhóm bản ghi cũ có dòng theo từng quyền hay chỉ có dòng "nâng cấp chức vụ"
        Map<LichSuPhanQuyenDto, Boolean> nhomCoDongQuyen = new IdentityHashMap<>();
        for (LichSuThayDoi ls : banGhi) {
            if (IHanhDong.cap_nhat_phan_quyen.equals(ls.getHanhDong())) {
                ketQua.add(tuBanGhiMoi(ls, tenTheoMa, idTheoMa));
                nhomCu = null;
                continue;
            }
            // Bản ghi cũ ghi từng quyền: gộp các dòng cùng giây, cùng người thực hiện, cùng kho
            String khoa = (ls.getNgayThucHien() == null ? "" : ls.getNgayThucHien().truncatedTo(ChronoUnit.SECONDS))
                    + "|" + (ls.getNguoiThucHien() == null ? "" : ls.getNguoiThucHien().getId())
                    + "|" + (ls.getKho() == null ? "" : ls.getKho().getId());
            if (nhomCu == null || !khoa.equals(khoaNhomCu)) {
                KhoTomTatDto kho = KhoTomTatDto.tu(ls.getKho());
                nhomCu = LichSuPhanQuyenDto.builder()
                        .id(ls.getId())
                        .luc(ls.getNgayThucHien())
                        .nguoiThucHienId(ls.getNguoiThucHien() == null ? null : ls.getNguoiThucHien().getId())
                        .nguoiThucHien(ls.getNguoiThucHien() == null ? null : ls.getNguoiThucHien().getHoTen())
                        .khoCu(kho)
                        .khoMoi(kho)
                        .quyenThem(new ArrayList<>())
                        .quyenBo(new ArrayList<>())
                        .build();
                ketQua.add(nhomCu);
                nhomCoDongQuyen.put(nhomCu, false);
                khoaNhomCu = khoa;
            }
            if (!IHanhDong.nang_cap_chuc_vu.equals(ls.getHanhDong())) {
                nhomCoDongQuyen.put(nhomCu, true);
            }
            apDungBanGhiCu(nhomCu, ls, maTheoId, tenTheoMa);
        }
        // Bản ghi cũ: lần gán đầu chỉ ghi "nâng cấp chức vụ" (không ghi từng quyền) → hiện là "được phân vào kho";
        // nhóm có dòng từng quyền nhưng không quyền nào đổi trạng thái là lần lưu không thay đổi gì → bỏ.
        ketQua.removeIf(nhom -> {
            Boolean coDongQuyen = nhomCoDongQuyen.get(nhom);
            if (coDongQuyen == null) return false;
            if (!coDongQuyen) {
                nhom.setKhoCu(null);
                return nhom.getKhoMoi() == null;
            }
            return nhom.getQuyenThem().isEmpty() && nhom.getQuyenBo().isEmpty();
        });
        return ketQua;
    }

    private LichSuPhanQuyenDto tuBanGhiMoi(LichSuThayDoi ls, Map<String, String> tenTheoMa,
                                           Map<String, Integer> idTheoMa) {
        JsonNode cu = docJson(ls.getGiaTriCu());
        JsonNode moi = docJson(ls.getGiaTriMoi());
        KhoTomTatDto khoCu = docKho(cu == null ? null : cu.get("kho"));
        KhoTomTatDto khoMoi = docKho(moi == null ? null : moi.get("kho"));
        List<String> quyenCu = docDanhSach(cu == null ? null : cu.get("quyen"));
        List<String> quyenMoi = docDanhSach(moi == null ? null : moi.get("quyen"));
        String hanCu = docChuoi(cu, "ngayKetThuc");
        String hanMoi = docChuoi(moi, "ngayKetThuc");

        boolean cungKho = khoCu != null && khoMoi != null && Objects.equals(khoCu.getId(), khoMoi.getId());
        List<String> them;
        List<String> bo;
        if (cungKho || (khoCu == null && khoMoi == null)) {
            them = quyenMoi.stream().filter(m -> !quyenCu.contains(m)).toList();
            bo = quyenCu.stream().filter(m -> !quyenMoi.contains(m)).toList();
        } else if (khoMoi == null) {
            them = List.of();
            bo = quyenCu;
        } else {
            them = quyenMoi; // kho mới (hoặc đổi kho): mọi quyền đều là cấp mới tại kho này
            bo = List.of();
        }
        return LichSuPhanQuyenDto.builder()
                .id(ls.getId())
                .luc(ls.getNgayThucHien())
                .nguoiThucHienId(ls.getNguoiThucHien() == null ? null : ls.getNguoiThucHien().getId())
                .nguoiThucHien(ls.getNguoiThucHien() == null ? null : ls.getNguoiThucHien().getHoTen())
                .vaiTroCu(docChuoi(cu, "vaiTro"))
                .vaiTroMoi(docChuoi(moi, "vaiTro"))
                .khoCu(khoCu)
                .khoMoi(khoMoi)
                .doiHieuLuc(cungKho && !Objects.equals(hanCu, hanMoi))
                .ngayKetThucMoi(docThoiDiem(hanMoi))
                .quyenThem(sapTheoId(them, idTheoMa).stream().map(m -> tenTheoMa.getOrDefault(m, m)).toList())
                .quyenBo(sapTheoId(bo, idTheoMa).stream().map(m -> tenTheoMa.getOrDefault(m, m)).toList())
                .build();
    }

    /** Xếp mã quyền theo thứ tự trong bảng quyen_han (cũng là thứ tự hiển thị). */
    private static List<String> sapTheoId(List<String> ma, Map<String, Integer> idTheoMa) {
        return ma.stream()
                .sorted(Comparator.comparing((String m) -> idTheoMa.getOrDefault(m, Integer.MAX_VALUE)))
                .toList();
    }

    /** Bản ghi cũ: mỗi dòng một quyền, giá trị là ChiTietQuyenKhoDto hoặc {quyenHanId, trangThai}. */
    private void apDungBanGhiCu(LichSuPhanQuyenDto nhom, LichSuThayDoi ls, Map<Integer, String> maTheoId,
                                Map<String, String> tenTheoMa) {
        if (IHanhDong.nang_cap_chuc_vu.equals(ls.getHanhDong())) return;
        JsonNode moi = docJson(ls.getGiaTriMoi());
        if (moi == null) return;
        String ma = null;
        if (moi.hasNonNull("quyenHan")) {
            ma = docChuoi(moi.get("quyenHan"), "maQuyen");
        } else if (moi.hasNonNull("quyenHanId")) {
            ma = maTheoId.get(moi.get("quyenHanId").asInt());
        }
        if (ma == null) return;
        Integer trangThaiMoi = moi.hasNonNull("trangThai") ? moi.get("trangThai").asInt() : null;
        JsonNode cu = docJson(ls.getGiaTriCu());
        Integer trangThaiCu = cu != null && cu.hasNonNull("trangThai") ? cu.get("trangThai").asInt() : null;
        String ten = tenTheoMa.getOrDefault(ma, ma);
        if (Integer.valueOf(1).equals(trangThaiMoi) && !Integer.valueOf(1).equals(trangThaiCu)
                && !nhom.getQuyenThem().contains(ten)) {
            nhom.getQuyenThem().add(ten);
        } else if (Integer.valueOf(0).equals(trangThaiMoi) && !Integer.valueOf(0).equals(trangThaiCu)
                && !nhom.getQuyenBo().contains(ten)) {
            nhom.getQuyenBo().add(ten);
        }
    }

    private JsonNode docJson(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            JsonNode n = objectMapper.readTree(s);
            return n != null && n.isObject() ? n : null;
        } catch (JsonProcessingException e) {
            return null; // bản ghi cũ có thể là "error when parse"
        }
    }

    private static String docChuoi(JsonNode n, String truong) {
        if (n == null || !n.hasNonNull(truong)) return null;
        return n.get(truong).asText();
    }

    private static List<String> docDanhSach(JsonNode n) {
        List<String> ds = new ArrayList<>();
        if (n != null && n.isArray()) {
            n.forEach(x -> ds.add(x.asText()));
        }
        return ds;
    }

    private static KhoTomTatDto docKho(JsonNode n) {
        if (n == null || !n.isObject()) return null;
        return KhoTomTatDto.builder()
                .id(n.hasNonNull("id") ? n.get("id").asInt() : null)
                .maKho(docChuoi(n, "maKho"))
                .tenKho(docChuoi(n, "tenKho"))
                .loaiKho(docChuoi(n, "loaiKho"))
                .build();
    }

    private static Instant docThoiDiem(String s) {
        if (s == null) return null;
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    // ───────────────────────────────── Cấu hình phân quyền ─────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public CauHinhPhanQuyenDto layCauHinhPhanQuyen() {
        Map<String, List<Integer>> daLuu = mauQuyenVaiTroRepository.layTatCa();
        Map<String, List<Integer>> mau = new LinkedHashMap<>();
        for (String vaiTro : VAI_TRO_CO_MAU) {
            mau.put(vaiTro, daLuu.getOrDefault(vaiTro, List.of()));
        }
        return CauHinhPhanQuyenDto.builder()
                .mauQuyen(mau)
                .quyenNhayCam(mauQuyenVaiTroRepository.layIdQuyenNhayCam())
                .quyenDaApDung(quyenDaApDung())
                .build();
    }

    @Override
    @Transactional
    public void capNhatMauQuyen(String vaiTro, List<Integer> quyenHanIds) {
        if (vaiTro == null || !VAI_TRO_CO_MAU.contains(vaiTro)) {
            throw new CommonException("Vai trò này không có mẫu quyền");
        }
        NguoiDung nguoiThucHien = nguoiDangDangNhap();
        Map<Integer, QuyenHan> quyen = layQuyenHopLe(quyenHanIds);
        List<Integer> cu = mauQuyenVaiTroRepository.layTatCa().getOrDefault(vaiTro, List.of());
        mauQuyenVaiTroRepository.thayMau(vaiTro, quyen.keySet());

        Map<Integer, String> maTheoId = quyenHanRepository.findAll().stream()
                .collect(Collectors.toMap(QuyenHan::getId, QuyenHan::getMaQuyen));
        lichSuThayDoiRepository.save(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.cau_hinh_he_thong)
                .idThamChieu(0)
                .hanhDong(IHanhDong.cap_nhat_mau_quyen)
                .giaTriCu(jsonMau(vaiTro, cu.stream().map(maTheoId::get).filter(Objects::nonNull).toList()))
                .giaTriMoi(jsonMau(vaiTro, quyen.values().stream().map(QuyenHan::getMaQuyen).toList()))
                .nguoiThucHien(nguoiThucHien)
                .ngayThucHien(clock.instant())
                .ghiChu("Cập nhật mẫu quyền của vai trò " + vaiTro)
                .build());
    }

    private String jsonMau(String vaiTro, List<String> ma) {
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("vaiTro", vaiTro);
            m.put("quyen", ma);
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    /**
     * Mã quyền mà ít nhất một API thật sự kiểm: quyền khai báo trong @RequireAuth chỉ được kiểm
     * khi có inWarehouse = true (xem AuthorizationAspect). Không quét được thì trả null (giao diện coi là chưa biết,
     * không gắn "Chưa áp dụng" cho quyền nào) và lần sau quét lại — danh sách rỗng sẽ bị hiểu là không API nào kiểm quyền.
     */
    List<String> quyenDaApDung() {
        List<String> daQuet = quyenDaApDungDaQuet;
        if (daQuet != null) return daQuet;
        Set<String> ma = new TreeSet<>();
        try {
            RequestMappingHandlerMapping anhXa = applicationContext.getBean(
                    "requestMappingHandlerMapping", RequestMappingHandlerMapping.class);
            if (anhXa == null) return null;
            for (HandlerMethod hm : anhXa.getHandlerMethods().values()) {
                // Giống AuthorizationAspect: chỉ đọc @RequireAuth trên phương thức; roles chứa "all" thì cho qua, không kiểm quyền
                RequireAuth ra = AnnotatedElementUtils.findMergedAnnotation(hm.getMethod(), RequireAuth.class);
                if (ra != null && ra.inWarehouse() && !Arrays.asList(ra.roles()).contains(IRoleType.all)) {
                    ma.addAll(Arrays.asList(ra.permissions()));
                }
            }
        } catch (RuntimeException e) {
            // Bean thiếu hoặc lỗi khi đọc annotation: chỉ mất phần "chưa áp dụng", không làm hỏng cả cấu hình / Quyền của tôi
            log.warn("[PHAN-QUYEN] Không quét được quyền đang áp dụng: {}", e.getMessage());
            return null;
        }
        daQuet = List.copyOf(ma);
        quyenDaApDungDaQuet = daQuet;
        return daQuet;
    }

    // ───────────────────────────────── Quyền của tôi ─────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public QuyenCuaToiDto layQuyenCuaToi() {
        NguoiDungAuthInfo phien = SecurityContextHolder.getUser();
        NguoiDung toi = nguoiDangDangNhap();
        String vaiTro = toi.getVaiTro();

        Set<String> vaiTroTrongPhien = phien.getVaiTro() == null ? Set.of() : phien.getVaiTro();
        boolean doiVaiTro = !vaiTroTrongPhien.isEmpty() && !vaiTroTrongPhien.contains(vaiTro);

        QuyenCuaToiDto.QuyenCuaToiDtoBuilder kq = QuyenCuaToiDto.builder()
                .vaiTro(vaiTro)
                .quyen(new ArrayList<>())
                .quyenMoi(List.of())
                .quyenDaThuHoi(List.of());

        if (IRoleType.quan_tri_vien.equals(vaiTro)) {
            return kq.toanQuyen(true).canDangNhapLai(doiVaiTro).build();
        }

        PhanQuyenNguoiDungKho pq = VAI_TRO_KHONG_DUNG_KHO.contains(vaiTro) ? null
                : phanQuyenNguoiDungKhoRepository.findHieuLucTai(toi.getId(), clock.instant()).stream().findFirst().orElse(null);
        List<QuyenHan> quyen = pq == null ? List.of()
                : chiTietQuyenKhoRepository.findByPhanQuyenNguoiDungKhoId(pq.getId()).stream()
                .filter(ct -> Integer.valueOf(1).equals(ct.getTrangThai()))
                .map(ChiTietQuyenKho::getQuyenHan)
                .sorted(Comparator.comparing(QuyenHan::getId))
                .toList();

        // So với phiên đăng nhập: token mang quyền tại thời điểm đăng nhập
        Integer khoId = pq == null ? null : pq.getKho().getId();
        Map<String, String> quyenTrongPhien = new LinkedHashMap<>();
        boolean khoKhacPhien = false;
        List<PhanQuyenNguoiDungKhoDto> pqPhien = phien.getPhanQuyenNguoiDungKhos() == null
                ? List.of() : phien.getPhanQuyenNguoiDungKhos();
        Set<Integer> khoTrongPhien = new LinkedHashSet<>();
        for (PhanQuyenNguoiDungKhoDto p : pqPhien) {
            if (p.getKho() == null) continue;
            khoTrongPhien.add(p.getKho().getId());
            if (!p.getKho().getId().equals(khoId) || p.getChiTietQuyenKhos() == null) continue;
            for (ChiTietQuyenKhoDto ct : p.getChiTietQuyenKhos()) {
                if (Integer.valueOf(1).equals(ct.getTrangThai()) && ct.getQuyenHan() != null) {
                    quyenTrongPhien.put(ct.getQuyenHan().getMaQuyen(), ct.getQuyenHan().getTenQuyen());
                }
            }
        }
        if (khoId == null ? !khoTrongPhien.isEmpty() : !khoTrongPhien.equals(Set.of(khoId))) {
            khoKhacPhien = true;
        }
        Set<String> maTrongCsdl = quyen.stream().map(QuyenHan::getMaQuyen).collect(Collectors.toSet());
        List<String> quyenMoi = quyen.stream().map(QuyenHan::getMaQuyen)
                .filter(m -> !quyenTrongPhien.containsKey(m)).toList();
        List<String> quyenDaThuHoi = quyenTrongPhien.entrySet().stream()
                .filter(e -> !maTrongCsdl.contains(e.getKey()))
                .map(e -> e.getValue() != null ? e.getValue() : e.getKey())
                .toList();

        Instant capNhatLuc = pq == null ? null : pq.getNgayBatDau();
        NguoiDung nguoiCapNhat = pq == null ? null : pq.getNguoiCapQuyen();
        LichSuThayDoi ganNhat = lichSuThayDoiRepository
                .findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        ITable.nguoi_dung, toi.getId(), HANH_DONG_PHAN_QUYEN)
                .orElse(null);
        if (ganNhat != null) {
            capNhatLuc = ganNhat.getNgayThucHien();
            if (ganNhat.getNguoiThucHien() != null) {
                nguoiCapNhat = ganNhat.getNguoiThucHien();
            }
        }

        return kq.kho(pq == null ? null : KhoTomTatDto.tu(pq.getKho()))
                .ngayBatDau(pq == null ? null : pq.getNgayBatDau())
                .ngayKetThuc(pq == null ? null : pq.getNgayKetThuc())
                .quyen(quyen.stream().map(PhanQuyenNguoiDungServiceImpl::sangDto).toList())
                .capNhatLuc(capNhatLuc)
                .capNhatBoi(nguoiCapNhat == null ? null : nguoiCapNhat.getHoTen())
                .capNhatBoiEmail(nguoiCapNhat == null ? null : nguoiCapNhat.getEmail())
                .canDangNhapLai(doiVaiTro || khoKhacPhien || !quyenMoi.isEmpty() || !quyenDaThuHoi.isEmpty())
                .quyenMoi(quyenMoi)
                .quyenDaThuHoi(quyenDaThuHoi)
                .quyenDaApDung(quyenDaApDung())
                .build();
    }

    private static QuyenHanDto sangDto(QuyenHan q) {
        return QuyenHanDto.builder()
                .id(q.getId())
                .maQuyen(q.getMaQuyen())
                .tenQuyen(q.getTenQuyen())
                .moTa(q.getMoTa())
                .nhomQuyen(q.getNhomQuyen())
                .build();
    }

    private NguoiDung nguoiDangDangNhap() {
        NguoiDungAuthInfo phien = SecurityContextHolder.getUser();
        if (phien == null || phien.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn");
        }
        return nguoiDungRepository.findById(phien.getId())
                .orElseThrow(() -> new CommonException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản đang đăng nhập"));
    }
}
