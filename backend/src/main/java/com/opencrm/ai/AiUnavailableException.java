package com.opencrm.ai;

/** The AI provider could not produce an answer (not running, timed out, wrong key, refused, ...). */
public class AiUnavailableException extends RuntimeException {

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

    public AiUnavailableException(String message) {
        super(message);
    }
}
