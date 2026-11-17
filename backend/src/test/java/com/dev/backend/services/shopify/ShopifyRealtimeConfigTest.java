package com.dev.backend.services.shopify;

import com.dev.backend.config.ShopifyRealtimeConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.junit.jupiter.api.Assertions.*;

class ShopifyRealtimeConfigTest {
    @Test void dedicatedWorkerMustNotReplaceDefaultMvcAndMailExecutor() {
        new ApplicationContextRunner().withUserConfiguration(ShopifyRealtimeConfig.class)
                .withConfiguration(AutoConfigurations.of(TaskExecutionAutoConfiguration.class))
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertTrue(context.containsBean("applicationTaskExecutor"));
                    assertTrue(context.containsBean("shopifyRealtimeExecutor"));
                    assertNotSame(context.getBean("applicationTaskExecutor"), context.getBean("shopifyRealtimeExecutor"));
                });
    }
}
