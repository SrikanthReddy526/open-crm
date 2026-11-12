package com.opencrm.customer;

import java.math.BigDecimal;
import java.util.UUID;

import org.hibernate.annotations.SQLRestriction;

import com.opencrm.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A customer. The database also has a generated PostGIS column {@code location}
 * (computed from latitude/longitude) used only by the native "nearby" query,
 * so it is intentionally not mapped here.
 */
@Entity
@Table(name = "customers")
@SQLRestriction("deleted_at IS NULL")
public class Customer extends AuditableEntity {

    @Column(nullable = false, length = 150)
    private String name;

    private String company;
    private String email;
    private String phone;

    @Column(name = "address_line")
    private String addressLine;

    private String city;
    private String state;

    @Column(name = "postal_code")
    private String postalCode;

    private String country;

    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddressLine() { return addressLine; }
    public void setAddressLine(String addressLine) { this.addressLine = addressLine; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
