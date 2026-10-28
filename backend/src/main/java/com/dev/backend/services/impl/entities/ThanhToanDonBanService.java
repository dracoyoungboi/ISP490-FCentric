package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.ThanhToanRequest;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.thanhtoan.ThanhToanDonBanDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.ThanhToanDonBan;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PosCheckoutRequestRepository;
import com.dev.backend.repository.PosPaymentRepository;
import com.dev.backend.repository.ThanhToanDonBanRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Phiếu thu / phiếu hoàn của đơn bán thường: ghi, hủy, đối chiếu chuyển khoản và trạng thái thanh toán của đơn.
 * Mọi lần ghi hoặc hủy phiếu khóa dòng đơn trước rồi mới tính lại trạng thái, nên hai thao tác cùng lúc trên một đơn
 * không ghi đè nhau. Bán tại quầy thu ở màn Bán hàng (sổ thu pos_payment), đơn sàn thanh toán theo sàn: không ghi ở đây.
 */
@Service
public class ThanhToanDonBanService {

    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Trần một phiếu thu đơn bán thường. */
    static final BigDecimal MAX_THU = new BigDecimal("10000000000");
    /** Ghi nhận chuyển khoản lùi ngày tối đa (gõ nhầm năm thì báo ngay). */
    static final int MAX_NGAY_THU_LUI = 366;
    /** Nhân viên bán hàng ghi chuyển khoản lùi ngày tối đa (khoản cũ hơn nhờ quản trị viên ghi). */
    static final int MAX_NGAY_THU_LUI_NHAN_VIEN = 7;
    /** Phiếu giống hệt của cùng người trong khoảng này coi là bấm hai lần. */
    static final int GIAY_CHAN_GHI_LAP = 15;
    /**
     * Ngày bắt đầu ghi nhận thanh toán (yyyy-MM-dd, migration ghi lần chạy đầu): đơn tạo trước ngày này là đơn cũ "chưa
     * theo dõi"; hủy hết phiếu của đơn cũ thì đơn trở lại chưa theo dõi.
     */
    public static final String CAU_HINH_MOC = "THANH_TOAN_DON_THUONG_TU";

    private final ThanhToanDonBanRepository repository;
    private final DonBanHangRepository donBanHangRepository;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final PosPaymentRepository posPaymentRepository;
    private final PosCheckoutRequestRepository posCheckoutRequestRepository;
    private final DieuHanhHeThongService cauHinh;
    private final EntityManager entityManager;

    public ThanhToanDonBanService(ThanhToanDonBanRepository repository, DonBanHangRepository donBanHangRepository,
                                  KhoRepository khoRepository, NguoiDungRepository nguoiDungRepository,
                                  PosPaymentRepository posPaymentRepository,
                                  PosCheckoutRequestRepository posCheckoutRequestRepository,
                                  DieuHanhHeThongService cauHinh, EntityManager entityManager) {
        this.repository = repository;
        this.donBanHangRepository = donBanHangRepository;
        this.khoRepository = khoRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.posPaymentRepository = posPaymentRepository;
        this.posCheckoutRequestRepository = posCheckoutRequestRepository;
        this.cauHinh = cauHinh;
        this.entityManager = entityManager;
    }

    // ================= Trạng thái thanh toán =================

    /** Lưu phiếu mới của đơn rồi tính lại trạng thái thanh toán. tatCa = mọi phiếu của đơn, gồm cả phiếu mới. */
    void luuPhieu(DonBanHang don, ThanhToanDonBan moi, List<ThanhToanDonBan> tatCa) {
        repository.save(moi);
        capNhatTrangThai(don, tatCa);
    }

    /**
     * Trạng thái thanh toán của đơn theo các phiếu. Đơn cũ "Chưa theo dõi" (trạng thái trống, tạo trước khi có ghi nhận
     * thanh toán) mà chưa có phiếu nào thì giữ trống: hủy / hoàn trả đơn cũ không làm nó thành Chưa thanh toán.
     */
    String capNhatTrangThai(DonBanHang don, List<ThanhToanDonBan> tatCa) {
        boolean conPhieu = tatCa.stream().anyMatch(ThanhToanDonBan::hieuLuc);
        if (!conPhieu && (don.getTrangThaiThanhToan() == null || laDonCu(don))) {
            // Đơn cũ chưa theo dõi (kể cả vừa hủy hết phiếu ghi nhầm): giữ / trả về trống, không thành "Chưa thanh toán"
            if (don.getTrangThaiThanhToan() != null) {
                don.setTrangThaiThanhToan(null);
                donBanHangRepository.save(don);
            }
            return null;
        }
        String tt = TinhThanhToan.trangThai(TinhThanhToan.phaiThu(don.getTrangThai(), don.getTongCong()),
                TinhThanhToan.daThu(tatCa));
        don.setTrangThaiThanhToan(tt);
        donBanHangRepository.save(don);
        return tt;
    }

    /** Đơn tạo trước ngày bắt đầu ghi nhận thanh toán (chưa có mốc: không coi là đơn cũ). */
    boolean laDonCu(DonBanHang don) {
        String moc = cauHinh.getCauHinhString(CAU_HINH_MOC, null);
        if (moc == null || moc.isBlank() || don.getNgayTao() == null) return false;
        try {
            return don.getNgayTao().isBefore(LocalDate.parse(moc.trim()).atStartOfDay(VN).toInstant());
        } catch (RuntimeException e) {
            return false;
        }
    }

    /**
     * Đơn vừa đổi trạng thái trong giao dịch của bên gọi (hủy, bị hoàn trả — phải thu về 0): tính lại trạng thái thanh
     * toán. Ghi đơn trước (giữ khóa dòng đơn: phiếu ghi cùng lúc khóa dòng đơn trước nên đã xong hoặc phải chờ), rồi đọc
     * phiếu bằng câu có khóa để thấy cả phiếu vừa ghi ở giao dịch khác. Đơn sàn, đơn tại quầy giữ trạng thái của mình.
     */
    public void tinhLaiSauDoiDon(DonBanHang don) {
        if (!laDonThuong(don)) return;
        entityManager.flush();
        // Nạp lại có khóa: bên gọi nạp đơn không khóa, phiếu vừa ghi / hoàn ở giao dịch khác có thể đã đổi trạng thái
        entityManager.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        capNhatTrangThai(don, repository.khoaDocTheoDon(don.getId()));
    }

    /** Số đã thu (thu − hoàn) của nhiều đơn; đơn chưa có phiếu không có trong kết quả. */
    public Map<Integer, BigDecimal> daThuTheoDon(Collection<Integer> donIds) {
        Map<Integer, BigDecimal> kq = new HashMap<>();
        List<Integer> ds = new ArrayList<>(donIds);
        for (int i = 0; i < ds.size(); i += 1000) {
            for (Object[] r : repository.daThuTheoDon(ds.subList(i, Math.min(i + 1000, ds.size())))) {
                kq.put(((Number) r[0]).intValue(), new BigDecimal(r[1].toString()));
            }
        }
        return kq;
    }

    // ================= Đọc theo đơn =================

    /** Thanh toán của đơn (màn chi tiết đơn, hóa đơn in). */
    public ThanhToanDonBanDto.TheoDon theoDon(DonBanHang don) {
        return tomTatDon(don, repository.findByDonBanHangIdOrderByIdAsc(don.getId()));
    }

    ThanhToanDonBanDto.TheoDon tomTatDon(DonBanHang don, List<ThanhToanDonBan> ds) {
        BigDecimal phai = TinhThanhToan.phaiThu(don.getTrangThai(), don.getTongCong());
        BigDecimal da = TinhThanhToan.daThu(ds);
        BigDecimal chenh = da.subtract(phai);
        boolean donThuong = laDonThuong(don);
        Integer tt = don.getTrangThai();
        // Đơn cũ chưa theo dõi: không còn phiếu hiệu lực thì không báo trạng thái (không phải "Chưa thanh toán")
        boolean chuaTheoDoi = don.getTrangThaiThanhToan() == null && ds.stream().noneMatch(ThanhToanDonBan::hieuLuc);
        return ThanhToanDonBanDto.TheoDon.builder()
                .phaiThu(phai)
                .daThu(da)
                .conLai(chenh.signum() < 0 ? chenh.negate() : BigDecimal.ZERO)
                .thuThua(chenh.signum() > 0 ? chenh : BigDecimal.ZERO)
                .trangThai(chuaTheoDoi ? null : TinhThanhToan.trangThai(phai, da))
                .phieu(toDtos(ds, Map.of(don.getId(), don.getSoDonHang())))
                .donThuong(donThuong)
                .choGhiThu(donThuong && (tt == null || (tt != ITrangThaiDonBanHang.DA_HUY && tt != ITrangThaiDonBanHang.BI_HOAN_TRA)))
                .build();
    }

    /** Đơn bán thường: chứng từ đơn bán, không đồng bộ từ sàn, không bán tại quầy (có sổ thu POS). */
    boolean laDonThuong(DonBanHang don) {
        return !"bao_gia".equals(don.getLoaiChungTu()) && !laDonSan(don)
                && (don.getId() == null || (!posPaymentRepository.existsByDonBanHangId(don.getId())
                        && !posCheckoutRequestRepository.existsByDonBanHangId(don.getId())));
    }

    /** Đơn đồng bộ từ sàn: có kênh bán hoặc mã đơn bên sàn (đơn tại quầy không gắn kênh). */
    static boolean laDonSan(DonBanHang don) {
        return don.getKenhBanHang() != null || (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank());
    }

    // ================= Thu tiền =================

    /**
     * Ghi nhận khách trả tiền cho đơn bán thường (đặt cọc từ lúc Nháp, thu nhiều lần): tiền mặt hoặc chuyển khoản (bắt
     * buộc mã giao dịch). Không cho báo giá, đơn tại quầy (thu ở màn Bán hàng), đơn sàn (thanh toán theo sàn), đơn đã hủy
     * / bị hoàn trả. Số vượt phần còn phải thu phải được xác nhận (choThuThua), đơn thành Cần hoàn tiền. Tiền mặt ghi ngày
     * hôm nay. Chuyển khoản tính đã thu ngay; quản trị viên ghi thì coi như đã đối chiếu sao kê, người khác ghi thì chờ
     * quản trị viên đối chiếu (hậu kiểm). Nhân viên chỉ ghi lùi ngày tối đa {@value #MAX_NGAY_THU_LUI_NHAN_VIEN} ngày.
     * Gửi lại cùng khoaChongTrung (mất phản hồi, bấm lại) trả kết quả lần trước, không ghi phiếu thứ hai.
     */
    // READ_COMMITTED: khóa đơn xong mới đọc phiếu — hai lần ghi cùng lúc thấy phiếu của nhau
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ThanhToanDonBanDto.TheoDon thuTien(Integer donId, ThanhToanRequest.ThuTien req) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        DonBanHang don = khoaDon(donId);
        if (!DonBanHangService.trongPhamVi(don, user)) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Đơn " + don.getSoDonHang() + " không thuộc phạm vi của bạn.");
        }
        if (req == null) throw new CommonException("Thiếu thông tin thanh toán");
        String khoa = khoaChongTrung(req.getKhoaChongTrung());
        if (khoa != null) {
            ThanhToanDonBan daGhi = repository.findByKhoaChongTrung(khoa).orElse(null);
            if (daGhi != null) {
                return ketQuaGuiLai(don, daGhi, ThanhToanDonBan.LOAI_THU, req.getPhuongThuc(), req.getSoTien(),
                        req.getMaThamChieu(), req.getNgayThu());
            }
        }
        if ("bao_gia".equals(don.getLoaiChungTu())) throw new CommonException("Báo giá chưa thành đơn bán: chưa ghi nhận thanh toán được");
        if (laDonSan(don)) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " đồng bộ từ sàn: thanh toán theo sàn, không ghi nhận ở đây",
                    HttpStatus.CONFLICT, null);
        }
        if (!laDonThuong(don)) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " bán tại quầy: đã thu tiền ở màn Bán hàng", HttpStatus.CONFLICT, null);
        }
        Integer tt = don.getTrangThai();
        if (tt != null && (tt == ITrangThaiDonBanHang.DA_HUY || tt == ITrangThaiDonBanHang.BI_HOAN_TRA)) {
            throw new CommonException("Đơn " + don.getSoDonHang() + (tt == ITrangThaiDonBanHang.DA_HUY ? " đã hủy" : " bị hoàn trả")
                    + ": không ghi nhận thu tiền", HttpStatus.CONFLICT, null);
        }
        List<ThanhToanDonBan> ds = new ArrayList<>(repository.findByDonBanHangIdOrderByIdAsc(donId));
        String pt = chuanHoaPhuongThuc(req.getPhuongThuc());
        if (pt == null) throw new CommonException("Chọn Tiền mặt hoặc Chuyển khoản");
        BigDecimal phai = TinhThanhToan.phaiThu(don.getTrangThai(), don.getTongCong());
        BigDecimal conLai = phai.subtract(TinhThanhToan.daThu(ds));
        BigDecimal soTien = req.getSoTien();
        // Số lẻ đồng chỉ nhận khi đúng bằng phần còn lại (đơn cũ / tạo qua API có đơn giá lẻ vẫn thu đủ được)
        if (soTien == null || soTien.signum() <= 0
                || (soTien.stripTrailingZeros().scale() > 0 && (soTien.scale() > 2 || soTien.compareTo(conLai) != 0))) {
            throw new CommonException("Số tiền phải là số nguyên đồng lớn hơn 0");
        }
        if (soTien.compareTo(MAX_THU) > 0) throw new CommonException("Số tiền vượt giới hạn cho phép");
        boolean chuyenKhoan = ThanhToanDonBan.CHUYEN_KHOAN.equals(pt);
        String thamChieu = chuyenKhoan ? catChuoi(req.getMaThamChieu(), 100, "Mã giao dịch") : null;
        if (chuyenKhoan && thamChieu == null) {
            throw new CommonException("Nhập mã giao dịch trên sao kê ngân hàng (COD đơn vị vận chuyển chuyển về: mã bảng kê)");
        }
        LocalDate homNay = LocalDate.now(VN);
        LocalDate ngay = req.getNgayThu() == null ? homNay : req.getNgayThu();
        if (ngay.isAfter(homNay)) throw new CommonException("Ngày thu không được sau hôm nay");
        boolean quanTri = laQuanTri(user);
        int luiToiDa = quanTri ? MAX_NGAY_THU_LUI : MAX_NGAY_THU_LUI_NHAN_VIEN;
        if (ngay.isBefore(homNay.minusDays(luiToiDa))) {
            throw new CommonException("Ngày thu chỉ lùi tối đa " + luiToiDa + " ngày"
                    + (quanTri ? "" : " — khoản chuyển cũ hơn nhờ quản trị viên ghi"));
        }
        LocalDate ngayMo = ngayMoChungTu(don);
        if (ngayMo != null && ngay.isBefore(ngayMo)) {
            throw new CommonException("Ngày thu không được trước ngày lập báo giá / đơn ("
                    + ngayMo.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) + ")");
        }
        if (!chuyenKhoan && !ngay.equals(homNay)) {
            throw new CommonException("Tiền mặt ghi ngày hôm nay (lúc nhận tiền)");
        }
        // Cột thoi_diem_thu lưu tới giây: cắt sẵn để không làm tròn sang ngày sau lúc 23:59:59,6
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        for (ThanhToanDonBan p : ds) {
            if (!p.hieuLuc() || !ThanhToanDonBan.LOAI_THU.equals(p.getLoai())) continue;
            // Ghi trùng mã giao dịch trên cùng đơn (cũng chặn gửi lại chuyển khoản khi mất phản hồi)
            if (chuyenKhoan && ThanhToanDonBan.CHUYEN_KHOAN.equals(p.getPhuongThuc()) && thamChieu.equalsIgnoreCase(p.getMaThamChieu())) {
                throw new CommonException("Mã giao dịch " + thamChieu + " đã ghi ở phiếu " + p.maPhieu() + " của đơn này",
                        HttpStatus.CONFLICT, Map.of("code", "MA_GD_TRUNG"));
            }
            // Tiền mặt bấm hai lần / gửi lại khi mạng chập chờn: cùng người, cùng số trong vài giây. Chuyển khoản đã có
            // mã giao dịch phân biệt (hai khoản cùng số khác mã là hai lần chuyển thật)
            if (!chuyenKhoan && Objects.equals(p.getNguoiThuId(), user.getId())
                    && pt.equals(p.getPhuongThuc()) && soTien.compareTo(p.getSoTien()) == 0
                    && p.getNgayTao() != null && p.getNgayTao().isAfter(now.minusSeconds(GIAY_CHAN_GHI_LAP))) {
                throw new CommonException("Bạn vừa ghi phiếu " + p.maPhieu() + " giống hệt. Xem lại danh sách phiếu trước khi ghi thêm.",
                        HttpStatus.CONFLICT, Map.of("code", "GHI_LAP"));
            }
        }
        // Mã đã ghi ở đơn khác: hỏi lại (một bảng kê COD gồm nhiều đơn thì đúng là cùng mã)
        if (chuyenKhoan && !req.isChoMaDaDung()) {
            List<String> donKhac = donDaGhiMa(thamChieu, don.getId());
            if (!donKhac.isEmpty()) {
                throw new CommonException("Mã giao dịch " + thamChieu + " đã ghi cho đơn " + String.join(", ", donKhac)
                        + ". Chỉ ghi tiếp nếu đây là bảng kê gồm nhiều đơn.", HttpStatus.CONFLICT,
                        Map.of("code", "MA_GD_DA_DUNG", "don", String.join(", ", donKhac)));
            }
        }
        if (soTien.compareTo(conLai) > 0 && !req.isChoThuThua()) {
            BigDecimal du = soTien.subtract(conLai.max(BigDecimal.ZERO));
            throw new CommonException("Đơn còn phải thu " + plain(conLai.max(BigDecimal.ZERO)) + "đ; ghi " + plain(soTien)
                    + "đ thì thu dư " + plain(du) + "đ và đơn thành Cần hoàn tiền.", HttpStatus.CONFLICT,
                    Map.of("code", "THU_THUA", "du", plain(du)));
        }
        ThanhToanDonBan phieu = ThanhToanDonBan.builder()
                .donBanHangId(don.getId())
                .loai(ThanhToanDonBan.LOAI_THU)
                .phuongThuc(pt)
                .soTien(soTien)
                .maThamChieu(thamChieu)
                .khoId(don.getKhoXuat() == null ? null : don.getKhoXuat().getId())
                // Ngày lùi (khách chuyển hôm trước): giữa trưa ngày đó; giờ ghi thật nằm ở ngayTao
                .thoiDiemThu(ngay.equals(homNay) ? now : ngay.atTime(12, 0).atZone(VN).toInstant())
                .nguoiThuId(user.getId())
                .trangThai(ThanhToanDonBan.HIEU_LUC)
                .ghiChu(catChuoi(req.getGhiChu(), 500, "Ghi chú"))
                .ngayTao(now)
                .khoaChongTrung(khoa)
                // Quản trị viên tự ghi chuyển khoản từ sao kê: coi như đã đối chiếu
                .doiChieuLuc(chuyenKhoan && quanTri ? now : null)
                .nguoiDoiChieuId(chuyenKhoan && quanTri ? user.getId() : null)
                .build();
        ds.add(phieu);
        luuPhieu(don, phieu, ds);
        return tomTatDon(don, ds);
    }

    /** Khóa chống gửi trùng do trình duyệt sinh (UUID): trống = không dùng; sai dạng thì báo lỗi. */
    static String khoaChongTrung(String s) {
        if (s == null || s.isBlank()) return null;
        String k = s.trim();
        if (!k.matches("[A-Za-z0-9_-]{8,64}")) throw new CommonException("Khóa chống gửi trùng không hợp lệ");
        return k;
    }

    /**
     * Gửi lại cùng khóa chống trùng: lần trước đã ghi phiếu. Cùng đơn, loại, cách trả, số tiền, mã giao dịch (chuyển
     * khoản) và ngày thu thì trả lại thanh toán hiện tại của đơn (như lần đầu thành công); khác thì 409 KHOA_DA_DUNG —
     * người dùng đã sửa nội dung sau lần gửi không rõ kết quả, đừng báo thành công với phiếu mang nội dung cũ.
     */
    private ThanhToanDonBanDto.TheoDon ketQuaGuiLai(DonBanHang don, ThanhToanDonBan daGhi, String loai, String phuongThuc,
                                                   BigDecimal soTien, String maThamChieu, LocalDate ngayThu) {
        String pt = chuanHoaPhuongThuc(phuongThuc);
        boolean chuyenKhoan = ThanhToanDonBan.CHUYEN_KHOAN.equals(pt);
        String ma = maThamChieu == null || maThamChieu.isBlank() ? null : maThamChieu.trim();
        boolean cungMa = !chuyenKhoan || (ma != null && ma.equalsIgnoreCase(daGhi.getMaThamChieu()));
        boolean cungNgay = ngayThu == null || daGhi.getThoiDiemThu() == null
                || ngayThu.equals(daGhi.getThoiDiemThu().atZone(VN).toLocalDate());
        boolean giong = Objects.equals(daGhi.getDonBanHangId(), don.getId()) && loai.equals(daGhi.getLoai())
                && Objects.equals(pt, daGhi.getPhuongThuc()) && soTien != null && soTien.compareTo(daGhi.getSoTien()) == 0
                && cungMa && cungNgay;
        if (!giong) {
            throw new CommonException("Lần gửi trước đã ghi phiếu " + daGhi.maPhieu() + " với nội dung khác. Tải lại trang để xem "
                    + "các phiếu rồi ghi lại nếu cần.", HttpStatus.CONFLICT, Map.of("code", "KHOA_DA_DUNG"));
        }
        return tomTatDon(don, repository.findByDonBanHangIdOrderByIdAsc(don.getId()));
    }

    // ================= Hoàn tiền thu thừa =================

    /**
     * Ghi phiếu hoàn khi đơn đã thu nhiều hơn phải thu (khách chuyển dư, đơn đã thu tiền rồi bị hủy / hoàn trả); chỉ
     * quản trị viên (kiểm ở controller). Chỉ hoàn tối đa phần thu thừa.
     */
    // READ_COMMITTED: khóa đơn xong mới đọc phiếu — hai lần hoàn cùng lúc không cùng thấy một khoản thừa
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ThanhToanDonBanDto.TheoDon hoanTien(Integer donId, ThanhToanRequest.HoanTien req) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        DonBanHang don = khoaDon(donId);
        if (!DonBanHangService.trongPhamVi(don, user)) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Đơn " + don.getSoDonHang() + " không thuộc phạm vi của bạn.");
        }
        if (req == null) throw new CommonException("Thiếu thông tin hoàn tiền");
        String khoa = khoaChongTrung(req.getKhoaChongTrung());
        if (khoa != null) {
            ThanhToanDonBan daGhi = repository.findByKhoaChongTrung(khoa).orElse(null);
            if (daGhi != null) {
                return ketQuaGuiLai(don, daGhi, ThanhToanDonBan.LOAI_HOAN, req.getPhuongThuc(), req.getSoTien(),
                        req.getMaThamChieu(), null);
            }
        }
        List<ThanhToanDonBan> ds = new ArrayList<>(repository.findByDonBanHangIdOrderByIdAsc(donId));
        BigDecimal thua = TinhThanhToan.daThu(ds).subtract(TinhThanhToan.phaiThu(don.getTrangThai(), don.getTongCong()));
        if (thua.signum() <= 0) {
            throw new CommonException("Đơn " + don.getSoDonHang() + " không có tiền thu thừa cần hoàn");
        }
        String pt = chuanHoaPhuongThuc(req.getPhuongThuc());
        if (pt == null) throw new CommonException("Hoàn tiền bằng tiền mặt hoặc chuyển khoản");
        BigDecimal soTien = req.getSoTien();
        // Số lẻ đồng chỉ nhận khi đúng bằng phần thu thừa (đơn có tổng lẻ đã thu đủ rồi bị hủy)
        if (soTien == null || soTien.signum() <= 0
                || (soTien.stripTrailingZeros().scale() > 0 && (soTien.scale() > 2 || soTien.compareTo(thua) != 0))) {
            throw new CommonException("Số tiền hoàn phải là số nguyên đồng lớn hơn 0");
        }
        if (soTien.compareTo(thua) > 0) {
            throw new CommonException("Chỉ hoàn tối đa " + plain(thua) + "đ (phần đã thu thừa)");
        }
        boolean chuyenKhoan = ThanhToanDonBan.CHUYEN_KHOAN.equals(pt);
        String thamChieu = chuyenKhoan ? catChuoi(req.getMaThamChieu(), 100, "Mã giao dịch hoàn") : null;
        if (chuyenKhoan && thamChieu == null) {
            throw new CommonException("Nhập mã giao dịch hoàn tiền trên sao kê ngân hàng");
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        ThanhToanDonBan phieu = ThanhToanDonBan.builder()
                .donBanHangId(don.getId())
                .loai(ThanhToanDonBan.LOAI_HOAN)
                .phuongThuc(pt)
                .soTien(soTien)
                .maThamChieu(thamChieu)
                .khoId(don.getKhoXuat() == null ? null : don.getKhoXuat().getId())
                .thoiDiemThu(now)
                .nguoiThuId(user.getId())
                .trangThai(ThanhToanDonBan.HIEU_LUC)
                .ghiChu(catChuoi(req.getGhiChu(), 500, "Ghi chú"))
                .ngayTao(now)
                .khoaChongTrung(khoa)
                // Chỉ quản trị viên hoàn tiền: phiếu hoàn chuyển khoản coi như đã đối chiếu
                .doiChieuLuc(chuyenKhoan ? now : null)
                .nguoiDoiChieuId(chuyenKhoan ? user.getId() : null)
                .build();
        ds.add(phieu);
        luuPhieu(don, phieu, ds);
        return tomTatDon(don, ds);
    }

    // ================= Hủy phiếu =================

    /**
     * Hủy phiếu ghi nhầm (chỉ quản trị viên, kiểm ở controller). Phiếu không xóa, chỉ đánh dấu kèm lý do, người, giờ.
     * Không cho hủy phiếu thu nếu sau đó số đã thu thành âm (phải hủy phiếu hoàn trước).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ThanhToanDonBanDto.TheoDon huyPhieu(Long id, String lyDo) {
        String ly = catChuoi(lyDo, 500, "Lý do hủy");
        if (ly == null) throw new CommonException("Nhập lý do hủy phiếu");
        ThanhToanDonBan p = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu " + id, HttpStatus.NOT_FOUND, null));
        DonBanHang don = khoaDon(p.getDonBanHangId());
        // Khóa ghi phiếu: hai lần hủy cùng lúc không ghi đè nhau
        entityManager.refresh(p, LockModeType.PESSIMISTIC_WRITE);
        if (!p.hieuLuc()) {
            throw new CommonException("Phiếu " + p.maPhieu() + " đã bị hủy trước đó", HttpStatus.CONFLICT, null);
        }
        List<ThanhToanDonBan> ds = new ArrayList<>(repository.findByDonBanHangIdOrderByIdAsc(don.getId()));
        // Kiểm trước khi đổi phiếu: bỏ phiếu này ra mà số đã thu âm thì còn phiếu hoàn phải hủy trước
        if (TinhThanhToan.daThu(ds.stream().filter(x -> !Objects.equals(x.getId(), p.getId())).toList()).signum() < 0) {
            throw new CommonException("Đơn còn phiếu hoàn tiền: hủy phiếu hoàn trước rồi mới hủy phiếu thu này");
        }
        p.setTrangThai(ThanhToanDonBan.DA_HUY);
        p.setLyDoHuy(ly);
        p.setNguoiHuyId(SecurityContextHolder.getUser().getId());
        p.setHuyLuc(Instant.now());
        thayPhieu(ds, p);
        repository.save(p);
        capNhatTrangThai(don, ds);
        return tomTatDon(don, ds);
    }

    // ================= Đối chiếu chuyển khoản (hậu kiểm) =================

    /**
     * Phiếu chuyển khoản còn hiệu lực chưa đối chiếu với sao kê (cũ trước): quản trị viên rà, thấy tiền thì đánh dấu,
     * không thấy thì hủy phiếu. Không lọc theo ngày: phiếu cũ chưa đối chiếu vẫn phải hiện.
     */
    public Page<ThanhToanDonBanDto> choDoiChieu(Integer khoId, int page, int size) {
        Page<ThanhToanDonBan> rows = repository.choDoiChieu(khoId,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200)));
        Set<Integer> donIds = new HashSet<>();
        rows.forEach(r -> donIds.add(r.getDonBanHangId()));
        Map<Integer, String> soDon = new HashMap<>();
        if (!donIds.isEmpty()) donBanHangRepository.findAllById(donIds).forEach(d -> soDon.put(d.getId(), d.getSoDonHang()));
        Map<Long, ThanhToanDonBanDto> theoId = new HashMap<>();
        toDtos(rows.getContent(), soDon).forEach(d -> theoId.put(d.getId(), d));
        return rows.map(r -> theoId.get(r.getId()));
    }

    /** Đánh dấu đã đối chiếu; bỏ qua phiếu đã đối chiếu / đã hủy / không phải chuyển khoản. Trả số phiếu đã đánh dấu. */
    @Transactional
    public int doiChieu(List<Long> ids) {
        List<Long> ds = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
        if (ds.isEmpty()) throw new CommonException("Chọn các phiếu chuyển khoản đã thấy trên sao kê");
        if (ds.size() > 200) throw new CommonException("Mỗi lần đánh dấu tối đa 200 phiếu");
        return repository.danhDauDoiChieu(ds, Instant.now(), SecurityContextHolder.getUser().getId());
    }

    // ================= helpers =================

    private static boolean laQuanTri(NguoiDungAuthInfo u) {
        return u != null && u.getVaiTro() != null && u.getVaiTro().contains(IRoleType.quan_tri_vien);
    }

    /** TIEN_MAT (nhận cả CASH) | CHUYEN_KHOAN; giá trị khác trả null. */
    static String chuanHoaPhuongThuc(String method) {
        if (method == null || method.isBlank()) return null;
        String m = method.trim().toUpperCase();
        if ("TIEN_MAT".equals(m) || "CASH".equals(m)) return ThanhToanDonBan.TIEN_MAT;
        if ("CHUYEN_KHOAN".equals(m)) return ThanhToanDonBan.CHUYEN_KHOAN;
        return null;
    }

    /** Số các đơn khác đã có phiếu thu chuyển khoản còn hiệu lực mang mã giao dịch này (tối đa 5). */
    private List<String> donDaGhiMa(String ma, Integer donId) {
        List<Integer> ids = repository.donKhacDaGhiMa(ma, donId, PageRequest.of(0, 5));
        if (ids.isEmpty()) return List.of();
        Map<Integer, String> so = new HashMap<>();
        donBanHangRepository.findAllById(ids).forEach(d -> so.put(d.getId(), d.getSoDonHang()));
        return ids.stream().map(id -> so.getOrDefault(id, "#" + id)).toList();
    }

    /**
     * Ngày lập chứng từ để chặn ngày thu: đơn chuyển từ báo giá (SO… ↔ BG…) lấy ngày lập báo giá — khách có thể chuyển
     * cọc từ lúc còn báo giá. Không xác định được thì null (không chặn).
     */
    private LocalDate ngayMoChungTu(DonBanHang don) {
        Instant mo = don.getNgayTao();
        String so = don.getSoDonHang();
        if (so != null && so.startsWith("SO")) {
            Instant bg = donBanHangRepository.findBySoDonHang(so.split("-")[0].replaceFirst("^SO", "BG"))
                    .map(DonBanHang::getNgayTao).orElse(null);
            if (bg != null && (mo == null || bg.isBefore(mo))) mo = bg;
        }
        return mo == null ? null : mo.atZone(VN).toLocalDate();
    }

    /** Khóa dòng đơn (SELECT ... FOR UPDATE) rồi nạp lại trạng thái mới nhất. */
    DonBanHang khoaDon(Integer donId) {
        DonBanHang don = entityManager.find(DonBanHang.class, donId);
        if (don == null) throw new CommonException("Không tìm thấy đơn bán", HttpStatus.NOT_FOUND, null);
        entityManager.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        return don;
    }

    private static void thayPhieu(List<ThanhToanDonBan> ds, ThanhToanDonBan p) {
        for (int i = 0; i < ds.size(); i++) {
            if (Objects.equals(ds.get(i).getId(), p.getId())) {
                ds.set(i, p);
                return;
            }
        }
    }

    List<ThanhToanDonBanDto> toDtos(List<ThanhToanDonBan> ds, Map<Integer, String> soDon) {
        Set<Integer> khoIds = new HashSet<>();
        Set<Integer> nguoiIds = new HashSet<>();
        for (ThanhToanDonBan p : ds) {
            if (p.getKhoId() != null) khoIds.add(p.getKhoId());
            if (p.getNguoiThuId() != null) nguoiIds.add(p.getNguoiThuId());
            if (p.getNguoiHuyId() != null) nguoiIds.add(p.getNguoiHuyId());
            if (p.getNguoiDoiChieuId() != null) nguoiIds.add(p.getNguoiDoiChieuId());
        }
        Map<Integer, String> kho = new HashMap<>();
        if (!khoIds.isEmpty()) khoRepository.findAllById(khoIds).forEach(k -> kho.put(k.getId(), k.getTenKho()));
        Map<Integer, String> nguoi = new HashMap<>();
        if (!nguoiIds.isEmpty()) nguoiDungRepository.findAllById(nguoiIds).forEach(n -> nguoi.put(n.getId(), n.getHoTen()));
        List<ThanhToanDonBanDto> out = new ArrayList<>();
        for (ThanhToanDonBan p : ds) {
            out.add(ThanhToanDonBanDto.builder()
                    .id(p.getId())
                    .maPhieu(p.maPhieu())
                    .donBanHangId(p.getDonBanHangId())
                    .soDonHang(soDon.get(p.getDonBanHangId()))
                    .loai(p.getLoai())
                    .phuongThuc(p.getPhuongThuc())
                    .soTien(p.getSoTien())
                    .maThamChieu(p.getMaThamChieu())
                    .khoId(p.getKhoId())
                    .tenKho(kho.get(p.getKhoId()))
                    .thoiDiemThu(p.getThoiDiemThu())
                    .nguoiThuId(p.getNguoiThuId())
                    .tenNguoiThu(nguoi.get(p.getNguoiThuId()))
                    .trangThai(p.getTrangThai())
                    .lyDoHuy(p.getLyDoHuy())
                    .tenNguoiHuy(nguoi.get(p.getNguoiHuyId()))
                    .huyLuc(p.getHuyLuc())
                    .ghiChu(p.getGhiChu())
                    .ngayTao(p.getNgayTao())
                    .doiChieuLuc(p.getDoiChieuLuc())
                    .tenNguoiDoiChieu(nguoi.get(p.getNguoiDoiChieuId()))
                    .build());
        }
        return out;
    }

    static String catChuoi(String s, int max, String ten) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        if (t.length() > max) throw new CommonException(ten + " dài quá " + max + " ký tự");
        return t;
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }
}
