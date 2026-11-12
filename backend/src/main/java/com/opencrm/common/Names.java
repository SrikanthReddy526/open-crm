package com.opencrm.common;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.opencrm.customer.CustomerRepository;
import com.opencrm.user.UserRepository;

/**
 * Batch lookup of display names (customer name, user full name) so list responses can show
 * "Ravi Kumar" instead of a UUID without N+1 queries or extra calls from the app.
 */
@Component
@Transactional(readOnly = true)
public class Names {

    private final CustomerRepository customers;
    private final UserRepository users;

    public Names(CustomerRepository customers, UserRepository users) {
        this.customers = customers;
        this.users = users;
    }

    public Map<UUID, String> customers(Collection<UUID> ids) {
        Map<UUID, String> out = new HashMap<>();
        customers.findAllById(clean(ids)).forEach(c -> out.put(c.getId(), c.getName()));
        return out;
    }

    public Map<UUID, String> users(Collection<UUID> ids) {
        Map<UUID, String> out = new HashMap<>();
        users.findAllById(clean(ids)).forEach(u -> out.put(u.getId(), u.getFullName()));
        return out;
    }

    public String customer(UUID id) {
        return id == null ? null : customers(java.util.List.of(id)).get(id);
    }

    public String user(UUID id) {
        return id == null ? null : users(java.util.List.of(id)).get(id);
    }

    /** Collects the non-null ids that {@code getter} returns for each item. */
    public static <T> java.util.Set<UUID> ids(Collection<T> items, Function<T, UUID> getter) {
        java.util.Set<UUID> out = new java.util.HashSet<>();
        for (T item : items) {
            UUID id = getter.apply(item);
            if (id != null) {
                out.add(id);
            }
        }
        return out;
    }

    private static java.util.List<UUID> clean(Collection<UUID> ids) {
        return ids.stream().filter(Objects::nonNull).distinct().toList();
    }
}
