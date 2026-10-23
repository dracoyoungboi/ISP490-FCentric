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
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
                    "Mã nhà cung cấp '" + ma + "' đã tồn tại. Vui lòng chọn mã khác.",
                    HttpStatus.CONFLICT, null
            );
        }

        String nganHang = chuanHoa(creating.getNganHang());
        String soNganHang = chuanHoa(creating.getSoNganHang());
        kiemTraThongTinNganHang(nganHang, soNganHang);

        NhaCungCap entity = NhaCungCap.builder()
                .maNhaCungCap(ma)
                .tenNhaCungCap(creating.getTenNhaCungCap().trim())
                .nguoiLienHe(chuanHoa(creating.getNguoiLienHe()))
                .soDienThoai(creating.getSoDienThoai().trim())
                .email(creating.getEmail().trim())
                .diaChi(chuanHoa(creating.getDiaChi()))
                .nganHang(nganHang)
                .soNganHang(soNganHang)
                .trangThai(TRANG_THAI_HOAT_DONG)
                .build();

        // Lưu vào database
        entity = repository.save(entity);

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

        entity.setTenNhaCungCap(updating.getTenNhaCungCap().trim());
        entity.setNguoiLienHe(chuanHoa(updating.getNguoiLienHe()));
        entity.setSoDienThoai(updating.getSoDienThoai().trim());
        entity.setEmail(updating.getEmail().trim());
        entity.setDiaChi(chuanHoa(updating.getDiaChi()));
        entity.setNgayCapNhat(Instant.now());

        // Lưu lại entity sau khi update
        entity = repository.save(entity);

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
            throw new CommonException("Trạng thái không hợp lệ.");
        }

        NhaCungCap entity = timTheoId(id);
        // Bấm hai lần / hai người cùng thao tác: trạng thái đã đúng thì không ghi lại.
        if (Objects.equals(entity.getTrangThai(), trangThai)) {
            return mapper.toDto(entity);
        }

        entity.setTrangThai(trangThai);
        entity.setNgayCapNhat(Instant.now());
        return mapper.toDto(repository.save(entity));
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
        maVachNhaCungCapRepository.deleteByNhaCungCapId(id);
        repository.deleteById(id);
    }

    // ── Hàm hỗ trợ ─────────────────────────────────────────────────────────

    private NhaCungCap timTheoId(Integer id) {
        return repository.findById(id).orElseThrow(() -> khongTimThay(id));
    }

    private static CommonException khongTimThay(Integer id) {
        return new CommonException("Không tìm thấy nhà cung cấp (mã số " + id + ").", HttpStatus.NOT_FOUND, null);
    }

    /** Bỏ khoảng trắng hai đầu; chuỗi rỗng lưu thành NULL. */
    private static String chuanHoa(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Mã QR thanh toán cần đủ cả ngân hàng và số tài khoản: nhập một thì phải nhập cả hai. */
    private static void kiemTraThongTinNganHang(String nganHang, String soNganHang) {
        if (nganHang == null && soNganHang != null) {
            throw new CommonException("Vui lòng chọn ngân hàng cho số tài khoản đã nhập.");
        }
        if (nganHang != null && soNganHang == null) {
            throw new CommonException("Vui lòng nhập số tài khoản cho ngân hàng đã chọn.");
        }
    }

    private static String lyDoKhongTheXoa(NhaCungCapKiemTraXoaDto kiemTra) {
        List<String> phan = new ArrayList<>();
        if (kiemTra.getSoDonMuaHang() > 0) phan.add(kiemTra.getSoDonMuaHang() + " đơn mua hàng");
        if (kiemTra.getSoPhieuNhapKho() > 0) phan.add(kiemTra.getSoPhieuNhapKho() + " phiếu nhập kho");
        if (kiemTra.getSoLoHang() > 0) phan.add(kiemTra.getSoLoHang() + " lô hàng");
        return "Nhà cung cấp đã có " + String.join(", ", phan)
                + " nên không thể xóa. Hãy chuyển sang Ngừng hoạt động để giữ lịch sử giao dịch.";
    }
}
