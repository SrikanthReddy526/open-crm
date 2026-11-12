package com.opencrm.auth;

import java.time.Instant;
import java.util.UUID;

import com.opencrm.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** One row per logged-in device. Only the SHA-256 hash of the token is stored. */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "device_name")
    private String deviceName;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** When the user logged in on this device (kept when the token is rotated). */
    @Column(name = "session_started_at", nullable = false, updatable = false)
    private Instant sessionStartedAt;

    protected RefreshToken() {}

    public RefreshToken(User user, String tokenHash, String deviceName, Instant expiresAt, Instant sessionStartedAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.deviceName = deviceName;
        this.expiresAt = expiresAt;
        this.sessionStartedAt = sessionStartedAt;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        if (sessionStartedAt == null) {
            sessionStartedAt = createdAt;
        }
    }

    public boolean isUsable() {
        return revokedAt == null && expiresAt.isAfter(Instant.now());
    }

    public void revoke() {
        if (revokedAt == null) {
            revokedAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public String getDeviceName() { return deviceName; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getSessionStartedAt() { return sessionStartedAt; }
}
