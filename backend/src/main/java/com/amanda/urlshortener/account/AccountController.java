package com.amanda.urlshortener.account;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountController {
    private final AccountService accounts;
    private final ObjectProvider<ClientRegistrationRepository> registrations;
    public AccountController(AccountService accounts, ObjectProvider<ClientRegistrationRepository> registrations) {
        this.accounts = accounts;
        this.registrations = registrations;
    }
    public record UserView(Long id, String name, String email) { }
    public record SessionView(UserView user, boolean googleSignInEnabled, String csrfToken) { }

    @GetMapping("/api/auth/session")
    public ResponseEntity<SessionView> session(@AuthenticationPrincipal OidcUser user, CsrfToken csrf) {
        UserView view = null;
        if (user != null) {
            UserAccount account = accounts.accountFor(user);
            view = new UserView(account.getId(), account.getDisplayName(), account.getEmail());
        }
        var clients = registrations.getIfAvailable();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
                new SessionView(view, clients != null && clients.findByRegistrationId("google") != null, csrf.getToken()));
    }
}
