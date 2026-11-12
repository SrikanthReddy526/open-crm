package com.opencrm.sync;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.opencrm.customer.dto.CustomerResponse;
import com.opencrm.reminder.ReminderDtos.ReminderResponse;
import com.opencrm.visit.VisitDtos.VisitResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class SyncDtos {

    private SyncDtos() {}

    /**
     * Everything this user's device should hold offline that changed after {@code since}.
     * @param full     true when {@code since} was empty: the device should replace its local copy
     * @param serverTime send this back as {@code since} on the next pull
     */
    public record PullResponse(Instant serverTime, boolean full,
                               List<CustomerResponse> customers, List<VisitResponse> visits,
                               List<ReminderResponse> reminders, Deleted deleted) {}

    public record Deleted(List<UUID> customers, List<UUID> visits, List<UUID> reminders) {}

    public enum Op { CREATE, UPDATE, DELETE }

    /**
     * One change made on the device.
     * @param mutationId  random id created on the device; re-sending the same id is safe
     * @param entity      "customer", "visit" or "reminder"
     * @param baseVersion the version the device last saw (UPDATE/DELETE), used to detect conflicts
     * @param data        the record's fields, same shape as the normal create/update request
     */
    public record Mutation(@NotNull UUID mutationId, @NotBlank String entity, @NotNull Op op, @NotNull UUID id,
                           Long baseVersion, Map<String, Object> data) {}

    public record PushRequest(@NotNull @Size(max = 200) List<@Valid Mutation> mutations) {}

    public enum ResultStatus { APPLIED, DUPLICATE, CONFLICT, REJECTED }

    /** @param data the server's copy of the record after the change (or the newer copy, on CONFLICT) */
    public record MutationResult(UUID mutationId, ResultStatus status, String message, Object data) {}

    public record PushResponse(List<MutationResult> results) {}
}
