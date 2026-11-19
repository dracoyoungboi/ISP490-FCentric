// src/main/java/com/dev/backend/services/impl/entities/KhachHangService.java
package com.dev.backend.services.impl.entities;

import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;

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
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.utils.HoTen;
import com.dev.backend.utils.NguonKhachHang;
import com.dev.backend.utils.SoDienThoai;
import com.dev.backend.utils.TuKhoaTimKiem;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class KhachHangService extends BaseServiceImpl<KhachHang, Integer> {

    private static final int MAX_POS_CUSTOMER_PAGE_SIZE = 50;
    /** trang_thai của khách hàng: 1 = đang hoạt động, 0 = ngừng hoạt động. */
    private static final Set<Integer> TRANG_THAI_HOP_LE = Set.of(0, 1);
    // Cùng quy tắc với form khách hàng ở frontend (components/khach-hang/quyTacKhachHang.js)
    /**
     * Email: phần trước @ chỉ chữ không dấu, số và . _ % + - (không mở đầu / kết thúc bằng dấu chấm, không hai dấu chấm
     * liền nhau); tên miền gồm các nhãn chữ không dấu, số, gạch nối, đuôi ít nhất 2 chữ cái.
     */
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^(?!\\.)(?!.*\\.\\.)[A-Za-z0-9._%+-]+(?<!\\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}$");
    private static final int EMAIL_TOI_DA = 100;
    /** Mã nhập tay: chữ không dấu, số và . _ - (như mã nhà cung cấp), mở đầu bằng chữ hoặc số. */
    private static final Pattern MA_KHACH_HANG_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    /**
     * Khách hàng là một người: di động 10 số (03/05/07/08/09) hoặc máy bàn 11 số (02…). Không nhận tổng đài 1800/1900
     * (chỉ gọi vào, không nhắn tin, không gọi lại đúng người, tra khách ở quầy theo số vô nghĩa).
     */
    private static final Pattern SO_DIEN_THOAI_PATTERN = Pattern.compile("^(0[35789][0-9]{8}|02[0-9]{9})$");
    /** Tên khách hàng (một người): như luật họ tên, chữ cái và dấu cách, ' ’ . -; mở đầu bằng chữ cái. */
    private static final Pattern TEN_PATTERN = Pattern.compile("^\\p{L}[\\p{L}\\p{M} '’.\\-]*$");
    private static final int TEN_TOI_THIEU = 2;
    private static final int TEN_TOI_DA = 200;
    private static final int MA_KHACH_HANG_TOI_DA = 50;
    private static final int DIA_CHI_TOI_DA = 500;
    /** Các ô kiểm trùng (tên trường của API kiểm trùng). */
    public static final String TRUONG_SO_DIEN_THOAI = "soDienThoai";
    public static final String TRUONG_EMAIL = "email";
    /** Trường lọc ảo theo nguồn khách (giá trị: {@link NguonKhachHang}). */
    public static final String TRUONG_NGUON = "nguon";
    static final String CAN_LIEN_HE = ThongDiep.vi("banHang.canLienHeKhachHang");

    private final KhachHangRepository repository;
    private final KhachHangMapper mapper;
    private final EntityManager entityManager;
    private final DonBanHangRepository donBanHangRepository; // Thêm repo đơn hàng để lấy lịch sử
    private final DieuHanhHeThongService dieuHanhHeThongService; // đọc tiền tố mã khách hàng

    /** Nhật ký nghiệp vụ (thêm / sửa / ngừng khách hàng); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;

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

    /**
     * Danh sách khách cho màn Khách hàng (và số trên tab): cùng bộ lọc như filter, luôn chỉ khách cửa hàng (chốt 20/11).
     * Khách do đồng bộ đơn sàn tạo vẫn lưu, vẫn gắn đơn và mở được từ đơn bán / báo cáo, chỉ không nằm trong danh sách.
     */
    @Transactional(readOnly = true)
    public Page<KhachHang> filterKhachCuaHang(BaseFilterRequest filter) {
        BaseFilterRequest yeuCau = filter == null ? new BaseFilterRequest() : filter;
        List<FilterCriteria> loc = new ArrayList<>(yeuCau.getFilters() == null ? List.of() : yeuCau.getFilters());
        loc.add(locChiKhachCuaHang());
        yeuCau.setFilters(loc);
        return filter(yeuCau);
    }

    /** Điều kiện lọc "chỉ khách cửa hàng" để ghép vào bộ lọc (trang Khách hàng, ô tìm toàn hệ thống). */
    public static FilterCriteria locChiKhachCuaHang() {
        return FilterCriteria.builder().fieldName(TRUONG_NGUON).operation(FilterOperation.EQUALS)
                .value(NguonKhachHang.CUA_HANG).build();
    }

    /**
     * Trường lọc ảo tuKhoa (ô tìm toàn hệ thống, ô tìm trang Khách hàng) và nguon (chỉ dùng trong máy chủ để giữ khách
     * cửa hàng): tách ra, phần còn lại lọc như cũ.
     */
    @Override
    protected Specification<KhachHang> createSpecification(List<FilterCriteria> filters) {
        if (filters != null && filters.stream().anyMatch(f -> f != null && TRUONG_NGUON.equals(f.getFieldName()))) {
            List<FilterCriteria> conLai = new ArrayList<>();
            Specification<KhachHang> theoNguon = null;
            for (FilterCriteria f : filters) {
                if (f != null && TRUONG_NGUON.equals(f.getFieldName())) {
                    Specification<KhachHang> mot = theoNguon(f.getValue() == null ? null : String.valueOf(f.getValue()));
                    theoNguon = theoNguon == null ? mot : theoNguon.and(mot);
                } else {
                    conLai.add(f);
                }
            }
            return locTheoTuKhoa(conLai).and(theoNguon);
        }
        return locTheoTuKhoa(filters);
    }

    private Specification<KhachHang> locTheoTuKhoa(List<FilterCriteria> filters) {
        TuKhoaTimKiem.Tach tach = TuKhoaTimKiem.tach(filters);
        if (!tach.coTruong()) {
            return super.createSpecification(filters);
        }
        Specification<KhachHang> conLai = super.createSpecification(tach.conLai());
        return tach.tuKhoa() == null ? conLai : conLai.and(theoTuKhoa(tach.tuKhoa(), tach.chinhXac()));
    }

    /**
     * Khách theo nguồn ({@link NguonKhachHang}): nguồn sàn = mã bắt đầu bằng tiền tố của sàn đó; cua_hang = mã không
     * bắt đầu bằng tiền tố sàn nào. Giá trị lạ: không khách nào (không lẳng lặng bỏ lọc).
     */
    static Specification<KhachHang> theoNguon(String nguon) {
        return (root, query, cb) -> {
            Expression<String> ma = cb.upper(root.get("maKhachHang"));
            if (NguonKhachHang.CUA_HANG.equals(nguon)) {
                return cb.and(NguonKhachHang.cacTienToSan().stream()
                        .map(tienTo -> cb.notLike(ma, tienTo + "%"))
                        .toArray(Predicate[]::new));
            }
            String tienTo = NguonKhachHang.tienToCuaNguon(nguon);
            return tienTo == null ? cb.disjunction() : cb.like(ma, tienTo + "%");
        };
    }

    /**
     * Khách khớp từ khóa. "Chứa": tên, mã, email (như ô tìm trang Khách hàng) và số điện thoại đã bỏ ký tự ngăn cách khi
     * từ khóa có dáng số điện thoại. "Chính xác": mã, email, số điện thoại.
     */
    static Specification<KhachHang> theoTuKhoa(String tuKhoa, boolean chinhXac) {
        String mau = TuKhoaTimKiem.mau(tuKhoa, chinhXac);
        String sdt = SoDienThoai.choTimKiem(tuKhoa);
        return (root, query, cb) -> {
            List<Predicate> hoac = new ArrayList<>();
            hoac.add(TuKhoaTimKiem.like(cb, root.get("maKhachHang"), mau));
            hoac.add(TuKhoaTimKiem.like(cb, root.get("email"), mau));
            if (!chinhXac) {
                hoac.add(TuKhoaTimKiem.like(cb, root.get("tenKhachHang"), mau));
            }
            if (sdt != null) {
                Expression<String> cotSdt = TuKhoaTimKiem.boNganCach(cb, root.get("soDienThoai"));
                hoac.add(chinhXac ? cb.equal(cotSdt, sdt)
                        : cb.like(cotSdt, "%" + TuKhoaTimKiem.thoat(sdt) + "%", TuKhoaTimKiem.KY_TU_THOAT));
            } else if (!chinhXac) {
                // Từ khóa không có dáng số điện thoại (vd. "0912 3"): vẫn so chứa trên số như ô tìm cũ
                hoac.add(TuKhoaTimKiem.like(cb, root.get("soDienThoai"), mau));
            }
            return cb.or(hoac.toArray(new Predicate[0]));
        };
    }

    // Function Customer Details (Cập nhật để trả về Full Lịch Sử Mua Hàng)
    @Transactional(readOnly = true)
    public KhachHangDetailDto getKhachHangDetail(Integer id) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.khachHangKhongTimThayVoiId", id)));

        List<DonBanHang> donBanHangs = donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(id);

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
        String ten = chuanHoaTen(creating.getTenKhachHang());
        String sdt = chuanHoaSoDienThoai(boTrong(creating.getSoDienThoai()));
        String email = boTrong(creating.getEmail());
        String diaChi = boTrong(creating.getDiaChi());

        if (ma != null) {
            if (ma.length() > MA_KHACH_HANG_TOI_DA) {
                throw new CommonException(ThongDiep.of("banHang.maKhachHangQuaDai"));
            }
            if (!MA_KHACH_HANG_PATTERN.matcher(ma).matches()) {
                throw new CommonException(ThongDiep.of("banHang.maKhachHangSaiKyTu"));
            }
            // Tiền tố dành cho khách tự tạo từ đơn sàn: mã nhập tay mang tiền tố này sẽ bị nhận là khách sàn
            String tienToSan = NguonKhachHang.tienToSan(ma);
            if (tienToSan != null) {
                throw new CommonException(ThongDiep.of("banHang.maKhachHangTrungTienToSan", tienToSan));
            }
        }
        kiemTraTen(ten);
        kiemTraDiaChi(diaChi);
        kiemTraLienHe(sdt, email);
        if (sdt == null && email == null) {
            throw new CommonException(ThongDiep.of("banHang.canLienHeKhachHang"));
        }

        if (ma != null && repository.existsByMaKhachHang(ma)) {
            throw new CommonException(ThongDiep.of("banHang.maKhachHangDaDung", ma), HttpStatus.CONFLICT, null);
        }
        kiemTraTrung(sdt, email, null);

        KhachHang saved = repository.save(KhachHang.builder()
                // Chưa có id thì chưa có mã tự tạo: ghi tạm một mã không thể trùng, có id rồi đổi ngay trong cùng giao dịch.
                .maKhachHang(ma != null ? ma : "TAM-" + UUID.randomUUID())
                .tenKhachHang(ten)
                .soDienThoai(sdt)
                .email(email)
                .diaChi(diaChi)
                .trangThai(1)
                .build());
        if (ma == null) {
            saved.setMaKhachHang(maTuDong(saved.getId()));
            saved = repository.save(saved);
        }
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khach_hang, saved.getId(), IHanhDong.them_khach_hang)
                .ma(maNhatKy(saved))
                .moi(anhKhachHang(saved)));
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

    /**
     * Tiền tố trong Cấu hình hệ thống; giá trị hỏng (sửa tay trong CSDL, hoặc trùng tiền tố khách sàn đặt trước khi có
     * quy tắc chặn) thì dùng tiền tố mặc định.
     */
    private String tienToMaKhachHang() {
        String giaTri = dieuHanhHeThongService.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_MA_KHACH_HANG_TIEN_TO,
                DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH);
        String tienTo = giaTri == null ? "" : giaTri.trim().toUpperCase(Locale.ROOT);
        return DieuHanhHeThongServiceImpl.TIEN_TO_MA_PATTERN.matcher(tienTo).matches()
                && NguonKhachHang.tienToSan(tienTo) == null
                ? tienTo
                : DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH;
    }

    /**
     * Thêm nhanh khách hàng tại quầy POS (tên + SĐT).
     * - Tên và SĐT theo luật của form khách hàng; SĐT chuẩn hóa như form (bỏ dấu ngăn cách, +84 về 0).
     * - SĐT đã thuộc khách cửa hàng khác (so trên số đã bỏ dấu ngăn cách) -> 409, data = khách đó để thu ngân chọn lại.
     * - Mã khách hàng sinh tự động: KH + SĐT (thêm hậu tố nếu mã đã bị dùng).
     */
    @Transactional
    public KhachHangDto quickCreateForPos(PosQuickCustomerCreating request) {
        String ten = chuanHoaTen(request == null ? null : request.getTenKhachHang());
        String sdt = chuanHoaSoDienThoai(request == null ? null : boTrong(request.getSoDienThoai()));

        if (ten == null) {
            throw new CommonException(ThongDiep.of("banHang.nhapTenKhachHang"));
        }
        kiemTraTen(ten);
        if (sdt == null) {
            throw new CommonException(ThongDiep.of("banHang.soDienThoaiKhachHangSai"));
        }
        kiemTraSoDienThoai(sdt);

        KhachHang existing = repository.timTrungSoDienThoai(sdt, null).orElse(null);
        if (existing != null) {
            throw new CommonException(
                    ThongDiep.of("banHang.soDienThoaiDaThuocKhach", existing.getTenKhachHang()),
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
                .trangThai(1)
                .build());
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khach_hang, saved.getId(), IHanhDong.them_khach_hang)
                .ma(maNhatKy(saved))
                .moi(anhKhachHang(saved))
                .ghiChu("Thêm nhanh tại quầy POS"));
        return mapper.toDto(saved);
    }

    // Function Edit Customer
    @Transactional
    public KhachHangDto update(Integer id, KhachHangUpdating updating) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.khachHangKhongTimThayVoiId", id)));
        chanSuaKhachLe(entity);
        Map<String, Object> truoc = anhKhachHang(entity);

        // Trường chuỗi: null = giữ nguyên; chuỗi trắng = xóa trường (lưu NULL thay vì "")
        String ten = updating.getTenKhachHang() != null ? chuanHoaTen(updating.getTenKhachHang()) : entity.getTenKhachHang();
        // "Đã đổi" so trên giá trị đã chuẩn hóa như giao diện: tên cũ chỉ khác khoảng trắng / ký tự vô hình không tính là đổi.
        boolean doiTen = updating.getTenKhachHang() != null && !Objects.equals(ten, chuanHoaTen(entity.getTenKhachHang()));
        String sdt = updating.getSoDienThoai() != null ? boTrong(updating.getSoDienThoai()) : entity.getSoDienThoai();
        // Gửi lại đúng số đang lưu thì giữ nguyên; số mới thì bỏ khoảng trắng, dấu chấm, gạch và đổi +84 về 0.
        if (!Objects.equals(sdt, entity.getSoDienThoai())) {
            sdt = chuanHoaSoDienThoai(sdt);
        }
        String email = updating.getEmail() != null ? boTrong(updating.getEmail()) : entity.getEmail();
        String diaChi = updating.getDiaChi() != null ? boTrong(updating.getDiaChi()) : entity.getDiaChi();

        if (ten == null) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangBatBuoc"));
        }
        // Như SĐT / email: chỉ kiểm tra khi đổi, dữ liệu cũ (vd. tên công ty có chữ số từ trước) không chặn việc sửa ô khác
        if (doiTen) {
            kiemTraTen(ten);
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
            throw new CommonException(ThongDiep.of("banHang.canLienHeKhachHang"));
        }
        kiemTraTrung(sdtMoi, emailMoi, id);

        // Trạng thái: null = giữ nguyên; ngoài 0/1 thì báo lỗi thay vì lưu giá trị lạ
        // (các màn khác chỉ coi 1 là đang hoạt động, giá trị lạ sẽ âm thầm thành "ngừng hoạt động").
        if (updating.getTrangThai() != null && !TRANG_THAI_HOP_LE.contains(updating.getTrangThai())) {
            throw new CommonException(ThongDiep.of("banHang.trangThaiKhachHangSai"));
        }
        mapper.partialUpdate(updating, entity);
        entity.setTenKhachHang(ten);
        entity.setSoDienThoai(sdt);
        entity.setEmail(email);
        entity.setDiaChi(diaChi);
        // Ghi ngay để trả về đúng giờ cập nhật (cột ngay_cap_nhat do CSDL tự đặt khi sửa).
        entity = repository.saveAndFlush(entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khach_hang, entity.getId(), IHanhDong.sua_khach_hang)
                .ma(maNhatKy(entity))
                .thayDoi(truoc, anhKhachHang(entity)));
        return mapper.toDto(entity);
    }

    /**
     * "Xóa" khách hàng (DELETE soft-delete): chỉ chuyển Ngừng hoạt động, lịch sử mua hàng giữ nguyên. Nhật ký ghi
     * xoa_khach_hang để phân biệt với đổi trạng thái trong form sửa.
     */
    @Transactional
    public void xoaMem(Integer id) {
        KhachHang entity = repository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.khachHangKhongTimThayId", id)));
        chanSuaKhachLe(entity);
        Integer trangThaiCu = entity.getTrangThai();
        entity.setTrangThai(0);
        entity = repository.save(entity);
        // Đã ngừng từ trước (bấm xóa lần nữa): không ghi thêm dòng vô nghĩa
        if (Integer.valueOf(0).equals(trangThaiCu)) return;
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.khach_hang, entity.getId(), IHanhDong.xoa_khach_hang)
                .ma(maNhatKy(entity))
                .cu(NhatKyNghiepVu.anh("trangThai", trangThaiCu))
                .moi(NhatKyNghiepVu.anh("trangThai", 0)));
    }

    /**
     * Khách lẻ mặc định (KHLE) là khách của hệ thống: sửa thì đổi tên trên mọi hóa đơn cũ, ngừng thì quầy POS
     * không bán được cho khách lẻ. Chặn cả sửa lẫn ngừng (409).
     */
    static void chanSuaKhachLe(KhachHang khachHang) {
        if (KhachHang.MA_KHACH_LE.equals(khachHang.getMaKhachHang())) {
            throw new CommonException(
                    ThongDiep.of("banHang.khachLeKhongSua"),
                    HttpStatus.CONFLICT, null);
        }
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    /** Mã dễ đọc trong nhật ký: tên khách + SĐT. */
    private static String maNhatKy(KhachHang k) {
        String ten = k.getTenKhachHang() == null ? k.getMaKhachHang() : k.getTenKhachHang();
        return k.getSoDienThoai() == null ? ten : ten + " · " + k.getSoDienThoai();
    }

    private static Map<String, Object> anhKhachHang(KhachHang k) {
        return NhatKyNghiepVu.anh(
                "maKhachHang", k.getMaKhachHang(),
                "tenKhachHang", k.getTenKhachHang(),
                "soDienThoai", k.getSoDienThoai(),
                "email", k.getEmail(),
                "diaChi", k.getDiaChi(),
                "trangThai", k.getTrangThai());
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

    /**
     * Tên khách: dấu tiếng Việt về một dạng (NFC), bỏ ký tự vô hình, gộp khoảng trắng, cắt hai đầu (như họ tên người
     * dùng). Trống -> null.
     */
    static String chuanHoaTen(String value) {
        if (value == null) {
            return null;
        }
        String gon = HoTen.chuanHoa(value);
        return gon.isEmpty() ? null : gon;
    }

    private static int soKyTu(String s) {
        return s.codePointCount(0, s.length());
    }

    /** Tên khách hàng (đã chuẩn hóa): 2–200 ký tự, khách là một người nên theo luật họ tên (không có số). */
    static void kiemTraTen(String ten) {
        if (ten == null) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangBatBuoc"));
        }
        int doDai = soKyTu(ten);
        if (doDai > TEN_TOI_DA) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangQuaDai"));
        }
        if (doDai < TEN_TOI_THIEU) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangQuaNgan", TEN_TOI_THIEU));
        }
        if (!TEN_PATTERN.matcher(ten).matches()) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangSaiKyTu"));
        }
    }

    /** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…". Rỗng -> null. */
    static String chuanHoaSoDienThoai(String value) {
        return SoDienThoai.chuanHoa(value);
    }

    private static void kiemTraDiaChi(String diaChi) {
        if (diaChi != null && diaChi.length() > DIA_CHI_TOI_DA) {
            throw new CommonException(ThongDiep.of("banHang.diaChiQuaDai"));
        }
    }

    /** Số điện thoại đã chuẩn hóa (null = để trống): di động hoặc máy bàn. */
    static void kiemTraSoDienThoai(String sdt) {
        if (sdt != null && !SO_DIEN_THOAI_PATTERN.matcher(sdt).matches()) {
            throw new CommonException(ThongDiep.of("banHang.soDienThoaiKhachHangSai"));
        }
    }

    /** Chỉ gọi với giá trị mới (tạo mới hoặc vừa đổi): dữ liệu cũ không bị chặn khi sửa ô khác. */
    private static void kiemTraLienHe(String sdt, String email) {
        kiemTraSoDienThoai(sdt);
        if (email != null && (email.length() > EMAIL_TOI_DA || !EMAIL_PATTERN.matcher(email).matches())) {
            throw new CommonException(ThongDiep.of("banHang.emailKhongHopLe"));
        }
    }

    /**
     * SĐT / email không được trùng với khách cửa hàng khác (kể cả khách đã ngưng hoạt động). Khách sàn không tính: họ không
     * có ở màn Khách hàng, người mua sàn tới cửa hàng được tạo hồ sơ cửa hàng riêng.
     * Chỉ kiểm giá trị khác null (null sẽ khớp mọi khách để trống).
     * excludeId: id khách đang sửa (null khi tạo mới).
     */
    private void kiemTraTrung(String sdt, String email, Integer excludeId) {
        if (sdt != null) {
            timTrung(TRUONG_SO_DIEN_THOAI, sdt, excludeId).ifPresent(kh -> {
                throw new CommonException(
                        ThongDiep.of("banHang.soDienThoaiDaThuocKhachMa", kh.getTenKhachHang(), kh.getMaKhachHang()),
                        HttpStatus.CONFLICT, null);
            });
        }
        if (email != null) {
            timTrung(TRUONG_EMAIL, email, excludeId).ifPresent(kh -> {
                throw new CommonException(
                        ThongDiep.of("banHang.emailDaThuocKhachMa", kh.getTenKhachHang(), kh.getMaKhachHang()),
                        HttpStatus.CONFLICT, null);
            });
        }
    }

    /**
     * Khách khác đang dùng giá trị này. Số điện thoại so trên số đã bỏ dấu ngăn cách và đổi +84 về 0 ở cả hai phía
     * (khách tạo từ đơn sàn lưu nguyên dạng "+84 912…"); email không phân biệt hoa thường (collation của cột).
     */
    private Optional<KhachHang> timTrung(String truong, String giaTri, Integer excludeId) {
        return switch (truong) {
            case TRUONG_SO_DIEN_THOAI -> repository.timTrungSoDienThoai(giaTri, excludeId);
            case TRUONG_EMAIL -> repository.timTrungEmail(giaTri, excludeId);
            default -> Optional.empty();
        };
    }

    /**
     * Kiểm trùng trước khi lưu (form báo ngay khi rời ô): cùng cách so với lúc lưu. Giá trị sai dạng thì không tra
     * (form đã báo lỗi dạng). Trả khách đang dùng, hoặc null.
     */
    @Transactional(readOnly = true)
    public KhachHangDto timKhachTrung(String truong, String giaTri, Integer boQuaId) {
        String gon = boTrong(giaTri);
        if (gon == null) {
            return null;
        }
        if (TRUONG_SO_DIEN_THOAI.equals(truong)) {
            gon = chuanHoaSoDienThoai(gon);
            if (gon == null || !SO_DIEN_THOAI_PATTERN.matcher(gon).matches()) return null;
        } else if (TRUONG_EMAIL.equals(truong)) {
            if (gon.length() > EMAIL_TOI_DA || !EMAIL_PATTERN.matcher(gon).matches()) return null;
        } else {
            throw new CommonException(ThongDiep.of("banHang.truongKiemTrungSai"));
        }
        return timTrung(truong, gon, boQuaId).map(mapper::toDto).orElse(null);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** Khách cửa hàng đang hoạt động để chọn khi bán (POS); khách sàn không chọn ở đây. */
    @Transactional(readOnly = true)
    public List<KhachHangDto> getAllActiveForSales() {
        Specification<KhachHang> dangHoatDong = (root, query, cb) -> cb.equal(root.get("trangThai"), 1);
        return repository.findAll(dangHoatDong.and(theoNguon(NguonKhachHang.CUA_HANG))).stream()
                .map(mapper::toDto)
                .toList();
    }
}