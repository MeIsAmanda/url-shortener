package com.amanda.urlshortener.account;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class AccountService {
    private final UserAccountRepository accounts;
    public AccountService(UserAccountRepository accounts) { this.accounts = accounts; }

    public UserAccount accountFor(OidcUser user) {
        // Supplied by Spring's verified OIDC login, never by client JSON.
        String subject = user.getSubject();
        if (subject == null || subject.isBlank() || subject.length() > 255) {
            throw new IllegalArgumentException("Invalid Google subject.");
        }
        return accounts.findByGoogleSubject(subject).orElseGet(() -> {
            String name = user.getFullName();
            if (name == null || name.isBlank()) name = "Sniply user";
            if (name.length() > 255) name = name.substring(0, 255);
            String email = user.getEmail();
            if (email != null && email.length() > 320) email = null;
            try {
                return accounts.saveAndFlush(new UserAccount(subject, name, email));
            } catch (DataIntegrityViolationException conflict) {
                return accounts.findByGoogleSubject(subject).orElseThrow(() -> conflict);
            }
        });
    }
}
