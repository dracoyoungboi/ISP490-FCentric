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
import com.dev.backend.services.EmailService;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.BaseServiceImpl;
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
    private EmailService emailService;

    @Autowired
    private PhanQuyenNguoiDungKhoMapper pqndkMapper;

    @Autowired
    private MinioService minioService;

    @Autowired
    private TepTinService tepTinService;

    private static final Logger logger = LoggerFactory.getLogger(NguoiDungService.class);


    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public NguoiDungService(NguoiDungRepository repository) {
        super(repository);
    }

    private final NguoiDungRepository nguoiDungRepository = (NguoiDungRepository) super.getRepository();

    // SĐT di động Việt Nam (định dạng trong nước): 10 chữ số, bắt đầu bằng 03/05/07/08/09
    private static final Pattern VIETNAM_PHONE_PATTERN = Pattern.compile("^0[35789][0-9]{8}$");

    // SĐT là tùy chọn: null/blank hợp lệ; có giá trị thì phải đúng định dạng
    private static void validatePhone(String phone) {
        if (phone != null
                && !phone.isBlank()
                && !VIETNAM_PHONE_PATTERN.matcher(phone.trim()).matches()) {
            throw new CommonException("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09)");
        }
    }

    // blank -> null (giữ số 0 đầu vì lưu dạng chuỗi), ngược lại trim
    private static String normalizePhone(String phone) {
        return (phone == null || phone.isBlank()) ? null : phone.trim();
    }


    @Transactional
    public ResponseEntity<ResponseData<LoginResponse>> login(LoginRequest loginRequest) {
        //check thông tin user đã có trong hệ thống hay chưa
        Optional<NguoiDung> findingNguoiDung = nguoiDungRepository.findByTenDangNhapOrEmailOrSoDienThoai(
                loginRequest.getUsername(),
                loginRequest.getUsername(),
                loginRequest.getUsername());
        if (findingNguoiDung.isEmpty()) {
            throw new CommonException("Tên đăng nhập không hợp lệ");
        }
        NguoiDung nguoiDung = findingNguoiDung.get();
        if (!passwordEncoder.matches(loginRequest.getPassword(), nguoiDung.getMatKhauHash())) {
            throw new CommonException("Mật khẩu không chính xác");
        }

        // Tài khoản bị khóa (trangThai != 1) không được đăng nhập — đọc trực tiếp từ DB
        if (nguoiDung.getTrangThai() == null || nguoiDung.getTrangThai() != 1) {
            throw new AccountDisabledException();
        }

        // lấy danh sách phân quyền người dùng để truyền ra token
        List<PhanQuyenNguoiDungKho> phanQuyenNguoiDungKhos = phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(nguoiDung.getId());

        // lấy ra danh sách vai trò cho người dùng
        Set<String> vaiTros = new HashSet<>();
        vaiTros.add(nguoiDung.getVaiTro());

        //tạo token người dùng
        String token = jwtService.generateTokenWithPermissions(
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
                "Google"
        );
        return ResponseEntity.ok(
                ResponseData.<LoginResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                LoginResponse.builder()
                                        .nguoiDung(nguoiDungMapper.toDto(nguoiDung))
                                        .token(token)
                                        .build()
                        )
                        .message("Success")
                        .error(null)
                        .build()
        );
    }


    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> update(UpdateNguoiDungRequest request) {
        NguoiDung nguoiDung = nguoiDungRepository.findById(request.getId())
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng id: " + request.getId()));
        if (request.getTenDangNhap() != null && !request.getTenDangNhap().isBlank()) {
            nguoiDung.setTenDangNhap(request.getTenDangNhap());
        }
        if (request.getHoTen() != null && !request.getHoTen().isBlank()) {
            nguoiDung.setHoTen(request.getHoTen());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            nguoiDung.setEmail(request.getEmail());
        }
        // SĐT để trống = không thay đổi (không phải xóa); có giá trị thì phải đúng định dạng
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
                        .build()
        );
    }

    // lấy người dùng đang đăng nhập từ context (token) — không tin tưởng id từ frontend
    private NguoiDung getCurrentUserFromContext() {
        NguoiDungAuthInfo info = com.dev.backend.config.SecurityContextHolder.getUser();
        if (info == null || info.getId() == null) {
            throw new CommonException("Phiên đăng nhập không hợp lệ");
        }
        return nguoiDungRepository.findById(info.getId())
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));
    }

    // Vai trò được hiển thị mục "Kho phụ trách" trên hồ sơ cá nhân.
    // quan_tri_vien và khach_hang luôn ẩn — phân quyền kho thực tế (hoạt động + còn hiệu lực) mới là nguồn đúng.
    private static final Set<String> EMPLOYEE_ROLES = Set.of(
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    );

    // Điền danh sách kho phụ trách (chỉ mã + tên, đã lọc hoạt động/hiệu lực/ngày bắt đầu) vào DTO hồ sơ
    private void fillKhoPhuTrachActive(NguoiDungDto dto, NguoiDung nguoiDung) {
        String vaiTro = nguoiDung.getVaiTro();
        if (vaiTro == null || !EMPLOYEE_ROLES.contains(vaiTro)) {
            dto.setKhoPhuTrachActive(Collections.emptyList());
            return;
        }
        dto.setKhoPhuTrachActive(
                phanQuyenNguoiDungKhoService.findActiveKhoInfoByNguoiDungId(nguoiDung.getId())
        );
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
                        .build()
        );
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
                        .build()
        );
    }

    public Optional<NguoiDung> findByEmail(String email) {
        return nguoiDungRepository.findByEmail(email);
    }

    // ===== Ảnh đại diện (tự phục vụ — user luôn lấy từ context đăng nhập, không nhận id từ client) =====

    /**
     * Upload/đổi ảnh đại diện của người đang đăng nhập.
     * Thứ tự an toàn: validate nội dung -> upload object MinIO TRƯỚC -> lưu DB.
     * DB lỗi thì transaction rollback (gồm dòng tep_tin mới) + xóa object mồ côi.
     * Ảnh cũ chỉ bị xóa SAU khi DB đã commit (MinIO không rollback theo transaction).
     */
    @Transactional
    public ResponseEntity<ResponseData<NguoiDungDto>> updateMyAvatar(MultipartFile file) {
        String format = AvatarImageValidator.validate(file); // lỗi -> CommonException 400, chưa đụng DB/MinIO

        NguoiDung nguoiDung = getCurrentUserFromContext();
        TepTin tepTinCu = nguoiDung.getAvatarTepTin();

        // Tên lưu trữ sinh tự động, phần mở rộng lấy từ format thật của nội dung (không tin tên tệp)
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
            // Dòng tep_tin mới rollback theo transaction; object MinIO không rollback -> xóa thủ công
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
                        .build()
        );
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
                        .build()
        );
    }

    /**
     * Xóa ảnh cũ sau khi DB đã commit (MinIO không rollback theo transaction).
     * - Kiểm tra không còn người dùng nào tham chiếu tệp cũ mới xóa (tránh xóa
     *   tệp đang được chia sẻ hoặc đang được request song song giữ làm ảnh hiện tại).
     * - Lỗi dọn dẹp chỉ log cảnh báo, KHÔNG làm response của lần lưu đã thành công
     *   bị báo lỗi.
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


    public ResponseEntity<ResponseData<String>> forgotPassword(ForgotPasswordRequest fpRequest) {
        NguoiDung nguoiDung = nguoiDungRepository.findByTenDangNhapOrEmailOrSoDienThoai(
                fpRequest.getUsername(),
                fpRequest.getUsername(),
                fpRequest.getUsername()).orElseThrow(
                () -> new CommonException("Không tìm thấy tài khoản")
        );

        //Tạo OTP
        String otp = calcService.getRandomActiveCode(6L);
        GlobalCache.OTP_SCHEDULE_OBJS.add(
                OtpScheduleObj.builder()
                        .email(nguoiDung.getEmail())
                        .otp(otp)
                        .createdAt(Instant.now())
                        .type(OtpType.RESET_PASSWORD)
                        .build()
        );

        //truyền dữ liệu qua email
        Map<String, Object> params = new HashMap<>();

        params.put("userName", nguoiDung.getHoTen());
        params.put("otp", otp);
        params.put("expiryTime", "5 phút");

        //gửi email
        emailService.sendHtmlEmailFromTemplate(nguoiDung.getEmail(), "Lấy lại mật khẩu", "activation.html", params);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()

        );
    }

    public ResponseEntity<ResponseData<String>> resetPassword(ResetPasswordRequest rpRequest) {
       // tìm xem thông tin người dùng có trong hệ thống hay chưa
        NguoiDung nguoiDung = nguoiDungRepository.findByTenDangNhapOrEmailOrSoDienThoai(
                rpRequest.getUsername(),
                rpRequest.getUsername(),
                rpRequest.getUsername()).orElseThrow(
                () -> new CommonException("Không tìm thấy tài khoản")
        );

        //tìm otp của người dùng có tồn tại trong danh sách OTP đã gửi hay ko
        OtpScheduleObj findingResetOtp = GlobalCache.OTP_SCHEDULE_OBJS.stream().filter(otpScheduleObj ->
                otpScheduleObj.getEmail().equals(nguoiDung.getEmail()) && otpScheduleObj.getType().equals(OtpType.RESET_PASSWORD)).findFirst().orElseThrow(
                () -> new CommonException("Mã xác nhận không tồn tại hoặc đã hết hạn")
        );

        if (!findingResetOtp.getOtp().equals(rpRequest.getOtp())) {
            throw new CommonException("Mã xác nhận không tồn tại hoặc đã hết hạn");
        }

        Instant now = Instant.now();
        //kiểm tra otp còn hạn hay không(trong vòng 5p)
        if (now.isAfter(findingResetOtp.getCreatedAt().plusSeconds(300))) {
            throw new CommonException("Mã xác nhận không tồn tại hoặc đã hết hạn");
        }

        //sau khi thoả mãn các dk trên thì cho phép đặt lại MK
        nguoiDung.setMatKhauHash(passwordEncoder.encode(rpRequest.getPassword()));

        //Xoá OTP của người dùng khỏi danh sách OTP trong bộ nhớ đệm
        GlobalCache.OTP_SCHEDULE_OBJS.remove(findingResetOtp);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()

        );
    }

    public Page<NguoiDung> getUserListByAdmin(Pageable pageable) {
        return nguoiDungRepository.findAll(pageable);
    }

    public NguoiDung getDetailByAdmin(Integer id) {
        NguoiDung nguoiDung = nguoiDungRepository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        //Lấy danh sách phân quyền kho
        List<PhanQuyenNguoiDungKho> dsPhanQuyen = phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(id);

        //Gán danh sách này vào trường @Transient vừa tạo
        if (dsPhanQuyen != null) {
            nguoiDung.setKhoPhuTrach(dsPhanQuyen);
        }

        return nguoiDung;
    }

    @Transactional
    public NguoiDung toggleStatusByAdmin(Integer userId) {

        //lay current id
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

        //lay id bi thao tac
        NguoiDung nguoiDung = nguoiDungRepository.findById(userId)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        //chan tu khoa
        if (nguoiDung.getId().equals(currentUserId)) {
            throw new CommonException("Không thể tự khóa tài khoản của chính mình");
        }

        //toggle trang thai
        if (nguoiDung.getTrangThai() != null && nguoiDung.getTrangThai() == 1) {
            nguoiDung.setTrangThai(0);
        } else {
            nguoiDung.setTrangThai(1);
        }

        nguoiDung.setNgayCapNhat(Instant.now());

        return nguoiDungRepository.save(nguoiDung);
    }


    @Transactional
    public void updateUserByAdmin(Integer userId, AdminUpdateRequest request) {

        NguoiDung nguoiDung = nguoiDungRepository.findById(userId)
                .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

        // reset password
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            nguoiDung.setMatKhauHash(
                    passwordEncoder.encode(request.getNewPassword())
            );
        }

        nguoiDung.setNgayCapNhat(Instant.now());
        nguoiDungRepository.save(nguoiDung);
    }


    @Transactional
    public NguoiDung createInternalUserByAdmin(NguoiDungCreating request) {

        if (nguoiDungRepository.existsByTenDangNhap(request.getTenDangNhap())) {
            throw new CommonException("Tên đăng nhập đã tồn tại");
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            if (nguoiDungRepository.existsByEmail(request.getEmail())) {
                throw new CommonException("Email đã tồn tại");
            }
        }

        // SĐT tùy chọn: blank -> null; có giá trị thì phải đúng định dạng rồi mới kiểm tra trùng
        String soDienThoai = normalizePhone(request.getSoDienThoai());
        validatePhone(soDienThoai);
        if (soDienThoai != null && nguoiDungRepository.existsBySoDienThoai(soDienThoai)) {
            throw new CommonException("Số điện thoại đã tồn tại");
        }

        NguoiDung nguoiDung = new NguoiDung();
        nguoiDung.setTenDangNhap(request.getTenDangNhap());
        nguoiDung.setEmail(
                request.getEmail() != null && !request.getEmail().isBlank()
                        ? request.getEmail()
                        : null
        );
        nguoiDung.setHoTen(request.getHoTen());
        nguoiDung.setSoDienThoai(soDienThoai);
        nguoiDung.setVaiTro(request.getVaiTro().toString());
        nguoiDung.setTrangThai(1);
        nguoiDung.setMatKhauHash(passwordEncoder.encode(request.getMatKhau()));

        return create(nguoiDung);
    }

    @Transactional
    public ResponseEntity<ResponseData<String>> changePassword(ChangePasswordRequest changePass) {
        // validate trước khi chạm tới passwordEncoder (tránh encode/matches null -> 500)
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

        // chỉ encode mật khẩu mới sau khi đã validate
        nguoiDung.setMatKhauHash(passwordEncoder.encode(changePass.getNewPassword().trim()));
        nguoiDung.setMustChangePassword(false);

        update(nguoiDung.getId(), nguoiDung);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Thay đổi mật khẩu thành công!")
                        .build()
        );
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

        nguoiDung.setMatKhauHash(passwordEncoder.encode(tempPassword));
        nguoiDung.setMustChangePassword(true);
        nguoiDung.setNgayCapNhat(Instant.now());
        nguoiDungRepository.save(nguoiDung);

        Map<String, Object> emailParams = new HashMap<>();
        emailParams.put("userName", nguoiDung.getHoTen() != null && !nguoiDung.getHoTen().isBlank()
                ? nguoiDung.getHoTen()
                : nguoiDung.getTenDangNhap());
        emailParams.put("temporaryPassword", tempPassword);

        emailService.sendHtmlEmailFromTemplate(
                nguoiDung.getEmail(),
                "Cấp lại mật khẩu tài khoản - Fashion Management",
                "admin_reset_password.html",
                emailParams
        );
    }
}


