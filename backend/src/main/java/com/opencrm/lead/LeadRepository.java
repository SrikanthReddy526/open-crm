package com.opencrm.lead;

import java.time.Instant;
import java.util.Collection;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    /** {@code q} is a lowercased, escaped LIKE pattern or "" (see Paging.like). */
    @Query("""
            select l from Lead l
            where (:ownerId is null or l.ownerId = :ownerId)
              and l.status in :statuses
              and (:q = ''
                   or lower(l.name) like :q escape '!'
                   or lower(coalesce(l.company, '')) like :q escape '!'
                   or coalesce(l.phone, '') like :q escape '!'
                   or lower(coalesce(l.email, '')) like :q escape '!')
            """)
    Page<Lead> search(@Param("ownerId") UUID ownerId, @Param("statuses") Collection<Lead.Status> statuses,
                      @Param("q") String q, Pageable pageable);

    @Query("select count(l) from Lead l where (:ownerId is null or l.ownerId = :ownerId) and l.createdAt >= :since")
    long countCreatedSince(@Param("ownerId") UUID ownerId, @Param("since") Instant since);
}
