package com.opencrm.visit;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.opencrm.common.ApiException;
import com.opencrm.common.Names;
import com.opencrm.common.PageResponse;
import com.opencrm.common.Paging;
import com.opencrm.customer.CustomerService;
import com.opencrm.security.CurrentUser;
import com.opencrm.visit.VisitDtos.VisitRequest;
import com.opencrm.visit.VisitDtos.VisitResponse;

/**
 * Field visits. Field staff see and edit only their own visits; admins and support agents see all.
 * A visit may arrive days after it happened (offline phone), so visitedAt comes from the device.
 */
@Service
@Transactional
public class VisitService {

    /** Device clocks can be a little ahead; anything further in the future is rejected. */
    private static final long MAX_FUTURE_MINUTES = 10;
    private static final Instant MIN_TIME = Instant.parse("2000-01-01T00:00:00Z");
    private static final Instant MAX_TIME = Instant.parse("2100-01-01T00:00:00Z");

    private final VisitRepository repo;
    private final CustomerService customers;
    private final Names names;

    public VisitService(VisitRepository repo, CustomerService customers, Names names) {
        this.repo = repo;
        this.customers = customers;
        this.names = names;
    }

    @Transactional(readOnly = true)
    public PageResponse<VisitResponse> list(CurrentUser user, UUID userId, UUID customerId, Instant from, Instant to,
                                            int page, int size) {
        UUID who = user.canSeeAll() ? userId : user.id();
        Page<Visit> result = repo.search(who, customerId, from == null ? MIN_TIME : from, to == null ? MAX_TIME : to,
                Paging.of(page, size, null, Set.of(), Sort.by("visitedAt").descending()));
        List<VisitResponse> content = toResponses(result.getContent());
        return new PageResponse<>(content, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Visit get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Visit create(CurrentUser user, VisitRequest req) {
        if (req.id() != null) {
            var existing = repo.findById(req.id());
            if (existing.isPresent()) { // retried offline create: return what we already have
                if (!canAccess(user, existing.get())) {
                    throw ApiException.conflict("error.badRequest");
                }
                return existing.get();
            }
            if (repo.existsIncludingDeleted(req.id())) {
                throw ApiException.conflict("error.visit.deleted");
            }
        }
        validate(req);
        customers.requireAccessible(user, req.customerId());
        Visit v = new Visit();
        v.setId(req.id() != null ? req.id() : UUID.randomUUID());
        v.setUserId(user.id());
        apply(v, req);
        return repo.saveAndFlush(v);
    }

    public Visit update(CurrentUser user, UUID id, VisitRequest req) {
        Visit v = findEditable(user, id);
        if (req.version() != null && !req.version().equals(v.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        validate(req);
        if (!req.customerId().equals(v.getCustomerId())) {
            customers.requireAccessible(user, req.customerId());
        }
        apply(v, req);
        return repo.saveAndFlush(v);
    }

    public void delete(CurrentUser user, UUID id) {
        findEditable(user, id).markDeleted();
    }

    @Transactional(readOnly = true)
    public VisitResponse toResponse(Visit v) {
        return toResponses(List.of(v)).get(0);
    }

    @Transactional(readOnly = true)
    public List<VisitResponse> toResponses(List<Visit> visits) {
        Map<UUID, String> c = names.customers(Names.ids(visits, Visit::getCustomerId));
        Map<UUID, String> u = names.users(Names.ids(visits, Visit::getUserId));
        return visits.stream().map(v -> VisitResponse.from(v, c, u)).toList();
    }

    private Visit findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id).filter(v -> canAccess(user, v))
                .orElseThrow(() -> ApiException.notFound("error.notFound.visit"));
    }

    /** Only the person who made the visit (or an admin) may change it. */
    private Visit findEditable(CurrentUser user, UUID id) {
        Visit v = findAccessible(user, id);
        if (!user.isAdmin() && !v.getUserId().equals(user.id())) {
            throw ApiException.forbidden();
        }
        return v;
    }

    private static boolean canAccess(CurrentUser user, Visit v) {
        return user.canSeeAll() || v.getUserId().equals(user.id());
    }

    private static void validate(VisitRequest req) {
        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw ApiException.badRequest("error.customer.coordinatesPair");
        }
        if (req.visitedAt().isAfter(Instant.now().plus(MAX_FUTURE_MINUTES, ChronoUnit.MINUTES))) {
            throw ApiException.badRequest("error.visit.future");
        }
    }

    private static void apply(Visit v, VisitRequest r) {
        v.setCustomerId(r.customerId());
        v.setVisitedAt(r.visitedAt());
        v.setLatitude(r.latitude());
        v.setLongitude(r.longitude());
        v.setOutcome(r.outcome());
        v.setNotes(Paging.blankToNull(r.notes()));
    }
}
