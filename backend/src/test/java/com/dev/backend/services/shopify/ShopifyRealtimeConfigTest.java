package com.dev.backend.services.shopify;

import com.dev.backend.config.ShopifyRealtimeConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration;
import org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

class ShopifyRealtimeConfigTest {
    @Configuration(proxyBeanMethods = false)
    @EnableScheduling
    static class SchedulingEnabled {}

    @Test void blockedShopifySchedulerMustNotDelayOtherChannelsOrReplaceBootDefaults() {
        new ApplicationContextRunner().withUserConfiguration(ShopifyRealtimeConfig.class, SchedulingEnabled.class)
                .withConfiguration(AutoConfigurations.of(TaskExecutionAutoConfiguration.class, TaskSchedulingAutoConfiguration.class))
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    var normal = context.getBean("taskScheduler", ThreadPoolTaskScheduler.class);
                    var shopify = context.getBean("shopifyRealtimeScheduler", ThreadPoolTaskScheduler.class);
                    assertNotSame(normal, shopify);
                    assertEquals(1, normal.getScheduledThreadPoolExecutor().getCorePoolSize());
                    assertTrue(context.containsBean("applicationTaskExecutor"));
                    var release = new CountDownLatch(1);
                    int workerCount = shopify.getScheduledThreadPoolExecutor().getCorePoolSize();
                    var occupied = new CountDownLatch(workerCount);
                    for (int i = 0; i < workerCount; i++) shopify.execute(() -> {
                        occupied.countDown();
                        try { release.await(5, TimeUnit.SECONDS); }
                        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
                    });
                    try {
                        assertTrue(occupied.await(2, TimeUnit.SECONDS));
                        var otherChannel = new CountDownLatch(1);
                        normal.execute(otherChannel::countDown);
                        assertTrue(otherChannel.await(2, TimeUnit.SECONDS));
                    } finally { release.countDown(); }
                });
    }

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
