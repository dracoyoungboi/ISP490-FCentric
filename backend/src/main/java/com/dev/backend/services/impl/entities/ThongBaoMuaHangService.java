package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.ThongBaoService.GuiDi;
import com.dev.backend.services.impl.entities.ThongBaoService.NoiDung;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Thông báo của mua hàng: yêu cầu nhập hàng (chờ duyệt, duyệt, từ chối) và báo giá nhà cung cấp gửi về qua cổng nhà cung
 * cấp. Service nghiệp vụ gọi ngay sau khi ghi xong; ở đây chỉ chụp các trường đã có trong bộ nhớ, tìm người nhận, tên kho
 * và ghi thông báo chạy sau commit ({@link ThongBaoService#guiSauCommit}). Không bao giờ ném lỗi.
 * <pre>
 *   Sự kiện                              Người nhận
 *   M1 Yêu cầu nhập hàng mới, chờ duyệt   Quản lý kho của kho nhập (+ quản lý ghi trên kho); không có ai thì quản trị viên
 *   M2 Yêu cầu được duyệt                 Người lập yêu cầu; người lập không gửi được yêu cầu báo giá (vd. nhân
 *                                         viên bán hàng) thì báo thêm nhân viên mua hàng của kho nhập
 *   M3 Yêu cầu bị từ chối                 Người lập yêu cầu (kèm lý do)
 *   M4 Nhà cung cấp gửi / gửi lại báo giá  Người gửi yêu cầu báo giá + người lập yêu cầu (nếu vai trò xem được báo giá);
 *                                         không ai trong số đó chốt được báo giá thì thêm nhân viên mua hàng của kho
 *                                         nhập (không có thì quản trị viên). Xét xong báo giá → tự đánh dấu đã đọc
 *   M5 Chấp nhận báo giá (đơn mua chờ giao) Nhân viên kho + quản lý kho của kho nhập; không có ai thì quản trị viên
 *   M6 Biên bản trả hàng nhà cung cấp      Người lập đơn mua nếu chốt được với nhà cung cấp, không thì nhân viên mua hàng
 *                                         kho nhập (không có thì quản trị viên). Một dòng tóm tắt mỗi biên bản: lập lại
 *                                         chỉ báo lại khi phương án / số lỗi đổi; biên bản hủy → sửa chữ, đánh dấu đã đọc
 *   M7 Đơn mua nhận đủ hàng               Người lập đơn mua + người lập yêu cầu (vai trò không xem được đơn mua thì nhận
 *                                         đường dẫn tới yêu cầu nhập hàng)
 * </pre>
 * Người duyệt theo đúng luật YeuCauMuaHangService.coQuyenDuyetKho: quản lý kho có phân quyền hiệu lực ở kho nhập
 * (người quản lý chính Kho.quanLy luôn nằm trong số đó).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoMuaHangService {

    /**
     * Vai trò gửi được yêu cầu báo giá: SRS 4.4 "RFQ" chỉ nhân viên mua hàng (và quản trị viên). Dùng chung
     * IRoleType.GUI_YEU_CAU_BAO_GIA (khớp NghiepVuSanPhamController, frontend constants/vaiTroTheoNghiepVu.js).
     */
    static final Set<String> VAI_TRO_GUI_YEU_CAU_BAO_GIA = IRoleType.GUI_YEU_CAU_BAO_GIA;
    /** Vai trò mở được màn báo giá /quotation/:id (khớp DonMuaHangController.getById). */
    static final Set<String> VAI_TRO_XEM_BAO_GIA = Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_kho);
    /** Vai trò có nút Chấp nhận / Không chấp nhận báo giá (khớp VAI_TRO_CHOT_BAO_GIA ở QuotationDetail.jsx). */
    static final Set<String> VAI_TRO_CHOT_BAO_GIA = Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_mua_hang);

    private final ThongBaoService thongBaoService;
    private final NguoiNhanThongBao nguoiNhan;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;

    /** M1: yêu cầu nhập hàng vừa lập, đang Chờ duyệt → quản lý kho nhập. {@code soMaHang}: số dòng sản phẩm. */
    public void yeuCauChoDuyet(YeuCauMuaHang yc, NguoiDung nguoiTao, int soMaHang) {
        dangKy("chờ duyệt", () -> {
            Integer id = yc.getId();
            String so = so(yc);
            Integer khoId = yc.getKhoNhap() == null ? null : yc.getKhoNhap().getId();
            String tenNguoiTao = nguoiTao == null ? null : nguoiTao.getHoTen();
            Integer nguoiTaoId = nguoiTao == null ? null : nguoiTao.getId();
            return new Lan("yêu cầu nhập hàng " + so + " chờ duyệt", nguoiTaoId, () -> {
                List<Integer> nhan = new ArrayList<>(nguoiNhan.quanLyKho(khoId));
                String tenKho = tenKho(khoId);
                String moTa = tenNguoiTao == null || tenNguoiTao.isBlank()
                        ? cau("deNghiNhap", soMaHang, tenKho)
                        : cau("nguoiDeNghiNhap", tenNguoiTao.trim(), soMaHang, tenKho);
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Yêu cầu nhập hàng " + so + " chờ duyệt"), nguoiTaoId,
                        new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_INFO,
                                cau("ycChoDuyet", so), moTa, "/purchase-requests/" + id,
                                ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, id, khoId, "YCNH:" + id + ":CHO_DUYET")));
            });
        });
    }

    /**
     * M2 / M3: yêu cầu vừa được duyệt hoặc bị từ chối → người lập yêu cầu. Duyệt mà người lập không gửi được yêu cầu báo
     * giá thì nhân viên mua hàng của kho nhập (không có thì quản trị viên) nhận câu nhắc gửi yêu cầu báo giá.
     */
    public void yeuCauDaXet(YeuCauMuaHang yc, boolean duyet, String lyDoTuChoi, NguoiDung nguoiXet) {
        // Đã có người xét: "chờ duyệt" của mọi quản lý (kể cả người vừa xét) coi như xong
        try {
            thongBaoService.daXuLySauCommit("YCNH:" + yc.getId() + ":CHO_DUYET");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được yêu cầu đã xét: {}", e.getMessage());
        }
        dangKy(duyet ? "đã duyệt" : "bị từ chối", () -> {
            Integer id = yc.getId();
            String so = so(yc);
            Integer khoId = yc.getKhoNhap() == null ? null : yc.getKhoNhap().getId();
            Integer nguoiTaoId = yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            Integer nguoiXetId = nguoiXet == null ? null : nguoiXet.getId();
            String tenNguoiXet = nguoiXet == null || nguoiXet.getHoTen() == null || nguoiXet.getHoTen().isBlank()
                    ? null : nguoiXet.getHoTen().trim();
            String lyDo = lyDoTuChoi == null ? "" : lyDoTuChoi.trim().replaceAll("[.\\s]+$", "");
            return new Lan("yêu cầu nhập hàng " + so + (duyet ? " đã duyệt" : " bị từ chối"), nguoiXetId, () -> {
                String tieuDe = cau(duyet ? "ycDaDuocDuyet" : "ycBiTuChoi", so);
                String khoa = "YCNH:" + id + (duyet ? ":DUYET" : ":TU_CHOI");
                String duongDan = "/purchase-requests/" + id;
                List<Integer> nguoiLap = nguoiTaoId == null ? List.of() : List.of(nguoiTaoId);
                if (!duyet) {
                    String moTa = lyDo.isEmpty()
                            ? (tenNguoiXet == null ? cau("biTuChoi") : cau("nguoiTuChoi", tenNguoiXet))
                            : (tenNguoiXet == null ? cau("biTuChoiLyDo", lyDo) : cau("nguoiTuChoiLyDo", tenNguoiXet, lyDo));
                    return List.of(new GuiDi(nguoiLap, nguoiXetId, new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            ThongBaoService.TONE_DANGER, tieuDe, moTa, duongDan, ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            id, khoId, khoa)));
                }
                String daDuyet = tenNguoiXet == null ? cau("daDuyet") : cau("nguoiDaDuyet", tenNguoiXet);
                // Cả hai câu là một khóa: tên người có thể có ". " (vd. "Nguyễn V. An"), tách câu sẽ cắt nhầm
                String nhac = tenNguoiXet == null ? cau("daDuyetNhacBaoGia") : cau("nguoiDaDuyetNhacBaoGia", tenNguoiXet);
                // Người lập không gửi được yêu cầu báo giá (quản lý kho, nhân viên kho): không nhắc việc họ không làm được,
                // báo nhân viên mua hàng của kho nhập làm tiếp
                if (nguoiTaoId == null || coVaiTro(VAI_TRO_GUI_YEU_CAU_BAO_GIA, vaiTro(nguoiTaoId))) {
                    return List.of(new GuiDi(nguoiLap, nguoiXetId, noiDungDuyet(tieuDe, nhac, duongDan, id, khoId, khoa)));
                }
                List<Integer> muaHang = nguoiNhan.hoacQuanTri(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang),
                        "Yêu cầu nhập hàng " + so + " đã duyệt, chờ gửi yêu cầu báo giá");
                return List.of(
                        new GuiDi(nguoiLap, nguoiXetId, noiDungDuyet(tieuDe, daDuyet, duongDan, id, khoId, khoa)),
                        new GuiDi(muaHang, nguoiXetId, noiDungDuyet(tieuDe, nhac, duongDan, id, khoId, khoa)));
            });
        });
    }

    /**
     * M4: nhà cung cấp vừa gửi (hoặc gửi lại) báo giá qua cổng nhà cung cấp → người gửi yêu cầu báo giá (người lập đơn
     * mua) + người lập yêu cầu nhập hàng. Khóa sự kiện theo {@code ngayBaoGia}: mỗi lần gửi lại là một thông báo mới.
     */
    public void baoGiaMoi(DonMuaHang don, YeuCauMuaHang yc, Instant ngayBaoGia, boolean guiLai) {
        // Gửi lại: thông báo lần trước coi như đã đọc (đăng ký trước nên chạy trước lần ghi thông báo mới)
        if (guiLai) {
            try {
                thongBaoService.daXuLyTheoTienToSauCommit("DMH:" + don.getId() + ":BAO_GIA:");
            } catch (RuntimeException e) {
                log.warn("[THONG-BAO] Không đánh dấu được báo giá cũ: {}", e.getMessage());
            }
        }
        dangKy(guiLai ? "báo giá gửi lại" : "báo giá mới", () -> {
            Integer donId = don.getId();
            // null = chưa có tên nhà cung cấp: dùng câu riêng có sẵn chữ "Nhà cung cấp" (không đặt làm tham số vì cụm
            // "Nhà cung cấp" đứng riêng sẽ làm bộ dịch ngược tách cụm nhầm ở các câu ghép)
            String tenNcc = don.getNhaCungCap() == null || don.getNhaCungCap().getTenNhaCungCap() == null
                    || don.getNhaCungCap().getTenNhaCungCap().isBlank()
                    ? null : don.getNhaCungCap().getTenNhaCungCap().trim();
            BigDecimal tongTien = don.getTongTien();
            Integer khoId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            Integer nguoiGuiId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            Integer nguoiLapId = yc == null || yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            String soYc = yc == null ? null : so(yc);
            Integer ycId = yc == null ? null : yc.getId();
            String soDon = don.getSoDonMua() == null || don.getSoDonMua().isBlank() ? null : don.getSoDonMua().trim();
            long moc = ngayBaoGia == null ? Instant.now().getEpochSecond() : ngayBaoGia.getEpochSecond();
            return new Lan("báo giá đơn mua " + donId, null, () -> {
                List<Integer> nhan = new ArrayList<>();
                // Có vai trò xem báo giá nhưng kho nhập ngoài phạm vi (vd. nhân viên kho cửa hàng lập yêu cầu cho kho
                // tổng): trang báo giá sẽ 403, nên dẫn tới trang yêu cầu nhập hàng
                List<Integer> nhanQuaYeuCau = new ArrayList<>();
                boolean coNguoiChot = false;
                for (Integer id : new Integer[]{nguoiGuiId, nguoiLapId}) {
                    String vt = vaiTro(id);
                    // Vai trò không mở được màn báo giá (vd. nhân viên bán hàng lập yêu cầu): không gửi
                    if (id == null || !coVaiTro(VAI_TRO_XEM_BAO_GIA, vt)) continue;
                    if (!xemDuocDonMua(id, vt, khoId)) {
                        if (ycId != null && !nhanQuaYeuCau.contains(id)) nhanQuaYeuCau.add(id);
                        continue;
                    }
                    nhan.add(id);
                    coNguoiChot |= coVaiTro(VAI_TRO_CHOT_BAO_GIA, vt);
                }
                // Không ai trong số đó chốt được báo giá (vd. nhân viên kho gửi yêu cầu): báo nhân viên mua hàng của kho nhập
                if (!coNguoiChot) {
                    nhan.addAll(nguoiNhan.hoacQuanTri(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang),
                            "Báo giá đơn mua " + donId));
                }
                String tieuDe = tenNcc == null ? cau(guiLai ? "nccMacDinhGuiLaiBaoGia" : "nccMacDinhGuiBaoGia")
                        : cau(guiLai ? "nccGuiLaiBaoGia" : "nccGuiBaoGia", tenNcc);
                String moTa = moTaBaoGia(soDon, soYc, tongTien);
                List<GuiDi> gui = new ArrayList<>();
                gui.add(new GuiDi(nhan, null,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO, tieuDe, moTa,
                                "/quotation/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId,
                                "DMH:" + donId + ":BAO_GIA:" + moc)));
                nhanQuaYeuCau.removeAll(nhan);
                if (!nhanQuaYeuCau.isEmpty()) {
                    gui.add(new GuiDi(nhanQuaYeuCau, null,
                            new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_INFO, tieuDe, moTa,
                                    "/purchase-requests/" + ycId, ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ycId, khoId,
                                    "DMH:" + donId + ":BAO_GIA:" + moc)));
                }
                return gui;
            });
        });
    }

    /** Đã gửi yêu cầu báo giá cho yêu cầu {@code ycId}: lời nhắc "Gửi yêu cầu báo giá" (M2) coi như xong. */
    public void yeuCauDaGuiBaoGia(Integer ycId) {
        if (ycId == null) return;
        try {
            thongBaoService.daXuLySauCommit("YCNH:" + ycId + ":DUYET");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được yêu cầu đã gửi báo giá: {}", e.getMessage());
        }
    }

    /**
     * Đã xét báo giá của {@code don} (chấp nhận hoặc không), kèm các đơn cùng yêu cầu tự chuyển "không chấp nhận" khi
     * chấp nhận ({@code khac}): thông báo "đã gửi báo giá" của các đơn đó coi như đã xử lý. Chấp nhận → M5: báo kho nhập
     * chuẩn bị nhận hàng.
     */
    public void daXetBaoGia(DonMuaHang don, List<DonMuaHang> khac, boolean chapNhan, NguoiDung nguoiChot) {
        try {
            thongBaoService.daXuLyTheoTienToSauCommit("DMH:" + don.getId() + ":BAO_GIA:");
            if (khac != null) {
                for (DonMuaHang d : khac) {
                    if (d != null && d.getId() != null) thongBaoService.daXuLyTheoTienToSauCommit("DMH:" + d.getId() + ":BAO_GIA:");
                }
            }
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được báo giá đã xét: {}", e.getMessage());
        }
        if (!chapNhan) return;
        dangKy("chốt báo giá", () -> {
            Integer donId = don.getId();
            String soDon = soDon(don);
            String tenNcc = tenNcc(don.getNhaCungCap() == null ? null : don.getNhaCungCap().getTenNhaCungCap());
            Instant ngayGiao = don.getNgayGiaoDuKien();
            Integer khoId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            Integer nguoiChotId = nguoiChot == null ? null : nguoiChot.getId();
            return new Lan("đơn mua " + soDon + " đã chốt", nguoiChotId, () -> {
                List<Integer> nhan = new ArrayList<>(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_kho));
                nhan.addAll(nguoiNhan.quanLyKho(khoId));
                String moTa;
                if (tenNcc.equals(cau("nhaCungCapThuong"))) {
                    // Chưa có tên nhà cung cấp: câu riêng có sẵn chữ "Nhà cung cấp" (xem ghi chú ở baoGiaMoi)
                    moTa = ngayGiao == null ? cau("chotKhongNgayMacDinh")
                            : cau("chotCoNgayMacDinh", NGAY_VN.format(ngayGiao));
                } else {
                    moTa = ngayGiao == null ? cau("chotKhongNgay", tenNcc)
                            : cau("chotCoNgay", tenNcc, NGAY_VN.format(ngayGiao));
                }
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Đơn mua " + soDon + " đã chốt"), nguoiChotId,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO,
                                cau("donChotTieuDe", soDon), moTa,
                                "/purchase-orders/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId,
                                "DMH:" + donId + ":CHAP_NHAN")));
            });
        });
    }

    /**
     * M6: phiếu nhập có biên bản trả hàng vừa nhập kho mà nhà cung cấp chưa chọn giao bù hay trừ tiền: báo bộ phận mua
     * hàng theo dõi (nhắc nhà cung cấp, gửi lại email). Báo lúc nhập kho (số lỗi đã khóa), không báo lúc lập biên bản ở
     * phiếu Nháp (lập lại nhiều lần). Phiếu nhập không thuộc đơn mua nào thì không báo.
     */
    public void bienBanTraHang(BienBanTraHangNcc bb, PhieuNhapKho phieu, Integer nguoiThaoTacId) {
        tomTatBienBan(bb, phieu, false, true, nguoiThaoTacId);
    }

    /**
     * M6: biên bản trả hàng bị hủy ({@code doHuyPhieuNhap}: phiếu nhập bị hủy; không thì vì không còn hàng lỗi): sửa chữ
     * "đã hủy", đánh dấu đã đọc.
     */
    public void bienBanDaHuy(BienBanTraHangNcc bb, PhieuNhapKho phieu, boolean doHuyPhieuNhap, Integer nguoiThaoTacId) {
        tomTatBienBan(bb, phieu, true, doHuyPhieuNhap, nguoiThaoTacId);
    }

    /** {@code co}: lúc lập = có thay đổi (báo lại); lúc hủy = hủy do hủy phiếu nhập. */
    private void tomTatBienBan(BienBanTraHangNcc bb, PhieuNhapKho phieu, boolean daHuy, boolean co,
                               Integer nguoiThaoTacId) {
        boolean coThayDoi = !daHuy && co;
        boolean doHuyPhieuNhap = daHuy && co;
        try {
            DonMuaHang don = phieu == null ? null : phieu.getDonMuaHang();
            if (bb == null || bb.getId() == null || don == null) return;
            String khoa = "BBTH:" + bb.getId();
            Integer donId = don.getId();
            String soDon = soDon(don);
            String maBb = maBienBan(bb);
            String soPn = phieu.getSoPhieuNhap() == null ? "" : phieu.getSoPhieuNhap().trim();
            Integer khoId = phieu.getKho() == null ? null : phieu.getKho().getId();
            String tenNcc = tenNcc(phieu.getNhaCungCap() == null ? null : phieu.getNhaCungCap().getTenNhaCungCap());
            int soLoi = bb.getTongSoLuongLoi() == null ? 0 : bb.getTongSoLuongLoi();
            Integer nguoiLapDonId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            thongBaoService.capNhatTomTatSauCommit("Thông báo biên bản trả hàng " + maBb, () -> {
                String tieuDe;
                String moTa;
                String tone;
                if (daHuy) {
                    tieuDe = cau("bbHuyTieuDe", maBb);
                    moTa = doHuyPhieuNhap ? cau("bbHuyPhieuNhap", soPn) : cau("bbHetHangLoi", soPn);
                    tone = ThongBaoService.TONE_INFO;
                } else {
                    tieuDe = cau("bbCanChotTieuDe", soDon);
                    moTa = cau("bbCanChot", soLoi, soPn, maBb, tenNcc, BienBanTraHangServiceImpl.HAN_TRA_LOI_NGAY);
                    tone = ThongBaoService.TONE_WARNING;
                }
                List<Integer> nhan = daHuy ? new ArrayList<>() : muaHangCuaBienBan(nguoiLapDonId, khoId, nguoiThaoTacId, maBb);
                return new ThongBaoService.TomTat(khoa, nhan, nguoiThaoTacId,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, tone, tieuDe, moTa, "/purchase-orders/" + donId,
                                ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId, khoa),
                        coThayDoi);
            });
            if (daHuy) thongBaoService.daXuLySauCommit(khoa);
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo biên bản trả hàng: {}", e.getMessage());
        }
    }

    /**
     * Người lập đơn mua chốt được với nhà cung cấp (quản trị viên / nhân viên mua hàng) nhận; không thì nhân viên mua hàng
     * của kho nhập; không có ai thì quản trị viên. Bỏ người vừa thao tác. Gọi trên luồng dựng thông báo (sau commit).
     */
    private List<Integer> muaHangCuaBienBan(Integer nguoiLapDonId, Integer khoId, Integer nguoiThaoTacId, String maBb) {
        List<Integer> nhan = new ArrayList<>();
        if (nguoiLapDonId != null && !nguoiLapDonId.equals(nguoiThaoTacId)
                && coVaiTro(VAI_TRO_CHOT_BAO_GIA, vaiTro(nguoiLapDonId))) {
            nhan.add(nguoiLapDonId);
        }
        if (nhan.isEmpty()) {
            nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang).stream()
                    .filter(id -> id != null && !id.equals(nguoiThaoTacId)).forEach(nhan::add);
        }
        if (nhan.isEmpty()) {
            nguoiNhan.hoacQuanTri(List.of(), "Biên bản trả hàng " + maBb).stream()
                    .filter(id -> id != null && !id.equals(nguoiThaoTacId)).forEach(nhan::add);
        }
        return nhan;
    }

    /**
     * Nhà cung cấp vừa trả lời trên Cổng nhà cung cấp (cách bù và / hoặc hàng lỗi của từng dòng): báo bộ phận mua hàng
     * (khóa "BBTH:{id}:NCC", trả lời lại thì sửa thông báo cũ) số sản phẩm theo từng cách đang áp dụng. Phiếu đã nhập kho
     * thì cách bù đã áp vào đơn mua; chưa nhập kho thì áp lúc nhập kho. {@code conChoChon}: còn dòng chưa có cách bù.
     */
    public void nccDaTraLoi(BienBanTraHangNcc bb, PhieuNhapKho phieu, int giaoBu, int truTien, int nhanLai, int tieuHuy,
                            boolean conChoChon) {
        try {
            DonMuaHang don = phieu == null ? null : phieu.getDonMuaHang();
            if (bb == null || bb.getId() == null || don == null) return;
            String khoa = "BBTH:" + bb.getId() + ":NCC";
            Integer donId = don.getId();
            String soDon = soDon(don);
            String maBb = maBienBan(bb);
            String soPn = phieu.getSoPhieuNhap() == null ? "" : phieu.getSoPhieuNhap().trim();
            Integer khoId = phieu.getKho() == null ? null : phieu.getKho().getId();
            String tenNcc = tenNcc(bb.getNhaCungCap() == null ? null : bb.getNhaCungCap().getTenNhaCungCap());
            int soLoi = bb.getTongSoLuongLoi() == null ? 0 : bb.getTongSoLuongLoi();
            List<String> phan = new ArrayList<>();
            // Mọi dòng cùng một cách thì nói gọn như trước; khác nhau theo dòng thì kèm số sản phẩm của từng cách
            boolean motCachBu = giaoBu == 0 || truTien == 0;
            if (giaoBu > 0) phan.add(motCachBu ? cau("bbChonGiaoBu") : cau("bbChonGiaoBuSo", giaoBu));
            if (truTien > 0) phan.add(motCachBu ? cau("bbChonTruTien") : cau("bbChonTruTienSo", truTien));
            boolean motHangLoi = nhanLai == 0 || tieuHuy == 0;
            if (nhanLai > 0) phan.add(motHangLoi ? cau("bbChonNhanLai") : cau("bbChonNhanLaiSo", nhanLai));
            if (tieuHuy > 0) phan.add(motHangLoi ? cau("bbChonTieuHuy") : cau("bbChonTieuHuySo", tieuHuy));
            String luaChon = String.join(", ", phan);
            boolean daNhapKho = phieu.getTrangThai() != null && phieu.getTrangThai() == TrangThaiPhieuNhap.COMPLETED.getValue();
            Integer nguoiLapDonId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            thongBaoService.capNhatTomTatSauCommit("Thông báo nhà cung cấp trả lời biên bản " + maBb, () ->
                    new ThongBaoService.TomTat(khoa, muaHangCuaBienBan(nguoiLapDonId, khoId, null, maBb), null,
                            new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO,
                                    cau("bbNccTraLoiTieuDe", tenNcc, maBb),
                                    cau(daNhapKho ? "bbNccTraLoi" : "bbNccTraLoiChuaNhapKho", soLoi, soPn, soDon, luaChon),
                                    "/purchase-orders/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId, khoa),
                            true));
            if (!conChoChon) thongBaoService.daXuLySauCommit("BBTH:" + bb.getId());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo nhà cung cấp trả lời biên bản: {}", e.getMessage());
        }
    }

    /**
     * Quá hạn trả lời: các dòng chưa chọn cách bù tự chuyển trừ tiền ({@code soTru} sản phẩm); dòng đơn không còn chờ
     * đủ số thì coi như đã giao bù ({@code soBu}). Báo bộ phận mua hàng (khóa "BBTH:{id}:NCC" như lần nhà cung cấp trả
     * lời) để biết đơn đã giảm số phải nhận.
     */
    public void quaHanTruTien(BienBanTraHangNcc bb, PhieuNhapKho phieu, int soTru, int soBu) {
        try {
            DonMuaHang don = phieu == null ? null : phieu.getDonMuaHang();
            if (bb == null || bb.getId() == null || don == null) return;
            String khoa = "BBTH:" + bb.getId() + ":NCC";
            Integer donId = don.getId();
            String maBb = maBienBan(bb);
            String soPn = phieu.getSoPhieuNhap() == null ? "" : phieu.getSoPhieuNhap().trim();
            Integer khoId = phieu.getKho() == null ? null : phieu.getKho().getId();
            String tenNcc = tenNcc(bb.getNhaCungCap() == null ? null : bb.getNhaCungCap().getTenNhaCungCap());
            Integer nguoiLapDonId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            int han = BienBanTraHangServiceImpl.HAN_TRA_LOI_NGAY;
            // Không trừ được gì (đơn đã nhận đủ số này ở đợt khác): không nói "chuyển trừ tiền"
            String tieuDe = soTru > 0 ? cau("bbQuaHanTieuDe", maBb) : cau("bbQuaHanGiaoBuTieuDe", maBb);
            String moTa = soTru == 0 ? cau("bbQuaHanChiGiaoBu", tenNcc, soBu, soPn, han)
                    : soBu > 0 ? cau("bbQuaHanCoGiaoBu", tenNcc, soTru, soPn, han, soBu)
                    : cau("bbQuaHan", tenNcc, soTru, soPn, han);
            thongBaoService.capNhatTomTatSauCommit("Thông báo quá hạn trả lời biên bản " + maBb, () ->
                    new ThongBaoService.TomTat(khoa, muaHangCuaBienBan(nguoiLapDonId, khoId, null, maBb), null,
                            new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_WARNING,
                                    tieuDe, moTa,
                                    "/purchase-orders/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId, khoa),
                            true));
            thongBaoService.daXuLySauCommit("BBTH:" + bb.getId());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo quá hạn trả lời biên bản: {}", e.getMessage());
        }
    }

    /** Biên bản đã có cách bù (nhà cung cấp chọn, đóng đơn, quá hạn): thông báo "chờ nhà cung cấp" coi như xong. */
    public void bienBanDaChotXong(BienBanTraHangNcc bb) {
        if (bb == null || bb.getId() == null) return;
        try {
            thongBaoService.daXuLySauCommit("BBTH:" + bb.getId());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được biên bản trả hàng đã chốt: {}", e.getMessage());
        }
    }

    /**
     * M6b: phiếu đã nhập kho, còn dòng hàng lỗi ở kho mà nhà cung cấp đã chọn: {@code soNhanLai} sản phẩm nhận lại thì
     * báo quản lý kho và nhân viên kho đi giao trả; {@code soTieuHuy} sản phẩm đồng ý tiêu hủy thì báo quản lý kho (người
     * được ghi tiêu hủy); có cả hai thì một thông báo nói cả hai việc. Bỏ người vừa thao tác. Khóa "BBTH:{id}:TRA" (nhà
     * cung cấp đổi lựa chọn / kho làm một phần thì sửa thông báo), xong khi không còn việc ({@link #hangLoiDaRoiKho}).
     */
    public void hangLoiCanXuLy(BienBanTraHangNcc bb, PhieuNhapKho phieu, int soNhanLai, int soTieuHuy,
                               Integer nguoiThaoTacId) {
        try {
            if (bb == null || bb.getId() == null || phieu == null || soNhanLai + soTieuHuy <= 0) return;
            boolean tieuHuy = soNhanLai == 0;
            boolean caHai = soNhanLai > 0 && soTieuHuy > 0;
            String khoa = "BBTH:" + bb.getId() + ":TRA";
            String maBb = maBienBan(bb);
            String soPn = phieu.getSoPhieuNhap() == null ? "" : phieu.getSoPhieuNhap().trim();
            Integer khoId = phieu.getKho() == null ? null : phieu.getKho().getId();
            Integer phieuId = phieu.getId();
            Integer donId = phieu.getDonMuaHang() == null ? null : phieu.getDonMuaHang().getId();
            String tenNcc = tenNcc(phieu.getNhaCungCap() == null ? null : phieu.getNhaCungCap().getTenNhaCungCap());
            String[] vaiTro = tieuHuy ? new String[]{IRoleType.quan_ly_kho}
                    : new String[]{IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho};
            thongBaoService.capNhatTomTatSauCommit("Thông báo xử lý hàng lỗi " + maBb, () -> {
                List<Integer> nhan = new ArrayList<>();
                for (String vt : vaiTro) {
                    nguoiNhan.theoKho(khoId, vt).stream()
                            .filter(id -> id != null && !id.equals(nguoiThaoTacId) && !nhan.contains(id)).forEach(nhan::add);
                }
                return new ThongBaoService.TomTat(khoa, nguoiNhan.hoacQuanTri(nhan, "Xử lý hàng lỗi " + maBb),
                        nguoiThaoTacId,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_WARNING,
                                cau(caHai ? "bbXuLyHangLoiTieuDe" : tieuHuy ? "bbTieuHuyTieuDe" : "bbGiaoTraTieuDe", maBb),
                                caHai ? cau("bbXuLyHangLoi", soNhanLai, soTieuHuy, tenNcc, soPn)
                                        : cau(tieuHuy ? "bbTieuHuy" : "bbGiaoTra", tieuHuy ? soTieuHuy : soNhanLai, tenNcc, soPn),
                                "/goods-receipts/" + phieuId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId, khoa),
                        true);
            });
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo xử lý hàng lỗi: {}", e.getMessage());
        }
    }

    /** Hàng lỗi của biên bản đã rời kho (giao trả / tiêu hủy): thông báo giao trả coi như xong. */
    public void hangLoiDaRoiKho(BienBanTraHangNcc bb) {
        if (bb == null || bb.getId() == null) return;
        try {
            thongBaoService.daXuLySauCommit("BBTH:" + bb.getId() + ":TRA");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được hàng lỗi đã giao trả: {}", e.getMessage());
        }
    }

    /**
     * Đơn mua đã chốt vừa bị đóng (nhận thiếu, 6) hoặc hủy (7): không còn hàng để nhận nên thông báo "đã chốt, chờ nhận
     * hàng" (M5) gửi kho nhập coi như xong. Không gửi thông báo mới.
     */
    public void donMuaDaKetThuc(Integer donId) {
        if (donId == null) return;
        try {
            thongBaoService.daXuLySauCommit("DMH:" + donId + ":CHAP_NHAN");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn mua đã đóng / hủy: {}", e.getMessage());
        }
    }

    /** M7: đơn mua vừa nhận đủ hàng (phiếu {@code phieu} chốt trạng thái 5). Thông báo "đã chốt, chờ nhận hàng" coi như xong. */
    public void donMuaDaNhanDu(DonMuaHang don, PhieuNhapKho phieu, NguoiDung nguoiNhap) {
        try {
            thongBaoService.daXuLySauCommit("DMH:" + don.getId() + ":CHAP_NHAN");
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không đánh dấu được đơn mua đã chốt: {}", e.getMessage());
        }
        dangKy("đơn mua nhận đủ", () -> {
            Integer donId = don.getId();
            String soDon = soDon(don);
            Integer khoId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            Integer nguoiLapDonId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            YeuCauMuaHang yc = don.getYeuCauMuaHang();
            Integer ycId = yc == null ? null : yc.getId();
            Integer nguoiLapYcId = yc == null || yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            String soPn = phieu == null || phieu.getSoPhieuNhap() == null ? null : phieu.getSoPhieuNhap().trim();
            Integer nguoiNhapId = nguoiNhap == null ? null : nguoiNhap.getId();
            return new Lan("đơn mua " + soDon + " nhận đủ", nguoiNhapId, () -> {
                String tenKho = tenKho(khoId);
                String moTa = soPn == null ? cau("nhanDuTaiKho", tenKho) : cau("nhanDuPhieuTaiKho", soPn, tenKho);
                String tieuDe = cau("nhanDuTieuDe", soDon);
                String khoa = "DMH:" + donId + ":DA_NHAN_DU";
                List<Integer> xemDonMua = new ArrayList<>();
                List<Integer> xemYeuCau = new ArrayList<>();
                for (Integer id : new Integer[]{nguoiLapDonId, nguoiLapYcId}) {
                    if (id == null) continue;
                    String vt = vaiTro(id);
                    // Mở được trang đơn mua (đúng vai trò và trong phạm vi kho nhập) thì dẫn tới đơn, không thì tới yêu cầu
                    if (coVaiTro(VAI_TRO_XEM_BAO_GIA, vt) && xemDuocDonMua(id, vt, khoId)) xemDonMua.add(id);
                    else if (ycId != null) xemYeuCau.add(id);
                }
                List<GuiDi> gui = new ArrayList<>();
                gui.add(new GuiDi(xemDonMua, nguoiNhapId, new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG,
                        ThongBaoService.TONE_SUCCESS, tieuDe, moTa, "/purchase-orders/" + donId,
                        ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId, khoa)));
                if (!xemYeuCau.isEmpty()) {
                    gui.add(new GuiDi(xemYeuCau, nguoiNhapId, new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            ThongBaoService.TONE_SUCCESS, tieuDe, moTa, "/purchase-requests/" + ycId,
                            ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ycId, khoId, khoa)));
                }
                return gui;
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    private static final DateTimeFormatter NGAY_VN = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    /** Mô tả báo giá: ghép từ đơn mua / yêu cầu nhập / tổng tiền nào có; mỗi tổ hợp là một khóa (mẫu khớp trọn câu). */
    private static String moTaBaoGia(String soDon, String soYc, BigDecimal tongTien) {
        String tong = tongTien == null ? null : tien(tongTien);
        if (soDon != null && soYc != null && tong != null) return cau("baoGiaDonYcTong", soDon, soYc, tong);
        if (soDon != null && soYc != null) return cau("baoGiaDonYc", soDon, soYc);
        if (soDon != null && tong != null) return cau("baoGiaDonTong", soDon, tong);
        if (soYc != null && tong != null) return cau("baoGiaYcTong", soYc, tong);
        if (soDon != null) return cau("baoGiaDon", soDon);
        if (soYc != null) return cau("baoGiaYc", soYc);
        if (tong != null) return cau("baoGiaTong", tong);
        return cau("xemBaoGia");
    }

    /** Câu thông báo mua hàng theo khóa của nhóm thongBaoMuaHang, bằng tiếng Việt (lưu xuống bảng thông báo). */
    private static String cau(String khoa, Object... thamSo) {
        return ThongDiep.vi("thongBaoMuaHang." + khoa, thamSo);
    }

    private static String maBienBan(BienBanTraHangNcc bb) {
        return bb.getMaBienBan() == null || bb.getMaBienBan().isBlank() ? "#" + bb.getId() : bb.getMaBienBan().trim();
    }

    private static String soDon(DonMuaHang don) {
        return don.getSoDonMua() != null && !don.getSoDonMua().isBlank() ? don.getSoDonMua().trim() : "#" + don.getId();
    }

    private static String tenNcc(String ten) {
        return ten == null || ten.isBlank() ? cau("nhaCungCapThuong") : ten.trim();
    }

    /** Một lần gửi: mô tả cho log, người thao tác (chỉ để log) và phần soạn chạy sau commit. */
    private record Lan(String moTa, Integer nguoiThaoTac, Supplier<List<GuiDi>> lap) {}

    /** Chụp dữ liệu ngay (trong giao dịch nghiệp vụ), soạn và ghi sau commit. Không ném lỗi. */
    private void dangKy(String suKien, Supplier<Lan> chup) {
        try {
            Lan lan = chup.get();
            thongBaoService.guiSauCommit("Thông báo " + lan.moTa(), lan.lap());
        } catch (RuntimeException e) {
            log.warn("[THONG-BAO] Không chuẩn bị được thông báo mua hàng ({}): {}", suKien, e.getMessage());
        }
    }


    private static NoiDung noiDungDuyet(String tieuDe, String moTa, String duongDan, Integer id, Integer khoId, String khoa) {
        return new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_SUCCESS, tieuDe, moTa, duongDan,
                ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, id, khoId, khoa);
    }

    /** Set.of không nhận contains(null): vai trò trống (không tìm thấy người) coi như không thuộc nhóm. */
    private static boolean coVaiTro(Set<String> nhom, String vaiTro) {
        return vaiTro != null && nhom.contains(vaiTro);
    }

    /**
     * Người này mở được trang đơn mua của kho nhập {@code khoId} không — cùng luật DonMuaHangService.trongPhamVi: quản
     * trị viên, nhân viên mua hàng mọi kho; quản lý kho, nhân viên kho chỉ kho mình được phân công.
     */
    private boolean xemDuocDonMua(Integer nguoiDungId, String vaiTro, Integer khoId) {
        if (IRoleType.quan_tri_vien.equals(vaiTro) || IRoleType.nhan_vien_mua_hang.equals(vaiTro)) return true;
        if (IRoleType.quan_ly_kho.equals(vaiTro) || IRoleType.nhan_vien_kho.equals(vaiTro)) {
            return nguoiNhan.thuocKho(nguoiDungId, khoId);
        }
        return false;
    }

    /** Vai trò hiện tại của một người (null nếu không tìm thấy). */
    private String vaiTro(Integer nguoiDungId) {
        if (nguoiDungId == null) return null;
        return nguoiDungRepository.findById(nguoiDungId).map(NguoiDung::getVaiTro).orElse(null);
    }

    private String tenKho(Integer khoId) {
        if (khoId == null) return cau("khoThuong");
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse(ThongDiep.vi("thongBaoChung.khoSoThuong", khoId));
    }

    private static String so(YeuCauMuaHang yc) {
        return yc.getSoYeuCauMuaHang() != null && !yc.getSoYeuCauMuaHang().isBlank()
                ? yc.getSoYeuCauMuaHang().trim() : "#" + yc.getId();
    }

    /** 48500000 → "48.500.000 ₫" (làm tròn tới đồng, cùng cách ghi với giao diện). */
    static String tien(BigDecimal soTien) {
        DecimalFormatSymbols kyHieu = new DecimalFormatSymbols();
        kyHieu.setGroupingSeparator('.');
        DecimalFormat dinhDang = new DecimalFormat("#,##0", kyHieu);
        return dinhDang.format(soTien.setScale(0, RoundingMode.HALF_UP)) + " ₫";
    }
}
