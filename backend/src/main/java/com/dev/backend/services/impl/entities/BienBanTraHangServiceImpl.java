package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.dto.request.inbound.GiaoTraHangLoiRequest;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.dto.response.inbound.DanhSachTraHangNccDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.*;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.utils.BienSoXe;
import com.dev.backend.utils.HoTen;
import com.dev.backend.utils.KhoDangChon;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Biên bản trả hàng nhà cung cấp. Kho lập biên bản, nhà cung cấp quyết, kho làm theo:
 * <ol>
 *   <li>Lập: kho ghi hàng lỗi ở phiếu Nháp, để ở kho chờ trả hoặc trả ngay cho người giao hàng (chỉ khi là đại diện
 *   nhà cung cấp), kèm người giao hàng ký biên bản (đại diện nhà cung cấp hoặc người của bên vận chuyển).</li>
 *   <li>Ký: kho in biên bản cho người giao hàng ký rồi ghi đã ký; lúc đó email biên bản (kèm PDF ghi người đã ký) mới
 *   gửi nhà cung cấp.</li>
 *   <li>Nhà cung cấp trả lời trên Cổng nhà cung cấp, không ai chốt thay: cách bù (giao bù / trừ tiền, lưu ở
 *   phuong_an_xu_ly, áp vào đơn mua khi phiếu đã nhập kho) và hàng lỗi còn ở kho (nhận lại / đồng ý tiêu hủy).</li>
 *   <li>Kho làm theo: ghi đã giao trả khi nhà cung cấp nhận lại, ghi tiêu hủy khi nhà cung cấp đồng ý. Lưu ở
 *   bien_ban_tra_hang_ncc.trang_thai.</li>
 *   <li>Hạn trả lời {@value #HAN_TRA_LOI_NGAY} ngày tính từ ngày gửi email: nhắc trước {@value #NHAC_TRUOC_HAN_NGAY}
 *   ngày; quá hạn chưa chọn cách bù thì chuyển trừ tiền (bên mua từ chối nhận hàng lỗi). Hàng lỗi không bao giờ tiêu hủy
 *   khi nhà cung cấp chưa đồng ý: vẫn giữ ở kho.</li>
 * </ol>
 * Chi tiết từng việc (ai, lúc nào, người ký, người xác nhận, giao trả…) nằm ở nhật ký ({@link NhatKyTraHangNcc}): BA chốt
 * không thêm cột. Đơn mua: hàng lỗi trừ tiền cộng vào "đã nhận" của dòng đơn (đơn không chờ số đó nữa), số trừ theo
 * biến thể ghi trong nhật ký. Mọi thao tác trừ tiền khóa dòng đơn → đơn → biên bản (cùng thứ tự với nhập kho, đóng đơn).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BienBanTraHangServiceImpl implements BienBanTraHangService {

    BienBanTraHangNccRepository bienBanTraHangNccRepository;
    ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    PhieuNhapKhoRepository phieuNhapKhoRepository;
    NguoiDungRepository nguoiDungRepository;
    ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;
    ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;
    NhatKyTraHangNcc nhatKy;
    /** Thông báo cho mua hàng / kho (test dựng tay không có thì bỏ qua). */
    @NonFinal
    @Autowired(required = false)
    ThongBaoMuaHangService thongBaoMuaHangService;
    /** Email biên bản cho nhà cung cấp (test dựng tay không có thì bỏ qua). */
    @NonFinal
    @Autowired(required = false)
    EmailNghiepVuService emailNghiepVuService;
    @NonFinal
    @PersistenceContext
    EntityManager entityManager;

    /** Cách xử lý hàng lỗi kho chọn lúc lập biên bản. */
    static final Set<String> CACH_XU_LY_HOP_LE = Set.of(BienBanTraHangNcc.GIU_KHO, BienBanTraHangNcc.TRA_NGAY);
    /** Ai ký biên bản bên giao hàng lúc lập. */
    static final Set<String> BEN_KY_HOP_LE = Set.of(BienBanTraHangNcc.BEN_KY_NCC, BienBanTraHangNcc.BEN_KY_VAN_CHUYEN);
    /** Cách bù nhà cung cấp chọn được (chờ chọn là trạng thái ban đầu, không chọn về được). */
    static final Set<String> PHUONG_AN_CHOT_HOP_LE = Set.of(BienBanTraHangNcc.PA_DOI_HANG, BienBanTraHangNcc.PA_TRU_CONG_NO);
    static final Set<String> HANG_LOI_HOP_LE = Set.of(BienBanTraHangNcc.HL_NHAN_LAI, BienBanTraHangNcc.HL_TIEU_HUY);
    /** Hạn nhà cung cấp trả lời: hết ngày thứ 7 kể từ ngày gửi email biên bản (giờ Việt Nam). */
    public static final int HAN_TRA_LOI_NGAY = 7;
    /** Gửi email nhắc khi còn 2 ngày tới hạn. */
    public static final int NHAC_TRUOC_HAN_NGAY = 2;
    static final Set<String> CACH_GIAO_HOP_LE = Set.of(BienBanTraHangNcc.GIAO_NCC_LAY, BienBanTraHangNcc.GIAO_VAN_CHUYEN);
    /** Lô khóa trước khi có bảng chi tiết lỗi chỉ có tổng số lỗi. */
    static final String LY_DO_CHUA_GHI = "Chưa ghi lý do";
    static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final int TEN_TOI_DA = 100;
    static final int MA_VAN_DON_TOI_DA = 50;
    static final int GHI_CHU_TOI_DA = 255;
    /** Đồng hồ máy người dùng lệch / mạng chậm: thời điểm giao trả được sau hiện tại tối đa 5 phút. */
    static final Duration LECH_DONG_HO = Duration.ofMinutes(5);

    /** Trạng thái hiển thị (tính từ hai việc), khớp TRANG_THAI_TRA_HANG ở frontend/src/constants/nhapKho.js. */
    public static final String TT_CHO_KY = "CHO_KY";
    public static final String TT_MOI_LAP = "MOI_LAP";
    public static final String TT_CHO_CHOT = "CHO_CHOT";
    public static final String TT_CHO_GIAO_TRA = "CHO_GIAO_TRA";
    public static final String TT_CHO_TIEU_HUY = "CHO_TIEU_HUY";
    public static final String TT_CHO_HANG_BU = "CHO_HANG_BU";
    public static final String TT_HOAN_TAT = "HOAN_TAT";
    public static final String TT_DA_HUY = "DA_HUY";

    private static final int DON_DANG_VAN_CHUYEN = 3;
    private static final int DON_NHAN_DU = 5;
    private static final int DON_DA_DONG = 6;
    private static final int DON_DA_HUY = 7;

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId) {
        phieuNhapKhoRepository.findById(phieuNhapKhoId)
                .ifPresent(phieu -> KhoDangChon.kiemTraXem(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap()));
        Optional<BienBanTraHangNcc> opt = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId)
                .filter(BienBanTraHangNcc::dangHieuLuc);
        return opt.map(b -> toDto(b, true)).orElse(null);
    }

    /**
     * Lập (hoặc lập lại) biên bản trả hàng của phiếu nhập đang kiểm đếm.
     * Dòng biên bản lấy từ hàng không đạt đã lưu theo lô (chi_tiet_loi_lo_hang), không lấy từ request:
     * máy nào mở cũng ra cùng một biên bản, và số trên biên bản luôn khớp số kiểm đếm.
     * Phiếu không còn hàng lỗi mà đã có biên bản (lô lỗi bị xóa): hủy biên bản, trả null.
     * Kho chỉ chọn để hàng lỗi ở kho hay trả ngay cho người giao hàng; mọi việc còn lại nhà cung cấp chọn trên cổng
     * ({@link #traLoiTuCong}). Trả ngay: chỉ cho đại diện nhà cung cấp và khi đã kiểm đếm xong; người giao hàng ký nhận
     * ({@link #ghiKy}) xong thì biên bản không lập lại / hủy được. Lập xong biên bản chờ ghi đã ký, chưa gửi nhà cung cấp.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId) {
        // Khóa dòng phiếu trước (cùng thứ tự với khóa lô / nhập kho): biên bản lập từ đúng số lô đang có, không chen giữa lúc nhập kho
        PhieuNhapKho phieu = phieuNhapKhoRepository.khoaTheoId(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.phieuNhapKhoIdKhongTimThay", phieuNhapKhoId)));
        KhoDangChon.kiemTra(phieu.getKho(), "Phiếu nhập " + phieu.getSoPhieuNhap());

        if (phieu.getTrangThai() == null || phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.chiLapBienBanTraHangKhiNhap"));
        }
        if (phieu.getNhaCungCap() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.phieuNhapThieuNccLapBienBan"));
        }
        // Nhà cung cấp trả lời biên bản theo đơn mua trên cổng; không có đơn mua thì không ai quyết được hàng lỗi
        if (phieu.getDonMuaHang() == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.bienBanCanDonMua"));
        }

        String cachXuLy = request != null && request.getCachXuLy() != null && !request.getCachXuLy().isBlank()
                ? request.getCachXuLy().trim() : BienBanTraHangNcc.GIU_KHO;
        if (!CACH_XU_LY_HOP_LE.contains(cachXuLy)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.cachXuLyHangKhongHopLe"));
        }
        boolean traNgay = BienBanTraHangNcc.TRA_NGAY.equals(cachXuLy);
        // Ai ký biên bản bên giao hàng: luôn có người ký, lập xong chờ kho ghi đã ký mới gửi nhà cung cấp
        String benKy = request == null || gon(request.getBenKy()) == null ? BienBanTraHangNcc.BEN_KY_NCC : gon(request.getBenKy());
        if (!BEN_KY_HOP_LE.contains(benKy)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.benKyKhongHopLe"));
        }
        String ghiChu = request != null && request.getGhiChu() != null && !request.getGhiChu().isBlank()
                ? request.getGhiChu().trim() : null;
        if (soKyTu(ghiChu) > GHI_CHU_TOI_DA) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.rtvGhiChuQuaDai", GHI_CHU_TOI_DA));
        }

        // Kể cả biên bản đã hủy của phiếu: lập lại thì dùng lại đúng số đó (một phiếu một số biên bản)
        BienBanTraHangNcc bienBan = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId).orElse(null);
        // Hàng lỗi đã trả ngay cho người giao hàng: biên bản là chứng từ của hàng đã rời kho, không lập lại / hủy được nữa
        if (bienBan != null && bienBan.dangHieuLuc() && !bienBan.hangConOKho()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.bienBanTraNgayKhongSua", bienBan.getMaBienBan()));
        }
        boolean lapLai = bienBan != null && bienBan.dangHieuLuc();
        // Lập lại biên bản đang hiệu lực: lô khóa bằng bản cũ (chưa có chi tiết lỗi) giữ lý do đã ghi trên biên bản
        List<ChiTietTraHangNcc> dongBienBanHieuLuc = bienBan != null && bienBan.getId() != null && bienBan.dangHieuLuc()
                ? chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId()) : List.of();
        List<ChiTietTraHangNcc> dongMoi = dongTuHangLoiDaLuu(phieuNhapKhoId, dongBienBanHieuLuc);

        if (dongMoi.isEmpty()) {
            if (bienBan == null || !bienBan.dangHieuLuc()) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.phieuNhapKhongCoHangLoi"));
            }
            huy(bienBan, phieu, false, nguoiTaoId);
            return null;
        }
        // Kiểm người ký sau nhánh hủy: hủy biên bản (hết hàng lỗi) không cần người ký
        NhatKyTraHangNcc.NguoiKy nguoiKy = kiemNguoiKy(benKy, request);
        // Trả ngay chỉ cho người của nhà cung cấp: bên vận chuyển (bưu tá, nhà xe) không nhận hàng lỗi thay nhà cung cấp
        if (traNgay && BienBanTraHangNcc.BEN_KY_VAN_CHUYEN.equals(benKy)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.traNgayKhongChoVanChuyen"));
        }
        // Trả ngay: hàng lỗi rời kho theo biên bản này, nên mọi sản phẩm phải kiểm đếm xong trước
        if (traNgay && !daKiemDemXong(phieu)) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.traNgayCanKiemXong"));
        }

        NguoiDung nguoiTao = nguoiDungRepository.findById(nguoiTaoId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.nguoiTaoKhongTimThay", nguoiTaoId)));
        if (bienBan == null) {
            bienBan = BienBanTraHangNcc.builder()
                    .maBienBan(sinhMaBienBan())
                    .phieuNhapKho(phieu)
                    .nhaCungCap(phieu.getNhaCungCap())
                    .nguoiTao(nguoiTao)
                    .build();
        } else {
            // Lập lại: thay toàn bộ dòng cũ bằng số kiểm đếm hiện tại, giữ số biên bản
            chiTietTraHangNccRepository.deleteAll(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId()));
        }

        // Lập lại mà hàng lỗi và người ký không đổi (cùng lô, lý do, số lượng; vẫn giữ ở kho), chỉ sửa ghi chú: tờ đã ký
        // và nhà cung cấp đang cầm đúng biên bản này nên giữ việc ký, câu trả lời; không ghi lần lập mới, không gửi email
        NhatKyTraHangNcc.Lap lapCu = lapLai ? nhatKy.doc(bienBan.getId()).lap() : null;
        boolean khongDoiHang = lapCu != null && !traNgay && BienBanTraHangNcc.GIU_KHO.equals(lapCu.cachXuLy())
                && nguoiKy.equals(lapCu.nguoiKy())
                && demTheoLoVaLyDo(dongBienBanHieuLuc).equals(demTheoLoVaLyDo(dongMoi));
        // Lập (lại) có đổi hàng lỗi là biên bản mới với nhà cung cấp: câu trả lời trước (nếu có) không còn hiệu lực
        if (!khongDoiHang) bienBan.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
        bienBan.setGhiChu(ghiChu);
        // Giao luôn: hàng lỗi rời kho lúc người giao hàng ký nhận (ghiKy), tới lúc đó vẫn ở kho
        bienBan.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
        bienBan.setTongSoLuongLoi(dongMoi.stream().mapToInt(ChiTietTraHangNcc::getSoLuongLoi).sum());
        BienBanTraHangNcc savedHeader;
        try {
            savedHeader = bienBanTraHangNccRepository.saveAndFlush(bienBan);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // Hai biên bản lập cùng lúc được cùng số: biên bản sau lập lại sẽ nhận số kế tiếp
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("chungTuKho.soBienBanTraHangTrung", bienBan.getMaBienBan()));
        }
        for (ChiTietTraHangNcc dong : dongMoi) {
            dong.setBienBanTraHangNcc(savedHeader);
        }
        chiTietTraHangNccRepository.saveAll(dongMoi);
        if (entityManager != null) {
            // Nạp lại danh sách dòng của biên bản (email dựng từ đúng các dòng vừa lưu, kể cả khi lập lại)
            entityManager.flush();
            entityManager.refresh(savedHeader);
        }
        log.info("[RTV-ISSUED] Đã phát hành biên bản trả hàng NCC `{}` cho phiếu nhập `{}` với {} sản phẩm lỗi ({}{})",
                savedHeader.getMaBienBan(), phieu.getSoPhieuNhap(), savedHeader.getTongSoLuongLoi(), cachXuLy,
                khongDoiHang ? ", hàng lỗi không đổi" : "");
        if (khongDoiHang) return toDto(savedHeader, true);
        nhatKy.ghiLap(savedHeader, cachXuLy, nguoiKy, lapLai);
        // Biên bản gửi nhà cung cấp khi kho ghi người giao hàng đã ký (ghiKy)
        // Bộ phận mua hàng được báo lúc nhập kho (số lỗi đã khóa), không báo ở đây: phiếu Nháp còn lập lại nhiều lần
        return toDto(savedHeader, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto ghiKy(Integer id) {
        BienBanTraHangNcc bb = bienBanTraHangNccRepository.khoaTheoId(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.bienBanTraHangKhongTimThay", id)));
        KhoDangChon.kiemTra(bb.getPhieuNhapKho().getKho(), "Biên bản trả hàng " + bb.getMaBienBan());
        if (!bb.dangHieuLuc()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.bienBanDaHuyKhongThaoTac", bb.getMaBienBan()));
        }
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        if (!nk.choKy()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.bienBanKhongChoKy", bb.getMaBienBan()));
        }
        // Tờ người giao hàng ký phải đúng số kiểm đếm hiện tại: lô lỗi đổi sau khi lập thì lập lại, in lại
        if (!khopHangLoiHienTai(bb)) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.kyBienBanKhongKhop", bb.getMaBienBan()));
        }
        NhatKyTraHangNcc.Lap lap = nk.lap();
        boolean traNgay = BienBanTraHangNcc.TRA_NGAY.equals(lap.cachXuLy());
        // Trả ngay: hàng lỗi rời kho lúc này, sau đó phiếu không sửa kiểm đếm được nữa, nên phải còn kiểm đếm đủ (lô đạt có
        // thể đã bị xóa sau khi lập)
        if (traNgay && !daKiemDemXong(bb.getPhieuNhapKho())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.traNgayCanKiemXong"));
        }
        if (traNgay) {
            bb.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            bienBanTraHangNccRepository.save(bb);
        }
        // Nhà cung cấp đã nhận bản của lần lập trước thì thư này là thư cập nhật
        String loaiEmail = nk.daTungGuiEmail() ? NhatKyTraHangNcc.EMAIL_CAP_NHAT : NhatKyTraHangNcc.EMAIL_GUI;
        nhatKy.ghiKy(bb);
        if (entityManager != null) entityManager.flush();
        NhatKyTraHangNcc.NguoiKy nguoiKy = lap.nguoiKy();
        guiEmailBienBan(bb, loaiEmail, traNgay ? moTaNguoiGiao(nguoiKy.hoTen(), nguoiKy.bienSoXe()) : null,
                nhatKy.idLapCuoi(id));
        log.info("[RTV-KY] Biên bản `{}`: {} đã ký{}", bb.getMaBienBan(), nguoiKy.hoTen(),
                traNgay ? ", đã nhận hàng lỗi" : "");
        return toDto(bb, true);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean choNguoiGiaoKy(BienBanTraHangNcc bienBan) {
        return bienBan != null && bienBan.dangHieuLuc() && nhatKy.doc(bienBan.getId()).choKy();
    }

    /**
     * Gửi email biên bản kèm bản PDF ({@code loai}: GUI lần ghi ký đầu / gửi lại, CAP_NHAT ghi ký sau khi lập lại, NHAC
     * nhắc hạn) sau commit,
     * có thử lại. Thư chỉ đi khi biên bản còn hiệu lực và vẫn là lần lập này (lập lại ngay sau đó thì thư cũ bị bỏ); gửi
     * được thì ghi nhật ký: lần gửi đầu tiên của lần lập là mốc tính hạn trả lời.
     */
    private void guiEmailBienBan(BienBanTraHangNcc bb, String loai, String moTaHangLoi, Integer lanLap) {
        if (emailNghiepVuService == null) return;
        Integer id = bb.getId();
        String ma = bb.getMaBienBan();
        Integer khoId = bb.getPhieuNhapKho().getKho() == null ? null : bb.getPhieuNhapKho().getKho().getId();
        String email = bb.getNhaCungCap().getEmail() == null ? null : bb.getNhaCungCap().getEmail().trim();
        BienBanTraHangDto ban = toDto(bb, true);
        // Chưa gửi được lần nào: hạn tính từ hôm nay (thư này là lần gửi đầu)
        Instant han = ban.getHanTraLoi() != null ? ban.getHanTraLoi() : hanTraLoi(Instant.now());
        boolean nhac = NhatKyTraHangNcc.EMAIL_NHAC.equals(loai);
        emailNghiepVuService.guiBienBanTraHang(bb, ban, loai, han, moTaHangLoi,
                () -> laLanLapHienHanh(id, lanLap) && (!nhac || conChoKhiGui(id)),
                () -> nhatKy.ghiDaGuiEmail(id, ma, khoId, loai, email));
    }

    /** Hạn trả lời: hết ngày thứ {@value #HAN_TRA_LOI_NGAY} kể từ ngày gửi email đầu tiên (giờ Việt Nam). */
    static Instant hanTraLoi(Instant emailDau) {
        return emailDau.atZone(MUI_GIO_VN).toLocalDate().plusDays(HAN_TRA_LOI_NGAY)
                .atTime(23, 59, 59).atZone(MUI_GIO_VN).toInstant();
    }

    private static String moTaNguoiGiao(String hoTen, String bienSo) {
        return "Người giao hàng " + hoTen + (bienSo == null ? "" : " · biển số " + bienSo);
    }

    /** Câu hàng lỗi đã rời kho cho email (trả ngay cho người giao hàng, nhà cung cấp đến lấy, gửi vận chuyển), hoặc null. */
    private static String moTaHangDaRoiKho(NhatKyTraHangNcc.NhatKy nk) {
        NhatKyTraHangNcc.GiaoTra gt = nk.giaoTra();
        if (gt != null && !gt.tieuHuy()) {
            return BienBanTraHangNcc.GIAO_VAN_CHUYEN.equals(gt.cachGiao())
                    ? "Gửi " + gt.nguoiNhan() + (gt.maVanDon() == null ? "" : " · mã vận đơn " + gt.maVanDon())
                    : gt.nguoiNhan() + " đến lấy";
        }
        NhatKyTraHangNcc.Lap lap = nk.lap();
        return lap != null && BienBanTraHangNcc.TRA_NGAY.equals(lap.cachXuLy()) && lap.nguoiKy().hoTen() != null
                ? moTaNguoiGiao(lap.nguoiKy().hoTen(), lap.nguoiKy().bienSoXe()) : null;
    }

    /** Lần gần nhất mua hàng bấm gửi lại email, theo id biên bản (chặn bấm liên tục; chỉ trong bộ nhớ). */
    private static final Map<Integer, Instant> GUI_LAI_EMAIL = new java.util.concurrent.ConcurrentHashMap<>();
    static final int GUI_LAI_EMAIL_CHAN_GIAY = 60;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BienBanTraHangDto guiLaiEmail(Integer id) {
        BienBanTraHangNcc bb = bienBanTraHangNccRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.bienBanTraHangKhongTimThay", id)));
        KhoDangChon.kiemTraXem(bb.getPhieuNhapKho().getKho(), "Biên bản trả hàng " + bb.getMaBienBan());
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        if (nk.choKy()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.bienBanChoNguoiGiaoKy", bb.getMaBienBan()));
        }
        if (!choTraLoi(bb, nk).co()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.khongGuiLaiEmailBienBan", bb.getMaBienBan()));
        }
        String email = bb.getNhaCungCap().getEmail();
        if (email == null || email.isBlank()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.nccChuaCoEmail", bb.getNhaCungCap().getTenNhaCungCap()));
        }
        Instant now = Instant.now();
        GUI_LAI_EMAIL.values().removeIf(t -> now.isAfter(t.plusSeconds(GUI_LAI_EMAIL_CHAN_GIAY)));
        // Đặt mốc một bước: hai lần bấm cùng lúc chỉ một lần qua
        if (GUI_LAI_EMAIL.putIfAbsent(id, now) != null) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.vuaGuiLaiEmailBienBan"));
        }
        guiEmailBienBan(bb, NhatKyTraHangNcc.EMAIL_GUI, moTaHangDaRoiKho(nk), nhatKy.idLapCuoi(id));
        log.info("[RTV-EMAIL] Gửi lại email biên bản `{}` cho nhà cung cấp", bb.getMaBienBan());
        return toDto(bb, true);
    }

    /**
     * Thư nhắc chỉ đi khi nhà cung cấp vẫn chưa trả lời lúc gửi (chạy ở luồng gửi thư, không giao dịch: chỉ đọc cột của
     * biên bản và nhật ký, không đọc đơn mua).
     */
    private boolean conChoKhiGui(Integer bienBanId) {
        return bienBanTraHangNccRepository.findById(bienBanId)
                .map(b -> BienBanTraHangNcc.PA_CHO_CHOT.equals(b.phuongAn())
                        || b.hangConOKho() && nhatKy.doc(bienBanId).luaChonHangLoi() == null)
                .orElse(false);
    }

    /** Biên bản còn hiệu lực và lần lập cuối vẫn là {@code lanLap} (chạy ở luồng gửi thư). */
    private boolean laLanLapHienHanh(Integer bienBanId, Integer lanLap) {
        return bienBanTraHangNccRepository.findById(bienBanId)
                .filter(BienBanTraHangNcc::dangHieuLuc)
                .map(b -> Objects.equals(nhatKy.idLapCuoi(bienBanId), lanLap))
                .orElse(false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public void huyTheoPhieuNhap(PhieuNhapKho phieu, Integer nguoiHuyId) {
        bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieu.getId())
                .filter(BienBanTraHangNcc::dangHieuLuc)
                .ifPresent(bb -> huy(bb, phieu, true, nguoiHuyId));
    }

    /**
     * Hủy biên bản (phiếu nhập bị hủy, hoặc phiếu không còn hàng lỗi). Không xóa: số biên bản đã cấp không được cấp lại.
     * Nhà cung cấp đã nhận biên bản thì nhận thêm email báo hủy.
     */
    private void huy(BienBanTraHangNcc bb, PhieuNhapKho phieu, boolean doHuyPhieuNhap, Integer nguoiId) {
        boolean daGuiNcc = nhatKy.doc(bb.getId()).daTungGuiEmail();
        bb.setTrangThai(BienBanTraHangNcc.DA_HUY);
        bienBanTraHangNccRepository.save(bb);
        nhatKy.ghiHuy(bb, doHuyPhieuNhap ? "Hủy phiếu nhập " + phieu.getSoPhieuNhap() : "Phiếu nhập không còn hàng lỗi");
        log.info("[RTV-HUY] Hủy biên bản `{}` của phiếu nhập `{}` ({})", bb.getMaBienBan(), phieu.getSoPhieuNhap(),
                doHuyPhieuNhap ? "hủy phiếu" : "hết hàng lỗi");
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.bienBanDaHuy(bb, phieu, doHuyPhieuNhap, nguoiId);
        if (daGuiNcc && emailNghiepVuService != null) emailNghiepVuService.guiBienBanDaHuy(bb);
    }

    /**
     * Mọi dòng dự kiến của phiếu đã kiểm đếm xong (đã bấm hoàn tất, hoặc đạt + lỗi của các lô đủ số cần nhập). Cùng điều
     * kiện với bước 2 của nhập kho.
     */
    private boolean daKiemDemXong(PhieuNhapKho phieu) {
        List<ChiTietPhieuNhapKho> lo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieu.getId());
        for (ChiTietPhieuNhapKho duKien : phieu.getChiTietPhieuNhapKhos()) {
            if (duKien.getLoHang() != null) continue;
            int canNhap = duKien.getSoLuongNhap() != null ? duKien.getSoLuongNhap().intValue() : 0;
            if (canNhap <= 0 || "DA_HOAN_TAT".equals(duKien.getTrangThaiKiemDem())) continue;
            int daKiem = lo.stream()
                    .filter(ct -> ct.getBienTheSanPham().getId().equals(duKien.getBienTheSanPham().getId()))
                    .mapToInt(ct -> (ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                            + (ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0))
                    .sum();
            if (daKiem < canNhap) return false;
        }
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangNcc bienBanTraNgayCuaPhieu(Integer phieuNhapKhoId) {
        return bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieuNhapKhoId)
                .filter(BienBanTraHangNcc::dangHieuLuc)
                // Phiếu còn Nháp mà hàng lỗi đã rời kho: chỉ có thể là trả ngay cho người giao hàng lúc ghi đã ký
                .filter(b -> !b.hangConOKho())
                .orElse(null);
    }

    private static String gon(String s) {
        if (s == null) return null;
        String t = s.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? null : t;
    }


    @Override
    @Transactional(readOnly = true)
    public boolean khopHangLoiHienTai(BienBanTraHangNcc bienBan) {
        List<ChiTietTraHangNcc> dongBienBan = chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId());
        List<ChiTietTraHangNcc> dongHienTai = dongTuHangLoiDaLuu(bienBan.getPhieuNhapKho().getId(),
                bienBan.dangHieuLuc() ? dongBienBan : List.of());
        return demTheoLoVaLyDo(dongBienBan).equals(demTheoLoVaLyDo(dongHienTai));
    }

    /**
     * Số lượng theo (lô, lý do). Dòng mất lô (lô đã bị xóa) có khóa "null|…" nên không bao giờ khớp dòng hiện tại.
     * Lý do so không phân biệt hoa thường / khoảng trắng thừa, giống cách khóa lô gộp lý do ("Rách vải" = "rách  vải").
     */
    private static Map<String, Integer> demTheoLoVaLyDo(List<ChiTietTraHangNcc> dong) {
        Map<String, Integer> dem = new HashMap<>();
        for (ChiTietTraHangNcc c : dong) {
            String lyDo = c.getLyDoLoi() == null ? "" : c.getLyDoLoi().trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
            String khoa = (c.getLoHang() != null ? c.getLoHang().getId() : null) + "|" + lyDo;
            dem.merge(khoa, c.getSoLuongLoi() != null ? c.getSoLuongLoi() : 0, Integer::sum);
        }
        return dem;
    }

    /**
     * Một dòng biên bản cho mỗi (lô, lý do) của các lô đã khóa trong phiếu.
     * {@code dongBienBanHieuLuc}: dòng của biên bản đang hiệu lực của phiếu (rỗng nếu chưa có / đã hủy), xem {@link #dongBienBanCuCuaLo}.
     */
    private List<ChiTietTraHangNcc> dongTuHangLoiDaLuu(Integer phieuNhapKhoId, List<ChiTietTraHangNcc> dongBienBanHieuLuc) {
        List<LoHang> loCoLoi = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapKhoId).stream()
                .map(ChiTietPhieuNhapKho::getLoHang)
                .filter(lo -> lo.getSoLuongLoi() != null && lo.getSoLuongLoi() > 0)
                .sorted(Comparator.comparing(LoHang::getId))
                .toList();
        if (loCoLoi.isEmpty()) return List.of();

        Map<Integer, List<ChiTietLoiLoHang>> chiTietTheoLo = new HashMap<>();
        for (ChiTietLoiLoHang c : chiTietLoiLoHangRepository.findByLoHangIds(loCoLoi.stream().map(LoHang::getId).toList())) {
            chiTietTheoLo.computeIfAbsent(c.getLoHang().getId(), k -> new ArrayList<>()).add(c);
        }

        Map<Integer, List<ChiTietTraHangNcc>> dongCuTheoLo = dongBienBanTheoLo(dongBienBanHieuLuc, loCoLoi);
        List<ChiTietTraHangNcc> ketQua = new ArrayList<>();
        for (LoHang lo : loCoLoi) {
            List<ChiTietLoiLoHang> chiTiet = chiTietTheoLo.getOrDefault(lo.getId(), List.of());
            if (chiTiet.isEmpty()) {
                List<ChiTietTraHangNcc> dongCu = dongBienBanCuCuaLo(dongCuTheoLo.getOrDefault(lo.getId(), List.of()), lo);
                if (!dongCu.isEmpty()) {
                    for (ChiTietTraHangNcc c : dongCu) {
                        // Dòng mới (dòng cũ bị xóa khi lập lại), chỉ chép lý do / số / ghi chú / ảnh của dòng cũ
                        ketQua.add(ChiTietTraHangNcc.builder()
                                .bienTheSanPham(lo.getBienTheSanPham())
                                .loHang(lo)
                                .maLo(lo.getMaLo())
                                .lyDoLoi(c.getLyDoLoi())
                                .soLuongLoi(c.getSoLuongLoi())
                                .ghiChu(c.getGhiChu())
                                .anhBangChungUrl(c.getAnhBangChungUrl())
                                .build());
                    }
                    continue;
                }
            }
            int daCoLyDo = 0;
            for (ChiTietLoiLoHang c : chiTiet) {
                ketQua.add(ChiTietTraHangNcc.builder()
                        .bienTheSanPham(lo.getBienTheSanPham())
                        .loHang(lo)
                        .maLo(lo.getMaLo())
                        .lyDoLoi(c.getLyDo())
                        .soLuongLoi(c.getSoLuong())
                        .ghiChu(c.getGhiChu())
                        .build());
                daCoLyDo += c.getSoLuong();
            }
            // Lô khóa trước khi lưu lý do: phần lỗi chưa có lý do vẫn vào biên bản để tổng khớp kiểm đếm
            int conThieu = lo.getSoLuongLoi() - daCoLyDo;
            if (conThieu > 0) {
                ketQua.add(ChiTietTraHangNcc.builder()
                        .bienTheSanPham(lo.getBienTheSanPham())
                        .loHang(lo)
                        .maLo(lo.getMaLo())
                        .lyDoLoi(LY_DO_CHUA_GHI)
                        .soLuongLoi(conThieu)
                        .build());
            }
        }
        return ketQua;
    }

    /**
     * Lô khóa bằng bản cũ (chưa có dòng chi_tiet_loi_lo_hang) mà biên bản đang hiệu lực cũng lập bằng bản cũ (dòng mang lý do
     * người kiểm nhập): dùng lại các dòng biên bản của đúng lô đó khi tổng số của chúng bằng số lỗi của lô. Không thì trả rỗng
     * (lô vào dòng "Chưa ghi lý do" như trước). Nhờ vậy biên bản cũ không bị coi là lệch, lập lại cũng không mất lý do.
     * {@code cuaLo}: dòng biên bản đã gán cho lô này ({@link #dongBienBanTheoLo}).
     */
    private static List<ChiTietTraHangNcc> dongBienBanCuCuaLo(List<ChiTietTraHangNcc> cuaLo, LoHang lo) {
        int tong = cuaLo.stream().mapToInt(d -> d.getSoLuongLoi() != null ? d.getSoLuongLoi() : 0).sum();
        return !cuaLo.isEmpty() && tong == lo.getSoLuongLoi() ? cuaLo : List.of();
    }

    /**
     * Gán mỗi dòng biên bản đang hiệu lực cho nhiều nhất một lô có lỗi của phiếu (khóa: id lô). Bản cũ gắn lô cho dòng
     * bằng mã lô trên toàn hệ thống (findFirstByMaLo, không theo biến thể): lô của dòng có thể null, hoặc là lô của biến
     * thể khác trùng mã lô. Nên dòng thuộc lô cùng biến thể + cùng mã lô trước; không có lô như vậy mới theo lô đã gắn
     * (và lô đó không thuộc biến thể khác với dòng).
     */
    private static Map<Integer, List<ChiTietTraHangNcc>> dongBienBanTheoLo(List<ChiTietTraHangNcc> dongBienBanHieuLuc, List<LoHang> loCoLoi) {
        Map<Integer, List<ChiTietTraHangNcc>> theoLo = new HashMap<>();
        for (ChiTietTraHangNcc d : dongBienBanHieuLuc) {
            LoHang loCuaDong = loCoLoi.stream().filter(lo -> cungBienTheVaMaLo(d, lo)).findFirst()
                    .orElseGet(() -> loCoLoi.stream().filter(lo -> daGanLo(d, lo)).findFirst().orElse(null));
            if (loCuaDong != null) {
                theoLo.computeIfAbsent(loCuaDong.getId(), k -> new ArrayList<>()).add(d);
            }
        }
        return theoLo;
    }

    /** Dòng cùng biến thể với lô và cùng mã lô (không phân biệt hoa thường / khoảng trắng thừa). */
    private static boolean cungBienTheVaMaLo(ChiTietTraHangNcc d, LoHang lo) {
        String maLo = chuanHoaMaLo(d.getMaLo());
        return !maLo.isEmpty() && maLo.equals(chuanHoaMaLo(lo.getMaLo()))
                && d.getBienTheSanPham() != null && lo.getBienTheSanPham() != null
                && Objects.equals(d.getBienTheSanPham().getId(), lo.getBienTheSanPham().getId());
    }

    /** Dòng đã gắn đúng lô này (theo id) và lô không thuộc biến thể khác với biến thể của dòng. */
    private static boolean daGanLo(ChiTietTraHangNcc d, LoHang lo) {
        return d.getLoHang() != null && lo.getId().equals(d.getLoHang().getId())
                && (d.getBienTheSanPham() == null || lo.getBienTheSanPham() == null
                        || Objects.equals(d.getBienTheSanPham().getId(), lo.getBienTheSanPham().getId()));
    }

    private static String chuanHoaMaLo(String maLo) {
        return maLo == null ? "" : maLo.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    @Override
    @Transactional(readOnly = true)
    public DanhSachTraHangNccDto danhSach(Integer nhaCungCapId, Integer donMuaHangId, String trangThai, String tuKhoa) {
        List<BienBanTraHangNcc> ds = bienBanTraHangNccRepository.timChoDanhSach(nhaCungCapId, donMuaHangId).stream()
                .filter(b -> KhoDangChon.duocXem(b.getPhieuNhapKho().getKho()))
                .toList();
        NguCanh nguCanh = napNguCanh(ds);
        String tu = tuKhoa == null ? "" : tuKhoa.trim().toLowerCase(Locale.ROOT);
        List<BienBanTraHangDto> items = new ArrayList<>();
        for (BienBanTraHangNcc b : ds) {
            BienBanTraHangDto dto = toDto(b, false, nguCanh);
            if (trangThai != null && !trangThai.isBlank() && !trangThai.equals(dto.getTrangThaiHienThi())) continue;
            if (!tu.isEmpty() && !khopTuKhoa(dto, tu)) continue;
            items.add(dto);
        }
        return DanhSachTraHangNccDto.builder().items(items).build();
    }

    private static boolean khopTuKhoa(BienBanTraHangDto d, String tu) {
        for (String s : new String[]{d.getSoBienBan(), d.getSoPhieuNhap(), d.getSoDonMua(), d.getTenNhaCungCap(), d.getMaNhaCungCap()}) {
            if (s != null && s.toLowerCase(Locale.ROOT).contains(tu)) return true;
        }
        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto chiTiet(Integer id) {
        BienBanTraHangNcc b = bienBanTraHangNccRepository.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.bienBanTraHangKhongTimThay", id)));
        KhoDangChon.kiemTraXem(b.getPhieuNhapKho().getKho(), "Biên bản trả hàng " + b.getMaBienBan());
        return toDto(b, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BienBanTraHangDto> dsChoCong(Collection<Integer> nhaCungCapIds) {
        if (nhaCungCapIds.isEmpty()) return List.of();
        List<BienBanTraHangNcc> ds = bienBanTraHangNccRepository.timTheoNhaCungCap(nhaCungCapIds);
        NguCanh nguCanh = napNguCanh(ds);
        // Biên bản chờ ký chưa gửi nhà cung cấp: cổng không thấy
        return ds.stream()
                .filter(b -> !nguCanh.nhatKyTheoBienBan().getOrDefault(b.getId(), NhatKyTraHangNcc.NhatKy.TRONG).choKy())
                .map(b -> toDto(b, false, nguCanh)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BienBanTraHangDto chiTietChoCong(Integer id, Collection<Integer> nhaCungCapIds) {
        return toDto(bienBanCuaCong(id, nhaCungCapIds), true);
    }

    /**
     * Biên bản nhà cung cấp của phiên cổng được xem / trả lời: thuộc các nhà cung cấp của phiên, phiếu nhập từ đơn mua,
     * đã gửi nhà cung cấp (không còn chờ ghi đã ký). Không thì 404 KHONG_TIM_THAY (không lộ biên bản của bên khác).
     */
    private BienBanTraHangNcc bienBanCuaCong(Integer id, Collection<Integer> nhaCungCapIds) {
        return (id == null ? Optional.<BienBanTraHangNcc>empty() : bienBanTraHangNccRepository.findById(id))
                .filter(b -> b.getNhaCungCap() != null && nhaCungCapIds.contains(b.getNhaCungCap().getId()))
                .filter(b -> b.getPhieuNhapKho().getDonMuaHang() != null)
                .filter(b -> !nhatKy.doc(b.getId()).choKy())
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY,
                        ThongDiep.of("chungTuKho.congBienBanKhongTimThay")));
    }

    // ─────────────────────────────────────────────────────────────
    // NHÀ CUNG CẤP TRẢ LỜI (cách bù cho cả biên bản, hàng lỗi còn ở kho)
    // ─────────────────────────────────────────────────────────────

    /** Việc nhà cung cấp còn phải trả lời: chọn cách bù, chọn nhận lại / tiêu hủy hàng lỗi còn ở kho. */
    record ChoTraLoi(boolean cachBu, boolean hangLoi) {
        static final ChoTraLoi KHONG = new ChoTraLoi(false, false);

        boolean co() {
            return cachBu || hangLoi;
        }
    }

    /** Cách bù / hàng lỗi nhà cung cấp còn chọn hoặc đổi được trên cổng (tập rỗng: việc đó đã chốt). */
    record LuaChonMo(Set<String> cachBu, Set<String> hangLoi) {
        static final LuaChonMo DONG = new LuaChonMo(Set.of(), Set.of());

        boolean co() {
            return !cachBu.isEmpty() || !hangLoi.isEmpty();
        }
    }

    /**
     * Việc nhà cung cấp chưa trả lời (biên bản đã gửi). Cách bù: còn chờ và đơn mua chưa kết thúc (đóng đơn đã chuyển hàng lỗi chưa bù
     * sang trừ tiền). Hàng lỗi: còn ở kho mà nhà cung cấp chưa chọn nhận lại hay tiêu hủy.
     */
    static ChoTraLoi choTraLoi(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk) {
        DonMuaHang don = b.getPhieuNhapKho().getDonMuaHang();
        // Chưa ghi người giao hàng đã ký: biên bản chưa gửi nhà cung cấp, chưa có gì để trả lời
        if (!b.dangHieuLuc() || don == null || nk.choKy()) return ChoTraLoi.KHONG;
        return new ChoTraLoi(BienBanTraHangNcc.PA_CHO_CHOT.equals(b.phuongAn()) && !donKetThuc(don.getTrangThai()),
                b.hangConOKho() && nk.luaChonHangLoi() == null);
    }

    private static boolean donKetThuc(Integer ttDon) {
        return Objects.equals(ttDon, DON_DA_DONG) || Objects.equals(ttDon, DON_DA_HUY);
    }

    /**
     * Lựa chọn nhà cung cấp còn chọn hoặc đổi được.
     * <ul>
     *   <li>Cách bù: phiếu chưa nhập kho thì đổi tự do (chưa áp vào đơn mua). Đã nhập kho: chọn khi còn chờ; giao bù đổi
     *   sang trừ tiền khi chưa có hàng nào của các sản phẩm lỗi về sau biên bản (không tách được hàng bù với hàng giao
     *   thiếu); trừ tiền là chốt cuối. Đơn mua đã đóng / hủy: không chọn nữa.</li>
     *   <li>Hàng lỗi: chọn và đổi được tới khi kho ghi đã giao trả / tiêu hủy.</li>
     * </ul>
     */
    private LuaChonMo luaChonMo(BienBanTraHangNcc b) {
        PhieuNhapKho phieu = b.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        if (!b.dangHieuLuc() || don == null) return LuaChonMo.DONG;
        Set<String> hangLoi = b.hangConOKho() ? HANG_LOI_HOP_LE : Set.of();
        String pa = b.phuongAn();
        boolean daNhap = laPhieuDaNhap(phieu);
        Set<String> cachBu;
        if (donKetThuc(don.getTrangThai()) || daNhap && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(pa)) {
            cachBu = Set.of();
        } else if (!daNhap || BienBanTraHangNcc.PA_CHO_CHOT.equals(pa)) {
            cachBu = PHUONG_AN_CHOT_HOP_LE;
        } else {
            Map<Integer, Integer> loi = soLoiTheoBienThe(phieu.getId());
            Long datSau = phieu.getNgayNhap() == null || loi.isEmpty() ? null
                    : chiTietPhieuNhapKhoRepository.datNhapSau(don.getId(), phieu.getNgayNhap(), loi.keySet());
            cachBu = datSau != null && datSau > 0 ? Set.of() : Set.of(BienBanTraHangNcc.PA_TRU_CONG_NO);
        }
        return new LuaChonMo(cachBu, hangLoi);
    }

    /**
     * Nhà cung cấp trả lời trên cổng (không có tài khoản: phiên cổng đã xác thực email và các nhà cung cấp của email đó).
     * Lần đầu phải chọn mọi việc còn mở; sau đó chỉ đổi được theo {@link #luaChonMo}. Phiếu đã nhập kho thì trừ tiền áp
     * ngay vào đơn mua; chưa nhập kho thì lúc nhập kho sẽ áp. {@code phienBan}: lần lập nhà cung cấp đang xem (id dòng
     * nhật ký lập; null với biên bản cũ không có nhật ký lập), luôn phải khớp lần lập cuối: kho vừa lập lại, hoặc không
     * gửi mà biên bản có lần lập, thì 409 — không ghi câu trả lời cho số lỗi cũ.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto traLoiTuCong(Integer id, Collection<Integer> nhaCungCapIds, Integer phienBan, String phuongAn,
                                         String hangLoi, String nguoiXacNhan, String ghiChu) {
        BienBanTraHangNcc docTruoc = bienBanCuaCong(id, nhaCungCapIds);
        // Kiểm dữ liệu gửi lên trước khi giữ khóa
        String pa = gon(phuongAn);
        if (pa != null && !PHUONG_AN_CHOT_HOP_LE.contains(pa)) throw traLoiSai("chungTuKho.cachBuKhongHopLe", "phuongAn");
        String hl = gon(hangLoi);
        if (hl != null && !HANG_LOI_HOP_LE.contains(hl)) throw traLoiSai("chungTuKho.hangLoiKhongHopLe", "hangLoi");
        String nguoi = kiemNguoiXacNhanCong(nguoiXacNhan);
        String gc = gon(ghiChu);
        if (soKyTu(gc) > GHI_CHU_TOI_DA) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    ThongDiep.of("chungTuKho.rtvGhiChuQuaDai", GHI_CHU_TOI_DA), Map.of("o", "ghiChu"));
        }

        PhieuNhapKho phieu = docTruoc.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        Map<Integer, ChiTietDonMuaHang> dongDon = khoaDongDon(don);
        BienBanTraHangNcc bb = khoaLai(docTruoc);
        // Đọc lại nhật ký sau khi khóa: kho vừa lập lại (chờ ký lại) giữa lúc đọc và lúc khóa thì không nhận câu trả lời
        NhatKyTraHangNcc.NhatKy nkKhoa = nhatKy.doc(bb.getId());
        if (nkKhoa.choKy() || !Objects.equals(nhatKy.idLapCuoi(bb.getId()), phienBan)) {
            throw khongConNhan("chungTuKho.congBienBanVuaCapNhat", bb);
        }
        if (!bb.dangHieuLuc()) throw khongConNhan("chungTuKho.congBienBanDaHuy", bb);
        LuaChonMo mo = luaChonMo(bb);
        if (!mo.co()) {
            throw khongConNhan(donKetThuc(don.getTrangThai()) ? "chungTuKho.congDonDaKetThuc" : "chungTuKho.congDaXuLyXong", bb);
        }
        String paCu = bb.phuongAn();
        String hlCu = nkKhoa.luaChonHangLoi();
        boolean doiCachBu = pa != null && !pa.equals(paCu);
        boolean doiHangLoi = hl != null && !hl.equals(hlCu);
        if (doiCachBu && !mo.cachBu().contains(pa)) {
            throw khongConNhan(donKetThuc(don.getTrangThai()) ? "chungTuKho.congDonDaKetThuc" : "chungTuKho.congCachBuDaChot", bb);
        }
        if (doiHangLoi && !mo.hangLoi().contains(hl)) throw khongConNhan("chungTuKho.congHangLoiDaXuLy", bb);
        if (pa == null && BienBanTraHangNcc.PA_CHO_CHOT.equals(paCu) && !mo.cachBu().isEmpty()) {
            throw traLoiSai("chungTuKho.cachBuKhongHopLe", "phuongAn");
        }
        if (hl == null && hlCu == null && !mo.hangLoi().isEmpty()) throw traLoiSai("chungTuKho.hangLoiKhongHopLe", "hangLoi");
        if (!doiCachBu && !doiHangLoi) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    ThongDiep.of("chungTuKho.congKhongCoGiThayDoi"));
        }

        boolean daNhap = laPhieuDaNhap(phieu);
        Map<Integer, Integer> tru = Map.of();
        BigDecimal tien = BigDecimal.ZERO;
        if (doiCachBu && daNhap && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(pa)) {
            Map<Integer, Integer> loi = soLoiTheoBienThe(phieu.getId());
            // Phiếu nhập Nháp khác của đơn đang giữ phần còn thiếu: chưa trừ được, nhà cung cấp chọn giao bù hoặc chờ
            if (timVuotConThieu(don, dongDon, loi) != null) throw khongConNhan("chungTuKho.congChuaTruTienDuoc", bb);
            tien = congTruTienVaoDon(dongDon, loi);
            tru = loi;
        }
        String paMoi = doiCachBu ? pa : paCu;
        String hlMoi = doiHangLoi ? hl : hlCu;
        if (doiCachBu) {
            bb.setPhuongAnXuLy(pa);
            bienBanTraHangNccRepository.save(bb);
        }
        nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.ghi(paMoi, paCu, doiHangLoi ? hl : null,
                NhatKyTraHangNcc.NGUON_CONG_NCC, nguoi, tru, tien, gc));
        if (daNhap && doiCachBu) capNhatNhanDu(don, dongDon, null);
        if (entityManager != null) entityManager.flush();

        if (thongBaoMuaHangService != null) thongBaoMuaHangService.nccDaTraLoi(bb, phieu, paMoi, hlMoi);
        if (daNhap) baoViecConLai(bb, phieu, hlMoi, null);
        BienBanTraHangDto kq = toDto(bb, true);
        if (emailNghiepVuService != null) emailNghiepVuService.guiDaGhiNhanTraLoi(bb, kq, false);
        log.info("[RTV-CONG] Biên bản `{}`: nhà cung cấp chọn {} / hàng lỗi {} (người xác nhận: {}){}", bb.getMaBienBan(),
                paMoi, hlMoi, nguoi, daNhap ? "" : ", áp vào đơn lúc nhập kho");
        return kq;
    }

    private static LoiCoMaException traLoiSai(String khoa, String o) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, ThongDiep.of(khoa), Map.of("o", o));
    }

    private static LoiCoMaException khongConNhan(String khoa, BienBanTraHangNcc bb) {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.BIEN_BAN_KHONG_CON_NHAN, ThongDiep.of(khoa, bb.getMaBienBan()));
    }

    private static boolean laPhieuDaNhap(PhieuNhapKho phieu) {
        return phieu.getTrangThai() != null && phieu.getTrangThai() == TrangThaiPhieuNhap.COMPLETED.getValue();
    }

    /**
     * Khóa và NẠP LẠI biên bản đã đọc (sau khi đã khóa dòng đơn → đơn): đối tượng đã có trong phiên nên khoaTheoId không
     * cập nhật trạng thái mới — đọc số cũ thì nhà cung cấp trả lời hai lần / ghi đè việc kho vừa làm.
     */
    private BienBanTraHangNcc khoaLai(BienBanTraHangNcc bb) {
        if (entityManager != null) {
            entityManager.refresh(bb, LockModeType.PESSIMISTIC_WRITE);
            entityManager.refresh(bb.getPhieuNhapKho());
        }
        return bb;
    }

    /**
     * Phiếu nhập vừa hoàn tất (đã là COMPLETED, dòng đơn mua đã cộng hàng đạt và đang bị khóa): số lỗi đã khóa.
     * Nhà cung cấp đã chọn trừ tiền thì áp ngay vào đơn mua; đã chọn giao bù thì đơn vẫn chờ số đó; chưa chọn thì báo mua
     * hàng biên bản đang chờ nhà cung cấp trả lời. Hàng lỗi nhà cung cấp đã chọn nhận lại / tiêu hủy thì báo kho làm.
     */
    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void khiNhapKho(BienBanTraHangNcc bienBan, PhieuNhapKho phieu, Integer nguoiNhapId) {
        DonMuaHang don = phieu.getDonMuaHang();
        if (bienBan == null || !bienBan.dangHieuLuc() || don == null) return;
        // Biên bản lập trước khi có cổng (không có nhật ký lập): phương án cũ do kho chọn, nhà cung cấp chưa được hỏi
        if (!BienBanTraHangNcc.PA_CHO_CHOT.equals(bienBan.phuongAn()) && nhatKy.idLapCuoi(bienBan.getId()) == null) {
            // Mã cũ "trả tài xế" là dấu duy nhất cho biết hàng lỗi đã rời kho: ghi sang trạng thái trước khi bỏ mã
            if (BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(bienBan.getPhuongAnXuLy())) {
                bienBan.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            }
            bienBan.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
            bienBanTraHangNccRepository.save(bienBan);
        }
        String hangLoi = nhatKy.doc(bienBan.getId()).luaChonHangLoi();
        String phuongAn = bienBan.phuongAn();
        if (BienBanTraHangNcc.PA_TRU_CONG_NO.equals(phuongAn)) {
            Map<Integer, ChiTietDonMuaHang> dongDon = khoaDongDon(don);
            Map<Integer, Integer> loi = soLoiTheoBienThe(phieu.getId());
            ThongDiep vuot = timVuotConThieu(don, dongDon, loi);
            if (vuot == null) {
                BigDecimal tien = congTruTienVaoDon(dongDon, loi);
                nhatKy.ghiTruTien(bienBan, loi, tien);
                log.info("[RTV-NHAP-KHO] Biên bản `{}`: áp trừ tiền nhà cung cấp đã chọn ({} sản phẩm)",
                        bienBan.getMaBienBan(), loi.values().stream().mapToInt(Integer::intValue).sum());
                baoViecConLai(bienBan, phieu, hangLoi, nguoiNhapId);
                return;
            }
            // Số lỗi vượt phần còn thiếu của đơn (phiếu Nháp khác đang giữ hàng): không trừ được, nhà cung cấp chọn lại
            log.warn("[RTV-NHAP-KHO] Biên bản `{}`: không áp được trừ tiền nhà cung cấp đã chọn ({}), chuyển chờ chọn",
                    bienBan.getMaBienBan(), vuot.tiengViet());
            bienBan.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
            bienBanTraHangNccRepository.save(bienBan);
            nhatKy.ghiTraLoi(bienBan, NhatKyTraHangNcc.TraLoi.ghi(BienBanTraHangNcc.PA_CHO_CHOT,
                    BienBanTraHangNcc.PA_TRU_CONG_NO, null, NhatKyTraHangNcc.NGUON_NHAP_KHO, null, Map.of(),
                    BigDecimal.ZERO, vuot.tiengViet()));
        } else if (BienBanTraHangNcc.PA_DOI_HANG.equals(phuongAn)) {
            baoViecConLai(bienBan, phieu, hangLoi, nguoiNhapId);
            return;
        }
        if (thongBaoMuaHangService == null) return;
        thongBaoMuaHangService.bienBanTraHang(bienBan, phieu, nguoiNhapId);
        // Cách bù còn chờ nhưng hàng lỗi đã có lựa chọn: kho vẫn làm được
        if (hangLoi != null && bienBan.hangConOKho()) thongBaoMuaHangService.hangLoiCanXuLy(bienBan, phieu, hangLoi, nguoiNhapId);
    }

    /** Số lỗi theo biến thể của phiếu (từ lô đã khóa). */
    private Map<Integer, Integer> soLoiTheoBienThe(Integer phieuId) {
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        for (Object[] r : chiTietPhieuNhapKhoRepository.soLoiTheoBienThe(List.of(phieuId))) {
            kq.merge(((Number) r[1]).intValue(), ((Number) r[2]).intValue(), Integer::sum);
        }
        return kq;
    }

    /** Khóa các dòng của đơn mua (theo biến thể) rồi khóa đơn — cùng thứ tự với nhập kho và đóng đơn. */
    private Map<Integer, ChiTietDonMuaHang> khoaDongDon(DonMuaHang don) {
        Map<Integer, ChiTietDonMuaHang> dongDon = new LinkedHashMap<>();
        for (ChiTietDonMuaHang c : chiTietDonMuaHangRepository.khoaTheoDonMua(don.getId())) {
            dongDon.putIfAbsent(c.getBienTheSanPham().getId(), c);
        }
        if (entityManager != null) entityManager.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        return dongDon;
    }

    /**
     * Trừ tiền làm dòng đơn hết chờ số lỗi, nên số lỗi phải ≤ còn thiếu − phần phiếu Nháp khác của đơn đang giữ. Trả câu
     * lỗi của biến thể đầu tiên vượt, hoặc null khi trừ được.
     */
    private ThongDiep timVuotConThieu(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, Map<Integer, Integer> loi) {
        for (Map.Entry<Integer, Integer> e : loi.entrySet()) {
            ChiTietDonMuaHang dong = dongDon.get(e.getKey());
            if (dong == null) continue;
            int soLoi = e.getValue();
            int conThieu = dong.conThieu().intValue();
            BigDecimal giuBd = chiTietPhieuNhapKhoRepository.sumDuKienPhieuNhapCungDon(don.getId(), e.getKey());
            int dangGiu = giuBd == null ? 0 : giuBd.intValue();
            if (soLoi <= conThieu - dangGiu) continue;
            String sku = dong.getBienTheSanPham().getMaSku();
            if (dangGiu > 0) {
                List<String> dsGiu = chiTietPhieuNhapKhoRepository.soPhieuNhapGiuCungDon(don.getId(), e.getKey());
                return ThongDiep.of("chungTuKho.truTienPhieuGiu", sku, soLoi, dangGiu,
                        dsGiu == null || dsGiu.isEmpty() ? "" : String.join(", ", dsGiu));
            }
            return ThongDiep.of("chungTuKho.truTienVuotConThieu", sku, soLoi, conThieu);
        }
        return null;
    }

    /** Cộng số lỗi trừ tiền vào "đã nhận" của từng dòng đơn (đơn không chờ số đó nữa). Trả số tiền trừ theo đơn giá dòng. */
    private BigDecimal congTruTienVaoDon(Map<Integer, ChiTietDonMuaHang> dongDon, Map<Integer, Integer> tru) {
        BigDecimal tien = BigDecimal.ZERO;
        for (Map.Entry<Integer, Integer> e : tru.entrySet()) {
            ChiTietDonMuaHang dong = dongDon.get(e.getKey());
            if (dong == null || e.getValue() <= 0) continue;
            BigDecimal daNhan = dong.getSoLuongDaNhan() == null ? BigDecimal.ZERO : dong.getSoLuongDaNhan();
            dong.setSoLuongDaNhan(daNhan.add(BigDecimal.valueOf(e.getValue())));
            chiTietDonMuaHangRepository.save(dong);
            if (dong.getDonGia() != null) tien = tien.add(dong.getDonGia().multiply(BigDecimal.valueOf(e.getValue())));
        }
        return tien;
    }

    /** Trừ tiền làm mọi dòng hết còn thiếu: đơn đang vận chuyển chuyển nhận đủ ngay. */
    private void capNhatNhanDu(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, NguoiDung nguoi) {
        if (Objects.equals(don.getTrangThai(), DON_DANG_VAN_CHUYEN)
                && !dongDon.isEmpty() && dongDon.values().stream().allMatch(c -> c.conThieu().signum() == 0)) {
            don.setTrangThai(DON_NHAN_DU);
            if (entityManager != null) entityManager.merge(don);
            if (thongBaoMuaHangService != null) thongBaoMuaHangService.donMuaDaNhanDu(don, null, nguoi);
        }
    }

    /**
     * Phiếu đã nhập kho, vừa có cách bù hoặc lựa chọn hàng lỗi: cách bù đã có thì thông báo "chờ nhà cung cấp" coi như
     * xong; hàng lỗi còn ở kho mà nhà cung cấp đã chọn thì báo kho giao trả / tiêu hủy.
     */
    private void baoViecConLai(BienBanTraHangNcc bb, PhieuNhapKho phieu, String hangLoi, Integer nguoiId) {
        if (thongBaoMuaHangService == null) return;
        if (!BienBanTraHangNcc.PA_CHO_CHOT.equals(bb.phuongAn())) thongBaoMuaHangService.bienBanDaChotXong(bb);
        if (hangLoi != null && bb.hangConOKho()) thongBaoMuaHangService.hangLoiCanXuLy(bb, phieu, hangLoi, nguoiId);
    }

    /** Người bên nhà cung cấp xác nhận trên cổng: cùng luật họ tên người dùng (HoTen). */
    private static String kiemNguoiXacNhanCong(String chuoi) {
        ThongDiep cau = loiHoTen(chuoi, "chungTuKho.nhapNguoiXacNhanNcc", "heThong.hoTenKyTu", "heThong.hoTenNgan",
                "chungTuKho.nguoiXacNhanNccQuaDai");
        if (cau == null) return HoTen.chuanHoa(chuoi);
        throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, cau, Map.of("o", "nguoiXacNhan"));
    }

    /** Câu lỗi họ tên theo luật HoTen (trống / ký tự lạ / ngắn / dài) bằng các khóa đã cho; hợp lệ thì null. */
    private static ThongDiep loiHoTen(String chuoi, String khoaTrong, String khoaKyTu, String khoaNgan, String khoaDai) {
        String loi = HoTen.loi(chuoi);
        if (loi == null) return null;
        if (HoTen.LOI_TRONG.equals(loi)) return ThongDiep.of(khoaTrong);
        if (HoTen.LOI_KY_TU.equals(loi)) return ThongDiep.of(khoaKyTu);
        if (HoTen.LOI_NGAN.equals(loi)) return ThongDiep.of(khoaNgan, HoTen.DO_DAI_TOI_THIEU);
        return ThongDiep.of(khoaDai, HoTen.DO_DAI_TOI_DA);
    }

    /** Số ký tự như giao diện đếm (theo ký tự, không theo đơn vị UTF-16); null là 0. */
    private static int soKyTu(String s) {
        return s == null ? 0 : s.codePointCount(0, s.length());
    }

    // ─────────────────────────────────────────────────────────────
    // HẠN TRẢ LỜI (việc định kỳ)
    // ─────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<Integer> dsChoNccTraLoi() {
        List<BienBanTraHangNcc> ds = bienBanTraHangNccRepository.timDangChoXuLy();
        Map<Integer, NhatKyTraHangNcc.NhatKy> nk = nhatKy.doc(ds.stream().map(BienBanTraHangNcc::getId).toList());
        return ds.stream()
                .filter(b -> nk.get(b.getId()).emailDauLuc() != null && choTraLoi(b, nk.get(b.getId())).co())
                .map(BienBanTraHangNcc::getId)
                .toList();
    }

    /**
     * Xét hạn trả lời của một biên bản (mỗi biên bản một giao dịch). Còn {@value #NHAC_TRUOC_HAN_NGAY} ngày tới hạn thì
     * gửi email nhắc một lần. Quá hạn mà chưa chọn cách bù thì chuyển trừ tiền: bên mua có quyền từ chối nhận hàng không
     * đạt, không cần nhà cung cấp đồng ý. Hàng lỗi chưa chọn thì vẫn giữ ở kho: tiêu hủy hàng của nhà cung cấp phải có
     * nhà cung cấp đồng ý.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public void xetHanTraLoi(Integer id, Instant now) {
        BienBanTraHangNcc bb = bienBanTraHangNccRepository.findById(id).orElse(null);
        if (bb == null) return;
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        ChoTraLoi cho = choTraLoi(bb, nk);
        if (!cho.co() || nk.emailDauLuc() == null) return;
        Instant han = hanTraLoi(nk.emailDauLuc());
        if (now.isAfter(han)) {
            if (cho.cachBu()) truTienQuaHan(bb);
            return;
        }
        if (!nk.daNhac() && !now.isBefore(han.minus(Duration.ofDays(NHAC_TRUOC_HAN_NGAY)))) {
            guiEmailBienBan(bb, NhatKyTraHangNcc.EMAIL_NHAC, moTaHangDaRoiKho(nk), nhatKy.idLapCuoi(id));
            log.info("[RTV-HAN] Nhắc nhà cung cấp trả lời biên bản `{}` (hạn {})", bb.getMaBienBan(), han);
        }
    }

    private void truTienQuaHan(BienBanTraHangNcc docTruoc) {
        PhieuNhapKho phieu = docTruoc.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        Map<Integer, ChiTietDonMuaHang> dongDon = khoaDongDon(don);
        BienBanTraHangNcc bb = khoaLai(docTruoc);
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(bb.getId());
        // Nhà cung cấp vừa trả lời / đơn vừa đóng trong lúc chờ khóa
        if (!choTraLoi(bb, nk).cachBu()) return;
        boolean daNhap = laPhieuDaNhap(phieu);
        Map<Integer, Integer> tru = Map.of();
        BigDecimal tien = BigDecimal.ZERO;
        if (daNhap) {
            Map<Integer, Integer> loi = soLoiTheoBienThe(phieu.getId());
            ThongDiep vuot = timVuotConThieu(don, dongDon, loi);
            if (vuot != null) {
                log.warn("[RTV-HAN] Biên bản `{}` quá hạn nhưng chưa trừ tiền được: {}", bb.getMaBienBan(), vuot.tiengViet());
                return;
            }
            tien = congTruTienVaoDon(dongDon, loi);
            tru = loi;
        }
        bb.setPhuongAnXuLy(BienBanTraHangNcc.PA_TRU_CONG_NO);
        bienBanTraHangNccRepository.save(bb);
        nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.ghi(BienBanTraHangNcc.PA_TRU_CONG_NO, BienBanTraHangNcc.PA_CHO_CHOT,
                null, NhatKyTraHangNcc.NGUON_TU_DONG, null, tru, tien, null));
        if (daNhap) capNhatNhanDu(don, dongDon, null);
        if (entityManager != null) entityManager.flush();
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.quaHanTruTien(bb, phieu);
        if (daNhap) baoViecConLai(bb, phieu, nk.luaChonHangLoi(), null);
        if (emailNghiepVuService != null) emailNghiepVuService.guiDaGhiNhanTraLoi(bb, toDto(bb, true), true);
        log.info("[RTV-HAN] Biên bản `{}` quá hạn trả lời: chuyển trừ tiền{}", bb.getMaBienBan(),
                daNhap ? "" : ", áp vào đơn lúc nhập kho");
    }

    // ─────────────────────────────────────────────────────────────
    // ĐƠN MUA
    // ─────────────────────────────────────────────────────────────

    /**
     * Đơn mua đóng nhận thiếu: hàng lỗi chờ chọn / chờ giao bù chuyển sang trừ tiền (tối đa phần còn thiếu của dòng đơn).
     * Gọi trong giao dịch đóng đơn, sau khi đã khóa dòng đơn và đơn.
     */
    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void chuyenTruTienKhiDongDon(DonMuaHang don, NguoiDung nguoiDong, String lyDo) {
        List<BienBanTraHangNcc> dsBienBan = bienBanTraHangNccRepository.khoaTheoDonMua(don.getId());
        if (dsBienBan.isEmpty()) return;
        Map<Integer, ChiTietDonMuaHang> dongDon = new HashMap<>();
        for (ChiTietDonMuaHang c : don.getChiTietDonMuaHangs()) dongDon.putIfAbsent(c.getBienTheSanPham().getId(), c);
        String ghiChu = lyDo == null ? null : (lyDo.length() > GHI_CHU_TOI_DA ? lyDo.substring(0, GHI_CHU_TOI_DA) : lyDo);
        for (BienBanTraHangNcc bb : dsBienBan) {
            String pa = bb.phuongAn();
            if (BienBanTraHangNcc.PA_TRU_CONG_NO.equals(pa)) continue;
            Map<Integer, Integer> loi = soLoiTheoBienThe(bb.getPhieuNhapKho().getId());
            if (BienBanTraHangNcc.PA_DOI_HANG.equals(pa) && buXong(loi.keySet(), dongDon, don.getTrangThai())) continue;
            Map<Integer, Integer> tru = new LinkedHashMap<>();
            for (Map.Entry<Integer, Integer> e : loi.entrySet()) {
                ChiTietDonMuaHang dong = dongDon.get(e.getKey());
                if (dong == null) continue;
                int n = Math.min(e.getValue(), dong.conThieu().intValue());
                if (n > 0) tru.put(e.getKey(), n);
            }
            BigDecimal tien = congTruTienVaoDon(dongDon, tru);
            // Không còn thiếu gì để trừ (nhà cung cấp đã giao đủ ở đợt sau): coi như đã bù
            String moi = tru.isEmpty() ? BienBanTraHangNcc.PA_DOI_HANG : BienBanTraHangNcc.PA_TRU_CONG_NO;
            bb.setPhuongAnXuLy(moi);
            bienBanTraHangNccRepository.save(bb);
            nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.ghi(moi, pa, null, NhatKyTraHangNcc.NGUON_DONG_DON, null,
                    tru, tien, ghiChu));
            log.info("[RTV-DONG-DON] Đơn `{}` đóng: biên bản `{}` ({} → {}, trừ {} sản phẩm)", don.getSoDonMua(),
                    bb.getMaBienBan(), pa, moi, tru.values().stream().mapToInt(Integer::intValue).sum());
            baoViecConLai(bb, bb.getPhieuNhapKho(), nhatKy.doc(bb.getId()).luaChonHangLoi(),
                    nguoiDong == null ? null : nguoiDong.getId());
        }
    }

    /**
     * Số hàng lỗi đã trừ tiền theo biến thể của một đơn mua (đã nằm trong "đã nhận" của dòng đơn): màn chi tiết đơn tách
     * hàng đạt với phần trừ tiền. Biên bản trừ tiền lập trước khi có nhật ký: toàn bộ số lỗi của phiếu.
     */
    @Override
    @Transactional(readOnly = true)
    public Map<Integer, Integer> truTienTheoBienThe(Integer donMuaHangId) {
        List<BienBanTraHangNcc> ds = bienBanTraHangNccRepository.timChoDanhSach(null, donMuaHangId).stream()
                .filter(BienBanTraHangNcc::dangHieuLuc).toList();
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        if (ds.isEmpty()) return kq;
        Map<Integer, NhatKyTraHangNcc.NhatKy> nk = nhatKy.doc(ds.stream().map(BienBanTraHangNcc::getId).toList());
        for (BienBanTraHangNcc bb : ds) {
            NhatKyTraHangNcc.NhatKy n = nk.get(bb.getId());
            if (n.lap() == null && n.soTru() == 0 && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(bb.phuongAn())
                    && laPhieuDaNhap(bb.getPhieuNhapKho())) {
                soLoiTheoBienThe(bb.getPhieuNhapKho().getId()).forEach((k, v) -> kq.merge(k, v, Integer::sum));
            } else {
                n.truTheoBienThe().forEach((k, v) -> kq.merge(k, v, Integer::sum));
            }
        }
        return kq;
    }

    // ─────────────────────────────────────────────────────────────
    // KHO LÀM THEO LỰA CHỌN CỦA NHÀ CUNG CẤP
    // ─────────────────────────────────────────────────────────────

    /** Nhà cung cấp đã chọn nhận lại: kho ghi đã giao (nhà cung cấp đến lấy hoặc gửi vận chuyển). */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto ghiDaGiaoTra(Integer id, GiaoTraHangLoiRequest request) {
        BienBanTraHangNcc bienBan = khoaDeGhiHang(id);
        if (!BienBanTraHangNcc.HL_NHAN_LAI.equals(nhatKy.doc(id).luaChonHangLoi())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.giaoTraCanNccNhanLai", bienBan.getMaBienBan()));
        }
        String cachGiao = request == null || request.getCachGiao() == null ? null : request.getCachGiao().trim();
        if (cachGiao == null || !CACH_GIAO_HOP_LE.contains(cachGiao)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.cachGiaoKhongHopLe"));
        }
        boolean vanChuyen = BienBanTraHangNcc.GIAO_VAN_CHUYEN.equals(cachGiao);
        String nguoiNhan = gon(request.getNguoiNhan());
        if (nguoiNhan == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    ThongDiep.of(vanChuyen ? "chungTuKho.nhapDonViVanChuyen" : "chungTuKho.nhapNguoiNhanGiaoTra"));
        }
        if (soKyTu(nguoiNhan) > TEN_TOI_DA) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.nguoiNhanHangLoiQuaDai", TEN_TOI_DA));
        }
        String maVanDon = vanChuyen ? gon(request.getMaVanDon()) : null;
        if (vanChuyen && maVanDon == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.rtvNhapMaVanDon"));
        }
        if (soKyTu(maVanDon) > MA_VAN_DON_TOI_DA) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.maVanDonQuaDai", MA_VAN_DON_TOI_DA));
        }
        Instant thoiDiem = kiemThoiDiem(bienBan, request.getThoiDiem());
        String ghiChu = kiemGhiChu(request.getGhiChu());

        bienBan.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
        bienBanTraHangNccRepository.save(bienBan);
        nhatKy.ghiGiaoTra(bienBan, cachGiao, nguoiNhan, maVanDon, thoiDiem, ghiChu);
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.hangLoiDaRoiKho(bienBan);
        log.info("[RTV-GIAO-TRA] Biên bản `{}` đã giao trả ({}, {})", bienBan.getMaBienBan(), cachGiao, nguoiNhan);
        return toDto(bienBan, true);
    }

    /**
     * Nhà cung cấp đã đồng ý tiêu hủy trên cổng: kho ghi đã tiêu hủy (người đồng ý lấy từ câu trả lời của nhà cung cấp).
     * Thời điểm tiêu hủy không được trước lúc nhà cung cấp đồng ý.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto ghiTieuHuy(Integer id, GiaoTraHangLoiRequest request) {
        BienBanTraHangNcc bienBan = khoaDeGhiHang(id);
        NhatKyTraHangNcc.TraLoi dongY = nhatKy.doc(id).hangLoi();
        if (dongY == null || !BienBanTraHangNcc.HL_TIEU_HUY.equals(dongY.hangLoi())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.tieuHuyCanNccDongY", bienBan.getMaBienBan()));
        }
        Instant thoiDiem = kiemThoiDiem(bienBan, request == null ? null : request.getThoiDiem());
        if (dongY.luc() != null && thoiDiem.isBefore(dongY.luc().minus(Duration.ofMinutes(1)))) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.tieuHuyTruocLucDongY",
                    DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").format(dongY.luc().atZone(MUI_GIO_VN))));
        }
        String ghiChu = kiemGhiChu(request == null ? null : request.getGhiChu());

        bienBan.setTrangThai(BienBanTraHangNcc.DA_TIEU_HUY);
        bienBanTraHangNccRepository.save(bienBan);
        nhatKy.ghiTieuHuy(bienBan, dongY.nguoiXacNhan(), thoiDiem, ghiChu);
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.hangLoiDaRoiKho(bienBan);
        log.info("[RTV-TIEU-HUY] Biên bản `{}` tiêu hủy hàng lỗi (nhà cung cấp đồng ý: {})", bienBan.getMaBienBan(),
                dongY.nguoiXacNhan());
        return toDto(bienBan, true);
    }

    /** Khóa biên bản để ghi việc hàng: phải còn hiệu lực, phiếu đã nhập kho, hàng còn ở kho, đúng kho đang chọn. */
    private BienBanTraHangNcc khoaDeGhiHang(Integer id) {
        BienBanTraHangNcc bienBan = bienBanTraHangNccRepository.khoaTheoId(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("chungTuKho.bienBanTraHangKhongTimThay", id)));
        PhieuNhapKho phieu = bienBan.getPhieuNhapKho();
        KhoDangChon.kiemTra(phieu.getKho(), "Biên bản trả hàng " + bienBan.getMaBienBan());
        if (!bienBan.dangHieuLuc()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.bienBanDaHuyKhongThaoTac", bienBan.getMaBienBan()));
        }
        if (phieu.getTrangThai() == null || phieu.getTrangThai() != TrangThaiPhieuNhap.COMPLETED.getValue()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.giaoTraSauNhapKho", phieu.getSoPhieuNhap()));
        }
        if (!bienBan.hangConOKho()) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.hangLoiKhongConOKho", bienBan.getMaBienBan()));
        }
        return bienBan;
    }

    private static Instant kiemThoiDiem(BienBanTraHangNcc bienBan, Instant thoiDiem) {
        if (thoiDiem == null) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.nhapThoiDiemGiaoTra"));
        }
        if (bienBan.getNgayTao() != null && thoiDiem.isBefore(bienBan.getNgayTao().minus(Duration.ofMinutes(1)))) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.thoiDiemTruocLapBienBan"));
        }
        if (thoiDiem.isAfter(Instant.now().plus(LECH_DONG_HO))) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.thoiDiemGiaoTraSauHienTai"));
        }
        return thoiDiem;
    }

    /**
     * Người ký biên bản bên giao hàng: bắt buộc họ tên, biển số không bắt buộc, bên vận chuyển bắt buộc tên đơn vị.
     */
    private static NhatKyTraHangNcc.NguoiKy kiemNguoiKy(String benKy, PhatHanhBienBanRequest request) {
        String hoTen = kiemTenNguoiKy(request == null ? null : request.getNguoiNhanHang());
        String bienSo = kiemBienSo(request == null ? null : request.getBienSoXe());
        String donVi = null;
        if (BienBanTraHangNcc.BEN_KY_VAN_CHUYEN.equals(benKy)) {
            donVi = gon(request == null ? null : request.getDonViVanChuyen());
            if (donVi == null) throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.nhapDonViVanChuyen"));
            if (soKyTu(donVi) > TEN_TOI_DA) {
                throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.donViVanChuyenQuaDai", TEN_TOI_DA));
            }
        }
        return new NhatKyTraHangNcc.NguoiKy(benKy, hoTen, bienSo, donVi);
    }

    /**
     * Họ tên người giao hàng ký biên bản: cùng luật họ tên người dùng (HoTen — chữ cái, dấu cách, ' . -, 2–100 ký tự), lưu
     * cách viết đã chuẩn hóa. Cùng luật với ô họ tên ở hộp Lập biên bản.
     */
    static String kiemTenNguoiKy(String chuoi) {
        ThongDiep cau = loiHoTen(chuoi, "chungTuKho.nhapTenNguoiKy", "chungTuKho.tenNguoiKyKyTu", "chungTuKho.tenNguoiKyNgan",
                "chungTuKho.tenNguoiKyQuaDai");
        if (cau == null) return HoTen.chuanHoa(chuoi);
        throw new CommonException(HttpStatus.BAD_REQUEST, cau);
    }

    /** Biển số xe người giao hàng (không bắt buộc): trống thì null; có thì theo mẫu biển Việt Nam, lưu cách viết chuẩn "30A-123.45". */
    static String kiemBienSo(String chuoi) {
        if (chuoi == null) return null;
        BienSoXe.KetQua kq = BienSoXe.kiemTra(chuoi);
        if (kq.hopLe()) return kq.giaTri();
        // Chỉ toàn khoảng trắng / ký tự vô hình: coi như để trống
        if (BienSoXe.LOI_TRONG.equals(kq.loi())) return null;
        throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.bienSoXeLoi", kq.loiThongDiep()));
    }

    private static String kiemGhiChu(String ghiChu) {
        String g = gon(ghiChu);
        if (soKyTu(g) > GHI_CHU_TOI_DA) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.rtvGhiChuQuaDai", GHI_CHU_TOI_DA));
        }
        return g;
    }

    // ─────────────────────────────────────────────────────────────
    // TRẠNG THÁI VÀ DTO
    // ─────────────────────────────────────────────────────────────

    /** Số lỗi theo biến thể của từng phiếu, dòng đơn mua của các đơn và nhật ký các biên bản, nạp một lần cho danh sách. */
    private record NguCanh(Map<Integer, Map<Integer, Integer>> loiTheoPhieu,
                           Map<Integer, Map<Integer, ChiTietDonMuaHang>> dongDonTheoDon,
                           Map<Integer, NhatKyTraHangNcc.NhatKy> nhatKyTheoBienBan) {
    }

    private NguCanh napNguCanh(Collection<BienBanTraHangNcc> ds) {
        if (ds.isEmpty()) return new NguCanh(Map.of(), Map.of(), Map.of());
        Map<Integer, Map<Integer, Integer>> loi = new HashMap<>();
        for (Object[] r : chiTietPhieuNhapKhoRepository.soLoiTheoBienThe(
                ds.stream().map(b -> b.getPhieuNhapKho().getId()).collect(Collectors.toSet()))) {
            loi.computeIfAbsent(((Number) r[0]).intValue(), k -> new LinkedHashMap<>())
                    .merge(((Number) r[1]).intValue(), ((Number) r[2]).intValue(), Integer::sum);
        }
        Set<Integer> donIds = ds.stream().map(b -> b.getPhieuNhapKho().getDonMuaHang())
                .filter(Objects::nonNull).map(DonMuaHang::getId).collect(Collectors.toSet());
        Map<Integer, Map<Integer, ChiTietDonMuaHang>> dongDon = new HashMap<>();
        if (!donIds.isEmpty()) {
            for (ChiTietDonMuaHang c : chiTietDonMuaHangRepository.findByDonMuaHang_IdIn(donIds)) {
                dongDon.computeIfAbsent(c.getDonMuaHang().getId(), k -> new HashMap<>())
                        .putIfAbsent(c.getBienTheSanPham().getId(), c);
            }
        }
        Map<Integer, NhatKyTraHangNcc.NhatKy> nk = nhatKy.doc(ds.stream().map(BienBanTraHangNcc::getId).toList());
        return new NguCanh(loi, dongDon, nk);
    }

    /** Giao bù đã xong: đơn đã đóng / hủy, hoặc mọi dòng đơn của các biến thể lỗi hết còn thiếu. */
    private static boolean buXong(Collection<Integer> bienThe, Map<Integer, ChiTietDonMuaHang> dongDon, Integer ttDon) {
        if (Objects.equals(ttDon, DON_DA_DONG) || Objects.equals(ttDon, DON_DA_HUY)) return true;
        for (Integer bt : bienThe) {
            ChiTietDonMuaHang dong = dongDon.get(bt);
            if (dong != null && dong.conThieu().signum() > 0) return false;
        }
        return true;
    }

    /**
     * Trạng thái hiển thị: chờ người giao hàng ký (chưa gửi nhà cung cấp), chờ nhà cung cấp trả lời, rồi việc kho làm theo lựa chọn của nhà cung cấp (giao
     * trả / tiêu hủy), rồi chờ hàng bù.
     */
    static String trangThaiHienThi(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk, boolean buXong) {
        if (!b.dangHieuLuc()) return TT_DA_HUY;
        if (nk.choKy()) return TT_CHO_KY;
        if (!laPhieuDaNhap(b.getPhieuNhapKho())) return TT_MOI_LAP;
        if (choTraLoi(b, nk).co()) return TT_CHO_CHOT;
        if (b.hangConOKho()) {
            return BienBanTraHangNcc.HL_TIEU_HUY.equals(nk.luaChonHangLoi()) ? TT_CHO_TIEU_HUY : TT_CHO_GIAO_TRA;
        }
        if (BienBanTraHangNcc.PA_DOI_HANG.equals(b.phuongAn()) && !buXong) return TT_CHO_HANG_BU;
        return TT_HOAN_TAT;
    }

    /**
     * Số biên bản RTV-yyyyMMdd-NNN theo ngày Việt Nam: lấy số thứ tự lớn nhất đã cấp trong ngày + 1.
     * Biên bản hủy vẫn giữ dòng (trạng thái DA_HUY) nên số lớn nhất không bao giờ lùi: số đã cấp không cấp lại.
     */
    private String sinhMaBienBan() {
        String tienTo = "RTV-" + LocalDate.now(MUI_GIO_VN).format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        int lonNhat = 0;
        for (String ma : bienBanTraHangNccRepository.findMaBienBanTheoTienTo(tienTo)) {
            try {
                lonNhat = Math.max(lonNhat, Integer.parseInt(ma.substring(tienTo.length())));
            } catch (NumberFormatException | IndexOutOfBoundsException ignored) {
                // số biên bản nhập tay khác mẫu: bỏ qua
            }
        }
        return String.format("%s%03d", tienTo, lonNhat + 1);
    }

    /**
     * Số lỗi theo biến thể để hiển thị: đã nhập kho theo lô (đã khóa); phiếu Nháp lô còn đổi nên theo dòng biên bản
     * ({@code items} null thì đọc dòng biên bản).
     */
    private Map<Integer, Integer> loiHienThi(BienBanTraHangNcc b, NguCanh nguCanh, List<BienBanTraHangDto.ChiTietItemDto> items) {
        Map<Integer, Integer> loi = nguCanh.loiTheoPhieu().getOrDefault(b.getPhieuNhapKho().getId(), Map.of());
        if (!loi.isEmpty()) return loi;
        Map<Integer, Integer> tuDong = new LinkedHashMap<>();
        if (items != null) {
            for (BienBanTraHangDto.ChiTietItemDto it : items) tuDong.merge(it.getBienTheSanPhamId(), it.getSoLuong(), Integer::sum);
        } else {
            for (ChiTietTraHangNcc c : chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(b.getId())) {
                tuDong.merge(c.getBienTheSanPham().getId(), c.getSoLuongLoi() == null ? 0 : c.getSoLuongLoi(), Integer::sum);
            }
        }
        return tuDong;
    }

    private BienBanTraHangDto toDto(BienBanTraHangNcc b, boolean coDongLoi) {
        return toDto(b, coDongLoi, napNguCanh(List.of(b)));
    }

    private BienBanTraHangDto toDto(BienBanTraHangNcc b, boolean coDongLoi, NguCanh nguCanh) {
        PhieuNhapKho phieu = b.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        NhaCungCap ncc = b.getNhaCungCap();
        Integer ttDon = don == null ? null : don.getTrangThai();
        Map<Integer, ChiTietDonMuaHang> dongDon = don == null ? Map.of()
                : nguCanh.dongDonTheoDon().getOrDefault(don.getId(), Map.of());
        NhatKyTraHangNcc.NhatKy nk = nguCanh.nhatKyTheoBienBan().getOrDefault(b.getId(), NhatKyTraHangNcc.NhatKy.TRONG);
        boolean daNhap = laPhieuDaNhap(phieu);

        List<BienBanTraHangDto.ChiTietItemDto> items = null;
        Map<Integer, BienTheSanPham> bienThe = new HashMap<>();
        if (coDongLoi) {
            items = chiTietTraHangNccRepository.findDetailByBienBanId(b.getId()).stream().map(c -> {
                BienTheSanPham bt = c.getBienTheSanPham();
                bienThe.putIfAbsent(bt.getId(), bt);
                return BienBanTraHangDto.ChiTietItemDto.builder()
                        .id(c.getId())
                        .bienTheSanPhamId(bt.getId())
                        .sku(bt.getMaSku())
                        .tenBienThe(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku())
                        .maLo(c.getMaLo())
                        .mauSac(bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null)
                        .kichCo(bt.getSize() != null ? bt.getSize().getTenSize() : null)
                        .lyDo(c.getLyDoLoi())
                        .soLuong(c.getSoLuongLoi())
                        .anhBangChungUrl(c.getAnhBangChungUrl())
                        .ghiChu(c.getGhiChu())
                        .build();
            }).toList();
        }
        Map<Integer, Integer> loi = coDongLoi ? loiHienThi(b, nguCanh, items)
                : nguCanh.loiTheoPhieu().getOrDefault(phieu.getId(), Map.of());
        BigDecimal giaTriLoi = BigDecimal.ZERO;
        List<BienBanTraHangDto.TheoBienTheDto> theoBienThe = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : loi.entrySet()) {
            ChiTietDonMuaHang dong = dongDon.get(e.getKey());
            BigDecimal donGia = dong == null ? null : dong.getDonGia();
            if (donGia != null) giaTriLoi = giaTriLoi.add(donGia.multiply(BigDecimal.valueOf(e.getValue())));
            BienTheSanPham bt = bienThe.get(e.getKey());
            if (bt == null && dong != null) bt = dong.getBienTheSanPham();
            theoBienThe.add(BienBanTraHangDto.TheoBienTheDto.builder()
                    .bienTheSanPhamId(e.getKey())
                    .sku(bt == null ? null : bt.getMaSku())
                    .tenBienThe(coDongLoi && bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                    .mauSac(coDongLoi && bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null)
                    .kichCo(coDongLoi && bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : null)
                    .soLuongLoi(e.getValue())
                    .donGia(donGia)
                    .conThieuDongDon(dong == null ? null : dong.conThieu())
                    .build());
        }
        String phuongAn = b.phuongAn();
        boolean buXong = BienBanTraHangNcc.PA_DOI_HANG.equals(phuongAn) && buXong(loi.keySet(), dongDon, ttDon);

        // Cách xử lý hàng lỗi lúc lập; biên bản lập trước khi có nhật ký: suy từ mã cũ "trả tài xế" (nhập kho đã đổi mã
        // đó thành đã trả hàng, chưa có việc giao trả nào ghi sau)
        NhatKyTraHangNcc.Lap lap = nk.lap();
        boolean cuTraTaiXe = BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(b.getPhuongAnXuLy())
                || BienBanTraHangNcc.DA_TRA_HANG.equals(b.getTrangThai()) && nk.giaoTra() == null;
        String cachXuLy = lap != null && lap.cachXuLy() != null ? lap.cachXuLy()
                : cuTraTaiXe ? BienBanTraHangNcc.TRA_NGAY : BienBanTraHangNcc.GIU_KHO;
        boolean traNgay = BienBanTraHangNcc.TRA_NGAY.equals(cachXuLy);

        // Cách bù: chỉ khi đã có phương án; không có dòng nhật ký (biên bản cũ) thì nguồn là dữ liệu cũ
        NhatKyTraHangNcc.TraLoi chot = BienBanTraHangNcc.PA_CHO_CHOT.equals(phuongAn) ? null : nk.cachBu();
        String nguonChot = chot != null ? chot.nguon()
                : !BienBanTraHangNcc.PA_CHO_CHOT.equals(phuongAn) && daNhap ? NhatKyTraHangNcc.NGUON_DU_LIEU_CU : null;
        int soTru = nk.soTru();
        BigDecimal tienTru = nk.tienTru();
        if (NhatKyTraHangNcc.NGUON_DU_LIEU_CU.equals(nguonChot) && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(phuongAn) && soTru == 0) {
            soTru = loi.values().stream().mapToInt(Integer::intValue).sum();
            tienTru = giaTriLoi;
        }

        // Hàng lỗi rời kho: giao trả / tiêu hủy ghi sau nhập kho, hoặc trả ngay cho người giao hàng lúc ghi đã ký
        NhatKyTraHangNcc.GiaoTra gt = nk.giaoTra();
        NhatKyTraHangNcc.Ky ky = nk.ky();
        // Biên bản cũ (mã trả tài xế, không nhật ký) vẫn là đã trả, chỉ không có tên / lúc
        boolean daTraNgay = traNgay && b.dangHieuLuc() && !b.hangConOKho();
        boolean coLap = daTraNgay && lap != null;
        String nguoiNhan = gt != null ? gt.nguoiNhan() : coLap ? lap.nguoiKy().hoTen() : null;
        Instant thoiDiemTra = gt != null ? gt.thoiDiem() : coLap ? (ky != null ? ky.luc() : lap.luc()) : null;
        String nguoiGhiTra = gt != null ? gt.nguoiGhi() : coLap ? (ky != null ? ky.nguoi() : lap.nguoi()) : null;
        String cachGiao = gt != null ? gt.cachGiao() : daTraNgay ? BienBanTraHangNcc.GIAO_TAI_XE : null;

        ChoTraLoi cho = choTraLoi(b, nk);
        NhatKyTraHangNcc.TraLoi chonHangLoi = nk.hangLoi();
        // Lựa chọn còn mở chỉ cần ở màn chi tiết (cổng nhà cung cấp): tính giao bù đổi được không phải đọc phiếu về sau
        LuaChonMo mo = coDongLoi ? luaChonMo(b) : null;

        return BienBanTraHangDto.builder()
                .id(b.getId())
                .soBienBan(b.getMaBienBan())
                .phieuNhapKhoId(phieu.getId())
                .soPhieuNhap(phieu.getSoPhieuNhap())
                .phieuDaNhap(daNhap)
                .ngayNhapKho(daNhap ? phieu.getNgayNhap() : null)
                .nguoiNhapKho(phieu.getNguoiNhap() == null ? null : phieu.getNguoiNhap().getHoTen())
                .donMuaHangId(don == null ? null : don.getId())
                .soDonMua(don == null ? null : don.getSoDonMua())
                .trangThaiDonMua(ttDon)
                .khoId(phieu.getKho() == null ? null : phieu.getKho().getId())
                .tenKho(phieu.getKho() == null ? null : phieu.getKho().getTenKho())
                .nhaCungCapId(ncc.getId())
                .maNhaCungCap(ncc.getMaNhaCungCap())
                .tenNhaCungCap(ncc.getTenNhaCungCap())
                .nguoiLienHeNcc(ncc.getNguoiLienHe())
                .dienThoaiNcc(ncc.getSoDienThoai())
                .emailNcc(ncc.getEmail())
                .emailGuiLuc(nk.emailGuiLuc())
                .lapCuoiLuc(lap == null ? null : lap.luc())
                .phuongAn(phuongAn)
                .buXong(buXong)
                .nguonChot(nguonChot)
                .nguoiXacNhanNcc(chot == null ? null : chot.nguoiXacNhan())
                .ghiChuChot(chot == null ? null : chot.ghiChu())
                .nguoiChot(chot == null ? null : chot.nguoi())
                .thoiDiemChot(chot == null ? null : chot.luc())
                .hangLoiNcc(chonHangLoi == null ? null : chonHangLoi.hangLoi())
                .nguoiChonHangLoi(chonHangLoi == null ? null : chonHangLoi.nguoiXacNhan())
                .thoiDiemChonHangLoi(chonHangLoi == null ? null : chonHangLoi.luc())
                .ghiChuChonHangLoi(chonHangLoi == null ? null : chonHangLoi.ghiChu())
                .choNccChonCachBu(cho.cachBu())
                .choNccChonHangLoi(cho.hangLoi())
                .hanTraLoi(nk.emailDauLuc() == null ? null : hanTraLoi(nk.emailDauLuc()))
                .daNhacHan(nk.daNhac())
                .cachBuMo(mo == null ? null : List.copyOf(new TreeSet<>(mo.cachBu())))
                .hangLoiMo(mo == null ? null : List.copyOf(new TreeSet<>(mo.hangLoi())))
                .soLuongTruTien(soTru)
                .tienTruTien(tienTru)
                .ghiChu(b.getGhiChu())
                .ngayLap(b.getNgayTao())
                .nguoiLap(b.getNguoiTao() == null ? null : b.getNguoiTao().getHoTen())
                .tongSoLuongLoi(b.getTongSoLuongLoi())
                .giaTriLoi(giaTriLoi)
                .trangThai(b.dangHieuLuc() ? BienBanTraHangNcc.CHO_TRA_HANG : BienBanTraHangNcc.DA_HUY)
                .trangThaiHienThi(trangThaiHienThi(b, nk, buXong))
                .cachXuLyHang(cachXuLy)
                .trangThaiHang(b.dangHieuLuc() ? b.maHangLoi() : BienBanTraHangNcc.HANG_O_KHO)
                .nguoiNhanHang(nguoiNhan)
                .benKy(lap == null ? null : lap.nguoiKy().ben())
                .nguoiGiao(lap == null ? null : lap.nguoiKy().hoTen())
                .bienSoXe(lap == null ? null : lap.nguoiKy().bienSoXe())
                .donViVanChuyen(lap == null ? null : lap.nguoiKy().donViVanChuyen())
                .kyBienBan(nk.kyBienBan())
                .thoiDiemKy(ky == null ? null : ky.luc())
                .nguoiGhiKy(ky == null ? null : ky.nguoi())
                .cachGiao(cachGiao)
                .maVanDon(gt == null ? null : gt.maVanDon())
                .thoiDiemTra(thoiDiemTra)
                .nguoiGhiTra(nguoiGhiTra)
                .ghiChuTra(gt == null ? null : gt.ghiChu())
                .duLieuCu(lap == null)
                .theoBienThe(theoBienThe)
                .items(items)
                .build();
    }
}
