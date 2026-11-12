package com.opencrm.customer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.opencrm.common.ApiException;
import com.opencrm.customer.dto.CustomerRequest;
import com.opencrm.customer.dto.CustomerResponse;
import com.opencrm.customer.dto.NearbyCustomer;
import com.opencrm.security.CurrentUser;

@Service
@Transactional
public class CustomerService {

    public static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> SORTABLE = Set.of("name", "city", "createdAt", "updatedAt");

    private final CustomerRepository repo;

    public CustomerService(CustomerRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public Page<Customer> search(CurrentUser user, String q, int page, int size, String sort) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), clamp(size, 1, MAX_PAGE_SIZE), parseSort(sort));
        return repo.search(user.canSeeAllCustomers(), user.id(), likePattern(q), pageable);
    }

    @Transactional(readOnly = true)
    public Customer get(CurrentUser user, UUID id) {
        return findAccessible(user, id);
    }

    public Customer create(CurrentUser user, CustomerRequest req) {
        validateCoordinates(req);

        // Offline clients may retry a create they already sent: return the existing record.
        if (req.id() != null) {
            var existing = repo.findById(req.id());
            if (existing.isPresent()) {
                if (!canAccess(user, existing.get())) {
                    throw ApiException.conflict("error.badRequest");
                }
                return existing.get();
            }
        }

        Customer c = new Customer();
        if (req.id() != null) {
            c.setId(req.id());
        }
        apply(c, req);
        c.setCreatedBy(user.id());
        c.setOwnerId(user.canSeeAllCustomers() && req.ownerId() != null ? req.ownerId() : user.id());
        return repo.saveAndFlush(c);
    }

    public Customer update(CurrentUser user, UUID id, CustomerRequest req) {
        Customer c = findAccessible(user, id);
        if (req.version() != null && !req.version().equals(c.getVersion())) {
            throw ApiException.conflict("error.conflict.version");
        }
        validateCoordinates(req);
        apply(c, req);
        if (user.canSeeAllCustomers() && req.ownerId() != null) {
            c.setOwnerId(req.ownerId());
        }
        return repo.saveAndFlush(c); // flush so the response carries the new version
    }

    public void delete(CurrentUser user, UUID id) {
        findAccessible(user, id).markDeleted();
    }

    @Transactional(readOnly = true)
    public List<NearbyCustomer> nearby(CurrentUser user, double lat, double lng, double radiusKm, int limit) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw ApiException.badRequest("error.badRequest");
        }
        double radiusMeters = clamp(radiusKm, 0.1, 100) * 1000;
        List<Object[]> rows = repo.findNearby(lat, lng, radiusMeters, user.canSeeAllCustomers(), user.id(),
                clamp(limit, 1, 200));

        Map<UUID, Double> distances = new HashMap<>();
        List<UUID> ids = new ArrayList<>();
        for (Object[] row : rows) {
            UUID id = (UUID) row[0];
            ids.add(id);
            distances.put(id, ((Number) row[1]).doubleValue());
        }
        Map<UUID, Customer> byId = repo.findAllById(ids).stream()
                .collect(Collectors.toMap(Customer::getId, Function.identity()));
        return ids.stream()
                .filter(byId::containsKey)
                .map(id -> new NearbyCustomer(CustomerResponse.from(byId.get(id)), distances.get(id)))
                .toList();
    }

    /** Customers inside the visible map area (max 500, so the map stays fast). */
    @Transactional(readOnly = true)
    public List<Customer> inArea(CurrentUser user, double south, double west, double north, double east, int limit) {
        if (south < -90 || north > 90 || south > north || west < -180 || east > 180 || west > east) {
            throw ApiException.badRequest("error.badRequest");
        }
        return repo.findInArea(south, west, north, east, user.canSeeAllCustomers(), user.id(), clamp(limit, 1, 500));
    }

    /** Throws 404 unless the user may see this customer. Used by visits, deals and tickets. */
    @Transactional(readOnly = true)
    public Customer requireAccessible(CurrentUser user, UUID id) {
        if (id == null) {
            throw ApiException.notFound("error.notFound.customer");
        }
        return findAccessible(user, id);
    }

    // ---------- helpers ----------

    private Customer findAccessible(CurrentUser user, UUID id) {
        return repo.findById(id)
                .filter(c -> canAccess(user, c))
                .orElseThrow(() -> ApiException.notFound("error.notFound.customer"));
    }

    private static boolean canAccess(CurrentUser user, Customer c) {
        return user.canSeeAllCustomers() || user.id().equals(c.getOwnerId());
    }

    private static void validateCoordinates(CustomerRequest req) {
        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw ApiException.badRequest("error.customer.coordinatesPair");
        }
    }

    private static void apply(Customer c, CustomerRequest r) {
        c.setName(r.name().trim());
        c.setCompany(blankToNull(r.company()));
        c.setEmail(blankToNull(r.email()) == null ? null : r.email().trim().toLowerCase(Locale.ROOT));
        c.setPhone(blankToNull(r.phone()));
        c.setAddressLine(blankToNull(r.addressLine()));
        c.setCity(blankToNull(r.city()));
        c.setState(blankToNull(r.state()));
        c.setPostalCode(blankToNull(r.postalCode()));
        c.setCountry(blankToNull(r.country()));
        c.setLatitude(r.latitude());
        c.setLongitude(r.longitude());
        c.setNotes(blankToNull(r.notes()));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Lowercased "%text%" with LIKE wildcards escaped using '!', or "" for no filter. */
    static String likePattern(String q) {
        if (q == null || q.isBlank()) {
            return "";
        }
        String escaped = q.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    static Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by("name");
        }
        String[] parts = sort.split(",");
        String field = SORTABLE.contains(parts[0]) ? parts[0] : "name";
        boolean desc = parts.length > 1 && parts[1].equalsIgnoreCase("desc");
        return desc ? Sort.by(field).descending() : Sort.by(field).ascending();
    }
}
