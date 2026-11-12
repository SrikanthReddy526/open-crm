package com.opencrm.auth.dto;

import com.opencrm.user.UserDto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password, @Size(max = 100) String deviceName) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserDto user) {}

    public record UpdateProfileRequest(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-\\s]*$") String phone,
            @Pattern(regexp = "en|te") String preferredLanguage) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8, max = 100) String newPassword) {}
}
