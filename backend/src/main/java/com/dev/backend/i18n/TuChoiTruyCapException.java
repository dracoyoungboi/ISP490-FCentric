package com.dev.backend.i18n;

import org.springframework.security.access.AccessDeniedException;

/** AccessDeniedException mang câu theo khóa (vẫn là 403 qua bộ xử lý AccessDeniedException). */
public class TuChoiTruyCapException extends AccessDeniedException implements CoThongDiep {

    private final transient ThongDiep thongDiep;

    public TuChoiTruyCapException(ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }
}
