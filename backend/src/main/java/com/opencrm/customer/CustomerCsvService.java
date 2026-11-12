package com.opencrm.customer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.DirectFieldBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.beanvalidation.SpringValidatorAdapter;
import org.springframework.web.multipart.MultipartFile;

import com.opencrm.common.ApiException;
import com.opencrm.customer.dto.CsvImportResult;
import com.opencrm.customer.dto.CsvImportResult.RowError;
import com.opencrm.customer.dto.CustomerRequest;
import com.opencrm.security.CurrentUser;

/**
 * CSV import/export. Files are UTF-8; export writes a BOM so Excel shows Telugu text correctly.
 */
@Service
public class CustomerCsvService {

    public static final List<String> HEADERS = List.of(
            "name", "company", "email", "phone", "address_line", "city", "state",
            "postal_code", "country", "latitude", "longitude", "notes");

    static final int MAX_ROWS = 5000;
    static final int MAX_REPORTED_ERRORS = 200;
    private static final int EXPORT_PAGE_SIZE = 100;
    private static final Pattern PHONE_LIKE = Pattern.compile("^[0-9+()\\-\\s]*$");

    private final CustomerService customers;
    private final SpringValidatorAdapter validator;
    private final MessageSource messages;

    public CustomerCsvService(CustomerService customers, jakarta.validation.Validator validator, MessageSource messages) {
        this.customers = customers;
        this.validator = new SpringValidatorAdapter(validator);
        this.messages = messages;
    }

    // ---------------- EXPORT ----------------

    @Transactional(readOnly = true)
    public void export(CurrentUser user, String q, Writer out) throws IOException {
        out.write('﻿'); // BOM for Excel
        CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.builder()
                .setHeader(HEADERS.toArray(String[]::new)).get());
        int page = 0;
        Page<Customer> batch;
        do {
            batch = customers.search(user, q, page++, EXPORT_PAGE_SIZE, "name,asc");
            for (Customer c : batch) {
                printer.printRecord(safe(c.getName()), safe(c.getCompany()), safe(c.getEmail()), safe(c.getPhone()),
                        safe(c.getAddressLine()), safe(c.getCity()), safe(c.getState()), safe(c.getPostalCode()),
                        safe(c.getCountry()), plain(c.getLatitude()), plain(c.getLongitude()), safe(c.getNotes()));
            }
        } while (batch.hasNext());
        printer.flush();
    }

    public void writeTemplate(Writer out) throws IOException {
        out.write('﻿');
        CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.builder()
                .setHeader(HEADERS.toArray(String[]::new)).get());
        printer.printRecord("Ravi Kumar", "Sri Sai Traders", "ravi@example.com", "+91 98765 43210",
                "12-3-45, MG Road", "Vijayawada", "Andhra Pradesh", "520001", "India",
                "16.506174", "80.648015", "Prefers morning visits");
        printer.flush();
    }

    /** Prevents spreadsheet formula injection (a cell starting with = + - @ runs as a formula in Excel). */
    static String safe(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        char first = value.charAt(0);
        boolean risky = first == '=' || first == '@' || first == '\t' || first == '\r'
                || ((first == '+' || first == '-') && !PHONE_LIKE.matcher(value).matches());
        return risky ? "'" + value : value;
    }

    private static String plain(BigDecimal d) {
        return d == null ? null : d.toPlainString();
    }

    // ---------------- IMPORT ----------------

    /** Saves every valid row and reports the invalid ones (row = line number, header is line 1). */
    @Transactional
    public CsvImportResult importCsv(CurrentUser user, MultipartFile file) {
        String content;
        try {
            content = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw ApiException.badRequest("error.csv.invalid", e.getMessage());
        }
        if (content.startsWith("﻿")) {
            content = content.substring(1);
        }
        if (content.isBlank()) {
            throw ApiException.badRequest("error.csv.empty");
        }

        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader().setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true).setTrim(true)
                .setIgnoreEmptyLines(true).setAllowMissingColumnNames(true)
                .get();

        int imported = 0;
        int failed = 0;
        List<RowError> errors = new ArrayList<>();

        try (CSVParser parser = CSVParser.parse(content, format)) {
            Map<String, String> columns = new HashMap<>(); // normalized name -> header as written
            for (String h : parser.getHeaderNames()) {
                columns.put(normalize(h), h);
            }
            long row = 1;
            for (CSVRecord record : parser) {
                row++;
                if (row - 1 > MAX_ROWS) {
                    throw ApiException.badRequest("error.csv.tooManyRows", MAX_ROWS);
                }
                try {
                    CustomerRequest req = toRequest(record, columns);
                    List<String> problems = validate(req);
                    if (problems.isEmpty()) {
                        customers.create(user, req);
                        imported++;
                        continue;
                    }
                    failed++;
                    addError(errors, row, String.join("; ", problems));
                } catch (InvalidCell e) {
                    failed++;
                    addError(errors, row, text("error.csv.invalidNumber", e.column));
                }
            }
        } catch (IOException | UncheckedIOException | IllegalArgumentException | IllegalStateException e) {
            throw ApiException.badRequest("error.csv.invalid", e.getMessage());
        }
        return new CsvImportResult(imported, failed, errors);
    }

    private CustomerRequest toRequest(CSVRecord r, Map<String, String> columns) {
        return new CustomerRequest(null,
                cell(r, columns, "name"), cell(r, columns, "company"), cell(r, columns, "email"),
                cell(r, columns, "phone"), cell(r, columns, "address_line"), cell(r, columns, "city"),
                cell(r, columns, "state"), cell(r, columns, "postal_code"), cell(r, columns, "country"),
                decimal(r, columns, "latitude"), decimal(r, columns, "longitude"), cell(r, columns, "notes"),
                null, null);
    }

    private List<String> validate(CustomerRequest req) {
        Locale locale = LocaleContextHolder.getLocale();
        List<String> problems = new ArrayList<>();
        if (req.name() == null) {
            problems.add(text("error.csv.missingName"));
        }
        if ((req.latitude() == null) != (req.longitude() == null)) {
            problems.add(text("error.customer.coordinatesPair"));
        }
        DirectFieldBindingResult result = new DirectFieldBindingResult(req, "customer");
        validator.validate(req, result);
        for (FieldError fe : result.getFieldErrors()) {
            if (fe.getField().equals("name") && req.name() == null) {
                continue; // already reported above
            }
            String label = messages.getMessage("field." + fe.getField(), null, fe.getField(), locale);
            problems.add(label + ": " + messages.getMessage(fe, locale));
        }
        return problems;
    }

    private static String cell(CSVRecord r, Map<String, String> columns, String name) {
        String header = columns.get(name);
        if (header == null || !r.isSet(header)) {
            return null;
        }
        String v = r.get(header);
        if (v == null || v.isBlank()) {
            return null;
        }
        v = v.trim();
        // undo the formula-injection guard added on export
        if (v.length() > 1 && v.charAt(0) == '\'' && "=+-@".indexOf(v.charAt(1)) >= 0) {
            v = v.substring(1);
        }
        return v;
    }

    private static BigDecimal decimal(CSVRecord r, Map<String, String> columns, String name) {
        String v = cell(r, columns, name);
        if (v == null) {
            return null;
        }
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException e) {
            throw new InvalidCell(name);
        }
    }

    private static String normalize(String header) {
        return header.replace("﻿", "").trim().toLowerCase(Locale.ROOT).replace(' ', '_');
    }

    private static void addError(List<RowError> errors, long row, String message) {
        if (errors.size() < MAX_REPORTED_ERRORS) {
            errors.add(new RowError(row, message));
        }
    }

    private String text(String key, Object... args) {
        return messages.getMessage(key, args, key, LocaleContextHolder.getLocale());
    }

    private static final class InvalidCell extends RuntimeException {
        final String column;

        InvalidCell(String column) {
            super(column, null, false, false);
            this.column = column;
        }
    }
}
