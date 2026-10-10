package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.request.PhieuXuatKhoCreating;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.response.customize.PhieuXuatKhoViewDto;
import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.dto.response.customize.TransferDetailDto;
import com.dev.backend.dto.response.entities.*;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.XacNhanXuatKhoRequest;
import com.dev.backend.dto.response.customize.XacNhanXuatKhoResponse;
import com.dev.backend.event.DonHangXuatKhoEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

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

    @Transactional
    public PhieuXuatKho createFromSO(PhieuXuatKhoCreating request) {
        if (request.getChiTietXuat() == null || request.getChiTietXuat().isEmpty()) {
            throw new RuntimeException("Phiếu xuất phải có nhất 1 sản phẩm");
        }

        DonBanHang donBanHang = entityManager.find(DonBanHang.class, request.getDonBanHangId());
        if (donBanHang == null) {
            throw new RuntimeException("Đơn bán không tồn tại");
        }
        if (donBanHang.getTrangThai() == 4) {
            throw new RuntimeException("Đơn bán đã bị huỷ");
        }

        Kho khoXuat = donBanHang.getKhoXuat();
        if (khoXuat == null) {
            throw new CommonException("Đơn bán hàng này chưa được chỉ định kho xuất. Vui lòng liên hệ Sales.");
        }

        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);

        if (!isAdmin) {
            PhanQuyenNguoiDungKho phanQuyen = phanQuyenNguoiDungKhoRepository
                    .findByNguoiDungIdAndKhoId(currentUser.getId(), khoXuat.getId())
                    .orElseThrow(() -> new CommonException("Bạn không phụ trách kho [" + khoXuat.getTenKho() +
                            "]. Không thể thực hiện xuất kho cho đơn hàng này."));

            if (phanQuyen.getTrangThai() != 1 ||
                    (phanQuyen.getNgayKetThuc() != null && phanQuyen.getNgayKetThuc().isBefore(Instant.now()))) {
                throw new CommonException("Quyền truy cập kho [" + khoXuat.getTenKho() + "] của bạn đã hết hạn hoặc bị khóa.");
            }
        }

        // Kiểm tra sản phẩm còn lại
        List<ChiTietDonBanHang> chiTietSOList = chiTietDonBanHangRepository.findByDonBanHangId(donBanHang.getId());
        boolean hasRemaining = chiTietSOList.stream().anyMatch(ct -> {
            BigDecimal daGiao = ct.getSoLuongDaGiao() != null ? ct.getSoLuongDaGiao() : BigDecimal.ZERO;
            return ct.getSoLuongDat().compareTo(daGiao) > 0;
        });

        if (!hasRemaining) {
            throw new RuntimeException("Đơn bán đã giao đủ toàn bộ sản phẩm");
        }

        int retry = 0;
        int maxRetry = 5;
        while (true) {
            try {
                PhieuXuatKho phieu = PhieuXuatKho.builder()
                        .soPhieuXuat(generateSoPhieu())
                        .donBanHang(donBanHang)
                        .ngayXuat(null)
                        .kho(khoXuat)
                        .ghiChu(request.getGhiChu())
                        .loaiXuat("ban_hang")
                        .trangThai(0)
                        .build();

                phieu = repository.save(phieu);

                for (ChiTietPhieuXuatKhoCreating reqCt : request.getChiTietXuat()) {
                    ChiTietDonBanHang ctSO = chiTietSOList.stream()
                            .filter(ct -> ct.getBienTheSanPham().getId().equals(reqCt.getBienTheSanPhamId()))
                            .findFirst()
                            .orElseThrow(() -> new RuntimeException("Sản phẩm không thuộc đơn bán"));

                    BigDecimal daGiao = ctSO.getSoLuongDaGiao() != null ? ctSO.getSoLuongDaGiao() : BigDecimal.ZERO;
                    BigDecimal conLai = ctSO.getSoLuongDat().subtract(daGiao);

                    if (reqCt.getSoLuongXuat().compareTo(conLai) > 0) {
                        throw new RuntimeException("Sản phẩm " + ctSO.getBienTheSanPham().getMaSku() + " xuất vượt quá số lượng còn lại");
                    }
                    if (reqCt.getSoLuongXuat().compareTo(BigDecimal.ZERO) <= 0) {
                        throw new RuntimeException("Số lượng xuất phải > 0");
                    }

                    ChiTietPhieuXuatKho ctXuat = ChiTietPhieuXuatKho.builder()
                            .phieuXuatKho(phieu)
                            .bienTheSanPham(ctSO.getBienTheSanPham())
                            .soLuongXuat(reqCt.getSoLuongXuat())
                            .build();
                    entityManager.persist(ctXuat);
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
        if (phieu.getTrangThai() != 0) {
            throw new CommonException("Phiếu không ở trạng thái chờ xuất (trạng thái hiện tại: " + phieu.getTrangThai() + ")");
        }

        validatePickedQuantity(id);
        NguoiDung nguoiXuat = nguoiDungRepository.findById(nguoiXuatId)
                .orElseThrow(() -> new CommonException("Không tìm thấy thông tin người xuất kho ID: " + nguoiXuatId));

        List<ChiTietPhieuXuatKho> detailedPicks = chiTietPhieuXuatKhoRepository.findAll().stream()
                .filter(ct -> ct.getPhieuXuatKho().getId().equals(id) && ct.getLoHang() != null)
                .toList();
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

            // Quy tắc 5: Giải phóng nghĩa vụ xuất khỏi Outgoing (soLuongDaDat) nếu có giữ chỗ
            if (tonKho.getSoLuongDaDat() != null && tonKho.getSoLuongDaDat().compareTo(BigDecimal.ZERO) > 0) {
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
                            .giaTriCu("trang_thai = 0 (Chờ xuất)")
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
        } else if (!allZero) {
            don.setTrangThai(ITrangThaiDonBanHang.DANG_XUAT_KHO); // 2: Có hàng đã xuất nhưng chưa đủ -> Đang xuất kho
        } else {
            don.setTrangThai(ITrangThaiDonBanHang.CHO_XUAT_KHO); // 1: Chưa có hàng nào xuất -> Chờ xuất kho
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
    }

    @Transactional
    public void pickLoHang(Integer phieuXuatKhoId, PickLoHangRequest request) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));

        // 1. KIỂM TRA TRẠNG THÁI PHÙ HỢP
        boolean isXuatChuyenKho = "chuyen_kho".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() != null;
        boolean isYeuCauChuyenKho = "khac".equals(phieu.getLoaiXuat()) && phieu.getPhieuChuyenKhoGoc() == null;
        if (isXuatChuyenKho) {
            if (phieu.getTrangThai() != 0) throw new RuntimeException("Chỉ được pick lô cho phiếu xuất chuyển kho ở trạng thái Nháp (0)");
        } else if ("ban_hang".equals(phieu.getLoaiXuat())) {
            if (phieu.getTrangThai() != 0) throw new RuntimeException("Chỉ được pick lô cho đơn bán hàng ở trạng thái Mới tạo (0)");
        } else if (isYeuCauChuyenKho) {
            throw new RuntimeException("Không được pick lô trực tiếp trên phiếu yêu cầu. Vui lòng tạo Phiếu Xuất.");
        }

        ChiTietPhieuXuatKho ctGoc = chiTietPhieuXuatKhoRepository.findById(request.getChiTietPhieuXuatKhoId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy dòng phiếu xuất gốc"));

        if (ctGoc.getLoHang() != null) throw new RuntimeException("Vui lòng thực hiện pick lô từ dòng sản phẩm gốc");

        BigDecimal tongPickLanNay = request.getLoHangPicks().stream()
                .map(PickLoHangRequest.Item::getSoLuongXuat)
                .filter(sl -> sl != null && sl.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (tongPickLanNay.compareTo(ctGoc.getSoLuongXuat()) > 0) {
            throw new RuntimeException("Tổng số lượng bốc lô vượt quá số lượng yêu cầu");
        }

        // 2. RẼ NHÁNH HOÀN LẠI SO_LUONG_DA_DAT (Chỉ áp dụng cho Chuyển kho)
        if (isXuatChuyenKho) {
            List<ChiTietPhieuXuatKho> oldPicks = chiTietPhieuXuatKhoRepository
                    .findByPhieuXuatKhoIdAndBienTheSanPhamIdAndLoHangIsNotNull(phieuXuatKhoId, ctGoc.getBienTheSanPham().getId());

            for (ChiTietPhieuXuatKho old : oldPicks) {
                tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(phieu.getKho().getId(), old.getLoHang().getId())
                        .ifPresent(t -> {
                            BigDecimal currentDaDat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
                            t.setSoLuongDaDat(currentDaDat.subtract(old.getSoLuongXuat()));
                            tonKhoTheoLoRepository.save(t);
                        });
            }
        }

        // 3. Xóa các dòng pick cũ
        chiTietPhieuXuatKhoRepository.deletePickedByPhieuAndBienThe(phieuXuatKhoId, ctGoc.getBienTheSanPham().getId());

        // 4. LƯU PICK MỚI VÀ RẼ NHÁNH CẬP NHẬT SO_LUONG_DA_DAT
        for (PickLoHangRequest.Item item : request.getLoHangPicks()) {
            if (item.getSoLuongXuat() == null || item.getSoLuongXuat().compareTo(BigDecimal.ZERO) <= 0) continue;

            LoHang loHang = loHangRepository.findById(item.getLoHangId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy lô hàng"));

            TonKhoTheoLo tonKho = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(phieu.getKho().getId(), loHang.getId())
                    .orElseThrow(() -> new RuntimeException("Sản phẩm không có tồn kho trong lô đã chọn tại kho này"));

            // Kiểm tra tồn khả dụng (Chỉ áp dụng cho Chuyển kho vì SO đã giữ hàng từ trước)
            if (isXuatChuyenKho && item.getSoLuongXuat().compareTo(tonKho.getSoLuongKhaDung()) > 0) {
                throw new RuntimeException("Lô " + loHang.getMaLo() + " không đủ tồn khả dụng để chuyển đi");
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

    @Transactional(readOnly = true)
    public List<TonKhoTheoLoDto> getAvailableLots(Integer phieuXuatKhoId, Integer bienTheSanPhamId) {
        PhieuXuatKho phieu = repository.findById(phieuXuatKhoId).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));
        return tonKhoTheoLoRepository.findAvailableLots(phieu.getKho().getId(), bienTheSanPhamId, phieuXuatKhoId).stream()
                .map(t -> TonKhoTheoLoDto.builder()
                        .loHangId(t.getLoHang().getId())
                        .maLo(t.getLoHang().getMaLo())
                        .ngayNhapGanNhat(t.getNgayNhapGanNhat())
                        .soLuongKhaDung(t.getSoLuongKhaDung())
                        .build()).toList();
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
        Kho khoA = Optional.ofNullable(entityManager.find(Kho.class, request.getKhoXuatId()))
                .orElseThrow(() -> new CommonException("Kho xuất hàng không tồn tại"));
        Kho khoB = Optional.ofNullable(entityManager.find(Kho.class, request.getKhoNhapId()))
                .orElseThrow(() -> new CommonException("Kho nhận hàng không tồn tại"));

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
                    BienTheSanPham bt = Optional.ofNullable(entityManager.find(BienTheSanPham.class, reqCt.getBienTheSanPhamId()))
                            .orElseThrow(() -> new CommonException("Sản phẩm ID " + reqCt.getBienTheSanPhamId() + " không tồn tại"));

                    // check tồn kho
                    BigDecimal qtyYeuCau = reqCt.getSoLuongXuat();
                    BigDecimal qtyKhaDung = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienThe(khoA.getId(), bt.getId());

                    if (qtyKhaDung.compareTo(qtyYeuCau) < 0) {
                        throw new CommonException("Sản phẩm [" + bt.getMaSku() + "] không đủ tồn kho tại kho " + khoA.getTenKho() +
                                " (Yêu cầu: " + qtyYeuCau + ", Hiện có: " + qtyKhaDung + ")");
                    }
                    ChiTietPhieuXuatKho ct = ChiTietPhieuXuatKho.builder()
                            .phieuXuatKho(phieu)
                            .bienTheSanPham(bt)
                            .soLuongXuat(qtyYeuCau)
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
}