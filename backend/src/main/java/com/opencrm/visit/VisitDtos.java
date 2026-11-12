package com.opencrm.visit;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class VisitDtos {

    private VisitDtos() {}

    /** @param id client-generated UUID (required for offline creates, optional otherwise) */
    public record VisitRequest(
            UUID id,
            @NotNull UUID customerId,
            @NotNull Instant visitedAt,
            @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
            @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
            VisitOutcome outcome,
            @Size(max = 5000) String notes,
            Long version) {}

    public record VisitResponse(
            UUID id, UUID customerId, String customerName, UUID userId, String userName,
            Instant visitedAt, BigDecimal latitude, BigDecimal longitude, VisitOutcome outcome, String notes,
            Instant createdAt, Instant updatedAt, Long version) {

        public static VisitResponse from(Visit v, Map<UUID, String> customers, Map<UUID, String> users) {
            return new VisitResponse(v.getId(), v.getCustomerId(), customers.get(v.getCustomerId()),
                    v.getUserId(), users.get(v.getUserId()), v.getVisitedAt(), v.getLatitude(), v.getLongitude(),
                    v.getOutcome(), v.getNotes(), v.getCreatedAt(), v.getUpdatedAt(), v.getVersion());
        }
    }
}
