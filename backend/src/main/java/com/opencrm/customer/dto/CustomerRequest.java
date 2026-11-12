package com.opencrm.customer.dto;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Create/update payload.
 * @param id      optional on create: a client-generated UUID (lets offline-created records keep their id)
 * @param version required on update: the version the client last saw (conflict detection)
 */
public record CustomerRequest(
        UUID id,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 150) String company,
        @Email @Size(max = 255) String email,
        @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-\\s]*$") String phone,
        @Size(max = 255) String addressLine,
        @Size(max = 100) String city,
        @Size(max = 100) String state,
        @Size(max = 20) String postalCode,
        @Size(max = 100) String country,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        @Size(max = 5000) String notes,
        UUID ownerId,
        Long version) {
}
