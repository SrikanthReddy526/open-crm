package com.opencrm.ticket;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketHistoryRepository extends JpaRepository<TicketStatusChange, Long> {
    List<TicketStatusChange> findByTicketIdOrderByChangedAtAsc(UUID ticketId);
}
