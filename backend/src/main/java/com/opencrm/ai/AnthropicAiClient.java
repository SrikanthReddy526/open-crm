package com.opencrm.ai;

import java.time.Duration;
import java.util.stream.Collectors;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicException;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.MessageCreateParams;

/**
 * Claude through the official Anthropic Java SDK. Optional: only used when {@code app.ai.provider=anthropic}
 * and an API key is set. Note: Claude is a paid cloud service and not open source.
 */
public class AnthropicAiClient implements AiClient {

    /** If Claude's safety checks decline a request, the API retries it on a suitable model server-side. */
    private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";

    private final AnthropicClient client;
    private final String model;

    public AnthropicAiClient(String apiKey, String model, Duration timeout) {
        this.model = model;
        this.client = AnthropicOkHttpClient.builder().apiKey(apiKey).timeout(timeout).build();
    }

    @Override
    public String label() {
        return "Claude · " + model;
    }

    @Override
    public String complete(String system, String user) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .system(system)
                .addUserMessage(user)
                .outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.MEDIUM).build())
                .addBeta(FALLBACK_BETA)
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .build();
        try {
            BetaMessage msg = client.beta().messages().create(params);
            if (msg.stopReason().map(BetaStopReason.REFUSAL::equals).orElse(false)) {
                throw new AiUnavailableException("Claude declined this request");
            }
            String text = msg.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(t -> t.text())
                    .collect(Collectors.joining("\n"))
                    .trim();
            if (text.isEmpty()) {
                throw new AiUnavailableException("Claude returned an empty answer");
            }
            return text;
        } catch (AnthropicException e) {
            throw new AiUnavailableException("Claude request failed: " + e.getMessage(), e);
        }
    }
}
