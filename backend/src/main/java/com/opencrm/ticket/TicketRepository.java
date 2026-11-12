package com.opencrm.ticket;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    /**
     * @param visibleTo null = all tickets; otherwise only tickets created by or assigned to this user
     * @param number    ticket number to match exactly (when the search text is a number), or -1
     */
    @Query("""
            select t from Ticket t
            where (:visibleTo is null or t.createdBy = :visibleTo or t.assignedTo = :visibleTo)
              and t.status in :statuses
              and t.priority in :priorities
              and (:assignedTo is null or t.assignedTo = :assignedTo)
              and (:unassigned = false or t.assignedTo is null)
              and (:customerId is null or t.customerId = :customerId)
              and (:q = '' or lower(t.subject) like :q escape '!' or t.ticketNumber = :number)
            """)
    Page<Ticket> search(@Param("visibleTo") UUID visibleTo,
                        @Param("statuses") Collection<Ticket.Status> statuses,
                        @Param("priorities") Collection<Ticket.Priority> priorities,
                        @Param("assignedTo") UUID assignedTo,
                        @Param("unassigned") boolean unassigned,
                        @Param("customerId") UUID customerId,
                        @Param("q") String q,
                        @Param("number") long number,
                        Pageable pageable);

    /** Rows of [Status, Priority, Long count]. */
    @Query("""
            select t.status, t.priority, count(t) from Ticket t
            where (:visibleTo is null or t.createdBy = :visibleTo or t.assignedTo = :visibleTo)
            group by t.status, t.priority
            """)
    List<Object[]> stats(@Param("visibleTo") UUID visibleTo);

    @Query("""
            select count(t) from Ticket t
            where t.assignedTo = :userId and t.status in :statuses
            """)
    long countAssigned(@Param("userId") UUID userId, @Param("statuses") Collection<Ticket.Status> statuses);
}
