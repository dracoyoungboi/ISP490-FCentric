package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.entities.YeuCauMuaHang;
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
import java.util.Objects;
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
 * Người duyệt theo đúng luật YeuCauMuaHangService.coQuyenDuyetKho: quản lý kho có phân quyền hiệu lực ở kho nhập, hoặc
 * là quản lý ghi trên kho (kho.quanLy).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThongBaoMuaHangService {

    /** Vai trò gửi được yêu cầu báo giá (khớp NghiepVuSanPhamController, frontend vaiTroGuiYeuCauBaoGia.js). */
    static final Set<String> VAI_TRO_GUI_YEU_CAU_BAO_GIA = Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_kho);
    /** Vai trò mở được màn báo giá /quotation/:id (khớp DonMuaHangController.getById). */
    static final Set<String> VAI_TRO_XEM_BAO_GIA = VAI_TRO_GUI_YEU_CAU_BAO_GIA;
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
                Integer quanLyGhiTrenKho = quanLyGhiTrenKho(khoId);
                if (quanLyGhiTrenKho != null) nhan.add(quanLyGhiTrenKho);
                String tenKho = tenKho(khoId);
                String moTa = (tenNguoiTao == null || tenNguoiTao.isBlank() ? "Đề nghị" : tenNguoiTao.trim() + " đề nghị")
                        + " nhập " + soMaHang + " mã hàng về " + tenKho + ".";
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Yêu cầu nhập hàng " + so + " chờ duyệt"), nguoiTaoId,
                        new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_INFO,
                                "Yêu cầu nhập hàng " + so + " chờ duyệt", moTa, "/purchase-requests/" + id,
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
                String tieuDe = "Yêu cầu nhập hàng " + so + (duyet ? " đã được duyệt" : " bị từ chối");
                String khoa = "YCNH:" + id + (duyet ? ":DUYET" : ":TU_CHOI");
                String duongDan = "/purchase-requests/" + id;
                List<Integer> nguoiLap = nguoiTaoId == null ? List.of() : List.of(nguoiTaoId);
                if (!duyet) {
                    String moTa = (tenNguoiXet == null ? "Bị từ chối" : tenNguoiXet + " từ chối")
                            + (lyDo.isEmpty() ? "." : ". Lý do: " + lyDo + ".");
                    return List.of(new GuiDi(nguoiLap, nguoiXetId, new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            ThongBaoService.TONE_DANGER, tieuDe, moTa, duongDan, ThongBaoService.LOAI_YEU_CAU_NHAP_HANG,
                            id, khoId, khoa)));
                }
                String daDuyet = (tenNguoiXet == null ? "Đã duyệt" : tenNguoiXet + " đã duyệt") + ".";
                String nhac = daDuyet + " Gửi yêu cầu báo giá cho nhà cung cấp.";
                // Người lập không gửi được yêu cầu báo giá (vd. nhân viên bán hàng): không nhắc việc họ không làm được,
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
            String tenNcc = don.getNhaCungCap() == null || don.getNhaCungCap().getTenNhaCungCap() == null
                    || don.getNhaCungCap().getTenNhaCungCap().isBlank()
                    ? "Nhà cung cấp" : don.getNhaCungCap().getTenNhaCungCap().trim();
            BigDecimal tongTien = don.getTongTien();
            Integer khoId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            Integer nguoiGuiId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            Integer nguoiLapId = yc == null || yc.getNguoiTao() == null ? null : yc.getNguoiTao().getId();
            String soYc = yc == null ? null : so(yc);
            String soDon = don.getSoDonMua() == null || don.getSoDonMua().isBlank() ? null : don.getSoDonMua().trim();
            long moc = ngayBaoGia == null ? Instant.now().getEpochSecond() : ngayBaoGia.getEpochSecond();
            return new Lan("báo giá đơn mua " + donId, null, () -> {
                List<Integer> nhan = new ArrayList<>();
                boolean coNguoiChot = false;
                for (Integer id : new Integer[]{nguoiGuiId, nguoiLapId}) {
                    String vt = vaiTro(id);
                    // Vai trò không mở được màn báo giá (vd. nhân viên bán hàng lập yêu cầu): không gửi
                    if (id == null || !coVaiTro(VAI_TRO_XEM_BAO_GIA, vt)) continue;
                    nhan.add(id);
                    coNguoiChot |= coVaiTro(VAI_TRO_CHOT_BAO_GIA, vt);
                }
                // Không ai trong số đó chốt được báo giá (vd. nhân viên kho gửi yêu cầu): báo nhân viên mua hàng của kho nhập
                if (!coNguoiChot) {
                    nhan.addAll(nguoiNhan.hoacQuanTri(nguoiNhan.theoKho(khoId, IRoleType.nhan_vien_mua_hang),
                            "Báo giá đơn mua " + donId));
                }
                String tieuDe = tenNcc + (guiLai ? " đã gửi lại báo giá" : " đã gửi báo giá");
                List<String> cau = new ArrayList<>();
                if (soDon != null) cau.add("Đơn mua hàng " + soDon);
                if (soYc != null) cau.add(cau.isEmpty() ? "Yêu cầu nhập hàng " + soYc : "yêu cầu nhập hàng " + soYc);
                if (tongTien != null) cau.add("tổng " + tien(tongTien));
                String moTa = cau.isEmpty() ? "Xem báo giá." : String.join(", ", cau) + ".";
                return List.of(new GuiDi(nhan, null,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO, tieuDe, moTa,
                                "/quotation/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId,
                                "DMH:" + donId + ":BAO_GIA:" + moc)));
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
                String moTa = (tenNcc.equals("nhà cung cấp") ? "Nhà cung cấp" : tenNcc)
                        + (ngayGiao == null ? "" : ", giao dự kiến " + NGAY_VN.format(ngayGiao))
                        + ". Tạo phiếu nhập khi hàng về.";
                return List.of(new GuiDi(nguoiNhan.hoacQuanTri(nhan, "Đơn mua " + soDon + " đã chốt"), nguoiChotId,
                        new NoiDung(ThongBaoService.LOAI_DON_MUA_HANG, ThongBaoService.TONE_INFO,
                                "Đơn mua hàng " + soDon + " đã chốt, chờ nhận hàng", moTa,
                                "/purchase-orders/" + donId, ThongBaoService.LOAI_DON_MUA_HANG, donId, khoId,
                                "DMH:" + donId + ":CHAP_NHAN")));
            });
        });
    }

    /**
     * M6: biên bản trả hàng nhà cung cấp vừa lập / lập lại ({@code coThayDoi}: lập mới, hoặc phương án / tổng số lỗi khác
     * lần trước → báo lại chưa đọc; không thì chỉ sửa chữ). Phiếu nhập không thuộc đơn mua nào thì không báo.
     */
    public void bienBanTraHang(BienBanTraHangNcc bb, PhieuNhapKho phieu, boolean coThayDoi, Integer nguoiThaoTacId) {
        tomTatBienBan(bb, phieu, false, coThayDoi, nguoiThaoTacId);
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
            String maBb = bb.getMaBienBan() == null || bb.getMaBienBan().isBlank() ? "#" + bb.getId() : bb.getMaBienBan().trim();
            String soPn = phieu.getSoPhieuNhap() == null ? "" : phieu.getSoPhieuNhap().trim();
            Integer khoId = phieu.getKho() == null ? null : phieu.getKho().getId();
            String tenNcc = tenNcc(phieu.getNhaCungCap() == null ? null : phieu.getNhaCungCap().getTenNhaCungCap());
            String phuongAn = bb.getPhuongAnXuLy();
            int soLoi = bb.getTongSoLuongLoi() == null ? 0 : bb.getTongSoLuongLoi();
            Integer nguoiLapDonId = don.getNguoiTao() == null ? null : don.getNguoiTao().getId();
            thongBaoService.capNhatTomTatSauCommit("Thông báo biên bản trả hàng " + maBb, () -> {
                String tieuDe;
                String moTa;
                String tone;
                if (daHuy) {
                    tieuDe = "Biên bản trả hàng " + maBb + " đã hủy";
                    moTa = doHuyPhieuNhap
                            ? "Phiếu nhập " + soPn + " đã hủy, không cần trả hàng cho nhà cung cấp."
                            : "Phiếu nhập " + soPn + " không còn hàng lỗi cần trả.";
                    tone = ThongBaoService.TONE_INFO;
                } else {
                    tieuDe = "Hàng lỗi đơn mua " + soDon + ": " + tenPhuongAn(phuongAn);
                    moTa = soLoi + " sản phẩm lỗi (phiếu nhập " + soPn + ", biên bản " + maBb + "). "
                            + cauPhuongAn(phuongAn, tenNcc);
                    tone = "TRA_TAI_XE".equals(phuongAn) ? ThongBaoService.TONE_INFO : ThongBaoService.TONE_WARNING;
                }
                List<Integer> nhan = new ArrayList<>();
                if (!daHuy) {
                    // Người lập đơn mua chốt được với nhà cung cấp (quản trị viên / nhân viên mua hàng) mới nhận; không thì
                    // nhân viên mua hàng của kho nhập. Tính sau khi bỏ người vừa lập biên bản.
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
                }
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
                String moTa = (soPn == null ? "Nhập" : "Phiếu nhập " + soPn) + " tại " + tenKho + ".";
                String tieuDe = "Đơn mua hàng " + soDon + " đã nhận đủ";
                String khoa = "DMH:" + donId + ":DA_NHAN_DU";
                List<Integer> xemDonMua = new ArrayList<>();
                List<Integer> xemYeuCau = new ArrayList<>();
                for (Integer id : new Integer[]{nguoiLapDonId, nguoiLapYcId}) {
                    if (id == null) continue;
                    if (coVaiTro(VAI_TRO_XEM_BAO_GIA, vaiTro(id))) xemDonMua.add(id);
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

    /** Tên phương án trả hàng, khớp PHUONG_AN_TRA_HANG ở frontend/src/constants/nhapKho.js. */
    static String tenPhuongAn(String ma) {
        if ("TRU_CONG_NO".equals(ma)) return "Trừ công nợ";
        if ("TRA_TAI_XE".equals(ma)) return "Trả cho tài xế";
        return "Đổi hàng mới";
    }

    private static String cauPhuongAn(String ma, String tenNcc) {
        if ("TRU_CONG_NO".equals(ma)) return "Trừ vào công nợ " + tenNcc + " theo giá nhập.";
        if ("TRA_TAI_XE".equals(ma)) return "Hàng lỗi đã giao lại cho tài xế của " + tenNcc + ".";
        return "Báo " + tenNcc + " giao bù hàng đạt ở đợt sau.";
    }

    private static String soDon(DonMuaHang don) {
        return don.getSoDonMua() != null && !don.getSoDonMua().isBlank() ? don.getSoDonMua().trim() : "#" + don.getId();
    }

    private static String tenNcc(String ten) {
        return ten == null || ten.isBlank() ? "nhà cung cấp" : ten.trim();
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

    /** Quản lý ghi trên kho (kho.quanLy, luật duyệt cũ) nếu còn hoạt động và đúng vai trò quản lý kho. */
    private Integer quanLyGhiTrenKho(Integer khoId) {
        if (khoId == null) return null;
        return khoRepository.findById(khoId)
                .map(k -> k.getQuanLy())
                .filter(n -> Objects.equals(n.getTrangThai(), 1) && IRoleType.quan_ly_kho.equals(n.getVaiTro()))
                .map(NguoiDung::getId)
                .orElse(null);
    }

    private static NoiDung noiDungDuyet(String tieuDe, String moTa, String duongDan, Integer id, Integer khoId, String khoa) {
        return new NoiDung(ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, ThongBaoService.TONE_SUCCESS, tieuDe, moTa, duongDan,
                ThongBaoService.LOAI_YEU_CAU_NHAP_HANG, id, khoId, khoa);
    }

    /** Set.of không nhận contains(null): vai trò trống (không tìm thấy người) coi như không thuộc nhóm. */
    private static boolean coVaiTro(Set<String> nhom, String vaiTro) {
        return vaiTro != null && nhom.contains(vaiTro);
    }

    /** Vai trò hiện tại của một người (null nếu không tìm thấy). */
    private String vaiTro(Integer nguoiDungId) {
        if (nguoiDungId == null) return null;
        return nguoiDungRepository.findById(nguoiDungId).map(NguoiDung::getVaiTro).orElse(null);
    }

    private String tenKho(Integer khoId) {
        if (khoId == null) return "kho";
        return khoRepository.findById(khoId).map(k -> k.getTenKho()).filter(t -> t != null && !t.isBlank())
                .map(String::trim).orElse("kho #" + khoId);
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
