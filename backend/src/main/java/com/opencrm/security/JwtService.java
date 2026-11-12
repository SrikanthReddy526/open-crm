package com.opencrm.security;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import com.opencrm.config.AppProperties;
import com.opencrm.user.User;

@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final Duration accessTokenTtl;

    public JwtService(JwtEncoder encoder, AppProperties props) {
        this.encoder = encoder;
        this.accessTokenTtl = Duration.ofMinutes(props.jwt().accessTokenMinutes());
    }

    /** @param sessionId the refresh-token row of this device, so the app can tell which session is "this device" */
    public String issueAccessToken(User user, UUID sessionId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("open-crm")
                .issuedAt(now)
                .expiresAt(now.plus(accessTokenTtl))
                .subject(user.getId().toString())
                .claim("role", user.getRole().name())
                .claim("name", user.getFullName())
                .claim("sid", sessionId.toString())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long accessTokenTtlSeconds() {
        return accessTokenTtl.toSeconds();
    }
}
