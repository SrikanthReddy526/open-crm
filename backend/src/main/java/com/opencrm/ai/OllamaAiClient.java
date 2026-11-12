package com.opencrm.ai;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Talks to a local <a href="https://ollama.com">Ollama</a> server (open source, MIT) through its
 * {@code POST /api/chat} endpoint. No API key; the data never leaves the machine.
 */
public class OllamaAiClient implements AiClient {

    private final RestClient http;
    private final String model;

    public OllamaAiClient(String baseUrl, String model, Duration timeout) {
        this.model = model;
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(timeout);
        this.http = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Override
    public String label() {
        return "Ollama · " + model;
    }

    @Override
    public String complete(String system, String user) {
        Map<String, Object> body = Map.of(
                "model", model,
                "stream", false,
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)),
                // num_ctx: Ollama's default context is small; tickets with long conversations need more
                "options", Map.of("temperature", 0.3, "num_ctx", 8192));
        try {
            ChatResponse res = http.post().uri("/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ChatResponse.class);
            if (res == null || res.message() == null || res.message().content() == null
                    || res.message().content().isBlank()) {
                throw new AiUnavailableException("Ollama returned an empty answer");
            }
            return res.message().content().trim();
        } catch (RestClientException e) {
            throw new AiUnavailableException("Ollama request failed: " + e.getMessage(), e);
        }
    }

    record ChatResponse(Message message) {}

    record Message(String role, String content) {}
}
