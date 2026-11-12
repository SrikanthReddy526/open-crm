package com.opencrm.customer;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    /**
     * Search by name, company, phone, email or city.
     * {@code q} is an already-lowercased LIKE pattern ("%text%", escaped with '!'), or "" for no filter.
     */
    @Query("""
            select c from Customer c
            where (:allOwners = true or c.ownerId = :userId)
              and (:q = ''
                   or lower(c.name) like :q escape '!'
                   or lower(coalesce(c.company, '')) like :q escape '!'
                   or coalesce(c.phone, '') like :q escape '!'
                   or lower(coalesce(c.email, '')) like :q escape '!'
                   or lower(coalesce(c.city, '')) like :q escape '!')
            """)
    Page<Customer> search(@Param("allOwners") boolean allOwners,
                          @Param("userId") UUID userId,
                          @Param("q") String q,
                          Pageable pageable);

    /**
     * Customers within {@code radiusMeters} of a point, nearest first.
     * Returns rows of [UUID id, Double distanceMeters]. Uses the GiST index on customers.location.
     */
    @Query(value = """
            SELECT c.id, ST_Distance(c.location, CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)) AS distance
            FROM customers c
            WHERE c.deleted_at IS NULL
              AND c.location IS NOT NULL
              AND (:allOwners OR c.owner_id = :userId)
              AND ST_DWithin(c.location, CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography), :radius)
            ORDER BY distance
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findNearby(@Param("lat") double lat,
                              @Param("lng") double lng,
                              @Param("radius") double radiusMeters,
                              @Param("allOwners") boolean allOwners,
                              @Param("userId") UUID userId,
                              @Param("limit") int limit);

    /** Customers inside a map rectangle (uses the GiST index). */
    @Query(value = """
            SELECT c.* FROM customers c
            WHERE c.deleted_at IS NULL
              AND c.location IS NOT NULL
              AND (:allOwners OR c.owner_id = :userId)
              AND c.location && CAST(ST_MakeEnvelope(:west, :south, :east, :north, 4326) AS geography)
            ORDER BY c.name
            LIMIT :limit
            """, nativeQuery = true)
    List<Customer> findInArea(@Param("south") double south,
                              @Param("west") double west,
                              @Param("north") double north,
                              @Param("east") double east,
                              @Param("allOwners") boolean allOwners,
                              @Param("userId") UUID userId,
                              @Param("limit") int limit);

    // ---------- offline sync (native: includes soft-deleted rows) ----------

    @Query(value = """
            SELECT c.* FROM customers c
            WHERE c.deleted_at IS NULL AND c.updated_at > :since AND (:allOwners OR c.owner_id = :userId)
            ORDER BY c.updated_at
            """, nativeQuery = true)
    List<Customer> changedSince(@Param("since") java.time.Instant since,
                                @Param("allOwners") boolean allOwners,
                                @Param("userId") UUID userId);

    @Query(value = """
            SELECT c.id FROM customers c
            WHERE c.deleted_at IS NOT NULL AND c.deleted_at > :since AND (:allOwners OR c.owner_id = :userId)
            """, nativeQuery = true)
    List<UUID> deletedSince(@Param("since") java.time.Instant since,
                            @Param("allOwners") boolean allOwners,
                            @Param("userId") UUID userId);

    long countByOwnerId(UUID ownerId);
}
