package com.opencrm.customer;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.opencrm.common.PageResponse;
import com.opencrm.customer.dto.CsvImportResult;
import com.opencrm.customer.dto.CustomerRequest;
import com.opencrm.customer.dto.CustomerResponse;
import com.opencrm.customer.dto.NearbyCustomer;
import com.opencrm.security.CurrentUser;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService service;
    private final CustomerCsvService csv;

    public CustomerController(CustomerService service, CustomerCsvService csv) {
        this.service = service;
        this.csv = csv;
    }

    @GetMapping
    PageResponse<CustomerResponse> list(@AuthenticationPrincipal Jwt jwt,
                                        @RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size,
                                        @RequestParam(defaultValue = "name,asc") String sort) {
        return PageResponse.of(service.search(CurrentUser.from(jwt), q, page, size, sort), CustomerResponse::from);
    }

    @GetMapping("/{id}")
    CustomerResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return CustomerResponse.from(service.get(CurrentUser.from(jwt), id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CustomerResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CustomerRequest req) {
        return CustomerResponse.from(service.create(CurrentUser.from(jwt), req));
    }

    @PutMapping("/{id}")
    CustomerResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @Valid @RequestBody CustomerRequest req) {
        return CustomerResponse.from(service.update(CurrentUser.from(jwt), id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.from(jwt), id);
    }

    /** Customers near a point, e.g. the field staff's current GPS position. */
    @GetMapping("/nearby")
    List<NearbyCustomer> nearby(@AuthenticationPrincipal Jwt jwt,
                                @RequestParam double lat,
                                @RequestParam double lng,
                                @RequestParam(defaultValue = "5") double radiusKm,
                                @RequestParam(defaultValue = "50") int limit) {
        return service.nearby(CurrentUser.from(jwt), lat, lng, radiusKm, limit);
    }

    /** Customers inside the visible map area (for the map view). */
    @GetMapping("/in-area")
    List<CustomerResponse> inArea(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam double south, @RequestParam double west,
                                  @RequestParam double north, @RequestParam double east,
                                  @RequestParam(defaultValue = "500") int limit) {
        return service.inArea(CurrentUser.from(jwt), south, west, north, east, limit).stream()
                .map(CustomerResponse::from).toList();
    }

    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('ADMIN','SUPPORT_AGENT')")
    void export(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "") String q,
                HttpServletResponse response) throws IOException {
        prepareCsv(response, "customers-" + LocalDate.now() + ".csv");
        Writer out = new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8);
        csv.export(CurrentUser.from(jwt), q, out);
        out.flush();
    }

    @GetMapping("/import/template")
    void template(HttpServletResponse response) throws IOException {
        prepareCsv(response, "customers-template.csv");
        Writer out = new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8);
        csv.writeTemplate(out);
        out.flush();
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    CsvImportResult importCsv(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        return csv.importCsv(CurrentUser.from(jwt), file);
    }

    private static void prepareCsv(HttpServletResponse response, String filename) {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
    }
}
