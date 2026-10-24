package com.amanda.urlshortener.link;

import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ShortLinkController {
    private final ShortLinkService service;

    public ShortLinkController(ShortLinkService service) { this.service = service; }

    @PostMapping("/api/urls")
    public ResponseEntity<CreateLinkResponse> create(@RequestBody CreateLinkRequest request) {
        CreateLinkResponse response = service.create(request.originalUrl());
        return ResponseEntity.created(URI.create(response.shortUrl())).body(response);
    }

    @GetMapping("/s/{code}")
    public ResponseEntity<Void> redirect(@PathVariable String code) {
        return ResponseEntity.status(302).location(URI.create(service.resolve(code))).build();
    }
}
