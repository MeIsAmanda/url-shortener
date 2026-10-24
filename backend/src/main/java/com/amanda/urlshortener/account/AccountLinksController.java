package com.amanda.urlshortener.account;

import java.time.Instant;
import java.util.List;
import com.amanda.urlshortener.link.ShortLinkRepository;
import com.amanda.urlshortener.link.ShortLinkService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.*;

@RestController
public class AccountLinksController {
    private final AccountService accounts;
    private final ShortLinkRepository links;
    private final ShortLinkService service;
    public AccountLinksController(AccountService accounts, ShortLinkRepository links, ShortLinkService service) {
        this.accounts = accounts;
        this.links = links;
        this.service = service;
    }
    public record SavedLink(String code, String shortUrl, String originalUrl, Instant createdAt, long clickCount) { }
    public record LinkPage(List<SavedLink> items, String nextCursor) { }

    @GetMapping("/api/account/links")
    public ResponseEntity<LinkPage> links(@AuthenticationPrincipal OidcUser user,
            @RequestParam(required = false) Long before) {
        if (before != null && before <= 0) return ResponseEntity.badRequest().build();
        Long owner = accounts.accountFor(user).getId();
        var page = links.accountLinks(owner, before, PageRequest.of(0, 20));
        List<SavedLink> items = page.stream().map(link -> new SavedLink(link.getCode(),
                service.shortUrl(link.getCode()), link.getOriginalUrl(), link.getCreatedAt(), link.getClickCount())).toList();
        String cursor = page.hasNext() ? page.getContent().getLast().getId().toString() : null;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new LinkPage(items, cursor));
    }
}
