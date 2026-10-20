// src/main/java/com/dev/backend/services/impl/entities/KhachHangService.java
package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.request.PosQuickCustomerCreating;
import com.dev.backend.dto.response.customize.KhachHangDetailDto;
import com.dev.backend.dto.response.customize.LichSuMuaHangDto;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class KhachHangService extends BaseServiceImpl<KhachHang, Integer> {

    private static final int MAX_POS_CUSTOMER_PAGE_SIZE = 50;
    private static final Set<String> LOAI_KHACH_HANG_HOP_LE = Set.of("le", "si", "doanh_nghiep");
    /** trang_thai của khách hàng: 1 = đang hoạt động, 0 = ngừng hoạt động. */
    private static final Set<Integer> TRANG_THAI_HOP_LE = Set.of(0, 1);
    private static final String LOAI_CHUNG_TU_BAO_GIA = "bao_gia";
    // Cùng quy tắc với form khách hàng ở frontend (components/khach-hang/quyTacKhachHang.js)
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    /** Mã nhập tay: chữ không dấu, số và . _ - (như mã nhà cung cấp). */
    private static final Pattern MA_KHACH_HANG_PATTERN = Pattern.compile("^[A-Za-z0-9._-]+$");
    /**
     * Như nhà cung cấp: di động 10 số (03/05/07/08/09), máy bàn 11 số (02…), tổng đài 1800/1900.
     * Khách doanh nghiệp hay dùng số bàn, nên không chỉ nhận di động.
     */
    private static final Pattern SO_DIEN_THOAI_PATTERN = Pattern.compile("^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$");
    /** Mã số thuế: doanh nghiệp 10 số, đơn vị phụ thuộc 10 số + "-3 số"; hộ/cá nhân kinh doanh dùng số định danh 12 số. */
    static final Pattern MA_SO_THUE_PATTERN = Pattern.compile("^(\\d{10}(-\\d{3})?|\\d{12})$");
    static final String MA_SO_THUE_MESSAGE = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số";
    private static final int MA_KHACH_HANG_TOI_DA = 50;
    private static final int DIA_CHI_TOI_DA = 500;
    static final String CAN_LIEN_HE = "Cần số điện thoại hoặc email để liên hệ khách hàng";

    private final KhachHangRepository repository;
    private final KhachHangMapper mapper;
    private final EntityManager entityManager;
    private final DonBanHangRepository donBanHangRepository; // Thêm repo đơn hàng để lấy lịch sử
    private final DieuHanhHeThongService dieuHanhHeThongService; // đọc tiền tố mã khách hàng

    @Autowired
    public KhachHangService(KhachHangRepository repository,
                            KhachHangMapper mapper,
                            EntityManager entityManager,
                            DonBanHangRepository donBanHangRepository,
                            DieuHanhHeThongService dieuHanhHeThongService) {
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
        this.donBanHangRepository = donBanHangRepository;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
    }

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    // Function Customer Details (Cập nhật để trả về Full Lịch Sử Mua Hàng)
    @Transactional(readOnly = true)
    public KhachHangDetailDto getKhachHangDetail(Integer id) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy khách hàng với ID: " + id));

        // Lịch sử mua hàng: chỉ chứng từ đơn bán — báo giá dùng chung bảng don_ban_hang nhưng chưa phải đơn mua
        List<DonBanHang> donBanHangs = donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(id).stream()
                .filter(don -> !LOAI_CHUNG_TU_BAO_GIA.equals(don.getLoaiChungTu()))
                .toList();

        // Map sang DTO hiển thị cho bảng Lịch sử. Đơn không gắn kênh là đơn bán thường (kenh = null),
        // không phải đơn POS — đơn POS luôn gắn kênh POS.
        List<LichSuMuaHangDto> history = donBanHangs.stream().map(don -> LichSuMuaHangDto.builder()
                .maDonHang(don.getSoDonHang())
                .ngay(don.getNgayDatHang())
                .kenh(don.getKenhBanHang() != null ? don.getKenhBanHang().getMaKenh() : null)
                .giaTri(don.getTongCong())
                .build()
        ).collect(Collectors.toList());

        // Map thông tin trả về UI
        return KhachHangDetailDto.builder()
                .id(entity.getId())
                .maKhachHang(entity.getMaKhachHang())
                .tenKhachHang(entity.getTenKhachHang())
                .soDienThoai(entity.getSoDienThoai())
                .email(entity.getEmail())
                .diaChi(entity.getDiaChi())
                .lichSuMuaHang(history)
                .tongSoDonHang(history.size())
                .build();
    }

    /**
     * Thêm khách hàng từ popup Thêm khách hàng. Khách mới luôn Hoạt động.
     * - Mã để trống: hệ thống tạo tiền tố (Cấu hình hệ thống, MA_KHACH_HANG_TIEN_TO) + id 6 số, VD KH000124.
     *   Lấy theo id chứ không lấy "số lớn nhất + 1": mã POS dạng KH + số điện thoại sẽ làm số nhảy vọt.
     * - Mã nhập tay (giữ mã từ sổ cũ): chữ không dấu, số, . _ -; không được trùng (409).
     * - Cần ít nhất số điện thoại hoặc email; số điện thoại / email không trùng khách khác (409).
     * Trả về khách vừa tạo (có id) để màn hình mở được ngay.
     */
    @Transactional
    public KhachHangDto create(KhachHangCreating creating) {
        String ma = boTrong(creating.getMaKhachHang());
        String ten = boTrong(creating.getTenKhachHang());
        String maSoThue = boTrong(creating.getMaSoThue());
        String nguoiLienHe = boTrong(creating.getNguoiLienHe());
        String sdt = chuanHoaSoDienThoai(boTrong(creating.getSoDienThoai()));
        String email = boTrong(creating.getEmail());
        String diaChi = boTrong(creating.getDiaChi());

        if (ma != null) {
            if (ma.length() > MA_KHACH_HANG_TOI_DA) {
                throw new CommonException("Mã khách hàng tối đa 50 ký tự");
            }
            if (!MA_KHACH_HANG_PATTERN.matcher(ma).matches()) {
                throw new CommonException("Mã khách hàng chỉ gồm chữ không dấu, số và . _ -");
            }
        }
        kiemTraThongTinChung(ten, nguoiLienHe);
        kiemTraMaSoThue(maSoThue);
        kiemTraDiaChi(diaChi);
        kiemTraLienHe(sdt, email);
        if (sdt == null && email == null) {
            throw new CommonException(CAN_LIEN_HE);
        }
        String loai = chuanHoaLoaiKhachHang(creating.getLoaiKhachHang());

        if (ma != null && repository.existsByMaKhachHang(ma)) {
            throw new CommonException("Mã khách hàng " + ma + " đã được dùng", HttpStatus.CONFLICT, null);
        }
        kiemTraTrungLienHe(sdt, email, null);

        KhachHang saved = repository.save(KhachHang.builder()
                // Chưa có id thì chưa có mã tự tạo: ghi tạm một mã không thể trùng, có id rồi đổi ngay trong cùng giao dịch.
                .maKhachHang(ma != null ? ma : "TAM-" + UUID.randomUUID())
                .tenKhachHang(ten)
                .maSoThue(maSoThue)
                .nguoiLienHe(nguoiLienHe)
                .soDienThoai(sdt)
                .email(email)
                .diaChi(diaChi)
                .loaiKhachHang(loai)
                .trangThai(1)
                .build());
        if (ma == null) {
            saved.setMaKhachHang(maTuDong(saved.getId()));
            saved = repository.save(saved);
        }
        return mapper.toDto(saved);
    }

    /** Mã tự tạo: tiền tố + id 6 số; trùng với mã ai đó đã nhập tay thì thêm hậu tố -1, -2… */
    private String maTuDong(Integer id) {
        String goc = tienToMaKhachHang() + String.format("%06d", id);
        String ma = goc;
        int hauTo = 1;
        while (repository.existsByMaKhachHang(ma)) {
            ma = goc + "-" + hauTo++;
        }
        return ma;
    }

    /** Tiền tố trong Cấu hình hệ thống; giá trị hỏng (sửa tay trong CSDL) thì dùng tiền tố mặc định. */
    private String tienToMaKhachHang() {
        String giaTri = dieuHanhHeThongService.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_MA_KHACH_HANG_TIEN_TO,
                DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH);
        String tienTo = giaTri == null ? "" : giaTri.trim().toUpperCase(Locale.ROOT);
        return DieuHanhHeThongServiceImpl.TIEN_TO_MA_PATTERN.matcher(tienTo).matches()
                ? tienTo
                : DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH;
    }

    /**
     * Thêm nhanh khách hàng tại quầy POS (tên + SĐT).
     * - SĐT được chuẩn hóa (bỏ khoảng trắng, dấu chấm, gạch) và phải là 10 số bắt đầu bằng 0.
     * - SĐT đã tồn tại -> 409, data = khách hàng hiện có để thu ngân chọn lại (không tạo trùng).
     * - Mã khách hàng sinh tự động: KH + SĐT (thêm hậu tố nếu mã đã bị dùng).
     */
    @Transactional
    public KhachHangDto quickCreateForPos(PosQuickCustomerCreating request) {
        String ten = request == null || request.getTenKhachHang() == null ? "" : request.getTenKhachHang().trim();
        String sdt = request == null || request.getSoDienThoai() == null ? "" : request.getSoDienThoai().replaceAll("[\\s.\\-]", "");

        if (ten.isEmpty()) {
            throw new CommonException("Vui lòng nhập tên khách hàng");
        }
        if (ten.length() > 200) {
            throw new CommonException("Tên khách hàng tối đa 200 ký tự");
        }
        if (!sdt.matches("^0\\d{9}$")) {
            throw new CommonException("Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0");
        }

        KhachHang existing = repository.findFirstBySoDienThoai(sdt).orElse(null);
        if (existing != null) {
            throw new CommonException(
                    "Số điện thoại đã thuộc khách hàng " + existing.getTenKhachHang(),
                    HttpStatus.CONFLICT,
                    mapper.toDto(existing));
        }

        String ma = "KH" + sdt;
        int suffix = 1;
        while (repository.existsByMaKhachHang(ma)) {
            ma = "KH" + sdt + "-" + suffix++;
        }

        KhachHang saved = repository.save(KhachHang.builder()
                .maKhachHang(ma)
                .tenKhachHang(ten)
                .soDienThoai(sdt)
                .loaiKhachHang("le")
                .trangThai(1)
                .build());
        return mapper.toDto(saved);
    }

    // Function Edit Customer
    @Transactional
    public KhachHangDto update(Integer id, KhachHangUpdating updating) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy khách hàng với ID: " + id));

        // Trường chuỗi: null = giữ nguyên; chuỗi trắng = xóa trường (lưu NULL thay vì "")
        String ten = updating.getTenKhachHang() != null ? boTrong(updating.getTenKhachHang()) : entity.getTenKhachHang();
        String nguoiLienHe = updating.getNguoiLienHe() != null ? boTrong(updating.getNguoiLienHe()) : entity.getNguoiLienHe();
        String maSoThue = updating.getMaSoThue() != null ? boTrong(updating.getMaSoThue()) : entity.getMaSoThue();
        String sdt = updating.getSoDienThoai() != null ? boTrong(updating.getSoDienThoai()) : entity.getSoDienThoai();
        // Gửi lại đúng số đang lưu thì giữ nguyên; số mới thì bỏ khoảng trắng, dấu chấm, gạch và đổi +84 về 0.
        if (!Objects.equals(sdt, entity.getSoDienThoai())) {
            sdt = chuanHoaSoDienThoai(sdt);
        }
        String email = updating.getEmail() != null ? boTrong(updating.getEmail()) : entity.getEmail();
        String diaChi = updating.getDiaChi() != null ? boTrong(updating.getDiaChi()) : entity.getDiaChi();

        kiemTraThongTinChung(ten, nguoiLienHe);
        // Như SĐT / email: chỉ kiểm tra khi đổi, dữ liệu cũ không chặn việc sửa ô khác
        if (!Objects.equals(maSoThue, entity.getMaSoThue())) {
            kiemTraMaSoThue(maSoThue);
        }
        if (!Objects.equals(diaChi, entity.getDiaChi())) {
            kiemTraDiaChi(diaChi);
        }
        // SĐT / email chỉ kiểm tra khi thực sự đổi: dữ liệu cũ (định dạng cũ, trùng sẵn) không chặn
        // việc sửa các trường khác của khách hàng.
        String sdtMoi = Objects.equals(sdt, entity.getSoDienThoai()) ? null : sdt;
        String emailMoi = Objects.equals(email, entity.getEmail()) ? null : email;
        kiemTraLienHe(sdtMoi, emailMoi);
        // Không cho xóa cả số điện thoại lẫn email; khách cũ vốn không có cả hai thì vẫn sửa được các ô khác.
        boolean truocCoLienHe = boTrong(entity.getSoDienThoai()) != null || boTrong(entity.getEmail()) != null;
        if (sdt == null && email == null && truocCoLienHe) {
            throw new CommonException(CAN_LIEN_HE);
        }
        kiemTraTrungLienHe(sdtMoi, emailMoi, id);

        if (updating.getLoaiKhachHang() != null) {
            updating.setLoaiKhachHang(chuanHoaLoaiKhachHang(updating.getLoaiKhachHang()));
        }
        // Trạng thái: null = giữ nguyên; ngoài 0/1 thì báo lỗi thay vì lưu giá trị lạ
        // (các màn khác chỉ coi 1 là đang hoạt động, giá trị lạ sẽ âm thầm thành "ngừng hoạt động").
        if (updating.getTrangThai() != null && !TRANG_THAI_HOP_LE.contains(updating.getTrangThai())) {
            throw new CommonException("Trạng thái khách hàng không hợp lệ");
        }
        mapper.partialUpdate(updating, entity);
        entity.setTenKhachHang(ten);
        entity.setNguoiLienHe(nguoiLienHe);
        entity.setMaSoThue(maSoThue);
        entity.setSoDienThoai(sdt);
        entity.setEmail(email);
        entity.setDiaChi(diaChi);
        // Ghi ngay để trả về đúng giờ cập nhật (cột ngay_cap_nhat do CSDL tự đặt khi sửa).
        entity = repository.saveAndFlush(entity);
        return mapper.toDto(entity);
    }

    /**
     * Tìm khách cho màn POS phía server (mỗi lần gõ), để quầy mở từ trước vẫn thấy khách quầy khác
     * vừa thêm. Từ khóa tối đa 100 ký tự; ký tự đại diện LIKE do người dùng gõ được escape.
     */
    @Transactional(readOnly = true)
    public Page<KhachHangDto> searchActiveForPos(String q, int page, int size) {
        String keyword = q == null ? "" : q.trim();
        if (keyword.length() > 100) {
            keyword = keyword.substring(0, 100);
        }
        String pattern = keyword.isEmpty() ? null : "%" + escapeLike(keyword.toLowerCase(Locale.ROOT)) + "%";
        int safeSize = Math.max(1, Math.min(size, MAX_POS_CUSTOMER_PAGE_SIZE));
        return repository.searchActiveForPos(pattern, PageRequest.of(Math.max(0, page), safeSize)).map(mapper::toDto);
    }

    /** Trim; chuỗi rỗng / toàn khoảng trắng -> null (không lưu "" để các khách trống không bị coi là trùng nhau). */
    private static String boTrong(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void kiemTraThongTinChung(String ten, String nguoiLienHe) {
        if (ten == null) {
            throw new CommonException("Tên khách hàng là bắt buộc");
        }
        if (ten.length() > 200) {
            throw new CommonException("Tên khách hàng tối đa 200 ký tự");
        }
        if (nguoiLienHe != null && nguoiLienHe.length() > 100) {
            throw new CommonException("Người liên hệ tối đa 100 ký tự");
        }
    }

    /** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…". Rỗng -> null. */
    static String chuanHoaSoDienThoai(String value) {
        if (value == null) {
            return null;
        }
        String gon = value.replaceAll("[\\s.()\\-]", "");
        if (gon.startsWith("+84")) {
            gon = "0" + gon.substring(3);
        }
        return gon.isEmpty() ? null : gon;
    }

    private static void kiemTraMaSoThue(String maSoThue) {
        if (maSoThue != null && !MA_SO_THUE_PATTERN.matcher(maSoThue).matches()) {
            throw new CommonException(MA_SO_THUE_MESSAGE);
        }
    }

    private static void kiemTraDiaChi(String diaChi) {
        if (diaChi != null && diaChi.length() > DIA_CHI_TOI_DA) {
            throw new CommonException("Địa chỉ tối đa 500 ký tự");
        }
    }

    /** Chỉ gọi với giá trị mới (tạo mới hoặc vừa đổi): dữ liệu cũ không bị chặn khi sửa ô khác. */
    private static void kiemTraLienHe(String sdt, String email) {
        if (sdt != null && !SO_DIEN_THOAI_PATTERN.matcher(sdt).matches()) {
            throw new CommonException("Số điện thoại không hợp lệ: di động 10 số, máy bàn 11 số (02…) hoặc tổng đài 1800/1900");
        }
        if (email != null && (email.length() > 100 || !EMAIL_PATTERN.matcher(email).matches())) {
            throw new CommonException("Email không hợp lệ");
        }
    }

    /**
     * SĐT / email không được trùng với khách hàng khác (kể cả khách đã ngưng hoạt động).
     * Kiểm tra từng trường riêng và chỉ với giá trị khác null — truyền null vào truy vấn
     * derived sẽ thành "IS NULL" và khớp mọi khách không có SĐT/email.
     * excludeId: id khách đang sửa (null khi tạo mới).
     */
    private void kiemTraTrungLienHe(String sdt, String email, Integer excludeId) {
        if (sdt != null) {
            (excludeId == null
                    ? repository.findFirstBySoDienThoai(sdt)
                    : repository.findFirstBySoDienThoaiAndIdNot(sdt, excludeId))
                    .ifPresent(kh -> {
                        throw new CommonException(
                                "Số điện thoại đã thuộc khách hàng " + kh.getTenKhachHang() + " (" + kh.getMaKhachHang() + ")",
                                HttpStatus.CONFLICT, null);
                    });
        }
        if (email != null) {
            (excludeId == null
                    ? repository.findFirstByEmail(email)
                    : repository.findFirstByEmailAndIdNot(email, excludeId))
                    .ifPresent(kh -> {
                        throw new CommonException(
                                "Email đã thuộc khách hàng " + kh.getTenKhachHang() + " (" + kh.getMaKhachHang() + ")",
                                HttpStatus.CONFLICT, null);
                    });
        }
    }

    /**
     * Loại khách hàng: để trống -> "le" (khớp DEFAULT của cột); giá trị ngoài enum -> báo lỗi
     * rõ ràng thay vì để MySQL từ chối khi ghi.
     */
    private static String chuanHoaLoaiKhachHang(String loai) {
        if (loai == null || loai.isBlank()) {
            return "le";
        }
        String value = loai.trim();
        if (!LOAI_KHACH_HANG_HOP_LE.contains(value)) {
            throw new CommonException("Loại khách hàng không hợp lệ");
        }
        return value;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Transactional(readOnly = true)
    public List<KhachHangDto> getAllActiveForSales() {
        return repository.findAll().stream()
                .filter(kh -> kh.getTrangThai() != null && kh.getTrangThai() == 1)
                .map(mapper::toDto)
                .toList();
    }
}