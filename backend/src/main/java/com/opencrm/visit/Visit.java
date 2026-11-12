package com.opencrm.visit;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** A field staff visit to a customer. Usually created offline on the phone, so the id comes from the device. */
@Entity
@Table(name = "field_visits")
@SQLRestriction("deleted_at IS NULL")
public class Visit extends AuditableEntity {

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /** Time on the device when the visit happened (may be long before it reached the server). */
    @Column(name = "visited_at", nullable = false)
    private Instant visitedAt;

    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    @Enumerated(EnumType.STRING)
    private VisitOutcome outcome;

    @Column(columnDefinition = "text")
    private String notes;

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public Instant getVisitedAt() { return visitedAt; }
    public void setVisitedAt(Instant visitedAt) { this.visitedAt = visitedAt; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public VisitOutcome getOutcome() { return outcome; }
    public void setOutcome(VisitOutcome outcome) { this.outcome = outcome; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
