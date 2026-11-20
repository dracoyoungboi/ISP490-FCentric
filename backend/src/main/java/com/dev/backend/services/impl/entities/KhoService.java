package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;

import com.dev.backend.dto.request.KhoCreating;
import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.dto.response.KhoTomTatResponse;
import com.dev.backend.dto.response.NhanVienKhoTomTat;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.KhoTomTatRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.i18n.ThongDiep;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
public class KhoService extends BaseServiceImpl<Kho, Integer> {
    @Autowired
    private EntityManager entityManager;

    /** Chốt chặn dữ liệu chủ của kiểm kê khoanh vùng; null khi unit test dựng tay. */
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;

    /** Nhật ký nghiệp vụ (tạo / sửa / đổi trạng thái kho); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public KhoService(KhoRepository repository) {
        super(repository);
    }

    private KhoRepository khoRepository = (KhoRepository) getRepository();

    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private KhoMapper khoMapper;
    @Autowired
    private KhoTomTatRepository khoTomTatRepository;
    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    /** Ngưỡng sắp hết mặc định: cấu hình DEFAULT_MIN_STOCK_ALERT, chưa đặt thì dùng mặc định của Tổng quan. */
    private static final String CH_NGUONG_SAP_HET = "DEFAULT_MIN_STOCK_ALERT";

    /** Loại kho (cột kho.loai_kho). */
    public static final String KHO_TONG = "kho_tong";
    public static final String KHO_BAN_HANG = "cua_hang";
    /** Kho ảo chứa hàng đang chuyển giữa các kho. */
    private static final String MA_KHO_AO = "KHO_TRANSIT";

    /** Kho ảo KHO_TRANSIT (hàng đang chuyển giữa các kho). */
    public static boolean laKhoAo(Kho kho) {
        return kho != null && MA_KHO_AO.equalsIgnoreCase(kho.getMaKho());
    }

    public static boolean laKhoTong(Kho kho) {
        return kho != null && KHO_TONG.equals(kho.getLoaiKho());
    }

    /** Kho của chứng từ mới (chuyển kho, bán hàng...): phải tồn tại, đang hoạt động và không phải kho ảo. */
    public static void kiemTraKhoGiaoDich(Kho kho, String vaiTro) {
        if (kho == null) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoVaiTroKhongTonTai", vaiTroKho(vaiTro, false)));
        }
        if (laKhoAo(kho)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoVaiTroLaKhoAo", vaiTroKho(vaiTro, false)));
        }
        if (kho.getTrangThai() == null || kho.getTrangThai() != 1) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoNgungHoatDongKhongDungLam", kho.getTenKho(), vaiTroKho(vaiTro, true)));
        }
    }

    /** Tên vai trò kho trong câu lỗi (dịch được); vai trò lạ thì giữ nguyên chuỗi truyền vào. */
    private static final Map<String, String> KHOA_VAI_TRO_KHO = Map.of(
            "Kho bán hàng", "sanPhamMuaHang.vaiTroKhoBanHang",
            "Kho nhận hàng", "sanPhamMuaHang.vaiTroKhoNhanHang",
            "Kho xuất hàng", "sanPhamMuaHang.vaiTroKhoXuatHang",
            "Kho xuất", "sanPhamMuaHang.vaiTroKhoXuat",
            "Kho nhận", "sanPhamMuaHang.vaiTroKhoNhan");

    /** chuThuong: dạng chữ thường giữa câu (câu cũ dùng vaiTro.toLowerCase()). */
    private static Object vaiTroKho(String vaiTro, boolean chuThuong) {
        String khoa = vaiTro == null ? null : KHOA_VAI_TRO_KHO.get(vaiTro);
        if (khoa == null) return chuThuong ? vaiTro.toLowerCase() : vaiTro;
        return ThongDiep.of(chuThuong ? khoa + "Thuong" : khoa);
    }

    /** Bán tại quầy: kho giao dịch và không phải Kho tổng. */
    public static void kiemTraKhoBanTaiQuay(Kho kho) {
        kiemTraKhoGiaoDich(kho, "Kho bán hàng");
        if (laKhoTong(kho)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoTongKhongBanTaiQuay"));
        }
    }

    /** Nhập hàng từ nhà cung cấp: chỉ Kho tổng. Kho bán hàng nhận hàng bằng phiếu chuyển kho. */
    public static void kiemTraKhoNhapNcc(Kho kho) {
        kiemTraKhoGiaoDich(kho, "Kho nhận hàng");
        if (!laKhoTong(kho)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoChiKhoTongNhapNcc", kho.getTenKho()));
        }
    }

    /** Chỉ nhận kho_tong hoặc cua_hang; để trống thì dùng giá trị mặc định truyền vào. */
    private String chuanHoaLoaiKho(String loaiKho, String macDinh) {
        if (loaiKho == null || loaiKho.isBlank()) {
            return macDinh;
        }
        String giaTri = loaiKho.trim().toLowerCase();
        if (!KHO_TONG.equals(giaTri) && !KHO_BAN_HANG.equals(giaTri)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoLoaiKhongHopLe"));
        }
        return giaTri;
    }

    /** Kho ảo không làm Kho tổng được; hệ thống chỉ có một Kho tổng đang hoạt động. */
    private void kiemTraKhoTong(Integer khoId, String maKho, String loaiKho, Integer trangThai) {
        if (!KHO_TONG.equals(loaiKho)) {
            return;
        }
        if (MA_KHO_AO.equalsIgnoreCase(maKho)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoAoKhongLamKhoTong"));
        }
        if (trangThai == null || trangThai != 1) {
            return;
        }
        String jpql = "SELECT k FROM Kho k WHERE k.loaiKho = :loai AND k.trangThai = 1"
                + (khoId != null ? " AND k.id <> :id" : "");
        TypedQuery<Kho> query = entityManager.createQuery(jpql, Kho.class).setParameter("loai", KHO_TONG);
        if (khoId != null) {
            query.setParameter("id", khoId);
        }
        List<Kho> khoTongKhac = query.setMaxResults(1).getResultList();
        if (!khoTongKhac.isEmpty()) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoDaCoKhoTong", khoTongKhac.get(0).getTenKho()));
        }
    }

    @Transactional
    public ResponseEntity<ResponseData<KhoDto>> create(KhoCreating creating) {

        // Người quản lý chính phải đang làm việc tại kho (Kho.quanLy), mà kho mới chưa ai được phân quyền
        if (creating.getQuanLyId() != null) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoMoiChuaCoQuanLy"));
        }

        Optional<Kho> findingKho = khoRepository.findByMaKho(creating.getMaKho());
        if (findingKho.isPresent()) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoMaDaTonTai"));
        }
        String loaiKho = chuanHoaLoaiKho(creating.getLoaiKho(), KHO_BAN_HANG);
        kiemTraKhoTong(null, creating.getMaKho(), loaiKho, creating.getTrangThai());

        Kho kho = new Kho();
        kho.setLoaiKho(loaiKho);
        kho.setTenKho(creating.getTenKho());
        kho.setMaKho(creating.getMaKho());
        kho.setDiaChi(creating.getDiaChi());
        kho.setTrangThai(creating.getTrangThai());
        kho = create(kho);
        if (khoaKiemKeGuard != null) {
            khoaKiemKeGuard.taoMutex(kho.getId());
        }
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.kho, kho.getId(), IHanhDong.tao_kho)
                .ma(kho.getMaKho()).kho(kho.getId())
                .moi(anhKho(kho)));
        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDto(kho))
                        .message("Success")
                        .build()
        );
    }

    @Transactional
    public ResponseEntity<ResponseData<KhoDto>> update(KhoUpdating updating) {

        Optional<Kho> findingKho = khoRepository.findByMaKho(updating.getMaKho());
        if (findingKho.isPresent() && !findingKho.get().getId().equals(updating.getId())) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoMaDaTonTai"));
        }
        Kho kho = null;
        if (findingKho.isPresent()) {
            kho = findingKho.get();
        } else {
            Optional<Kho> findingUpdatingKho = getOne(updating.getId());
            if (findingUpdatingKho.isEmpty()){
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoKhongTimThay", updating.getId()));
            }
            kho = findingUpdatingKho.get();
        }
        String loaiKho = chuanHoaLoaiKho(updating.getLoaiKho(), kho.getLoaiKho() != null ? kho.getLoaiKho() : KHO_BAN_HANG);
        // Mã KHO_TRANSIT được dùng cố định trong nhiều câu SQL; đổi mã hay loại thì kho ảo mất vai trò (và lách được
        // quy tắc "luôn hoạt động" của kho ảo), nên kho ảo chỉ sửa được tên, địa chỉ (không có người quản lý).
        if (laKhoAo(kho) && (!MA_KHO_AO.equalsIgnoreCase(updating.getMaKho())
                || !Objects.equals(loaiKho, kho.getLoaiKho() != null ? kho.getLoaiKho() : KHO_BAN_HANG))) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoAoKhongDoiMaLoai"));
        }
        // Sửa thông tin không đổi trạng thái (trangThai trong payload bị bỏ qua): form mở từ trước còn giữ trạng thái cũ,
        // lưu form sẽ lặng lẽ đảo lại thao tác Ngừng / Cho phép hoạt động. Trạng thái chỉ đổi qua doiTrangThai.
        kiemTraKhoTong(kho.getId(), updating.getMaKho(), loaiKho, kho.getTrangThai());
        // Đổi loại kho (bán hàng ↔ kho tổng…) đổi luồng nhận đơn / đẩy tồn của kho: chờ đợt kiểm kê đang mở kết thúc
        if (khoaKiemKeGuard != null && !Objects.equals(loaiKho, kho.getLoaiKho() != null ? kho.getLoaiKho() : KHO_BAN_HANG)) {
            khoaKiemKeGuard.giuKho(kho.getId());
            khoaKiemKeGuard.kiemTraKho(kho.getId(), "đổi loại kho");
        }
        Map<String, Object> truoc = new LinkedHashMap<>(anhKho(kho));
        // Form chỉ đổi người quản lý khi ô đó đổi so với lúc mở form (quanLyIdBanDau); form mở từ trước mà không đụng ô
        // thì giữ người hiện tại, không lặng lẽ đặt lại người cũ (như trangThai ở trên).
        boolean doiQuanLy = false;
        if (!Objects.equals(updating.getQuanLyId(), updating.getQuanLyIdBanDau())) {
            // Khóa kho rồi đọc người quản lý chính bản mới nhất: hai quản trị viên đổi cùng lúc thì người sau thấy lựa chọn
            // của người trước và nhận 409, không lặng lẽ đè (ảnh lúc nạp kho có thể đã cũ)
            entityManager.lock(kho, LockModeType.PESSIMISTIC_WRITE);
            NguoiDung hienTai = quanLyChinhMoiNhat(kho.getId());
            Integer quanLyHienTai = hienTai == null ? null : hienTai.getId();
            truoc.put("quanLy", hienTai == null ? null : hienTai.getHoTen());
            doiQuanLy = !Objects.equals(updating.getQuanLyId(), quanLyHienTai);
            if (doiQuanLy && !Objects.equals(updating.getQuanLyIdBanDau(), quanLyHienTai)) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("sanPhamMuaHang.quanLyVuaDuocDoi", kho.getTenKho()));
            }
        }
        kho.setLoaiKho(loaiKho);
        kho.setMaKho(updating.getMaKho());
        kho.setTenKho(updating.getTenKho());
        kho.setDiaChi(updating.getDiaChi());
        kho = update(updating.getId(), kho);
        if (doiQuanLy) {
            datQuanLyChinh(kho, updating.getQuanLyId());
        }
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.kho, kho.getId(), IHanhDong.sua_kho)
                .ma(kho.getMaKho()).kho(kho.getId())
                .thayDoi(truoc, anhKho(kho)));

        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDto(kho))
                        .message("Success")
                        .build()
        );
    }

    /**
     * Đặt người quản lý chính (null = bỏ trống): gắn dấu la_quan_ly_kho cho dòng phân quyền của người đó TẠI KHO NÀY, bỏ dấu
     * mọi dòng khác của kho (kể cả dòng đã thu hồi / hết hạn, để dấu cũ không sống lại khi người đó được phân lại).
     * Người được chọn phải là quản lý kho đang hoạt động, có phân quyền hiệu lực tại kho; kho ảo không có người quản lý.
     * Khóa dòng kho để hai quản trị viên đổi cùng lúc không để lại hai dấu. Xong thì nạp lại kho (Kho.quanLy tính lúc đọc).
     */
    private void datQuanLyChinh(Kho kho, Integer nguoiDungId) {
        PhanQuyenNguoiDungKho pq = null;
        if (nguoiDungId != null) {
            if (laKhoAo(kho)) {
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoAoKhongCoQuanLy"));
            }
            NguoiDung nguoiDung = nguoiDungService.getOne(nguoiDungId)
                    .orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.nguoiDungKhongTimThay", nguoiDungId)));
            if (!IRoleType.quan_ly_kho.equals(nguoiDung.getVaiTro())) {
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.quanLyKhongPhaiQuanLyKho", nguoiDung.getHoTen()));
            }
            if (!Integer.valueOf(1).equals(nguoiDung.getTrangThai())) {
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.quanLyBiKhoa", nguoiDung.getHoTen()));
            }
            pq = phanQuyenNguoiDungKhoRepository.findHieuLucTai(nguoiDungId, Instant.now()).stream()
                    .filter(p -> p.getKho() != null && kho.getId().equals(p.getKho().getId()))
                    .findFirst()
                    .orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.quanLyChuaLamTaiKho",
                            nguoiDung.getHoTen(), kho.getTenKho())));
        }
        entityManager.flush();
        entityManager.lock(kho, LockModeType.PESSIMISTIC_WRITE);
        phanQuyenNguoiDungKhoRepository.boDauQuanLyChinhCuaKho(kho.getId());
        // Gắn dấu bằng câu UPDATE, không qua thực thể pq đang nạp: thực thể còn giữ giá trị dấu cũ, đặt lại cùng giá trị thì
        // Hibernate không ghi và dấu vừa bị câu trên xóa sẽ mất.
        if (pq != null) {
            phanQuyenNguoiDungKhoRepository.datDauQuanLyChinh(pq.getId());
        }
        entityManager.refresh(kho);
    }

    /**
     * Người quản lý chính hiện tại đọc bản mới nhất (gọi sau khi khóa dòng kho), cùng luật Kho.SQL_QUAN_LY_CHINH:
     * dòng mang dấu còn hiệu lực, tài khoản hoạt động, vai trò quản lý kho; nhiều dòng thì lấy dòng cấp trước.
     */
    private NguoiDung quanLyChinhMoiNhat(Integer khoId) {
        for (Object[] dong : phanQuyenNguoiDungKhoRepository.dauQuanLyChinhMoiNhat(khoId, Instant.now())) {
            NguoiDung nd = nguoiDungService.getOne(((Number) dong[1]).intValue()).orElse(null);
            if (nd != null && Integer.valueOf(1).equals(nd.getTrangThai()) && IRoleType.quan_ly_kho.equals(nd.getVaiTro())) {
                return nd;
            }
        }
        return null;
    }

    /** Quản lý kho chọn được làm người quản lý chính: đang hoạt động, có phân quyền hiệu lực tại kho (xếp theo họ tên). */
    @Transactional(readOnly = true)
    public List<NguoiDung> ungVienQuanLy(Integer khoId) {
        Kho kho = getOne(khoId).orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND,
                ThongDiep.of("sanPhamMuaHang.khoKhongTimThay", khoId)));
        if (laKhoAo(kho)) {
            return List.of();
        }
        return phanQuyenNguoiDungKhoRepository.nguoiDungTheoKhoVaVaiTroTai(khoId, Set.of(IRoleType.quan_ly_kho), Instant.now());
    }

    /** Kho ảo giữ hàng đang chuyển giữa các kho, ngừng nó thì phiếu chuyển đang đi không nhận được. */
    private static void kiemTraKhoAoLuonHoatDong(Kho kho, Integer trangThaiMoi) {
        if (laKhoAo(kho) && !Integer.valueOf(1).equals(trangThaiMoi)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.khoAoKhongNgungHoatDong"));
        }
    }

    /**
     * Ngừng hoạt động (0) / cho phép hoạt động lại (1). Tồn kho, lịch sử và chứng từ cũ giữ nguyên;
     * kho ngừng hoạt động chỉ không chọn được cho chứng từ mới (kiemTraKhoGiaoDich).
     * Cho phép lại một Kho tổng thì vẫn phải bảo đảm chỉ có một Kho tổng đang hoạt động.
     */
    @Transactional
    public Kho doiTrangThai(Integer id, Integer trangThai) {
        return doiTrangThai(id, trangThai, IHanhDong.doi_trang_thai_kho);
    }

    /** "Xóa" kho (DELETE soft-delete): chỉ là ngừng hoạt động, nhật ký ghi xoa_mem_kho để phân biệt với nút Ngừng. */
    @Transactional
    public Kho xoaMem(Integer id) {
        return doiTrangThai(id, 0, IHanhDong.xoa_mem_kho);
    }

    private Kho doiTrangThai(Integer id, Integer trangThai, String hanhDong) {
        if (trangThai == null || (trangThai != 0 && trangThai != 1)) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.trangThaiKhongHopLe"));
        }
        Kho kho = getOne(id).orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.khoKhongTimThay", id)));
        kiemTraKhoAoLuonHoatDong(kho, trangThai);
        if (trangThai.equals(kho.getTrangThai())) {
            return kho;
        }
        String loaiKho = kho.getLoaiKho() != null ? kho.getLoaiKho() : KHO_BAN_HANG;
        kiemTraKhoTong(kho.getId(), kho.getMaKho(), loaiKho, trangThai);
        if (khoaKiemKeGuard != null && Integer.valueOf(0).equals(trangThai)) {
            khoaKiemKeGuard.giuKho(kho.getId());
            khoaKiemKeGuard.kiemTraKho(kho.getId(), "ngừng hoạt động kho");
        }
        Integer trangThaiCu = kho.getTrangThai();
        kho.setTrangThai(trangThai);
        Kho daLuu = update(kho.getId(), kho);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.kho, daLuu.getId(), hanhDong)
                .ma(daLuu.getMaKho()).kho(daLuu.getId())
                .cu(NhatKyNghiepVu.anh("trangThai", trangThaiCu))
                .moi(NhatKyNghiepVu.anh("trangThai", trangThai)));
        return daLuu;
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    /** Ảnh chụp kho để so cũ / mới: quanLy là họ tên người quản lý. */
    private static Map<String, Object> anhKho(Kho kho) {
        return NhatKyNghiepVu.anh(
                "maKho", kho.getMaKho(),
                "tenKho", kho.getTenKho(),
                "loaiKho", kho.getLoaiKho(),
                "diaChi", kho.getDiaChi(),
                "quanLy", kho.getQuanLy() == null ? null : kho.getQuanLy().getHoTen(),
                "trangThai", kho.getTrangThai());
    }

    /** Số liệu tóm tắt cho popup Chi tiết kho; xem KhoTomTatRepository về cách tính. */
    @Transactional(readOnly = true)
    public KhoTomTatResponse tomTat(Integer khoId) {
        if (getOne(khoId).isEmpty()) {
            throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.khoKhongTimThay", khoId));
        }
        Integer cauHinh = khoTomTatRepository.cauHinhSoDuong(CH_NGUONG_SAP_HET);
        int nguong = cauHinh != null ? cauHinh : TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH;
        KhoTomTatRepository.TonKhoDong ton = khoTomTatRepository.tonKho(khoId, nguong);
        List<NhanVienKhoTomTat> nhanVien = khoTomTatRepository.nhanVienTaiKho(khoId);
        return new KhoTomTatResponse(
                khoId,
                tron(ton.ton()),
                tron(ton.khaDung()),
                tron(ton.dangGiu()),
                tron(ton.giaTri()),
                ton.soMaHang(),
                ton.soMaHetHang(),
                ton.soMaSapHet(),
                nguong,
                nhanVien.size(),
                nhanVien
        );
    }

    private static long tron(BigDecimal v) {
        return v == null ? 0L : v.setScale(0, RoundingMode.HALF_UP).longValue();
    }

}
