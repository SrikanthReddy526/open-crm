package com.opencrm.auth;

import java.time.Instant;
import java.util.UUID;

/** A logged-in device. {@code lastActiveAt} = last time the device refreshed its token. */
public record SessionDto(UUID id, UUID userId, String userName, String userEmail, String deviceName,
                         Instant startedAt, Instant lastActiveAt, Instant expiresAt, boolean current) {

    public static SessionDto from(RefreshToken t, UUID currentSessionId) {
        return new SessionDto(t.getId(), t.getUser().getId(), t.getUser().getFullName(), t.getUser().getEmail(),
                t.getDeviceName(), t.getSessionStartedAt(), t.getCreatedAt(), t.getExpiresAt(),
                t.getId().equals(currentSessionId));
    }
}
