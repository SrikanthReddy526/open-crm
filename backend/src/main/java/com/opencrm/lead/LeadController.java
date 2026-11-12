package com.opencrm.lead;

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
import com.opencrm.lead.Lead.Status;
import com.opencrm.lead.LeadDtos.ConvertRequest;
import com.opencrm.lead.LeadDtos.ConvertResponse;
import com.opencrm.lead.LeadDtos.LeadRequest;
import com.opencrm.lead.LeadDtos.LeadResponse;
import com.opencrm.lead.LeadDtos.StatusRequest;
import com.opencrm.security.CurrentUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadService service;

    public LeadController(LeadService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<LeadResponse> list(@AuthenticationPrincipal Jwt jwt,
                                    @RequestParam(defaultValue = "") String q,
                                    @RequestParam(required = false) Status status,
                                    @RequestParam(defaultValue = "false") boolean includeConverted,
                                    @RequestParam(required = false) UUID ownerId,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.list(CurrentUser.from(jwt), q, status, includeConverted, ownerId, page, size, sort);
    }

    @GetMapping("/{id}")
    LeadResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    LeadResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LeadRequest req) {
        return service.toResponse(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    LeadResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody LeadRequest req) {
        return service.toResponse(service.update(CurrentUser.from(jwt), id, req));
    }

    @PatchMapping("/{id}/status")
    LeadResponse status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody StatusRequest req) {
        return service.toResponse(service.changeStatus(CurrentUser.from(jwt), id, req.status()));
    }

    @PostMapping("/{id}/convert")
    ConvertResponse convert(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @Valid @RequestBody(required = false) ConvertRequest req) {
        return service.convert(CurrentUser.from(jwt), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }
}
