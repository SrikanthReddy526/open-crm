package com.opencrm.ticket;

import java.util.List;
import java.util.Set;
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
import com.opencrm.security.CurrentUser;
import com.opencrm.ticket.Ticket.Priority;
import com.opencrm.ticket.Ticket.Status;
import com.opencrm.ticket.TicketDtos.AssignRequest;
import com.opencrm.ticket.TicketDtos.CommentRequest;
import com.opencrm.ticket.TicketDtos.CommentResponse;
import com.opencrm.ticket.TicketDtos.HistoryResponse;
import com.opencrm.ticket.TicketDtos.StatusRequest;
import com.opencrm.ticket.TicketDtos.TicketRequest;
import com.opencrm.ticket.TicketDtos.TicketResponse;
import com.opencrm.ticket.TicketDtos.TicketStats;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService service;

    public TicketController(TicketService service) {
        this.service = service;
    }

    /** {@code status} and {@code priority} accept several values: ?status=OPEN,IN_PROGRESS */
    @GetMapping
    PageResponse<TicketResponse> list(@AuthenticationPrincipal Jwt jwt,
                                      @RequestParam(defaultValue = "") String q,
                                      @RequestParam(required = false) Set<Status> status,
                                      @RequestParam(required = false) Set<Priority> priority,
                                      @RequestParam(required = false) UUID assignedTo,
                                      @RequestParam(defaultValue = "false") boolean unassigned,
                                      @RequestParam(required = false) UUID customerId,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.list(CurrentUser.from(jwt), q, status, priority, assignedTo, unassigned, customerId,
                page, size, sort);
    }

    @GetMapping("/stats")
    TicketStats stats(@AuthenticationPrincipal Jwt jwt) {
        return service.stats(CurrentUser.from(jwt));
    }

    @GetMapping("/{id}")
    TicketResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    TicketResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TicketRequest req) {
        return service.toResponse(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    TicketResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                          @Valid @RequestBody TicketRequest req) {
        return service.toResponse(service.update(CurrentUser.from(jwt), id, req));
    }

    @PatchMapping("/{id}/status")
    TicketResponse status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                          @Valid @RequestBody StatusRequest req) {
        return service.toResponse(service.changeStatus(CurrentUser.from(jwt), id, req.status()));
    }

    @PatchMapping("/{id}/assign")
    TicketResponse assign(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody AssignRequest req) {
        return service.toResponse(service.assign(CurrentUser.from(jwt), id, req.userId()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }

    @GetMapping("/{id}/comments")
    List<CommentResponse> comments(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.comments(CurrentUser.from(jwt), id);
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    CommentResponse addComment(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                               @Valid @RequestBody CommentRequest req) {
        return service.addComment(CurrentUser.from(jwt), id, req.body(), Boolean.TRUE.equals(req.internal()));
    }

    @GetMapping("/{id}/history")
    List<HistoryResponse> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.history(CurrentUser.from(jwt), id);
    }
}
