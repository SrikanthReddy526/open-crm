package com.opencrm.deal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** A sales opportunity with a customer. Amounts are in INR unless {@code currency} says otherwise. */
@Entity
@Table(name = "deals")
@SQLRestriction("deleted_at IS NULL")
public class Deal extends AuditableEntity {

    public enum Stage {
        PROSPECTING, PROPOSAL, NEGOTIATION, WON, LOST;

        public boolean isClosed() {
            return this == WON || this == LOST;
        }
    }

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Stage stage = Stage.PROSPECTING;

    @Column(name = "expected_close_date")
    private LocalDate expectedCloseDate;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "owner_id")
    private UUID ownerId;

    /** Sets the stage and keeps closedAt in step (set when WON/LOST, cleared when reopened). */
    public void moveTo(Stage next) {
        if (next.isClosed() && (closedAt == null || stage != next)) {
            closedAt = Instant.now();
        } else if (!next.isClosed()) {
            closedAt = null;
        }
        stage = next;
    }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Stage getStage() { return stage; }
    public LocalDate getExpectedCloseDate() { return expectedCloseDate; }
    public void setExpectedCloseDate(LocalDate expectedCloseDate) { this.expectedCloseDate = expectedCloseDate; }
    public Instant getClosedAt() { return closedAt; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
}
