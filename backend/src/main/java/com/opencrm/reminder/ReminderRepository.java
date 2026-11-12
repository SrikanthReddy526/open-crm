package com.opencrm.reminder;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    @Query("""
            select r from Reminder r
            where (:assignedTo is null or r.assignedTo = :assignedTo)
              and r.status in :statuses
              and r.dueAt >= :dueFrom and r.dueAt < :dueTo
              and (:customerId is null or r.customerId = :customerId)
              and (:leadId is null or r.leadId = :leadId)
              and (:dealId is null or r.dealId = :dealId)
            """)
    Page<Reminder> search(@Param("assignedTo") UUID assignedTo,
                          @Param("statuses") Collection<Reminder.Status> statuses,
                          @Param("dueFrom") Instant dueFrom, @Param("dueTo") Instant dueTo,
                          @Param("customerId") UUID customerId, @Param("leadId") UUID leadId,
                          @Param("dealId") UUID dealId, Pageable pageable);

    @Query("""
            select count(r) from Reminder r
            where (:assignedTo is null or r.assignedTo = :assignedTo)
              and r.status = com.opencrm.reminder.Reminder.Status.PENDING
              and r.dueAt >= :dueFrom and r.dueAt < :dueTo
            """)
    long countPending(@Param("assignedTo") UUID assignedTo, @Param("dueFrom") Instant dueFrom,
                      @Param("dueTo") Instant dueTo);

    // ---------- offline sync (native: includes soft-deleted rows) ----------

    @Query(value = "SELECT r.* FROM reminders r WHERE r.deleted_at IS NULL AND r.assigned_to = :userId AND r.updated_at > :since ORDER BY r.updated_at",
            nativeQuery = true)
    List<Reminder> changedSince(@Param("userId") UUID userId, @Param("since") Instant since);

    @Query(value = "SELECT r.id FROM reminders r WHERE r.deleted_at > :since AND r.assigned_to = :userId",
            nativeQuery = true)
    List<UUID> deletedSince(@Param("userId") UUID userId, @Param("since") Instant since);
}
