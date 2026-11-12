package com.opencrm.sync;

import java.time.Instant;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.security.CurrentUser;
import com.opencrm.sync.SyncDtos.PullResponse;
import com.opencrm.sync.SyncDtos.PushRequest;
import com.opencrm.sync.SyncDtos.PushResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService sync;

    public SyncController(SyncService sync) {
        this.sync = sync;
    }

    /** {@code since} empty = full download (first sync on a device). */
    @GetMapping("/pull")
    PullResponse pull(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Instant since) {
        return sync.pull(CurrentUser.from(jwt), since);
    }

    @PostMapping("/push")
    PushResponse push(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PushRequest req) {
        return new PushResponse(sync.push(CurrentUser.from(jwt), req.mutations()));
    }
}
