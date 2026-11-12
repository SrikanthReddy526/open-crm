package com.opencrm.reminder;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import com.opencrm.config.AppProperties;
import com.opencrm.customer.CustomerService;
import com.opencrm.deal.DealService;
import com.opencrm.lead.LeadService;
import com.opencrm.reminder.Reminder.Status;
import com.opencrm.reminder.ReminderDtos.ReminderRequest;
import com.opencrm.reminder.ReminderDtos.ReminderResponse;
import com.opencrm.security.CurrentUser;

/**
 * Follow-up reminders. Everyone sees their own reminders; admins and support agents can also
 * look at (and assign) other people's reminders.
 */
@Service
@Transactional
public class ReminderService {

    public enum Due { ALL, OVERDUE, TODAY, WEEK, UPCOMING }

    private static final Instant MIN_TIME = Instant.parse("2000-01-01T00:00:00Z");
    private static final Instant MAX_TIME = Instant.parse("2100-01-01T00:00:00Z");

    private final ReminderRepository repo;
    private final CustomerService customers;
    private final LeadService leads;
    private final DealService deals;
    private final Names names;
    private final ZoneId zone;

    public ReminderService(ReminderRepository repo, CustomerService customers, LeadService leads, DealService deals,
                           Names names, AppProperties props) {
        this.repo = repo;
        this.customers = customers;
        this.leads = leads;
        this.deals = deals;
        this.names = names;
        this.zone = props.zone();
    }

    /**
     * @param everyone admins/support only: list all users' reminders (or {@code assignedTo}'s) instead of just mine
     * @param status   null = all statuses
     */
    @Transactional(readOnly = true)
    public PageResponse<ReminderResponse> list(CurrentUser user, Status status, Due due, boolean everyone,
                                               UUID assignedTo, UUID customerId, UUID leadId, UUID dealId,
                                               int page, int size) {
        UUID who = user.id();
        if (user.canSeeAll() && (everyone || assignedTo != null)) {
            who = assignedTo; // null = everyone
        }
        Set<Status> statuses = status == null ? EnumSet.allOf(Status.class) : EnumSet.of(status);
        Instant[] range = range(due == null ? Due.ALL : due);
        Page<Reminder> result = repo.search(who, statuses, range[0], range[1], customerId, leadId, dealId,
                Paging.of(page, size, null, Set.of(), Sort.by("dueAt").ascending()));
        return new PageResponse<>(toResponses(result.getContent()), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    /** [from, to) for a due filter, in the business time zone. */
    public Instant[] range(Due due) {
        Instant now = Instant.now();
        Instant startOfToday = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        Instant startOfTomorrow = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant();
        return switch (due) {
            case OVERDUE -> new Instant[] {MIN_TIME, now};
            case TODAY -> new Instant[] {startOfToday, startOfTomorrow};
            case WEEK -> new Instant[] {startOfToday, LocalDate.now(zone).plusDays(7).atStartOfDay(zone).toInstant()};
            case UPCOMING -> new Instant[] {now, MAX_TIME};
            case ALL -> new Instant[] {MIN_TIME, MAX_TIME};
        };
    }

    @Transactional(readOnly = true)
    public Reminder get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Reminder create(CurrentUser user, ReminderRequest req) {
        if (req.id() != null) {
            var existing = repo.findById(req.id());
            if (existing.isPresent()) {
                if (!canAccess(user, existing.get())) {
                    throw ApiException.conflict("error.badRequest");
                }
                return existing.get();
            }
        }
        Reminder r = new Reminder();
        if (req.id() != null) {
            r.setId(req.id());
        }
        apply(user, r, req);
        r.setAssignedTo(user.canSeeAll() && req.assignedTo() != null ? req.assignedTo() : user.id());
        if (req.status() != null) {
            r.changeStatus(req.status());
        }
        return repo.saveAndFlush(r);
    }

    public Reminder update(CurrentUser user, UUID id, ReminderRequest req) {
        Reminder r = findAccessible(user, id);
        if (req.version() != null && !req.version().equals(r.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        apply(user, r, req);
        if (req.status() != null) {
            r.changeStatus(req.status());
        }
        if (user.canSeeAll() && req.assignedTo() != null) {
            r.setAssignedTo(req.assignedTo());
        }
        return repo.saveAndFlush(r);
    }

    public Reminder complete(CurrentUser user, UUID id) {
        Reminder r = findAccessible(user, id);
        r.changeStatus(Status.DONE);
        return repo.saveAndFlush(r);
    }

    /** Moves the due time and makes the reminder pending again. */
    public Reminder snooze(CurrentUser user, UUID id, Instant until) {
        Reminder r = findAccessible(user, id);
        if (until.isBefore(Instant.now())) {
            throw ApiException.badRequest("error.reminder.snoozePast");
        }
        r.setDueAt(until);
        r.changeStatus(Status.PENDING);
        return repo.saveAndFlush(r);
    }

    public void delete(CurrentUser user, UUID id) {
        findAccessible(user, id).markDeleted();
    }

    @Transactional(readOnly = true)
    public ReminderResponse toResponse(Reminder r) {
        return toResponses(List.of(r)).get(0);
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> toResponses(List<Reminder> list) {
        Map<UUID, String> u = names.users(Names.ids(list, Reminder::getAssignedTo));
        Map<UUID, String> c = names.customers(Names.ids(list, Reminder::getCustomerId));
        return list.stream().map(r -> ReminderResponse.from(r, u, c)).toList();
    }

    private Reminder findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id).filter(r -> canAccess(user, r))
                .orElseThrow(() -> ApiException.notFound("error.notFound.reminder"));
    }

    private static boolean canAccess(CurrentUser user, Reminder r) {
        return user.canSeeAll() || r.getAssignedTo().equals(user.id());
    }

    private void apply(CurrentUser user, Reminder r, ReminderRequest req) {
        int links = (req.customerId() != null ? 1 : 0) + (req.leadId() != null ? 1 : 0) + (req.dealId() != null ? 1 : 0);
        if (links > 1) {
            throw ApiException.badRequest("error.reminder.oneLink");
        }
        // The linked record must exist and be visible to this user.
        if (req.customerId() != null && !req.customerId().equals(r.getCustomerId())) {
            customers.requireAccessible(user, req.customerId());
        }
        if (req.leadId() != null && !req.leadId().equals(r.getLeadId())) {
            leads.get(user, req.leadId());
        }
        if (req.dealId() != null && !req.dealId().equals(r.getDealId())) {
            deals.get(user, req.dealId());
        }
        r.setTitle(req.title().trim());
        r.setDescription(Paging.blankToNull(req.description()));
        r.setDueAt(req.dueAt());
        r.setCustomerId(req.customerId());
        r.setLeadId(req.leadId());
        r.setDealId(req.dealId());
    }
}
