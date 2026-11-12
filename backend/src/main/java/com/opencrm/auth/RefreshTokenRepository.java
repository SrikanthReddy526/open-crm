package com.opencrm.auth;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** One usable token per logged-in device. */
    @Query("""
            select t from RefreshToken t join fetch t.user
            where t.revokedAt is null and t.expiresAt > :now and (:userId is null or t.user.id = :userId)
            order by t.createdAt desc
            """)
    List<RefreshToken> findActive(@Param("userId") UUID userId, @Param("now") Instant now);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null and (:keep is null or t.id <> :keep)")
    int revokeAllForUser(@Param("userId") UUID userId, @Param("keep") UUID keep, @Param("now") Instant now);
}
