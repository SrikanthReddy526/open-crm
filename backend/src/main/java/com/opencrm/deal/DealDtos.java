package com.opencrm.deal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import com.opencrm.deal.Deal.Stage;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class DealDtos {

    private DealDtos() {}

    public record DealRequest(
            UUID id,
            @NotNull UUID customerId,
            @NotBlank @Size(max = 200) String title,
            @NotNull @DecimalMin("0") @DecimalMax("999999999999.99") @Digits(integer = 12, fraction = 2) BigDecimal amount,
            @Pattern(regexp = "[A-Z]{3}") String currency,
            Stage stage,
            LocalDate expectedCloseDate,
            UUID ownerId,
            Long version) {}

    public record StageRequest(@NotNull Stage stage) {}

    public record DealResponse(
            UUID id, UUID customerId, String customerName, String title, BigDecimal amount, String currency,
            Stage stage, LocalDate expectedCloseDate, Instant closedAt, UUID ownerId, String ownerName,
            Instant createdAt, Instant updatedAt, Long version) {

        public static DealResponse from(Deal d, Map<UUID, String> customers, Map<UUID, String> users) {
            return new DealResponse(d.getId(), d.getCustomerId(), customers.get(d.getCustomerId()), d.getTitle(),
                    d.getAmount(), d.getCurrency(), d.getStage(), d.getExpectedCloseDate(), d.getClosedAt(),
                    d.getOwnerId(), users.get(d.getOwnerId()), d.getCreatedAt(), d.getUpdatedAt(), d.getVersion());
        }
    }

    /** One column of the pipeline (Kanban) view. */
    public record StageSummary(Stage stage, long count, BigDecimal totalAmount) {}
}
