package com.opencrm.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.config.AppProperties;
import com.opencrm.customer.CustomerRepository;
import com.opencrm.deal.DealDtos.StageSummary;
import com.opencrm.deal.DealRepository;
import com.opencrm.deal.DealService;
import com.opencrm.lead.LeadRepository;
import com.opencrm.reminder.ReminderRepository;
import com.opencrm.reminder.ReminderService;
import com.opencrm.reminder.ReminderService.Due;
import com.opencrm.security.CurrentUser;
import com.opencrm.ticket.Ticket;
import com.opencrm.ticket.TicketDtos.TicketStats;
import com.opencrm.ticket.TicketService;
import com.opencrm.visit.VisitRepository;

/**
 * Home screen numbers. Field staff get numbers for their own records only.
 * Reminder counts are always "my" reminders.
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    public record Summary(
            long customers,
            long openTickets, long urgentTickets, long myOpenTickets, Map<Ticket.Status, Long> ticketsByStatus,
            long remindersToday, long remindersOverdue,
            BigDecimal pipelineValue, long pipelineCount, List<StageSummary> pipeline,
            BigDecimal wonThisMonth, long wonThisMonthCount,
            long newLeadsThisWeek,
            long visitsToday) {}

    private final CustomerRepository customers;
    private final TicketService tickets;
    private final ReminderRepository reminders;
    private final ReminderService reminderService;
    private final DealService deals;
    private final DealRepository dealRepo;
    private final LeadRepository leads;
    private final VisitRepository visits;
    private final ZoneId zone;

    public DashboardController(CustomerRepository customers, TicketService tickets, ReminderRepository reminders,
                               ReminderService reminderService, DealService deals, DealRepository dealRepo,
                               LeadRepository leads, VisitRepository visits, AppProperties props) {
        this.customers = customers;
        this.tickets = tickets;
        this.reminders = reminders;
        this.reminderService = reminderService;
        this.deals = deals;
        this.dealRepo = dealRepo;
        this.leads = leads;
        this.visits = visits;
        this.zone = props.zone();
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public Summary summary(@AuthenticationPrincipal Jwt jwt) {
        CurrentUser user = CurrentUser.from(jwt);
        UUID scope = user.canSeeAll() ? null : user.id();

        TicketStats ts = tickets.stats(user);
        Instant[] today = reminderService.range(Due.TODAY);
        Instant[] overdue = reminderService.range(Due.OVERDUE);

        List<StageSummary> pipeline = deals.pipeline(user);
        BigDecimal openValue = BigDecimal.ZERO;
        long openCount = 0;
        for (StageSummary s : pipeline) {
            if (!s.stage().isClosed()) {
                openValue = openValue.add(s.totalAmount());
                openCount += s.count();
            }
        }

        Instant startOfToday = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        Instant startOfMonth = LocalDate.now(zone).withDayOfMonth(1).atStartOfDay(zone).toInstant();
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        return new Summary(
                scope == null ? customers.count() : customers.countByOwnerId(scope),
                ts.open(), ts.urgentOpen(), ts.assignedToMeOpen(), ts.byStatus(),
                reminders.countPending(user.id(), today[0], today[1]),
                reminders.countPending(user.id(), overdue[0], overdue[1]),
                openValue, openCount, pipeline,
                dealRepo.wonSince(scope, startOfMonth), dealRepo.wonCountSince(scope, startOfMonth),
                leads.countCreatedSince(scope, weekAgo),
                visits.countSince(scope, startOfToday));
    }
}
