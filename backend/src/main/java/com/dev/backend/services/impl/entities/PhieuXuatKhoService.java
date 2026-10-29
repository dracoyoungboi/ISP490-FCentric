package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuXuatKhoCreating;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.response.customize.PhieuXuatKhoViewDto;
import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.dto.response.customize.TaoLaiPhieuXuatDto;
import com.dev.backend.dto.response.entities.*;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.utils.SoChungTu;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.XacNhanXuatKhoRequest;
import com.dev.backend.dto.response.customize.XacNhanXuatKhoResponse;
import com.dev.backend.event.DonHangXuatKhoEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
public class PhieuXuatKhoService extends BaseServiceImpl<PhieuXuatKho, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private ApplicationEventPublisher applicationEventPublisher;

    @Autowired
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    private PhieuNhapKhoRepository phieuNhapKhoRepository;

    @Autowired
    private LoHangRepository loHangRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private LoDangGiuService loDangGiuService;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private BangChungDongGoiService bangChungDongGoiService;

    @Autowired
    private DanhSachNhatHangRepository danhSachNhatHangRepository;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    @Autowired
    private SanPhamQuanAoService sanPhamQuanAoService;

    public PhieuXuatKhoService(PhieuXuatKhoRepository repository) {
        super(repository);
    }

    public Page<PhieuXuatKho> getDanhSachThucXuatCustom(List<Integer> khoIds, String keyword, Integer trangThai, String tenKho, org.springframework.data.domain.Pageable pageable) {
        return ((PhieuXuatKhoRepository) repository).findDanhSachThucXuat(khoIds, keyword, trangThai, tenKho, pageable);
    }

    /**
     * Phiếu xuất bán hàng KHÔNG còn tạo tay từ đơn bán: phiếu được sinh khi hoàn tất nhặt hàng, có sẵn lô của phiếu
     * nhặt. Đơn chưa nhặt thì gom vào phiếu nhặt ở màn Đơn chờ xuất; phiếu xuất bị hủy sau khi nhặt thì
     * {@link #taoLaiPhieuXuat(Integer)}.
     */
    public PhieuXuatKho createFromSO(PhieuXuatKhoCreating request) {
        throw new CommonException("Phiếu xuất bán hàng được tạo tự động khi hoàn tất nhặt hàng. Gom đơn vào phiếu nhặt ở màn "
                + "Đơn chờ xuất; phiếu xuất bị hủy sau khi nhặt thì bấm Tạo lại phiếu xuất ở màn đơn bán hàng.",
                HttpStatus.CONFLICT, null);
    }

    /**
     * Tạo lại phiếu xuất cho đơn đã nhặt xong mà phiếu xuất bị hủy (kho hủy tay): phần còn phải xuất của đơn, chép lô
     * của phiếu vừa hủy. Lô nào nay không còn đủ (nơi khác đã lấy) thì để trống, quản lý kho sửa lô trên phiếu mới.
     */
    @Transactional(rollbackFor = Exception.class)
    public TaoLaiPhieuXuatDto taoLaiPhieuXuat(Integer donBanHangId) {
        DonBanHang don = entityManager.find(DonBanHang.class, donBanHangId);
        if (don == null) {
            throw new CommonException("Đơn bán không tồn tại", HttpStatus.NOT_FOUND, null);
        }
        if (!"don_ban_hang".equals(don.getLoaiChungTu())) {
            throw new CommonException("Chỉ tạo phiếu xuất cho đơn bán hàng, không tạo từ báo giá", HttpStatus.CONFLICT, null);
        }
        Integer ttDon = don.getTrangThai();
        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(ttDon)) {
            throw new CommonException("Đơn bán đã bị hủy", HttpStatus.CONFLICT, null);
        }
        if (ttDon == null || (ttDon != ITrangThaiDonBanHang.CHO_NHAT_HANG && ttDon != ITrangThaiDonBanHang.DANG_XUAT_KHO)) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " không cần tạo lại phiếu xuất (đơn đang chờ đóng gói, "
                    + "chờ xuất hoặc đã xuất).", HttpStatus.CONFLICT, null);
        }
        DanhSachNhatHang phieuNhat = don.getDanhSachNhatHang();
        if (phieuNhat == null || !"da_nhat".equals(phieuNhat.getTrangThai())) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " chưa nhặt hàng xong. Gom đơn vào phiếu nhặt ở màn Đơn chờ xuất "
                    + "để nhặt; phiếu xuất sinh tự động khi hoàn tất nhặt.", HttpStatus.CONFLICT, null);
        }
        if (((PhieuXuatKhoRepository) repository).existsByDonBanHangIdAndTrangThaiIn(don.getId(),
                List.of(ITrangThaiPhieuXuat.NHAP, ITrangThaiPhieuXuat.CHO_XUAT))) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " đã có phiếu xuất đang chờ đóng gói / chờ xuất.",
                    HttpStatus.CONFLICT, null);
        }
        Kho kho = don.getKhoXuat();
        if (kho == null) {
            throw new CommonException("Đơn bán hàng này chưa được chỉ định kho xuất. Vui lòng liên hệ Sales.");
        }
        NguoiDungAuthInfo currentUser = kiemTraQuyenKho(kho);

        // Phần còn phải xuất theo biến thể: đặt − đã xuất thật
        Map<Integer, BigDecimal> datTheoBienThe = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> bienTheMap = new HashMap<>();
        for (ChiTietDonBanHang ct : chiTietDonBanHangRepository.findByDonBanHangId(don.getId())) {
            if (ct.getBienTheSanPham() == null || ct.getSoLuongDat() == null) continue;
            datTheoBienThe.merge(ct.getBienTheSanPham().getId(), ct.getSoLuongDat(), BigDecimal::add);
            bienTheMap.put(ct.getBienTheSanPham().getId(), ct.getBienTheSanPham());
        }
        Map<Integer, BigDecimal> canXuat = new LinkedHashMap<>();
        datTheoBienThe.forEach((bienTheId, dat) -> {
            BigDecimal daXuat = chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(don.getId(), bienTheId);
            BigDecimal con = dat.subtract(daXuat != null ? daXuat : BigDecimal.ZERO);
            if (con.signum() > 0) canXuat.put(bienTheId, con);
        });
        if (canXuat.isEmpty()) {
            throw new CommonException("Đơn bán đã xuất đủ toàn bộ sản phẩm");
        }

        // Lô của phiếu vừa hủy gần nhất (đã gồm chỗ quản lý kho sửa lô nếu có)
        List<ChiTietPhieuXuatKho> loCu = ((PhieuXuatKhoRepository) repository)
                .findByDonBanHangIdAndTrangThaiInOrderByIdDesc(don.getId(), List.of(ITrangThaiPhieuXuat.DA_HUY)).stream()
                .findFirst()
                .map(p -> chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(p.getId()).stream()
                        .sorted(Comparator.comparing(ChiTietPhieuXuatKho::getId)).toList())
                .orElse(List.of());

        Map<Integer, TonKhoTheoLo> tonTheoLo = new HashMap<>();
        loDangGiuService.khoaTonTheoBienThe(kho.getId(), canXuat.keySet())
                .forEach(t -> tonTheoLo.put(t.getLoHang().getId(), t));
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(kho.getId(), tonTheoLo.keySet(), null, null);

        PhieuXuatKho phieu = luuPhieuBanHangMoi(don, kho, "Tạo lại sau khi phiếu xuất trước bị hủy");
        List<String> canSuaLo = new ArrayList<>();
        for (Map.Entry<Integer, BigDecimal> e : canXuat.entrySet()) {
            BienTheSanPham bt = bienTheMap.get(e.getKey());
            entityManager.persist(ChiTietPhieuXuatKho.builder()
                    .phieuXuatKho(phieu)
                    .bienTheSanPham(bt)
                    .soLuongXuat(e.getValue())
                    .giaVon(bt.getGiaVon())
                    .ghiChu("Xuất theo đơn " + don.getSoDonHang())
                    .build());
            BigDecimal conThieu = e.getValue();
            for (ChiTietPhieuXuatKho cu : loCu) {
                if (conThieu.signum() <= 0) break;
                if (!e.getKey().equals(cu.getBienTheSanPham().getId())) continue;
                TonKhoTheoLo t = tonTheoLo.get(cu.getLoHang().getId());
                if (t == null) continue;
                BigDecimal lay = cu.getSoLuongXuat().min(LoDangGiuService.conLai(t, dangGiu)).min(conThieu);
                if (lay.signum() <= 0) continue;
                entityManager.persist(ChiTietPhieuXuatKho.builder()
                        .phieuXuatKho(phieu)
                        .bienTheSanPham(bt)
                        .loHang(cu.getLoHang())
                        .soLuongXuat(lay)
                        .giaVon(cu.getLoHang().getGiaVon())
                        .build());
                dangGiu.merge(cu.getLoHang().getId(), lay, BigDecimal::add);
                conThieu = conThieu.subtract(lay);
            }
            if (conThieu.signum() > 0) {
                canSuaLo.add(bt.getMaSku());
            }
        }

        // Có phiếu xuất nháp → đơn chờ đóng gói lại (Scan-to-Pack) trước khi xuất kho
        don.setTrangThai(ITrangThaiDonBanHang.CHO_DONG_GOI);
        don.setNgayCapNhat(Instant.now());

        Integer phieuId = phieu.getId();
        String soPhieu = phieu.getSoPhieuXuat();
        Integer nguoiId = currentUser.getId();
        String ghiChuNhatKy = "Tạo lại phiếu xuất cho đơn " + don.getSoDonHang()
                + (canSuaLo.isEmpty() ? "" : "; cần sửa lô: " + String.join(", ", canSuaLo));
        SauCommit.chay("Ghi nhật ký tạo lại phiếu xuất " + soPhieu, () -> lichSuThayDoiService.createGiaoDichRieng(
                LichSuThayDoi.builder()
                        .loaiThamChieu(ITable.phieu_xuat_kho)
                        .idThamChieu(phieuId)
                        .kho(kho)
                        .hanhDong(IHanhDong.tao_lai_phieu_xuat)
                        .giaTriMoi("trang_thai = 0 (Nháp)")
                        .nguoiThucHien(nguoiDungRepository.findById(nguoiId).orElse(null))
                        .ngayThucHien(Instant.now())
                        .ghiChu(ghiChuNhatKy)
                        .build()));

        return TaoLaiPhieuXuatDto.builder()
                .phieuXuatKhoId(phieuId)
                .soPhieuXuat(soPhieu)
                .canSuaLo(canSuaLo)
                .build();
    }

    /** Lưu phiếu xuất bán hàng Nháp mới cho đơn; số phiếu trùng (hai giao dịch đếm cùng lúc) thì thử lại. */
    private PhieuXuatKho luuPhieuBanHangMoi(DonBanHang don, Kho kho, String ghiChu) {
        int retry = 0;
        while (true) {
            try {
                PhieuXuatKho phieu = repository.save(PhieuXuatKho.builder()
                        .soPhieuXuat(generateSoPhieu())
                        .donBanHang(don)
                        .kho(kho)
                        .loaiXuat("ban_hang")
                        .trangThai(ITrangThaiPhieuXuat.NHAP)
                        .ghiChu(ghiChu)
                        .build());
                entityManager.flush();
                return phieu;
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                if (isDuplicateSoPhieu(ex) && retry++ < 5) {
                    continue;
                }
                throw ex;
            }
        }
    }

    /** Quản trị viên thao tác mọi kho; người khác phải được phân quyền kho này còn hiệu lực. Trả người đang thao tác. */
    private NguoiDungAuthInfo kiemTraQuyenKho(Kho kho) {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin) {
            PhanQuyenNguoiDungKho phanQuyen = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndKhoId(currentUser.getId(), kho.getId())
                    .orElseThrow(() -> new CommonException("Bạn không phụ trách kho [" + kho.getTenKho() +
                            "]. Không thể thực hiện xuất kho cho đơn hàng này."));
            if (phanQuyen.getTrangThai() != 1 ||
                    (phanQuyen.getNgayKetThuc() != null && phanQuyen.getNgayKetThuc().isBefore(Instant.now()))) {
                // Không viết "bị khóa": giao diện coi câu có cụm đó là tài khoản bị khóa và đăng xuất
                throw new CommonException("Quyền truy cập kho [" + kho.getTenKho() + "] của bạn đã hết hạn hoặc đã bị thu hồi.");
            }
        }
        return currentUser;
    }

    // Tên dùng trong câu báo lỗi kiểm kho
    private static String tenPhieu(PhieuXuatKho phieu) {
        return ("khac".equals(phieu.getLoaiXuat()) ? "Phiếu chuyển " : "Phiếu xuất ") + phieu.getSoPhieuXuat();
    }

    // Xem phiếu: người dùng thuộc kho của phiếu, hoặc kho đích nếu là phiếu của lệnh chuyển kho (hai bên đều xem được)
    private static void kiemTraXemPhieu(PhieuXuatKho phieu) {
        KhoDangChon.kiemTraXemMotTrong(phieu.getKho(), phieu.getKhoChuyenDen(), tenPhieu(phieu));
    }

    /** Phiếu theo id cho màn đọc (get-by-id): người dùng phải thuộc kho của phiếu. */
    public PhieuXuatKho layPhieuDuocXem(Integer id) {
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu xuất kho id: " + id));
        kiemTraXemPhieu(phieu);
        return phieu;
    }

    @Transactional(rollbackFor = Exception.class)
    public void complete(Integer id, Integer nguoiXuatId) {
        xacNhanXuatKho(id, null, nguoiXuatId);
    }

    @Transactional(rollbackFor = Exception.class)
    public XacNhanXuatKhoResponse xacNhanXuatKho(Integer id, XacNhanXuatKhoRequest request, Integer nguoiXuatId) {
        return xuatKho(id, request, nguoiXuatId, false);
    }

    /**
     * Xuất phiếu xuất con PX-CK của phiếu chuyển kho. Chỉ PhieuChuyenKhoService gọi, sau khi đã khóa phiếu chuyển và
     * kiểm người vận chuyển, phương tiện, số phiếu XKNB (BR-TRF-02); phiếu chuyển do bên gọi chuyển sang Đang vận chuyển.
     */
    @Transactional(rollbackFor = Exception.class)
    public void xuatPhieuXuatCon(Integer id, Integer nguoiXuatId) {
        xuatKho(id, null, nguoiXuatId, true);
    }

    private XacNhanXuatKhoResponse xuatKho(Integer id, XacNhanXuatKhoRequest request, Integer nguoiXuatId, boolean tuPhieuChuyen) {
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu xuất kho ID: " + id));
        // Trừ tồn kho của phiếu: phải thao tác từ đúng kho của phiếu
        KhoDangChon.kiemTra(phieu.getKho(), tenPhieu(phieu));

        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKho() != null;

        if (!"ban_hang".equals(phieu.getLoaiXuat()) && !isXuatChuyenKho) {
            throw new CommonException("Loại phiếu không hợp lệ để xuất kho");
        }
        // BR-TRF-02: hàng chuyển kho chỉ rời kho qua nút Xác nhận xuất của phiếu chuyển (ghi người chở, phương tiện, số XKNB)
        if (isXuatChuyenKho && !tuPhieuChuyen) {
            throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat() + " thuộc phiếu chuyển "
                    + phieu.getPhieuChuyenKho().getSoPhieuChuyen() + ". Xác nhận xuất ở màn Phiếu chuyển kho để ghi người "
                    + "vận chuyển và giấy đi đường.", HttpStatus.CONFLICT, null);
        }
        // Phiếu bán hàng phải đóng gói xong (6 - Chờ xuất); phiếu xuất chuyển kho xuất từ nháp (0).
        int trangThaiDuocXuat = isXuatChuyenKho ? ITrangThaiPhieuXuat.NHAP : ITrangThaiPhieuXuat.CHO_XUAT;
        if (phieu.getTrangThai() == null || phieu.getTrangThai() != trangThaiDuocXuat) {
            if (!isXuatChuyenKho && Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(phieu.getTrangThai())) {
                throw new CommonException("Phiếu xuất " + phieu.getSoPhieuXuat()
                        + " chưa đóng gói. Vui lòng đóng gói (Scan-to-Pack) trước khi xuất kho.", HttpStatus.CONFLICT, null);
            }
            throw new CommonException("Phiếu không ở trạng thái chờ xuất (trạng thái hiện tại: " + phieu.getTrangThai() + ")");
        }

        // Không xuất hàng cho đơn bán đã hủy (ví dụ đơn bị sàn hủy sau khi đã có phiếu xuất nháp).
        if ("ban_hang".equals(phieu.getLoaiXuat()) && phieu.getDonBanHang() != null) {
            if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(phieu.getDonBanHang().getTrangThai())) {
                throw new CommonException("Đơn " + phieu.getDonBanHang().getSoDonHang()
                        + " đã bị hủy nên không thể xuất kho. Vui lòng hủy phiếu xuất này.", HttpStatus.CONFLICT, null);
            }
            String ghiChu = phieu.getDonBanHang().getGhiChu();
            if (ghiChu != null && ghiChu.contains("[KHÁCH YÊU CẦU HỦY]")) {
                throw new CommonException("Đơn hàng " + phieu.getDonBanHang().getSoDonHang()
                        + " đang có cờ Khách yêu cầu hủy từ sàn. Không thể xuất kho để bảo toàn hàng hóa.", HttpStatus.CONFLICT, null);
            }
        }

        // Phiếu xuất con của phiếu chuyển: chỉ xuất khi phiếu chuyển còn Đã duyệt (bên gọi đã khóa dòng phiếu chuyển).
        // Không thì xuất xong sẽ đẩy hàng vào trung chuyển cho một phiếu đã hủy, không phiếu nhập nào nhận.
        if (isXuatChuyenKho) {
            PhieuChuyenKho pck = phieu.getPhieuChuyenKho();
            if (!IChuyenKho.DA_DUYET.equals(pck.getTrangThai())) {
                throw new CommonException("Phiếu chuyển " + pck.getSoPhieuChuyen()
                        + " không còn chờ xuất (đã hủy hoặc đã xuất).", HttpStatus.CONFLICT, null);
            }
        }

        validatePickedQuantity(id);
        NguoiDung nguoiXuat = nguoiDungRepository.findById(nguoiXuatId)
                .orElseThrow(() -> new CommonException("Không tìm thấy thông tin người xuất kho ID: " + nguoiXuatId));

        List<ChiTietPhieuXuatKho> detailedPicks = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(id);
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        // Khóa các dòng tồn sẽ ghi theo thứ tự PK ổn định (Quy tắc 8.1 - Ordered Pessimistic Locking)
        // để chống Lost Update và Deadlock khi xuất kho và bán quầy POS chạy đồng thời.
        List<Integer> variantIdsToLock = detailedPicks.stream()
                .map(pick -> pick.getBienTheSanPham().getId())
                .distinct()
                .toList();

        Kho khoTransit = null;
        if (isXuatChuyenKho) {
            khoTransit = entityManager.createQuery("SELECT k FROM Kho k WHERE k.maKho = 'KHO_TRANSIT'", Kho.class).getSingleResult();
            // Xuất chuyển kho còn cộng vào dòng trung chuyển của các lô đã nhặt, dòng mà nhận chuyển kho cùng lô trừ đi:
            // khóa chung với dòng tồn kho nguồn trong một câu, PK tăng dần (cùng thứ tự khóa toàn cục), không thì hai
            // bên ghi đè số của nhau
            List<Integer> loIds = detailedPicks.stream().map(pick -> pick.getLoHang().getId()).distinct().toList();
            List<Integer> idsCanKhoa = new ArrayList<>(
                    tonKhoTheoLoRepository.findIdsByKhoAndVariants(phieu.getKho().getId(), variantIdsToLock));
            if (!loIds.isEmpty()) {
                idsCanKhoa.addAll(tonKhoTheoLoRepository.findIdsByKhoAndLots(khoTransit.getId(), loIds));
            }
            if (!idsCanKhoa.isEmpty()) {
                tonKhoTheoLoRepository.lockLotsForUpdateByIds(idsCanKhoa.stream().distinct().sorted().toList());
            }
        } else {
            tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(phieu.getKho().getId(), variantIdsToLock);
        }

        for (ChiTietPhieuXuatKho pick : detailedPicks) {
            TonKhoTheoLo tonKho = tonKhoTheoLoRepository
                    .findByKho_IdAndLoHang_Id(phieu.getKho().getId(), pick.getLoHang().getId())
                    .orElseThrow(() -> new CommonException("Lỗi dữ liệu tồn kho lô: " + pick.getLoHang().getMaLo()));

            BigDecimal soLuongTruoc = tonKho.getSoLuongTon();
            BigDecimal soLuongXuat = pick.getSoLuongXuat();

            if (soLuongTruoc.compareTo(soLuongXuat) < 0) {
                throw new CommonException("Lô " + pick.getLoHang().getMaLo() + " không đủ tồn kho thực tế để xuất");
            }

            // Quy tắc 5: Trừ tồn kho vật lý On Hand
            tonKho.setSoLuongTon(soLuongTruoc.subtract(soLuongXuat));

            // Quy tắc 5: Giải phóng phần phiếu xuất chuyển kho đã giữ (soLuongDaDat). Phiếu bán hàng không cộng vào
            // soLuongDaDat (đơn giữ hàng qua lượng chờ xuất / phân bổ lô) nên không được trừ — trừ là ăn mất phần
            // chuyển kho / POS payOS đang giữ trên cùng lô.
            if (isXuatChuyenKho && tonKho.getSoLuongDaDat() != null && tonKho.getSoLuongDaDat().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal giamDaDat = soLuongXuat.min(tonKho.getSoLuongDaDat());
                tonKho.setSoLuongDaDat(tonKho.getSoLuongDaDat().subtract(giamDaDat));
            }

            if (isXuatChuyenKho) {
                if (khoTransit == null) throw new CommonException("Lỗi: Hệ thống chưa cấu hình KHO_TRANSIT.");

                TonKhoTheoLo tonTransit = tonKhoTheoLoRepository
                        .findByKho_IdAndLoHang_Id(khoTransit.getId(), pick.getLoHang().getId())
                        .orElse(TonKhoTheoLo.builder()
                                .kho(khoTransit).loHang(pick.getLoHang())
                                .soLuongTon(BigDecimal.ZERO).soLuongDaDat(BigDecimal.ZERO)
                                .build());
                BigDecimal tonTruocTransit = tonTransit.getSoLuongTon();
                tonTransit.setSoLuongTon(tonTruocTransit.add(soLuongXuat));
                tonTransit.setNgayNhapGanNhat(Instant.now());
                tonKhoTheoLoRepository.save(tonTransit);

                // Ghi nhận SỔ 1 (Thẻ kho) cho Kho Transit
                saveHistory(phieu, pick, khoTransit, "nhap_kho", "Hàng đang đi đường: " + phieu.getSoPhieuXuat(),
                        nguoiXuat, tonTruocTransit, tonTransit.getSoLuongTon());
            }

            tonKho.setNgayXuatGanNhat(Instant.now());
            tonKhoTheoLoRepository.save(tonKho);
            if (applicationEventPublisher != null && tonKho.getSoLuongTon().compareTo(BigDecimal.valueOf(3)) < 0) {
                applicationEventPublisher.publishEvent(new com.dev.backend.event.InventoryDeductedEvent(
                        this, pick.getBienTheSanPham().getId(), tonKho.getSoLuongTon(), phieu.getKho().getId()));
            }

            // SỔ 1: Thẻ kho vật lý (LichSuGiaoDichKho) cho kho xuất thực tế
            String historyNote = isXuatChuyenKho
                    ? "Xuất chuyển kho: " + phieu.getSoPhieuXuat()
                    : "Xuất kho cho phiếu: " + phieu.getSoPhieuXuat();
            if (request != null && request.getMaVanDon() != null && !request.getMaVanDon().isBlank()) {
                historyNote += " [Vận đơn: " + request.getMaVanDon().trim() + "]";
            }
            saveHistory(phieu, pick, phieu.getKho(), "xuat_kho", historyNote,
                    nguoiXuat, soLuongTruoc, tonKho.getSoLuongTon());

            sanPhamIdsCanCapNhat.add(pick.getBienTheSanPham().getSanPham().getId());
        }

        // Cập nhật trạng thái Phiếu xuất kho sang 3 (Đã xuất kho - SRS 6.3.2)
        phieu.setTrangThai(3);
        phieu.setNguoiXuat(nguoiXuat);
        phieu.setNgayXuat(Instant.now());

        // Ghi nhận thông tin vận đơn giao vận vào ghi chú phiếu xuất an toàn
        if (request != null) {
            StringBuilder sb = new StringBuilder(phieu.getGhiChu() != null ? phieu.getGhiChu() : "");
            boolean hasShipping = (request.getDonViVanChuyen() != null && !request.getDonViVanChuyen().isBlank())
                    || (request.getMaVanDon() != null && !request.getMaVanDon().isBlank());
            if (hasShipping) {
                if (!sb.isEmpty()) sb.append(" | ");
                sb.append("[Vận chuyển: ").append(request.getDonViVanChuyen() != null ? request.getDonViVanChuyen().trim() : "N/A")
                        .append(" - Vận đơn: ").append(request.getMaVanDon() != null ? request.getMaVanDon().trim() : "N/A");
                if (request.getPhiVanChuyenThucTe() != null) {
                    sb.append(" - Cước: ").append(request.getPhiVanChuyenThucTe());
                }
                sb.append("]");
            }
            if (request.getGhiChu() != null && !request.getGhiChu().isBlank()) {
                if (!sb.isEmpty()) sb.append(" - ");
                sb.append(request.getGhiChu().trim());
            }
            phieu.setGhiChu(sb.toString());
        }

        repository.save(phieu);

        entityManager.flush();

        // SỔ 2: Ghi nhận Kiểm toán hành vi (LichSuThayDoi - Quy tắc 7 AGENTS.md)
        String auditDetail = "trang_thai = 3 (Đã xuất)";
        if (request != null) {
            if (request.getDonViVanChuyen() != null && !request.getDonViVanChuyen().isBlank()) {
                auditDetail += " | ĐVVC: " + request.getDonViVanChuyen().trim();
            }
            if (request.getMaVanDon() != null && !request.getMaVanDon().isBlank()) {
                auditDetail += " | Vận đơn: " + request.getMaVanDon().trim();
            }
            if (request.getPhiVanChuyenThucTe() != null) {
                auditDetail += " | Cước: " + request.getPhiVanChuyenThucTe();
            }
        }
        try {
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.phieu_xuat_kho)
                            .idThamChieu(phieu.getId())
                            .kho(phieu.getKho())
                            .hanhDong(IHanhDong.xuat_kho)
                            .giaTriCu(isXuatChuyenKho ? "trang_thai = 0 (Nháp)" : "trang_thai = 6 (Chờ xuất - đã đóng gói)")
                            .giaTriMoi(auditDetail)
                            .nguoiThucHien(nguoiXuat)
                            .ngayThucHien(Instant.now())
                            .build()
            );
        } catch (Exception e) {
            log.warn("Lỗi ghi nhật ký kiểm toán cho phiếu xuất {}: {}", phieu.getSoPhieuXuat(), e.getMessage());
        }

        Integer donBanHangId = null;
        String soDonHang = null;
        Integer trangThaiDonHang = null;

        // Cập nhật trạng thái Đơn bán hàng và kích hoạt Omnichannel Push
        if ("ban_hang".equals(phieu.getLoaiXuat()) && phieu.getDonBanHang() != null) {
            DonBanHang don = phieu.getDonBanHang();
            donBanHangId = don.getId();
            soDonHang = don.getSoDonHang();

            if (request != null && request.getPhiVanChuyenThucTe() != null) {
                don.setPhiVanChuyen(request.getPhiVanChuyenThucTe());
            }

            updateTrangThaiDonBanHang(don.getId());
            trangThaiDonHang = don.getTrangThai();

            // Hạn lưu bằng chứng đóng gói tính từ ngày xuất kho (khiếu nại tính từ lúc khách nhận hàng)
            bangChungDongGoiService.giaHanLuuTu(don.getId(), phieu.getNgayXuat());

            // Phát sự kiện Push Trạng thái sang Sàn TMĐT (Shopify, Shopee...) chạy ngầm sau commit
            applicationEventPublisher.publishEvent(
                    DonHangXuatKhoEvent.builder()
                            .donBanHangId(don.getId())
                            .soDonHang(don.getSoDonHang())
                            .kenhBanId(don.getKenhBanHang() != null ? don.getKenhBanHang().getId() : null)
                            .maDonHangKenh(don.getMaDonHangKenh())
                            .donViVanChuyen(request != null ? request.getDonViVanChuyen() : null)
                            .maVanDon(request != null ? request.getMaVanDon() : null)
                            .phiVanChuyenThucTe(request != null ? request.getPhiVanChuyenThucTe() : null)
                            .build()
            );
        }

        for (Integer spId : sanPhamIdsCanCapNhat) {
            sanPhamQuanAoService.recalculatePriceAndStatus(spId);
        }

        return XacNhanXuatKhoResponse.builder()
                .phieuXuatKhoId(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .donBanHangId(donBanHangId)
                .soDonHang(soDonHang)
                .trangThaiPhieu(phieu.getTrangThai())
                .trangThaiDonHang(trangThaiDonHang)
                .donViVanChuyen(request != null ? request.getDonViVanChuyen() : null)
                .maVanDon(request != null ? request.getMaVanDon() : null)
                .phiVanChuyenThucTe(request != null ? request.getPhiVanChuyenThucTe() : null)
                .ngayXuat(phieu.getNgayXuat())
                .nguoiXuatTen(nguoiXuat.getHoTen())
                .message("Xác nhận xuất kho và điều phối giao vận thành công")
                .build();
    }

    private void updateTrangThaiDonBanHang(Integer donBanHangId) {
        DonBanHang don = entityManager.find(DonBanHang.class, donBanHangId);
        List<ChiTietDonBanHang> list = chiTietDonBanHangRepository.findByDonBanHangId(donBanHangId);

        boolean allZero = true;
        boolean allFull = true;
        for (ChiTietDonBanHang ct : list) {
            BigDecimal daXuatKho = chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(donBanHangId, ct.getBienTheSanPham().getId());

            if (daXuatKho == null) daXuatKho = BigDecimal.ZERO;

            if (daXuatKho.compareTo(BigDecimal.ZERO) > 0) {
                allZero = false;
            }
            if (daXuatKho.compareTo(ct.getSoLuongDat()) < 0) {
                allFull = false;
            }
        }
        if (allFull) {
            don.setTrangThai(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO); // 3: Toàn bộ hàng đã xuất kho -> Chuyển sang Đang giao hàng
            // Ghi nhận ngày giao (mốc ghi nhận doanh thu của Báo cáo doanh thu và màn Tổng quan) khi xuất đủ hàng
            if (don.getNgayGiaoHang() == null) {
                don.setNgayGiaoHang(Instant.now());
            }
        } else if (!allZero) {
            don.setTrangThai(ITrangThaiDonBanHang.DANG_XUAT_KHO); // 2: Có hàng đã xuất nhưng chưa đủ -> Đã xuất một phần
        } else {
            don.setTrangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG); // 1: Chưa có hàng nào xuất
        }
        entityManager.merge(don);
    }

    @Transactional
    public void cancel(Integer id) {
        PhieuXuatKho phieu = repository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));
        // Hủy tay từ màn phiếu xuất: phải thao tác từ đúng kho của phiếu (quyền huy_phieu_xuat kiểm theo kho đang chọn)
        KhoDangChon.kiemTra(phieu.getKho(), tenPhieu(phieu));
        // Yêu cầu chuyển kho có luồng hủy riêng (chặn phiếu đã hoàn tất, nhập hoàn trả): không hủy qua màn phiếu xuất.
        // Phiếu xuất con PX-CK hủy cùng phiếu chuyển (BA, A5): hủy riêng thì phiếu chuyển Đã duyệt mất phiếu xuất.
        if ("khac".equals(phieu.getLoaiXuat()) || phieu.getPhieuChuyenKho() != null) {
            throw new CommonException("Phiếu chuyển kho và phiếu xuất của nó hủy ở màn Phiếu chuyển kho");
        }
        huyPhieu(phieu);
    }

    /** Hủy phiếu xuất con PX-CK chưa xuất của phiếu chuyển bị hủy, nhả lô đang giữ. Chỉ PhieuChuyenKhoService gọi. */
    @Transactional
    public void huyPhieuXuatCon(PhieuXuatKho phieu) {
        huyPhieu(phieu);
    }

    // Hủy phiếu, không kiểm kho đang chọn: dùng chung cho hủy tay (đã kiểm ở cancel) và thu hồi theo đơn bị hủy
    // (người hủy đơn có thể đang chọn kho khác kho của phiếu)
    private void huyPhieu(PhieuXuatKho phieu) {
        Integer id = phieu.getId();
        if (phieu.getTrangThai() == 3) throw new RuntimeException("Phiếu đã xuất kho, không thể hủy");
        if (phieu.getTrangThai() == 4) throw new RuntimeException("Phiếu đã bị hủy trước đó");

        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKho() != null;

        // Hủy phiếu xuất con -> Nhả lại hàng đã giữ (da_dat); khóa dòng tồn của các lô theo thứ tự PK như mọi luồng ghi tồn
        if (isXuatChuyenKho && phieu.getTrangThai() == 0) {
            List<ChiTietPhieuXuatKho> oldPicks = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(id);
            List<Integer> loIds = oldPicks.stream().map(ct -> ct.getLoHang().getId()).distinct().toList();
            if (!loIds.isEmpty()) {
                tonKhoTheoLoRepository.lockLotsForUpdateByIds(
                        tonKhoTheoLoRepository.findIdsByKhoAndLots(phieu.getKho().getId(), loIds).stream().sorted().toList());
            }
            for (ChiTietPhieuXuatKho old : oldPicks) {
                tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(phieu.getKho().getId(), old.getLoHang().getId())
                        .ifPresent(t -> {
                            BigDecimal currentDaDat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
                            t.setSoLuongDaDat(currentDaDat.subtract(old.getSoLuongXuat()));
                            tonKhoTheoLoRepository.save(t);
                        });
            }
        }

        phieu.setTrangThai(4); // Đã hủy
        repository.save(phieu);

        // Hủy tay phiếu bán hàng đang chờ đóng gói / chờ xuất: đơn không còn phiếu mở thì quay về chờ kho xử lý
        // (tạo phiếu xuất mới từ màn đơn). Đơn đã hủy (gọi từ luồng hủy đơn) giữ nguyên.
        DonBanHang don = phieu.getDonBanHang();
        if ("ban_hang".equals(phieu.getLoaiXuat()) && don != null && don.getTrangThai() != null
                && (don.getTrangThai() == ITrangThaiDonBanHang.CHO_DONG_GOI || don.getTrangThai() == ITrangThaiDonBanHang.DA_DONG_GOI)
                && !((PhieuXuatKhoRepository) repository).existsByDonBanHangIdAndTrangThaiIn(don.getId(),
                        List.of(ITrangThaiPhieuXuat.NHAP, ITrangThaiPhieuXuat.CHO_XUAT))) {
            boolean daXuatMotPhan = ((PhieuXuatKhoRepository) repository).existsByDonBanHangIdAndTrangThai(don.getId(), ITrangThaiPhieuXuat.DA_XUAT);
            don.setTrangThai(daXuatMotPhan ? ITrangThaiDonBanHang.DANG_XUAT_KHO : ITrangThaiDonBanHang.CHO_NHAT_HANG);
            don.setNgayCapNhat(Instant.now());
        }
    }

    /** Số lượng của dòng đơn đã xuất thật (dòng lô của phiếu đã xuất). */
    private BigDecimal daXuatThucTe(Integer donBanHangId, ChiTietDonBanHang ct) {
        BigDecimal daXuat = chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(donBanHangId, ct.getBienTheSanPham().getId());
        return daXuat != null ? daXuat : BigDecimal.ZERO;
    }

    /**
     * Thu hồi phiếu xuất chưa xuất (0 Nháp / 6 Chờ xuất - đã đóng gói) của một đơn bán vừa bị hủy: đi qua đúng logic hủy
     * của {@link #cancel(Integer)} nên phiếu về 4 (Đã hủy), không phải 2 (Đã duyệt). Phiếu đã xuất (3) hoặc đã hủy (4) giữ nguyên.
     * Không kiểm kho đang chọn: người hủy đơn (bán hàng, đồng bộ sàn) có thể đang chọn kho khác kho của phiếu.
     * Chạy trong giao dịch của bên gọi (hủy đơn, hủy trong phiếu nhặt, đồng bộ sàn).
     *
     * @return số phiếu đã thu hồi
     */
    @Transactional
    public int huyPhieuXuatNhapTheoDon(Integer donBanHangId, String lyDo) {
        int soPhieu = 0;
        for (PhieuXuatKho phieu : ((PhieuXuatKhoRepository) repository).findByDonBanHangId(donBanHangId)) {
            if (phieu.getTrangThai() == null || (phieu.getTrangThai() != ITrangThaiPhieuXuat.NHAP
                    && phieu.getTrangThai() != ITrangThaiPhieuXuat.CHO_XUAT)) {
                continue;
            }
            String ghiChu = phieu.getGhiChu();
            phieu.setGhiChu((ghiChu != null && !ghiChu.isBlank() ? ghiChu + " | " : "") + lyDo);
            huyPhieu(phieu);
            soPhieu++;
        }
        return soPhieu;
    }

    /**
     * READ_COMMITTED: sau khi chờ khóa phiếu chuyển / phiếu xuất / dòng tồn, lần đọc phiếu nhặt và phần phiếu khác đang
     * giữ thấy bản vừa ghi xong (như PhieuChuyenKhoService.tao); REPEATABLE READ đọc ảnh chụp từ lần đọc đầu giao dịch.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void pickLoHang(Integer phieuXuatKhoId, PickLoHangRequest request) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));
        KhoDangChon.kiemTra(phieu.getKho(), tenPhieu(phieu));

        // 1. KIỂM TRA TRẠNG THÁI PHÙ HỢP
        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKho() != null;
        // Dòng phiếu chuyển cũ còn nằm trong phieu_xuat_kho (loai_xuat = 'khac', trước khi có bảng phieu_chuyen_kho)
        boolean isYeuCauChuyenKho = "khac".equals(phieu.getLoaiXuat());
        boolean isBanHang = "ban_hang".equals(phieu.getLoaiXuat());
        if (isXuatChuyenKho) {
            // Khóa phiếu chuyển rồi phiếu xuất (cùng thứ tự với Xác nhận xuất / Hủy ở PhieuChuyenKhoService) và đọc lại
            // trạng thái mới nhất: chọn lô chạy chồng với xuất hoặc hủy thì chờ, sau đó bị chặn ở kiểm tra dưới
            entityManager.refresh(phieu.getPhieuChuyenKho(), LockModeType.PESSIMISTIC_WRITE);
            entityManager.refresh(phieu, LockModeType.PESSIMISTIC_WRITE);
            if (phieu.getTrangThai() != 0) throw new RuntimeException("Chỉ được pick lô cho phiếu xuất chuyển kho ở trạng thái Nháp (0)");
            if (!IChuyenKho.DA_DUYET.equals(phieu.getPhieuChuyenKho().getTrangThai())) {
                throw new CommonException("Phiếu chuyển " + phieu.getPhieuChuyenKho().getSoPhieuChuyen()
                        + " không còn chờ xuất (đã hủy hoặc đã xuất)", HttpStatus.CONFLICT, null);
            }
            // PX-CK có phiếu nhặt chưa hủy (đặc tả bước 8–9): lô lấy theo phiếu nhặt, ghi vào phiếu xuất khi hoàn tất nhặt
            // — không chọn tay ở MỌI trạng thái của phiếu nhặt (đang nhặt: giữ cùng hàng hai lần; đã nhặt xong: lô chứng từ
            // lệch lô đã nhặt). Đường chọn lô tay chỉ còn cho PX-CK không có phiếu nhặt (phiếu duyệt trước bản phiếu nhặt).
            Optional<DanhSachNhatHang> phieuNhat = danhSachNhatHangRepository.findByPhieuXuatKho_Id(phieu.getId())
                    .filter(pl -> !"da_huy".equals(pl.getTrangThai()));
            if (phieuNhat.isPresent()) {
                String maPhieuNhat = phieuNhat.get().getMaPickList();
                throw new CommonException("da_nhat".equals(phieuNhat.get().getTrangThai())
                        ? "Phiếu xuất " + phieu.getSoPhieuXuat() + " đã nhận lô theo phiếu nhặt " + maPhieuNhat
                                + " (đã nhặt xong), không chọn lô tay."
                        : "Phiếu xuất " + phieu.getSoPhieuXuat() + " đang có phiếu nhặt " + maPhieuNhat
                                + " chưa hoàn tất. Lô được lấy theo phiếu nhặt khi bấm Hoàn tất nhặt, không chọn lô tay.",
                        HttpStatus.CONFLICT, null);
            }
        } else if (isBanHang) {
            // Lô của phiếu bán hàng lấy từ phân bổ ở phiếu nhặt; chỉ quản lý kho / quản trị viên sửa lô (lấy nhầm lô,
            // lô cũ không còn khi tạo lại phiếu) trước khi xuất kho.
            if (phieu.getTrangThai() != ITrangThaiPhieuXuat.NHAP && phieu.getTrangThai() != ITrangThaiPhieuXuat.CHO_XUAT) {
                throw new RuntimeException("Chỉ được sửa lô cho phiếu bán hàng chưa xuất kho (Nháp hoặc Chờ xuất)");
            }
            NguoiDungAuthInfo user = SecurityContextHolder.getUser();
            boolean laQuanLy = user != null && user.getVaiTro() != null && (user.getVaiTro().contains(IRoleType.quan_tri_vien)
                    || user.getVaiTro().contains(IRoleType.quan_ly_kho));
            if (!laQuanLy) {
                throw new CommonException("Lô của phiếu xuất bán hàng lấy từ phiếu nhặt. Chỉ quản lý kho hoặc quản trị viên "
                        + "được sửa lô.", HttpStatus.FORBIDDEN, null);
            }
        } else if (isYeuCauChuyenKho) {
            throw new RuntimeException("Không được pick lô trực tiếp trên phiếu yêu cầu. Vui lòng tạo Phiếu Xuất.");
        }

        ChiTietPhieuXuatKho ctGoc = chiTietPhieuXuatKhoRepository.findById(request.getChiTietPhieuXuatKhoId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy dòng phiếu xuất gốc"));

        if (ctGoc.getLoHang() != null) throw new RuntimeException("Vui lòng thực hiện pick lô từ dòng sản phẩm gốc");
        if (!phieuXuatKhoId.equals(ctGoc.getPhieuXuatKho().getId())) {
            throw new CommonException("Dòng sản phẩm không thuộc phiếu xuất này");
        }
        if (request.getLoHangPicks() == null) {
            throw new CommonException("Thiếu danh sách lô");
        }

        BigDecimal tongPickLanNay = request.getLoHangPicks().stream()
                .map(PickLoHangRequest.Item::getSoLuongXuat)
                .filter(sl -> sl != null && sl.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (tongPickLanNay.compareTo(ctGoc.getSoLuongXuat()) > 0) {
            throw new RuntimeException("Tổng số lượng bốc lô vượt quá số lượng yêu cầu");
        }
        Integer bienTheId = ctGoc.getBienTheSanPham().getId();
        String sku = ctGoc.getBienTheSanPham().getMaSku();
        if (isBanHang && tongPickLanNay.compareTo(ctGoc.getSoLuongXuat()) != 0) {
            throw new CommonException("Sửa lô phải đủ số lượng của dòng [" + sku + "]: tổng "
                    + tongPickLanNay.stripTrailingZeros().toPlainString() + ", cần "
                    + ctGoc.getSoLuongXuat().stripTrailingZeros().toPlainString() + " (không đổi số lượng phiếu)");
        }

        // Khóa dòng tồn của biến thể (thứ tự PK như mọi luồng ghi tồn) trước khi đọc / ghi
        Integer khoId = phieu.getKho().getId();
        Map<Integer, TonKhoTheoLo> tonTheoLo = new HashMap<>();
        loDangGiuService.khoaTonTheoBienThe(khoId, List.of(bienTheId)).forEach(t -> tonTheoLo.put(t.getLoHang().getId(), t));

        ghiLoChoBienThe(phieu, ctGoc.getBienTheSanPham(), tonTheoLo, request.getLoHangPicks(), null);

        if (isBanHang) {
            NguoiDungAuthInfo user = SecurityContextHolder.getUser();
            Integer phieuId = phieu.getId();
            Kho kho = phieu.getKho();
            String ghiChu = "Sửa lô dòng [" + sku + "] của phiếu xuất " + phieu.getSoPhieuXuat();
            SauCommit.chay("Ghi nhật ký sửa lô phiếu " + phieu.getSoPhieuXuat(), () -> lichSuThayDoiService.createGiaoDichRieng(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.phieu_xuat_kho)
                            .idThamChieu(phieuId)
                            .kho(kho)
                            .hanhDong(IHanhDong.sua_lo_phieu_xuat)
                            .nguoiThucHien(nguoiDungRepository.findById(user.getId()).orElse(null))
                            .ngayThucHien(Instant.now())
                            .ghiChu(ghiChu)
                            .build()));
        }
    }

    /**
     * Lõi ghi lô cho một biến thể của phiếu xuất, dùng chung cho Chọn lô / Sửa lô tay ({@link #pickLoHang}) và Hoàn tất
     * nhặt của phiếu chuyển kho (NhatHangServiceImpl): trả so_luong_da_dat của dòng lô cũ (PX-CK), xóa dòng lô cũ, kiểm
     * từng lô (đúng sản phẩm, có tồn ở kho, không vượt còn lại = tồn − đang giữ − phần phiếu nhặt mở / phiếu xuất bán khác
     * giữ), ghi dòng lô mới và cộng so_luong_da_dat (PX-CK: hàng chuyển kho giữ qua so_luong_da_dat tới khi xuất hoặc hủy;
     * phiếu bán không cộng). Bên gọi đã khóa phiếu chuyển → phiếu xuất và các dòng tồn của biến thể ({@code tonTheoLo},
     * khóa bằng LoDangGiuService.khoaTonTheoBienThe).
     *
     * @param boQuaPhieuNhatId phiếu nhặt không tính khi kiểm còn lại (phiếu nhặt đang chốt lô cho chính phiếu xuất này,
     *                         phân bổ của nó chuyển thành dòng lô); null = tính mọi phiếu nhặt đang mở
     */
    public void ghiLoChoBienThe(PhieuXuatKho phieu, BienTheSanPham bienThe, Map<Integer, TonKhoTheoLo> tonTheoLo,
                                List<PickLoHangRequest.Item> loHangPicks, Integer boQuaPhieuNhatId) {
        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKho() != null;
        Integer phieuXuatKhoId = phieu.getId();
        Integer khoId = phieu.getKho().getId();
        Integer bienTheId = bienThe.getId();
        String sku = bienThe.getMaSku();

        // 1. Trả so_luong_da_dat của dòng lô cũ (chỉ chuyển kho)
        if (isXuatChuyenKho) {
            List<ChiTietPhieuXuatKho> oldPicks = chiTietPhieuXuatKhoRepository
                    .findByPhieuXuatKhoIdAndBienTheSanPhamIdAndLoHangIsNotNull(phieuXuatKhoId, bienTheId);

            for (ChiTietPhieuXuatKho old : oldPicks) {
                TonKhoTheoLo t = tonTheoLo.get(old.getLoHang().getId());
                if (t != null) {
                    BigDecimal currentDaDat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
                    t.setSoLuongDaDat(currentDaDat.subtract(old.getSoLuongXuat()));
                    tonKhoTheoLoRepository.save(t);
                }
            }
        }

        // 2. Xóa các dòng lô cũ
        chiTietPhieuXuatKhoRepository.deletePickedByPhieuAndBienThe(phieuXuatKhoId, bienTheId);

        // Phần phiếu nhặt đang mở / phiếu xuất bán chưa xuất khác đang giữ (không tính chính phiếu này)
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId, tonTheoLo.keySet(), boQuaPhieuNhatId, phieuXuatKhoId);
        Set<Integer> loDaChon = new HashSet<>();

        // 3. Lưu dòng lô mới, cộng so_luong_da_dat nếu là chuyển kho
        for (PickLoHangRequest.Item item : loHangPicks) {
            if (item.getSoLuongXuat() == null || item.getSoLuongXuat().compareTo(BigDecimal.ZERO) <= 0) continue;
            if (item.getLoHangId() == null || !loDaChon.add(item.getLoHangId())) {
                throw new CommonException("Mỗi lô chỉ được chọn một lần");
            }

            LoHang loHang = loHangRepository.findById(item.getLoHangId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy lô hàng"));
            if (loHang.getBienTheSanPham() == null || !bienTheId.equals(loHang.getBienTheSanPham().getId())) {
                throw new CommonException("Lô " + loHang.getMaLo() + " không phải lô của sản phẩm [" + sku + "]");
            }

            TonKhoTheoLo tonKho = tonTheoLo.get(loHang.getId());
            if (tonKho == null) {
                throw new RuntimeException("Sản phẩm không có tồn kho trong lô đã chọn tại kho này");
            }

            // Còn lại = tồn − đang giữ − phần phiếu nhặt / phiếu xuất bán khác giữ (chuyển kho: lô cũ của chính
            // phiếu đã được trả khỏi so_luong_da_dat ở bước 1)
            BigDecimal conLai = LoDangGiuService.conLai(tonKho, dangGiu);
            if (item.getSoLuongXuat().compareTo(conLai) > 0) {
                throw new CommonException("Lô " + loHang.getMaLo() + " chỉ còn " + conLai.max(BigDecimal.ZERO).stripTrailingZeros().toPlainString()
                        + " có thể lấy (phần còn lại đang được phiếu khác giữ)", HttpStatus.CONFLICT, null);
            }

            // CHỈ CẬP NHẬT SO_LUONG_DA_DAT NẾU LÀ CHUYỂN KHO
            if (isXuatChuyenKho) {
                BigDecimal currentDaDat = tonKho.getSoLuongDaDat() != null ? tonKho.getSoLuongDaDat() : BigDecimal.ZERO;
                tonKho.setSoLuongDaDat(currentDaDat.add(item.getSoLuongXuat()));
                tonKhoTheoLoRepository.save(tonKho);
            }

            ChiTietPhieuXuatKho ctPick = ChiTietPhieuXuatKho.builder()
                    .phieuXuatKho(phieu)
                    .bienTheSanPham(bienThe)
                    .loHang(loHang)
                    .soLuongXuat(item.getSoLuongXuat())
                    .giaVon(loHang.getGiaVon())
                    .build();
            chiTietPhieuXuatKhoRepository.save(ctPick);
        }
    }

    private void validatePickedQuantity(Integer phieuId) {
        List<ChiTietPhieuXuatKho> gocList = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieuId);
        for (ChiTietPhieuXuatKho goc : gocList) {
            BigDecimal daPick = chiTietPhieuXuatKhoRepository.sumSoLuongDaPick(phieuId, goc.getBienTheSanPham().getId());
            if (daPick.compareTo(goc.getSoLuongXuat()) < 0) {
                throw new RuntimeException("Sản phẩm " + goc.getBienTheSanPham().getMaSku() + " chưa được pick đủ số lượng");
            }
        }
    }

    @Transactional(readOnly = true)
    public ChiTietPhieuNhapKhoResponse getDetail(Integer id) {
        PhieuXuatKho phieu = repository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu xuất kho"));
        kiemTraXemPhieu(phieu);

        // 1. Map Kho xuất
        KhoDto khoDto = (phieu.getKho() != null) ? KhoDto.builder()
                .id(phieu.getKho().getId())
                .tenKho(phieu.getKho().getTenKho())
                .maKho(phieu.getKho().getMaKho())
                .build() : null;

        // 2. Map Kho chuyển đến (nếu có)
        KhoDto khoChuyenDenDto = (phieu.getKhoChuyenDen() != null) ? KhoDto.builder()
                .id(phieu.getKhoChuyenDen().getId())
                .tenKho(phieu.getKhoChuyenDen().getTenKho())
                .maKho(phieu.getKhoChuyenDen().getMaKho())
                .build() : null;

        // 3. Map Đơn bán hàng
        DonBanHangDto donBanHangDto = (phieu.getDonBanHang() != null) ? DonBanHangDto.builder()
                .id(phieu.getDonBanHang().getId())
                .soDonHang(phieu.getDonBanHang().getSoDonHang()) // Lấy mã đơn hàng vào đây
                .build() : null;

        NguoiDungDto nguoiXuatDto = (phieu.getNguoiXuat() != null) ? NguoiDungDto.builder()
                .id(phieu.getNguoiXuat().getId())
                .hoTen(phieu.getNguoiXuat().getHoTen())
                .build() : null;

        NguoiDungDto nguoiDuyetDto = (phieu.getNguoiDuyet() != null) ? NguoiDungDto.builder()
                .id(phieu.getNguoiDuyet().getId())
                .hoTen(phieu.getNguoiDuyet().getHoTen())
                .build() : null;

        // Phiếu nhặt của PX-CK (mọi trạng thái, kể cả đã hủy): giao diện ẩn nút "Chọn lô" khi phiếu nhặt chưa hủy
        DanhSachNhatHang phieuNhat = phieu.getPhieuChuyenKho() != null
                ? danhSachNhatHangRepository.findByPhieuXuatKho_Id(phieu.getId()).orElse(null) : null;

        // 4. Build PhieuXuatKhoDto hoàn chỉnh
        PhieuXuatKhoDto phieuDto = PhieuXuatKhoDto.builder()
                .id(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .loaiXuat(phieu.getLoaiXuat())
                .donBanHang(donBanHangDto)
                .kho(khoDto)
                .khoChuyenDen(khoChuyenDenDto)
                .ngayXuat(phieu.getNgayXuat())
                .trangThai(phieu.getTrangThai())
                .ghiChu(phieu.getGhiChu())
                .nguoiXuat(nguoiXuatDto)
                .nguoiDuyet(nguoiDuyetDto)
                .ngayTao(phieu.getNgayTao())
                .ngayCapNhat(phieu.getNgayCapNhat())
                // Phiếu xuất con PX-CK: nút "Mở phiếu chuyển để xuất" và liên kết về phiếu chuyển
                .phieuChuyenKhoGocId(phieu.getPhieuChuyenKho() != null ? phieu.getPhieuChuyenKho().getId() : null)
                .soPhieuChuyenKhoGoc(phieu.getPhieuChuyenKho() != null ? phieu.getPhieuChuyenKho().getSoPhieuChuyen() : null)
                .phieuNhatId(phieuNhat != null ? phieuNhat.getId() : null)
                .maPhieuNhat(phieuNhat != null ? phieuNhat.getMaPickList() : null)
                .trangThaiPhieuNhat(phieuNhat != null ? phieuNhat.getTrangThai() : null)
                .build();

        List<ChiTietPhieuXuatKho> chiTietList = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());
        List<ChiTietPhieuXuatKhoDto> chiTietDtos = new ArrayList<>(chiTietList.stream().map(ct -> {
            BigDecimal soLuongDaPick = chiTietPhieuXuatKhoRepository.sumSoLuongDaPick(phieu.getId(), ct.getBienTheSanPham().getId());
            return toChiTietDto(ct, ct.getSoLuongXuat(), soLuongDaPick);
        }).toList());

        // 5. Biến thể chỉ có dòng đã pick mà không có dòng gốc (vd. phiếu xuất POS ghi thẳng
        // dòng theo lô): gộp các dòng pick theo biến thể thành 1 dòng hiển thị, SL cần xuất =
        // SL đã xuất thực tế. id = dòng pick đầu tiên để "Xem lô"/in phiếu tra được lô theo
        // biến thể; pickLoHang vẫn chặn dòng này vì loHang != null.
        Set<Integer> bienTheCoDongGoc = new HashSet<>();
        chiTietList.forEach(ct -> bienTheCoDongGoc.add(ct.getBienTheSanPham().getId()));

        Map<Integer, List<ChiTietPhieuXuatKho>> pickKhongCoGoc = new LinkedHashMap<>();
        chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNotNull(phieu.getId()).stream()
                .filter(ct -> !bienTheCoDongGoc.contains(ct.getBienTheSanPham().getId()))
                .sorted(Comparator.comparing(ChiTietPhieuXuatKho::getId))
                .forEach(ct -> pickKhongCoGoc
                        .computeIfAbsent(ct.getBienTheSanPham().getId(), k -> new ArrayList<>())
                        .add(ct));

        pickKhongCoGoc.values().forEach(picks -> {
            BigDecimal tongDaXuat = picks.stream()
                    .map(ChiTietPhieuXuatKho::getSoLuongXuat)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            chiTietDtos.add(toChiTietDto(picks.get(0), tongDaXuat, tongDaXuat));
        });

        return ChiTietPhieuNhapKhoResponse.builder().phieu(phieuDto).chiTiet(chiTietDtos).build();
    }

    private ChiTietPhieuXuatKhoDto toChiTietDto(ChiTietPhieuXuatKho ct, BigDecimal soLuongCanXuat, BigDecimal soLuongDaPick) {
        return ChiTietPhieuXuatKhoDto.builder()
                .id(ct.getId())
                .bienTheSanPhamId(ct.getBienTheSanPham().getId())
                .sku(ct.getBienTheSanPham().getMaSku())
                .tenBienThe(ct.getBienTheSanPham().getSanPham().getTenSanPham() + " / " + ct.getBienTheSanPham().getMauSac().getTenMau())
                .soLuongCanXuat(soLuongCanXuat)
                .soLuongDaPick(soLuongDaPick)
                .duSoLuong(soLuongDaPick.compareTo(soLuongCanXuat) >= 0)
                .tenSanPham(HienThiBienThe.tenSanPham(ct.getBienTheSanPham()))
                .sanPhamId(HienThiBienThe.sanPhamId(ct.getBienTheSanPham()))
                .tenMau(HienThiBienThe.tenMau(ct.getBienTheSanPham()))
                .maMauHex(HienThiBienThe.maMauHex(ct.getBienTheSanPham()))
                .kichCo(HienThiBienThe.kichCo(ct.getBienTheSanPham()))
                .anh(HienThiBienThe.anh(ct.getBienTheSanPham()))
                .build();
    }

    @Transactional(readOnly = true)
    public PhieuXuatKhoViewDto viewForSales(Integer id) {

        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu xuất"));

        NguoiDungAuthInfo user = SecurityContextHolder.getUser();

        // Nếu là sales thi chỉ được xem phiếu thuộc đơn mình tạo
        if (user.getVaiTro().contains(IRoleType.nhan_vien_ban_hang)) {
            if (phieu.getDonBanHang() == null ||
                    !phieu.getDonBanHang().getNguoiTao().getId().equals(user.getId())) {

                throw new AccessDeniedException("Không có quyền xem phiếu này");
            }
        } else {
            // vai trò kho: phải được phân quyền ở kho của phiếu
            kiemTraXemPhieu(phieu);
        }

        return PhieuXuatKhoViewDto.builder()
                .id(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .ngayXuat(phieu.getNgayXuat())
                .trangThai(phieu.getTrangThai())
                .ghiChu(phieu.getGhiChu())
                .tenKho(phieu.getKho().getTenKho())
                .soDonHang(phieu.getDonBanHang() != null ? phieu.getDonBanHang().getSoDonHang() : null) // PX-CK không có đơn bán
                .nguoiDuyet(phieu.getNguoiDuyet() != null ? phieu.getNguoiDuyet().getHoTen() : null)
                .nguoiXuat(phieu.getNguoiXuat() != null ? phieu.getNguoiXuat().getHoTen() : null)
                .build();
    }

    /**
     * Lô chọn được cho một dòng phiếu xuất, sắp FIFO. soLuongKhaDung = tồn − đang giữ − phần phiếu nhặt / phiếu xuất
     * bán khác giữ (không trừ phần của chính phiếu); lô chính phiếu đã chọn luôn có mặt để "Xem lô" / in phiếu tra tên.
     */
    @Transactional(readOnly = true)
    public List<TonKhoTheoLoDto> getAvailableLots(Integer phieuXuatKhoId, Integer bienTheSanPhamId) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));
        kiemTraXemPhieu(phieu);
        Integer khoId = phieu.getKho().getId();
        Map<Integer, BigDecimal> cuaPhieu = new HashMap<>();
        chiTietPhieuXuatKhoRepository.findPickedLots(phieuXuatKhoId, bienTheSanPhamId)
                .forEach(p -> cuaPhieu.put(p.getLoHangId(), p.getSoLuongDaPick()));
        // Phiếu xuất chuyển kho còn nháp: lô đã chọn của chính phiếu đang nằm trong so_luong_da_dat → trả lại cho phiếu này
        boolean cuaPhieuTrongDaDat = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKho() != null
                && Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(phieu.getTrangThai());

        List<TonKhoTheoLo> tonList = tonKhoTheoLoRepository.findByKhoAndBienThe(khoId, bienTheSanPhamId);
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId,
                tonList.stream().map(t -> t.getLoHang().getId()).toList(), null, phieuXuatKhoId);
        return tonList.stream()
                .map(t -> {
                    BigDecimal conLai = LoDangGiuService.conLai(t, dangGiu);
                    if (cuaPhieuTrongDaDat) {
                        conLai = conLai.add(cuaPhieu.getOrDefault(t.getLoHang().getId(), BigDecimal.ZERO));
                    }
                    return Map.entry(t, conLai.max(BigDecimal.ZERO));
                })
                .filter(e -> e.getValue().signum() > 0 || cuaPhieu.containsKey(e.getKey().getLoHang().getId()))
                .sorted(Map.Entry.comparingByKey(LoDangGiuService.FIFO))
                .map(e -> TonKhoTheoLoDto.builder()
                        .loHangId(e.getKey().getLoHang().getId())
                        .maLo(e.getKey().getLoHang().getMaLo())
                        .ngayNhapGanNhat(e.getKey().getNgayNhapGanNhat())
                        .soLuongKhaDung(e.getValue())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PickedLotDto> getPickedLots(Integer phieuXuatKhoId, Integer chiTietPhieuXuatKhoId) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));
        kiemTraXemPhieu(phieu);
        ChiTietPhieuXuatKho ct = chiTietPhieuXuatKhoRepository.findById(chiTietPhieuXuatKhoId).orElseThrow(() -> new RuntimeException("Không tìm thấy chi tiết"));
        if (ct.getPhieuXuatKho() == null || !phieuXuatKhoId.equals(ct.getPhieuXuatKho().getId())) {
            throw new CommonException("Dòng chi tiết không thuộc phiếu xuất này");
        }
        return chiTietPhieuXuatKhoRepository.findPickedLots(phieuXuatKhoId, ct.getBienTheSanPham().getId());
    }

    private String generateSoPhieu() {
        String prefix = "PX" + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        return SoChungTu.tiepTheo(prefix, ((PhieuXuatKhoRepository) repository).soDuoiLonNhat(prefix));
    }

    private boolean isDuplicateSoPhieu(Exception ex) {
        return ex.getMessage() != null && ex.getMessage().contains("uk_phieu_xuat_kho_so_phieu");
    }

    private void saveHistory(PhieuXuatKho p, ChiTietPhieuXuatKho pick, Kho kho, String type, String note, NguoiDung user, BigDecimal truoc, BigDecimal sau) {
        LichSuGiaoDichKho history = LichSuGiaoDichKho.builder()
                .ngayGiaoDich(Instant.now())
                .loaiGiaoDich(type)
                .loaiThamChieu("phieu_xuat_kho")
                .idThamChieu(p.getId())
                .bienTheSanPham(pick.getBienTheSanPham())
                .loHang(pick.getLoHang())
                .kho(kho)
                .soLuong(pick.getSoLuongXuat())
                .soLuongTruoc(truoc)
                .soLuongSau(sau)
                .giaVon(pick.getLoHang().getGiaVon())
                .nguoiDung(user)
                .ghiChu(note)
                .build();
        lichSuGiaoDichKhoRepository.save(history);
    }
    @Transactional(readOnly = true)
    public com.dev.backend.dto.response.customize.ScanToPackResultDto scanToPack(String barcode) {
        if (!org.springframework.util.StringUtils.hasText(barcode)) {
            throw new CommonException("Mã barcode hoặc số phiếu xuất / đơn hàng không được để trống");
        }
        String cleanBarcode = barcode.trim();

        // 1. Tìm phiếu xuất kho theo số phiếu xuất hoặc mã đơn hàng
        PhieuXuatKho phieu = ((PhieuXuatKhoRepository) repository).findBySoPhieuXuat(cleanBarcode).orElse(null);

        if (phieu == null) {
            Optional<DonBanHang> donOpt = donBanHangRepository.findBySoDonHang(cleanBarcode);
            if (donOpt.isEmpty()) {
                donOpt = donBanHangRepository.findByMaDonHangKenh(cleanBarcode);
            }
            if (donOpt.isPresent()) {
                List<PhieuXuatKho> list = ((PhieuXuatKhoRepository) repository).findByDonBanHangId(donOpt.get().getId());
                if (!list.isEmpty()) {
                    phieu = list.stream()
                            .filter(p -> p.getTrangThai() != null && (p.getTrangThai() == ITrangThaiPhieuXuat.NHAP
                                    || p.getTrangThai() == ITrangThaiPhieuXuat.CHO_XUAT))
                            .findFirst()
                            .orElse(list.get(0));
                } else {
                    DonBanHang don = donOpt.get();
                    // không báo trạng thái đơn của kho người dùng không thuộc
                    KhoDangChon.kiemTraXem(don.getKhoXuat(), "Đơn " + don.getSoDonHang());
                    if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
                        throw new CommonException("ĐƠN HÀNG " + don.getSoDonHang() + " ĐÃ BỊ HỦY! Không có phiếu xuất kho để đóng gói.", HttpStatus.CONFLICT, null);
                    }
                    throw new CommonException("Đơn hàng " + don.getSoDonHang() + " chưa được tạo phiếu xuất kho");
                }
            }
        }

        if (phieu == null) {
            throw new CommonException("Không tìm thấy phiếu xuất kho hoặc đơn hàng khớp với mã [" + cleanBarcode + "]");
        }
        kiemTraXemPhieu(phieu);

        DonBanHang don = phieu.getDonBanHang();
        Integer donStatus = don != null ? don.getTrangThai() : null;
        Integer phieuStatus = phieu.getTrangThai();

        // 2. Chặn Scan-to-Pack khi đơn hàng bị hủy hoặc phiếu bị hủy (SRS 6.3.2)
        boolean isOrderCancelled = Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(donStatus);
        boolean isPhieuCancelled = Integer.valueOf(4).equals(phieuStatus); // 4: Đã hủy (2 là Đã duyệt)

        if (isOrderCancelled || isPhieuCancelled) {
            List<com.dev.backend.dto.response.customize.ScanToPackResultDto.ItemPackDto> returnItems = new ArrayList<>();
            if (don != null) {
                List<ChiTietDonBanHang> ctdList = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
                for (ChiTietDonBanHang ctd : ctdList) {
                    BienTheSanPham bt = ctd.getBienTheSanPham();
                    returnItems.add(com.dev.backend.dto.response.customize.ScanToPackResultDto.ItemPackDto.builder()
                            .bienTheId(bt != null ? bt.getId() : null)
                            .maSku(bt != null ? bt.getMaSku() : null)
                            .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : (bt != null ? bt.getMaSku() : "N/A"))
                            .tenMau(bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "")
                            .tenSize(bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : "")
                            .soLuong(ctd.getSoLuongDat() != null ? ctd.getSoLuongDat() : BigDecimal.ZERO)
                            .build());
                }
            }

            String alertMsg = "ĐƠN HÀNG ĐÃ BỊ HỦY! Hệ thống đã khóa đóng gói. Vui lòng chuyển toàn bộ hàng của đơn này vào Thùng gom hàng hoàn kệ (Return-to-stock) tại bàn đóng gói.";

            com.dev.backend.dto.response.customize.ScanToPackResultDto cancelDto = com.dev.backend.dto.response.customize.ScanToPackResultDto.builder()
                    .phieuXuatKhoId(phieu.getId())
                    .soPhieuXuat(phieu.getSoPhieuXuat())
                    .donBanHangId(don != null ? don.getId() : null)
                    .soDonHang(don != null ? don.getSoDonHang() : null)
                    .maDonHangKenh(don != null ? don.getMaDonHangKenh() : null)
                    .trangThaiPhieu(phieuStatus)
                    .trangThaiDonHang(donStatus)
                    .biHuy(true)
                    .thongBaoCanhBao(alertMsg)
                    .items(returnItems)
                    .build();

            throw new CommonException(alertMsg, HttpStatus.CONFLICT, cancelDto);
        }

        // 3. Trả về thông tin hợp lệ
        List<com.dev.backend.dto.response.customize.ScanToPackResultDto.ItemPackDto> packItems = new ArrayList<>();
        List<ChiTietPhieuXuatKho> details = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(phieu.getId());
        for (ChiTietPhieuXuatKho ct : details) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            packItems.add(com.dev.backend.dto.response.customize.ScanToPackResultDto.ItemPackDto.builder()
                    .bienTheId(bt != null ? bt.getId() : null)
                    .maSku(bt != null ? bt.getMaSku() : null)
                    .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : (bt != null ? bt.getMaSku() : "N/A"))
                    .tenMau(bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "")
                    .tenSize(bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : "")
                    .soLuong(ct.getSoLuongXuat() != null ? ct.getSoLuongXuat() : BigDecimal.ZERO)
                    .build());
        }

        String tenKh = don != null && don.getKhachHang() != null ? don.getKhachHang().getTenKhachHang() : "Khách lẻ";
        String sdt = don != null && don.getKhachHang() != null ? don.getKhachHang().getSoDienThoai() : null;
        String diaChi = don != null ? don.getDiaChiGiaoHang() : null;

        return com.dev.backend.dto.response.customize.ScanToPackResultDto.builder()
                .phieuXuatKhoId(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .donBanHangId(don != null ? don.getId() : null)
                .soDonHang(don != null ? don.getSoDonHang() : null)
                .maDonHangKenh(don != null ? don.getMaDonHangKenh() : null)
                .tenKhachHang(tenKh)
                .diaChiGiaoHang(diaChi)
                .soDienThoai(sdt)
                .trangThaiPhieu(phieuStatus)
                .trangThaiDonHang(donStatus)
                .biHuy(false)
                .thongBaoCanhBao(null)
                .items(packItems)
                .build();
    }
}