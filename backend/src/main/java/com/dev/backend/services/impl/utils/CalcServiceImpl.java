package com.dev.backend.services.impl.utils;

import com.dev.backend.services.CalcService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDate;

@Service
public class CalcServiceImpl implements CalcService {

    // SecureRandom thay cho Random: mã kích hoạt / OTP không được đoán trước được
    private final SecureRandom random = new SecureRandom();

    @Override
    public String getRandomActiveCode(Long lenghtOfString) {
        String characters = "0123456789";
        StringBuilder randomString = new StringBuilder();
        for (int i = 0;
             i < lenghtOfString; i++) {
            int index = random.nextInt(characters.length());
            char randomChar = characters.charAt(index);
            randomString.append(randomChar);
        }
        return randomString.toString();
    }

    @Override
    public String getRandomProductCode(String prefix) {
        // LocalDate thay cho Date.getYear()/getMonth()/getDate() (deprecated). Định dạng kết quả giữ nguyên.
        LocalDate now = LocalDate.now();
        int y = now.getYear();
        int m = now.getMonthValue();
        int d = now.getDayOfMonth();
        // random
        String r = String.format("%04d", random.nextInt(10000));
        return prefix + y + m + d + r;
    }
}
