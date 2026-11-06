package com.dev.backend.dto.request;

import com.dev.backend.exception.customize.CommonException;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Body {"lyDo": "..."} của các API hủy chứng từ (đơn bán, phiếu nhập, phiếu xuất). Lý do bắt buộc, tối đa 500 ký tự;
 * nối vào ghi_chu của chính chứng từ ("Lý do hủy: …"), không thêm cột.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LyDoHuyRequest {

    public static final int TOI_DA = 500;

    String lyDo;

    /** Lý do đã bỏ khoảng trắng hai đầu; trống hoặc quá dài thì báo 400. */
    public static String batBuoc(LyDoHuyRequest body) {
        return batBuoc(body == null ? null : body.getLyDo());
    }

    public static String batBuoc(String lyDo) {
        String t = lyDo == null ? "" : lyDo.trim();
        if (t.isEmpty()) {
            throw new CommonException("Vui lòng nhập lý do hủy.");
        }
        if (t.length() > TOI_DA) {
            throw new CommonException("Lý do hủy tối đa " + TOI_DA + " ký tự.");
        }
        return t;
    }
}
