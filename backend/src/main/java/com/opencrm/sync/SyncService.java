package com.opencrm.sync;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.opencrm.common.ApiException;
import com.opencrm.customer.CustomerRepository;
import com.opencrm.customer.CustomerService;
import com.opencrm.customer.dto.CustomerRequest;
import com.opencrm.customer.dto.CustomerResponse;
import com.opencrm.reminder.ReminderDtos.ReminderRequest;
import com.opencrm.reminder.ReminderRepository;
import com.opencrm.reminder.ReminderService;
import com.opencrm.security.CurrentUser;
import com.opencrm.sync.SyncDtos.Deleted;
import com.opencrm.sync.SyncDtos.Mutation;
import com.opencrm.sync.SyncDtos.MutationResult;
import com.opencrm.sync.SyncDtos.Op;
import com.opencrm.sync.SyncDtos.PullResponse;
import com.opencrm.sync.SyncDtos.ResultStatus;
import com.opencrm.visit.VisitDtos.VisitRequest;
import com.opencrm.visit.VisitRepository;
import com.opencrm.visit.VisitService;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import tools.jackson.databind.ObjectMapper;

/**
 * Offline sync for phones.
 * <p><b>Pull</b>: returns records changed since the last pull (customers I can see, my visits, my reminders)
 * plus ids deleted since then.
 * <p><b>Push</b>: applies changes made offline, one by one, each in its own transaction so one bad change does not
 * block the rest. Every applied change is recorded in processed_mutations, so re-sending is harmless.
 * A change based on an old version is not applied: the server copy is returned as CONFLICT and the
 * device shows it to the user ("server wins, your change was kept as a draft").
 */
@Service
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);

    /** Pull a little before "since" so rows whose transaction committed late are not missed (duplicates are harmless). */
    private static final long OVERLAP_SECONDS = 30;
    private static final Set<String> ENTITIES = Set.of("customer", "visit", "reminder");

    private final CustomerService customers;
    private final CustomerRepository customerRepo;
    private final VisitService visits;
    private final VisitRepository visitRepo;
    private final ReminderService reminders;
    private final ReminderRepository reminderRepo;
    private final ProcessedMutationRepository processed;
    private final TransactionTemplate tx;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final MessageSource messages;

    public SyncService(CustomerService customers, CustomerRepository customerRepo, VisitService visits,
                       VisitRepository visitRepo, ReminderService reminders, ReminderRepository reminderRepo,
                       ProcessedMutationRepository processed, PlatformTransactionManager txManager,
                       ObjectMapper mapper, Validator validator, MessageSource messages) {
        this.customers = customers;
        this.customerRepo = customerRepo;
        this.visits = visits;
        this.visitRepo = visitRepo;
        this.reminders = reminders;
        this.reminderRepo = reminderRepo;
        this.processed = processed;
        this.tx = new TransactionTemplate(txManager);
        this.mapper = mapper;
        this.validator = validator;
        this.messages = messages;
    }

    // ------------------------------------------------------------------ pull

    @Transactional(readOnly = true)
    public PullResponse pull(CurrentUser user, Instant since) {
        Instant serverTime = Instant.now();
        boolean full = since == null;
        Instant from = full ? Instant.EPOCH : since.minus(OVERLAP_SECONDS, ChronoUnit.SECONDS);
        boolean all = user.canSeeAll();

        List<CustomerResponse> changedCustomers = customerRepo.changedSince(from, all, user.id()).stream()
                .map(CustomerResponse::from).toList();
        var changedVisits = visits.toResponses(visitRepo.changedSince(user.id(), from));
        var changedReminders = reminders.toResponses(reminderRepo.changedSince(user.id(), from));
        Deleted deleted = full
                ? new Deleted(List.of(), List.of(), List.of())
                : new Deleted(customerRepo.deletedSince(from, all, user.id()),
                        visitRepo.deletedSince(user.id(), from),
                        reminderRepo.deletedSince(user.id(), from));
        return new PullResponse(serverTime, full, changedCustomers, changedVisits, changedReminders, deleted);
    }

    // ------------------------------------------------------------------ push

    public List<MutationResult> push(CurrentUser user, List<Mutation> mutations) {
        List<MutationResult> results = new ArrayList<>(mutations.size());
        for (Mutation m : mutations) {
            results.add(applyOne(user, m));
        }
        return results;
    }

    private MutationResult applyOne(CurrentUser user, Mutation m) {
        String entity = m.entity().toLowerCase(java.util.Locale.ROOT);
        if (!ENTITIES.contains(entity)) {
            return new MutationResult(m.mutationId(), ResultStatus.REJECTED, text("error.sync.unknownEntity"), null);
        }
        var done = processed.findById(m.mutationId());
        if (done.isPresent()) {
            if (!done.get().getUserId().equals(user.id())) {
                return new MutationResult(m.mutationId(), ResultStatus.REJECTED, text("error.badRequest"), null);
            }
            return new MutationResult(m.mutationId(), ResultStatus.DUPLICATE, null, current(user, entity, m.id()));
        }
        try {
            Object data = tx.execute(status -> {
                Object result = apply(user, entity, m);
                processed.save(new ProcessedMutation(m.mutationId(), user.id(), entity, m.id()));
                return result;
            });
            return new MutationResult(m.mutationId(), ResultStatus.APPLIED, null, data);
        } catch (ApiException e) {
            if (e.getStatus() == HttpStatus.CONFLICT && "error.conflict.version".equals(e.getMessageKey())) {
                return new MutationResult(m.mutationId(), ResultStatus.CONFLICT, text(e.getMessageKey()),
                        current(user, entity, m.id()));
            }
            return new MutationResult(m.mutationId(), ResultStatus.REJECTED, text(e.getMessageKey(), e.getArgs()),
                    current(user, entity, m.id()));
        } catch (ObjectOptimisticLockingFailureException e) {
            return new MutationResult(m.mutationId(), ResultStatus.CONFLICT, text("error.conflict.version"),
                    current(user, entity, m.id()));
        } catch (InvalidData e) {
            return new MutationResult(m.mutationId(), ResultStatus.REJECTED, e.getMessage(), null);
        } catch (RuntimeException e) {
            log.warn("Sync mutation {} ({} {}) failed", m.mutationId(), entity, m.op(), e);
            return new MutationResult(m.mutationId(), ResultStatus.REJECTED, text("error.unexpected"), null);
        }
    }

    private Object apply(CurrentUser user, String entity, Mutation m) {
        return switch (entity) {
            case "customer" -> switch (m.op()) {
                case CREATE -> CustomerResponse.from(customers.create(user, read(m, CustomerRequest.class, false)));
                case UPDATE -> CustomerResponse.from(customers.update(user, m.id(), read(m, CustomerRequest.class, true)));
                case DELETE -> {
                    if (!user.isAdmin()) {
                        throw ApiException.forbidden();
                    }
                    checkVersion(m, customers.get(user, m.id()).getVersion());
                    customers.delete(user, m.id());
                    yield null;
                }
            };
            case "visit" -> switch (m.op()) {
                case CREATE -> visits.toResponse(visits.create(user, read(m, VisitRequest.class, false)));
                case UPDATE -> visits.toResponse(visits.update(user, m.id(), read(m, VisitRequest.class, true)));
                case DELETE -> {
                    checkVersion(m, visits.get(user, m.id()).getVersion());
                    visits.delete(user, m.id());
                    yield null;
                }
            };
            default -> switch (m.op()) { // reminder
                case CREATE -> reminders.toResponse(reminders.create(user, read(m, ReminderRequest.class, false)));
                case UPDATE -> reminders.toResponse(reminders.update(user, m.id(), read(m, ReminderRequest.class, true)));
                case DELETE -> {
                    checkVersion(m, reminders.get(user, m.id()).getVersion());
                    reminders.delete(user, m.id());
                    yield null;
                }
            };
        };
    }

    /** Builds the normal request DTO from the mutation (id and version come from the mutation itself). */
    private <T> T read(Mutation m, Class<T> type, boolean withVersion) {
        Map<String, Object> data = new HashMap<>(m.data() == null ? Map.of() : m.data());
        data.put("id", m.id());
        data.put("version", withVersion ? m.baseVersion() : null);
        T req;
        try {
            req = mapper.convertValue(data, type);
        } catch (IllegalArgumentException | tools.jackson.core.JacksonException e) {
            throw new InvalidData(text("error.badRequest"));
        }
        Set<ConstraintViolation<T>> violations = validator.validate(req);
        if (!violations.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (ConstraintViolation<T> v : violations) {
                String field = v.getPropertyPath().toString();
                parts.add(messages.getMessage("field." + field, null, field, LocaleContextHolder.getLocale())
                        + ": " + v.getMessage());
            }
            throw new InvalidData(String.join("; ", parts));
        }
        return req;
    }

    private static void checkVersion(Mutation m, Long current) {
        if (m.baseVersion() != null && !m.baseVersion().equals(current)) {
            throw ApiException.conflict("error.conflict.version");
        }
    }

    /** The server's current copy, or null if it is gone / not visible. */
    private Object current(CurrentUser user, String entity, UUID id) {
        try {
            return switch (entity) {
                case "customer" -> CustomerResponse.from(customers.get(user, id));
                case "visit" -> visits.toResponse(visits.get(user, id));
                default -> reminders.toResponse(reminders.get(user, id));
            };
        } catch (ApiException e) {
            return null;
        }
    }

    private String text(String key, Object... args) {
        return messages.getMessage(key, args, key, LocaleContextHolder.getLocale());
    }

    /** The mutation's data could not be turned into a valid request. */
    private static final class InvalidData extends RuntimeException {
        InvalidData(String message) {
            super(message, null, false, false);
        }
    }
}
