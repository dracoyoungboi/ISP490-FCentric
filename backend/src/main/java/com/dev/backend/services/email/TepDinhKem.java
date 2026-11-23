package com.dev.backend.services.email;

import java.util.Objects;

/** Một tệp đính kèm email (dựng trên luồng gửi thư, ngay trước khi gửi). */
public record TepDinhKem(String ten, String loai, byte[] noiDung) {

    public TepDinhKem {
        Objects.requireNonNull(ten, "ten");
        Objects.requireNonNull(loai, "loai");
        Objects.requireNonNull(noiDung, "noiDung");
    }

    /** Không in nội dung tệp. */
    @Override
    public String toString() {
        return "TepDinhKem[" + ten + ", " + loai + ", " + noiDung.length + " byte]";
    }
}
