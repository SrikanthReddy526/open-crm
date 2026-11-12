package com.opencrm.ticket;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.opencrm.ticket.Ticket.Priority;
import com.opencrm.ticket.Ticket.Status;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class TicketDtos {

    private TicketDtos() {}

    public record TicketRequest(
            UUID id,
            @NotNull UUID customerId,
            @NotBlank @Size(max = 200) String subject,
            @Size(max = 10000) String description,
            Priority priority,
            UUID assignedTo,
            Long version) {}

    public record StatusRequest(@NotNull Status status) {}

    /** {@code userId} null = unassign. */
    public record AssignRequest(UUID userId) {}

    public record CommentRequest(@NotBlank @Size(max = 10000) String body, Boolean internal) {}

    public record TicketResponse(
            UUID id, Long ticketNumber, UUID customerId, String customerName, String subject, String description,
            Status status, Priority priority, UUID assignedTo, String assignedToName, UUID createdBy,
            String createdByName, Instant resolvedAt, Instant createdAt, Instant updatedAt, Long version) {

        public static TicketResponse from(Ticket t, Map<UUID, String> customers, Map<UUID, String> users) {
            return new TicketResponse(t.getId(), t.getTicketNumber(), t.getCustomerId(), customers.get(t.getCustomerId()),
                    t.getSubject(), t.getDescription(), t.getStatus(), t.getPriority(), t.getAssignedTo(),
                    users.get(t.getAssignedTo()), t.getCreatedBy(), users.get(t.getCreatedBy()), t.getResolvedAt(),
                    t.getCreatedAt(), t.getUpdatedAt(), t.getVersion());
        }
    }

    public record CommentResponse(UUID id, UUID authorId, String authorName, String body, boolean internal,
                                  Instant createdAt) {

        public static CommentResponse from(TicketComment c, Map<UUID, String> users) {
            return new CommentResponse(c.getId(), c.getAuthorId(), users.get(c.getAuthorId()), c.getBody(),
                    c.isInternal(), c.getCreatedAt());
        }
    }

    public record HistoryResponse(Status fromStatus, Status toStatus, UUID changedBy, String changedByName,
                                  Instant changedAt) {

        public static HistoryResponse from(TicketStatusChange h, Map<UUID, String> users) {
            return new HistoryResponse(h.getFromStatus(), h.getToStatus(), h.getChangedBy(),
                    users.get(h.getChangedBy()), h.getChangedAt());
        }
    }

    /** Counts for the support dashboard. {@code open} = OPEN + IN_PROGRESS + ON_HOLD. */
    public record TicketStats(Map<Status, Long> byStatus, Map<Priority, Long> openByPriority, long open,
                              long urgentOpen, long assignedToMeOpen) {}
}
