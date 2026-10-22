package com.dev.backend.services.impl.entities;

import org.springframework.security.core.context.SecurityContextHolder;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.LoginResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhoPhuTrachHieuLucDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.entities.TepTin;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.mapper.PhanQuyenNguoiDungKhoMapper;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.email.CachDoiMatKhau;
import com.dev.backend.services.email.DinhDangEmail;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.dev.backend.utils.AvatarImageValidator;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class NguoiDungService extends BaseServiceImpl<NguoiDung, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;

    @Autowired
    private NguoiDungMapper nguoiDungMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private CalcService calcService;

    @Autowired
    private PhanQuyenNguoiDungKhoMapper pqndkMapper;

    @Autowired
    private MinioService minioService;

    @Autowired
    private TepTinService tepTinService;

    @Autowired
    private PasswordResetRateLimiter passwordResetRateLimiter;

    // Mọi email nhân sự (E1, E2, E3, M4) đi qua đây: dựng dữ liệu trong transaction, gửi sau commit, không ném lỗi
    @Autowired
    private EmailNghiepVuService emailNghiepVuService;

    private static final Logger logger = LoggerFactory.getLogger(NguoiDungService.class);

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public NguoiDungService(NguoiDungRepository repository) {
        super(repository);
    }

    private final NguoiDungRepository nguoiDungRepository = (NguoiDungRepository) super.getRepository();

    // SĐT di động Việt Nam (định dạng trong nước): 10 chữ số, bắt đầu bằng
    // 03/05/07/08/09
    private static final Pattern VIETNAM_PHONE_PATTERN = Pattern.compile("^0[35789][0-9]{8}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");

    // SĐT là tùy chọn: null/blank hợp lệ; có giá trị thì phải đúng định dạng
    private static void validatePhone(String phone) {
        if (phone != null
                && !phone.isBlank()
                && !VIETNAM_PHONE_PATTERN.matcher(phone.trim()).matches()) {
            throw new CommonException("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09)");
        }
    }

    private static void validateEmail(String email) {
        if (email == null || email.isBlank() || !EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new CommonException("Vui lòng nhập đúng định dạng email");
        }
    }

    // blank -> null (giữ số 0 đầu vì lưu dạng chuỗi), ngược lại trim
    private static String normalizePhone(String phone) {
        return (phone == null || phone.isBlank()) ? null : phone.trim();
    }

    @Transactional
    public ResponseEntity<ResponseData<LoginResponse>> login(LoginRequest loginRequest) {
        String rawPassword = loginRequest.getPassword() == null ? "" : loginRequest.getPassword();
        // check thông tin user đã có trong hệ thống hay chưa
        Optional<NguoiDung> findingNguoiDung = resolveAccount(loginRequest.getUsername());
        if (findingNguoiDung.isEmpty()) {
            // vẫn chạy BCrypt để thời gian phản hồi giống trường hợp sai mật khẩu (không lộ
            // tài khoản có tồn tại)
            passwordEncoder.matches(rawPassword, dummyPasswordHash());
            throw new CommonException(LOGIN_FAILED_MESSAGE);
        }
        NguoiDung nguoiDung = findingNguoiDung.get();
        if (!passwordEncoder.matches(rawPassword, nguoiDung.getMatKhauHash())) {
            throw new CommonException(LOGIN_FAILED_MESSAGE);
        }

        // Tài khoản bị khóa, hoặc không mang vai trò nhân sự (khách hàng không phải người dùng hệ thống),
        // không được đăng nhập — đọc trực tiếp từ DB
        if (!nguoiDung.duocDangNhap()) {
            throw new AccountDisabledException();
        }

        return ResponseEntity.ok(
                ResponseData.<LoginResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                LoginResponse.builder()
                                        .nguoiDung(nguoiDungMapper.toDto(nguoiDung))
                                        .token(issueToken(nguoiDung))
                                        .build())
                        .message("Success")
                        .error(null)
                        .build());
    }

    // Sai tên đăng nhập hay sai mật khẩu đều trả cùng thông báo (không lộ tài khoản
    // có tồn tại)
    static final String LOGIN_FAILED_MESSAGE = "Tên đăng nhập hoặc mật khẩu không chính xác";

    private volatile String dummyPasswordHash;

    private String dummyPasswordHash() {
        if (dummyPasswordHash == null) {
            dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
        }
        return dummyPasswordHash;
    }

    // Token đăng nhập kèm claim "cv" (dấu vân tay mật khẩu hiện tại): đổi/đặt lại
    // mật khẩu -> token cũ bị thu hồi
    private String issueToken(NguoiDung nguoiDung) {
        // lấy danh sách phân quyền người dùng để truyền ra token
        List<PhanQuyenNguoiDungKho> phanQuyenNguoiDungKhos = phanQuyenNguoiDungKhoService
                .findByNguoiDungIdAndActive(nguoiDung.getId());

        // lấy ra danh sách vai trò cho người dùng
        Set<String> vaiTros = new HashSet<>();
        vaiTros.add(nguoiDung.getVaiTro());

        // tạo token người dùng
        return jwtService.generateTokenWithPermissions(
                nguoiDung.getId(),
                nguoiDung.getTenDangNhap(),
                nguoiDung.getHoTen(),
                nguoiDung.getEmail(),
                nguoiDung.getSoDienThoai(),
                vaiTros,
                nguoiDung.getTrangThai(),
                nguoiDung.getNgayTao(),
                nguoiDung.getNgayCapNhat(),
                pqndkMapper.toDtoList(phanQuyenNguoiDungKhos),
                "Google",
                jwtService.credentialVersion(nguoiDung.getMatKhauHash()));
    }

    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> update(UpdateNguoiDungRequest request) {
        if (request == null || request.getId() == null) {
            throw new CommonException("Mã người dùng không được để trống");
        }

        NguoiDungAuthInfo contextUser = com.dev.backend.config.SecurityContextHolder.getUser();
        if (contextUser == null || contextUser.getId() == null) {
            throw new CommonException("Người dùng chưa được xác thực");
        }

        boolean isAdmin = contextUser.getVaiTro() != null && contextUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin && !contextUser.getId().equals(request.getId())) {
            throw new CommonException("Bạn không có quyền chỉnh sửa thông tin của người dùng khác!");
        }

        NguoiDung nguoiDung = nguoiDungRepository.findById(request.getId())
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng id: " + request.getId()));
        if (request.getTenDangNhap() != null && !request.getTenDangNhap().isBlank()) {
            String newUsername = request.getTenDangNhap().trim();
            if (!newUsername.equalsIgnoreCase(nguoiDung.getTenDangNhap())) {
                // Hồ sơ cá nhân ghi "Tên đăng nhập không đổi được": chỉ quản trị viên được đổi
                if (!isAdmin) {
                    throw new CommonException("Tên đăng nhập không đổi được. Liên hệ quản trị viên nếu cần đổi.");
                }
                if (nguoiDungRepository.existsByTenDangNhap(newUsername)) {
                    throw new CommonException("Tên đăng nhập đã tồn tại trong hệ thống");
                }
                nguoiDung.setTenDangNhap(newUsername);
            }
        }
        if (request.getHoTen() != null && !request.getHoTen().isBlank()) {
            nguoiDung.setHoTen(request.getHoTen().trim());
        }
        // Hệ thống không cho đổi email: email dùng để đăng nhập, nhận mật khẩu tạm thời và mã đặt lại mật khẩu.
        // Tài khoản chưa có email thì được thêm một lần.
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String newEmail = request.getEmail().trim();
            String emailHienTai = nguoiDung.getEmail() == null ? "" : nguoiDung.getEmail().trim();
            if (!newEmail.equalsIgnoreCase(emailHienTai)) {
                if (!emailHienTai.isEmpty()) {
                    throw new CommonException("Email không đổi được. Email dùng để đăng nhập và nhận mã đặt lại mật khẩu.");
                }
                validateEmail(newEmail);
                if (nguoiDungRepository.existsByEmail(newEmail)) {
                    throw new CommonException("Email đã tồn tại trong hệ thống");
                }
                nguoiDung.setEmail(newEmail);
            }
        }
        // SĐT để trống = không thay đổi (không phải xóa); có giá trị thì phải đúng định
        // dạng
        String soDienThoai = normalizePhone(request.getSoDienThoai());
        if (soDienThoai != null) {
            validatePhone(soDienThoai);
            nguoiDung.setSoDienThoai(soDienThoai);
        }
        nguoiDung = nguoiDungRepository.save(nguoiDung);
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(nguoiDungMapper.toDto(nguoiDung))
                        .message("Cập nhật thông tin người dùng thành công")
                        .error(null)
                        .build());
    }

    // lấy người dùng đang đăng nhập từ context (token) — không tin tưởng id từ
    // frontend
    private NguoiDung getCurrentUserFromContext() {
        NguoiDungAuthInfo info = com.dev.backend.config.SecurityContextHolder.getUser();
        if (info == null || info.getId() == null) {
            throw new CommonException("Phiên đăng nhập không hợp lệ");
        }
        return nguoiDungRepository.findById(info.getId())
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));
    }

    // Vai trò được hiển thị mục "Kho phụ trách" trên hồ sơ cá nhân.
    // quan_tri_vien luôn ẩn (toàn quyền mọi kho) — phân quyền kho thực tế (hoạt động + còn
    // hiệu lực) mới là nguồn đúng.
    private static final Set<String> EMPLOYEE_ROLES = Set.of(
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang);

    /**
     * Danh sách Người dùng của quản trị viên (POST /api/v1/admin/filter): lọc như {@link #filter} rồi gắn kho phụ
     * trách đang hiệu lực cho từng người trong trang bằng một truy vấn (không truy vấn lặp theo từng dòng).
     */
    public Page<NguoiDungDto> locChoQuanTri(BaseFilterRequest request) {
        Page<NguoiDungDto> trang = nguoiDungMapper.toDtoPage(filter(request));
        ganKhoPhuTrachHieuLuc(trang.getContent());
        return trang;
    }

    // Quản trị viên toàn quyền ở mọi kho nên không gắn; người chưa có kho hiệu lực giữ null
    void ganKhoPhuTrachHieuLuc(List<NguoiDungDto> danhSach) {
        List<Integer> ids = danhSach.stream()
                .filter(NguoiDungService::lamViecTheoKho)
                .map(NguoiDungDto::getId)
                .toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Integer, KhoPhuTrachHieuLucDto> khoTheoNguoi = phanQuyenNguoiDungKhoService.layKhoPhuTrachHieuLucTheoNguoiDung(ids);
        for (NguoiDungDto dto : danhSach) {
            if (lamViecTheoKho(dto)) {
                dto.setKhoPhuTrachHieuLuc(khoTheoNguoi.get(dto.getId()));
            }
        }
    }

    // Set.of(...).contains(null) ném NPE nên kiểm vai trò null trước
    private static boolean lamViecTheoKho(NguoiDungDto dto) {
        return dto.getId() != null && dto.getVaiTro() != null && EMPLOYEE_ROLES.contains(dto.getVaiTro());
    }

    // Điền danh sách kho phụ trách (chỉ mã + tên, đã lọc hoạt động/hiệu lực/ngày
    // bắt đầu) vào DTO hồ sơ
    private void fillKhoPhuTrachActive(NguoiDungDto dto, NguoiDung nguoiDung) {
        String vaiTro = nguoiDung.getVaiTro();
        if (vaiTro == null || !EMPLOYEE_ROLES.contains(vaiTro)) {
            dto.setKhoPhuTrachActive(Collections.emptyList());
            return;
        }
        dto.setKhoPhuTrachActive(
                phanQuyenNguoiDungKhoService.findActiveKhoInfoByNguoiDungId(nguoiDung.getId()));
    }

    public ResponseEntity<ResponseData<NguoiDungDto>> getMe() {
        NguoiDung nguoiDung = getCurrentUserFromContext();
        NguoiDungDto dto = nguoiDungMapper.toDto(nguoiDung);
        fillKhoPhuTrachActive(dto, nguoiDung);
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message("Success")
                        .error(null)
                        .build());
    }

    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> updateMe(UpdateMeRequest request) {
        if (request.getHoTen() == null || request.getHoTen().isBlank()) {
            throw new CommonException("Họ tên không được để trống");
        }

        NguoiDung nguoiDung = getCurrentUserFromContext();
        nguoiDung.setHoTen(request.getHoTen().trim());
        // cho phép xóa số điện thoại: rỗng -> null (giống createInternalUserByAdmin)
        String soDienThoai = normalizePhone(request.getSoDienThoai());
        validatePhone(soDienThoai);
        // Số điện thoại cũng dùng để đăng nhập: không cho trùng với tài khoản khác (giống lúc tạo người dùng)
        if (soDienThoai != null && !soDienThoai.equals(nguoiDung.getSoDienThoai())) {
            Integer toiId = nguoiDung.getId();
            boolean trung = nguoiDungRepository.findAllBySoDienThoai(soDienThoai).stream()
                    .anyMatch(khac -> !khac.getId().equals(toiId));
            if (trung) {
                throw new CommonException("Số điện thoại đã được tài khoản khác sử dụng");
            }
        }
        nguoiDung.setSoDienThoai(soDienThoai);

        nguoiDung = nguoiDungRepository.save(nguoiDung); // ngayCapNhat tự cập nhật (@Generated UPDATE)

        NguoiDungDto dto = nguoiDungMapper.toDto(nguoiDung);
        fillKhoPhuTrachActive(dto, nguoiDung);

        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message("Cập nhật hồ sơ thành công")
                        .error(null)
                        .build());
    }

    public Optional<NguoiDung> findByEmail(String email) {
        return nguoiDungRepository.findByEmail(email);
    }

    // ===== Ảnh đại diện (tự phục vụ — user luôn lấy từ context đăng nhập, không
    // nhận id từ client) =====

    /**
     * Upload/đổi ảnh đại diện của người đang đăng nhập.
     * Thứ tự an toàn: validate nội dung -> upload object MinIO TRƯỚC -> lưu DB.
     * DB lỗi thì transaction rollback (gồm dòng tep_tin mới) + xóa object mồ côi.
     * Ảnh cũ chỉ bị xóa SAU khi DB đã commit (MinIO không rollback theo
     * transaction).
     */
    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> updateMyAvatar(MultipartFile file) {
        String format = AvatarImageValidator.validate(file); // lỗi -> CommonException 400, chưa đụng DB/MinIO

        NguoiDung nguoiDung = getCurrentUserFromContext();
        TepTin tepTinCu = nguoiDung.getAvatarTepTin();

        // Tên lưu trữ sinh tự động, phần mở rộng lấy từ format thật của nội dung (không
        // tin tên tệp)
        String objectName;
        try {
            objectName = minioService.upload(file, "avatars/" + UUID.randomUUID() + "." + format);
        } catch (Exception e) {
            logger.error("Upload ảnh đại diện (user {}) lên MinIO thất bại: {}", nguoiDung.getId(), e.getMessage());
            throw new CommonException("Không thể tải ảnh lên máy chủ. Vui lòng thử lại sau");
        }

        try {
            TepTin tepTinMoi = tepTinService.create(TepTin.builder()
                    .tenTepGoc(file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                            ? file.getOriginalFilename()
                            : objectName)
                    .tenTaiLen(objectName)
                    .tenLuuTru(objectName)
                    .duongDan(minioService.getPublicUrl(objectName))
                    .loaiTepTin(FileType.IMAGE.toString())
                    .duoiTep("." + format)
                    .kichCo((int) file.getSize())
                    .trangThai(1)
                    .ngayTao(Instant.now())
                    .build());

            nguoiDung.setAvatarTepTin(tepTinMoi);
            nguoiDungRepository.save(nguoiDung); // ngayCapNhat tự cập nhật (@Generated UPDATE)
        } catch (Exception e) {
            // Dòng tep_tin mới rollback theo transaction; object MinIO không rollback ->
            // xóa thủ công
            minioService.delete(objectName);
            logger.error("Lưu ảnh đại diện (user {}) vào DB thất bại: {}", nguoiDung.getId(), e.getMessage());
            throw new CommonException("Lưu ảnh đại diện thất bại. Vui lòng thử lại");
        }

        // Xóa ảnh cũ sau commit, có kiểm tra còn ai tham chiếu không (concurrent-safe)
        cleanupOldAvatarAfterCommit(tepTinCu);

        NguoiDungDto dto = nguoiDungMapper.toDto(nguoiDung);
        fillKhoPhuTrachActive(dto, nguoiDung);

        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message("Cập nhật ảnh đại diện thành công")
                        .error(null)
                        .build());
    }

    /**
     * Xóa ảnh đại diện của người đang đăng nhập. Tệp cũ chỉ bị xóa sau khi DB
     * đã commit; không có ảnh thì vẫn trả về thành công (idempotent).
     */
    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> removeMyAvatar() {
        NguoiDung nguoiDung = getCurrentUserFromContext();
        TepTin tepTinCu = nguoiDung.getAvatarTepTin();

        nguoiDung.setAvatarTepTin(null);
        nguoiDung = nguoiDungRepository.save(nguoiDung);

        cleanupOldAvatarAfterCommit(tepTinCu);

        NguoiDungDto dto = nguoiDungMapper.toDto(nguoiDung);
        fillKhoPhuTrachActive(dto, nguoiDung);

        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(dto)
                        .message("Xóa ảnh đại diện thành công")
                        .error(null)
                        .build());
    }

    /**
     * Xóa ảnh cũ sau khi DB đã commit (MinIO không rollback theo transaction).
     * - Kiểm tra không còn người dùng nào tham chiếu tệp cũ mới xóa (tránh xóa
     * tệp đang được chia sẻ hoặc đang được request song song giữ làm ảnh hiện tại).
     * - Lỗi dọn dẹp chỉ log cảnh báo, KHÔNG làm response của lần lưu đã thành công
     * bị báo lỗi.
     */
    private void cleanupOldAvatarAfterCommit(TepTin tepTinCu) {
        Runnable cleanup = () -> {
            if (tepTinCu == null) {
                return;
            }
            try {
                if (nguoiDungRepository.existsByAvatarTepTinId(tepTinCu.getId())) {
                    // Vẫn còn người dùng tham chiếu tệp cũ -> giữ nguyên
                    return;
                }
                tepTinService.hardDeleteNoMessage(tepTinCu.getId());
            } catch (Exception e) {
                logger.warn("Không xóa được ảnh đại diện cũ (tep_tin id {}): {}",
                        tepTinCu.getId(), e.getMessage());
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
        } else {
            // Không có transaction đang hoạt động (vd. unit test) -> chạy trực tiếp
            cleanup.run();
        }
    }

    // OTP đặt lại mật khẩu: hiệu lực 5 phút, tối đa 5 lần nhập sai
    static final long RESET_OTP_TTL_SECONDS = 300;
    // Mật khẩu quản trị viên tự gõ khi tạo tài khoản: cùng quy tắc với đổi mật khẩu
    static final int MAT_KHAU_TOI_THIEU = 6;
    static final int RESET_OTP_MAX_FAILED_ATTEMPTS = 5;
    private static final String RESET_OTP_INVALID_MESSAGE = "Mã xác nhận không tồn tại hoặc đã hết hạn";
    private static final int BCRYPT_MAX_PASSWORD_BYTES = 72;
    // mã lỗi trong data.code để FE phân biệt: sai mã (nhập lại) / hết hạn-huỷ (phải
    // gửi lại mã)
    static final String RESET_OTP_WRONG_CODE = "RESET_OTP_WRONG";
    static final String RESET_OTP_EXPIRED_CODE = "RESET_OTP_EXPIRED";

    private static boolean isResetOtpOf(OtpScheduleObj otpScheduleObj, String email) {
        return otpScheduleObj.getType() == OtpType.RESET_PASSWORD
                && Objects.equals(otpScheduleObj.getEmail(), email);
    }

    // Phản hồi chung cho mọi yêu cầu hợp lệ: không cho biết tài khoản có tồn tại /
    // bị khoá / có email hay không
    // Thời hạn trong câu dựng từ RESET_OTP_TTL_SECONDS (không viết cứng "5 phút"); "mã xác nhận" thay cho "OTP".
    static final String FORGOT_PASSWORD_GENERIC_MESSAGE = "Nếu thông tin tài khoản hợp lệ, mã xác nhận đã được gửi tới "
            + "email đã đăng ký. Mã có hiệu lực " + DinhDangEmail.phut(java.time.Duration.ofSeconds(RESET_OTP_TTL_SECONDS)) + ".";

    public ResponseEntity<ResponseData<String>> forgotPassword(ForgotPasswordRequest fpRequest, String clientIp) {
        String identifier = fpRequest.getUsername() == null ? "" : fpRequest.getUsername().trim();
        if (identifier.isEmpty()) {
            throw new CommonException("Vui lòng nhập email / tên đăng nhập");
        }

        // tài khoản sẽ nhận email (null: không tồn tại / bị khoá / chưa có email ->
        // không gửi, chỉ ghi log)
        NguoiDung recipient = resolveAccount(identifier).filter(this::canReceiveResetOtp).orElse(null);

        // giới hạn theo chuỗi nhập + IP áp dụng cho MỌI yêu cầu (kể cả tài khoản không
        // tồn tại) -> phản hồi giống nhau;
        // theo tài khoản + quota hệ thống chỉ khi thực sự gửi. Kiểm tra + ghi nhận
        // trong 1 lần (bị chặn thì không ghi gì).
        PasswordResetRateLimiter.Decision decision = passwordResetRateLimiter.tryAcquire(
                identifier.toLowerCase(Locale.ROOT), clientIp, recipient == null ? null : recipient.getId());
        if (!decision.allowed()) {
            logger.warn("[forgotPassword] Vượt giới hạn gửi OTP ({}), chờ {} giây", decision.reason(),
                    decision.retryAfterSeconds());
        }
        throwIfRateLimited(decision);

        if (recipient != null) {
            sendResetOtp(recipient);
        }

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message(FORGOT_PASSWORD_GENERIC_MESSAGE)
                        .build());
    }

    // Tài khoản không nhận được OTP thì chỉ ghi log, KHÔNG báo về client (không lộ
    // trạng thái tài khoản)
    private boolean canReceiveResetOtp(NguoiDung nguoiDung) {
        if (!nguoiDung.duocDangNhap()) {
            logger.warn("[forgotPassword] Tài khoản id={} bị khoá hoặc không mang vai trò nhân sự, không gửi OTP",
                    nguoiDung.getId());
            return false;
        }
        // không có email thì không gửi được OTP (và OTP email null làm hỏng các vòng so
        // khớp email)
        if (nguoiDung.getEmail() == null || nguoiDung.getEmail().isBlank()) {
            logger.warn("[forgotPassword] Tài khoản id={} chưa có email, không gửi OTP", nguoiDung.getId());
            return false;
        }
        return true;
    }

    // Tạo OTP + gửi email (bất đồng bộ, lỗi SMTP chỉ ghi log server)
    private void sendResetOtp(NguoiDung nguoiDung) {
        // Tạo OTP
        String otp = calcService.getRandomActiveCode(6L);
        Instant taoLuc = Instant.now();
        OtpScheduleObj resetOtp = OtpScheduleObj.builder()
                .email(nguoiDung.getEmail())
                .otp(otp)
                .createdAt(taoLuc)
                .type(OtpType.RESET_PASSWORD)
                .build();
        // gửi lại OTP: xoá mã RESET_PASSWORD cũ của email này rồi mới thêm mã mới, để
        // mã còn hiệu lực
        // luôn là mã trong email mới nhất. Khoá để 2 yêu cầu đồng thời không để lại 2
        // mã cùng lúc.
        synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
            GlobalCache.OTP_SCHEDULE_OBJS.removeIf(o -> isResetOtpOf(o, nguoiDung.getEmail()));
            GlobalCache.OTP_SCHEDULE_OBJS.add(resetOtp);
        }

        // E1: gửi sau commit ở luồng riêng, không truy vấn CSDL thêm (phản hồi mất cùng thời gian dù tài khoản có hay
        // không); lỗi SMTP chỉ ghi log server, không trả về client. Hết hạn = lúc tạo + TTL (không viết cứng).
        emailNghiepVuService.guiMaDatLaiMatKhau(nguoiDung, otp, taoLuc, taoLuc.plusSeconds(RESET_OTP_TTL_SECONDS));
    }

    private static void throwIfRateLimited(PasswordResetRateLimiter.Decision decision) {
        if (decision.allowed())
            return;
        long seconds = decision.retryAfterSeconds();
        if (decision.reason() == PasswordResetRateLimiter.Reason.GLOBAL_LIMIT) {
            throw new CommonException(
                    "Hệ thống tạm ngưng gửi mã xác nhận do có quá nhiều yêu cầu. Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    Map.of("code", "OTP_SERVICE_BUSY", "retryAfterSeconds", seconds));
        }
        String message = decision.reason() == PasswordResetRateLimiter.Reason.COOLDOWN
                ? "Vui lòng đợi " + seconds + " giây trước khi yêu cầu mã mới"
                : "Bạn đã yêu cầu mã quá nhiều lần, vui lòng thử lại sau " + ((seconds + 59) / 60) + " phút";
        throw new CommonException(message, HttpStatus.TOO_MANY_REQUESTS,
                Map.of("code", "OTP_RATE_LIMITED", "retryAfterSeconds", seconds));
    }

    /**
     * Tìm tài khoản theo chuỗi đăng nhập (tên đăng nhập / email / SĐT) theo thứ tự
     * ưu tiên.
     * SĐT không UNIQUE: trùng nhiều tài khoản thì coi như không tìm thấy (trước đây
     * truy vấn OR ném lỗi 500).
     */
    Optional<NguoiDung> resolveAccount(String rawIdentifier) {
        if (rawIdentifier == null || rawIdentifier.isBlank())
            return Optional.empty();
        String identifier = rawIdentifier.trim();
        Optional<NguoiDung> byUsername = nguoiDungRepository.findByTenDangNhap(identifier);
        if (byUsername.isPresent())
            return byUsername;
        Optional<NguoiDung> byEmail = nguoiDungRepository.findByEmail(identifier);
        if (byEmail.isPresent())
            return byEmail;
        List<NguoiDung> byPhone = nguoiDungRepository.findAllBySoDienThoai(identifier);
        if (byPhone.size() > 1) {
            logger.warn("[resolveAccount] Số điện thoại gắn với {} tài khoản, yêu cầu dùng tên đăng nhập/email",
                    byPhone.size());
            return Optional.empty();
        }
        return byPhone.stream().findFirst();
    }

    // BCrypt từ chối mật khẩu > 72 byte (IllegalArgumentException -> 500). Tính
    // theo byte UTF-8 vì ký tự có dấu chiếm 2-3 byte.
    private static void assertPasswordFitsBcrypt(String password) {
        if (password != null && password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_PASSWORD_BYTES) {
            throw new CommonException("Mật khẩu quá dài (tối đa 72 ký tự không dấu, ít hơn nếu có dấu tiếng Việt)");
        }
    }

    // Bước "Xác thực OTP" (FE bước 2): chỉ kiểm tra mã, KHÔNG tiêu thụ mã — mã vẫn
    // dùng được ở bước đổi mật khẩu.
    // Dùng chung bộ đếm nhập sai với resetPassword nên không mở thêm đường dò mã.
    public ResponseEntity<ResponseData<String>> verifyResetOtp(VerifyResetOtpRequest request) {
        NguoiDung nguoiDung = findUserForPasswordReset(request.getUsername());
        checkResetOtp(nguoiDung, request.getOtp());

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build());
    }

    public ResponseEntity<ResponseData<String>> resetPassword(ResetPasswordRequest rpRequest) {
        // kiểm tra trước khi đụng tới OTP để không làm mất mã / tính là nhập sai
        assertPasswordFitsBcrypt(rpRequest.getPassword());

        // tìm xem thông tin người dùng có trong hệ thống hay chưa
        NguoiDung nguoiDung = findUserForPasswordReset(rpRequest.getUsername());

        OtpScheduleObj findingResetOtp = checkResetOtp(nguoiDung, rpRequest.getOtp());

        // Xoá OTP khỏi bộ nhớ đệm trước khi đổi MK: remove() là nguyên tử nên mỗi mã
        // chỉ dùng được 1 lần,
        // request đồng thời dùng cùng mã (hoặc mã vừa bị huỷ do nhập sai quá số lần) sẽ
        // bị từ chối
        if (!GlobalCache.OTP_SCHEDULE_OBJS.remove(findingResetOtp)) {
            throw resetOtpExpired(RESET_OTP_INVALID_MESSAGE);
        }

        // sau khi thoả mãn các dk trên thì cho phép đặt lại MK
        nguoiDung.setMatKhauHash(passwordEncoder.encode(rpRequest.getPassword()));
        // M4 (gửi sau commit, không chứa mật khẩu)
        emailNghiepVuService.guiDaDoiMatKhau(nguoiDung, CachDoiMatKhau.DAT_LAI_BANG_MA, Instant.now());

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()

        );
    }

    // Không tìm thấy / bị khoá / không mang vai trò nhân sự -> cùng lỗi "mã không tồn tại hoặc đã hết hạn"
    // (không lộ tài khoản có tồn tại)
    private NguoiDung findUserForPasswordReset(String username) {
        return resolveAccount(username)
                .filter(NguoiDung::duocDangNhap)
                .orElseThrow(() -> resetOtpExpired(RESET_OTP_INVALID_MESSAGE));
    }

    /**
     * Kiểm tra OTP đặt lại mật khẩu của người dùng (không xoá mã khi đúng). Lỗi trả
     * kèm data.code để FE xử lý:
     * RESET_OTP_WRONG (sai, còn lượt thử) / RESET_OTP_EXPIRED (không có, hết hạn
     * hoặc đã huỷ -> phải gửi lại mã).
     */
    private OtpScheduleObj checkResetOtp(NguoiDung nguoiDung, String otp) {
        // tìm otp của người dùng có tồn tại trong danh sách OTP đã gửi hay ko
        OtpScheduleObj findingResetOtp = GlobalCache.OTP_SCHEDULE_OBJS.stream()
                .filter(otpScheduleObj -> isResetOtpOf(otpScheduleObj, nguoiDung.getEmail()))
                .findFirst()
                .orElseThrow(() -> resetOtpExpired(RESET_OTP_INVALID_MESSAGE));

        // kiểm tra otp còn hạn hay không(trong vòng 5p)
        if (Instant.now().isAfter(findingResetOtp.getCreatedAt().plusSeconds(RESET_OTP_TTL_SECONDS))) {
            GlobalCache.OTP_SCHEDULE_OBJS.remove(findingResetOtp);
            throw resetOtpExpired(RESET_OTP_INVALID_MESSAGE);
        }

        if (!findingResetOtp.getOtp().equals(otp)) {
            // nhập sai quá số lần cho phép thì huỷ mã, buộc yêu cầu mã mới (chống dò mã 6
            // số)
            int failed = findingResetOtp.getFailedAttempts().incrementAndGet();
            if (failed >= RESET_OTP_MAX_FAILED_ATTEMPTS) {
                GlobalCache.OTP_SCHEDULE_OBJS.remove(findingResetOtp);
                throw resetOtpExpired("Bạn đã nhập sai mã xác nhận quá " + RESET_OTP_MAX_FAILED_ATTEMPTS
                        + " lần, vui lòng yêu cầu mã mới");
            }
            int remaining = RESET_OTP_MAX_FAILED_ATTEMPTS - failed;
            throw new CommonException("Mã xác nhận không đúng, bạn còn " + remaining + " lần thử",
                    HttpStatus.BAD_REQUEST,
                    Map.of("code", RESET_OTP_WRONG_CODE, "remainingAttempts", remaining));
        }
        return findingResetOtp;
    }

    private static CommonException resetOtpExpired(String message) {
        return new CommonException(message, HttpStatus.BAD_REQUEST, Map.of("code", RESET_OTP_EXPIRED_CODE));
    }

    public Page<NguoiDung> getUserListByAdmin(Pageable pageable) {
        return nguoiDungRepository.findAll(pageable);
    }

    public NguoiDung getDetailByAdmin(Integer id) {
        if (id == null) {
            throw new CommonException("Mã người dùng không được để trống");
        }

        NguoiDungAuthInfo currentUser = com.dev.backend.config.SecurityContextHolder.getUser();
        if (currentUser != null && currentUser.getId() != null) {
            boolean isAdmin = currentUser.getVaiTro() != null
                    && currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
            if (!isAdmin && !currentUser.getId().equals(id)) {
                throw new CommonException("Bạn không có quyền xem thông tin chi tiết của người dùng khác!");
            }
        }

        NguoiDung nguoiDung = nguoiDungRepository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        // Lấy danh sách phân quyền kho
        List<PhanQuyenNguoiDungKho> dsPhanQuyen = phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(id);

        // Gán danh sách này vào trường @Transient vừa tạo
        if (dsPhanQuyen != null) {
            nguoiDung.setKhoPhuTrach(dsPhanQuyen);
        }

        return nguoiDung;
    }

    @Transactional
    public NguoiDung toggleStatusByAdmin(Integer userId) {

        // lay current id
        Integer currentUserId = null;

        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            Object userIdClaim = jwt.getClaim("id");
            if (userIdClaim != null) {
                currentUserId = Integer.valueOf(userIdClaim.toString());
            }
        }
        // Hệ thống xác thực bằng AuthInterceptor (không qua Spring Security) nên lấy người đang đăng nhập từ context riêng
        NguoiDungAuthInfo contextUser = com.dev.backend.config.SecurityContextHolder.getUser();
        if (currentUserId == null && contextUser != null) {
            currentUserId = contextUser.getId();
        }

        // lay id bi thao tac
        NguoiDung nguoiDung = nguoiDungRepository.findById(userId)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        // chan tu khoa
        if (nguoiDung.getId().equals(currentUserId)) {
            throw new CommonException("Không thể tự khóa tài khoản của chính mình");
        }

        // toggle trang thai
        if (nguoiDung.getTrangThai() != null && nguoiDung.getTrangThai() == 1) {
            nguoiDung.setTrangThai(0);
        } else {
            nguoiDung.setTrangThai(1);
        }

        nguoiDung.setNgayCapNhat(Instant.now());

        return nguoiDungRepository.save(nguoiDung);
    }

    @Transactional
    public NguoiDung createInternalUserByAdmin(NguoiDungCreating request) {
        String vaiTro = vaiTroTaiKhoanMoi(request.getVaiTro());
        if (request.getTenDangNhap() == null || request.getTenDangNhap().isBlank()) {
            throw new CommonException("Tên đăng nhập không được để trống");
        }
        String tenDangNhap = request.getTenDangNhap().trim();
        if (nguoiDungRepository.existsByTenDangNhap(tenDangNhap)) {
            throw new CommonException("Tên đăng nhập đã tồn tại");
        }

        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new CommonException("Email không được để trống khi tạo tài khoản");
        }
        String email = request.getEmail().trim();
        validateEmail(email);
        if (nguoiDungRepository.existsByEmail(email)) {
            throw new CommonException("Email đã tồn tại");
        }

        // SĐT tùy chọn: blank -> null; có giá trị thì phải đúng định dạng rồi mới kiểm tra trùng
        String soDienThoai = normalizePhone(request.getSoDienThoai());
        validatePhone(soDienThoai);
        if (soDienThoai != null && nguoiDungRepository.existsBySoDienThoai(soDienThoai)) {
            throw new CommonException("Số điện thoại đã tồn tại");
        }

        // Quản trị viên tự gõ mật khẩu thì kiểm như đổi mật khẩu (tối thiểu 6 ký tự, tối đa 72 byte của BCrypt);
        // để trống thì tự sinh mật khẩu tạm ngẫu nhiên. Cả hai đều gửi trong E2 như mật khẩu tạm.
        String tempPassword;
        if (request.getMatKhau() != null && !request.getMatKhau().isBlank()) {
            tempPassword = request.getMatKhau().trim();
            if (tempPassword.length() < MAT_KHAU_TOI_THIEU) {
                throw new CommonException("Mật khẩu phải có ít nhất " + MAT_KHAU_TOI_THIEU + " ký tự");
            }
            assertPasswordFitsBcrypt(tempPassword);
        } else {
            tempPassword = generateTemporaryPassword();
        }

        NguoiDung nguoiDung = new NguoiDung();
        nguoiDung.setTenDangNhap(tenDangNhap);
        nguoiDung.setEmail(email);
        // họ tên trống thì dùng tên đăng nhập (email không ra "Xin chào ,")
        nguoiDung.setHoTen(request.getHoTen() != null && !request.getHoTen().isBlank()
                ? request.getHoTen().trim() : tenDangNhap);
        nguoiDung.setSoDienThoai(soDienThoai);
        nguoiDung.setVaiTro(vaiTro);
        nguoiDung.setTrangThai(1);
        nguoiDung.setMatKhauHash(passwordEncoder.encode(tempPassword));
        nguoiDung.setMustChangePassword(true);

        NguoiDung saved = create(nguoiDung);

        // E2: gửi sau commit (lỗi trùng khóa lúc commit thì không gửi cho tài khoản không tồn tại)
        emailNghiepVuService.guiTaiKhoanMoi(saved, tempPassword);

        return saved;
    }

    // Vai trò của tài khoản mới: để trống thì là Nhân viên kho (mặc định của popup Thêm người dùng).
    // Chỉ nhận vai trò nhân sự; khách hàng không phải người dùng hệ thống, "all" chỉ dùng trong @RequireAuth.
    private static String vaiTroTaiKhoanMoi(String vaiTro) {
        if (vaiTro == null || vaiTro.isBlank()) {
            return IRoleType.nhan_vien_kho;
        }
        String ma = vaiTro.trim();
        if (!IRoleType.laNoiBo(ma)) {
            throw new CommonException("Vai trò không hợp lệ");
        }
        return ma;
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> changePassword(ChangePasswordRequest changePass) {
        // validate trước khi chạm tới passwordEncoder (tránh encode/matches null ->
        // 500)
        if (changePass.getCurrentPassword() == null || changePass.getCurrentPassword().isBlank()) {
            throw new CommonException("Mật khẩu hiện tại không được để trống");
        }
        if (changePass.getNewPassword() == null || changePass.getNewPassword().isBlank()
                || changePass.getNewPassword().trim().length() < 6) {
            throw new CommonException("Mật khẩu mới phải có ít nhất 6 ký tự");
        }

        // lấy user từ context đăng nhập (token), không tin tưởng id từ frontend;
        // dùng id trong token thay vì email (email có thể đã bị thay đổi -> stale)
        NguoiDung nguoiDung = getCurrentUserFromContext();

        // so khớp mật khẩu hiện tại với hash trong DB (so sánh chính xác, không trim)
        if (!passwordEncoder.matches(changePass.getCurrentPassword(), nguoiDung.getMatKhauHash())) {
            throw new CommonException("Mật khẩu hiện tại không đúng");
        }

        assertPasswordFitsBcrypt(changePass.getNewPassword().trim());

        // chỉ encode mật khẩu mới sau khi đã validate
        nguoiDung.setMatKhauHash(passwordEncoder.encode(changePass.getNewPassword().trim()));
        nguoiDung.setMustChangePassword(false);

        update(nguoiDung.getId(), nguoiDung);
        // M4 (gửi sau commit, không chứa mật khẩu)
        emailNghiepVuService.guiDaDoiMatKhau(nguoiDung, CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP, Instant.now());

        // đổi mật khẩu thu hồi mọi token cũ (kể cả token đang dùng) -> cấp token mới
        // cho phiên hiện tại,
        // FE lưu lại để không bị đăng xuất; các thiết bị/phiên khác phải đăng nhập lại
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data(issueToken(nguoiDung))
                        .message("Thay đổi mật khẩu thành công!")
                        .build());
    }

    public String generateTemporaryPassword() {
        final String characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
        StringBuilder password = new StringBuilder(8);
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (int i = 0; i < 8; i++) {
            password.append(characters.charAt(random.nextInt(characters.length())));
        }
        return password.toString();
    }

    @Transactional
    public void resetPasswordRandomByAdmin(Integer userId) {
        NguoiDung nguoiDung = nguoiDungRepository.findById(userId)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        if (nguoiDung.getEmail() == null || nguoiDung.getEmail().isBlank()) {
            throw new CommonException("Người dùng chưa có email để nhận mật khẩu tạm thời");
        }

        String tempPassword = generateTemporaryPassword();

        Instant luc = Instant.now();
        nguoiDung.setMatKhauHash(passwordEncoder.encode(tempPassword));
        nguoiDung.setMustChangePassword(true);
        nguoiDung.setNgayCapNhat(luc);
        nguoiDungRepository.save(nguoiDung);

        // E3 (sửa L9: thư có mật khẩu tạm), gửi sau commit; không gửi M4 (đã có E3)
        emailNghiepVuService.guiCapLaiMatKhau(nguoiDung, tempPassword, luc);
    }
}
