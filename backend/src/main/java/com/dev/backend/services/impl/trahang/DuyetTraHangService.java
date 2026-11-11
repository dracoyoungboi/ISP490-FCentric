package com.dev.backend.services.impl.trahang;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.trahang.TraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.YeuCauDuyetTraHangMaRepository;
import com.dev.backend.repository.YeuCauDuyetTraHangRepository;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.entities.PosCatalogService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * "Yêu cầu Quản lý duyệt" (GBR-RET-02, MSG-RET-02): đơn quá 03 ngày, thu ngân nêu lý do → mỗi quản lý cửa hàng nhận
 * một mã PIN 6 số riêng qua email (lưu dạng băm) → thu ngân nhập mã quản lý đọc cho → yêu cầu "đã duyệt", người duyệt
 * là chủ mã. Duyệt dùng được 30 phút, một lần (phiếu trả đánh dấu đã dùng).
 *
 * Không transactional ở cấp lớp: ghi mã và COMMIT trước rồi mới gửi thư (thư không bao giờ mang mã chưa lưu), nhập sai
 * vẫn lưu số lần sai trước khi báo lỗi.
 */
@Slf4j
@Service
public class DuyetTraHangService {

    private static final SecureRandom NGAU_NHIEN = new SecureRandom();

    @Autowired
    private EntityManager em;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private PosCatalogService posCatalogService;
    @Autowired
    private TraHangTaiQuayService doc;
    @Autowired
    private YeuCauDuyetTraHangRepository yeuCauRepository;
    @Autowired
    private YeuCauDuyetTraHangMaRepository maRepository;
    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    @Autowired
    private EmailNghiepVuService emailNghiepVuService;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private record MaGui(NguoiDung quanLy, String ma) {
    }

    private record DaTao(YeuCauDuyetTraHang yeuCau, List<MaGui> ma, EmailNghiepVuService.MaDuyetTraHangThongTin thongTin) {
    }

    public TraHangDto.YeuCauDuyetKetQua guiYeuCau(TraHangDto.YeuCauDuyetRequest req) {
        Integer userId = SecurityContextHolder.getUser().getId();
        if (req == null || req.donBanHangId() == null) throw new CommonException(ThongDiep.of("traHang.thieuDonGoc"));
        String lyDo = req.lyDo() == null ? "" : req.lyDo().trim();
        if (lyDo.isEmpty()) throw new CommonException(ThongDiep.of("traHang.nhapLyDoDuyet"));
        if (lyDo.length() > 255) lyDo = lyDo.substring(0, 255);
        String lyDoGhi = lyDo;

        DaTao daTao = transactionTemplate.execute(st -> {
            posCatalogService.authorizeWarehouse(req.khoId());
            DonBanHang don = em.find(DonBanHang.class, req.donBanHangId());
            doc.kiemDonHopLe(don);
            Instant bayGio = Instant.now();
            Instant thanhToan = TraHangTaiQuayService.thanhToanLuc(don);
            if (!TraHangQuyTac.quaHan(thanhToan, bayGio)) {
                throw new CommonException(ThongDiep.of("traHang.conHanKhongCanDuyet"));
            }
            // Tối đa 5 yêu cầu mỗi đơn trong 24 giờ (mỗi yêu cầu 5 lần nhập): chặn dò mã và gửi tràn email quản lý
            if (yeuCauRepository.countByDonBanHangIdAndNgayTaoAfter(don.getId(), bayGio.minus(Duration.ofHours(24)))
                    >= TraHangQuyTac.SO_YEU_CAU_DUYET_TOI_DA) {
                throw new CommonException(HttpStatus.TOO_MANY_REQUESTS, ThongDiep.of("traHang.quaNhieuYeuCauDuyet"));
            }
            // Gửi lại: chờ 60 giây; yêu cầu cũ chưa nhập mã của chính thu ngân này bị thay
            for (YeuCauDuyetTraHang cu : yeuCauRepository.findByDonBanHangIdAndTrangThaiIn(don.getId(),
                    List.of(YeuCauDuyetTraHang.CHO_NHAP))) {
                if (!Objects.equals(cu.getNguoiYeuCauId(), userId)) continue;
                long conCho = TraHangQuyTac.GIAN_CACH_GUI_LAI.minus(Duration.between(cu.getNgayTao(), bayGio)).toSeconds();
                if (conCho > 0) throw new CommonException(HttpStatus.TOO_MANY_REQUESTS, ThongDiep.of("traHang.choGuiLaiMa", conCho));
                cu.setTrangThai(YeuCauDuyetTraHang.DA_THAY);
                yeuCauRepository.save(cu);
            }

            List<NguoiDung> nhan = nguoiNhanMa(req.khoId(), userId);
            if (nhan.isEmpty()) throw new CommonException(ThongDiep.of("traHang.chuaCoQuanLyNhanMa"));

            YeuCauDuyetTraHang yc = yeuCauRepository.save(YeuCauDuyetTraHang.builder()
                    .donBanHangId(don.getId()).khoId(req.khoId()).nguoiYeuCauId(userId).lyDo(lyDoGhi)
                    .trangThai(YeuCauDuyetTraHang.CHO_NHAP).soLanSai(0)
                    .hetHanLuc(bayGio.plus(TraHangQuyTac.HAN_MA)).ngayTao(bayGio)
                    .build());
            List<MaGui> ma = new ArrayList<>();
            Set<String> daDung = new HashSet<>();
            for (NguoiDung ql : nhan) {
                String pin;
                do {
                    pin = String.format("%06d", NGAU_NHIEN.nextInt(1_000_000));
                } while (!daDung.add(pin)); // hai quản lý không trùng mã: mã nhập vào chỉ ra đúng một người duyệt
                maRepository.save(YeuCauDuyetTraHangMa.builder()
                        .yeuCauDuyetTraHangId(yc.getId()).nguoiDungId(ql.getId()).maBam(passwordEncoder.encode(pin))
                        .build());
                ma.add(new MaGui(ql, pin));
            }
            NguoiDung nguoiYeuCau = em.find(NguoiDung.class, userId);
            Kho kho = em.find(Kho.class, req.khoId());
            var tt = new EmailNghiepVuService.MaDuyetTraHangThongTin(kho.getTenKho(),
                    TraHangTaiQuayService.tenNguoi(nguoiYeuCau), don.getSoDonHang(), thanhToan,
                    thanhToan == null ? 0 : Duration.between(thanhToan, bayGio).toDays(), lyDoGhi);
            return new DaTao(yc, ma, tt);
        });

        // Đã commit: gửi từng thư (đồng bộ). Người không gửi được thì bỏ mã của họ.
        List<String> daGui = new ArrayList<>();
        for (MaGui m : daTao.ma()) {
            try {
                emailNghiepVuService.guiMaDuyetTraHang(m.quanLy(), daTao.thongTin(), m.ma(), daTao.yeuCau().getHetHanLuc());
                daGui.add(TraHangTaiQuayService.tenNguoi(m.quanLy()));
            } catch (RuntimeException e) {
                log.warn("[TRA-HANG] Không gửi được mã duyệt cho người dùng {}: {}", m.quanLy().getId(), e.toString());
                transactionTemplate.executeWithoutResult(st -> maRepository.findByYeuCauDuyetTraHangId(daTao.yeuCau().getId())
                        .stream().filter(x -> Objects.equals(x.getNguoiDungId(), m.quanLy().getId()))
                        .forEach(maRepository::delete));
            }
        }
        if (daGui.isEmpty()) {
            transactionTemplate.executeWithoutResult(st -> {
                YeuCauDuyetTraHang yc = em.find(YeuCauDuyetTraHang.class, daTao.yeuCau().getId(), LockModeType.PESSIMISTIC_WRITE);
                yc.setTrangThai(YeuCauDuyetTraHang.HET_LUOT);
                yeuCauRepository.save(yc);
            });
            throw new CommonException(HttpStatus.BAD_GATEWAY, ThongDiep.of("traHang.khongGuiDuocMaDuyet"));
        }
        return new TraHangDto.YeuCauDuyetKetQua(daTao.yeuCau().getId(), daTao.yeuCau().getHetHanLuc(), daGui);
    }

    /** Kết quả nhập mã: đúng → người duyệt; sai → câu lỗi (số lần sai đã lưu trước khi báo). */
    private record KetQuaNhap(TraHangDto.DuyetHieuLuc dung, ThongDiep loi, HttpStatus ma) {
    }

    public TraHangDto.DuyetHieuLuc nhapMa(Integer yeuCauId, TraHangDto.NhapMaRequest req) {
        Integer userId = SecurityContextHolder.getUser().getId();
        String ma = req == null || req.ma() == null ? "" : req.ma().replaceAll("\\s", "");
        if (!ma.matches("\\d{6}")) throw new CommonException(ThongDiep.of("traHang.maDuyetSauSo"));

        KetQuaNhap kq = transactionTemplate.execute(st -> {
            YeuCauDuyetTraHang yc = yeuCauId == null ? null
                    : em.find(YeuCauDuyetTraHang.class, yeuCauId, LockModeType.PESSIMISTIC_WRITE);
            if (yc != null) em.refresh(yc, LockModeType.PESSIMISTIC_WRITE);
            if (yc == null || !Objects.equals(yc.getNguoiYeuCauId(), userId)) {
                return new KetQuaNhap(null, ThongDiep.of("traHang.yeuCauDuyetKhongTonTai"), HttpStatus.NOT_FOUND);
            }
            Instant bayGio = Instant.now();
            if (!YeuCauDuyetTraHang.CHO_NHAP.equals(yc.getTrangThai())) {
                return new KetQuaNhap(null, ThongDiep.of("traHang.yeuCauDuyetDaDong"), HttpStatus.CONFLICT);
            }
            if (yc.getHetHanLuc().isBefore(bayGio)) {
                return new KetQuaNhap(null, ThongDiep.of("traHang.maDuyetHetHan"), HttpStatus.CONFLICT);
            }
            for (YeuCauDuyetTraHangMa m : maRepository.findByYeuCauDuyetTraHangId(yc.getId())) {
                if (passwordEncoder.matches(ma, m.getMaBam())) {
                    yc.setTrangThai(YeuCauDuyetTraHang.DA_DUYET);
                    yc.setNguoiDuyetId(m.getNguoiDungId());
                    yc.setDuyetLuc(bayGio);
                    yeuCauRepository.save(yc);
                    NguoiDung nd = em.find(NguoiDung.class, m.getNguoiDungId());
                    return new KetQuaNhap(new TraHangDto.DuyetHieuLuc(yc.getId(), TraHangTaiQuayService.tenNguoi(nd),
                            bayGio.plus(TraHangQuyTac.HIEU_LUC_DUYET)), null, null);
                }
            }
            int sai = (yc.getSoLanSai() == null ? 0 : yc.getSoLanSai()) + 1;
            yc.setSoLanSai(sai);
            int con = TraHangQuyTac.SO_LAN_SAI_TOI_DA - sai;
            if (con <= 0) yc.setTrangThai(YeuCauDuyetTraHang.HET_LUOT);
            yeuCauRepository.save(yc);
            return new KetQuaNhap(null, con <= 0 ? ThongDiep.of("traHang.maDuyetSaiHetLuot")
                    : ThongDiep.of("traHang.maDuyetSai", con), HttpStatus.BAD_REQUEST);
        });
        if (kq.loi() != null) throw new CommonException(kq.ma(), kq.loi());
        return kq.dung();
    }

    /**
     * Người nhận mã: quản lý kho có phân quyền hiệu lực ở cửa hàng nhận và có email; cửa hàng chưa có quản lý thì quản
     * trị viên. Không gửi cho chính người yêu cầu.
     */
    private List<NguoiDung> nguoiNhanMa(Integer khoId, Integer nguoiYeuCauId) {
        List<NguoiDung> ds = phanQuyenNguoiDungKhoRepository.nguoiDungTheoKhoVaVaiTroTai(khoId,
                List.of(IRoleType.quan_ly_kho), Instant.now());
        List<NguoiDung> kq = ds.stream().filter(n -> coEmail(n) && !Objects.equals(n.getId(), nguoiYeuCauId)).toList();
        if (!kq.isEmpty()) return kq;
        return em.createQuery("select n from NguoiDung n where n.vaiTro = :vt and n.trangThai = 1 order by n.id",
                        NguoiDung.class).setParameter("vt", IRoleType.quan_tri_vien).getResultList().stream()
                .filter(n -> coEmail(n) && !Objects.equals(n.getId(), nguoiYeuCauId)).toList();
    }

    private static boolean coEmail(NguoiDung n) {
        return n.getEmail() != null && !n.getEmail().isBlank();
    }
}
