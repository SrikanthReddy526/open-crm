package com.opencrm.deal;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
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
import com.opencrm.deal.Deal.Stage;
import com.opencrm.deal.DealDtos.DealRequest;
import com.opencrm.deal.DealDtos.DealResponse;
import com.opencrm.deal.DealDtos.StageSummary;
import com.opencrm.security.CurrentUser;

/** Deals. Field staff only see and edit deals they own; admins and support agents see all. */
@Service
@Transactional
public class DealService {

    private static final Set<String> SORTABLE = Set.of("title", "amount", "expectedCloseDate", "createdAt", "updatedAt");

    private final DealRepository repo;
    private final CustomerService customers;
    private final Names names;

    public DealService(DealRepository repo, CustomerService customers, Names names) {
        this.repo = repo;
        this.customers = customers;
        this.names = names;
    }

    @Transactional(readOnly = true)
    public PageResponse<DealResponse> list(CurrentUser user, String q, Stage stage, UUID customerId, UUID ownerId,
                                           int page, int size, String sort) {
        UUID owner = user.canSeeAll() ? ownerId : user.id();
        Set<Stage> stages = stage == null ? EnumSet.allOf(Stage.class) : EnumSet.of(stage);
        Page<Deal> result = repo.search(owner, customerId, stages, Paging.like(q),
                Paging.of(page, size, sort, SORTABLE, Sort.by("updatedAt").descending()));
        return new PageResponse<>(toResponses(result.getContent()), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Deal get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Deal create(CurrentUser user, DealRequest req) {
        if (req.id() != null) {
            var existing = repo.findById(req.id());
            if (existing.isPresent()) {
                if (!canAccess(user, existing.get())) {
                    throw ApiException.conflict("error.badRequest");
                }
                return existing.get();
            }
        }
        customers.requireAccessible(user, req.customerId());
        Deal d = new Deal();
        if (req.id() != null) {
            d.setId(req.id());
        }
        apply(d, req);
        d.moveTo(req.stage() == null ? Stage.PROSPECTING : req.stage());
        d.setOwnerId(user.canSeeAll() && req.ownerId() != null ? req.ownerId() : user.id());
        return repo.saveAndFlush(d);
    }

    public Deal update(CurrentUser user, UUID id, DealRequest req) {
        Deal d = findAccessible(user, id);
        if (req.version() != null && !req.version().equals(d.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        if (!req.customerId().equals(d.getCustomerId())) {
            customers.requireAccessible(user, req.customerId());
        }
        apply(d, req);
        if (req.stage() != null) {
            d.moveTo(req.stage());
        }
        if (user.canSeeAll() && req.ownerId() != null) {
            d.setOwnerId(req.ownerId());
        }
        return repo.saveAndFlush(d);
    }

    public Deal changeStage(CurrentUser user, UUID id, Stage stage) {
        Deal d = findAccessible(user, id);
        d.moveTo(stage);
        return repo.saveAndFlush(d);
    }

    public void delete(CurrentUser user, UUID id) {
        findAccessible(user, id).markDeleted();
    }

    /** Count and total amount per stage, in pipeline order (stages with no deals included). */
    @Transactional(readOnly = true)
    public List<StageSummary> pipeline(CurrentUser user) {
        Map<Stage, StageSummary> byStage = new EnumMap<>(Stage.class);
        for (Object[] row : repo.pipeline(user.canSeeAll() ? null : user.id())) {
            Stage s = (Stage) row[0];
            byStage.put(s, new StageSummary(s, ((Number) row[1]).longValue(), toDecimal(row[2])));
        }
        List<StageSummary> out = new ArrayList<>();
        for (Stage s : Stage.values()) {
            out.add(byStage.getOrDefault(s, new StageSummary(s, 0, BigDecimal.ZERO)));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public DealResponse toResponse(Deal d) {
        return toResponses(List.of(d)).get(0);
    }

    @Transactional(readOnly = true)
    public List<DealResponse> toResponses(List<Deal> deals) {
        Map<UUID, String> c = names.customers(Names.ids(deals, Deal::getCustomerId));
        Map<UUID, String> u = names.users(Names.ids(deals, Deal::getOwnerId));
        return deals.stream().map(d -> DealResponse.from(d, c, u)).toList();
    }

    private Deal findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id).filter(d -> canAccess(user, d))
                .orElseThrow(() -> ApiException.notFound("error.notFound.deal"));
    }

    private static boolean canAccess(CurrentUser user, Deal d) {
        return user.canSeeAll() || user.id().equals(d.getOwnerId());
    }

    private static void apply(Deal d, DealRequest r) {
        d.setCustomerId(r.customerId());
        d.setTitle(r.title().trim());
        d.setAmount(r.amount());
        d.setCurrency(r.currency() == null ? "INR" : r.currency());
        d.setExpectedCloseDate(r.expectedCloseDate());
    }

    static BigDecimal toDecimal(Object value) {
        if (value instanceof BigDecimal b) {
            return b;
        }
        return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }
}
