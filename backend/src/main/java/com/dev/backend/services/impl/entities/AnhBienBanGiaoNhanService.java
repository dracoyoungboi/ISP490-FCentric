package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.MinioService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.KiemTraTepTai;
import com.dev.backend.utils.PublicAssetUrl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ảnh chụp đính kèm biên bản giao nhận (BBGN) của phiếu chuyển kho — mockup B.4: ô "Ảnh chụp", "Thêm ảnh (không bắt
 * buộc)". Đã chốt: một loại ảnh, mô tả ngắn tùy chọn; tối đa {@value #SO_ANH_TOI_DA} ảnh mỗi biên bản; ảnh JPEG / PNG /
 * WebP tới 10 MB (giao diện thu nhỏ về dưới 1 MB trước khi gửi); không in ảnh, không tự xóa ảnh.
 * <ul>
 *   <li>Xem: ai xem được chi tiết phiếu.</li>
 *   <li>Thêm: người thuộc kho nhận (quản trị viên luôn được), đang chọn đúng kho nhận như khi nhận hàng.</li>
 *   <li>Xóa: người tải ảnh lên, quản lý kho nhận hoặc quản trị viên.</li>
 *   <li>Thêm / xóa chỉ khi biên bản còn chờ xử lý chênh lệch; xử lý xong thì ảnh chỉ xem (409).</li>
 *   <li>Thêm / xóa kiểm người dùng thuộc kho nhận TRƯỚC khi tìm biên bản / ảnh và trước khi khóa dòng: người kho khác
 *   không khóa được dòng, câu 403 không nêu tên kho hay số biên bản.</li>
 * </ul>
 * Tệp tải lên MinIO NGOÀI giao dịch CSDL (không giữ giao dịch hay khóa dòng trong lúc chờ mạng). Lưu ý: open-in-view
 * đang bật (mặc định) nên EntityManager của request vẫn giữ kết nối CSDL đã lấy (từ bước kiểm trước) tới hết request,
 * kể cả lúc tải MinIO. Lưu dòng CSDL trong giao dịch riêng, khóa dòng biên bản rồi mới đếm số ảnh để hai lần tải cùng
 * lúc không vượt giới hạn. Lưu bị chặn / lỗi thì xóa tệp vừa tải. Xóa ảnh: xóa dòng ảnh + dòng tep_tin, commit xong mới
 * xóa tệp MinIO (lỗi MinIO chỉ ghi log).
 */
@Slf4j
@Service
public class AnhBienBanGiaoNhanService {

    public static final int SO_ANH_TOI_DA = 6;
    /** Máy chủ nhận ảnh tới 10 MB (nginx của giao diện đang giới hạn 1 MB mỗi yêu cầu nên giao diện thu nhỏ ảnh trước). */
    public static final long DUNG_LUONG_TOI_DA = 10L * 1024 * 1024;
    static final String THU_MUC_MINIO = "bien-ban-giao-nhan/";
    static final int MO_TA_TOI_DA = 255;

    private final PhieuChuyenKhoRepository phieuChuyenKhoRepository;
    private final BienBanGiaoNhanRepository bienBanGiaoNhanRepository;
    private final BienBanGiaoNhanAnhRepository anhRepository;
    private final TepTinRepository tepTinRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final MinioService minioService;
    /** Giao dịch ghi: READ_COMMITTED để lần đếm sau khi chờ khóa thấy ảnh lần tải kia vừa lưu. */
    private final TransactionTemplate giaoDich;
    private final TransactionTemplate giaoDichChiDoc;
    /**
     * Chỉ đọc, REQUIRES_NEW: đọc ảnh cho chi tiết phiếu tách khỏi giao dịch chỉ đọc của chi tiết, để lỗi SQL ở đây (vd.
     * chưa có bảng bien_ban_giao_nhan_anh) không đánh dấu rollback-only giao dịch đó.
     */
    private final TransactionTemplate giaoDichDocRieng;

    public AnhBienBanGiaoNhanService(PhieuChuyenKhoRepository phieuChuyenKhoRepository,
                                     BienBanGiaoNhanRepository bienBanGiaoNhanRepository,
                                     BienBanGiaoNhanAnhRepository anhRepository,
                                     TepTinRepository tepTinRepository,
                                     NguoiDungRepository nguoiDungRepository,
                                     PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository,
                                     LichSuThayDoiService lichSuThayDoiService,
                                     MinioService minioService,
                                     PlatformTransactionManager transactionManager) {
        this.phieuChuyenKhoRepository = phieuChuyenKhoRepository;
        this.bienBanGiaoNhanRepository = bienBanGiaoNhanRepository;
        this.anhRepository = anhRepository;
        this.tepTinRepository = tepTinRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.phanQuyenNguoiDungKhoRepository = phanQuyenNguoiDungKhoRepository;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.minioService = minioService;
        TransactionTemplate ghi = new TransactionTemplate(transactionManager);
        ghi.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.giaoDich = ghi;
        TransactionTemplate doc = new TransactionTemplate(transactionManager);
        doc.setReadOnly(true);
        this.giaoDichChiDoc = doc;
        TransactionTemplate docRieng = new TransactionTemplate(transactionManager);
        docRieng.setReadOnly(true);
        docRieng.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.giaoDichDocRieng = docRieng;
    }

    // ─────────────────────────────────────────────────────────────
    // THÊM / XÓA
    // ─────────────────────────────────────────────────────────────

    /** Thêm một ảnh vào biên bản giao nhận của phiếu chuyển {@code phieuId}; trả ảnh vừa thêm. */
    public PhieuChuyenKhoDto.AnhBienBan them(Integer phieuId, MultipartFile file, String moTa) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        // Nhận dạng theo byte đầu tệp, không theo tên / Content-Type client khai
        KiemTraTepTai.LoaiTep loai = KiemTraTepTai.batBuoc(file, KiemTraTepTai.ANH_CHUP, DUNG_LUONG_TOI_DA,
                "Ảnh biên bản", "ảnh JPEG, PNG hoặc WebP");
        String moTaGon = chuoiHoacNull(moTa);
        if (moTaGon != null && moTaGon.length() > MO_TA_TOI_DA) {
            throw new CommonException("Mô tả ảnh tối đa " + MO_TA_TOI_DA + " ký tự");
        }

        // 1. Chặn trước khi tải lên MinIO (không để tệp mồ côi khi chắc chắn bị từ chối); lúc lưu kiểm lại sau khi khóa.
        //    Quyền theo kho nhận kiểm trước khi tìm biên bản (người kho khác không biết phiếu có biên bản chưa)
        Integer bienBanId = giaoDichChiDoc.execute(s -> {
            kiemTraDuocThem(user, phieuCuaId(phieuId));
            BienBanGiaoNhan bb = bienBanCuaPhieu(phieuId);
            kiemTraChuaXuLy(bb, bb.getPhuongAnXuLy());
            kiemTraConCho(bb);
            return bb.getId();
        });

        // 2. Tải MinIO ngoài giao dịch CSDL; đuôi theo loại nội dung thật
        String objectName = THU_MUC_MINIO + bienBanId + "/" + UUID.randomUUID() + "." + loai.duoi;
        String url;
        try {
            minioService.upload(file, objectName);
            url = minioService.getPublicUrl(objectName);
        } catch (Exception e) {
            log.error("Lỗi tải ảnh biên bản {} lên MinIO: {}", bienBanId, e.getMessage(), e);
            throw new CommonException(HttpStatus.INTERNAL_SERVER_ERROR, "Không lưu được ảnh lên kho tệp, thử lại sau");
        }

        // 3. Lưu CSDL trong giao dịch thật. Bị chặn lúc lưu (vừa xử lý chênh lệch, đủ ảnh) hoặc lỗi CSDL: xóa tệp vừa tải
        try {
            return giaoDich.execute(s -> luuAnh(user, phieuId, bienBanId, file, objectName, url, loai, moTaGon));
        } catch (RuntimeException e) {
            xoaTepMinio(objectName, "lưu ảnh biên bản không thành");
            throw e;
        }
    }

    private PhieuChuyenKhoDto.AnhBienBan luuAnh(NguoiDungAuthInfo user, Integer phieuId, Integer bienBanId, MultipartFile file,
                                                String objectName, String url, KiemTraTepTai.LoaiTep loai, String moTa) {
        // Kiểm lại quyền trước khi khóa dòng biên bản
        PhieuChuyenKho phieu = phieuCuaId(phieuId);
        kiemTraDuocThem(user, phieu);
        BienBanGiaoNhan bb = bienBanGiaoNhanRepository.khoaTheoId(bienBanId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biên bản giao nhận id: " + bienBanId));
        // Đã giữ khóa dòng biên bản: đọc lại phương án và đếm ảnh theo dữ liệu mới nhất
        String phuongAn = bienBanGiaoNhanRepository.docPhuongAnXuLy(bienBanId);
        kiemTraChuaXuLy(bb, phuongAn);
        kiemTraConCho(bb);

        NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
        Instant bayGio = Instant.now();
        String tenGoc = file.getOriginalFilename() == null ? null : catNgan(file.getOriginalFilename(), 255);
        TepTin tep = tepTinRepository.save(TepTin.builder()
                .tenTepGoc(tenGoc)
                .tenTaiLen(tenGoc)
                .tenLuuTru(objectName)
                .duongDan(url)
                .loaiTepTin(FileType.IMAGE.toString())
                .duoiTep(loai.duoi)
                .kichCo((int) file.getSize())
                .moTa("Ảnh biên bản giao nhận " + bb.getSoBienBan())
                .ngayTao(bayGio)
                .build());
        BienBanGiaoNhanAnh anh = anhRepository.save(BienBanGiaoNhanAnh.builder()
                .bienBan(bb)
                .tepTin(tep)
                .moTa(moTa)
                .nguoiChup(nguoi)
                .ngayChup(bayGio)
                .build());
        ghiNhatKy(phieu, IHanhDong.them_anh_bien_ban, "Thêm ảnh vào biên bản " + bb.getSoBienBan()
                + (moTa != null ? ": " + moTa : ""), nguoi);
        return dto(anh, user, phieu, phuongAn);
    }

    /** Xóa ảnh {@code anhId} khỏi biên bản giao nhận của phiếu chuyển {@code phieuId}. */
    public void xoa(Integer phieuId, Integer anhId) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        String tenLuuTru = giaoDich.execute(s -> {
            // Người kho khác dừng ở đây: chưa tìm biên bản / ảnh, chưa khóa dòng; câu 403 không nêu tên kho, số biên bản
            PhieuChuyenKho phieu = phieuCuaId(phieuId);
            kiemTraThuocKhoNhan(user, phieu, "Chỉ người tải ảnh lên, quản lý kho nhận hoặc quản trị viên xóa được ảnh này");
            Integer bienBanId = bienBanCuaPhieu(phieuId).getId();
            BienBanGiaoNhan bb = bienBanGiaoNhanRepository.khoaTheoId(bienBanId)
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biên bản giao nhận id: " + bienBanId));
            BienBanGiaoNhanAnh anh = anhRepository.findById(anhId)
                    .filter(a -> a.getBienBan() != null && bienBanId.equals(a.getBienBan().getId()))
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND,
                            "Không tìm thấy ảnh này trong biên bản " + bb.getSoBienBan() + ". Tải lại trang để xem ảnh hiện có."));
            kiemTraDuocXoa(user, phieu, anh);
            kiemTraChuaXuLy(bb, bienBanGiaoNhanRepository.docPhuongAnXuLy(bienBanId));

            TepTin tep = anh.getTepTin();
            anhRepository.delete(anh);
            // Dòng ảnh trỏ tới tep_tin: xóa ảnh xuống CSDL trước rồi mới xóa dòng tệp
            anhRepository.flush();
            String ten = tep != null ? tep.getTenLuuTru() : null;
            if (tep != null) tepTinRepository.delete(tep);
            NguoiDung nguoi = nguoiDungRepository.findById(user.getId()).orElseThrow();
            ghiNhatKy(phieu, IHanhDong.xoa_anh_bien_ban, "Xóa ảnh khỏi biên bản " + bb.getSoBienBan()
                    + (anh.getMoTa() != null ? ": " + anh.getMoTa() : ""), nguoi);
            return ten;
        });
        // Giao dịch đã commit: xóa tệp trên MinIO; lỗi chỉ ghi log (tệp mồ côi không ảnh hưởng dữ liệu)
        if (tenLuuTru != null) xoaTepMinio(tenLuuTru, "xóa ảnh biên bản");
    }

    // ─────────────────────────────────────────────────────────────
    // ĐỌC (chi tiết phiếu chuyển)
    // ─────────────────────────────────────────────────────────────

    /**
     * Ảnh của biên bản cho chi tiết phiếu, kèm cờ người đang xem xóa được từng ảnh. Đọc ảnh trong giao dịch chỉ đọc RIÊNG
     * (REQUIRES_NEW): chưa chạy bước h của migration-2026-10-28-chuyen-kho-noi-bo.sql (chưa có bảng
     * bien_ban_giao_nhan_anh) hay lỗi SQL khác thì chỉ giao dịch riêng đó hoàn tác, ghi log warn và trả danh sách rỗng;
     * giao dịch của chi tiết phiếu không bị đánh dấu rollback-only nên màn chi tiết vẫn mở được.
     */
    public List<PhieuChuyenKhoDto.AnhBienBan> danhSach(BienBanGiaoNhan bb, PhieuChuyenKho phieu, NguoiDungAuthInfo user) {
        if (bb == null || bb.getId() == null) return List.of();
        List<BienBanGiaoNhanAnh> anh;
        try {
            // Truy vấn nạp sẵn tệp + người chụp: dựng dữ liệu trả về sau khi giao dịch riêng đóng vẫn không đọc LAZY
            anh = giaoDichDocRieng.execute(s -> anhRepository.danhSachTheoBienBan(bb.getId()));
        } catch (DataAccessException e) {
            log.warn("Không đọc được ảnh của biên bản {} (đã chạy bước h của migration-2026-10-28-chuyen-kho-noi-bo.sql chưa?): {}",
                    bb.getSoBienBan(), e.getMessage());
            return List.of();
        }
        if (anh == null) return List.of();
        return anh.stream()
                .map(a -> dto(a, user, phieu, bb.getPhuongAnXuLy()))
                .toList();
    }

    /**
     * Cờ quyen.themAnhBienBan: biên bản còn chờ xử lý và người xem thuộc kho nhận (quản trị viên luôn được). Kho đang
     * chọn và số ảnh đã có kiểm khi bấm, như các cờ khác của phiếu chuyển.
     */
    public boolean duocThem(NguoiDungAuthInfo user, PhieuChuyenKho phieu, BienBanGiaoNhan bb) {
        return bb != null && IChuyenKho.CHUA_XU_LY.equals(bb.getPhuongAnXuLy()) && thuocKho(user, phieu.getKhoNhap());
    }

    /** Người tải ảnh lên, quản lý kho nhận hoặc quản trị viên; biên bản còn chờ xử lý. */
    boolean duocXoa(NguoiDungAuthInfo user, PhieuChuyenKho phieu, BienBanGiaoNhanAnh anh, String phuongAn) {
        return IChuyenKho.CHUA_XU_LY.equals(phuongAn) && coQuyenXoa(user, phieu, anh);
    }

    private boolean coQuyenXoa(NguoiDungAuthInfo user, PhieuChuyenKho phieu, BienBanGiaoNhanAnh anh) {
        if (laQuanTri(user)) return true;
        if (user == null || !thuocKho(user, phieu.getKhoNhap())) return false;
        boolean laNguoiChup = anh.getNguoiChup() != null && user.getId() != null && user.getId().equals(anh.getNguoiChup().getId());
        return laNguoiChup || (user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_ly_kho));
    }

    // ─────────────────────────────────────────────────────────────
    // KIỂM TRA
    // ─────────────────────────────────────────────────────────────

    private PhieuChuyenKho phieuCuaId(Integer phieuId) {
        return phieuChuyenKhoRepository.findById(phieuId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu chuyển kho id: " + phieuId));
    }

    private BienBanGiaoNhan bienBanCuaPhieu(Integer phieuId) {
        return bienBanGiaoNhanRepository.findFirstByPhieuChuyenKho_IdOrderByIdDesc(phieuId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Phiếu chuyển chưa có biên bản giao nhận"));
    }

    /**
     * Người thuộc kho nhận (quản trị viên luôn được), đang chọn đúng kho nhận. Gọi TRƯỚC khi tìm biên bản / ảnh và trước
     * khi khóa dòng; {@code cauTuChoi} không nêu tên kho hay số biên bản (người kho khác có thể không xem được phiếu).
     */
    private void kiemTraThuocKhoNhan(NguoiDungAuthInfo user, PhieuChuyenKho phieu, String cauTuChoi) {
        if (!thuocKho(user, phieu.getKhoNhap())) {
            throw new CommonException(HttpStatus.FORBIDDEN, cauTuChoi);
        }
        KhoDangChon.kiemTra(phieu.getKhoNhap(), "Phiếu chuyển " + phieu.getSoPhieuChuyen());
    }

    private void kiemTraDuocThem(NguoiDungAuthInfo user, PhieuChuyenKho phieu) {
        kiemTraThuocKhoNhan(user, phieu, "Chỉ người thuộc kho nhận của phiếu chuyển thêm được ảnh vào biên bản giao nhận");
    }

    /** Sau {@link #kiemTraThuocKhoNhan}: người này thuộc kho nhận nên câu được nêu tên kho. */
    private void kiemTraDuocXoa(NguoiDungAuthInfo user, PhieuChuyenKho phieu, BienBanGiaoNhanAnh anh) {
        if (!coQuyenXoa(user, phieu, anh)) {
            throw new CommonException(HttpStatus.FORBIDDEN,
                    "Chỉ người tải ảnh lên, quản lý " + tenKho(phieu.getKhoNhap()) + " hoặc quản trị viên xóa được ảnh này");
        }
    }

    private static void kiemTraChuaXuLy(BienBanGiaoNhan bb, String phuongAn) {
        if (!IChuyenKho.CHUA_XU_LY.equals(phuongAn)) {
            throw new CommonException(HttpStatus.CONFLICT, "Biên bản " + bb.getSoBienBan()
                    + " đã xử lý chênh lệch, ảnh chỉ xem được, không thêm hay xóa");
        }
    }

    private void kiemTraConCho(BienBanGiaoNhan bb) {
        if (anhRepository.countByBienBan_Id(bb.getId()) >= SO_ANH_TOI_DA) {
            throw new CommonException(HttpStatus.CONFLICT, "Biên bản " + bb.getSoBienBan() + " đã đủ " + SO_ANH_TOI_DA
                    + " ảnh. Xóa bớt ảnh nếu cần thêm ảnh khác.");
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    private PhieuChuyenKhoDto.AnhBienBan dto(BienBanGiaoNhanAnh a, NguoiDungAuthInfo user, PhieuChuyenKho phieu, String phuongAn) {
        TepTin tep = a.getTepTin();
        return PhieuChuyenKhoDto.AnhBienBan.builder()
                .id(a.getId())
                .url(tep == null ? null : urlCongKhai(tep))
                .moTa(a.getMoTa())
                .nguoiChup(a.getNguoiChup() != null ? a.getNguoiChup().getHoTen() : null)
                .ngayChup(a.getNgayChup())
                .duocXoa(duocXoa(user, phieu, a, phuongAn))
                .build();
    }

    /** URL công khai HTTPS, như bằng chứng đóng gói: đường dẫn đã lưu, thiếu thì dựng từ tên đối tượng MinIO. */
    private String urlCongKhai(TepTin tep) {
        String duongDan = tep.getDuongDan();
        if (duongDan == null || !(duongDan.startsWith("http://") || duongDan.startsWith("https://"))) {
            duongDan = minioService.getPublicUrl(tep.getTenLuuTru());
        }
        return PublicAssetUrl.toHttps(duongDan);
    }

    private void xoaTepMinio(String objectName, String khi) {
        try {
            if (!minioService.delete(objectName)) {
                log.warn("Không xóa được tệp MinIO {} sau khi {}", objectName, khi);
            }
        } catch (Exception e) {
            log.warn("Không xóa được tệp MinIO {} sau khi {}: {}", objectName, khi, e.getMessage());
        }
    }

    private static boolean laQuanTri(NguoiDungAuthInfo user) {
        return user != null && user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien);
    }

    /** Như PhieuChuyenKhoService.thuocKho: quản trị viên, hoặc đang được phân công ở kho này. */
    private boolean thuocKho(NguoiDungAuthInfo user, Kho kho) {
        if (user == null || kho == null) return false;
        if (laQuanTri(user)) return true;
        return phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndActive(user.getId()).stream()
                .anyMatch(pq -> pq.getKho() != null && kho.getId().equals(pq.getKho().getId()));
    }

    private static String tenKho(Kho kho) {
        return kho != null && kho.getTenKho() != null ? kho.getTenKho() : "kho nhận";
    }

    private static String chuoiHoacNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String catNgan(String s, int toiDa) {
        return s.length() <= toiDa ? s : s.substring(0, toiDa);
    }

    /** Nhật ký của phiếu chuyển (cùng chỗ với các bước khác: loai_tham_chieu = phieu_chuyen_kho). */
    private void ghiNhatKy(PhieuChuyenKho p, String hanhDong, String ghiChu, NguoiDung nguoi) {
        try {
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.phieu_chuyen_kho)
                    .idThamChieu(p.getId())
                    .kho(p.getKhoXuat())
                    .hanhDong(hanhDong)
                    .ghiChu(catNgan(ghiChu, 1000))
                    .nguoiThucHien(nguoi)
                    .ngayThucHien(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("Lỗi ghi nhật ký ảnh biên bản của phiếu chuyển {}: {}", p.getSoPhieuChuyen(), e.getMessage());
        }
    }
}
