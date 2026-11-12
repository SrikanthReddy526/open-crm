package com.opencrm.user;

import java.util.UUID;

import com.opencrm.security.Role;

public record UserDto(UUID id, String email, String fullName, String phone, Role role,
                      String preferredLanguage, boolean active) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(),
                u.getPreferredLanguage(), u.isActive());
    }
}
