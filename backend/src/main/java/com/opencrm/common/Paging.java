package com.opencrm.common;

import java.util.Locale;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/** Shared helpers for list endpoints: safe paging/sorting and LIKE search patterns. */
public final class Paging {

    public static final int MAX_PAGE_SIZE = 100;

    private Paging() {}

    /** Page request with a size clamp and a whitelist of sortable fields ("field,asc|desc"). */
    public static Pageable of(int page, int size, String sort, Set<String> sortable, Sort fallback) {
        return PageRequest.of(Math.max(page, 0), clamp(size, 1, MAX_PAGE_SIZE), sort(sort, sortable, fallback));
    }

    static Sort sort(String sort, Set<String> sortable, Sort fallback) {
        if (sort == null || sort.isBlank()) {
            return fallback;
        }
        String[] parts = sort.split(",");
        if (!sortable.contains(parts[0])) {
            return fallback;
        }
        boolean desc = parts.length > 1 && parts[1].equalsIgnoreCase("desc");
        return desc ? Sort.by(parts[0]).descending() : Sort.by(parts[0]).ascending();
    }

    /** Lowercased "%text%" with LIKE wildcards escaped using '!', or "" for no filter. */
    public static String like(String q) {
        if (q == null || q.isBlank()) {
            return "";
        }
        String escaped = q.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    public static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    public static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
