package com.amanda.urlshortener.link;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ShortLinkService {
    private final ShortLinkRepository repository;
    private final LinkIdAllocator idAllocator;
    private final Base62Encoder encoder;
    private final String publicBaseUrl;

    public ShortLinkService(ShortLinkRepository repository, LinkIdAllocator idAllocator,
            Base62Encoder encoder,
            @Value("${app.public-base-url}") String publicBaseUrl) {
        this.repository = repository;
        this.idAllocator = idAllocator;
        this.encoder = encoder;
        // A configured origin avoids trusting the incoming Host header.
        URI base = URI.create(publicBaseUrl);
        if (!("http".equalsIgnoreCase(base.getScheme()) || "https".equalsIgnoreCase(base.getScheme()))
                || base.getHost() == null || base.getUserInfo() != null
                || base.getQuery() != null || base.getFragment() != null
                || !(base.getPath().isEmpty() || base.getPath().equals("/")) || base.getPort() > 65535) {
            throw new IllegalArgumentException("app.public-base-url must be an HTTP(S) origin.");
        }
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    public CreateLinkResponse create(String input) {
        UrlValidator.validate(input);
        long id = idAllocator.nextId();
        String code = encoder.encode(id);
        String shortened = publicBaseUrl + "/s/" + code;
        repository.saveAndFlush(new ShortLink(id, code, input));
        return new CreateLinkResponse(input, shortened);
    }

    public String resolve(String code) {
        if (code == null || !code.matches("[A-Za-z0-9]{1," + Base62Encoder.MAX_CODE_LENGTH + "}")) {
            throw new LinkNotFoundException();
        }
        return repository.findByCode(code).orElseThrow(LinkNotFoundException::new).getOriginalUrl();
    }
}
