package com.opencrm.user;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.opencrm.auth.AuthService;
import com.opencrm.auth.SessionDto;
import com.opencrm.common.ApiException;
import com.opencrm.common.Paging;
import com.opencrm.security.CurrentUser;
import com.opencrm.security.Role;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** User management (admin only) and the "active devices" overview. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthService auth;

    public UserController(UserRepository users, PasswordEncoder passwordEncoder, AuthService auth) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.auth = auth;
    }

    public record CreateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-\\s]*$") String phone,
            @NotNull Role role,
            @Pattern(regexp = "en|te") String preferredLanguage) {}

    public record UpdateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-\\s]*$") String phone,
            @NotNull Role role,
            @Pattern(regexp = "en|te") String preferredLanguage) {}

    public record ActiveRequest(@NotNull Boolean active) {}

    public record ResetPasswordRequest(@NotBlank @Size(min = 8, max = 100) String newPassword) {}

    /** Small list used by dropdowns (e.g. "assign to"). */
    public record UserLookup(UUID id, String fullName, Role role) {}

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    List<UserDto> list() {
        return users.findAll(Sort.by("fullName")).stream().map(UserDto::from).toList();
    }

    @GetMapping("/lookup")
    List<UserLookup> lookup() {
        return users.findByActiveTrueOrderByFullNameAsc().stream()
                .map(u -> new UserLookup(u.getId(), u.getFullName(), u.getRole())).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    UserDto get(@PathVariable UUID id) {
        return UserDto.from(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    UserDto create(@Valid @RequestBody CreateUserRequest req) {
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("error.user.emailTaken");
        }
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setFullName(req.fullName().trim());
        u.setPhone(Paging.blankToNull(req.phone()));
        u.setRole(req.role());
        if (req.preferredLanguage() != null) {
            u.setPreferredLanguage(req.preferredLanguage());
        }
        return UserDto.from(users.save(u));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    UserDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req) {
        User u = find(id);
        String email = normalizeEmail(req.email());
        if (!email.equalsIgnoreCase(u.getEmail()) && users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("error.user.emailTaken");
        }
        // An admin cannot remove their own admin role (avoids locking everyone out).
        if (u.getId().equals(CurrentUser.from(jwt).id()) && req.role() != Role.ADMIN) {
            throw ApiException.badRequest("error.user.cannotChangeSelf");
        }
        u.setEmail(email);
        u.setFullName(req.fullName().trim());
        u.setPhone(Paging.blankToNull(req.phone()));
        u.setRole(req.role());
        if (req.preferredLanguage() != null) {
            u.setPreferredLanguage(req.preferredLanguage());
        }
        return UserDto.from(u);
    }

    /** Deactivated users cannot log in, and all their devices are logged out. */
    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    UserDto setActive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ActiveRequest req) {
        User u = find(id);
        if (u.getId().equals(CurrentUser.from(jwt).id()) && !req.active()) {
            throw ApiException.badRequest("error.user.cannotChangeSelf");
        }
        u.setActive(req.active());
        if (!req.active()) {
            auth.revokeAll(u.getId());
        }
        return UserDto.from(u);
    }

    /** Admin sets a new password (e.g. the user forgot theirs); the user is logged out everywhere. */
    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    void resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest req) {
        User u = find(id);
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        auth.revokeAll(u.getId());
    }

    /** All logged-in devices of all users (or one user with ?userId=). */
    @GetMapping("/sessions")
    @PreAuthorize("hasRole('ADMIN')")
    List<SessionDto> sessions(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) UUID userId) {
        return auth.sessions(userId, CurrentUser.from(jwt).sessionId());
    }

    @DeleteMapping("/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    void revokeSession(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sessionId) {
        auth.revokeSession(CurrentUser.from(jwt), sessionId, true);
    }

    @DeleteMapping("/{id}/sessions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    void revokeAllSessions(@PathVariable UUID id) {
        auth.revokeAll(find(id).getId());
    }

    private User find(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("error.notFound.user"));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
