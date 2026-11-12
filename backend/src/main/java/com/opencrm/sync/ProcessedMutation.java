package com.opencrm.sync;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** Remembers which offline changes were already applied, so a phone re-sending them is harmless. */
@Entity
@Table(name = "processed_mutations")
public class ProcessedMutation {

    @Id
    @Column(name = "mutation_id")
    private UUID mutationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    protected ProcessedMutation() {}

    public ProcessedMutation(UUID mutationId, UUID userId, String entityType, UUID entityId) {
        this.mutationId = mutationId;
        this.userId = userId;
        this.entityType = entityType;
        this.entityId = entityId;
    }

    @PrePersist
    void onCreate() {
        processedAt = Instant.now();
    }

    public UUID getUserId() { return userId; }
    public String getEntityType() { return entityType; }
    public UUID getEntityId() { return entityId; }
}
