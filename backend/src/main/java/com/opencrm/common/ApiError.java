package com.opencrm.common;

import java.time.Instant;
import java.util.Map;

/** JSON body returned for every error. {@code message} is already translated. */
public record ApiError(int status, String code, String message, Map<String, String> fieldErrors, Instant timestamp) {

    public static ApiError of(int status, String code, String message) {
        return new ApiError(status, code, message, Map.of(), Instant.now());
    }
}
