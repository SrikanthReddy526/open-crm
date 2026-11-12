package com.opencrm.common;

import org.springframework.http.HttpStatus;

/**
 * Business error with an HTTP status and a message key from messages[_te].properties,
 * so the client gets the error text in its own language.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String messageKey;
    private final transient Object[] args;

    public ApiException(HttpStatus status, String messageKey, Object... args) {
        super(messageKey);
        this.status = status;
        this.messageKey = messageKey;
        this.args = args;
    }

    public static ApiException notFound(String key) {
        return new ApiException(HttpStatus.NOT_FOUND, key);
    }

    public static ApiException badRequest(String key, Object... args) {
        return new ApiException(HttpStatus.BAD_REQUEST, key, args);
    }

    public static ApiException conflict(String key) {
        return new ApiException(HttpStatus.CONFLICT, key);
    }

    public static ApiException unauthorized(String key) {
        return new ApiException(HttpStatus.UNAUTHORIZED, key);
    }

    public static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "error.forbidden");
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessageKey() {
        return messageKey;
    }

    public Object[] getArgs() {
        return args;
    }
}
