package com.opencrm.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed view of the {@code app.*} settings in application.yml. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors, BootstrapAdmin bootstrapAdmin, String timezone) {

    /** Business time zone used for "today", "this week", "this month" (default Asia/Kolkata). */
    public java.time.ZoneId zone() {
        return java.time.ZoneId.of(timezone == null || timezone.isBlank() ? "Asia/Kolkata" : timezone);
    }

    public record Jwt(String secret, int accessTokenMinutes, int refreshTokenDays) {}

    public record Cors(List<String> allowedOriginPatterns) {}

    public record BootstrapAdmin(String email, String password, String fullName) {}
}
