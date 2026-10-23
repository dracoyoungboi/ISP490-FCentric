package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating;
import com.dev.backend.dto.request.KhaiBaoLoRequest;
import com.dev.backend.dto.request.PhieuNhapKhoCreating;
import com.dev.backend.dto.response.customize.ChiTietLoiLoHangDto;
import com.dev.backend.dto.response.customize.LoHangKhaiBaoDto;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoDto;
import com.dev.backend.dto.response.entities.PhieuNhapKhoItemDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.utils.KhoDangChon;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.utils.SauCommit;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class PhieuNhapKhoService extends BaseServiceImpl<PhieuNhapKho, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private DonMuaHangRepository donMuaHangRepository;

    @Autowired
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;

    @Autowired
    private LoHangRepository loHangRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;

    @Autowired
    private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private SanPhamQuanAoService sanPhamQuanAoService;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private ViTriKhoRepository viTriKhoRepository;

    @Autowired
    private TonKhoViTriRepository tonKhoViTriRepository;

    @Autowired
    private BienBanTraHangNccRepository bienBanTraHangNccRepository;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;

    @Autowired
    private ChiTietTraHangNccRepository chiTietTraHangNccRepository;

    @Autowired
    private MaVachNhaCungCapRepository maVachNhaCungCapRepository;

    @Autowired
    private CauHinhHeThongRepository cauHinhHeThongRepository;

    @Autowired
    private com.dev.backend.services.BienBanTraHangService bienBanTraHangService;

    /** Ngày sản xuất so theo lịch Việt Nam (FE gửi nửa đêm UTC của ngày được chọn). */
    private static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Phương án biên bản trả hàng mà nhà cung cấp giao bù: đơn mua vẫn chờ nhận phần lỗi. */
    private static final Set<String> PHUONG_AN_DOI_HANG = Set.of("DOI_HANG", "DOI_HANG_MOI");

    /**
     * Ngày sản xuất sớm nhất được nhận: chỉ để chặn dữ liệu nhập nhầm (vd. máy quét gõ mã kệ vào ô ngày thành năm 0102),
     * không phải quy tắc nghiệp vụ.
     */
    private static final LocalDate NSX_SOM_NHAT = LocalDate.of(2000, 1, 1);

    /** Đơn mua đã nhận đủ (constants/donMuaHang.js: 5 = "Đã nhận đủ"; 4 là "Không chấp nhận báo giá"). */
    private static final int DON_MUA_DA_NHAN_DU = 5;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public PhieuNhapKhoService(PhieuNhapKhoRepository repository) {
        super(repository);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PhieuNhapKho createDraft(PhieuNhapKhoCreating request) {
        // Lỗi dữ liệu gửi lên / không đúng kho là lỗi nghiệp vụ (4xx có câu tiếng Việt), không phải lỗi máy chủ
        if (request.getDonMuaHangId() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Chưa chọn đơn mua hàng để tạo phiếu nhập");
        }
        if (request.getChiTietPhieuNhapKhos() == null
                || request.getChiTietPhieuNhapKhos().isEmpty()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Danh sách sản phẩm nhập không được rỗng");
        }

        // Mỗi dòng: có biến thể, số lượng nguyên dương; mỗi biến thể một dòng (hai dòng cùng biến thể làm phiếu giữ
        // gấp đôi phần còn lại của đơn mà chỉ nhập được một dòng)
        java.util.Set<Integer> bienTheDaCo = new java.util.HashSet<>();
        for (ChiTietPhieuNhapKhoCreating dong : request.getChiTietPhieuNhapKhos()) {
            if (dong == null || dong.getBienTheSanPhamId() == null) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Mỗi dòng sản phẩm nhập phải có biến thể");
            }
            if (dong.getSoLuongDuKienNhap() != null && dong.getSoLuongDuKienNhap().stripTrailingZeros().scale() > 0) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Số lượng nhập phải là số nguyên");
            }
            if (!bienTheDaCo.add(dong.getBienTheSanPhamId())) {
                throw new CommonException(HttpStatus.BAD_REQUEST,
                        "Biến thể " + dong.getBienTheSanPhamId() + " có hai dòng trong phiếu. Gộp thành một dòng.");
            }
        }

        DonMuaHang donMuaHang = donMuaHangRepository.findById(request.getDonMuaHangId())
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn mua hàng"));
        if (donMuaHang.getTrangThai() == null || (donMuaHang.getTrangThai() != 3 && donMuaHang.getTrangThai() != 5)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Đơn mua " + donMuaHang.getSoDonMua() + " không ở trạng thái chờ nhận hàng (Đang vận chuyển) nên không tạo phiếu nhập được");
        }
        var currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer currentKhoId = SecurityContextHolder.getKhoId();
        if (!isAdmin) {
            if (currentKhoId == null) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Chưa chọn kho đang làm việc");
            }

            if (donMuaHang.getKhoNhap() == null
                    || !donMuaHang.getKhoNhap().getId().equals(currentKhoId)) {
                throw new CommonException(HttpStatus.FORBIDDEN,
                        "Đơn mua " + donMuaHang.getSoDonMua() + " nhập về "
                                + (donMuaHang.getKhoNhap() != null ? donMuaHang.getKhoNhap().getTenKho() : "kho khác")
                                + ", không phải kho đang chọn");
            }
        }

        // Khóa các dòng đơn mua: hai phiếu tạo cùng lúc cho một đơn không cùng giữ phần còn lại
        chiTietDonMuaHangRepository.khoaTheoDonMua(donMuaHang.getId());

        int retry = 0;
        int maxRetry = 5;
        while (true) {
            try {
                PhieuNhapKho phieuNhapKho = PhieuNhapKho.builder()
                        .soPhieuNhap(generateSoPhieu())
                        .donMuaHang(donMuaHang)
                        .nhaCungCap(donMuaHang.getNhaCungCap())
                        .ngayNhap(null)
                        .kho(donMuaHang.getKhoNhap())
                        .ghiChu(request.getGhiChu())
                        .trangThai(TrangThaiPhieuNhap.DRAFT.getValue())
                        .tongTien(BigDecimal.ZERO)
                        .build();

                phieuNhapKho = repository.save(phieuNhapKho);

                BigDecimal tongTien = BigDecimal.ZERO;
                for (ChiTietPhieuNhapKhoCreating item : request.getChiTietPhieuNhapKhos()) {
                    ChiTietDonMuaHang ctPo = donMuaHang.getChiTietDonMuaHangs().stream()
                            .filter(poItem ->
                                    poItem.getBienTheSanPham().getId()
                                            .equals(item.getBienTheSanPhamId())
                            )
                            .findFirst()
                            .orElseThrow(() ->
                                    new CommonException(HttpStatus.BAD_REQUEST,
                                            "Sản phẩm (biến thể " + item.getBienTheSanPhamId() + ") không có trong đơn mua " + donMuaHang.getSoDonMua())
                            );

                    BigDecimal soLuongNhap = item.getSoLuongDuKienNhap();
                    if (soLuongNhap == null
                            || soLuongNhap.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new CommonException(HttpStatus.BAD_REQUEST,
                                "Số lượng nhập của " + ctPo.getBienTheSanPham().getMaSku() + " phải lớn hơn 0");
                    }
                    BigDecimal soLuongDat = ctPo.getSoLuongDat();
                    BigDecimal soLuongDaNhan =
                            ctPo.getSoLuongDaNhan() != null
                                    ? ctPo.getSoLuongDaNhan()
                                    : BigDecimal.ZERO;
                    // Phiếu Nháp khác của cùng đơn đã giữ một phần (chưa nhập kho nên chưa vào "đã nhận")
                    BigDecimal daGiu = chiTietPhieuNhapKhoRepository.sumDuKienPhieuNhapCungDon(
                            donMuaHang.getId(), ctPo.getBienTheSanPham().getId());
                    if (daGiu == null) daGiu = BigDecimal.ZERO;
                    BigDecimal soLuongConLai =
                            soLuongDat.subtract(soLuongDaNhan).subtract(daGiu);
                    if (soLuongNhap.compareTo(soLuongConLai) > 0) {
                        throw new CommonException(HttpStatus.BAD_REQUEST,
                                "Sản phẩm "
                                        + ctPo.getBienTheSanPham().getMaSku()
                                        + " nhập vượt quá số lượng còn lại ("
                                        + soLuongConLai.max(BigDecimal.ZERO).stripTrailingZeros().toPlainString() + ")"
                                        + (daGiu.signum() > 0
                                        ? ". Phiếu nhập đang kiểm đếm khác của đơn này đã giữ " + daGiu.stripTrailingZeros().toPlainString()
                                        : "")
                        );
                    }
                    ChiTietPhieuNhapKho ct = ChiTietPhieuNhapKho.builder()
                            .phieuNhapKho(phieuNhapKho)
                            .bienTheSanPham(ctPo.getBienTheSanPham())
                            .soLuongNhap(soLuongNhap)
                            .donGia(ctPo.getDonGia())
                            .loHang(null)
                            .build();
                    chiTietPhieuNhapKhoRepository.save(ct);
                    tongTien = tongTien.add(
                            ctPo.getDonGia().multiply(soLuongNhap)
                    );
                }
                phieuNhapKho.setTongTien(tongTien);
                repository.save(phieuNhapKho);
                return phieuNhapKho;
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                if (isDuplicateSoPhieu(ex) && retry < maxRetry) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void completePhieuNhap(Integer phieuNhapKhoId, Integer nguoiNhapId) {
        // Khóa dòng phiếu trước tiên: hai người bấm nhập kho cùng lúc thì người sau thấy phiếu đã hoàn tất
        PhieuNhapKho phieu = ((PhieuNhapKhoRepository) repository).khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));

        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getTrangThai() != 0) {
            throw new CommonException("Phiếu không ở trạng thái có thể nhập kho");
        }
        // Khóa các dòng đơn mua trước khi đọc số "đã nhận" (hai phiếu của cùng đơn nhập kho cùng lúc)
        if (phieu.getDonMuaHang() != null) {
            chiTietDonMuaHangRepository.khoaTheoDonMua(phieu.getDonMuaHang().getId());
        }

        List<ChiTietPhieuNhapKho> danhSachNhapTheoLo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapKhoId);

        // 1. CHỐT CHẶN AN TOÀN (SAFETY LOCK): Kiểm tra hàng lỗi QC và biên bản RTV
        int tongLoi = danhSachNhapTheoLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                .sum();
        BienBanTraHangNcc bienBanRtv = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId)
                .filter(BienBanTraHangNcc::dangHieuLuc).orElse(null);
        if (tongLoi > 0 && bienBanRtv == null) {
            throw new CommonException(HttpStatus.CONFLICT,
                    "Không thể hoàn tất nhập kho: Đơn có " + tongLoi + " sản phẩm lỗi kiểm đếm nhưng chưa phát hành Biên bản trả hàng (RTV). Vui lòng phát hành biên bản RTV để giải phóng chốt chặn an toàn.");
        }
        // Biên bản phát hành xong mà lô lỗi bị xóa / khóa lại: dòng biên bản không còn khớp lô, lý do, số lượng
        if (bienBanRtv != null && !bienBanTraHangService.khopHangLoiHienTai(bienBanRtv)) {
            int loiTrenBienBan = bienBanRtv.getTongSoLuongLoi() != null ? bienBanRtv.getTongSoLuongLoi() : 0;
            throw new CommonException(HttpStatus.CONFLICT,
                    "Biên bản trả hàng " + bienBanRtv.getMaBienBan() + " không còn khớp hàng không đạt hiện tại (biên bản ghi "
                            + loiTrenBienBan + ", kiểm đếm hiện có " + tongLoi + "). Lập lại biên bản trước khi nhập kho.");
        }
        // Đổi hàng mới: nhà cung cấp giao bù phần lỗi, đơn mua vẫn chờ nhận số đó
        boolean doiHang = bienBanRtv != null && PHUONG_AN_DOI_HANG.contains(bienBanRtv.getPhuongAnXuLy());

        // 2. Kiểm tra hoàn tất kiểm đếm cho toàn bộ dòng dự kiến nhập (draft items)
        for (ChiTietPhieuNhapKho ctDraft : phieu.getChiTietPhieuNhapKhos()) {
            if (ctDraft.getLoHang() == null) {
                int canNhap = ctDraft.getSoLuongNhap() != null ? ctDraft.getSoLuongNhap().intValue() : 0;
                int datQc = danhSachNhapTheoLo.stream()
                        .filter(ct -> ct.getBienTheSanPham().getId().equals(ctDraft.getBienTheSanPham().getId()))
                        .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                        .sum();
                int loiQc = danhSachNhapTheoLo.stream()
                        .filter(ct -> ct.getBienTheSanPham().getId().equals(ctDraft.getBienTheSanPham().getId()))
                        .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                        .sum();
                if (datQc + loiQc > canNhap) {
                    throw new CommonException(HttpStatus.CONFLICT,
                            "Sản phẩm " + ctDraft.getBienTheSanPham().getMaSku() + " đã khóa lô " + (datQc + loiQc)
                                    + ", vượt số cần nhập " + canNhap + ". Xóa bớt lô thừa rồi nhập kho.");
                }
                boolean daXong = "DA_HOAN_TAT".equals(ctDraft.getTrangThaiKiemDem()) || (datQc + loiQc >= canNhap);
                if (!daXong && canNhap > 0) {
                    throw new CommonException(HttpStatus.BAD_REQUEST,
                            "Vui lòng khai báo đầy đủ thông tin lô hoặc kiểm đếm cho sản phẩm "
                                    + ctDraft.getBienTheSanPham().getMaSku() + " (Đã kiểm: " + (datQc + loiQc) + "/" + canNhap + ")");
                }
            }
        }

        NguoiDung nguoiNhap = nguoiDungRepository.findById(nguoiNhapId)
                .orElseThrow(() -> new CommonException("Không tìm thấy thông tin người nhập"));

        Kho kho = phieu.getKho();
        BigDecimal tongTien = BigDecimal.ZERO;

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = danhSachNhapTheoLo.stream()
                .map(ct -> ct.getLoHang().getId())
                .distinct()
                .sorted()
                .toList();
        if (!lotIdsToLock.isEmpty()) {
            tonKhoTheoLoRepository.lockLotsForUpdateByLotIds(lotIdsToLock);
        }

        // donMuaHang sẽ là null nếu đây là phiếu Nhập Hoàn Trả (Return)
        DonMuaHang donMuaHang = phieu.getDonMuaHang();

        // Khởi tạo Set để lưu các ID Sản phẩm cha cần cập nhật giá
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        // Map lưu tổng số lượng PO đã xử lý (Đạt + Lỗi) theo từng biến thể để trừ Incoming chính xác
        Map<Integer, BigDecimal> poQtyHandledPerVariant = new HashMap<>();

        for (ChiTietPhieuNhapKho ct : danhSachNhapTheoLo) {
            LoHang loHang = ct.getLoHang();
            BigDecimal soLuongNhap = ct.getSoLuongNhap(); // Số lượng ĐẠT nhập kho

            // 1. Chuyển trạng thái lô từ TAM_KHOA sang HOAT_DONG
            loHang.setTrangThai("HOAT_DONG");
            loHangRepository.save(loHang);

            // Lô chỉ có hàng lỗi: không có gì vào tồn, chỉ tính số đã xử lý của đơn mua
            if (soLuongNhap == null || soLuongNhap.compareTo(BigDecimal.ZERO) <= 0) {
                int slLoiLo = loHang.getSoLuongLoi() != null ? loHang.getSoLuongLoi() : 0;
                if (!doiHang && slLoiLo > 0) {
                    poQtyHandledPerVariant.merge(ct.getBienTheSanPham().getId(), BigDecimal.valueOf(slLoiLo), BigDecimal::add);
                }
                continue;
            }

            // 2. Ghi nhận số lượng ĐẠT vào ton_kho_vi_tri (nếu có vị trí kệ)
            if (loHang.getViTriKho() != null && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                ViTriKho viTri = loHang.getViTriKho();
                TonKhoViTri tkvt = tonKhoViTriRepository.findByViTriKho_IdAndLoHang_Id(viTri.getId(), loHang.getId())
                        .orElse(TonKhoViTri.builder()
                                .viTriKho(viTri)
                                .loHang(loHang)
                                .bienTheSanPham(ct.getBienTheSanPham())
                                .soLuong(0)
                                .build());
                tkvt.setSoLuong(tkvt.getSoLuong() + soLuongNhap.intValue());
                tonKhoViTriRepository.save(tkvt);
            }

            // 3. Cập nhật On Hand trong ton_kho_theo_lo (chỉ tăng số lượng ĐẠT)
            TonKhoTheoLo tonKho = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(kho.getId(), loHang.getId())
                    .orElse(TonKhoTheoLo.builder()
                            .kho(kho)
                            .loHang(loHang)
                            .soLuongTon(BigDecimal.ZERO)
                            .soLuongDaDat(BigDecimal.ZERO)
                            .build());

            BigDecimal soLuongTruoc = tonKho.getSoLuongTon();
            BigDecimal soLuongSau = soLuongTruoc.add(soLuongNhap);

            tonKho.setSoLuongTon(soLuongSau);
            tonKho.setNgayNhapGanNhat(Instant.now());
            tonKho.setLanCapNhatCuoi(Instant.now());
            tonKhoTheoLoRepository.save(tonKho);

            // Tích lũy số lượng kiểm đếm (Đạt + Lỗi) của biến thể từ các lô
            int slDatLo = loHang.getSoLuongNhap() != null ? loHang.getSoLuongNhap() : soLuongNhap.intValue();
            int slLoiLo = loHang.getSoLuongLoi() != null ? loHang.getSoLuongLoi() : 0;
            poQtyHandledPerVariant.merge(ct.getBienTheSanPham().getId(), BigDecimal.valueOf(slDatLo + (doiHang ? 0 : slLoiLo)), BigDecimal::add);

            // Ghi lịch sử giao dịch kho
            String ghiChuLS = donMuaHang != null
                    ? "Nhập kho từ phiếu: " + phieu.getSoPhieuNhap() + " (Kệ: " + (loHang.getViTriKho() != null ? loHang.getViTriKho().getMaViTri() : "Chưa gắn kệ") + ")"
                    : "Nhập hoàn trả (Return) từ phiếu: " + phieu.getSoPhieuNhap();

            LichSuGiaoDichKho history = LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(Instant.now())
                    .loaiGiaoDich("nhap_kho")
                    .loaiThamChieu("phieu_nhap_kho")
                    .idThamChieu(phieu.getId())
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .loHang(loHang)
                    .kho(kho)
                    .soLuong(soLuongNhap)
                    .soLuongTruoc(soLuongTruoc)
                    .soLuongSau(soLuongSau)
                    .giaVon(ct.getDonGia())
                    .nguoiDung(nguoiNhap)
                    .ghiChu(ghiChuLS)
                    .build();
            lichSuGiaoDichKhoRepository.save(history);
            sanPhamIdsCanCapNhat.add(ct.getBienTheSanPham().getSanPham().getId());

            // Kích hoạt phát tán InventoryRestockedEvent cho SKU có số lượng Đạt nhập kho
            if (eventPublisher != null && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    eventPublisher.publishEvent(new InventoryRestockedEvent(this, ct.getBienTheSanPham().getId(), soLuongNhap, kho.getId()));
                } catch (Exception ex) {
                    // Log warning mà không làm gián đoạn transaction
                }
            }

            // Cộng tổng tiền cho phiếu
            tongTien = tongTien.add(soLuongNhap.multiply(ct.getDonGia()));
        }

        // 4. CẬP NHẬT CÂN BẰNG TỒN KHO: Incoming -= Q_PO (giải phóng nghĩa vụ nhận hàng theo PO)
        if (donMuaHang != null) {
            for (Map.Entry<Integer, BigDecimal> entry : poQtyHandledPerVariant.entrySet()) {
                Integer btId = entry.getKey();
                BigDecimal totalPoHandled = entry.getValue();

                ChiTietDonMuaHang ctPo = donMuaHang.getChiTietDonMuaHangs().stream()
                        .filter(item -> item.getBienTheSanPham().getId().equals(btId))
                        .findFirst()
                        .orElse(null);

                if (ctPo != null) {
                    BigDecimal daNhanHienTai = ctPo.getSoLuongDaNhan() != null ? ctPo.getSoLuongDaNhan() : BigDecimal.ZERO;
                    BigDecimal sauKhiNhan = daNhanHienTai.add(totalPoHandled);
                    if (ctPo.getSoLuongDat() != null && sauKhiNhan.compareTo(ctPo.getSoLuongDat()) > 0) {
                        throw new CommonException(HttpStatus.CONFLICT,
                                "Đơn mua " + donMuaHang.getSoDonMua() + ": sản phẩm " + ctPo.getBienTheSanPham().getMaSku()
                                        + " đã nhận " + daNhanHienTai.stripTrailingZeros().toPlainString()
                                        + "/" + ctPo.getSoLuongDat().stripTrailingZeros().toPlainString()
                                        + ", phiếu này thêm " + totalPoHandled.stripTrailingZeros().toPlainString()
                                        + " sẽ vượt số đặt. Kiểm tra các phiếu nhập khác của đơn.");
                    }
                    ctPo.setSoLuongDaNhan(sauKhiNhan);
                    chiTietDonMuaHangRepository.save(ctPo);
                }
            }
            // Chốt trạng thái PO nếu tất cả biến thể đã nhận đủ
            boolean allDone = donMuaHang.getChiTietDonMuaHangs().stream()
                    .allMatch(item -> item.getSoLuongDaNhan() != null && item.getSoLuongDaNhan().compareTo(item.getSoLuongDat()) >= 0);
            if (allDone) {
                donMuaHang.setTrangThai(DON_MUA_DA_NHAN_DU);
            }
            donMuaHangRepository.save(donMuaHang);
        }

        phieu.setTongTien(tongTien);
        phieu.setTrangThai(TrangThaiPhieuNhap.COMPLETED.getValue());
        phieu.setNguoiNhap(nguoiNhap);
        phieu.setNgayNhap(Instant.now());
        repository.save(phieu);

        // Ghi nhật ký kiểm toán LichSuThayDoi sau khi commit thành công
        Integer phieuId = phieu.getId();
        String soPhieuNhap = phieu.getSoPhieuNhap();
        SauCommit.chay("Ghi nhật ký hoàn tất nhập kho " + soPhieuNhap, () -> lichSuThayDoiService.createGiaoDichRieng(
                LichSuThayDoi.builder()
                        .loaiThamChieu(ITable.phieu_nhap_kho)
                        .idThamChieu(phieuId)
                        .kho(kho)
                        .hanhDong(IHanhDong.nhap_kho)
                        .giaTriMoi("trang_thai = 3 (Hoàn tất)")
                        .nguoiThucHien(nguoiNhap)
                        .ngayThucHien(Instant.now())
                        .ghiChu("Hoàn tất nhập kho cho phiếu " + soPhieuNhap + " (Tổng lỗi: " + tongLoi + ")")
                        .build()));

        entityManager.flush();
        for (Integer spId : sanPhamIdsCanCapNhat) {
            sanPhamQuanAoService.recalculatePriceAndStatus(spId);
        }
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void huyPhieuNhap(Integer id) {
        PhieuNhapKho phieu = ((PhieuNhapKhoRepository) repository).khoaTheoId(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Đây là phiếu nhập hoàn trả bắt buộc, hệ thống không cho phép hủy!");
        }

        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getTrangThai() == TrangThaiPhieuNhap.COMPLETED.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu đã hoàn thành, không thể huỷ");
        }
        if (phieu.getTrangThai() == TrangThaiPhieuNhap.CANCELLED.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu nhập đã bị hủy trước đó");
        }

        // Phiếu từ đơn mua: lô do kiểm đếm tạo (TAM_KHOA) chưa vào tồn kho — bỏ hết để giải phóng mã lô và chỗ
        // "chờ nhập" trên kệ, hủy biên bản trả hàng. Phiếu chuyển kho mang lô THẬT của kho nguồn (đang có tồn,
        // lịch sử): không được xóa, chỉ đổi trạng thái phiếu như trước.
        if (phieu.getDonMuaHang() != null) {
            for (ChiTietPhieuNhapKho ct : chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(id)) {
                LoHang lo = ct.getLoHang();
                if (!"TAM_KHOA".equals(lo.getTrangThai())) continue;
                chiTietLoiLoHangRepository.deleteByLoHangId(lo.getId());
                chiTietTraHangNccRepository.boLienKetLo(lo.getId());
                chiTietPhieuNhapKhoRepository.delete(ct);
                loHangRepository.delete(lo);
            }
            // Biên bản hủy theo phiếu nhưng giữ lại (số biên bản đã cấp không được cấp lại cho phiếu khác)
            bienBanTraHangNccRepository.findByPhieuNhapKho_Id(id).filter(BienBanTraHangNcc::dangHieuLuc).ifPresent(bienBan -> {
                bienBan.setTrangThai(BienBanTraHangNcc.DA_HUY);
                bienBanTraHangNccRepository.save(bienBan);
            });
            for (ChiTietPhieuNhapKho dong : phieu.getChiTietPhieuNhapKhos()) {
                if (dong.getLoHang() == null) {
                    dong.setSoLuongDatQc(0);
                    dong.setSoLuongLoiQc(0);
                    dong.setTrangThaiKiemDem("CHO_KIEM_DEM");
                }
            }
        }

        phieu.setTrangThai(TrangThaiPhieuNhap.CANCELLED.getValue());
        repository.save(phieu);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void khaiBaoLo(Integer phieuNhapKhoId, KhaiBaoLoRequest request) {
        // Thứ tự khóa chung của mọi thao tác trên phiếu: dòng phiếu → dòng dự kiến → dòng kệ.
        // Khóa dòng phiếu đầu tiên: khóa lô không chạy chen với nhập kho / hủy phiếu / xóa lô của cùng phiếu
        // (trạng thái phiếu đọc ra là trạng thái mới nhất), và các thao tác không khóa ngược thứ tự nhau (hết deadlock).
        PhieuNhapKho phieu = ((PhieuNhapKhoRepository) repository).khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));
        List<ChiTietPhieuNhapKho> dongDuKien = request.getBienTheSanPhamId() != null
                ? chiTietPhieuNhapKhoRepository.khoaDongDuKien(phieuNhapKhoId, request.getBienTheSanPhamId())
                : List.of();
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new CommonException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể chỉnh sửa!");
        }

        if (phieu.getTrangThai() == TrangThaiPhieuNhap.CANCELLED.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Phiếu nhập " + phieu.getSoPhieuNhap() + " đã bị hủy, không khóa lô được nữa");
        }
        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được khai báo lô ở trạng thái Nháp");
        }

        String maLo = request.getMaLo() != null ? request.getMaLo().trim() : "";
        if (maLo.isEmpty()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Mã lô không được để trống");
        }
        if (maLo.length() > 50) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Mã lô tối đa 50 ký tự");
        }
        // Tem lô in ra bị quét nhầm sẽ thành thẻ lệnh (FC-KHOA-LO, FC-DAT…); mã lô có chứa FC- thường là máy quét
        // gõ nhầm thẻ lệnh vào ô Mã lô (LO-…-04FC-KHOA-LO): chặn cả hai
        if (maLo.toUpperCase().contains(com.dev.backend.utils.MaVachUtils.TIEN_TO_THE_LENH)) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Mã lô không được chứa " + com.dev.backend.utils.MaVachUtils.TIEN_TO_THE_LENH
                            + " (dành cho thẻ lệnh kiểm đếm, có thể máy quét đã gõ nhầm vào ô Mã lô). Sửa lại mã lô.");
        }

        if (dongDuKien.isEmpty()) {
            throw new CommonException("Sản phẩm không thuộc phiếu này");
        }
        ChiTietPhieuNhapKho dongDraft = dongDuKien.get(0);

        Optional<ChiTietPhieuNhapKho> existingCtOpt = chiTietPhieuNhapKhoRepository
                .findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(phieuNhapKhoId, request.getBienTheSanPhamId(), maLo);
        // Màn khai báo lô cũ (KhaiBaoLo.jsx) sửa lô chỉ gửi mã lô, ngày sản xuất, số đạt, ghi chú. Không gửi số không đạt
        // (và lý do) thì giữ số không đạt + chi tiết lỗi của lô; không gửi kệ thì giữ kệ của lô — không xóa mất hàng
        // không đạt và kệ đã khóa ở màn kiểm đếm.
        LoHang loDangSua = Boolean.TRUE.equals(request.getTaoMoi())
                ? null : existingCtOpt.map(ChiTietPhieuNhapKho::getLoHang).orElse(null);
        boolean giuLoiCu = loDangSua != null && request.getSoLuongLoi() == null
                && (request.getChiTietLoi() == null || request.getChiTietLoi().isEmpty())
                && (request.getLyDoLoi() == null || request.getLyDoLoi().isBlank());

        BigDecimal soLuongCanNhap = dongDraft.getSoLuongNhap();
        BigDecimal soLuongNhap = request.getSoLuongNhap() != null ? request.getSoLuongNhap() : BigDecimal.ZERO;
        // Kệ cũ của lô chỉ dùng lại khi lô còn hàng đạt cần lên kệ: lô 0 đạt mà kệ cũ nay bảo trì không bị từ chối oan
        Integer viTriKhoId = request.getViTriKhoId() != null ? request.getViTriKhoId()
                : loDangSua != null && loDangSua.getViTriKho() != null && soLuongNhap.signum() > 0
                        ? loDangSua.getViTriKho().getId() : null;
        BigDecimal soLuongLoi = request.getSoLuongLoi() != null ? request.getSoLuongLoi()
                : giuLoiCu && loDangSua.getSoLuongLoi() != null ? BigDecimal.valueOf(loDangSua.getSoLuongLoi()) : BigDecimal.ZERO;

        if (soLuongNhap.compareTo(BigDecimal.ZERO) < 0 || soLuongLoi.compareTo(BigDecimal.ZERO) < 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Số lượng Đạt hoặc Lỗi không được âm");
        }
        if (soLuongNhap.stripTrailingZeros().scale() > 0 || soLuongLoi.stripTrailingZeros().scale() > 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Số lượng Đạt và Lỗi phải là số nguyên");
        }
        if (soLuongNhap.add(soLuongLoi).compareTo(BigDecimal.ZERO) <= 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Tổng số lượng Đạt và Lỗi của thùng hàng phải lớn hơn 0");
        }
        // So bằng BigDecimal trước khi đổi sang int: số rất lớn không bị tràn thành số nhỏ hoặc âm
        if (soLuongNhap.add(soLuongLoi).compareTo(soLuongCanNhap) > 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Lô có " + soLuongNhap.add(soLuongLoi).stripTrailingZeros().toPlainString()
                            + " sản phẩm, vượt quá số lượng cần nhập của PO (" + soLuongCanNhap.intValue() + ")");
        }
        soLuongNhap = BigDecimal.valueOf(soLuongNhap.intValueExact());
        soLuongLoi = BigDecimal.valueOf(soLuongLoi.intValueExact());

        // Ngày sản xuất: bắt buộc (khóa duy nhất của lô gồm ngày sản xuất), không sau hôm nay, quy về đầu ngày
        // theo lịch Việt Nam (lưu nửa đêm UTC của ngày đó như frontend gửi) để so trùng và lưu nhất quán.
        if (request.getNgaySanXuat() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Chọn ngày sản xuất của lô");
        }
        LocalDate ngaySanXuat = LocalDate.ofInstant(request.getNgaySanXuat(), MUI_GIO_VN);
        if (ngaySanXuat.isAfter(LocalDate.now(MUI_GIO_VN))) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Ngày sản xuất không được sau hôm nay");
        }
        if (ngaySanXuat.isBefore(NSX_SOM_NHAT)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Ngày sản xuất không hợp lệ, kiểm tra lại năm");
        }
        Instant nsx = ngaySanXuat.atStartOfDay(ZoneOffset.UTC).toInstant();

        // Hàng không đạt phải có lý do (lưu theo lô để biên bản trả hàng đọc từ máy chủ); giữ lỗi cũ thì không thay chi tiết
        List<ChiTietLoiLoHang> dsLoi = giuLoiCu ? List.of() : chuanHoaChiTietLoi(request, soLuongLoi.intValue());

        if (Boolean.TRUE.equals(request.getTaoMoi()) && existingCtOpt.isPresent()) {
            throw new CommonException(HttpStatus.CONFLICT,
                    "Mã lô " + maLo + " đã có ở một lô đã khóa của biến thể này trong phiếu. Đổi mã lô khác.");
        }
        Integer loDangSuaId = existingCtOpt.map(ct -> ct.getLoHang().getId()).orElse(null);

        // Khóa duy nhất của lô là (biến thể, mã lô, ngày sản xuất): báo rõ thay vì để CSDL trả lỗi trùng khóa
        for (LoHang loCungMa : loHangRepository.findByBienTheSanPham_IdAndMaLo(request.getBienTheSanPhamId(), maLo)) {
            if (loCungMa.getId().equals(loDangSuaId)) continue;
            if (Objects.equals(loCungMa.getNgaySanXuat(), nsx)) {
                throw new CommonException(HttpStatus.CONFLICT,
                        "Mã lô " + maLo + " với ngày sản xuất này đã dùng cho một lô khác của biến thể (có thể ở phiếu nhập khác). Đổi mã lô khác.");
            }
        }

        // Lô có hàng đạt phải lên kệ khi kho đã có kệ đang hoạt động (kho chưa dựng kệ thì nhập kho chưa gắn kệ)
        if (viTriKhoId == null && soLuongNhap.signum() > 0
                && viTriKhoRepository.existsByKho_IdAndTrangThai(phieu.getKho().getId(), "HOAT_DONG")) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Chọn kệ cho " + soLuongNhap.intValue() + " sản phẩm đạt của lô " + maLo);
        }

        // Kiểm tra và xác thực vị trí kệ (nếu có chọn)
        ViTriKho viTri = null;
        if (viTriKhoId != null) {
            // Khóa dòng kệ: hai lô lên cùng kệ cùng lúc chạy tuần tự, lô sau thấy "chờ nhập" của lô trước
            viTri = viTriKhoRepository.khoaTheoId(viTriKhoId)
                    .orElseThrow(() -> new CommonException("Không tìm thấy vị trí kệ ID: " + viTriKhoId));
            if (!viTri.getKhuVucKho().getKho().getId().equals(phieu.getKho().getId())) {
                throw new CommonException(HttpStatus.FORBIDDEN, "Vị trí kệ không thuộc kho của phiếu nhập");
            }
            if (viTri.getTrangThai() != null && !"HOAT_DONG".equalsIgnoreCase(viTri.getTrangThai())) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Vị trí kệ đang bị khóa hoặc ngừng hoạt động");
            }
            if (viTri.getSucChuaToiDa() != null && viTri.getSucChuaToiDa() > 0 && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                Integer tonTrenKe = tonKhoViTriRepository.sumDangChuaByViTriId(viTri.getId());
                int dangChua = tonTrenKe != null ? tonTrenKe : 0;
                // Lô đã khóa của các phiếu chưa nhập kho cũng sẽ lên kệ này
                Long choNhapTrenKe = chiTietPhieuNhapKhoRepository.sumChoNhapTheoViTri(viTri.getId(), loDangSuaId);
                int choNhap = choNhapTrenKe != null ? choNhapTrenKe.intValue() : 0;
                if (dangChua + choNhap + soLuongNhap.intValue() > viTri.getSucChuaToiDa()) {
                    int conTrong = Math.max(0, viTri.getSucChuaToiDa() - dangChua - choNhap);
                    throw new CommonException(HttpStatus.BAD_REQUEST,
                            "Vị trí kệ " + viTri.getMaViTri() + " chỉ còn trống " + conTrong + ", lô có " + soLuongNhap.intValue()
                                    + " sản phẩm đạt (Sức chứa: " + viTri.getSucChuaToiDa() + ", Đang chứa: " + dangChua
                                    + ", Chờ nhập từ lô đã khóa: " + choNhap + "). Chọn kệ khác.");
                }
            }
        }

        List<ChiTietPhieuNhapKho> dsLoHienTai = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, request.getBienTheSanPhamId());

        int tongDatCu = 0;
        int tongLoiCu = 0;
        for (ChiTietPhieuNhapKho ct : dsLoHienTai) {
            if (existingCtOpt.isPresent() && ct.getId().equals(existingCtOpt.get().getId())) {
                continue; // bỏ qua bản ghi cũ nếu đang sửa
            }
            tongDatCu += (ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue());
            tongLoiCu += (ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0);
        }

        int tongKiemDemSau = tongDatCu + tongLoiCu + soLuongNhap.intValue() + soLuongLoi.intValue();
        if (tongKiemDemSau > soLuongCanNhap.intValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Tổng số lượng kiểm đếm (Đạt + Lỗi: " + tongKiemDemSau + ") vượt quá số lượng cần nhập của PO (" + soLuongCanNhap.intValue() + ")");
        }

        LoHang loDaLuu;
        try {
            if (existingCtOpt.isPresent()) {
                ChiTietPhieuNhapKho ct = existingCtOpt.get();
                ct.setSoLuongNhap(soLuongNhap);
                ct.setGhiChu(request.getGhiChu());
                LoHang lo = ct.getLoHang();
                lo.setNgaySanXuat(nsx);
                lo.setViTriKho(viTri);
                lo.setSoLuongNhap(soLuongNhap.intValue());
                lo.setSoLuongConLai(soLuongNhap.intValue());
                lo.setSoLuongLoi(soLuongLoi.intValue());
                lo.setTrangThai("TAM_KHOA");
                lo.setGhiChu(request.getGhiChu());
                // Lô đã có (UPDATE, đổi được ngày sản xuất): đẩy lệnh xuống CSDL ngay để trùng khóa duy nhất của lô báo
                // lỗi tại đây (409 bên dưới) thay vì lúc commit, ngoài try/catch
                loDaLuu = loHangRepository.saveAndFlush(lo);
                chiTietPhieuNhapKhoRepository.save(ct);
                if (!giuLoiCu) {
                    chiTietLoiLoHangRepository.deleteByLoHangId(lo.getId());
                }
            } else {
                // Khóa chính tự tăng: lệnh INSERT chạy ngay ở save, trùng khóa duy nhất của lô báo lỗi tại đây
                loDaLuu = loHangRepository.save(LoHang.builder()
                        .bienTheSanPham(dongDraft.getBienTheSanPham())
                        .maLo(maLo)
                        .ngaySanXuat(nsx)
                        .viTriKho(viTri)
                        .soLuongNhap(soLuongNhap.intValue())
                        .soLuongConLai(soLuongNhap.intValue())
                        .soLuongLoi(soLuongLoi.intValue())
                        .trangThai("TAM_KHOA")
                        .giaVon(dongDraft.getDonGia())
                        .nhaCungCap(phieu.getNhaCungCap())
                        .ghiChu(request.getGhiChu())
                        .build());

                chiTietPhieuNhapKhoRepository.save(ChiTietPhieuNhapKho.builder()
                        .phieuNhapKho(phieu)
                        .bienTheSanPham(dongDraft.getBienTheSanPham())
                        .loHang(loDaLuu)
                        .soLuongNhap(soLuongNhap)
                        .donGia(dongDraft.getDonGia())
                        .ghiChu(request.getGhiChu())
                        .build());
            }
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // Hai phiếu khác nhau khóa cùng (biến thể, mã lô, ngày sản xuất) cùng lúc: kiểm tra trùng ở trên không
            // thấy nhau, máy sau vướng khóa duy nhất unique_bien_the_lo. Lỗi ràng buộc khác vẫn ném nguyên.
            if (isDuplicateLoHang(ex)) {
                throw new CommonException(HttpStatus.CONFLICT,
                        "Mã lô " + maLo + " với ngày sản xuất này vừa được dùng cho một lô khác của biến thể (phiếu nhập khác khóa cùng lúc). Đổi mã lô khác.");
            }
            throw ex;
        }
        for (ChiTietLoiLoHang loi : dsLoi) {
            loi.setLoHang(loDaLuu);
        }
        if (!dsLoi.isEmpty()) {
            chiTietLoiLoHangRepository.saveAll(dsLoi);
        }

        // Cập nhật số lượng đạt/lỗi tổng và trạng thái kiểm đếm của dòng draft
        int tongDatMoi = tongDatCu + soLuongNhap.intValue();
        int tongLoiMoi = tongLoiCu + soLuongLoi.intValue();
        dongDraft.setSoLuongDatQc(tongDatMoi);
        dongDraft.setSoLuongLoiQc(tongLoiMoi);
        dongDraft.setSoLuongYeuCau(soLuongCanNhap.intValue());
        if (tongDatMoi + tongLoiMoi >= soLuongCanNhap.intValue()) {
            dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
        } else if (tongDatMoi + tongLoiMoi > 0) {
            dongDraft.setTrangThaiKiemDem("DANG_KIEM_DEM");
        } else {
            dongDraft.setTrangThaiKiemDem("CHO_KIEM_DEM");
        }
        chiTietPhieuNhapKhoRepository.save(dongDraft);
    }

    /**
     * Chi tiết hàng không đạt của lô, tổng phải bằng {@code soLuongLoi}. Cùng lý do thì gộp một dòng
     * (không phân biệt hoa thường và khoảng trắng thừa: "Bung chỉ" và "bung  chỉ" là một lý do, giữ cách viết đầu tiên).
     * Không gửi {@code chiTietLoi} thì dùng {@code lyDoLoi} cũ cho cả số lỗi; có lỗi mà không có lý do thì báo lỗi.
     */
    private List<ChiTietLoiLoHang> chuanHoaChiTietLoi(KhaiBaoLoRequest request, int soLuongLoi) {
        Map<String, ChiTietLoiLoHang> theoLyDo = new LinkedHashMap<>();
        if (request.getChiTietLoi() != null && !request.getChiTietLoi().isEmpty()) {
            long tong = 0;
            for (KhaiBaoLoRequest.ChiTietLoiRequest dong : request.getChiTietLoi()) {
                if (dong == null) continue;
                String lyDo = dong.getLyDo() != null ? dong.getLyDo().trim().replaceAll("\\s+", " ") : "";
                if (lyDo.isEmpty()) {
                    throw new CommonException(HttpStatus.BAD_REQUEST, "Mỗi dòng hàng không đạt cần có lý do");
                }
                if (lyDo.length() > 50) {
                    throw new CommonException(HttpStatus.BAD_REQUEST, "Lý do không đạt tối đa 50 ký tự");
                }
                if (dong.getSoLuong() == null || dong.getSoLuong() <= 0) {
                    throw new CommonException(HttpStatus.BAD_REQUEST, "Số lượng không đạt theo lý do \"" + lyDo + "\" phải lớn hơn 0");
                }
                if (dong.getSoLuong() > soLuongLoi) {
                    throw new CommonException(HttpStatus.BAD_REQUEST,
                            "Số lượng không đạt theo lý do \"" + lyDo + "\" vượt số không đạt của lô (" + soLuongLoi + ")");
                }
                String ghiChu = dong.getGhiChu() != null && !dong.getGhiChu().isBlank() ? dong.getGhiChu().trim() : null;
                tong += dong.getSoLuong();
                String khoa = lyDo.toLowerCase(java.util.Locale.ROOT);
                ChiTietLoiLoHang cu = theoLyDo.get(khoa);
                if (cu == null) {
                    theoLyDo.put(khoa, ChiTietLoiLoHang.builder().lyDo(lyDo).soLuong(dong.getSoLuong()).ghiChu(ghiChu).build());
                } else {
                    cu.setSoLuong(cu.getSoLuong() + dong.getSoLuong());
                    if (ghiChu != null) cu.setGhiChu(cu.getGhiChu() == null ? ghiChu : cu.getGhiChu() + "; " + ghiChu);
                }
            }
            if (tong != soLuongLoi) {
                throw new CommonException(HttpStatus.BAD_REQUEST,
                        "Tổng hàng không đạt theo lý do (" + tong + ") phải bằng số không đạt của lô (" + soLuongLoi + ")");
            }
        } else if (soLuongLoi > 0) {
            String lyDo = request.getLyDoLoi() != null ? request.getLyDoLoi().trim().replaceAll("\\s+", " ") : "";
            if (lyDo.isEmpty()) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Cần chọn lý do cho " + soLuongLoi + " sản phẩm không đạt");
            }
            // Báo lỗi thay vì cắt bớt: lý do bị cắt ngầm sẽ khác lý do người kiểm đã chọn trên biên bản
            if (lyDo.length() > 50) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Lý do không đạt tối đa 50 ký tự");
            }
            theoLyDo.put(lyDo, ChiTietLoiLoHang.builder().lyDo(lyDo).soLuong(soLuongLoi).build());
        }
        for (ChiTietLoiLoHang dong : theoLyDo.values()) {
            if (dong.getGhiChu() != null && dong.getGhiChu().length() > 255) {
                dong.setGhiChu(dong.getGhiChu().substring(0, 255));
            }
        }
        return new ArrayList<>(theoLyDo.values());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void hoanTatKiemDemBienThe(Integer phieuNhapKhoId, Integer bienTheSanPhamId) {
        PhieuNhapKho phieu = ((PhieuNhapKhoRepository) repository).khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());
        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được hoàn tất kiểm đếm khi phiếu ở trạng thái Nháp");
        }
        ChiTietPhieuNhapKho dongDraft = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, bienTheSanPhamId)
                .orElseThrow(() -> new CommonException("Biến thể không thuộc phiếu nhập này"));

        List<ChiTietPhieuNhapKho> dsLo = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheSanPhamId);
        int tongDat = dsLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                .sum();
        int tongLoi = dsLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                .sum();
        int tongKiemDem = tongDat + tongLoi;
        int soLuongPo = dongDraft.getSoLuongNhap().intValue();

        if (tongKiemDem < soLuongPo) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Tổng kiểm đếm (" + tongKiemDem + ") chưa đạt số lượng yêu cầu của PO (" + soLuongPo + ")");
        }

        dongDraft.setSoLuongDatQc(tongDat);
        dongDraft.setSoLuongLoiQc(tongLoi);
        dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
        chiTietPhieuNhapKhoRepository.save(dongDraft);
    }

    @Transactional(readOnly = true)
    public List<LoHangKhaiBaoDto> getDanhSachLoDaKhaiBao(Integer phieuNhapKhoId, Integer bienTheSanPhamId) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy phiếu nhập"));
        KhoDangChon.kiemTraXem(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        List<ChiTietPhieuNhapKho> dsLo = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheSanPhamId);
        Map<Integer, List<ChiTietLoiLoHangDto>> loiTheoLo = new HashMap<>();
        List<Integer> loIds = dsLo.stream().map(ct -> ct.getLoHang().getId()).toList();
        if (!loIds.isEmpty()) {
            for (ChiTietLoiLoHang loi : chiTietLoiLoHangRepository.findByLoHangIds(loIds)) {
                loiTheoLo.computeIfAbsent(loi.getLoHang().getId(), k -> new ArrayList<>())
                        .add(ChiTietLoiLoHangDto.builder().lyDo(loi.getLyDo()).soLuong(loi.getSoLuong()).ghiChu(loi.getGhiChu()).build());
            }
        }
        return dsLo.stream()
                .map(ct -> {
                    LoHang lo = ct.getLoHang();
                    return LoHangKhaiBaoDto.builder()
                            .chiTietPhieuNhapKhoId(ct.getId())
                            .loHangId(lo.getId())
                            .maLo(lo.getMaLo())
                            .ngaySanXuat(lo.getNgaySanXuat())
                            .soLuongNhap(BigDecimal.valueOf(lo.getSoLuongNhap() != null ? lo.getSoLuongNhap() : ct.getSoLuongNhap().intValue()))
                            .soLuongLoi(BigDecimal.valueOf(lo.getSoLuongLoi() != null ? lo.getSoLuongLoi() : 0))
                            .viTriKhoId(lo.getViTriKho() != null ? lo.getViTriKho().getId() : null)
                            .maViTri(lo.getViTriKho() != null ? lo.getViTriKho().getMaViTri() : null)
                            .trangThai(lo.getTrangThai())
                            .ghiChu(ct.getGhiChu())
                            .chiTietLoi(loiTheoLo.getOrDefault(lo.getId(), List.of()))
                            .build();
                })
                .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void xoaLo(Integer phieuNhapKhoId, Integer chiTietId) {
        // Khóa dòng phiếu trước (cùng thứ tự với khóa lô / nhập kho / hủy phiếu): xóa lô không chạy chen với nhập kho
        PhieuNhapKho phieu = ((PhieuNhapKhoRepository) repository).khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu"));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new CommonException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể xóa!");
        }

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được xóa lô ở trạng thái Nháp");
        }
        // Như huyPhieuNhap: phiếu chuyển kho mang lô THẬT của kho gửi (đang có tồn, lịch sử), không phải lô kiểm đếm tạo
        if (phieu.getDonMuaHang() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Phiếu nhập " + phieu.getSoPhieuNhap() + " dùng lô của kho gửi (lô tự động), không xóa lô được. Chỉ xóa lô của phiếu nhập từ đơn mua.");
        }
        ChiTietPhieuNhapKho ct = chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(chiTietId, phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy lô"));
        // Dòng dự kiến (chưa có lô) không xóa được qua đây: xóa nó làm mất số cần nhập, phiếu thiếu hàng vẫn nhập kho được
        if (ct.getLoHang() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Không tìm thấy lô");
        }
        Integer bienTheId = ct.getBienTheSanPham().getId();
        LoHang lo = ct.getLoHang();
        if (lo != null) {
            // Chi tiết lỗi đi theo lô; dòng biên bản trả hàng (nếu đã lập) chỉ còn giữ mã lô và biên bản bị đánh dấu lệch
            chiTietLoiLoHangRepository.deleteByLoHangId(lo.getId());
            chiTietTraHangNccRepository.boLienKetLo(lo.getId());
        }
        chiTietPhieuNhapKhoRepository.delete(ct);
        if (lo != null) {
            loHangRepository.delete(lo);
        }

        // Cập nhật lại dòng draft
        Optional<ChiTietPhieuNhapKho> dongDraftOpt = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, bienTheId);
        if (dongDraftOpt.isPresent()) {
            ChiTietPhieuNhapKho dongDraft = dongDraftOpt.get();
            List<ChiTietPhieuNhapKho> dsConLai = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheId);
            int dat = dsConLai.stream().mapToInt(c -> c.getLoHang().getSoLuongNhap() != null ? c.getLoHang().getSoLuongNhap() : c.getSoLuongNhap().intValue()).sum();
            int loi = dsConLai.stream().mapToInt(c -> c.getLoHang().getSoLuongLoi() != null ? c.getLoHang().getSoLuongLoi() : 0).sum();
            dongDraft.setSoLuongDatQc(dat);
            dongDraft.setSoLuongLoiQc(loi);
            int canNhap = dongDraft.getSoLuongNhap() != null ? dongDraft.getSoLuongNhap().intValue() : 0;
            if (dat + loi >= canNhap && canNhap > 0) {
                dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
            } else if (dat + loi > 0) {
                dongDraft.setTrangThaiKiemDem("DANG_KIEM_DEM");
            } else {
                dongDraft.setTrangThaiKiemDem("CHO_KIEM_DEM");
            }
            chiTietPhieuNhapKhoRepository.save(dongDraft);
        }
    }

    @Transactional(readOnly = true)
    public ChiTietPhieuNhapKhoDto getDetail(Integer id) {
        PhieuNhapKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập id: " + id));
        KhoDangChon.kiemTraXem(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        Integer phieuXuatGocId = null;
        if (phieu.getPhieuChuyenKhoGoc() != null) {
            phieuXuatGocId = phieu.getPhieuChuyenKhoGoc().getId();
        }

        Map<Integer, PhieuNhapKhoItemDto> itemsMap = new LinkedHashMap<>();
        List<ChiTietPhieuNhapKho> danhSachNhapTheoLo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(id);

        for (ChiTietPhieuNhapKho ct : phieu.getChiTietPhieuNhapKhos()) {
            Integer btId = ct.getBienTheSanPham().getId();
            BienTheSanPham bt = ct.getBienTheSanPham();
            PhieuNhapKhoItemDto dto = itemsMap.computeIfAbsent(btId, k -> PhieuNhapKhoItemDto.builder()
                    .bienTheSanPhamId(btId)
                    .sku(bt.getMaSku())
                    .tenBienThe(bt.getSanPham().getTenSanPham())
                    .mauSac(bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null)
                    .kichCo(bt.getSize() != null ? bt.getSize().getTenSize() : null)
                    .maMauHex(bt.getMauSac() != null ? bt.getMauSac().getMaMauHex() : null)
                    .anh(com.dev.backend.utils.HienThiBienThe.anh(bt))
                    .sanPhamId(bt.getSanPham().getId())
                    .maVachSku(bt.getMaVachSku())
                    .maVachNcc(new ArrayList<>())
                    .soLuongCanNhap(BigDecimal.ZERO)
                    .soLuongDaKhaiBao(BigDecimal.ZERO)
                    .soLuongDatQc(0)
                    .soLuongLoiQc(0)
                    .soLoDaKhoa(0)
                    .trangThaiKiemDem("CHO_KIEM_DEM")
                    .build());

            if (ct.getLoHang() == null) {
                dto.setSoLuongCanNhap(ct.getSoLuongNhap());
                if (ct.getTrangThaiKiemDem() != null) {
                    dto.setTrangThaiKiemDem(ct.getTrangThaiKiemDem());
                }
            } else {
                BigDecimal slMoi = ct.getSoLuongNhap() != null ? ct.getSoLuongNhap() : BigDecimal.ZERO;
                dto.setSoLuongDaKhaiBao(dto.getSoLuongDaKhaiBao().add(slMoi));
                if (phieu.getDonMuaHang() == null) {
                    dto.setSoLuongCanNhap(dto.getSoLuongDaKhaiBao());
                }
            }
        }

        // Tính toán các chỉ số QC chi tiết theo từng biến thể từ các lô đã khai báo
        for (PhieuNhapKhoItemDto dto : itemsMap.values()) {
            Integer btId = dto.getBienTheSanPhamId();
            List<ChiTietPhieuNhapKho> lotsForBt = danhSachNhapTheoLo.stream()
                    .filter(ct -> ct.getBienTheSanPham().getId().equals(btId))
                    .toList();

            int dat = lotsForBt.stream()
                    .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                    .sum();
            int loi = lotsForBt.stream()
                    .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                    .sum();

            dto.setSoLuongDatQc(dat);
            dto.setSoLuongLoiQc(loi);
            dto.setSoLoDaKhoa(lotsForBt.size());

            int canNhap = dto.getSoLuongCanNhap() != null ? dto.getSoLuongCanNhap().intValue() : 0;
            boolean daDu = (dat + loi >= canNhap) && canNhap > 0;
            dto.setDaDuLo(daDu);

            if (!"DA_HOAN_TAT".equals(dto.getTrangThaiKiemDem())) {
                if (daDu) {
                    dto.setTrangThaiKiemDem("DA_HOAN_TAT");
                } else if (dat + loi > 0) {
                    dto.setTrangThaiKiemDem("DANG_KIEM_DEM");
                } else {
                    dto.setTrangThaiKiemDem("CHO_KIEM_DEM");
                }
            }
        }

        List<PhieuNhapKhoItemDto> items = new ArrayList<>(itemsMap.values());

        // Mã vạch NCC đã liên kết của các biến thể trong phiếu (theo NCC của phiếu): màn kiểm đếm nhận mã không cần gọi máy chủ
        if (phieu.getNhaCungCap() != null && !itemsMap.isEmpty()) {
            for (Object[] dong : maVachNhaCungCapRepository.findBarcodeTheoBienThe(phieu.getNhaCungCap().getId(), itemsMap.keySet())) {
                PhieuNhapKhoItemDto item = itemsMap.get(((Number) dong[0]).intValue());
                if (item != null) item.getMaVachNcc().add((String) dong[1]);
            }
        }

        // Tổng số lượng Đạt, Lỗi và Tiến độ toàn phiếu
        int tongDat = items.stream().mapToInt(i -> i.getSoLuongDatQc() != null ? i.getSoLuongDatQc() : 0).sum();
        int tongLoi = items.stream().mapToInt(i -> i.getSoLuongLoiQc() != null ? i.getSoLuongLoiQc() : 0).sum();
        int tongCanNhap = items.stream().mapToInt(i -> i.getSoLuongCanNhap() != null ? i.getSoLuongCanNhap().intValue() : 0).sum();
        double tienDo = tongCanNhap > 0
                ? Math.min(100.0, Math.round(((double) (tongDat + tongLoi) / tongCanNhap) * 1000.0) / 10.0)
                : 100.0;

        // Chốt chặn Safety Lock (Hàng lỗi và Biên bản RTV)
        Optional<BienBanTraHangNcc> rtvOpt = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieu.getId())
                .filter(BienBanTraHangNcc::dangHieuLuc);
        boolean coBienBanRtv = rtvOpt.isPresent();
        String maBienBanRtv = rtvOpt.map(BienBanTraHangNcc::getMaBienBan).orElse(null);
        Integer tongLoiBienBan = rtvOpt.map(b -> b.getTongSoLuongLoi() != null ? b.getTongSoLuongLoi() : 0).orElse(null);
        // Lập biên bản xong rồi xóa / khóa lại lô lỗi: biên bản không còn khớp, phải lập lại (chỉ xét khi phiếu còn Nháp)
        boolean bienBanLech = coBienBanRtv && phieu.getTrangThai() == TrangThaiPhieuNhap.DRAFT.getValue()
                && !bienBanTraHangService.khopHangLoiHienTai(rtvOpt.get());
        boolean safetyLock = (tongLoi > 0 && !coBienBanRtv) || bienBanLech;

        boolean allItemsDone = !items.isEmpty() && items.stream().allMatch(i -> Boolean.TRUE.equals(i.getDaDuLo()) || "DA_HOAN_TAT".equals(i.getTrangThaiKiemDem()));
        boolean coTheNhapKho = (phieu.getTrangThai() == TrangThaiPhieuNhap.DRAFT.getValue()) && allItemsDone && !safetyLock;

        ChiTietPhieuNhapKhoDto.ChiTietPhieuNhapKhoDtoBuilder builder = ChiTietPhieuNhapKhoDto.builder()
                .id(phieu.getId())
                .phieuXuatGocId(phieuXuatGocId)
                .soPhieuNhap(phieu.getSoPhieuNhap())
                .trangThai(phieu.getTrangThai())
                .ngayNhap(phieu.getNgayNhap())
                .khoId(phieu.getKho().getId())
                .tenKho(phieu.getKho().getTenKho())
                .items(items)
                .tienDoKiemDem(tienDo)
                .tongSoLuongDat(tongDat)
                .tongSoLuongLoi(tongLoi)
                .coBienBanRtv(coBienBanRtv)
                .maBienBanRtv(maBienBanRtv)
                .safetyLock(safetyLock)
                .coTheNhapKho(coTheNhapKho)
                .tongLoiBienBan(tongLoiBienBan)
                .bienBanLech(bienBanLech)
                .phuongAnBienBan(rtvOpt.map(BienBanTraHangNcc::getPhuongAnXuLy).orElse(null))
                .cheDoXacNhanChatLuong(cheDoXacNhanChatLuong())
                .tienToMaLo(tienToMaLo())
                .tenNguoiNhap(phieu.getNguoiNhap() != null ? phieu.getNguoiNhap().getHoTen() : null)
                .tenNguoiDuyet(phieu.getNguoiDuyet() != null ? phieu.getNguoiDuyet().getHoTen() : null);

        if (phieu.getDonMuaHang() == null) {
            boolean isReturn = phieu.getPhieuChuyenKhoGoc() != null && phieu.getKho().getId().equals(phieu.getPhieuChuyenKhoGoc().getKho().getId());
            builder.loaiNhap(isReturn ? "Nhập hoàn trả (Hủy chuyển kho)" : "Chuyển kho nội bộ");

            List<String> tenKhoNguonList = lichSuGiaoDichKhoRepository.findTenKhoNguonByPhieuNhap(id);
            if (!tenKhoNguonList.isEmpty()) builder.tenKhoChuyenTu(tenKhoNguonList.get(0));
        } else {
            builder.loaiNhap("Nhập từ đơn mua hàng");
            builder.donMuaHangId(phieu.getDonMuaHang().getId()).soDonMua(phieu.getDonMuaHang().getSoDonMua());
            if (phieu.getNhaCungCap() != null) {
                builder.nhaCungCapId(phieu.getNhaCungCap().getId()).tenNhaCungCap(phieu.getNhaCungCap().getTenNhaCungCap());
            }
        }
        return builder.build();
    }

    /** Cấu hình KIEM_DEM_XAC_NHAN; thiếu hoặc sai giá trị thì dùng mặc định "Quét tiếp là Đạt". */
    private String cheDoXacNhanChatLuong() {
        String giaTri = cauHinhHeThongRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_KIEM_DEM_XAC_NHAN)
                .map(CauHinhHeThong::getGiaTri)
                .orElse(null);
        return DieuHanhHeThongServiceImpl.KIEM_DEM_QUET_THE_TUNG_CAI.equals(giaTri)
                ? DieuHanhHeThongServiceImpl.KIEM_DEM_QUET_THE_TUNG_CAI
                : DieuHanhHeThongServiceImpl.KIEM_DEM_QUET_TIEP_LA_DAT;
    }

    /** Cấu hình MA_LO_TIEN_TO; thiếu hoặc sai dạng thì dùng mặc định "LO". */
    private String tienToMaLo() {
        String giaTri = cauHinhHeThongRepository.findById(DieuHanhHeThongServiceImpl.CAU_HINH_MA_LO_TIEN_TO)
                .map(CauHinhHeThong::getGiaTri)
                .orElse(null);
        return giaTri != null && DieuHanhHeThongServiceImpl.TIEN_TO_MA_PATTERN.matcher(giaTri).matches()
                && !DieuHanhHeThongServiceImpl.laTienToMaLoTrungTheLenh(giaTri)
                ? giaTri
                : DieuHanhHeThongServiceImpl.MA_LO_TIEN_TO_MAC_DINH;
    }

    private String generateSoPhieu() {
        // Ngày trong số phiếu theo lịch Việt Nam, không theo múi giờ của máy chủ
        String dateStr = java.time.LocalDate.now(MUI_GIO_VN).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "PN" + dateStr;
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix);
        return prefix + (countToday + 1);
    }

    private boolean isDuplicateSoPhieu(Exception ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("uk_phieu_nhap_kho_so_phieu")) return true;
            cause = cause.getCause();
        }
        return false;
    }

    /** Trùng khóa duy nhất của lô (biến thể, mã lô, ngày sản xuất). */
    private boolean isDuplicateLoHang(Exception ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("unique_bien_the_lo")) return true;
            cause = cause.getCause();
        }
        return false;
    }
    @Transactional
    public void completeTransferReceipt(Integer phieuNhapId, Integer nguoiNhapId) {
        //Tìm phiếu nhập
        PhieuNhapKho phieu = repository.findById(phieuNhapId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu nhập"));

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new RuntimeException("Chỉ phiếu Nháp mới có thể hoàn tất nhập kho");
        }

        PhieuXuatKho pck = phieu.getPhieuChuyenKhoGoc();
        if (pck == null) {
            throw new RuntimeException("Phiếu nhập này không thuộc luồng luân chuyển kho");
        }

        NguoiDung nguoiNhap = nguoiDungRepository.findById(nguoiNhapId).orElseThrow();
        Kho khoDich = phieu.getKho();

        //Lấy kho trung chuyển
        Kho khoTransit = entityManager.createQuery("SELECT k FROM Kho k WHERE k.maKho = 'KHO_TRANSIT'", Kho.class)
                .getSingleResult();
        if (khoTransit == null) throw new RuntimeException("Lỗi: Hệ thống chưa cấu hình KHO_TRANSIT");

        boolean isReturn = khoDich.getId().equals(pck.getKho().getId());

        List<ChiTietPhieuNhapKho> details = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapId);
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = details.stream()
                .map(ct -> ct.getLoHang().getId())
                .distinct()
                .toList();
        tonKhoTheoLoRepository.lockLotsForUpdateByLotIds(lotIdsToLock);

        for (ChiTietPhieuNhapKho ct : details) {
            BigDecimal qty = ct.getSoLuongNhap();
            LoHang lo = ct.getLoHang();

            // TRỪ TỒN TẠI KHO TRUNG CHUYỂN
            TonKhoTheoLo tonTransit = tonKhoTheoLoRepository
                    .findByKho_IdAndLoHang_Id(khoTransit.getId(), lo.getId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy hàng trong kho trung chuyển cho lô: " + lo.getMaLo()));

            BigDecimal tonTruocTransit = tonTransit.getSoLuongTon();
            tonTransit.setSoLuongTon(tonTruocTransit.subtract(qty));
            tonKhoTheoLoRepository.save(tonTransit);

            // CỘNG TỒN VÀO KHO ĐÍCH
            TonKhoTheoLo tonDich = tonKhoTheoLoRepository
                    .findByKho_IdAndLoHang_Id(khoDich.getId(), lo.getId())
                    .orElse(TonKhoTheoLo.builder()
                            .kho(khoDich).loHang(lo)
                            .soLuongTon(BigDecimal.ZERO).soLuongDaDat(BigDecimal.ZERO)
                            .build());

            BigDecimal tonTruocDich = tonDich.getSoLuongTon();
            tonDich.setSoLuongTon(tonTruocDich.add(qty));
            tonDich.setNgayNhapGanNhat(Instant.now());
            tonKhoTheoLoRepository.save(tonDich);

            // GHI LỊCH SỬ GIAO DỊCH
            String loaiGiaoDichNote = isReturn ? "Hoàn trả nhập kho (Hủy yêu cầu): " : "Nhập chuyển kho từ yêu cầu: ";
            LichSuGiaoDichKho history = LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(Instant.now())
                    .loaiGiaoDich("nhap_kho")
                    .loaiThamChieu("phieu_nhap_kho")
                    .idThamChieu(phieu.getId())
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .loHang(lo)
                    .kho(khoDich)
                    .soLuong(qty)
                    .soLuongTruoc(tonTruocDich)
                    .soLuongSau(tonDich.getSoLuongTon())
                    .giaVon(ct.getDonGia())
                    .nguoiDung(nguoiNhap)
                    .ghiChu(loaiGiaoDichNote + pck.getSoPhieuXuat())
                    .build();
            lichSuGiaoDichKhoRepository.save(history);
            sanPhamIdsCanCapNhat.add(ct.getBienTheSanPham().getSanPham().getId());
        }

        // Cập nhật trạng thái phiếu nhập
        phieu.setTrangThai(TrangThaiPhieuNhap.COMPLETED.getValue());
        phieu.setNgayNhap(Instant.now());
        phieu.setNguoiNhap(nguoiNhap);
        repository.save(phieu);

        // Chốt trạng thái Phiếu Chuyển Kho gốc = 5 (Hoàn tất) NẾU là nhập thành công cho kho B
        if (!isReturn) {
            pck.setTrangThai(5);
            phieuXuatKhoRepository.save(pck);
        }
        entityManager.flush();
        for (Integer spId : sanPhamIdsCanCapNhat) {
            sanPhamQuanAoService.recalculatePriceAndStatus(spId);
        }
    }
    @Transactional
    public PhieuNhapKho createImportFromTransfer(Integer pckId) {
        // Tìm phiếu yêu cầu chuyển kho gốc
        PhieuXuatKho pck = phieuXuatKhoRepository.findById(pckId)
                .orElseThrow(() -> new CommonException("Không tìm thấy yêu cầu chuyển kho"));

        if (!"khac".equals(pck.getLoaiXuat()) || pck.getPhieuChuyenKhoGoc() != null) {
            throw new CommonException("Đây không phải là phiếu yêu cầu chuyển kho gốc");
        }

        Kho khoDich;
        String prefix;
        String ghiChu;

        // Xác định luồng: Nhập bình thường (Kho B) hay Nhập Hoàn trả (Kho A)
        if (pck.getTrangThai() == 3) {
            khoDich = pck.getKhoChuyenDen();
            prefix = "PN-TRF-";
            ghiChu = "Nhập kho thủ công từ phiếu chuyển: " + pck.getSoPhieuXuat();
        } else if (pck.getTrangThai() == 4) {
            khoDich = pck.getKho(); // Nhập trả về lại kho nguồn
            prefix = "PN-RET-";
            ghiChu = "Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: " + pck.getSoPhieuXuat();
        } else {
            throw new CommonException("Trạng thái phiếu chuyển không hợp lệ để tạo phiếu nhập");
        }

        // Tìm Phiếu Xuất Con đã thực xuất (Trạng thái = 3) để lấy thông tin hàng trong Transit
        List<PhieuXuatKho> dsPhieuXuatCon = entityManager.createQuery(
                        "SELECT p FROM PhieuXuatKho p WHERE p.phieuChuyenKhoGoc.id = :pckId AND p.trangThai = 3", PhieuXuatKho.class)
                .setParameter("pckId", pckId)
                .getResultList();

        if (dsPhieuXuatCon.isEmpty()) {
            throw new CommonException("Hàng hóa chưa được xuất khỏi kho, không thể tạo phiếu nhập.");
        }
        PhieuXuatKho phieuXuatThucTe = dsPhieuXuatCon.get(0);

        // Tạo phiếu nhập Nháp
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix + dateStr);
        String soPhieuNhap = prefix + dateStr + (countToday + 1);

        PhieuNhapKho pn = PhieuNhapKho.builder()
                .soPhieuNhap(soPhieuNhap)
                .kho(khoDich)
                .phieuChuyenKhoGoc(pck) // Liên kết khóa ngoại
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue()) // Nháp (0)
                .ngayTao(Instant.now())
                .ghiChu(ghiChu)
                .tongTien(BigDecimal.ZERO)
                .build();
        pn = repository.save(pn);

        // Kế thừa chi tiết (bao gồm cả Lô hàng) từ phiếu xuất thực tế
        List<ChiTietPhieuXuatKho> xuatDetails = entityManager.createQuery(
                        "SELECT ct FROM ChiTietPhieuXuatKho ct WHERE ct.phieuXuatKho.id = :pxId AND ct.loHang IS NOT NULL", ChiTietPhieuXuatKho.class)
                .setParameter("pxId", phieuXuatThucTe.getId())
                .getResultList();

        BigDecimal tongTien = BigDecimal.ZERO;
        for (ChiTietPhieuXuatKho xuat : xuatDetails) {
            ChiTietPhieuNhapKho ctNhap = ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(pn)
                    .bienTheSanPham(xuat.getBienTheSanPham())
                    .loHang(xuat.getLoHang()) // KẾ THỪA LÔ HÀNG ĐÃ PICK
                    .soLuongNhap(xuat.getSoLuongXuat())
                    .donGia(xuat.getGiaVon() != null ? xuat.getGiaVon() : BigDecimal.ZERO)
                    .ghiChu("Kế thừa từ hàng đi đường")
                    .build();
            chiTietPhieuNhapKhoRepository.save(ctNhap);
            tongTien = tongTien.add(ctNhap.getDonGia().multiply(ctNhap.getSoLuongNhap()));
        }

        pn.setTongTien(tongTien);
        return repository.save(pn);
    }

    @Transactional
    public PhieuNhapKho createReturnImportDraft(Integer phieuXuatKhoId, String ghiChu) {
        PhieuXuatKho px = phieuXuatKhoRepository.findById(phieuXuatKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu xuất kho"));

        DonBanHang donBanHang = px.getDonBanHang();
        if (donBanHang == null || donBanHang.getTrangThai() != 6) {
            throw new RuntimeException("Phiếu xuất này không thuộc Đơn hàng bị hoàn trả!");
        }

        Kho khoNhan = px.getKho() != null ? px.getKho() : donBanHang.getKhoXuat();
        if (khoNhan == null) {
            throw new RuntimeException("Không xác định được kho nhận trả hàng");
        }

        // Tạo số phiếu
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "PN-RET-" + dateStr;
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix);
        String soPhieuNhap = prefix + (countToday + 1);

        // Tạo phiếu nhập Nháp
        PhieuNhapKho pn = PhieuNhapKho.builder()
                .soPhieuNhap(soPhieuNhap)
                .kho(khoNhan)
                .ngayNhap(null)
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue())
                .ghiChu(ghiChu != null ? ghiChu : "Nhập hoàn trả từ phiếu xuất: " + px.getSoPhieuXuat())
                .tongTien(BigDecimal.ZERO)
                .build();
        pn = repository.save(pn);

        BigDecimal tongTienNhap = BigDecimal.ZERO;

        // Lấy chi tiết xuất kho có gắn Lô Hàng
        List<ChiTietPhieuXuatKho> dsChiTietXuat = entityManager.createQuery(
                        "SELECT ct FROM ChiTietPhieuXuatKho ct WHERE ct.phieuXuatKho.id = :pxId AND ct.loHang IS NOT NULL", ChiTietPhieuXuatKho.class)
                .setParameter("pxId", px.getId())
                .getResultList();

        for (ChiTietPhieuXuatKho ctXuat : dsChiTietXuat) {
            BigDecimal slHoanTra = ctXuat.getSoLuongXuat();
            BigDecimal donGia = ctXuat.getGiaVon() != null ? ctXuat.getGiaVon() : BigDecimal.ZERO;

            ChiTietPhieuNhapKho ctNhap = ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(pn)
                    .bienTheSanPham(ctXuat.getBienTheSanPham())
                    .loHang(ctXuat.getLoHang())
                    .soLuongNhap(slHoanTra)
                    .donGia(donGia)
                    .ghiChu("Hoàn trả từ lô: " + ctXuat.getLoHang().getMaLo())
                    .build();
            chiTietPhieuNhapKhoRepository.save(ctNhap);

            tongTienNhap = tongTienNhap.add(donGia.multiply(slHoanTra));
        }

        pn.setTongTien(tongTienNhap);
        return repository.save(pn);
    }
}