package com.opencrm.lead;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
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
import com.opencrm.customer.Customer;
import com.opencrm.customer.CustomerService;
import com.opencrm.customer.dto.CustomerRequest;
import com.opencrm.deal.Deal;
import com.opencrm.deal.DealDtos.DealRequest;
import com.opencrm.deal.DealService;
import com.opencrm.lead.Lead.Status;
import com.opencrm.lead.LeadDtos.ConvertRequest;
import com.opencrm.lead.LeadDtos.ConvertResponse;
import com.opencrm.lead.LeadDtos.LeadRequest;
import com.opencrm.lead.LeadDtos.LeadResponse;
import com.opencrm.security.CurrentUser;

/** Leads. Field staff only see leads they own; admins and support agents see all. */
@Service
@Transactional
public class LeadService {

    private static final Set<String> SORTABLE = Set.of("name", "createdAt", "updatedAt");

    private final LeadRepository repo;
    private final CustomerService customers;
    private final DealService deals;
    private final Names names;

    public LeadService(LeadRepository repo, CustomerService customers, DealService deals, Names names) {
        this.repo = repo;
        this.customers = customers;
        this.deals = deals;
        this.names = names;
    }

    /** @param status null = every status except CONVERTED (the "active" leads) */
    @Transactional(readOnly = true)
    public PageResponse<LeadResponse> list(CurrentUser user, String q, Status status, boolean includeConverted,
                                           UUID ownerId, int page, int size, String sort) {
        UUID owner = user.canSeeAll() ? ownerId : user.id();
        Set<Status> statuses;
        if (status != null) {
            statuses = EnumSet.of(status);
        } else if (includeConverted) {
            statuses = EnumSet.allOf(Status.class);
        } else {
            statuses = EnumSet.complementOf(EnumSet.of(Status.CONVERTED));
        }
        Page<Lead> result = repo.search(owner, statuses, Paging.like(q),
                Paging.of(page, size, sort, SORTABLE, Sort.by("createdAt").descending()));
        return new PageResponse<>(toResponses(result.getContent()), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Lead get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Lead create(CurrentUser user, LeadRequest req) {
        if (req.id() != null) {
            var existing = repo.findById(req.id());
            if (existing.isPresent()) {
                if (!canAccess(user, existing.get())) {
                    throw ApiException.conflict("error.badRequest");
                }
                return existing.get();
            }
        }
        Lead l = new Lead();
        if (req.id() != null) {
            l.setId(req.id());
        }
        apply(l, req);
        l.setStatus(req.status() == null || req.status() == Status.CONVERTED ? Status.NEW : req.status());
        l.setOwnerId(user.canSeeAll() && req.ownerId() != null ? req.ownerId() : user.id());
        return repo.saveAndFlush(l);
    }

    public Lead update(CurrentUser user, UUID id, LeadRequest req) {
        Lead l = findAccessible(user, id);
        if (req.version() != null && !req.version().equals(l.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        apply(l, req);
        if (req.status() != null) {
            setStatus(l, req.status());
        }
        if (user.canSeeAll() && req.ownerId() != null) {
            l.setOwnerId(req.ownerId());
        }
        return repo.saveAndFlush(l);
    }

    public Lead changeStatus(CurrentUser user, UUID id, Status status) {
        Lead l = findAccessible(user, id);
        setStatus(l, status);
        return repo.saveAndFlush(l);
    }

    public void delete(CurrentUser user, UUID id) {
        findAccessible(user, id).markDeleted();
    }

    /** Creates a customer from the lead (and optionally a deal) and marks the lead CONVERTED. */
    public ConvertResponse convert(CurrentUser user, UUID id, ConvertRequest req) {
        Lead l = findAccessible(user, id);
        if (l.getStatus() == Status.CONVERTED) {
            throw ApiException.conflict("error.lead.alreadyConverted");
        }
        Customer c = customers.create(user, new CustomerRequest(null, l.getName(), l.getCompany(), l.getEmail(),
                l.getPhone(), null, null, null, null, "India", null, null, l.getNotes(), l.getOwnerId(), null));

        UUID dealId = null;
        if (req != null && Boolean.TRUE.equals(req.createDeal())) {
            String title = Paging.blankToNull(req.dealTitle());
            if (title == null) {
                title = l.getCompany() != null ? l.getCompany() : l.getName();
            }
            BigDecimal amount = req.amount() == null ? BigDecimal.ZERO : req.amount();
            Deal d = deals.create(user, new DealRequest(null, c.getId(), title, amount, "INR", null, null,
                    l.getOwnerId(), null));
            dealId = d.getId();
        }
        l.setStatus(Status.CONVERTED);
        l.setConvertedCustomerId(c.getId());
        repo.saveAndFlush(l);
        return new ConvertResponse(toResponse(l), c.getId(), dealId);
    }

    @Transactional(readOnly = true)
    public LeadResponse toResponse(Lead l) {
        return toResponses(List.of(l)).get(0);
    }

    @Transactional(readOnly = true)
    public List<LeadResponse> toResponses(List<Lead> leads) {
        Map<UUID, String> u = names.users(Names.ids(leads, Lead::getOwnerId));
        return leads.stream().map(l -> LeadResponse.from(l, u)).toList();
    }

    private static void setStatus(Lead l, Status status) {
        // CONVERTED is only set by convert(), and a converted lead stays converted.
        if (status == Status.CONVERTED || l.getStatus() == Status.CONVERTED) {
            if (status != l.getStatus()) {
                throw ApiException.badRequest("error.lead.useConvert");
            }
            return;
        }
        l.setStatus(status);
    }

    private Lead findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id).filter(l -> canAccess(user, l))
                .orElseThrow(() -> ApiException.notFound("error.notFound.lead"));
    }

    private static boolean canAccess(CurrentUser user, Lead l) {
        return user.canSeeAll() || user.id().equals(l.getOwnerId());
    }

    private static void apply(Lead l, LeadRequest r) {
        l.setName(r.name().trim());
        l.setCompany(Paging.blankToNull(r.company()));
        String email = Paging.blankToNull(r.email());
        l.setEmail(email == null ? null : email.toLowerCase(Locale.ROOT));
        l.setPhone(Paging.blankToNull(r.phone()));
        l.setSource(r.source());
        l.setNotes(Paging.blankToNull(r.notes()));
    }
}
