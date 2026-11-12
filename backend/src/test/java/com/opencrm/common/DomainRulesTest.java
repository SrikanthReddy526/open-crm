package com.opencrm.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.opencrm.deal.Deal;
import com.opencrm.reminder.Reminder;
import com.opencrm.ticket.Ticket;

/** Small business rules that don't need a database. */
class DomainRulesTest {

    @Test
    void pagingClampsSizeAndWhitelistsSort() {
        Pageable p = Paging.of(-3, 10_000, "passwordHash,desc", Set.of("name"), Sort.by("name"));
        assertEquals(0, p.getPageNumber());
        assertEquals(Paging.MAX_PAGE_SIZE, p.getPageSize());
        assertEquals(Sort.by("name"), p.getSort());
        assertEquals(Sort.by("amount").descending(),
                Paging.of(0, 20, "amount,desc", Set.of("amount"), Sort.unsorted()).getSort());
    }

    @Test
    void likeEscapesWildcards() {
        assertEquals("", Paging.like(null));
        assertEquals("%50!%!_off%", Paging.like(" 50%_OFF "));
    }

    @Test
    void dealClosedAtFollowsStage() {
        Deal d = new Deal();
        d.moveTo(Deal.Stage.PROPOSAL);
        assertNull(d.getClosedAt());
        d.moveTo(Deal.Stage.WON);
        assertNotNull(d.getClosedAt());
        d.moveTo(Deal.Stage.NEGOTIATION);
        assertNull(d.getClosedAt(), "reopening clears the close date");
    }

    @Test
    void ticketResolvedAtFollowsStatus() {
        Ticket t = new Ticket();
        t.moveTo(Ticket.Status.RESOLVED);
        var resolved = t.getResolvedAt();
        assertNotNull(resolved);
        t.moveTo(Ticket.Status.CLOSED);
        assertEquals(resolved, t.getResolvedAt(), "closing keeps the original resolve time");
        t.moveTo(Ticket.Status.OPEN);
        assertNull(t.getResolvedAt());
    }

    @Test
    void reminderCompletedAtFollowsStatus() {
        Reminder r = new Reminder();
        r.changeStatus(Reminder.Status.DONE);
        assertNotNull(r.getCompletedAt());
        r.changeStatus(Reminder.Status.PENDING);
        assertNull(r.getCompletedAt());
    }
}
