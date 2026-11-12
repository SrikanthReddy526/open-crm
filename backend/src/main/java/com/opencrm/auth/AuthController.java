package com.opencrm.auth;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.auth.dto.AuthDtos.AuthResponse;
import com.opencrm.auth.dto.AuthDtos.ChangePasswordRequest;
import com.opencrm.auth.dto.AuthDtos.LoginRequest;
import com.opencrm.auth.dto.AuthDtos.RefreshRequest;
import com.opencrm.auth.dto.AuthDtos.UpdateProfileRequest;
import com.opencrm.security.CurrentUser;
import com.opencrm.user.UserDto;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest req,
                       @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        String device = req.deviceName() != null ? req.deviceName() : userAgent;
        return auth.login(req.email(), req.password(), device);
    }

    @PostMapping("/refresh")
    AuthResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return auth.refresh(req.refreshToken());
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return auth.me(CurrentUser.from(jwt).id());
    }

    @PatchMapping("/me")
    UserDto updateMe(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest req) {
        return auth.updateProfile(CurrentUser.from(jwt).id(), req);
    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(CurrentUser.from(jwt), req.currentPassword(), req.newPassword());
    }

    /** My logged-in devices; the one making this request has {@code current: true}. */
    @GetMapping("/sessions")
    List<SessionDto> sessions(@AuthenticationPrincipal Jwt jwt) {
        CurrentUser me = CurrentUser.from(jwt);
        return auth.sessions(me.id(), me.sessionId());
    }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revokeSession(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        auth.revokeSession(CurrentUser.from(jwt), id, false);
    }
}
