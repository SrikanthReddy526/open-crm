package com.opencrm.deal;

import java.util.List;
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
import com.opencrm.deal.Deal.Stage;
import com.opencrm.deal.DealDtos.DealRequest;
import com.opencrm.deal.DealDtos.DealResponse;
import com.opencrm.deal.DealDtos.StageRequest;
import com.opencrm.deal.DealDtos.StageSummary;
import com.opencrm.security.CurrentUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/deals")
public class DealController {

    private final DealService service;

    public DealController(DealService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<DealResponse> list(@AuthenticationPrincipal Jwt jwt,
                                    @RequestParam(defaultValue = "") String q,
                                    @RequestParam(required = false) Stage stage,
                                    @RequestParam(required = false) UUID customerId,
                                    @RequestParam(required = false) UUID ownerId,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(defaultValue = "updatedAt,desc") String sort) {
        return service.list(CurrentUser.from(jwt), q, stage, customerId, ownerId, page, size, sort);
    }

    @GetMapping("/pipeline")
    List<StageSummary> pipeline(@AuthenticationPrincipal Jwt jwt) {
        return service.pipeline(CurrentUser.from(jwt));
    }

    @GetMapping("/{id}")
    DealResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.toResponse(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    DealResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DealRequest req) {
        return service.toResponse(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    DealResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody DealRequest req) {
        return service.toResponse(service.update(CurrentUser.from(jwt), id, req));
    }

    @PatchMapping("/{id}/stage")
    DealResponse stage(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody StageRequest req) {
        return service.toResponse(service.changeStage(CurrentUser.from(jwt), id, req.stage()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }
}
