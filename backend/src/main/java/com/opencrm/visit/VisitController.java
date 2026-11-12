package com.opencrm.visit;

import java.time.Instant;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
import com.opencrm.visit.VisitDtos.VisitRequest;
import com.opencrm.visit.VisitDtos.VisitResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/visits")
public class VisitController {

    private final VisitService service;

    public VisitController(VisitService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<VisitResponse> list(@AuthenticationPrincipal Jwt jwt,
                                     @RequestParam(required = false) UUID userId,
                                     @RequestParam(required = false) UUID customerId,
                                     @RequestParam(required = false) Instant from,
                                     @RequestParam(required = false) Instant to,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentUser.from(jwt), userId, customerId, from, to, page, size);
    }

    @GetMapping("/{id}")
    VisitResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    VisitResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody VisitRequest req) {
        return service.toResponse(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    VisitResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody VisitRequest req) {
        return service.toResponse(service.update(CurrentUser.from(jwt), id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }
}
