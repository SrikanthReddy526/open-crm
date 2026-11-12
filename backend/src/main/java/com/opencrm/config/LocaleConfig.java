package com.opencrm.config;

import java.util.List;
import java.util.Locale;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Picks the response language from the Accept-Language header that the
 * React app sends ("en" or "te"). Messages come from messages[_te].properties.
 */
@Configuration
public class LocaleConfig {

    public static final Locale TELUGU = Locale.forLanguageTag("te");

    @Bean
    LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(List.of(Locale.ENGLISH, TELUGU));
        resolver.setDefaultLocale(Locale.ENGLISH);
        return resolver;
    }
}
