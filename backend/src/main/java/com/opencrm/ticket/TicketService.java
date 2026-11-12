package com.opencrm.ticket;

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
import com.opencrm.security.CurrentUser;
import com.opencrm.ticket.Ticket.Priority;
import com.opencrm.ticket.Ticket.Status;
import com.opencrm.ticket.TicketDtos.CommentResponse;
import com.opencrm.ticket.TicketDtos.HistoryResponse;
import com.opencrm.ticket.TicketDtos.TicketRequest;
import com.opencrm.ticket.TicketDtos.TicketResponse;
import com.opencrm.ticket.TicketDtos.TicketStats;

/**
 * Support tickets.
 * <ul>
 *   <li>Admins and support agents see and manage all tickets, and can write internal notes.</li>
 *   <li>Field staff can raise tickets for their customers and see tickets they created or that are
 *       assigned to them (they never see internal notes).</li>
 * </ul>
 */
@Service
@Transactional
public class TicketService {

    public static final Set<Status> OPEN_STATUSES = EnumSet.of(Status.OPEN, Status.IN_PROGRESS, Status.ON_HOLD);
    private static final Set<String> SORTABLE = Set.of("createdAt", "updatedAt", "priority", "ticketNumber");

    private final TicketRepository repo;
    private final TicketCommentRepository comments;
    private final TicketHistoryRepository history;
    private final CustomerService customers;
    private final Names names;

    public TicketService(TicketRepository repo, TicketCommentRepository comments, TicketHistoryRepository history,
                         CustomerService customers, Names names) {
        this.repo = repo;
        this.comments = comments;
        this.history = history;
        this.customers = customers;
        this.names = names;
    }

    /**
     * @param statuses null/empty = all; the app sends OPEN,IN_PROGRESS,ON_HOLD for "open tickets"
     */
    @Transactional(readOnly = true)
    public PageResponse<TicketResponse> list(CurrentUser user, String q, Set<Status> statuses, Set<Priority> priorities,
                                             UUID assignedTo, boolean unassigned, UUID customerId,
                                             int page, int size, String sort) {
        String text = q == null ? "" : q.trim().replaceFirst("^#", "");
        long number = text.matches("\\d{1,18}") ? Long.parseLong(text) : -1;
        Page<Ticket> result = repo.search(user.canSeeAll() ? null : user.id(),
                statuses == null || statuses.isEmpty() ? EnumSet.allOf(Status.class) : statuses,
                priorities == null || priorities.isEmpty() ? EnumSet.allOf(Priority.class) : priorities,
                assignedTo, unassigned, customerId, Paging.like(text), number,
                Paging.of(page, size, sort, SORTABLE, Sort.by("createdAt").descending()));
        return new PageResponse<>(toResponses(result.getContent()), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Ticket get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Ticket create(CurrentUser user, TicketRequest req) {
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
        Ticket t = new Ticket();
        if (req.id() != null) {
            t.setId(req.id());
        }
        apply(t, req);
        t.setCreatedBy(user.id());
        if (user.canSeeAll()) {
            t.setAssignedTo(req.assignedTo());
        }
        t = repo.saveAndFlush(t);
        history.save(new TicketStatusChange(t.getId(), null, Status.OPEN, user.id()));
        return t;
    }

    /** Subject/description/priority/customer. Status and assignee have their own endpoints. */
    public Ticket update(CurrentUser user, UUID id, TicketRequest req) {
        Ticket t = findAccessible(user, id);
        if (!user.canSeeAll() && !user.id().equals(t.getCreatedBy())) {
            throw ApiException.forbidden();
        }
        if (req.version() != null && !req.version().equals(t.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        if (!req.customerId().equals(t.getCustomerId())) {
            customers.requireAccessible(user, req.customerId());
        }
        apply(t, req);
        return repo.saveAndFlush(t);
    }

    /** Support staff, or the field staff member the ticket is assigned to. Writes the status history. */
    public Ticket changeStatus(CurrentUser user, UUID id, Status status) {
        Ticket t = findAccessible(user, id);
        if (!user.canSeeAll() && !user.id().equals(t.getAssignedTo())) {
            throw ApiException.forbidden();
        }
        if (t.getStatus() != status) {
            history.save(new TicketStatusChange(t.getId(), t.getStatus(), status, user.id()));
            t.moveTo(status);
        }
        return repo.saveAndFlush(t);
    }

    public Ticket assign(CurrentUser user, UUID id, UUID userId) {
        if (!user.canSeeAll()) {
            throw ApiException.forbidden();
        }
        Ticket t = findAccessible(user, id);
        t.setAssignedTo(userId);
        return repo.saveAndFlush(t);
    }

    public void delete(CurrentUser user, UUID id) {
        if (!user.isAdmin()) {
            throw ApiException.forbidden();
        }
        findAccessible(user, id).markDeleted();
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> comments(CurrentUser user, UUID ticketId) {
        findAccessible(user, ticketId);
        List<TicketComment> list = user.canSeeAll()
                ? comments.findByTicketIdOrderByCreatedAtAsc(ticketId)
                : comments.findByTicketIdAndInternalFalseOrderByCreatedAtAsc(ticketId);
        Map<UUID, String> u = names.users(Names.ids(list, TicketComment::getAuthorId));
        return list.stream().map(c -> CommentResponse.from(c, u)).toList();
    }

    public CommentResponse addComment(CurrentUser user, UUID ticketId, String body, boolean internal) {
        findAccessible(user, ticketId);
        TicketComment c = comments.save(new TicketComment(ticketId, user.id(), body.trim(), internal && user.canSeeAll()));
        return CommentResponse.from(c, names.users(List.of(user.id())));
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> history(CurrentUser user, UUID ticketId) {
        findAccessible(user, ticketId);
        List<TicketStatusChange> list = history.findByTicketIdOrderByChangedAtAsc(ticketId);
        Map<UUID, String> u = names.users(Names.ids(list, TicketStatusChange::getChangedBy));
        return list.stream().map(h -> HistoryResponse.from(h, u)).toList();
    }

    @Transactional(readOnly = true)
    public TicketStats stats(CurrentUser user) {
        Map<Status, Long> byStatus = new EnumMap<>(Status.class);
        Map<Priority, Long> openByPriority = new EnumMap<>(Priority.class);
        for (Status s : Status.values()) {
            byStatus.put(s, 0L);
        }
        for (Priority p : Priority.values()) {
            openByPriority.put(p, 0L);
        }
        long open = 0;
        for (Object[] row : repo.stats(user.canSeeAll() ? null : user.id())) {
            Status s = (Status) row[0];
            Priority p = (Priority) row[1];
            long n = ((Number) row[2]).longValue();
            byStatus.merge(s, n, Long::sum);
            if (OPEN_STATUSES.contains(s)) {
                openByPriority.merge(p, n, Long::sum);
                open += n;
            }
        }
        long mine = repo.countAssigned(user.id(), OPEN_STATUSES);
        return new TicketStats(byStatus, openByPriority, open, openByPriority.get(Priority.URGENT), mine);
    }

    @Transactional(readOnly = true)
    public TicketResponse toResponse(Ticket t) {
        return toResponses(List.of(t)).get(0);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> toResponses(List<Ticket> list) {
        Map<UUID, String> c = names.customers(Names.ids(list, Ticket::getCustomerId));
        Set<UUID> userIds = Names.ids(list, Ticket::getAssignedTo);
        userIds.addAll(Names.ids(list, Ticket::getCreatedBy));
        Map<UUID, String> u = names.users(userIds);
        return list.stream().map(t -> TicketResponse.from(t, c, u)).toList();
    }

    private Ticket findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id).filter(t -> canAccess(user, t))
                .orElseThrow(() -> ApiException.notFound("error.notFound.ticket"));
    }

    private static boolean canAccess(CurrentUser user, Ticket t) {
        return user.canSeeAll() || user.id().equals(t.getCreatedBy()) || user.id().equals(t.getAssignedTo());
    }

    private static void apply(Ticket t, TicketRequest r) {
        t.setCustomerId(r.customerId());
        t.setSubject(r.subject().trim());
        t.setDescription(Paging.blankToNull(r.description()));
        t.setPriority(r.priority() == null ? Priority.MEDIUM : r.priority());
    }
}
