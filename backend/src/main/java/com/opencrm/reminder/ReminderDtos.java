package com.opencrm.reminder;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.opencrm.reminder.Reminder.Status;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ReminderDtos {

    private ReminderDtos() {}

    /** Link to at most one of customerId, leadId, dealId. */
    public record ReminderRequest(
            UUID id,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 5000) String description,
            @NotNull Instant dueAt,
            Status status,
            UUID assignedTo,
            UUID customerId,
            UUID leadId,
            UUID dealId,
            Long version) {}

    public record SnoozeRequest(@NotNull Instant until) {}

    public record ReminderResponse(
            UUID id, String title, String description, Instant dueAt, Status status,
            UUID assignedTo, String assignedToName, UUID customerId, String customerName,
            UUID leadId, UUID dealId, Instant completedAt, Instant createdAt, Instant updatedAt, Long version) {

        public static ReminderResponse from(Reminder r, Map<UUID, String> users, Map<UUID, String> customers) {
            return new ReminderResponse(r.getId(), r.getTitle(), r.getDescription(), r.getDueAt(), r.getStatus(),
                    r.getAssignedTo(), users.get(r.getAssignedTo()), r.getCustomerId(), customers.get(r.getCustomerId()),
                    r.getLeadId(), r.getDealId(), r.getCompletedAt(), r.getCreatedAt(), r.getUpdatedAt(), r.getVersion());
        }
    }
}
