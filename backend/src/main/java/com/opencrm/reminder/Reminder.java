package com.opencrm.reminder;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** A follow-up task with a due time, optionally linked to one customer, lead or deal. */
@Entity
@Table(name = "reminders")
@SQLRestriction("deleted_at IS NULL")
public class Reminder extends AuditableEntity {

    public enum Status { PENDING, DONE, CANCELLED }

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "assigned_to", nullable = false)
    private UUID assignedTo;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(name = "deal_id")
    private UUID dealId;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** Keeps completedAt in step with the status. */
    public void changeStatus(Status next) {
        if (next == Status.DONE && status != Status.DONE) {
            completedAt = Instant.now();
        } else if (next != Status.DONE) {
            completedAt = null;
        }
        status = next;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getDueAt() { return dueAt; }
    public void setDueAt(Instant dueAt) { this.dueAt = dueAt; }
    public Status getStatus() { return status; }
    public UUID getAssignedTo() { return assignedTo; }
    public void setAssignedTo(UUID assignedTo) { this.assignedTo = assignedTo; }
    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public UUID getLeadId() { return leadId; }
    public void setLeadId(UUID leadId) { this.leadId = leadId; }
    public UUID getDealId() { return dealId; }
    public void setDealId(UUID dealId) { this.dealId = dealId; }
    public Instant getCompletedAt() { return completedAt; }
}
