package com.opencrm.ai;

import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.ai.AiAssistService.AiText;
import com.opencrm.ai.AiAssistService.Status;
import com.opencrm.security.CurrentUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
public class AiAssistController {

    private final AiAssistService service;

    public AiAssistController(AiAssistService service) {
        this.service = service;
    }

    public record ReplyRequest(@Pattern(regexp = "en|te") String language, @Size(max = 1000) String instructions) {}

    @GetMapping("/api/ai/status")
    Status status(@AuthenticationPrincipal Jwt jwt) {
        return service.status(CurrentUser.from(jwt));
    }

    @PostMapping("/api/tickets/{id}/ai/summary")
    AiText summary(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.summarize(CurrentUser.from(jwt), id);
    }

    @PostMapping("/api/tickets/{id}/ai/reply")
    AiText reply(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                 @Valid @RequestBody(required = false) ReplyRequest req) {
        return service.suggestReply(CurrentUser.from(jwt), id, req == null ? "en" : req.language(),
                req == null ? null : req.instructions());
    }
}
