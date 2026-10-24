package com.amanda.urlshortener.link;

import java.net.URI;
import jakarta.servlet.http.HttpServletRequest;
import com.amanda.urlshortener.account.AccountService;
import org.springframework.http.CacheControl;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ShortLinkController {
    private final ShortLinkService service;
    private final AccountService accounts;

    public ShortLinkController(ShortLinkService service, AccountService accounts) {
        this.service = service;
        this.accounts = accounts;
    }

    @PostMapping("/api/urls")
    public ResponseEntity<CreateLinkResponse> create(@RequestBody CreateLinkRequest request,
            @AuthenticationPrincipal OidcUser user) {
        CreateLinkResponse response = service.create(request.originalUrl(), user == null ? null : accounts.accountFor(user).getId());
        return ResponseEntity.created(URI.create(response.shortUrl())).body(response);
    }

    @GetMapping("/s/{code}")
    public ResponseEntity<Void> redirect(@PathVariable String code, HttpServletRequest request) {
        return ResponseEntity.status(302).cacheControl(CacheControl.noStore())
                .location(URI.create(service.resolve(code, request.getMethod().equals("GET")))).build();
    }
}
