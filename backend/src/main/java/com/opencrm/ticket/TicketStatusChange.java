package com.opencrm.ticket;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** One row of a ticket's status timeline. */
@Entity
@Table(name = "ticket_status_history")
public class TicketStatusChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false, updatable = false)
    private UUID ticketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", updatable = false)
    private Ticket.Status fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, updatable = false)
    private Ticket.Status toStatus;

    @Column(name = "changed_by", updatable = false)
    private UUID changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected TicketStatusChange() {}

    public TicketStatusChange(UUID ticketId, Ticket.Status fromStatus, Ticket.Status toStatus, UUID changedBy) {
        this.ticketId = ticketId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedBy = changedBy;
    }

    @PrePersist
    void onCreate() {
        changedAt = Instant.now();
    }

    public Long getId() { return id; }
    public UUID getTicketId() { return ticketId; }
    public Ticket.Status getFromStatus() { return fromStatus; }
    public Ticket.Status getToStatus() { return toStatus; }
    public UUID getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }
}
