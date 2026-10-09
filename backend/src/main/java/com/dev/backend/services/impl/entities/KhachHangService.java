// src/main/java/com/dev/backend/services/impl/entities/KhachHangService.java
package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.request.PosQuickCustomerCreating;
import com.dev.backend.dto.response.ResponseData;
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
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class KhachHangService extends BaseServiceImpl<KhachHang, Integer> {

    private static final int MAX_POS_CUSTOMER_PAGE_SIZE = 50;
    private static final Set<String> LOAI_KHACH_HANG_HOP_LE = Set.of("le", "si", "doanh_nghiep");
    // Cùng quy tắc với form khách hàng ở frontend
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final KhachHangRepository repository;
    private final KhachHangMapper mapper;
    private final EntityManager entityManager;
    private final DonBanHangRepository donBanHangRepository; // Thêm repo đơn hàng để lấy lịch sử

    @Autowired
    public KhachHangService(KhachHangRepository repository,
                            KhachHangMapper mapper,
                            EntityManager entityManager,
                            DonBanHangRepository donBanHangRepository) {
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
        this.donBanHangRepository = donBanHangRepository;
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

        // Lấy lịch sử mua hàng của khách
        List<DonBanHang> donBanHangs = donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(id);

        // Map sang DTO hiển thị cho bảng Lịch sử
        List<LichSuMuaHangDto> history = donBanHangs.stream().map(don -> LichSuMuaHangDto.builder()
                .maDonHang(don.getSoDonHang())
                .ngay(don.getNgayDatHang())
                .kenh(don.getKenhBanHang() != null ? don.getKenhBanHang().getMaKenh() : "POS") // Đã đổi getKenhBan() thành getKenhBanHang()
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

    @Transactional
    public ResponseEntity<ResponseData<String>> create(KhachHangCreating creating) {
        String ma = boTrong(creating.getMaKhachHang());
        String ten = boTrong(creating.getTenKhachHang());
        String nguoiLienHe = boTrong(creating.getNguoiLienHe());
        String sdt = boTrong(creating.getSoDienThoai());
        String email = boTrong(creating.getEmail());

        if (ma == null) {
            throw new CommonException("Mã khách hàng là bắt buộc");
        }
        if (ma.length() > 50) {
            throw new CommonException("Mã khách hàng tối đa 50 ký tự");
        }
        kiemTraThongTinChung(ten, nguoiLienHe);
        kiemTraLienHe(sdt, email);

        if (repository.existsByMaKhachHang(ma)) {
            throw new CommonException("Mã khách hàng " + ma + " đã tồn tại", HttpStatus.CONFLICT, null);
        }
        kiemTraTrungLienHe(sdt, email, null);

        KhachHang newKhachHang = KhachHang.builder()
                .maKhachHang(ma)
                .tenKhachHang(ten)
                .nguoiLienHe(nguoiLienHe)
                .soDienThoai(sdt)
                .email(email)
                .diaChi(boTrong(creating.getDiaChi()))
                .loaiKhachHang(chuanHoaLoaiKhachHang(creating.getLoaiKhachHang()))
                .trangThai(1)
                .build();

        create(newKhachHang);
        return ResponseEntity.ok(ResponseData.<String>builder().status(200).data("Success").message("Success").build());
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
        String sdt = updating.getSoDienThoai() != null ? boTrong(updating.getSoDienThoai()) : entity.getSoDienThoai();
        String email = updating.getEmail() != null ? boTrong(updating.getEmail()) : entity.getEmail();
        String diaChi = updating.getDiaChi() != null ? boTrong(updating.getDiaChi()) : entity.getDiaChi();

        kiemTraThongTinChung(ten, nguoiLienHe);
        // SĐT / email chỉ kiểm tra khi thực sự đổi: dữ liệu cũ (định dạng cũ, trùng sẵn) không chặn
        // việc sửa các trường khác của khách hàng.
        String sdtMoi = Objects.equals(sdt, entity.getSoDienThoai()) ? null : sdt;
        String emailMoi = Objects.equals(email, entity.getEmail()) ? null : email;
        kiemTraLienHe(sdtMoi, emailMoi);
        kiemTraTrungLienHe(sdtMoi, emailMoi, id);

        if (updating.getLoaiKhachHang() != null) {
            updating.setLoaiKhachHang(chuanHoaLoaiKhachHang(updating.getLoaiKhachHang()));
        }
        mapper.partialUpdate(updating, entity);
        entity.setTenKhachHang(ten);
        entity.setNguoiLienHe(nguoiLienHe);
        entity.setSoDienThoai(sdt);
        entity.setEmail(email);
        entity.setDiaChi(diaChi);
        entity = repository.save(entity);
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

    // Định dạng SĐT do frontend kiểm tra (quy tắc di động 10 số); backend chỉ chặn vượt độ dài cột.
    private static void kiemTraLienHe(String sdt, String email) {
        if (sdt != null && sdt.length() > 20) {
            throw new CommonException("Số điện thoại tối đa 20 ký tự");
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