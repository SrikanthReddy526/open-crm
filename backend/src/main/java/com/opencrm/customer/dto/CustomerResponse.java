package com.opencrm.customer.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.opencrm.customer.Customer;

public record CustomerResponse(
        UUID id,
        String name,
        String company,
        String email,
        String phone,
        String addressLine,
        String city,
        String state,
        String postalCode,
        String country,
        BigDecimal latitude,
        BigDecimal longitude,
        String notes,
        UUID ownerId,
        Instant createdAt,
        Instant updatedAt,
        Long version) {

    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getCompany(), c.getEmail(), c.getPhone(),
                c.getAddressLine(), c.getCity(), c.getState(), c.getPostalCode(), c.getCountry(),
                c.getLatitude(), c.getLongitude(), c.getNotes(), c.getOwnerId(),
                c.getCreatedAt(), c.getUpdatedAt(), c.getVersion());
    }
}
