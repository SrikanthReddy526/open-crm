package com.opencrm.deal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DealRepository extends JpaRepository<Deal, UUID> {

    @Query("""
            select d from Deal d
            where (:ownerId is null or d.ownerId = :ownerId)
              and (:customerId is null or d.customerId = :customerId)
              and d.stage in :stages
              and (:q = '' or lower(d.title) like :q escape '!')
            """)
    Page<Deal> search(@Param("ownerId") UUID ownerId, @Param("customerId") UUID customerId,
                      @Param("stages") Collection<Deal.Stage> stages, @Param("q") String q, Pageable pageable);

    /** Rows of [Stage, Long count, BigDecimal sum]. */
    @Query("""
            select d.stage, count(d), coalesce(sum(d.amount), 0)
            from Deal d where (:ownerId is null or d.ownerId = :ownerId)
            group by d.stage
            """)
    List<Object[]> pipeline(@Param("ownerId") UUID ownerId);

    @Query("""
            select coalesce(sum(d.amount), 0) from Deal d
            where (:ownerId is null or d.ownerId = :ownerId) and d.stage = com.opencrm.deal.Deal.Stage.WON
              and d.closedAt >= :since
            """)
    BigDecimal wonSince(@Param("ownerId") UUID ownerId, @Param("since") Instant since);

    @Query("""
            select count(d) from Deal d
            where (:ownerId is null or d.ownerId = :ownerId) and d.stage = com.opencrm.deal.Deal.Stage.WON
              and d.closedAt >= :since
            """)
    long wonCountSince(@Param("ownerId") UUID ownerId, @Param("since") Instant since);
}
