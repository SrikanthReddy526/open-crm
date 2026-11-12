package com.opencrm.security;

import java.util.UUID;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The logged-in user, read from the validated access token.
 * @param sessionId the device session (refresh-token row) the token was issued for; may be null for old tokens
 */
public record CurrentUser(UUID id, Role role, UUID sessionId) {

    public static CurrentUser from(Jwt jwt) {
        String sid = jwt.getClaimAsString("sid");
        return new CurrentUser(UUID.fromString(jwt.getSubject()), Role.valueOf(jwt.getClaimAsString("role")),
                sid == null ? null : UUID.fromString(sid));
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    /** Admins and support agents see everything; field staff only see records assigned to them. */
    public boolean canSeeAll() {
        return role != Role.FIELD_STAFF;
    }

    /** Kept for the customer module. Same rule as {@link #canSeeAll()}. */
    public boolean canSeeAllCustomers() {
        return canSeeAll();
    }
}
