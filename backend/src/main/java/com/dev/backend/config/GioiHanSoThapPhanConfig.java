package com.dev.backend.config;

import com.dev.backend.utils.GioiHanSoThapPhan;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.NumberDeserializers;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;

/**
 * Mọi trường BigDecimal trong JSON gửi lên đi qua {@link GioiHanSoThapPhan}: vượt giới hạn thì Jackson báo lỗi định dạng
 * → 400 "dữ liệu không đúng định dạng" (RestControllerGlobalExceptionHandler), không tới được service.
 */
@Configuration
public class GioiHanSoThapPhanConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer gioiHanBigDecimal() {
        return builder -> builder.deserializerByType(BigDecimal.class, new GioiHanBigDecimalDeserializer());
    }

    static final class GioiHanBigDecimalDeserializer extends StdScalarDeserializer<BigDecimal> {

        GioiHanBigDecimalDeserializer() {
            super(BigDecimal.class);
        }

        @Override
        public BigDecimal deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            BigDecimal so = NumberDeserializers.BigDecimalDeserializer.instance.deserialize(p, ctxt);
            if (!GioiHanSoThapPhan.hopLe(so)) {
                throw InvalidFormatException.from(p, "Số vượt giới hạn cho phép", so, BigDecimal.class);
            }
            return so;
        }
    }
}
