package com.opencrm.ai;

/** One language model behind the agent assistant. Implementations: {@link OllamaAiClient}, {@link AnthropicAiClient}. */
public interface AiClient {

    /** Short name shown in the UI, e.g. "Ollama · qwen2.5:3b". */
    String label();

    /**
     * Sends one system prompt + one user message and returns the model's text answer.
     *
     * @throws AiUnavailableException when the model cannot be reached or declines to answer
     */
    String complete(String system, String user);
}
