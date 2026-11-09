package com.dev.backend.exception.customize;

import com.dev.backend.i18n.CoThongDiep;
import com.dev.backend.i18n.ThongDiep;

public class InvalidFieldException extends RuntimeException implements CoThongDiep {

    private final transient ThongDiep thongDiep;

    public InvalidFieldException(String message) {
        super(message);
        this.thongDiep = null;
    }

    public InvalidFieldException(String message, Throwable cause) {
        super(message, cause);
        this.thongDiep = null;
    }

    /** Câu theo khóa (đa ngôn ngữ); getMessage() vẫn là câu tiếng Việt. */
    public InvalidFieldException(ThongDiep thongDiep) {
        super(thongDiep.tiengViet());
        this.thongDiep = thongDiep;
    }

    @Override
    public ThongDiep getThongDiep() {
        return thongDiep;
    }
}
