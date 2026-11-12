package com.opencrm.ticket;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** A customer support ticket. {@code ticketNumber} is a short, human-friendly number (#1042) set by the database. */
@Entity
@Table(name = "tickets")
@SQLRestriction("deleted_at IS NULL")
public class Ticket extends AuditableEntity {

    public enum Status {
        OPEN, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED;

        public boolean isDone() {
            return this == RESOLVED || this == CLOSED;
        }
    }

    public enum Priority { LOW, MEDIUM, HIGH, URGENT }

    @Generated
    @Column(name = "ticket_number", insertable = false, updatable = false)
    private Long ticketNumber;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority = Priority.MEDIUM;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    /** Changes the status; resolvedAt is set when it is resolved/closed and cleared when reopened. */
    public void moveTo(Status next) {
        if (next.isDone() && resolvedAt == null) {
            resolvedAt = Instant.now();
        } else if (!next.isDone()) {
            resolvedAt = null;
        }
        status = next;
    }

    public Long getTicketNumber() { return ticketNumber; }
    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Status getStatus() { return status; }
    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }
    public UUID getAssignedTo() { return assignedTo; }
    public void setAssignedTo(UUID assignedTo) { this.assignedTo = assignedTo; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public Instant getResolvedAt() { return resolvedAt; }
}
