package com.dev.backend.services.impl.trahang;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.trahang.TraHangDto;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.entities.PhieuTraHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.repository.PhieuTraHangRepository;
import com.dev.backend.services.impl.entities.PosConcurrencyRetry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.Optional;

/**
 * Điều phối "Xác nhận hoàn trả" (KHÔNG transactional): cùng requestId gửi lại (mất mạng, bấm hai lần) trả đúng phiếu đã
 * lập, không trả hàng hai lần; trùng số chứng từ / deadlock thì thử lại bằng giao dịch mới (như bán tại quầy).
 */
@Service
public class TraHangXacNhanService {

    @Autowired
    private TraHangTaiQuayTransaction transaction;
    @Autowired
    private TraHangTaiQuayService doc;
    @Autowired
    private PhieuTraHangRepository phieuTraHangRepository;
    @Autowired
    private PhieuNhapKhoRepository phieuNhapKhoRepository;

    public TraHangDto.KetQua xacNhan(TraHangDto.XacNhanRequest req) {
        Integer userId = SecurityContextHolder.getUser().getId();
        if (req != null && req.requestId() != null) {
            Optional<TraHangDto.KetQua> daCo = ketQuaDaCo(req);
            if (daCo.isPresent()) return daCo.get();
        }
        try {
            return PosConcurrencyRetry.call(() -> transaction.xacNhan(req, userId));
        } catch (DataIntegrityViolationException ex) {
            // Hai lần gửi cùng requestId chạy song song: lần thua đọc phiếu của lần thắng
            Optional<TraHangDto.KetQua> daCo = ketQuaDaCo(req);
            if (daCo.isPresent()) return daCo.get();
            throw ex;
        }
    }

    private Optional<TraHangDto.KetQua> ketQuaDaCo(TraHangDto.XacNhanRequest req) {
        Optional<PhieuTraHang> p = phieuTraHangRepository.findByRequestId(req.requestId().trim());
        if (p.isEmpty()) return Optional.empty();
        PhieuTraHang phieu = p.get();
        if (!Objects.equals(phieu.getDonBanHangId(), req.donBanHangId())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("traHang.maYeuCauDaDung"));
        }
        String soPn = phieu.getPhieuNhapKhoId() == null ? null
                : phieuNhapKhoRepository.findById(phieu.getPhieuNhapKhoId()).map(PhieuNhapKho::getSoPhieuNhap).orElse(null);
        return Optional.of(new TraHangDto.KetQua(phieu.getId(), phieu.getSoPhieu(), soPn, phieu.getTongTienHoan(),
                phieu.getPhuongThucHoan(), doc.trangThaiTraHang(phieu.getDonBanHangId())));
    }
}
