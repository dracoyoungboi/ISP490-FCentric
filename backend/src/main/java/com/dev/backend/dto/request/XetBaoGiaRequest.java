package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Body của PUT /don-mua-hang/duyet-don/{id}/{3|4} (chấp nhận / không chấp nhận báo giá). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class XetBaoGiaRequest {
    /** Lý do không chấp nhận: không bắt buộc, tối đa 500 ký tự; chỉ dùng khi không chấp nhận (4). */
    String lyDo;
    /** ngayBaoGia màn hình đang hiện. Khác giá trị trong CSDL thì 409 BAO_GIA_DA_DOI. */
    Instant ngayBaoGiaDaXem;
}
