package com.opencrm.reminder;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.common.PageResponse;
import com.opencrm.reminder.Reminder.Status;
import com.opencrm.reminder.ReminderDtos.ReminderRequest;
import com.opencrm.reminder.ReminderDtos.ReminderResponse;
import com.opencrm.reminder.ReminderDtos.SnoozeRequest;
import com.opencrm.reminder.ReminderService.Due;
import com.opencrm.security.CurrentUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {

    private final ReminderService service;

    public ReminderController(ReminderService service) {
        this.service = service;
    }

    /** Defaults to my pending reminders, soonest first. {@code status=ALL} shows every status. */
    @GetMapping
    PageResponse<ReminderResponse> list(@AuthenticationPrincipal Jwt jwt,
                                        @RequestParam(defaultValue = "PENDING") String status,
                                        @RequestParam(defaultValue = "ALL") Due due,
                                        @RequestParam(defaultValue = "false") boolean everyone,
                                        @RequestParam(required = false) UUID assignedTo,
                                        @RequestParam(required = false) UUID customerId,
                                        @RequestParam(required = false) UUID leadId,
                                        @RequestParam(required = false) UUID dealId,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        Status s;
        try {
            s = "ALL".equalsIgnoreCase(status) ? null : Status.valueOf(status.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw com.opencrm.common.ApiException.badRequest("error.badRequest");
        }
        return service.list(CurrentUser.from(jwt), s, due, everyone, assignedTo, customerId, leadId, dealId, page, size);
    }

    @GetMapping("/{id}")
    ReminderResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ReminderResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReminderRequest req) {
        return service.toResponse(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    ReminderResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @Valid @RequestBody ReminderRequest req) {
        return service.toResponse(service.update(CurrentUser.from(jwt), id, req));
    }

    @PatchMapping("/{id}/complete")
    ReminderResponse complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.complete(CurrentUser.from(jwt), id));
    }

    @PatchMapping("/{id}/snooze")
    ReminderResponse snooze(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @Valid @RequestBody SnoozeRequest req) {
        return service.toResponse(service.snooze(CurrentUser.from(jwt), id, req.until()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }
}
