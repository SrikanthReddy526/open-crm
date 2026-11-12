package com.opencrm.sync;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedMutationRepository extends JpaRepository<ProcessedMutation, UUID> {
}
