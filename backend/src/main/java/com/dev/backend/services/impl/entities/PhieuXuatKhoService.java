package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.request.PhieuXuatKhoCreating;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.response.customize.PhieuXuatKhoViewDto;
import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.dto.response.customize.TaoLaiPhieuXuatDto;
import com.dev.backend.dto.response.customize.TransferDetailDto;
import com.dev.backend.dto.response.entities.*;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.dev.backend.utils.SauCommit;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
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

    public Page<PhieuXuatKho> getDanhSachYeuCauChuyenKhoCustom(Integer khoId, String keyword, Integer trangThai, String khoNhapTen, org.springframework.data.domain.Pageable pageable) {
        return ((PhieuXuatKhoRepository) repository).findDanhSachYeuCauChuyenKho(khoId, keyword, trangThai, khoNhapTen, pageable);
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
                throw new CommonException("Quyền truy cập kho [" + kho.getTenKho() + "] của bạn đã hết hạn hoặc bị khóa.");
            }
        }
        return currentUser;
    }

    @Transactional(rollbackFor = Exception.class)
    public void complete(Integer id, Integer nguoiXuatId) {
        xacNhanXuatKho(id, null, nguoiXuatId);
    }

    @Transactional(rollbackFor = Exception.class)
    public XacNhanXuatKhoResponse xacNhanXuatKho(Integer id, XacNhanXuatKhoRequest request, Integer nguoiXuatId) {
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu xuất kho ID: " + id));

        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() != null;

        if (!"ban_hang".equals(phieu.getLoaiXuat()) && !isXuatChuyenKho) {
            throw new CommonException("Loại phiếu không hợp lệ để xuất kho");
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
        if ("ban_hang".equals(phieu.getLoaiXuat()) && phieu.getDonBanHang() != null
                && Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(phieu.getDonBanHang().getTrangThai())) {
            throw new CommonException("Đơn " + phieu.getDonBanHang().getSoDonHang()
                    + " đã bị hủy nên không thể xuất kho. Vui lòng hủy phiếu xuất này.", HttpStatus.CONFLICT, null);
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
        tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(phieu.getKho().getId(), variantIdsToLock);

        Kho khoTransit = null;
        if (isXuatChuyenKho) {
            khoTransit = entityManager.createQuery("SELECT k FROM Kho k WHERE k.maKho = 'KHO_TRANSIT'", Kho.class).getSingleResult();
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

        // Nếu là xuất chuyển kho: Đẩy trạng thái phiếu chuyển gốc sang 3 (Đang vận chuyển)
        if (isXuatChuyenKho) {
            PhieuXuatKho pck = phieu.getPhieuChuyenKhoGoc();
            pck.setTrangThai(3);
            pck.setNgayXuat(Instant.now());
            repository.save(pck);
        }

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
        if (phieu.getTrangThai() == 3) throw new RuntimeException("Phiếu đã xuất kho, không thể hủy");
        if (phieu.getTrangThai() == 4) throw new RuntimeException("Phiếu đã bị hủy trước đó");

        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() != null;

        // Hủy phiếu xuất con -> Nhả lại hàng đã giữ (da_dat)
        if (isXuatChuyenKho && phieu.getTrangThai() == 0) {
            List<ChiTietPhieuXuatKho> oldPicks = chiTietPhieuXuatKhoRepository.findAll().stream()
                    .filter(ct -> ct.getPhieuXuatKho().getId().equals(id) && ct.getLoHang() != null).toList();
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
     * Thu hồi phiếu xuất chưa xuất (0 Nháp / 6 Chờ xuất - đã đóng gói) của một đơn bán vừa bị hủy: đi qua đúng
     * {@link #cancel(Integer)} nên phiếu về 4 (Đã hủy), không phải 2 (Đã duyệt). Phiếu đã xuất (3) hoặc đã hủy (4) giữ nguyên.
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
            cancel(phieu.getId());
            soPhieu++;
        }
        return soPhieu;
    }

    @Transactional
    public void pickLoHang(Integer phieuXuatKhoId, PickLoHangRequest request) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));

        // 1. KIỂM TRA TRẠNG THÁI PHÙ HỢP
        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() != null;
        boolean isYeuCauChuyenKho = "khac".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() == null;
        boolean isBanHang = "ban_hang".equals(phieu.getLoaiXuat());
        if (isXuatChuyenKho) {
            if (phieu.getTrangThai() != 0) throw new RuntimeException("Chỉ được pick lô cho phiếu xuất chuyển kho ở trạng thái Nháp (0)");
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

        // 2. RẼ NHÁNH HOÀN LẠI SO_LUONG_DA_DAT (Chỉ áp dụng cho Chuyển kho)
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

        // 3. Xóa các dòng pick cũ
        chiTietPhieuXuatKhoRepository.deletePickedByPhieuAndBienThe(phieuXuatKhoId, bienTheId);

        // Phần phiếu nhặt đang mở / phiếu xuất bán chưa xuất khác đang giữ (không tính chính phiếu này)
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId, tonTheoLo.keySet(), null, phieuXuatKhoId);
        Set<Integer> loDaChon = new HashSet<>();

        // 4. LƯU PICK MỚI VÀ RẼ NHÁNH CẬP NHẬT SO_LUONG_DA_DAT
        for (PickLoHangRequest.Item item : request.getLoHangPicks()) {
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
            // phiếu đã được trả khỏi so_luong_da_dat ở bước 2)
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
                    .bienTheSanPham(ctGoc.getBienTheSanPham())
                    .loHang(loHang)
                    .soLuongXuat(item.getSoLuongXuat())
                    .giaVon(loHang.getGiaVon())
                    .build();
            chiTietPhieuXuatKhoRepository.save(ctPick);
        }

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
        }

        return PhieuXuatKhoViewDto.builder()
                .id(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .ngayXuat(phieu.getNgayXuat())
                .trangThai(phieu.getTrangThai())
                .ghiChu(phieu.getGhiChu())
                .tenKho(phieu.getKho().getTenKho())
                .soDonHang(phieu.getDonBanHang().getSoDonHang())
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
        Integer khoId = phieu.getKho().getId();
        Map<Integer, BigDecimal> cuaPhieu = new HashMap<>();
        chiTietPhieuXuatKhoRepository.findPickedLots(phieuXuatKhoId, bienTheSanPhamId)
                .forEach(p -> cuaPhieu.put(p.getLoHangId(), p.getSoLuongDaPick()));
        // Phiếu xuất chuyển kho còn nháp: lô đã chọn của chính phiếu đang nằm trong so_luong_da_dat → trả lại cho phiếu này
        boolean cuaPhieuTrongDaDat = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() != null
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
        ChiTietPhieuXuatKho ct = chiTietPhieuXuatKhoRepository.findById(chiTietPhieuXuatKhoId).orElseThrow(() -> new RuntimeException("Không tìm thấy chi tiết"));
        return chiTietPhieuXuatKhoRepository.findPickedLots(phieuXuatKhoId, ct.getBienTheSanPham().getId());
    }

    private String generateSoPhieu() {
        String prefix = "PX" + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        return prefix + (((PhieuXuatKhoRepository) repository).countBySoPhieuXuatStartingWith(prefix) + 1);
    }

    private boolean isDuplicateSoPhieu(Exception ex) {
        return ex.getMessage() != null && ex.getMessage().contains("uk_phieu_xuat_kho_so_phieu");
    }

    @Transactional(readOnly = true)
    public TransferDetailDto getTransferDetail(Integer id) {
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu chuyển kho id: " + id));

        if (!"khac".equals(phieu.getLoaiXuat())) {
            throw new RuntimeException("Đây không phải là phiếu chuyển kho");
        }

        // 1. Lấy danh sách hàng hóa yêu cầu (những dòng chưa có lo_hang_id)
        List<ChiTietPhieuXuatKho> itemsGoc = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(id);

        List<TransferDetailDto.TransferItemDto> itemDtos = itemsGoc.stream().map(ct -> {
            // Tính tổng số lượng đã pick lô cho biến thể này (nếu có)
            BigDecimal daPick = chiTietPhieuXuatKhoRepository.sumSoLuongDaPick(id, ct.getBienTheSanPham().getId());

            return TransferDetailDto.TransferItemDto.builder()
                    .bienTheId(ct.getBienTheSanPham().getId())
                    .sku(ct.getBienTheSanPham().getMaSku())
                    .tenSanPham(ct.getBienTheSanPham().getSanPham().getTenSanPham() + " - " + ct.getBienTheSanPham().getMauSac().getTenMau())
                    .soLuongYeuCau(ct.getSoLuongXuat())
                    .soLuongDaPick(daPick != null ? daPick : BigDecimal.ZERO)
                    .build();
        }).toList();

        return TransferDetailDto.builder()
                .id(phieu.getId())
                .soPhieuXuat(phieu.getSoPhieuXuat())
                .khoXuatId(phieu.getKho().getId())
                .khoXuatTen(phieu.getKho().getTenKho())
                .khoNhapId(phieu.getKhoChuyenDen().getId())
                .khoNhapTen(phieu.getKhoChuyenDen().getTenKho())
                .nguoiXuatTen(phieu.getNguoiXuat() != null ? phieu.getNguoiXuat().getHoTen() : "N/A")
                .nguoiDuyetTen(phieu.getNguoiDuyet() != null ? phieu.getNguoiDuyet().getHoTen() : "Chưa duyệt")
                .ngayTao(phieu.getNgayTao())
                .trangThai(phieu.getTrangThai())
                .ghiChu(phieu.getGhiChu())
                .items(itemDtos)
                .build();
    }
    @Transactional
    public void submitTransfer(Integer id) {
        //Tìm phiếu
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu chuyển kho id: " + id));
        //Kiểm tra loại phiếu và trạng thái hợp lệ
        if (!"khac".equals(phieu.getLoaiXuat())) {
            throw new RuntimeException("Đây không phải là phiếu chuyển kho nội bộ");
        }
        if (phieu.getTrangThai() != 0) { // 0 là Nháp
            throw new RuntimeException("Chỉ phiếu ở trạng thái Nháp mới có thể gửi duyệt");
        }
        //Kiểm tra xem phiếu đã có ít nhất 1 sản phẩm chưa
        List<ChiTietPhieuXuatKho> details = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(id);
        if (details.isEmpty()) {
            throw new RuntimeException("Vui lòng thêm ít nhất một sản phẩm vào phiếu trước khi gửi duyệt");
        }
        //Cập nhật trạng thái sang 1 (Chờ duyệt)
        phieu.setTrangThai(1);
        repository.save(phieu);
    }
    @Transactional
    public void approveTransfer(Integer id, Integer nguoiDuyetId) {
        //Tìm phiếu
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu chuyển kho id: " + id));
        //Kiểm tra loại phiếu và trạng thái (Phải là Chờ duyệt - 1)
        if (!"khac".equals(phieu.getLoaiXuat())) {
            throw new RuntimeException("Đây không phải là phiếu chuyển kho nội bộ");
        }
        if (phieu.getTrangThai() != 1) {
            throw new RuntimeException("Chỉ phiếu ở trạng thái Chờ duyệt mới có thể phê duyệt");
        }

        // KIỂM TRA QUYỀN: Phải là Quản lý Kho A (Kho xuất) mới được duyệt cho đi
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer khoXuatId = phieu.getKho().getId();

        if (!isAdmin) {
            // Lấy danh sách ID các kho mà user hiện tại được phân quyền quản lý
            List<Integer> assignedWarehouseIds = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndActive(currentUser.getId())
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();

            // Kiểm tra xem kho xuất của phiếu có nằm trong danh sách được cấp quyền không
            if (!assignedWarehouseIds.contains(khoXuatId)) {
                throw new AccessDeniedException("Bạn không có quyền duyệt phiếu này. Chỉ quản lý tại kho xuất ("
                        + phieu.getKho().getTenKho() + ") mới có quyền cho phép xuất hàng.");
            }
        }

        NguoiDung nguoiDuyet = nguoiDungRepository.findById(nguoiDuyetId).orElseThrow();

        //Cập nhật trạng thái sang 2 (Đã duyệt)
        phieu.setTrangThai(2);
        phieu.setNguoiDuyet(nguoiDuyet);
        repository.save(phieu);
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
    @Transactional
    public void cancelTransfer(Integer id) {
        PhieuXuatKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu chuyển kho id: " + id));

        if (!"khac".equals(phieu.getLoaiXuat())) {
            throw new RuntimeException("Đây không phải là phiếu chuyển kho nội bộ");
        }

        int currentStatus = phieu.getTrangThai();
        if (currentStatus == 5) throw new RuntimeException("Phiếu đã hoàn tất, không thể hủy");
        if (currentStatus == 4) throw new RuntimeException("Phiếu đã được hủy trước đó");

        // Không hủy liên đới. Đổi Status phiếu gốc = 4
        phieu.setTrangThai(4);
        repository.save(phieu);
    }
    private String generateSoPhieuTransfer() {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "PX-TRF-" + dateStr;
        long countToday = ((PhieuXuatKhoRepository) repository).countBySoPhieuXuatStartingWith(prefix);
        return prefix + (countToday + 1);
    }

    @Transactional
    public PhieuXuatKho createTransfer(PhieuChuyenKhoCreating request) {
        // Kiểm tra cơ bản
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);

        if (!isAdmin) {
            // Lấy danh sách ID các kho mà user này được quyền quản lý
            List<Integer> assignedWarehouseIds = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndActive(currentUser.getId())
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();
            if (!assignedWarehouseIds.contains(request.getKhoNhapId())) {
                throw new AccessDeniedException("Bạn chỉ có quyền tạo yêu cầu nhập hàng cho kho của mình");
            }
        }

        //Tìm và kiểm tra thực thể (Nên ném lỗi nếu null)
        if (request.getKhoXuatId() == null || request.getKhoNhapId() == null) {
            throw new CommonException("Vui lòng chọn đầy đủ kho gửi và kho nhận");
        }
        if (request.getKhoXuatId().equals(request.getKhoNhapId())) {
            throw new CommonException("Kho gửi và kho nhận không được trùng nhau");
        }
        if (request.getChiTietXuat() == null || request.getChiTietXuat().isEmpty()) {
            throw new CommonException("Yêu cầu điều chuyển phải có ít nhất 1 sản phẩm");
        }
        Kho khoA = Optional.ofNullable(entityManager.find(Kho.class, request.getKhoXuatId()))
                .orElseThrow(() -> new CommonException("Kho xuất hàng không tồn tại"));
        Kho khoB = Optional.ofNullable(entityManager.find(Kho.class, request.getKhoNhapId()))
                .orElseThrow(() -> new CommonException("Kho nhận hàng không tồn tại"));
        // Không chuyển qua lại với Kho Trung Chuyển (kho ảo) hay kho đã ngừng hoạt động
        KhoService.kiemTraKhoGiaoDich(khoA, "Kho xuất hàng");
        KhoService.kiemTraKhoGiaoDich(khoB, "Kho nhận hàng");

        // Kiểm tồn ở kho gửi một lần cho mọi mã, gộp các dòng cùng mã
        Map<Integer, BienTheSanPham> bienTheTheoId = new LinkedHashMap<>();
        Map<Integer, BigDecimal> yeuCauTheoBienThe = new LinkedHashMap<>();
        for (ChiTietPhieuXuatKhoCreating reqCt : request.getChiTietXuat()) {
            BienTheSanPham bt = Optional.ofNullable(reqCt.getBienTheSanPhamId())
                    .map(id -> entityManager.find(BienTheSanPham.class, id))
                    .orElseThrow(() -> new CommonException("Sản phẩm ID " + reqCt.getBienTheSanPhamId() + " không tồn tại"));
            if (reqCt.getSoLuongXuat() == null || reqCt.getSoLuongXuat().signum() <= 0) {
                throw new CommonException("Số lượng chuyển của sản phẩm [" + bt.getMaSku() + "] phải lớn hơn 0");
            }
            bienTheTheoId.put(bt.getId(), bt);
            yeuCauTheoBienThe.merge(bt.getId(), reqCt.getSoLuongXuat(), BigDecimal::add);
        }
        kiemTraKhaDungChuyenKho(khoA, bienTheTheoId, yeuCauTheoBienThe);

        int retry = 0;
        int maxRetry = 5;
        while (true) {
            try {
                PhieuXuatKho phieu = PhieuXuatKho.builder()
                        .soPhieuXuat(generateSoPhieuTransfer())
                        .kho(khoA)
                        .khoChuyenDen(khoB)
                        .loaiXuat("khac")
                        .trangThai(0) // Nháp
                        .ngayTao(Instant.now())
                        .ghiChu(request.getGhiChu())
                        .build();
                phieu = repository.save(phieu);
                for (ChiTietPhieuXuatKhoCreating reqCt : request.getChiTietXuat()) {
                    ChiTietPhieuXuatKho ct = ChiTietPhieuXuatKho.builder()
                            .phieuXuatKho(phieu)
                            .bienTheSanPham(bienTheTheoId.get(reqCt.getBienTheSanPhamId()))
                            .soLuongXuat(reqCt.getSoLuongXuat())
                            .build();
                    entityManager.persist(ct); // Dùng persist trong vòng lặp Transactional sẽ hiệu quả hơn
                }
                return phieu;
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                if (isDuplicateSoPhieu(ex) && retry < maxRetry) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    /**
     * Khả dụng để chuyển ở kho gửi = (tồn − đang giữ) − chờ xuất (đặt − đã xuất thật) của đơn bán đang giữ hàng
     * (ITrangThaiDonBanHang.DANG_GIU_HANG) có kho xuất là kho này: đúng phần của một kho trong tồn đẩy lên sàn
     * (TonKhoTongHopRepository.sumTongFreeToUseToanChuoi), giống gợi ý kho cho đơn bán. Không trừ thêm phần lô phiếu
     * nhặt / phiếu xuất bán đang giữ: phần đó thuộc chính các đơn ấy, đã nằm trong chờ xuất. Chỉ kiểm, không giữ hàng.
     */
    private void kiemTraKhaDungChuyenKho(Kho khoGui, Map<Integer, BienTheSanPham> bienTheTheoId,
                                         Map<Integer, BigDecimal> yeuCauTheoBienThe) {
        List<Integer> bienTheIds = new ArrayList<>(yeuCauTheoBienThe.keySet());
        Map<Integer, BigDecimal> tonTruGiu = new HashMap<>();
        for (Object[] row : tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(khoGui.getId(), bienTheIds)) {
            tonTruGiu.put((Integer) row[0], soLuong(row[1]));
        }
        Map<Integer, BigDecimal> choXuat = new HashMap<>();
        for (Object[] row : chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(bienTheIds, null, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            if (khoGui.getId().equals(row[1])) {
                choXuat.merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
            }
        }
        for (Object[] row : chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(bienTheIds, null, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            if (khoGui.getId().equals(row[1])) {
                choXuat.merge((Integer) row[0], soLuong(row[2]).negate(), BigDecimal::add);
            }
        }
        for (Map.Entry<Integer, BigDecimal> e : yeuCauTheoBienThe.entrySet()) {
            BigDecimal ton = tonTruGiu.getOrDefault(e.getKey(), BigDecimal.ZERO);
            BigDecimal cho = choXuat.getOrDefault(e.getKey(), BigDecimal.ZERO).max(BigDecimal.ZERO);
            BigDecimal khaDung = ton.subtract(cho).max(BigDecimal.ZERO);
            if (khaDung.compareTo(e.getValue()) < 0) {
                String chiTiet = cho.signum() > 0
                        ? " (tồn trừ phần đang giữ " + hienThi(ton) + ", đơn bán đang chờ xuất " + hienThi(cho) + ")"
                        : "";
                throw new CommonException("Sản phẩm [" + bienTheTheoId.get(e.getKey()).getMaSku() + "] chỉ còn "
                        + hienThi(khaDung) + " có thể chuyển tại kho " + khoGui.getTenKho() + chiTiet
                        + ". Yêu cầu: " + hienThi(e.getValue()) + ".");
            }
        }
    }

    private static BigDecimal soLuong(Object value) {
        if (value == null) return BigDecimal.ZERO;
        return value instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) value).doubleValue());
    }

    private static String hienThi(BigDecimal soLuong) {
        return soLuong.stripTrailingZeros().toPlainString();
    }

    private static boolean isIsAdmin(PhieuChuyenKhoCreating request) {
        if (request.getChiTietXuat() == null || request.getChiTietXuat().isEmpty()) {
            throw new CommonException("Yêu cầu điều chuyển phải có ít nhất 1 sản phẩm");
        }
        if (request.getKhoXuatId().equals(request.getKhoNhapId())) {
            throw new CommonException("Kho gửi và kho nhận không được trùng nhau");
        }

        //Kiểm tra quyền
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        return currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
    }

    @Transactional
    public PhieuXuatKho createExportFromTransfer(Integer transferId) {
        PhieuXuatKho pck = repository.findById(transferId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu chuyển kho gốc id: " + transferId));

        if (!"khac".equals(pck.getLoaiXuat()) || pck.getPhieuChuyenKhoGoc() != null) {
            throw new CommonException("Đây không phải là phiếu yêu cầu chuyển kho");
        }
        if (pck.getTrangThai() != 2) {
            throw new CommonException("Chỉ được tạo phiếu xuất khi yêu cầu chuyển kho ở trạng thái Đã duyệt (2)");
        }

        PhieuXuatKho px = PhieuXuatKho.builder()
                .soPhieuXuat(generateSoPhieu())
                .phieuChuyenKhoGoc(pck)
                .kho(pck.getKho())
                .khoChuyenDen(pck.getKhoChuyenDen())
                .loaiXuat("chuyen_kho") // Sử dụng lại ENUM hiện có
                .trangThai(0) // Nháp
                .ghiChu("Xuất thủ công cho phiếu chuyển: " + pck.getSoPhieuXuat())
                .ngayTao(Instant.now())
                .build();

        px = repository.save(px);

        // Copy các sản phẩm yêu cầu sang phiếu xuất con
        List<ChiTietPhieuXuatKho> detailsGoc = chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(transferId);
        for (ChiTietPhieuXuatKho goc : detailsGoc) {
            ChiTietPhieuXuatKho ct = ChiTietPhieuXuatKho.builder()
                    .phieuXuatKho(px)
                    .bienTheSanPham(goc.getBienTheSanPham())
                    .soLuongXuat(goc.getSoLuongXuat())
                    .build();
            chiTietPhieuXuatKhoRepository.save(ct);
        }
        return px;
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