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
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.utils.HoTen;
import com.dev.backend.utils.MaSoThue;
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
    private static final Set<String> LOAI_KHACH_HANG_HOP_LE = Set.of("le", "si", "doanh_nghiep");
    /** trang_thai của khách hàng: 1 = đang hoạt động, 0 = ngừng hoạt động. */
    private static final Set<Integer> TRANG_THAI_HOP_LE = Set.of(0, 1);
    private static final String LOAI_CHUNG_TU_BAO_GIA = "bao_gia";
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
     * Như nhà cung cấp: di động 10 số (03/05/07/08/09), máy bàn 11 số (02…), tổng đài 1800/1900.
     * Khách doanh nghiệp hay dùng số bàn, nên không chỉ nhận di động. Thêm nhanh ở quầy POS dùng cùng luật.
     */
    private static final Pattern SO_DIEN_THOAI_PATTERN = Pattern.compile("^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$");
    /** Tên khách lẻ (một người): như luật họ tên, chữ cái và dấu cách, ' ’ . -; mở đầu bằng chữ cái. */
    private static final Pattern TEN_KHACH_LE_PATTERN = Pattern.compile("^\\p{L}[\\p{L}\\p{M} '’.\\-]*$");
    /**
     * Tên khách sỉ / doanh nghiệp / chưa phân loại: thêm chữ số và & , ( ) / (VD "Công ty TNHH 3A", "Shop A&B");
     * mở đầu bằng chữ hoặc số nên không mở đầu bằng = + - @ (xuất Excel không thành công thức).
     */
    private static final Pattern TEN_MO_DAU_PATTERN = Pattern.compile("^[\\p{L}0-9]");
    private static final Pattern TEN_TO_CHUC_PATTERN = Pattern.compile("^[\\p{L}0-9][\\p{L}\\p{M}0-9 &,.()/'’\\-]*$");
    private static final Pattern CO_CHU_CAI = Pattern.compile("\\p{L}");
    private static final int TEN_TOI_THIEU = 2;
    private static final int TEN_TOI_DA = 200;
    private static final int NGUOI_LIEN_HE_TOI_DA = 100;
    private static final int MA_KHACH_HANG_TOI_DA = 50;
    private static final int DIA_CHI_TOI_DA = 500;
    /** Các ô kiểm trùng (tên trường của API kiểm trùng). */
    public static final String TRUONG_SO_DIEN_THOAI = "soDienThoai";
    public static final String TRUONG_EMAIL = "email";
    public static final String TRUONG_MA_SO_THUE = "maSoThue";
    static final String CAN_LIEN_HE = ThongDiep.vi("banHang.canLienHeKhachHang");
    static final String MA_SO_THUE_MESSAGE = ThongDiep.vi("banHang.maSoThueKhachHangSai");

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

    /** Trường lọc ảo tuKhoa (ô tìm toàn hệ thống, ô tìm trang Khách hàng): tách ra, phần còn lại lọc như cũ. */
    @Override
    protected Specification<KhachHang> createSpecification(List<FilterCriteria> filters) {
        TuKhoaTimKiem.Tach tach = TuKhoaTimKiem.tach(filters);
        if (!tach.coTruong()) {
            return super.createSpecification(filters);
        }
        Specification<KhachHang> conLai = super.createSpecification(tach.conLai());
        return tach.tuKhoa() == null ? conLai : conLai.and(theoTuKhoa(tach.tuKhoa(), tach.chinhXac()));
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
        String ten = chuanHoaTen(creating.getTenKhachHang());
        String maSoThue = boTrong(creating.getMaSoThue());
        String nguoiLienHe = chuanHoaTen(creating.getNguoiLienHe());
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
        }
        String loai = chuanHoaLoaiKhachHang(creating.getLoaiKhachHang());
        kiemTraTen(ten, loai);
        kiemTraNguoiLienHe(nguoiLienHe);
        kiemTraMaSoThue(maSoThue);
        kiemTraDiaChi(diaChi);
        kiemTraLienHe(sdt, email);
        if (sdt == null && email == null) {
            throw new CommonException(ThongDiep.of("banHang.canLienHeKhachHang"));
        }

        if (ma != null && repository.existsByMaKhachHang(ma)) {
            throw new CommonException(ThongDiep.of("banHang.maKhachHangDaDung", ma), HttpStatus.CONFLICT, null);
        }
        kiemTraTrung(sdt, email, maSoThue, null);

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
     * - Tên theo luật tên khách lẻ; SĐT chuẩn hóa như form khách hàng (bỏ dấu ngăn cách, +84 về 0) và cùng luật
     *   di động / máy bàn / tổng đài.
     * - SĐT đã tồn tại (so trên số đã bỏ dấu ngăn cách) -> 409, data = khách hàng hiện có để thu ngân chọn lại.
     * - Mã khách hàng sinh tự động: KH + SĐT (thêm hậu tố nếu mã đã bị dùng).
     */
    @Transactional
    public KhachHangDto quickCreateForPos(PosQuickCustomerCreating request) {
        String ten = chuanHoaTen(request == null ? null : request.getTenKhachHang());
        String sdt = chuanHoaSoDienThoai(request == null ? null : boTrong(request.getSoDienThoai()));

        if (ten == null) {
            throw new CommonException(ThongDiep.of("banHang.nhapTenKhachHang"));
        }
        kiemTraTen(ten, "le");
        if (sdt == null || !SO_DIEN_THOAI_PATTERN.matcher(sdt).matches()) {
            throw new CommonException(ThongDiep.of("banHang.soDienThoaiKhongHopLe"));
        }

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
                .loaiKhachHang("le")
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
        String nguoiLienHe = updating.getNguoiLienHe() != null ? chuanHoaTen(updating.getNguoiLienHe()) : entity.getNguoiLienHe();
        // "Đã đổi" so trên giá trị đã chuẩn hóa như giao diện: tên cũ chỉ khác khoảng trắng / ký tự vô hình không tính là đổi.
        String tenCuGon = chuanHoaTen(entity.getTenKhachHang());
        boolean doiTen = updating.getTenKhachHang() != null && !Objects.equals(ten, tenCuGon);
        boolean doiNguoiLienHe = updating.getNguoiLienHe() != null
                && !Objects.equals(nguoiLienHe, chuanHoaTen(entity.getNguoiLienHe()));
        String maSoThue = updating.getMaSoThue() != null ? boTrong(updating.getMaSoThue()) : entity.getMaSoThue();
        String sdt = updating.getSoDienThoai() != null ? boTrong(updating.getSoDienThoai()) : entity.getSoDienThoai();
        // Gửi lại đúng số đang lưu thì giữ nguyên; số mới thì bỏ khoảng trắng, dấu chấm, gạch và đổi +84 về 0.
        if (!Objects.equals(sdt, entity.getSoDienThoai())) {
            sdt = chuanHoaSoDienThoai(sdt);
        }
        String email = updating.getEmail() != null ? boTrong(updating.getEmail()) : entity.getEmail();
        String diaChi = updating.getDiaChi() != null ? boTrong(updating.getDiaChi()) : entity.getDiaChi();

        if (updating.getLoaiKhachHang() != null) {
            updating.setLoaiKhachHang(chuanHoaLoaiKhachHang(updating.getLoaiKhachHang()));
        }
        String loai = updating.getLoaiKhachHang() != null ? updating.getLoaiKhachHang() : entity.getLoaiKhachHang();
        if (ten == null) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangBatBuoc"));
        }
        // Như SĐT / email: chỉ kiểm tra khi đổi, dữ liệu cũ không chặn việc sửa ô khác. Tên kiểm lại cả khi đổi sang
        // Khách lẻ (khẳng định đây là một người, tên phải là họ tên); đổi sang sỉ / doanh nghiệp thì luật chỉ nới ra.
        boolean doiSangKhachLe = "le".equals(loai) && !Objects.equals(loai, entity.getLoaiKhachHang());
        if (doiTen) {
            kiemTraTen(ten, loai);
        } else if (doiSangKhachLe) {
            // Không gửi tên: kiểm tên đang lưu sau khi chuẩn hóa (như giao diện), không bắt lỗi vì khoảng trắng thừa
            kiemTraTen(tenCuGon, loai);
        }
        if (doiNguoiLienHe) {
            kiemTraNguoiLienHe(nguoiLienHe);
        }
        String maSoThueMoi = Objects.equals(maSoThue, entity.getMaSoThue()) ? null : maSoThue;
        kiemTraMaSoThue(maSoThueMoi);
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
        kiemTraTrung(sdtMoi, emailMoi, maSoThueMoi, id);

        // Trạng thái: null = giữ nguyên; ngoài 0/1 thì báo lỗi thay vì lưu giá trị lạ
        // (các màn khác chỉ coi 1 là đang hoạt động, giá trị lạ sẽ âm thầm thành "ngừng hoạt động").
        if (updating.getTrangThai() != null && !TRANG_THAI_HOP_LE.contains(updating.getTrangThai())) {
            throw new CommonException(ThongDiep.of("banHang.trangThaiKhachHangSai"));
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
                "loaiKhachHang", k.getLoaiKhachHang(),
                "maSoThue", k.getMaSoThue(),
                "nguoiLienHe", k.getNguoiLienHe(),
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
     * Tên khách / người liên hệ: dấu tiếng Việt về một dạng (NFC), bỏ ký tự vô hình, gộp khoảng trắng, cắt hai đầu
     * (như họ tên người dùng). Trống -> null.
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

    /**
     * Tên khách hàng (đã chuẩn hóa, khác null): 2–200 ký tự. Khách lẻ là một người nên theo luật họ tên (không có số);
     * khách sỉ / doanh nghiệp / chưa phân loại được dùng thêm số và & , ( ) /, phải có ít nhất một chữ cái.
     */
    static void kiemTraTen(String ten, String loai) {
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
        if ("le".equals(loai)) {
            if (!TEN_KHACH_LE_PATTERN.matcher(ten).matches()) {
                throw new CommonException(ThongDiep.of("banHang.tenKhachLeSaiKyTu"));
            }
            return;
        }
        if (!TEN_MO_DAU_PATTERN.matcher(ten).find()) {
            throw new CommonException(ThongDiep.of("banHang.tenMoDauChuHoacSo"));
        }
        if (!TEN_TO_CHUC_PATTERN.matcher(ten).matches()) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangSaiKyTu"));
        }
        if (!CO_CHU_CAI.matcher(ten).find()) {
            throw new CommonException(ThongDiep.of("banHang.tenKhachHangCanChuCai"));
        }
    }

    /** Người liên hệ (đã chuẩn hóa; null = để trống): một người nên theo luật họ tên, 2–100 ký tự. */
    static void kiemTraNguoiLienHe(String nguoiLienHe) {
        if (nguoiLienHe == null) {
            return;
        }
        int doDai = soKyTu(nguoiLienHe);
        if (doDai > NGUOI_LIEN_HE_TOI_DA) {
            throw new CommonException(ThongDiep.of("banHang.nguoiLienHeQuaDai"));
        }
        if (doDai < TEN_TOI_THIEU) {
            throw new CommonException(ThongDiep.of("banHang.nguoiLienHeQuaNgan", TEN_TOI_THIEU));
        }
        if (!TEN_KHACH_LE_PATTERN.matcher(nguoiLienHe).matches()) {
            throw new CommonException(ThongDiep.of("banHang.nguoiLienHeSaiKyTu"));
        }
    }

    /** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc; "+84…" đổi về "0…". Rỗng -> null. */
    static String chuanHoaSoDienThoai(String value) {
        return SoDienThoai.chuanHoa(value);
    }

    /** Sai dạng: báo cách viết đúng; đúng dạng mà sai số kiểm tra / hậu tố / mã tỉnh: báo kiểm lại từng chữ số. */
    private static void kiemTraMaSoThue(String maSoThue) {
        if (maSoThue == null) {
            return;
        }
        if (!MaSoThue.dungDang(maSoThue)) {
            throw new CommonException(ThongDiep.of("banHang.maSoThueKhachHangSai"));
        }
        if (!MaSoThue.hopLe(maSoThue)) {
            throw new CommonException(ThongDiep.of("banHang.maSoThueKhachHangKhongTonTai"));
        }
    }

    private static void kiemTraDiaChi(String diaChi) {
        if (diaChi != null && diaChi.length() > DIA_CHI_TOI_DA) {
            throw new CommonException(ThongDiep.of("banHang.diaChiQuaDai"));
        }
    }

    /** Chỉ gọi với giá trị mới (tạo mới hoặc vừa đổi): dữ liệu cũ không bị chặn khi sửa ô khác. */
    private static void kiemTraLienHe(String sdt, String email) {
        if (sdt != null && !SO_DIEN_THOAI_PATTERN.matcher(sdt).matches()) {
            throw new CommonException(ThongDiep.of("banHang.soDienThoaiKhongHopLe"));
        }
        if (email != null && (email.length() > EMAIL_TOI_DA || !EMAIL_PATTERN.matcher(email).matches())) {
            throw new CommonException(ThongDiep.of("banHang.emailKhongHopLe"));
        }
    }

    /**
     * SĐT / email / mã số thuế không được trùng với khách hàng khác (kể cả khách đã ngưng hoạt động).
     * Chỉ kiểm giá trị khác null (truy vấn derived với null thành "IS NULL" và khớp mọi khách để trống).
     * excludeId: id khách đang sửa (null khi tạo mới).
     */
    private void kiemTraTrung(String sdt, String email, String maSoThue, Integer excludeId) {
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
        if (maSoThue != null) {
            timTrung(TRUONG_MA_SO_THUE, maSoThue, excludeId).ifPresent(kh -> {
                throw new CommonException(
                        ThongDiep.of("banHang.maSoThueDaThuocKhachMa", kh.getTenKhachHang(), kh.getMaKhachHang()),
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
            case TRUONG_EMAIL -> excludeId == null
                    ? repository.findFirstByEmail(giaTri)
                    : repository.findFirstByEmailAndIdNot(giaTri, excludeId);
            case TRUONG_MA_SO_THUE -> excludeId == null
                    ? repository.findFirstByMaSoThue(giaTri)
                    : repository.findFirstByMaSoThueAndIdNot(giaTri, excludeId);
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
        } else if (TRUONG_MA_SO_THUE.equals(truong)) {
            if (!MaSoThue.hopLe(gon)) return null;
        } else {
            throw new CommonException(ThongDiep.of("banHang.truongKiemTrungSai"));
        }
        return timTrung(truong, gon, boQuaId).map(mapper::toDto).orElse(null);
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
            throw new CommonException(ThongDiep.of("banHang.loaiKhachHangSai"));
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