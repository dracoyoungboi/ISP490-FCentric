package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MaskingUtilsTest {

    @Test
    void maskPhone_standardPhone_masksMiddleDigits() {
        assertEquals("09***382", MaskingUtils.maskPhone("0912345382"));
        assertEquals("08***999", MaskingUtils.maskPhone("0812345999"));
    }

    @Test
    void maskPhone_nullOrEmpty_returnsOriginalOrNull() {
        assertNull(MaskingUtils.maskPhone(null));
        assertNull(MaskingUtils.maskPhone("   "));
        assertEquals("0912", MaskingUtils.maskPhone("0912"));
    }
}

