package com.opencrm.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public endpoint used by apps to check connectivity and by Docker/hosts for health checks. */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
