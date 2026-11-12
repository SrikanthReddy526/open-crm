package com.opencrm.lead;

import java.util.UUID;

import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** A possible customer. When it becomes a real customer it is "converted" (and keeps a link to that customer). */
@Entity
@Table(name = "leads")
@SQLRestriction("deleted_at IS NULL")
public class Lead extends AuditableEntity {

    public enum Source { WEBSITE, REFERRAL, WALK_IN, PHONE, CAMPAIGN, OTHER }

    public enum Status { NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED }

    @Column(nullable = false, length = 150)
    private String name;

    private String company;
    private String email;
    private String phone;

    @Enumerated(EnumType.STRING)
    private Source source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.NEW;

    @Column(name = "converted_customer_id")
    private UUID convertedCustomerId;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(columnDefinition = "text")
    private String notes;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Source getSource() { return source; }
    public void setSource(Source source) { this.source = source; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public UUID getConvertedCustomerId() { return convertedCustomerId; }
    public void setConvertedCustomerId(UUID convertedCustomerId) { this.convertedCustomerId = convertedCustomerId; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
