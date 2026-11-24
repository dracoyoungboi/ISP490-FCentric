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
        // Khóa và nạp lại biên bản đang có: nhà cung cấp trả lời cùng lúc trên cổng thì lần lưu dưới đây không ghi đè cách
        // bù vừa chọn bằng số cũ đã đọc
        if (bienBan != null && entityManager != null) entityManager.refresh(bienBan, LockModeType.PESSIMISTIC_WRITE);
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

        // Lập lại mà hàng lỗi và người ký không đổi (cùng lô, lý do, số lượng; vẫn giữ ở kho), chỉ sửa ghi chú: tờ đã ký
        // và nhà cung cấp đang cầm đúng biên bản này nên giữ việc ký, câu trả lời; không ghi lần lập mới, không gửi email
        NhatKyTraHangNcc.Lap lapCu = lapLai ? nhatKy.doc(bienBan.getId()).lap() : null;
        boolean khongDoiHang = lapCu != null && !traNgay && BienBanTraHangNcc.GIU_KHO.equals(lapCu.cachXuLy())
                && nguoiKy.equals(lapCu.nguoiKy())
                && demTheoLoVaLyDo(dongBienBanHieuLuc).equals(demTheoLoVaLyDo(dongMoi));
        if (bienBan == null) {
            bienBan = BienBanTraHangNcc.builder()
                    .maBienBan(sinhMaBienBan())
                    .phieuNhapKho(phieu)
                    .nhaCungCap(phieu.getNhaCungCap())
                    .nguoiTao(nguoiTao)
                    .build();
        } else if (!khongDoiHang) {
            // Lập lại có đổi hàng lỗi: thay toàn bộ dòng cũ bằng số kiểm đếm hiện tại, giữ số biên bản. Hàng lỗi không đổi
            // thì giữ nguyên các dòng (đúng tờ đã ký): lựa chọn của nhà cung cấp gắn theo từng dòng
            chiTietTraHangNccRepository.deleteAll(chiTietTraHangNccRepository.findByBienBanTraHangNcc_Id(bienBan.getId()));
        }
        // Lập (lại) có đổi hàng lỗi là biên bản mới với nhà cung cấp: câu trả lời trước (nếu có) không còn hiệu lực
        if (!khongDoiHang) bienBan.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
        bienBan.setGhiChu(ghiChu);
        // Giao luôn: hàng lỗi rời kho lúc người giao hàng ký nhận (ghiKy), tới lúc đó vẫn ở kho
        bienBan.setTrangThai(BienBanTraHangNcc.CHO_TRA_HANG);
        if (!khongDoiHang) bienBan.setTongSoLuongLoi(dongMoi.stream().mapToInt(ChiTietTraHangNcc::getSoLuongLoi).sum());
        BienBanTraHangNcc savedHeader;
        try {
            savedHeader = bienBanTraHangNccRepository.saveAndFlush(bienBan);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // Hai biên bản lập cùng lúc được cùng số: biên bản sau lập lại sẽ nhận số kế tiếp
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("chungTuKho.soBienBanTraHangTrung", bienBan.getMaBienBan()));
        }
        if (!khongDoiHang) {
            for (ChiTietTraHangNcc dong : dongMoi) {
                dong.setBienBanTraHangNcc(savedHeader);
            }
            chiTietTraHangNccRepository.saveAll(dongMoi);
        }
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
        if (!choTraLoi(bb, nk, dungDong(bb, nk, dongCua(bb.getId()))).co()) {
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
                .map(b -> {
                    if (BienBanTraHangNcc.PA_CHO_CHOT.equals(b.phuongAn())) return true;
                    if (!b.hangConOKho()) return false;
                    NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(bienBanId);
                    return dungDong(b, nk, dongCua(bienBanId)).stream().anyMatch(d -> d.oKho() && d.hangLoi() == null);
                })
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
    // TỪNG DÒNG: lựa chọn của nhà cung cấp và hàng lỗi theo dòng biên bản
    // ─────────────────────────────────────────────────────────────

    /**
     * Một dòng biên bản (lô × lý do) và lựa chọn đang áp dụng, dựng từ nhật ký: cách bù ({@code cachBu} CHO_CHOT |
     * DOI_HANG | TRU_CONG_NO), nhà cung cấp chọn gì cho hàng lỗi ({@code hangLoi} NHAN_LAI | TIEU_HUY | null) và hàng lỗi
     * của dòng đang ở đâu ({@code viTri} O_KHO | DA_TRA | DA_TIEU_HUY). {@code lanCachBu} / {@code lanHangLoi}: lần ghi
     * ra lựa chọn (nguồn, người xác nhận, lúc); null với lựa chọn suy từ cột của biên bản cũ.
     */
    record Dong(ChiTietTraHangNcc ct, String cachBu, NhatKyTraHangNcc.TraLoi lanCachBu, String hangLoi,
                NhatKyTraHangNcc.TraLoi lanHangLoi, String viTri, NhatKyTraHangNcc.GiaoTra giaoTra, Integer soTru) {

        /** Dòng trừ tiền cả dòng (hoặc chưa trừ tiền). */
        Dong(ChiTietTraHangNcc ct, String cachBu, NhatKyTraHangNcc.TraLoi lanCachBu, String hangLoi,
             NhatKyTraHangNcc.TraLoi lanHangLoi, String viTri, NhatKyTraHangNcc.GiaoTra giaoTra) {
            this(ct, cachBu, lanCachBu, hangLoi, lanHangLoi, viTri, giaoTra, null);
        }

        /** Số lỗi của dòng trừ tiền: cả dòng, hoặc phần đã trừ khi chỉ trừ một phần; dòng khác: 0. */
        int soLuongTru() {
            if (!BienBanTraHangNcc.PA_TRU_CONG_NO.equals(cachBu)) return 0;
            return soTru == null ? soLuong() : Math.min(soTru, soLuong());
        }

        Integer id() {
            return ct.getId();
        }

        Integer bienThe() {
            return ct.getBienTheSanPham() == null ? null : ct.getBienTheSanPham().getId();
        }

        int soLuong() {
            return ct.getSoLuongLoi() == null ? 0 : ct.getSoLuongLoi();
        }

        boolean oKho() {
            return BienBanTraHangNcc.HANG_O_KHO.equals(viTri);
        }

        String nguonCachBu() {
            return lanCachBu == null ? null : lanCachBu.nguon();
        }

        Dong voiCachBu(String moi) {
            return voiCachBu(moi, null);
        }

        /** Đổi cách bù; {@code soTruMoi}: trừ tiền một phần dòng (null: cả dòng). */
        Dong voiCachBu(String moi, Integer soTruMoi) {
            return new Dong(ct, moi, null, hangLoi, lanHangLoi, viTri, giaoTra, soTruMoi);
        }

        Dong voiHangLoi(String moi) {
            return new Dong(ct, cachBu, lanCachBu, moi, null, viTri, giaoTra, soTru);
        }

        Dong voiViTri(String moi) {
            return new Dong(ct, cachBu, lanCachBu, hangLoi, lanHangLoi, moi, giaoTra, soTru);
        }
    }

    /** Dòng của một biên bản, theo id dòng. */
    private List<ChiTietTraHangNcc> dongCua(Integer bienBanId) {
        if (bienBanId == null) return List.of();
        return chiTietTraHangNccRepository.timTheoBienBan(List.of(bienBanId));
    }

    /** Dòng của nhiều biên bản (một truy vấn), theo id biên bản. */
    private Map<Integer, List<ChiTietTraHangNcc>> dongTheoBienBan(Collection<Integer> bienBanIds) {
        Map<Integer, List<ChiTietTraHangNcc>> kq = new HashMap<>();
        if (bienBanIds.isEmpty()) return kq;
        for (ChiTietTraHangNcc c : chiTietTraHangNccRepository.timTheoBienBan(bienBanIds)) {
            if (c.getBienBanTraHangNcc() == null) continue;
            kq.computeIfAbsent(c.getBienBanTraHangNcc().getId(), k -> new ArrayList<>()).add(c);
        }
        return kq;
    }

    /** Mã cách bù hiện hành: mã cũ DOI_HANG_MOI = giao bù, TRA_TAI_XE = trừ tiền, trống = chờ chọn. */
    private static String chuanCachBu(String ma) {
        if (ma == null || ma.isBlank()) return BienBanTraHangNcc.PA_CHO_CHOT;
        if ("DOI_HANG_MOI".equals(ma)) return BienBanTraHangNcc.PA_DOI_HANG;
        if (BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(ma)) return BienBanTraHangNcc.PA_TRU_CONG_NO;
        return ma;
    }

    /**
     * Trạng thái từng dòng: lựa chọn riêng của dòng trong nhật ký, không có thì lựa chọn chung (cách ghi cũ), không có nữa
     * thì theo cột của biên bản (biên bản lập trước khi có nhật ký). Hàng lỗi: biên bản đã trả / tiêu hủy cả (cột trạng
     * thái) thì mọi dòng theo đó, không thì theo lần giao trả / tiêu hủy của dòng.
     */
    static List<Dong> dungDong(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk, List<ChiTietTraHangNcc> cts) {
        String paDau = b.phuongAn();
        String paMacDinh = BienBanTraHangNcc.PA_HON_HOP.equals(paDau) ? BienBanTraHangNcc.PA_CHO_CHOT : paDau;
        String hangDau = b.dangHieuLuc() ? b.maHangLoi() : BienBanTraHangNcc.HANG_O_KHO;
        List<ChiTietTraHangNcc> sapXep = new ArrayList<>(cts);
        sapXep.sort(Comparator.comparing(ChiTietTraHangNcc::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        List<Dong> kq = new ArrayList<>();
        for (ChiTietTraHangNcc ct : sapXep) {
            NhatKyTraHangNcc.LuaChon cb = nk.cachBuDong(ct.getId());
            NhatKyTraHangNcc.LuaChon hl = nk.hangLoiDong(ct.getId());
            NhatKyTraHangNcc.GiaoTra gt = nk.giaoTraDong(ct.getId());
            String viTri;
            if (BienBanTraHangNcc.HANG_DA_TRA.equals(hangDau) || BienBanTraHangNcc.HANG_DA_TIEU_HUY.equals(hangDau)) {
                viTri = hangDau;
            } else if (gt != null) {
                viTri = gt.tieuHuy() ? BienBanTraHangNcc.HANG_DA_TIEU_HUY : BienBanTraHangNcc.HANG_DA_TRA;
            } else {
                viTri = BienBanTraHangNcc.HANG_O_KHO;
            }
            kq.add(new Dong(ct, cb != null ? chuanCachBu(cb.giaTri()) : paMacDinh, cb == null ? null : cb.lan(),
                    hl == null ? null : hl.giaTri(), hl == null ? null : hl.lan(), viTri, gt, cb == null ? null : cb.soTru()));
        }
        return kq;
    }

    /** Cách bù của cả biên bản: CHO_CHOT khi còn dòng chưa có, các dòng cùng một cách thì cách đó, khác nhau thì HON_HOP. */
    static String tongCachBu(List<Dong> ds) {
        Set<String> cac = ds.stream().map(Dong::cachBu).collect(Collectors.toSet());
        if (cac.isEmpty() || cac.contains(BienBanTraHangNcc.PA_CHO_CHOT)) return BienBanTraHangNcc.PA_CHO_CHOT;
        return cac.size() == 1 ? cac.iterator().next() : BienBanTraHangNcc.PA_HON_HOP;
    }

    /** Hàng lỗi của cả biên bản: còn dòng ở kho thì chờ trả; rời kho hết thì đã trả / đã tiêu hủy / vừa trả vừa hủy. */
    static String tongViTri(List<Dong> ds) {
        if (ds.isEmpty() || ds.stream().anyMatch(Dong::oKho)) return BienBanTraHangNcc.CHO_TRA_HANG;
        boolean tra = ds.stream().anyMatch(d -> BienBanTraHangNcc.HANG_DA_TRA.equals(d.viTri()));
        boolean huy = ds.stream().anyMatch(d -> BienBanTraHangNcc.HANG_DA_TIEU_HUY.equals(d.viTri()));
        if (tra && huy) return BienBanTraHangNcc.DA_XU_LY;
        return huy ? BienBanTraHangNcc.DA_TIEU_HUY : BienBanTraHangNcc.DA_TRA_HANG;
    }

    /** Lựa chọn hàng lỗi của cả biên bản: một cách cho mọi dòng đã chọn, HON_HOP khi khác nhau, null khi chưa dòng nào. */
    static String tongHangLoi(List<Dong> ds) {
        Set<String> cac = ds.stream().map(Dong::hangLoi).filter(Objects::nonNull).collect(Collectors.toSet());
        if (cac.isEmpty()) return null;
        return cac.size() == 1 ? cac.iterator().next() : BienBanTraHangNcc.PA_HON_HOP;
    }

    /** Ghi lại hai cột tổng của biên bản theo trạng thái mới của các dòng. */
    private void dongBoDau(BienBanTraHangNcc bb, List<Dong> ds) {
        if (ds.isEmpty() || !bb.dangHieuLuc()) return;
        String pa = tongCachBu(ds);
        String tt = tongViTri(ds);
        if (Objects.equals(pa, bb.getPhuongAnXuLy()) && Objects.equals(tt, bb.getTrangThai())) return;
        bb.setPhuongAnXuLy(pa);
        bb.setTrangThai(tt);
        bienBanTraHangNccRepository.save(bb);
    }

    /**
     * Biên bản cũ chưa có cách bù trong nhật ký: mọi dòng lấy cách bù từ cột của biên bản. Trước lần ghi riêng cho một
     * phần dòng ({@code seGhi}), chép cách bù hiện hành của các dòng còn lại xuống nhật ký theo từng dòng (nguồn dữ liệu
     * cũ, không phải một lần trả lời) — không thì cột biên bản đổi sang tổng mới và các dòng này về chờ chọn. Gọi trước
     * {@link #dongBoDau}.
     */
    private void giuCachBuCu(BienBanTraHangNcc bb, List<Dong> ds, Set<Integer> seGhi) {
        Map<Integer, NhatKyTraHangNcc.ChonDong> giu = new LinkedHashMap<>();
        for (Dong d : ds) {
            if (d.lanCachBu() != null || d.id() == null || seGhi.contains(d.id())
                    || BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu())) continue;
            giu.put(d.id(), new NhatKyTraHangNcc.ChonDong(d.cachBu(), null, d.soTru()));
        }
        if (giu.isEmpty()) return;
        String pa = bb.phuongAn();
        nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.theoDong(pa, pa, giu, NhatKyTraHangNcc.NGUON_DU_LIEU_CU, null,
                Map.of(), BigDecimal.ZERO, null, false));
    }

    /** Số lỗi theo biến thể của các dòng. */
    static Map<Integer, Integer> theoBienThe(Collection<Dong> ds) {
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        for (Dong d : ds) {
            if (d.bienThe() != null && d.soLuong() > 0) kq.merge(d.bienThe(), d.soLuong(), Integer::sum);
        }
        return kq;
    }

    private static int tongSoLuong(Collection<Dong> ds) {
        return ds.stream().mapToInt(Dong::soLuong).sum();
    }

    // ─────────────────────────────────────────────────────────────
    // NHÀ CUNG CẤP TRẢ LỜI (cách bù và hàng lỗi của từng dòng)
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
     * Việc nhà cung cấp chưa trả lời (biên bản đã gửi). Cách bù: còn dòng chờ chọn và đơn mua chưa kết thúc (đóng đơn đã
     * chuyển hàng lỗi chưa bù sang trừ tiền). Hàng lỗi: còn dòng ở kho mà nhà cung cấp chưa chọn nhận lại hay tiêu hủy.
     */
    static ChoTraLoi choTraLoi(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk, List<Dong> ds) {
        DonMuaHang don = b.getPhieuNhapKho().getDonMuaHang();
        // Chưa ghi người giao hàng đã ký: biên bản chưa gửi nhà cung cấp, chưa có gì để trả lời
        if (!b.dangHieuLuc() || don == null || nk.choKy()) return ChoTraLoi.KHONG;
        // Biên bản không có dòng nào: không có gì để nhà cung cấp chọn (không nhắc, không tự chuyển, không treo ở chờ)
        if (ds.isEmpty()) return ChoTraLoi.KHONG;
        boolean donXong = donKetThuc(don.getTrangThai());
        return new ChoTraLoi(!donXong && ds.stream().anyMatch(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu())),
                ds.stream().anyMatch(d -> d.oKho() && d.hangLoi() == null));
    }

    private static boolean donKetThuc(Integer ttDon) {
        return Objects.equals(ttDon, DON_DA_DONG) || Objects.equals(ttDon, DON_DA_HUY);
    }

    /**
     * Lựa chọn nhà cung cấp còn chọn hoặc đổi được của từng dòng.
     * <ul>
     *   <li>Cách bù: phiếu chưa nhập kho thì đổi tự do (chưa áp vào đơn mua). Đã nhập kho: chọn khi còn chờ; giao bù đổi
     *   sang trừ tiền khi chưa có hàng nào của biến thể đó về sau biên bản (không tách được hàng bù với hàng giao thiếu);
     *   trừ tiền là chốt cuối. Đơn mua đã đóng / hủy, hoặc hệ thống đã chuyển khi quá hạn trả lời: không đổi nữa.</li>
     *   <li>Hàng lỗi: chọn và đổi được tới khi kho ghi dòng đó đã giao trả / tiêu hủy.</li>
     * </ul>
     */
    private Map<Integer, LuaChonMo> luaChonMo(BienBanTraHangNcc b, List<Dong> ds) {
        Map<Integer, LuaChonMo> kq = new HashMap<>();
        PhieuNhapKho phieu = b.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        if (!b.dangHieuLuc() || don == null) {
            for (Dong d : ds) kq.put(d.id(), LuaChonMo.DONG);
            return kq;
        }
        boolean daNhap = laPhieuDaNhap(phieu);
        boolean donXong = donKetThuc(don.getTrangThai());
        Map<Integer, Boolean> coHangVeSau = new HashMap<>();
        for (Dong d : ds) {
            Set<String> hangLoi = d.oKho() ? HANG_LOI_HOP_LE : Set.of();
            String cb = d.cachBu();
            Set<String> cachBu;
            if (donXong || NhatKyTraHangNcc.NGUON_TU_DONG.equals(d.nguonCachBu())
                    || daNhap && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(cb)) {
                cachBu = Set.of();
            } else if (!daNhap || BienBanTraHangNcc.PA_CHO_CHOT.equals(cb)) {
                cachBu = PHUONG_AN_CHOT_HOP_LE;
            } else {
                Integer bt = d.bienThe();
                boolean ve = bt != null && phieu.getNgayNhap() != null && coHangVeSau.computeIfAbsent(bt, k -> {
                    Long sau = chiTietPhieuNhapKhoRepository.datNhapSau(don.getId(), phieu.getNgayNhap(), Set.of(k));
                    return sau != null && sau > 0;
                });
                cachBu = ve ? Set.of() : Set.of(BienBanTraHangNcc.PA_TRU_CONG_NO);
            }
            kq.put(d.id(), new LuaChonMo(cachBu, hangLoi));
        }
        return kq;
    }

    /** Hợp các lựa chọn còn mở của mọi dòng (đầu biên bản). */
    private static LuaChonMo gopMo(Collection<LuaChonMo> ds) {
        Set<String> cachBu = new TreeSet<>();
        Set<String> hangLoi = new TreeSet<>();
        for (LuaChonMo m : ds) {
            cachBu.addAll(m.cachBu());
            hangLoi.addAll(m.hangLoi());
        }
        return new LuaChonMo(cachBu, hangLoi);
    }

    private static String kiemCachBu(String ma, Integer dongId) {
        String pa = gon(ma);
        if (pa != null && !PHUONG_AN_CHOT_HOP_LE.contains(pa)) throw traLoiSai("chungTuKho.cachBuKhongHopLe", "phuongAn", dongId);
        return pa;
    }

    private static String kiemHangLoi(String ma, Integer dongId) {
        String hl = gon(ma);
        if (hl != null && !HANG_LOI_HOP_LE.contains(hl)) throw traLoiSai("chungTuKho.hangLoiKhongHopLe", "hangLoi", dongId);
        return hl;
    }

    /**
     * Nhà cung cấp trả lời trên cổng (không có tài khoản: phiên cổng đã xác thực email và các nhà cung cấp của email đó),
     * theo từng dòng. Lần đầu phải chọn mọi việc còn mở của mọi dòng; sau đó chỉ đổi được theo {@link #luaChonMo}. Lựa
     * chọn chung ({@code phuongAn} / {@code hangLoi}, cách gửi cũ) áp cho mọi dòng còn đổi được. Phiếu đã nhập kho thì trừ
     * tiền áp ngay vào đơn mua; chưa nhập kho thì lúc nhập kho sẽ áp. {@code phienBan}: lần lập nhà cung cấp đang xem (id
     * dòng nhật ký lập; null với biên bản cũ không có nhật ký lập), luôn phải khớp lần lập cuối: kho vừa lập lại, hoặc
     * không gửi mà biên bản có lần lập, thì 409 — không ghi câu trả lời cho số lỗi cũ.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto traLoiTuCong(Integer id, Collection<Integer> nhaCungCapIds, Integer phienBan,
                                         List<LuaChonDong> theoDong, String phuongAn, String hangLoi,
                                         String nguoiXacNhan, String ghiChu, boolean camKet) {
        BienBanTraHangNcc docTruoc = bienBanCuaCong(id, nhaCungCapIds);
        // Kiểm dữ liệu gửi lên trước khi giữ khóa
        String paChung = kiemCachBu(phuongAn, null);
        String hlChung = kiemHangLoi(hangLoi, null);
        Map<Integer, LuaChonDong> yeuCau = new LinkedHashMap<>();
        if (theoDong != null) {
            for (LuaChonDong l : theoDong) {
                if (l == null || l.dongId() == null || yeuCau.containsKey(l.dongId())) {
                    throw traLoiSai("chungTuKho.congDongKhongHopLe", "dong", l == null ? null : l.dongId());
                }
                yeuCau.put(l.dongId(), new LuaChonDong(l.dongId(), kiemCachBu(l.phuongAn(), l.dongId()),
                        kiemHangLoi(l.hangLoi(), l.dongId())));
            }
        }
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
        boolean donXong = donKetThuc(don.getTrangThai());
        List<Dong> ds = dungDong(bb, nkKhoa, dongCua(bb.getId()));
        Map<Integer, LuaChonMo> mo = luaChonMo(bb, ds);
        if (mo.values().stream().noneMatch(LuaChonMo::co)) {
            throw khongConNhan(donXong ? "chungTuKho.congDonDaKetThuc" : "chungTuKho.congDaXuLyXong", bb);
        }
        Set<Integer> idDong = ds.stream().map(Dong::id).collect(Collectors.toSet());
        for (Integer dongId : yeuCau.keySet()) {
            if (!idDong.contains(dongId)) throw traLoiSai("chungTuKho.congDongKhongThuocBienBan", "dong", dongId);
        }

        boolean daNhap = laPhieuDaNhap(phieu);
        List<Dong> moi = new ArrayList<>();
        Map<Integer, NhatKyTraHangNcc.ChonDong> doi = new LinkedHashMap<>();
        Map<Integer, Integer> tru = new LinkedHashMap<>();
        // Lựa chọn chung gặp dòng đã chốt thì bỏ qua dòng đó; không đổi được dòng nào thì báo như lựa chọn đã chốt
        LoiCoMaException loiKhoaChung = null;
        boolean doiCachBuNao = false;
        for (Dong d : ds) {
            LuaChonDong yc = yeuCau.get(d.id());
            boolean paRieng = yc != null && yc.phuongAn() != null;
            boolean hlRieng = yc != null && yc.hangLoi() != null;
            String pa = paRieng ? yc.phuongAn() : paChung;
            String hl = hlRieng ? yc.hangLoi() : hlChung;
            LuaChonMo m = mo.getOrDefault(d.id(), LuaChonMo.DONG);
            boolean doiCb = pa != null && !pa.equals(d.cachBu());
            boolean doiHl = hl != null && !hl.equals(d.hangLoi());
            if (doiCb && !m.cachBu().contains(pa)) {
                LoiCoMaException loi = khongConNhan(donXong ? "chungTuKho.congDonDaKetThuc" : "chungTuKho.congCachBuDaChot", bb);
                if (paRieng) throw loi;
                if (loiKhoaChung == null) loiKhoaChung = loi;
                doiCb = false;
            }
            if (doiHl && !m.hangLoi().contains(hl)) {
                LoiCoMaException loi = khongConNhan("chungTuKho.congHangLoiDaXuLy", bb);
                if (hlRieng) throw loi;
                if (loiKhoaChung == null) loiKhoaChung = loi;
                doiHl = false;
            }
            // Dòng còn chờ mà lần này không chọn: lần đầu phải trả lời đủ mọi dòng
            if (!doiCb && BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu()) && !m.cachBu().isEmpty()) {
                throw traLoiSai("chungTuKho.cachBuKhongHopLe", "phuongAn", d.id());
            }
            if (!doiHl && d.hangLoi() == null && !m.hangLoi().isEmpty()) {
                throw traLoiSai("chungTuKho.hangLoiKhongHopLe", "hangLoi", d.id());
            }
            Dong sau = d;
            if (doiCb) {
                sau = sau.voiCachBu(pa);
                doiCachBuNao = true;
                if (daNhap && BienBanTraHangNcc.PA_TRU_CONG_NO.equals(pa) && d.bienThe() != null) {
                    tru.merge(d.bienThe(), d.soLuong(), Integer::sum);
                }
            }
            if (doiHl) sau = sau.voiHangLoi(hl);
            if (doiCb || doiHl) doi.put(d.id(), new NhatKyTraHangNcc.ChonDong(doiCb ? pa : null, doiHl ? hl : null));
            moi.add(sau);
        }
        if (doi.isEmpty()) {
            if (loiKhoaChung != null) throw loiKhoaChung;
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE,
                    ThongDiep.of("chungTuKho.congKhongCoGiThayDoi"));
        }

        BigDecimal tien = BigDecimal.ZERO;
        if (!tru.isEmpty()) {
            // Phiếu nhập Nháp khác của đơn đang giữ phần còn thiếu: chưa trừ được, nhà cung cấp chọn giao bù hoặc chờ
            if (timVuotConThieu(don, dongDon, tru) != null) throw khongConNhan("chungTuKho.congChuaTruTienDuoc", bb);
            tien = congTruTienVaoDon(dongDon, tru);
        }
        String paCu = bb.phuongAn();
        giuCachBuCu(bb, ds, doi.keySet());
        dongBoDau(bb, moi);
        nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.theoDong(tongCachBu(moi), paCu, doi,
                NhatKyTraHangNcc.NGUON_CONG_NCC, nguoi, tru, tien, gc, camKet));
        if (daNhap && doiCachBuNao) capNhatNhanDu(don, dongDon, null);
        if (entityManager != null) entityManager.flush();

        baoNccDaTraLoi(bb, phieu, moi);
        if (daNhap) baoViecConLai(bb, phieu, moi, null);
        BienBanTraHangDto kq = toDto(bb, true);
        if (emailNghiepVuService != null) emailNghiepVuService.guiDaGhiNhanTraLoi(bb, kq, false);
        log.info("[RTV-CONG] Biên bản `{}`: nhà cung cấp chọn {} dòng (cách bù {}, hàng lỗi {}; người xác nhận: {}){}",
                bb.getMaBienBan(), doi.size(), tongCachBu(moi), tongHangLoi(moi), nguoi,
                daNhap ? "" : ", áp vào đơn lúc nhập kho");
        return kq;
    }

    private static LoiCoMaException traLoiSai(String khoa, String o, Integer dongId) {
        Map<String, Object> duLieu = new LinkedHashMap<>();
        duLieu.put("o", o);
        if (dongId != null) duLieu.put("dong", dongId);
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.TRA_LOI_KHONG_HOP_LE, ThongDiep.of(khoa), duLieu);
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
     * Phiếu nhập vừa hoàn tất (đã là COMPLETED, dòng đơn mua đã cộng hàng đạt và đang bị khóa): số lỗi đã khóa. Dòng nhà
     * cung cấp đã chọn trừ tiền thì áp ngay vào đơn mua; biến thể nào không trừ được (vượt phần đơn còn chờ) thì các dòng
     * đó về chờ chọn và nhà cung cấp nhận email chọn lại. Dòng giao bù: đơn vẫn chờ số đó. Còn dòng chưa chọn thì báo mua
     * hàng biên bản đang chờ nhà cung cấp; dòng hàng lỗi đã có lựa chọn thì báo kho làm.
     */
    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void khiNhapKho(BienBanTraHangNcc bienBan, PhieuNhapKho phieu, Integer nguoiNhapId) {
        DonMuaHang don = phieu.getDonMuaHang();
        if (bienBan == null || !bienBan.dangHieuLuc() || don == null) return;
        // Biên bản lập trước khi có cổng (không có nhật ký lập): phương án cũ do kho chọn, nhà cung cấp chưa được hỏi
        boolean datLaiCu = false;
        if (!BienBanTraHangNcc.PA_CHO_CHOT.equals(bienBan.phuongAn()) && nhatKy.idLapCuoi(bienBan.getId()) == null) {
            // Mã cũ "trả tài xế" là dấu duy nhất cho biết hàng lỗi đã rời kho: ghi sang trạng thái trước khi bỏ mã
            if (BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(bienBan.getPhuongAnXuLy())) {
                bienBan.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            }
            bienBan.setPhuongAnXuLy(BienBanTraHangNcc.PA_CHO_CHOT);
            bienBanTraHangNccRepository.save(bienBan);
            datLaiCu = true;
        }
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(bienBan.getId());
        List<Dong> ds = dungDong(bienBan, nk, dongCua(bienBan.getId()));
        // Dòng vẫn có lựa chọn trong nhật ký (cách ghi cũ) thì hai cột tổng theo các dòng, không để lệch với dòng
        if (datLaiCu) dongBoDau(bienBan, ds);
        List<Dong> moi = ds;
        List<Dong> canTru = ds.stream().filter(d -> BienBanTraHangNcc.PA_TRU_CONG_NO.equals(d.cachBu())).toList();
        if (!canTru.isEmpty()) {
            Map<Integer, ChiTietDonMuaHang> dongDon = khoaDongDon(don);
            Map<Integer, Integer> loi = truTheoBienThe(canTru);
            Map<Integer, ThongDiep> vuot = vuotTheoBienThe(don, dongDon, loi);
            Map<Integer, Integer> apDuoc = new LinkedHashMap<>(loi);
            apDuoc.keySet().removeAll(vuot.keySet());
            if (!apDuoc.isEmpty()) {
                BigDecimal tien = congTruTienVaoDon(dongDon, apDuoc);
                nhatKy.ghiTruTien(bienBan, apDuoc, tien);
                log.info("[RTV-NHAP-KHO] Biên bản `{}`: áp trừ tiền nhà cung cấp đã chọn ({} sản phẩm)",
                        bienBan.getMaBienBan(), apDuoc.values().stream().mapToInt(Integer::intValue).sum());
            }
            if (!vuot.isEmpty() && daQuaHan(nk)) {
                // Đã quá hạn trả lời: mời chọn lại cũng sẽ bị việc định kỳ chuyển ngay. Áp luôn luật quá hạn cho các dòng
                // này: trừ tiền phần đơn còn chờ, phần đơn đã nhận ở đợt khác coi như đã giao bù
                PhanBo pb = phanBoTruTien(don, dongDon, ds,
                        d -> BienBanTraHangNcc.PA_TRU_CONG_NO.equals(d.cachBu()) && vuot.containsKey(d.bienThe()));
                moi = pb.moi();
                BigDecimal tien = pb.tru().isEmpty() ? BigDecimal.ZERO : congTruTienVaoDon(dongDon, pb.tru());
                String paCu = bienBan.phuongAn();
                giuCachBuCu(bienBan, ds, pb.doi().keySet());
                dongBoDau(bienBan, moi);
                nhatKy.ghiTraLoi(bienBan, NhatKyTraHangNcc.TraLoi.theoDong(tongCachBu(moi), paCu, pb.doi(),
                        NhatKyTraHangNcc.NGUON_TU_DONG, null, pb.tru(), tien, null, false));
                if (entityManager != null) entityManager.flush();
                log.warn("[RTV-NHAP-KHO] Biên bản `{}` quá hạn, không trừ đủ tiền nhà cung cấp đã chọn: trừ {} sản phẩm, {} coi như đã giao bù",
                        bienBan.getMaBienBan(), pb.soTru(), pb.soBu());
                if (thongBaoMuaHangService != null) thongBaoMuaHangService.quaHanTruTien(bienBan, phieu, pb.soTru(), pb.soBu());
                if (emailNghiepVuService != null) emailNghiepVuService.guiDaGhiNhanTraLoi(bienBan, toDto(bienBan, true), true);
            } else if (!vuot.isEmpty()) {
                // Số lỗi vượt phần còn thiếu của đơn (phiếu Nháp khác đang giữ hàng): không trừ được, nhà cung cấp chọn lại
                Map<Integer, NhatKyTraHangNcc.ChonDong> doi = new LinkedHashMap<>();
                List<Dong> sau = new ArrayList<>();
                for (Dong d : ds) {
                    if (BienBanTraHangNcc.PA_TRU_CONG_NO.equals(d.cachBu()) && vuot.containsKey(d.bienThe())) {
                        doi.put(d.id(), new NhatKyTraHangNcc.ChonDong(BienBanTraHangNcc.PA_CHO_CHOT, null));
                        sau.add(d.voiCachBu(BienBanTraHangNcc.PA_CHO_CHOT));
                    } else {
                        sau.add(d);
                    }
                }
                moi = sau;
                String lyDo = vuot.values().stream().map(ThongDiep::tiengViet).distinct().collect(Collectors.joining("; "));
                String paCu = bienBan.phuongAn();
                giuCachBuCu(bienBan, ds, doi.keySet());
                dongBoDau(bienBan, moi);
                nhatKy.ghiTraLoi(bienBan, NhatKyTraHangNcc.TraLoi.theoDong(tongCachBu(moi), paCu, doi,
                        NhatKyTraHangNcc.NGUON_NHAP_KHO, null, Map.of(), BigDecimal.ZERO, lyDo, false));
                log.warn("[RTV-NHAP-KHO] Biên bản `{}`: không áp được trừ tiền nhà cung cấp đã chọn cho {} dòng ({}), về chờ chọn",
                        bienBan.getMaBienBan(), doi.size(), lyDo);
                if (entityManager != null) entityManager.flush();
                // Nhà cung cấp phải biết để chọn lại (hạn trả lời không đổi)
                if (emailNghiepVuService != null) {
                    emailNghiepVuService.guiCanChonLaiCachBu(bienBan, toDto(bienBan, true), List.copyOf(doi.keySet()));
                }
            }
        }
        if (thongBaoMuaHangService == null) return;
        boolean conCho = ds.isEmpty() ? BienBanTraHangNcc.PA_CHO_CHOT.equals(bienBan.phuongAn())
                : moi.stream().anyMatch(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu()));
        if (conCho) thongBaoMuaHangService.bienBanTraHang(bienBan, phieu, nguoiNhapId);
        baoViecConLai(bienBan, phieu, moi, nguoiNhapId);
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

    /** Đã qua hạn trả lời (hết ngày thứ 7 kể từ email biên bản đầu tiên). */
    private static boolean daQuaHan(NhatKyTraHangNcc.NhatKy nk) {
        return nk.emailDauLuc() != null && Instant.now().isAfter(hanTraLoi(nk.emailDauLuc()));
    }

    /**
     * Kết quả chia số lỗi theo phần đơn còn chờ: trạng thái mới của các dòng, phần đổi để ghi nhật ký, số trừ tiền theo
     * biến thể (áp vào đơn mua), tổng số trừ tiền và số coi như đã giao bù.
     */
    private record PhanBo(List<Dong> moi, Map<Integer, NhatKyTraHangNcc.ChonDong> doi, Map<Integer, Integer> tru,
                          int soTru, int soBu) {
    }

    /**
     * Các dòng {@code chon} chuyển trừ tiền theo phần đơn còn trừ được của từng biến thể ({@link #soDuocTru}), lần lượt
     * theo thứ tự dòng: còn đủ thì trừ tiền cả dòng; còn một phần thì trừ tiền phần đó, phần kia đơn đã nhận ở đợt giao
     * khác nên coi như đã giao bù; hết thì cả dòng coi như đã giao bù. Bên mua không chờ hàng bù nhà cung cấp chưa hứa.
     */
    private PhanBo phanBoTruTien(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, List<Dong> ds,
                                 java.util.function.Predicate<Dong> chon) {
        Map<Integer, Integer> conDuoc = new HashMap<>();
        Map<Integer, Integer> tru = new LinkedHashMap<>();
        Map<Integer, NhatKyTraHangNcc.ChonDong> doi = new LinkedHashMap<>();
        List<Dong> moi = new ArrayList<>();
        int soTru = 0;
        int soBu = 0;
        for (Dong d : ds) {
            if (!chon.test(d)) {
                moi.add(d);
                continue;
            }
            int sl = d.soLuong();
            Integer bt = d.bienThe();
            int duoc = bt == null ? sl : conDuoc.computeIfAbsent(bt, k -> soDuocTru(don, dongDon, k));
            int n = Math.min(sl, duoc);
            if (bt != null && duoc != Integer.MAX_VALUE) conDuoc.put(bt, duoc - n);
            String cach = n > 0 ? BienBanTraHangNcc.PA_TRU_CONG_NO : BienBanTraHangNcc.PA_DOI_HANG;
            Integer soTruDong = n > 0 && n < sl ? n : null;
            if (n > 0 && bt != null) tru.merge(bt, n, Integer::sum);
            soTru += n;
            soBu += sl - n;
            if (cach.equals(d.cachBu()) && Objects.equals(soTruDong, d.soTru())) {
                moi.add(d);
            } else {
                doi.put(d.id(), new NhatKyTraHangNcc.ChonDong(cach, null, soTruDong));
                moi.add(d.voiCachBu(cach, soTruDong));
            }
        }
        return new PhanBo(moi, doi, tru, soTru, soBu);
    }

    /** Số lỗi trừ tiền theo biến thể của các dòng (dòng trừ một phần: phần đã trừ). */
    static Map<Integer, Integer> truTheoBienThe(Collection<Dong> ds) {
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        for (Dong d : ds) {
            if (d.bienThe() != null && d.soLuongTru() > 0) kq.merge(d.bienThe(), d.soLuongTru(), Integer::sum);
        }
        return kq;
    }

    /** Số lỗi của biến thể còn trừ tiền được: còn thiếu của dòng đơn − phần phiếu Nháp khác của đơn đang giữ. */
    private int soDuocTru(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, Integer bienThe) {
        ChiTietDonMuaHang dong = bienThe == null ? null : dongDon.get(bienThe);
        // Biến thể không có trên đơn: không có gì để trừ vào (cùng cách với congTruTienVaoDon)
        if (dong == null) return Integer.MAX_VALUE;
        BigDecimal giuBd = chiTietPhieuNhapKhoRepository.sumDuKienPhieuNhapCungDon(don.getId(), bienThe);
        int dangGiu = giuBd == null ? 0 : giuBd.intValue();
        return Math.max(0, dong.conThieu().intValue() - dangGiu);
    }

    /**
     * Trừ tiền làm dòng đơn hết chờ số lỗi, nên số lỗi phải ≤ còn thiếu − phần phiếu Nháp khác của đơn đang giữ. Trả câu
     * lỗi của từng biến thể vượt (rỗng: trừ được hết).
     */
    private Map<Integer, ThongDiep> vuotTheoBienThe(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, Map<Integer, Integer> loi) {
        Map<Integer, ThongDiep> kq = new LinkedHashMap<>();
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
                kq.put(e.getKey(), ThongDiep.of("chungTuKho.truTienPhieuGiu", sku, soLoi, dangGiu,
                        dsGiu == null || dsGiu.isEmpty() ? "" : String.join(", ", dsGiu)));
            } else {
                kq.put(e.getKey(), ThongDiep.of("chungTuKho.truTienVuotConThieu", sku, soLoi, conThieu));
            }
        }
        return kq;
    }

    /** Câu lỗi của biến thể đầu tiên vượt phần còn thiếu, hoặc null khi trừ được hết. */
    private ThongDiep timVuotConThieu(DonMuaHang don, Map<Integer, ChiTietDonMuaHang> dongDon, Map<Integer, Integer> loi) {
        return vuotTheoBienThe(don, dongDon, loi).values().stream().findFirst().orElse(null);
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

    /** Mua hàng: nhà cung cấp vừa trả lời (số sản phẩm theo từng cách); hết dòng chờ chọn thì thông báo "chờ nhà cung cấp" xong. */
    private void baoNccDaTraLoi(BienBanTraHangNcc bb, PhieuNhapKho phieu, List<Dong> ds) {
        if (thongBaoMuaHangService == null) return;
        thongBaoMuaHangService.nccDaTraLoi(bb, phieu, soTheo(ds, BienBanTraHangNcc.PA_DOI_HANG, null),
                soTheo(ds, BienBanTraHangNcc.PA_TRU_CONG_NO, null), soTheo(ds, null, BienBanTraHangNcc.HL_NHAN_LAI),
                soTheo(ds, null, BienBanTraHangNcc.HL_TIEU_HUY),
                ds.stream().anyMatch(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu())));
    }

    /** Tổng số lỗi các dòng có cách bù {@code cachBu} (hoặc lựa chọn hàng lỗi {@code hangLoi}, chỉ dòng còn ở kho). */
    private static int soTheo(List<Dong> ds, String cachBu, String hangLoi) {
        return ds.stream()
                .filter(d -> cachBu != null ? cachBu.equals(d.cachBu()) : d.oKho() && hangLoi.equals(d.hangLoi()))
                .mapToInt(Dong::soLuong).sum();
    }

    /**
     * Phiếu đã nhập kho, vừa có cách bù hoặc lựa chọn hàng lỗi: hết dòng chờ chọn cách bù thì thông báo "chờ nhà cung cấp"
     * coi như xong; dòng hàng lỗi còn ở kho mà nhà cung cấp đã chọn thì báo kho giao trả / tiêu hủy (số theo từng việc).
     */
    private void baoViecConLai(BienBanTraHangNcc bb, PhieuNhapKho phieu, List<Dong> ds, Integer nguoiId) {
        if (thongBaoMuaHangService == null) return;
        if (ds.isEmpty()) {
            // Biên bản không có dòng (dữ liệu cũ): theo cột của biên bản
            if (!BienBanTraHangNcc.PA_CHO_CHOT.equals(bb.phuongAn())) thongBaoMuaHangService.bienBanDaChotXong(bb);
            return;
        }
        if (ds.stream().noneMatch(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu()))) {
            thongBaoMuaHangService.bienBanDaChotXong(bb);
        }
        baoKhoHangLoi(bb, phieu, ds, nguoiId);
    }

    /** Kho: còn dòng nhà cung cấp đã chọn mà chưa làm thì báo (sửa thông báo cũ), không còn thì thông báo xong. */
    private void baoKhoHangLoi(BienBanTraHangNcc bb, PhieuNhapKho phieu, List<Dong> ds, Integer nguoiId) {
        if (thongBaoMuaHangService == null) return;
        int nhanLai = soTheo(ds, null, BienBanTraHangNcc.HL_NHAN_LAI);
        int tieuHuy = soTheo(ds, null, BienBanTraHangNcc.HL_TIEU_HUY);
        if (nhanLai + tieuHuy > 0 && laPhieuDaNhap(phieu)) {
            thongBaoMuaHangService.hangLoiCanXuLy(bb, phieu, nhanLai, tieuHuy, nguoiId);
        } else if (nhanLai + tieuHuy == 0) {
            thongBaoMuaHangService.hangLoiDaRoiKho(bb);
        }
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
        List<Integer> ids = ds.stream().map(BienBanTraHangNcc::getId).toList();
        Map<Integer, NhatKyTraHangNcc.NhatKy> nk = nhatKy.doc(ids);
        Map<Integer, List<ChiTietTraHangNcc>> dong = dongTheoBienBan(ids);
        return ds.stream()
                .filter(b -> nk.get(b.getId()).emailDauLuc() != null
                        && choTraLoi(b, nk.get(b.getId()), dungDong(b, nk.get(b.getId()), dong.getOrDefault(b.getId(), List.of()))).co())
                .map(BienBanTraHangNcc::getId)
                .toList();
    }

    /**
     * Xét hạn trả lời của một biên bản (mỗi biên bản một giao dịch). Còn {@value #NHAC_TRUOC_HAN_NGAY} ngày tới hạn thì
     * gửi email nhắc một lần. Quá hạn mà còn dòng chưa chọn cách bù thì chuyển trừ tiền: bên mua có quyền từ chối nhận
     * hàng không đạt, không cần nhà cung cấp đồng ý. Hàng lỗi chưa chọn thì vẫn giữ ở kho: tiêu hủy hàng của nhà cung cấp
     * phải có nhà cung cấp đồng ý.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public void xetHanTraLoi(Integer id, Instant now) {
        BienBanTraHangNcc bb = bienBanTraHangNccRepository.findById(id).orElse(null);
        if (bb == null) return;
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        ChoTraLoi cho = choTraLoi(bb, nk, dungDong(bb, nk, dongCua(id)));
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

    /**
     * Quá hạn: các dòng chưa chọn cách bù chuyển trừ tiền (bên mua từ chối nhận hàng lỗi). Phiếu đã nhập kho mà đơn không
     * còn chờ đủ số của dòng (hàng đã về ở đợt khác, hoặc phiếu Nháp khác đang giữ) thì dòng đó coi như đã giao bù: không
     * để biên bản kẹt ở chờ chọn mãi. Chưa nhập kho: trừ tiền áp lúc nhập kho.
     */
    private void truTienQuaHan(BienBanTraHangNcc docTruoc) {
        PhieuNhapKho phieu = docTruoc.getPhieuNhapKho();
        DonMuaHang don = phieu.getDonMuaHang();
        Map<Integer, ChiTietDonMuaHang> dongDon = khoaDongDon(don);
        BienBanTraHangNcc bb = khoaLai(docTruoc);
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(bb.getId());
        List<Dong> ds = dungDong(bb, nk, dongCua(bb.getId()));
        // Nhà cung cấp vừa trả lời / đơn vừa đóng trong lúc chờ khóa
        if (!choTraLoi(bb, nk, ds).cachBu() || ds.isEmpty()) return;
        boolean daNhap = laPhieuDaNhap(phieu);
        java.util.function.Predicate<Dong> cho = d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu());
        List<Dong> moi;
        Map<Integer, NhatKyTraHangNcc.ChonDong> doi;
        Map<Integer, Integer> tru;
        int soTru;
        int soBu;
        if (daNhap) {
            // Đã nhập kho: trừ tiền theo phần đơn còn chờ, phần đơn đã nhận ở đợt khác coi như đã giao bù
            PhanBo pb = phanBoTruTien(don, dongDon, ds, cho);
            moi = pb.moi();
            doi = pb.doi();
            tru = pb.tru();
            soTru = pb.soTru();
            soBu = pb.soBu();
        } else {
            // Chưa nhập kho: cả dòng trừ tiền, áp vào đơn lúc nhập kho
            moi = new ArrayList<>();
            doi = new LinkedHashMap<>();
            tru = Map.of();
            soTru = 0;
            soBu = 0;
            for (Dong d : ds) {
                if (!cho.test(d)) {
                    moi.add(d);
                    continue;
                }
                soTru += d.soLuong();
                doi.put(d.id(), new NhatKyTraHangNcc.ChonDong(BienBanTraHangNcc.PA_TRU_CONG_NO, null));
                moi.add(d.voiCachBu(BienBanTraHangNcc.PA_TRU_CONG_NO));
            }
        }
        if (doi.isEmpty()) return;
        BigDecimal tien = tru.isEmpty() ? BigDecimal.ZERO : congTruTienVaoDon(dongDon, tru);
        String paCu = bb.phuongAn();
        giuCachBuCu(bb, ds, doi.keySet());
        dongBoDau(bb, moi);
        nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.theoDong(tongCachBu(moi), paCu, doi, NhatKyTraHangNcc.NGUON_TU_DONG,
                null, tru, tien, null, false));
        if (daNhap) capNhatNhanDu(don, dongDon, null);
        if (entityManager != null) entityManager.flush();
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.quaHanTruTien(bb, phieu, soTru, soBu);
        if (daNhap) baoViecConLai(bb, phieu, moi, null);
        if (emailNghiepVuService != null) emailNghiepVuService.guiDaGhiNhanTraLoi(bb, toDto(bb, true), true);
        log.info("[RTV-HAN] Biên bản `{}` quá hạn trả lời: {} sản phẩm chuyển trừ tiền, {} coi như đã giao bù{}",
                bb.getMaBienBan(), soTru, soBu, daNhap ? "" : ", áp vào đơn lúc nhập kho");
    }

    // ─────────────────────────────────────────────────────────────
    // ĐƠN MUA
    // ─────────────────────────────────────────────────────────────

    /**
     * Đơn mua đóng nhận thiếu: dòng hàng lỗi chờ chọn / chờ giao bù chuyển sang trừ tiền (tối đa phần còn thiếu của dòng
     * đơn, chia theo thứ tự dòng); dòng đơn không còn thiếu thì coi như đã bù. Gọi trong giao dịch đóng đơn, sau khi đã
     * khóa dòng đơn và đơn.
     */
    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void chuyenTruTienKhiDongDon(DonMuaHang don, NguoiDung nguoiDong, String lyDo) {
        List<BienBanTraHangNcc> dsBienBan = bienBanTraHangNccRepository.khoaTheoDonMua(don.getId());
        if (dsBienBan.isEmpty()) return;
        Map<Integer, ChiTietDonMuaHang> dongDon = new HashMap<>();
        for (ChiTietDonMuaHang c : don.getChiTietDonMuaHangs()) dongDon.putIfAbsent(c.getBienTheSanPham().getId(), c);
        String ghiChu = lyDo == null ? null : (lyDo.length() > GHI_CHU_TOI_DA ? lyDo.substring(0, GHI_CHU_TOI_DA) : lyDo);
        Map<Integer, List<ChiTietTraHangNcc>> dongBb = dongTheoBienBan(dsBienBan.stream().map(BienBanTraHangNcc::getId).toList());
        for (BienBanTraHangNcc bb : dsBienBan) {
            NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(bb.getId());
            List<Dong> ds = dungDong(bb, nk, dongBb.getOrDefault(bb.getId(), List.of()));
            Map<Integer, Integer> conThieu = new HashMap<>();
            Map<Integer, Integer> tru = new LinkedHashMap<>();
            Map<Integer, NhatKyTraHangNcc.ChonDong> doi = new LinkedHashMap<>();
            List<Dong> moi = new ArrayList<>();
            for (Dong d : ds) {
                boolean cho = BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu());
                if (!cho && !BienBanTraHangNcc.PA_DOI_HANG.equals(d.cachBu())) {
                    moi.add(d);
                    continue;
                }
                ChiTietDonMuaHang dong = d.bienThe() == null ? null : dongDon.get(d.bienThe());
                int con = dong == null ? 0 : conThieu.computeIfAbsent(d.bienThe(), bt -> dong.conThieu().intValue());
                int n = Math.min(d.soLuong(), Math.max(0, con));
                // Không còn thiếu gì để trừ (nhà cung cấp đã giao đủ ở đợt sau): coi như đã bù
                String cach = n > 0 ? BienBanTraHangNcc.PA_TRU_CONG_NO : BienBanTraHangNcc.PA_DOI_HANG;
                // Đơn chỉ còn thiếu một phần của dòng: trừ tiền phần đó, phần kia đã giao ở đợt sau
                Integer soTruDong = n > 0 && n < d.soLuong() ? n : null;
                if (n > 0) {
                    tru.merge(d.bienThe(), n, Integer::sum);
                    conThieu.put(d.bienThe(), con - n);
                }
                if (cach.equals(d.cachBu())) {
                    moi.add(d);
                } else {
                    doi.put(d.id(), new NhatKyTraHangNcc.ChonDong(cach, null, soTruDong));
                    moi.add(d.voiCachBu(cach, soTruDong));
                }
            }
            if (doi.isEmpty()) continue;
            BigDecimal tien = congTruTienVaoDon(dongDon, tru);
            String paCu = bb.phuongAn();
            giuCachBuCu(bb, ds, doi.keySet());
            dongBoDau(bb, moi);
            nhatKy.ghiTraLoi(bb, NhatKyTraHangNcc.TraLoi.theoDong(tongCachBu(moi), paCu, doi, NhatKyTraHangNcc.NGUON_DONG_DON,
                    null, tru, tien, ghiChu, false));
            log.info("[RTV-DONG-DON] Đơn `{}` đóng: biên bản `{}` ({} → {}, trừ {} sản phẩm)", don.getSoDonMua(),
                    bb.getMaBienBan(), paCu, tongCachBu(moi), tru.values().stream().mapToInt(Integer::intValue).sum());
            baoViecConLai(bb, bb.getPhieuNhapKho(), moi, nguoiDong == null ? null : nguoiDong.getId());
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

    /** Số lỗi theo biến thể của phiếu (từ lô đã khóa). */
    private Map<Integer, Integer> soLoiTheoBienThe(Integer phieuId) {
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        for (Object[] r : chiTietPhieuNhapKhoRepository.soLoiTheoBienThe(List.of(phieuId))) {
            kq.merge(((Number) r[1]).intValue(), ((Number) r[2]).intValue(), Integer::sum);
        }
        return kq;
    }

    // ─────────────────────────────────────────────────────────────
    // KHO LÀM THEO LỰA CHỌN CỦA NHÀ CUNG CẤP (theo dòng)
    // ─────────────────────────────────────────────────────────────

    /**
     * Các dòng kho ghi lần này: {@code dongIds} (thiếu: mọi dòng còn ở kho có lựa chọn {@code canChon}); mỗi dòng phải
     * thuộc biên bản, còn ở kho và nhà cung cấp đã chọn {@code canChon}. Biên bản không có dòng (dữ liệu cũ): theo lựa
     * chọn chung, trả rỗng.
     */
    private List<Dong> chonDongGhiHang(BienBanTraHangNcc bb, NhatKyTraHangNcc.NhatKy nk, List<Dong> ds,
                                       List<Integer> dongIds, String canChon, String khoaLoi) {
        if (ds.isEmpty()) {
            if (!canChon.equals(nk.luaChonHangLoi())) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of(khoaLoi, bb.getMaBienBan()));
            }
            return List.of();
        }
        List<Dong> kq = new ArrayList<>();
        if (dongIds == null || dongIds.isEmpty()) {
            for (Dong d : ds) if (d.oKho() && canChon.equals(d.hangLoi())) kq.add(d);
        } else {
            Map<Integer, Dong> theoId = new HashMap<>();
            for (Dong d : ds) theoId.put(d.id(), d);
            for (Integer dongId : new LinkedHashSet<>(dongIds)) {
                Dong d = theoId.get(dongId);
                if (d == null) {
                    throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.dongKhongThuocBienBan", bb.getMaBienBan()));
                }
                if (!d.oKho()) {
                    throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("chungTuKho.hangLoiKhongConOKho", bb.getMaBienBan()));
                }
                if (!canChon.equals(d.hangLoi())) throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of(khoaLoi, bb.getMaBienBan()));
                kq.add(d);
            }
        }
        if (kq.isEmpty()) throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of(khoaLoi, bb.getMaBienBan()));
        return kq;
    }

    /** Trạng thái các dòng sau khi kho ghi {@code chon} rời kho ({@code viTri} DA_TRA / DA_TIEU_HUY). */
    private static List<Dong> sauKhiRoiKho(List<Dong> ds, List<Dong> chon, String viTri) {
        Set<Integer> ids = chon.stream().map(Dong::id).collect(Collectors.toSet());
        return ds.stream().map(d -> ids.contains(d.id()) ? d.voiViTri(viTri) : d).toList();
    }

    /** Nhà cung cấp đã chọn nhận lại: kho ghi các dòng đã giao (nhà cung cấp đến lấy hoặc gửi vận chuyển). */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto ghiDaGiaoTra(Integer id, GiaoTraHangLoiRequest request) {
        BienBanTraHangNcc bienBan = khoaDeGhiHang(id);
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        List<Dong> ds = dungDong(bienBan, nk, dongCua(id));
        List<Dong> chon = chonDongGhiHang(bienBan, nk, ds, request == null ? null : request.getDongIds(),
                BienBanTraHangNcc.HL_NHAN_LAI, "chungTuKho.giaoTraCanNccNhanLai");
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

        List<Dong> moi = sauKhiRoiKho(ds, chon, BienBanTraHangNcc.HANG_DA_TRA);
        if (ds.isEmpty()) {
            bienBan.setTrangThai(BienBanTraHangNcc.DA_TRA_HANG);
            bienBanTraHangNccRepository.save(bienBan);
        } else {
            dongBoDau(bienBan, moi);
        }
        nhatKy.ghiGiaoTra(bienBan, cachGiao, nguoiNhan, maVanDon, thoiDiem, ghiChu,
                ds.isEmpty() ? null : chon.stream().map(Dong::id).toList());
        if (ds.isEmpty()) {
            if (thongBaoMuaHangService != null) thongBaoMuaHangService.hangLoiDaRoiKho(bienBan);
        } else {
            baoKhoHangLoi(bienBan, bienBan.getPhieuNhapKho(), moi, null);
        }
        log.info("[RTV-GIAO-TRA] Biên bản `{}` đã giao trả {} dòng ({}, {})", bienBan.getMaBienBan(),
                ds.isEmpty() ? "mọi" : chon.size(), cachGiao, nguoiNhan);
        return toDto(bienBan, true);
    }

    /**
     * Nhà cung cấp đã đồng ý tiêu hủy trên cổng: kho ghi các dòng đã tiêu hủy (người đồng ý lấy từ câu trả lời của nhà
     * cung cấp). Thời điểm tiêu hủy không được trước lúc nhà cung cấp đồng ý (lần đồng ý muộn nhất của các dòng ghi).
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public BienBanTraHangDto ghiTieuHuy(Integer id, GiaoTraHangLoiRequest request) {
        BienBanTraHangNcc bienBan = khoaDeGhiHang(id);
        NhatKyTraHangNcc.NhatKy nk = nhatKy.doc(id);
        List<Dong> ds = dungDong(bienBan, nk, dongCua(id));
        List<Dong> chon = chonDongGhiHang(bienBan, nk, ds, request == null ? null : request.getDongIds(),
                BienBanTraHangNcc.HL_TIEU_HUY, "chungTuKho.tieuHuyCanNccDongY");
        List<NhatKyTraHangNcc.TraLoi> dongY = ds.isEmpty()
                ? (nk.hangLoi() == null ? List.of() : List.of(nk.hangLoi()))
                : chon.stream().map(Dong::lanHangLoi).filter(Objects::nonNull).toList();
        Instant thoiDiem = kiemThoiDiem(bienBan, request == null ? null : request.getThoiDiem());
        Instant dongYCuoi = dongY.stream().map(NhatKyTraHangNcc.TraLoi::luc).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);
        if (dongYCuoi != null && thoiDiem.isBefore(dongYCuoi.minus(Duration.ofMinutes(1)))) {
            throw new CommonException(HttpStatus.BAD_REQUEST, ThongDiep.of("chungTuKho.tieuHuyTruocLucDongY",
                    DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").format(dongYCuoi.atZone(MUI_GIO_VN))));
        }
        String ghiChu = kiemGhiChu(request == null ? null : request.getGhiChu());
        String nguoiDongY = dongY.stream().map(NhatKyTraHangNcc.TraLoi::nguoiXacNhan).filter(Objects::nonNull)
                .distinct().collect(Collectors.joining(", "));

        List<Dong> moi = sauKhiRoiKho(ds, chon, BienBanTraHangNcc.HANG_DA_TIEU_HUY);
        if (ds.isEmpty()) {
            bienBan.setTrangThai(BienBanTraHangNcc.DA_TIEU_HUY);
            bienBanTraHangNccRepository.save(bienBan);
        } else {
            dongBoDau(bienBan, moi);
        }
        nhatKy.ghiTieuHuy(bienBan, nguoiDongY.isEmpty() ? null : nguoiDongY, thoiDiem, ghiChu,
                ds.isEmpty() ? null : chon.stream().map(Dong::id).toList());
        if (ds.isEmpty()) {
            if (thongBaoMuaHangService != null) thongBaoMuaHangService.hangLoiDaRoiKho(bienBan);
        } else {
            baoKhoHangLoi(bienBan, bienBan.getPhieuNhapKho(), moi, null);
        }
        log.info("[RTV-TIEU-HUY] Biên bản `{}` tiêu hủy {} dòng hàng lỗi (nhà cung cấp đồng ý: {})", bienBan.getMaBienBan(),
                ds.isEmpty() ? "mọi" : chon.size(), nguoiDongY);
        return toDto(bienBan, true);
    }

    /** Khóa biên bản để ghi việc hàng: phải còn hiệu lực, phiếu đã nhập kho, còn dòng ở kho, đúng kho đang chọn. */
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

    /**
     * Số lỗi theo biến thể của từng phiếu, dòng đơn mua của các đơn, nhật ký và dòng của các biên bản, nạp một lần cho
     * danh sách.
     */
    private record NguCanh(Map<Integer, Map<Integer, Integer>> loiTheoPhieu,
                           Map<Integer, Map<Integer, ChiTietDonMuaHang>> dongDonTheoDon,
                           Map<Integer, NhatKyTraHangNcc.NhatKy> nhatKyTheoBienBan,
                           Map<Integer, List<ChiTietTraHangNcc>> dongTheoBienBan) {
    }

    private NguCanh napNguCanh(Collection<BienBanTraHangNcc> ds) {
        if (ds.isEmpty()) return new NguCanh(Map.of(), Map.of(), Map.of(), Map.of());
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
        List<Integer> ids = ds.stream().map(BienBanTraHangNcc::getId).toList();
        Map<Integer, NhatKyTraHangNcc.NhatKy> nk = nhatKy.doc(ids);
        return new NguCanh(loi, dongDon, nk, dongTheoBienBan(ids));
    }

    /** Giao bù đã xong: đơn đã đóng / hủy, hoặc mọi dòng đơn của các biến thể hết thiếu. */
    private static boolean buXong(Collection<Integer> bienThe, Map<Integer, ChiTietDonMuaHang> dongDon, Integer ttDon) {
        if (Objects.equals(ttDon, DON_DA_DONG) || Objects.equals(ttDon, DON_DA_HUY)) return true;
        for (Integer bt : bienThe) {
            ChiTietDonMuaHang dong = dongDon.get(bt);
            if (dong != null && dong.conThieu().signum() > 0) return false;
        }
        return true;
    }

    /**
     * Trạng thái hiển thị: chờ người giao hàng ký (chưa gửi nhà cung cấp), chờ nhà cung cấp trả lời, rồi việc kho làm theo
     * lựa chọn của nhà cung cấp (còn dòng nhận lại chưa giao trả thì chờ giao trả, còn dòng đồng ý tiêu hủy thì chờ tiêu
     * hủy), rồi chờ hàng bù của các dòng giao bù. {@code buXongDong}: dòng giao bù đã nhận đủ hàng bù.
     */
    static String trangThaiHienThi(BienBanTraHangNcc b, NhatKyTraHangNcc.NhatKy nk, List<Dong> ds,
                                   java.util.function.Predicate<Dong> buXongDong) {
        if (!b.dangHieuLuc()) return TT_DA_HUY;
        if (nk.choKy()) return TT_CHO_KY;
        if (!laPhieuDaNhap(b.getPhieuNhapKho())) return TT_MOI_LAP;
        if (choTraLoi(b, nk, ds).co()) return TT_CHO_CHOT;
        if (ds.isEmpty()) {
            // Biên bản không có dòng (dữ liệu cũ): theo cột của biên bản
            if (b.hangConOKho()) {
                return BienBanTraHangNcc.HL_TIEU_HUY.equals(nk.luaChonHangLoi()) ? TT_CHO_TIEU_HUY : TT_CHO_GIAO_TRA;
            }
            return TT_HOAN_TAT;
        }
        if (ds.stream().anyMatch(d -> d.oKho() && BienBanTraHangNcc.HL_NHAN_LAI.equals(d.hangLoi()))) return TT_CHO_GIAO_TRA;
        if (ds.stream().anyMatch(d -> d.oKho() && BienBanTraHangNcc.HL_TIEU_HUY.equals(d.hangLoi()))) return TT_CHO_TIEU_HUY;
        if (ds.stream().anyMatch(d -> BienBanTraHangNcc.PA_DOI_HANG.equals(d.cachBu()) && !buXongDong.test(d))) {
            return TT_CHO_HANG_BU;
        }
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
     * Số lỗi theo biến thể để hiển thị: đã nhập kho theo lô (đã khóa); phiếu Nháp lô còn đổi nên theo dòng biên bản.
     */
    private static Map<Integer, Integer> loiHienThi(BienBanTraHangNcc b, NguCanh nguCanh, List<Dong> ds) {
        Map<Integer, Integer> loi = nguCanh.loiTheoPhieu().getOrDefault(b.getPhieuNhapKho().getId(), Map.of());
        if (!loi.isEmpty()) return loi;
        return theoBienThe(ds);
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
        List<Dong> ds = dungDong(b, nk, nguCanh.dongTheoBienBan().getOrDefault(b.getId(), List.of()));
        java.util.function.Predicate<Dong> buXongDong = d -> d.bienThe() == null || buXong(List.of(d.bienThe()), dongDon, ttDon);

        // Cách xử lý hàng lỗi lúc lập; biên bản lập trước khi có nhật ký: suy từ mã cũ "trả tài xế" (nhập kho đã đổi mã
        // đó thành đã trả hàng, chưa có việc giao trả nào ghi sau)
        NhatKyTraHangNcc.Lap lap = nk.lap();
        boolean cuTraTaiXe = BienBanTraHangNcc.PA_CU_TRA_TAI_XE.equals(b.getPhuongAnXuLy())
                || BienBanTraHangNcc.DA_TRA_HANG.equals(b.getTrangThai()) && nk.giaoTra() == null;
        String cachXuLy = lap != null && lap.cachXuLy() != null ? lap.cachXuLy()
                : cuTraTaiXe ? BienBanTraHangNcc.TRA_NGAY : BienBanTraHangNcc.GIU_KHO;
        boolean traNgay = BienBanTraHangNcc.TRA_NGAY.equals(cachXuLy);
        NhatKyTraHangNcc.Ky ky = nk.ky();

        // Lựa chọn còn mở chỉ cần ở màn chi tiết (cổng nhà cung cấp): tính giao bù đổi được không phải đọc phiếu về sau
        Map<Integer, LuaChonMo> mo = coDongLoi ? luaChonMo(b, ds) : Map.of();
        List<BienBanTraHangDto.ChiTietItemDto> items = null;
        Map<Integer, BienTheSanPham> bienThe = new HashMap<>();
        if (coDongLoi) {
            items = new ArrayList<>();
            for (Dong d : ds) {
                ChiTietTraHangNcc c = d.ct();
                BienTheSanPham bt = c.getBienTheSanPham();
                bienThe.putIfAbsent(bt.getId(), bt);
                ChiTietDonMuaHang dongCuaDon = dongDon.get(bt.getId());
                BigDecimal donGia = dongCuaDon == null ? null : dongCuaDon.getDonGia();
                NhatKyTraHangNcc.TraLoi lanCb = d.lanCachBu();
                // Cách bù chép từ cột biên bản cũ: không có người chọn / lúc chọn
                if (lanCb != null && NhatKyTraHangNcc.NGUON_DU_LIEU_CU.equals(lanCb.nguon())) lanCb = null;
                NhatKyTraHangNcc.TraLoi lanHl = d.lanHangLoi();
                String nguonCb = lanCb != null ? lanCb.nguon()
                        : !BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu()) && daNhap ? NhatKyTraHangNcc.NGUON_DU_LIEU_CU : null;
                // Hàng lỗi của dòng rời kho: lần giao trả / tiêu hủy, hoặc trả ngay cho người giao hàng lúc ký
                NhatKyTraHangNcc.GiaoTra gt = d.giaoTra();
                boolean traNgayDong = gt == null && traNgay && !d.oKho();
                LuaChonMo m = mo.getOrDefault(d.id(), LuaChonMo.DONG);
                items.add(BienBanTraHangDto.ChiTietItemDto.builder()
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
                        .donGia(donGia)
                        .giaTri(donGia == null ? null : donGia.multiply(BigDecimal.valueOf(d.soLuong())))
                        .soLuongTru(d.soLuongTru())
                        .tienTru(donGia == null ? null : donGia.multiply(BigDecimal.valueOf(d.soLuongTru())))
                        .cachBu(d.cachBu())
                        .nguonCachBu(nguonCb)
                        .nguoiXacNhanCachBu(lanCb == null ? null
                                : NhatKyTraHangNcc.NGUON_CONG_NCC.equals(lanCb.nguon()) ? lanCb.nguoiXacNhan() : lanCb.nguoi())
                        .thoiDiemCachBu(lanCb == null ? null : lanCb.luc())
                        .buXong(BienBanTraHangNcc.PA_DOI_HANG.equals(d.cachBu()) && buXongDong.test(d))
                        .hangLoiNcc(d.hangLoi())
                        .nguoiChonHangLoi(lanHl == null ? null : lanHl.nguoiXacNhan())
                        .thoiDiemChonHangLoi(lanHl == null ? null : lanHl.luc())
                        .trangThaiHang(d.viTri())
                        .thoiDiemRoiKho(gt != null ? gt.thoiDiem() : traNgayDong && lap != null ? (ky != null ? ky.luc() : lap.luc()) : null)
                        .nguoiNhanHang(gt != null ? gt.nguoiNhan() : traNgayDong && lap != null ? lap.nguoiKy().hoTen() : null)
                        .cachGiao(gt != null ? gt.cachGiao() : traNgayDong ? BienBanTraHangNcc.GIAO_TAI_XE : null)
                        .maVanDon(gt == null ? null : gt.maVanDon())
                        .cachBuMo(List.copyOf(new TreeSet<>(m.cachBu())))
                        .hangLoiMo(List.copyOf(new TreeSet<>(m.hangLoi())))
                        .build());
            }
        }
        Map<Integer, Integer> loi = loiHienThi(b, nguCanh, ds);
        Map<Integer, Integer> giaoBuTheoBienThe = theoBienThe(ds.stream()
                .filter(d -> BienBanTraHangNcc.PA_DOI_HANG.equals(d.cachBu())).toList());
        Map<Integer, Integer> choChonTheoBienThe = theoBienThe(ds.stream()
                .filter(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu())).toList());
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
                    // Biên bản không có dòng (dữ liệu cũ): để trống, giao diện tính theo cách bù của cả biên bản
                    .soLuongGiaoBu(ds.isEmpty() ? null : giaoBuTheoBienThe.getOrDefault(e.getKey(), 0))
                    .soLuongChoChon(ds.isEmpty() ? null : choChonTheoBienThe.getOrDefault(e.getKey(), 0))
                    .build());
        }
        String phuongAn = b.phuongAn();
        List<Dong> giaoBu = ds.stream().filter(d -> BienBanTraHangNcc.PA_DOI_HANG.equals(d.cachBu())).toList();
        boolean buXong = ds.isEmpty()
                ? BienBanTraHangNcc.PA_DOI_HANG.equals(phuongAn) && buXong(loi.keySet(), dongDon, ttDon)
                : !giaoBu.isEmpty() && giaoBu.stream().allMatch(buXongDong);
        // Giá trị các dòng trừ tiền; số lỗi giao bù đơn còn chờ (theo còn thiếu của dòng đơn cùng biến thể)
        BigDecimal giaTriTru = BigDecimal.ZERO;
        for (Dong d : ds) {
            ChiTietDonMuaHang dong = d.bienThe() == null ? null : dongDon.get(d.bienThe());
            if (d.soLuongTru() > 0 && dong != null && dong.getDonGia() != null) {
                giaTriTru = giaTriTru.add(dong.getDonGia().multiply(BigDecimal.valueOf(d.soLuongTru())));
            }
        }
        int choHangBu = 0;
        if (!donKetThuc(ttDon)) {
            for (Map.Entry<Integer, Integer> e : theoBienThe(giaoBu).entrySet()) {
                ChiTietDonMuaHang dong = dongDon.get(e.getKey());
                int thieu = dong == null ? e.getValue() : dong.conThieu().intValue();
                choHangBu += Math.max(0, Math.min(e.getValue(), thieu));
            }
        }

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
        // Biên bản cũ (mã trả tài xế, không nhật ký) vẫn là đã trả, chỉ không có tên / lúc
        boolean daTraNgay = traNgay && b.dangHieuLuc() && !b.hangConOKho();
        boolean coLap = daTraNgay && lap != null;
        String nguoiNhan = gt != null ? gt.nguoiNhan() : coLap ? lap.nguoiKy().hoTen() : null;
        Instant thoiDiemTra = gt != null ? gt.thoiDiem() : coLap ? (ky != null ? ky.luc() : lap.luc()) : null;
        String nguoiGhiTra = gt != null ? gt.nguoiGhi() : coLap ? (ky != null ? ky.nguoi() : lap.nguoi()) : null;
        String cachGiao = gt != null ? gt.cachGiao() : daTraNgay ? BienBanTraHangNcc.GIAO_TAI_XE : null;

        ChoTraLoi cho = choTraLoi(b, nk, ds);
        NhatKyTraHangNcc.TraLoi chonHangLoi = nk.hangLoi();
        String hangLoiNcc = ds.isEmpty() ? nk.luaChonHangLoi() : tongHangLoi(ds);
        LuaChonMo moGop = coDongLoi ? gopMo(mo.values()) : null;

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
                .soLuongGiaoBu(tongSoLuong(giaoBu))
                .soLuongChoChonCachBu(tongSoLuong(ds.stream().filter(d -> BienBanTraHangNcc.PA_CHO_CHOT.equals(d.cachBu())).toList()))
                .soLuongNhanLai(soTheo(ds, null, BienBanTraHangNcc.HL_NHAN_LAI))
                .soLuongTieuHuy(soTheo(ds, null, BienBanTraHangNcc.HL_TIEU_HUY))
                .giaTriTruTien(giaTriTru)
                .soLuongChoHangBu(ds.isEmpty() ? null : choHangBu)
                .nguonChot(nguonChot)
                .nguoiXacNhanNcc(chot == null ? null : chot.nguoiXacNhan())
                .ghiChuChot(chot == null ? null : chot.ghiChu())
                .nguoiChot(chot == null ? null : chot.nguoi())
                .thoiDiemChot(chot == null ? null : chot.luc())
                .hangLoiNcc(hangLoiNcc)
                .nguoiChonHangLoi(chonHangLoi == null ? null : chonHangLoi.nguoiXacNhan())
                .thoiDiemChonHangLoi(chonHangLoi == null ? null : chonHangLoi.luc())
                .ghiChuChonHangLoi(chonHangLoi == null ? null : chonHangLoi.ghiChu())
                .choNccChonCachBu(cho.cachBu())
                .choNccChonHangLoi(cho.hangLoi())
                .hanTraLoi(nk.emailDauLuc() == null ? null : hanTraLoi(nk.emailDauLuc()))
                .daNhacHan(nk.daNhac())
                .cachBuMo(moGop == null ? null : List.copyOf(moGop.cachBu()))
                .hangLoiMo(moGop == null ? null : List.copyOf(moGop.hangLoi()))
                .soLuongTruTien(soTru)
                .tienTruTien(tienTru)
                .ghiChu(b.getGhiChu())
                .ngayLap(b.getNgayTao())
                .nguoiLap(b.getNguoiTao() == null ? null : b.getNguoiTao().getHoTen())
                .tongSoLuongLoi(b.getTongSoLuongLoi())
                .giaTriLoi(giaTriLoi)
                .trangThai(b.dangHieuLuc() ? BienBanTraHangNcc.CHO_TRA_HANG : BienBanTraHangNcc.DA_HUY)
                .trangThaiHienThi(trangThaiHienThi(b, nk, ds, buXongDong))
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
