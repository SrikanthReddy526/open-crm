package com.opencrm.customer.dto;

import java.util.List;

/**
 * Result of a CSV import. Valid rows are saved; invalid rows are reported.
 * {@code row} is the line number in the file (header = line 1).
 */
public record CsvImportResult(int imported, int failed, List<RowError> errors) {

    public record RowError(long row, String message) {}
}
