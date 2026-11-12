package com.opencrm.visit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VisitRepository extends JpaRepository<Visit, UUID> {

    @Query("""
            select v from Visit v
            where (:userId is null or v.userId = :userId)
              and (:customerId is null or v.customerId = :customerId)
              and v.visitedAt >= :from
              and v.visitedAt < :to
            """)
    Page<Visit> search(@Param("userId") UUID userId, @Param("customerId") UUID customerId,
                       @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);

    @Query("select count(v) from Visit v where (:userId is null or v.userId = :userId) and v.visitedAt >= :from")
    long countSince(@Param("userId") UUID userId, @Param("from") Instant from);

    // ---------- offline sync (native: includes soft-deleted rows) ----------

    @Query(value = "SELECT v.* FROM field_visits v WHERE v.deleted_at IS NULL AND v.user_id = :userId AND v.updated_at > :since ORDER BY v.updated_at",
            nativeQuery = true)
    List<Visit> changedSince(@Param("userId") UUID userId, @Param("since") Instant since);

    @Query(value = "SELECT v.id FROM field_visits v WHERE v.deleted_at > :since AND v.user_id = :userId",
            nativeQuery = true)
    List<UUID> deletedSince(@Param("userId") UUID userId, @Param("since") Instant since);

    /** Includes soft-deleted rows: an offline client must not re-create a visit that was deleted. */
    @Query(value = "SELECT count(*) > 0 FROM field_visits WHERE id = :id", nativeQuery = true)
    boolean existsIncludingDeleted(@Param("id") UUID id);
}
