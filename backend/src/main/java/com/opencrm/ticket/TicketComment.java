package com.opencrm.ticket;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** A reply or note on a ticket. {@code internal} notes are only visible to admins and support agents. */
@Entity
@Table(name = "ticket_comments")
public class TicketComment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ticket_id", nullable = false, updatable = false)
    private UUID ticketId;

    @Column(name = "author_id", updatable = false)
    private UUID authorId;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private boolean internal;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected TicketComment() {}

    public TicketComment(UUID ticketId, UUID authorId, String body, boolean internal) {
        this.ticketId = ticketId;
        this.authorId = authorId;
        this.body = body;
        this.internal = internal;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getTicketId() { return ticketId; }
    public UUID getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public boolean isInternal() { return internal; }
    public Instant getCreatedAt() { return createdAt; }
}
