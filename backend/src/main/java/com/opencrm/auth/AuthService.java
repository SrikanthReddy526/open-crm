package com.opencrm.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.opencrm.auth.dto.AuthDtos.AuthResponse;
import com.opencrm.auth.dto.AuthDtos.UpdateProfileRequest;
import com.opencrm.common.ApiException;
import com.opencrm.common.Paging;
import com.opencrm.config.AppProperties;
import com.opencrm.security.CurrentUser;
import com.opencrm.security.JwtService;
import com.opencrm.user.User;
import com.opencrm.user.UserDto;
import com.opencrm.user.UserRepository;

/**
 * Login sessions across devices: each device gets its own refresh token row,
 * so a user can be logged in on the website, phone and desktop at the same time,
 * and one device can be logged out without affecting the others.
 * Refresh tokens are rotated on every use.
 */
@Service
@Transactional
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Duration refreshTtl;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTtl = Duration.ofDays(props.jwt().refreshTokenDays());
    }

    public AuthResponse login(String email, String password, String deviceName) {
        User user = users.findByEmailIgnoreCase(email.trim())
                .filter(User::isActive)
                .filter(u -> passwordEncoder.matches(password, u.getPasswordHash()))
                .orElseThrow(() -> ApiException.unauthorized("error.auth.invalidCredentials"));
        return issueTokens(user, deviceName, Instant.now());
    }

    public AuthResponse refresh(String rawToken) {
        RefreshToken current = refreshTokens.findByTokenHash(hash(rawToken))
                .filter(RefreshToken::isUsable)
                .filter(t -> t.getUser().isActive())
                .orElseThrow(() -> ApiException.unauthorized("error.auth.invalidRefreshToken"));
        current.revoke(); // rotation: each refresh token works only once
        return issueTokens(current.getUser(), current.getDeviceName(), current.getSessionStartedAt());
    }

    public void logout(String rawToken) {
        refreshTokens.findByTokenHash(hash(rawToken)).ifPresent(RefreshToken::revoke);
    }

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        return UserDto.from(load(userId));
    }

    public UserDto updateProfile(UUID userId, UpdateProfileRequest req) {
        User u = load(userId);
        u.setFullName(req.fullName().trim());
        u.setPhone(Paging.blankToNull(req.phone()));
        if (req.preferredLanguage() != null) {
            u.setPreferredLanguage(req.preferredLanguage());
        }
        return UserDto.from(u);
    }

    /** Changes the password and logs out every other device (this one stays logged in). */
    public void changePassword(CurrentUser me, String currentPassword, String newPassword) {
        User u = load(me.id());
        if (!passwordEncoder.matches(currentPassword, u.getPasswordHash())) {
            throw ApiException.badRequest("error.auth.wrongPassword");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        refreshTokens.revokeAllForUser(u.getId(), me.sessionId(), Instant.now());
    }

    @Transactional(readOnly = true)
    public List<SessionDto> sessions(UUID userId, UUID currentSessionId) {
        return refreshTokens.findActive(userId, Instant.now()).stream()
                .map(t -> SessionDto.from(t, currentSessionId)).toList();
    }

    /** Logs out one device. Users may only end their own sessions unless {@code asAdmin}. */
    public void revokeSession(CurrentUser me, UUID sessionId, boolean asAdmin) {
        RefreshToken t = refreshTokens.findById(sessionId)
                .filter(x -> asAdmin || x.getUser().getId().equals(me.id()))
                .orElseThrow(() -> ApiException.notFound("error.notFound.session"));
        t.revoke();
    }

    /** Logs out all devices of a user (password reset, deactivation). */
    public void revokeAll(UUID userId) {
        refreshTokens.revokeAllForUser(userId, null, Instant.now());
    }

    private User load(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("error.auth.invalidRefreshToken"));
    }

    private AuthResponse issueTokens(User user, String deviceName, Instant sessionStartedAt) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String device = deviceName == null || deviceName.isBlank() ? "Unknown device"
                : deviceName.substring(0, Math.min(100, deviceName.length()));
        RefreshToken row = refreshTokens.save(
                new RefreshToken(user, hash(raw), device, Instant.now().plus(refreshTtl), sessionStartedAt));
        return new AuthResponse(jwtService.issueAccessToken(user, row.getId()), raw,
                jwtService.accessTokenTtlSeconds(), UserDto.from(user));
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
