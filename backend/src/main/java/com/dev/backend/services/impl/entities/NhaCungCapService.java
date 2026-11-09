package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.NhaCungCapCreating;
import com.dev.backend.dto.request.NhaCungCapUpdating;
import com.dev.backend.dto.response.customize.NhaCungCapKiemTraXoaDto;
import com.dev.backend.dto.response.entities.NhaCungCapDto;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NhaCungCapMapper;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.LoHangRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.i18n.ThongDiep;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Service xử lý nghiệp vụ cho entity Nhà Cung Cấp
 * Kế thừa BaseServiceImpl để dùng các chức năng CRUD chung
 *
 * Quy tắc nghiệp vụ:
 * - Nhà cung cấp mới luôn ở trạng thái Hoạt động.
 * - Ngừng hoạt động / cho phép hoạt động lại là thao tác riêng ({@link #capNhatTrangThai}); nhà cung cấp
 *   ngừng hoạt động không được chọn khi gửi yêu cầu báo giá, chứng từ đang mở vẫn xử lý bình thường.
 * - Chỉ xóa được nhà cung cấp chưa phát sinh giao dịch; đã có giao dịch thì chuyển sang Ngừng hoạt động.
 */
@Service
public class NhaCungCapService extends BaseServiceImpl<NhaCungCap, Integer> {

    public static final int TRANG_THAI_NGUNG_HOAT_DONG = 0;
    public static final int TRANG_THAI_HOAT_DONG = 1;

    // Repository thao tác với database
    private final NhaCungCapRepository repository;

    // Mapper dùng để convert giữa Entity <-> DTO
    private final NhaCungCapMapper mapper;

    // EntityManager dùng cho BaseServiceImpl (query động, paging, sort...)
    private final EntityManager entityManager;

    // Các bảng trỏ tới nhà cung cấp bằng khóa ngoại — dùng khi kiểm tra xóa
    private final DonMuaHangRepository donMuaHangRepository;
    private final PhieuNhapKhoRepository phieuNhapKhoRepository;
    private final LoHangRepository loHangRepository;

    // Mã vạch của nhà cung cấp là cấu hình, không phải giao dịch: xóa nhà cung cấp thì xóa kèm
    // (bảng ma_vach_nha_cung_cap không có khóa ngoại nên không tự chặn, để lại sẽ thành dòng mồ côi)
    private final MaVachNhaCungCapRepository maVachNhaCungCapRepository;

    @Autowired
    private NhatKyNghiepVu nhatKy;

    // Thông báo quản trị viên khi đổi MST (Đ3); test dựng tay không có thì bỏ qua
    @Autowired(required = false)
    private ThongBaoHeThongService thongBaoHeThongService;

    /** Trường nhạy cảm: đổi thì ghi chú "[Nhạy cảm]" và báo quản trị viên. Khóa ảnh chụp → tên hiển thị. */
    static final Map<String, String> TRUONG_NHAY_CAM = Map.of(
            "maSoThue", "mã số thuế");

    @Autowired
    public NhaCungCapService(NhaCungCapRepository repository,
                             NhaCungCapMapper mapper,
                             EntityManager entityManager,
                             DonMuaHangRepository donMuaHangRepository,
                             PhieuNhapKhoRepository phieuNhapKhoRepository,
                             LoHangRepository loHangRepository,
                             MaVachNhaCungCapRepository maVachNhaCungCapRepository) {
        // Truyền repository lên class cha
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
        this.donMuaHangRepository = donMuaHangRepository;
        this.phieuNhapKhoRepository = phieuNhapKhoRepository;
        this.loHangRepository = loHangRepository;
        this.maVachNhaCungCapRepository = maVachNhaCungCapRepository;
    }

    /**
     * Override EntityManager cho BaseServiceImpl sử dụng
     */
    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    /**
     * Lấy danh sách nhà cung cấp, mới nhất lên đầu.
     * - Nếu không có keyword: lấy tất cả
     * - Nếu có keyword: tìm theo mã, tên, người liên hệ, số điện thoại, email (không phân biệt hoa thường)
     */
    public List<NhaCungCapDto> findAll(String searchKeyword) {
        String tuKhoa = searchKeyword == null ? "" : searchKeyword.trim();
        List<NhaCungCap> entities = tuKhoa.isEmpty()
                ? repository.findAll(Sort.by(Sort.Direction.DESC, "id"))
                : repository.timKiem(tuKhoa);
        return mapper.toDtoList(entities);
    }

    /**
     * Tìm nhà cung cấp theo ID và trả về DTO
     */
    public NhaCungCapDto findByIdDto(Integer id) {
        return mapper.toDto(timTheoId(id));
    }

    /**
     * Tạo mới nhà cung cấp
     * - Check trùng mã nhà cung cấp
     * - Luôn ở trạng thái Hoạt động
     * - Trả về DTO
     */
    @Transactional
    public NhaCungCapDto create(NhaCungCapCreating creating) {
        String ma = creating.getMaNhaCungCap().trim();

        // Kiểm tra mã nhà cung cấp đã tồn tại chưa (cột UNIQUE, so khớp theo collation không phân biệt hoa thường)
        if (repository.existsByMaNhaCungCap(ma)) {
            throw new CommonException(
                    ThongDiep.of("sanPhamMuaHang.nccMaDaTonTai", ma),
                    HttpStatus.CONFLICT, null
            );
        }

        NhaCungCap entity = NhaCungCap.builder()
                .maNhaCungCap(ma)
                .tenNhaCungCap(creating.getTenNhaCungCap().trim())
                .maSoThue(chuanHoa(creating.getMaSoThue()))
                .nguoiLienHe(chuanHoa(creating.getNguoiLienHe()))
                .soDienThoai(creating.getSoDienThoai().trim())
                .email(creating.getEmail().trim())
                .diaChi(chuanHoa(creating.getDiaChi()))
                .trangThai(TRANG_THAI_HOAT_DONG)
                .build();

        // Lưu vào database
        entity = repository.save(entity);
        nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap, entity.getId(), IHanhDong.them_nha_cung_cap)
                .ma(entity.getMaNhaCungCap())
                .moi(anhChup(entity)));

        // Trả về DTO
        return mapper.toDto(entity);
    }

    /**
     * Cập nhật thông tin nhà cung cấp theo ID (thay toàn bộ form, trừ mã, trạng thái và thông tin ngân hàng).
     * Trường tùy chọn gửi rỗng là xóa giá trị cũ. Ngân hàng / số tài khoản không sửa qua đây (không quản lý thanh toán
     * nhà cung cấp): giữ nguyên giá trị đang lưu.
     */
    @Transactional
    public NhaCungCapDto update(Integer id, NhaCungCapUpdating updating) {

        // Lấy entity hiện tại
        NhaCungCap entity = timTheoId(id);
        Map<String, Object> truoc = anhChup(entity);

        entity.setTenNhaCungCap(updating.getTenNhaCungCap().trim());
        // Client cũ không gửi mã số thuế: giữ nguyên; gửi rỗng là xóa
        if (updating.getMaSoThue() != null) {
            entity.setMaSoThue(chuanHoa(updating.getMaSoThue()));
        }
        entity.setNguoiLienHe(chuanHoa(updating.getNguoiLienHe()));
        entity.setSoDienThoai(updating.getSoDienThoai().trim());
        entity.setEmail(updating.getEmail().trim());
        entity.setDiaChi(chuanHoa(updating.getDiaChi()));
        entity.setNgayCapNhat(Instant.now());

        // Lưu lại entity sau khi update
        entity = repository.save(entity);
        ghiSua(entity, truoc);

        return mapper.toDto(entity);
    }

    /**
     * Ngừng hoạt động (0) / cho phép hoạt động lại (1).
     * Không đụng tới chứng từ đã có: đơn mua đang mở vẫn nhận hàng, thanh toán bình thường;
     * chỉ chặn chọn nhà cung cấp này khi gửi yêu cầu báo giá mới.
     */
    @Transactional
    public NhaCungCapDto capNhatTrangThai(Integer id, Integer trangThai) {
        if (trangThai == null
                || (trangThai != TRANG_THAI_HOAT_DONG && trangThai != TRANG_THAI_NGUNG_HOAT_DONG)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.trangThaiKhongHopLeCham"));
        }

        NhaCungCap entity = timTheoId(id);
        // Bấm hai lần / hai người cùng thao tác: trạng thái đã đúng thì không ghi lại.
        if (Objects.equals(entity.getTrangThai(), trangThai)) {
            return mapper.toDto(entity);
        }

        Integer trangThaiCu = entity.getTrangThai();
        entity.setTrangThai(trangThai);
        entity.setNgayCapNhat(Instant.now());
        NhaCungCap daLuu = repository.save(entity);
        nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap, daLuu.getId(), IHanhDong.doi_trang_thai_nha_cung_cap)
                .ma(daLuu.getMaNhaCungCap())
                .cu(NhatKyNghiepVu.anh("trangThai", trangThaiCu))
                .moi(NhatKyNghiepVu.anh("trangThai", trangThai))
                .ghiChu(trangThai == TRANG_THAI_HOAT_DONG ? "Cho hoạt động lại" : "Ngừng hoạt động"));
        return mapper.toDto(daLuu);
    }

    /**
     * Kiểm tra nhà cung cấp đã phát sinh giao dịch chưa (đơn mua hàng / yêu cầu báo giá, phiếu nhập kho,
     * lô hàng — tính mọi trạng thái vì cả bản ghi đã hủy vẫn giữ khóa ngoại).
     */
    @Transactional(readOnly = true)
    public NhaCungCapKiemTraXoaDto kiemTraXoa(Integer id) {
        if (!repository.existsById(id)) {
            throw khongTimThay(id);
        }
        long soDonMuaHang = donMuaHangRepository.countByNhaCungCap_Id(id);
        long soPhieuNhapKho = phieuNhapKhoRepository.countByNhaCungCap_Id(id);
        long soLoHang = loHangRepository.countByNhaCungCap_Id(id);

        return NhaCungCapKiemTraXoaDto.builder()
                .coTheXoa(soDonMuaHang + soPhieuNhapKho + soLoHang == 0)
                .soDonMuaHang(soDonMuaHang)
                .soPhieuNhapKho(soPhieuNhapKho)
                .soLoHang(soLoHang)
                .build();
    }

    /**
     * Xóa nhà cung cấp theo ID — chỉ khi chưa phát sinh giao dịch (nhập nhầm).
     * Đã có giao dịch thì từ chối, kèm kết quả kiểm tra trong `data` để giao diện đề nghị Ngừng hoạt động.
     * Mã vạch nhà cung cấp (nếu có) xóa kèm trong cùng giao dịch.
     */
    @Override
    @Transactional
    public void delete(Integer id) {
        NhaCungCapKiemTraXoaDto kiemTra = kiemTraXoa(id);
        if (!kiemTra.isCoTheXoa()) {
            throw new CommonException(lyDoKhongTheXoa(kiemTra), HttpStatus.CONFLICT, kiemTra);
        }
        NhaCungCap entity = timTheoId(id);
        // Xóa cứng: giữ ảnh chụp toàn bộ bản ghi trong nhật ký
        nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap, id, IHanhDong.xoa_nha_cung_cap)
                .ma(entity.getMaNhaCungCap())
                .cu(anhChup(entity))
                .ghiChu("Xóa nhà cung cấp " + entity.getTenNhaCungCap() + " (chưa phát sinh giao dịch)"));
        maVachNhaCungCapRepository.deleteByNhaCungCapId(id);
        repository.deleteById(id);
    }

    /** Ảnh chụp các trường nghiệp vụ của nhà cung cấp cho nhật ký (ngân hàng / số tài khoản đã bỏ, không ghi). */
    static Map<String, Object> anhChup(NhaCungCap n) {
        return NhatKyNghiepVu.anh(
                "maNhaCungCap", n.getMaNhaCungCap(),
                "tenNhaCungCap", n.getTenNhaCungCap(),
                "maSoThue", n.getMaSoThue(),
                "nguoiLienHe", n.getNguoiLienHe(),
                "soDienThoai", n.getSoDienThoai(),
                "email", n.getEmail(),
                "diaChi", n.getDiaChi(),
                "trangThai", n.getTrangThai());
    }

    /**
     * Ghi dòng sửa nhà cung cấp (chỉ trường đổi). Đổi MST thì ghi chú "[Nhạy cảm]" và báo mọi
     * quản trị viên trừ người sửa.
     */
    private void ghiSua(NhaCungCap entity, Map<String, Object> truoc) {
        NhatKyNghiepVu.Dong dong = NhatKyNghiepVu.dong(ITable.nha_cung_cap, entity.getId(), IHanhDong.sua_nha_cung_cap)
                .ma(entity.getMaNhaCungCap())
                .thayDoi(truoc, anhChup(entity));
        if (!dong.coThayDoi()) return;
        List<String> nhayCam = new ArrayList<>();
        for (Map.Entry<String, String> t : TRUONG_NHAY_CAM.entrySet()) {
            if (dong.giaTriMoi().containsKey(t.getKey())) nhayCam.add(t.getValue());
        }
        if (!nhayCam.isEmpty()) dong.ghiChu("[Nhạy cảm] Đổi " + String.join(", ", nhayCam));
        nhatKy.ghi(dong);
        if (!nhayCam.isEmpty() && thongBaoHeThongService != null) {
            NguoiDungAuthInfo nguoi = SecurityContextHolder.getUser();
            thongBaoHeThongService.nhaCungCapDoiThongTinNhayCam(entity.getId(), entity.getMaNhaCungCap(),
                    entity.getTenNhaCungCap(), nhayCam, nguoi == null ? null : nguoi.getId());
        }
    }

    // ── Hàm hỗ trợ ─────────────────────────────────────────────────────────

    private NhaCungCap timTheoId(Integer id) {
        return repository.findById(id).orElseThrow(() -> khongTimThay(id));
    }

    private static CommonException khongTimThay(Integer id) {
        return new CommonException(ThongDiep.of("sanPhamMuaHang.nccKhongTimThay", id), HttpStatus.NOT_FOUND, null);
    }

    /** Bỏ khoảng trắng hai đầu; chuỗi rỗng lưu thành NULL. */
    private static String chuanHoa(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static ThongDiep lyDoKhongTheXoa(NhaCungCapKiemTraXoaDto kiemTra) {
        List<ThongDiep> phan = new ArrayList<>();
        if (kiemTra.getSoDonMuaHang() > 0) phan.add(ThongDiep.of("sanPhamMuaHang.nccSoDonMua", kiemTra.getSoDonMuaHang()));
        if (kiemTra.getSoPhieuNhapKho() > 0) phan.add(ThongDiep.of("sanPhamMuaHang.nccSoPhieuNhap", kiemTra.getSoPhieuNhapKho()));
        if (kiemTra.getSoLoHang() > 0) phan.add(ThongDiep.of("sanPhamMuaHang.nccSoLoHang", kiemTra.getSoLoHang()));
        // Nối bằng ", " như câu cũ; mỗi số phần một câu (không dùng khóa chỉ có dấu nối: mẫu quá chung)
        return switch (phan.size()) {
            case 0 -> ThongDiep.of("sanPhamMuaHang.nccKhongTheXoa", "");
            case 1 -> ThongDiep.of("sanPhamMuaHang.nccKhongTheXoa", phan.get(0));
            case 2 -> ThongDiep.of("sanPhamMuaHang.nccKhongTheXoaHai", phan.get(0), phan.get(1));
            default -> ThongDiep.of("sanPhamMuaHang.nccKhongTheXoaBa", phan.get(0), phan.get(1), phan.get(2));
        };
    }
}
