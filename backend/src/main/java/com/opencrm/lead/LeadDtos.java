package com.opencrm.lead;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.opencrm.lead.Lead.Source;
import com.opencrm.lead.Lead.Status;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class LeadDtos {

    private LeadDtos() {}

    public record LeadRequest(
            UUID id,
            @NotBlank @Size(max = 150) String name,
            @Size(max = 150) String company,
            @Email @Size(max = 255) String email,
            @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-\\s]*$") String phone,
            Source source,
            Status status,
            UUID ownerId,
            @Size(max = 5000) String notes,
            Long version) {}

    public record StatusRequest(@NotNull Status status) {}

    /** Converting creates a customer from the lead and, optionally, a first deal. */
    public record ConvertRequest(
            Boolean createDeal,
            @Size(max = 200) String dealTitle,
            @DecimalMin("0") BigDecimal amount) {}

    public record ConvertResponse(LeadResponse lead, UUID customerId, UUID dealId) {}

    public record LeadResponse(
            UUID id, String name, String company, String email, String phone, Source source, Status status,
            UUID convertedCustomerId, UUID ownerId, String ownerName, String notes,
            Instant createdAt, Instant updatedAt, Long version) {

        public static LeadResponse from(Lead l, Map<UUID, String> users) {
            return new LeadResponse(l.getId(), l.getName(), l.getCompany(), l.getEmail(), l.getPhone(),
                    l.getSource(), l.getStatus(), l.getConvertedCustomerId(), l.getOwnerId(),
                    users.get(l.getOwnerId()), l.getNotes(), l.getCreatedAt(), l.getUpdatedAt(), l.getVersion());
        }
    }
}
