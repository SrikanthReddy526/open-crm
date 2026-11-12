package com.opencrm.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.opencrm.config.AppProperties;
import com.opencrm.security.Role;

/** Creates the first admin account when the database has no users yet. */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        var cfg = props.bootstrapAdmin();
        User admin = new User();
        admin.setEmail(cfg.email().toLowerCase());
        admin.setPasswordHash(passwordEncoder.encode(cfg.password()));
        admin.setFullName(cfg.fullName());
        admin.setRole(Role.ADMIN);
        users.save(admin);
        log.warn("Created first admin user '{}'. Change its password after logging in.", cfg.email());
    }
}
