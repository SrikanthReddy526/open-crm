package com.opencrm.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings for the AI agent assistant ({@code app.ai.*} in application.yml).
 *
 * @param provider       {@code ollama} (default, open source, runs locally), {@code anthropic} (Claude API) or
 *                       {@code none} (feature switched off)
 * @param timeoutSeconds how long to wait for one answer; small local models on a CPU can take a while
 */
@ConfigurationProperties(prefix = "app.ai")
public record AiProperties(String provider, int timeoutSeconds, Ollama ollama, Anthropic anthropic) {

    public enum Provider { OLLAMA, ANTHROPIC, NONE }

    public Provider providerType() {
        if (provider == null || provider.isBlank()) {
            return Provider.OLLAMA;
        }
        return switch (provider.trim().toLowerCase()) {
            case "anthropic", "claude" -> Provider.ANTHROPIC;
            case "none", "off", "disabled" -> Provider.NONE;
            default -> Provider.OLLAMA;
        };
    }

    public int timeout() {
        return timeoutSeconds > 0 ? timeoutSeconds : 180;
    }

    /** @param baseUrl e.g. http://localhost:11434 (dev) or http://ollama:11434 (Docker) */
    public record Ollama(String baseUrl, String model) {}

    /** @param apiKey from ANTHROPIC_API_KEY; required when provider = anthropic */
    public record Anthropic(String apiKey, String model) {}
}
