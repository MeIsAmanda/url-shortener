package com.amanda.urlshortener.account;

import java.net.URI;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import com.amanda.urlshortener.link.ShortLinkRepository;
import com.amanda.urlshortener.link.ShortLinkService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:accounts-api-tests;DB_CLOSE_DELAY=-1",
    "app.public-base-url=http://localhost:8080", "app.frontend-base-url=http://localhost:5173",
    "app.google.enabled=true", "app.google.client-id=test-client", "app.google.client-secret=test-secret"
})
class AccountApiTest {
    @Autowired WebApplicationContext context;
    @Autowired ShortLinkRepository links;
    @Autowired UserAccountRepository accounts;
    @Autowired ShortLinkService service;
    private MockMvc mvc;
    private final JsonMapper json = JsonMapper.builder().build();
    private static final String ORIGINAL = "https://example.com/a?x=%2F#Section";

    @BeforeEach void setUp() {
        links.deleteAll();
        accounts.deleteAll();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private RequestPostProcessor google(String subject) {
        return oidcLogin().idToken(token -> token.subject(subject)
                .claim("iss", "https://accounts.google.com")
                .claim("name", "Amanda").claim("email", "amanda@example.com"));
    }
    private Long account(String subject) throws Exception {
        mvc.perform(get("/api/auth/session").with(google(subject))).andExpect(status().isOk());
        return accounts.findByGoogleSubject(subject).orElseThrow().getId();
    }

    @Test void anonymousSessionIsSafeAndAccountHistoryIsPrivate() throws Exception {
        mvc.perform(get("/api/auth/session")).andExpect(status().isOk())
            .andExpect(jsonPath("$.user").isEmpty()).andExpect(jsonPath("$.googleSignInEnabled").value(true))
            .andExpect(jsonPath("$.csrfToken").isNotEmpty())
            .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get("/api/account/links")).andExpect(status().isUnauthorized());
        assertEquals(0, accounts.count());
    }

    @Test void firstLoginCreatesOneAccountAndIdentityUsesSubjectNotEmail() throws Exception {
        Long first = account("google-one");
        assertEquals(first, account("google-one"));
        Long second = account("google-two"); // Same email claim, distinct verified subject.
        assertNotEquals(first, second);
        assertEquals(2, accounts.count());
    }

    @Test void signedInCreationUsesServerIdentityAndRequiresCsrf() throws Exception {
        Long owner = account("owner");
        mvc.perform(post("/api/urls").with(google("owner")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + ORIGINAL + "\"}")).andExpect(status().isForbidden());
        assertEquals(0, links.count());
        mvc.perform(post("/api/urls").with(google("owner")).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + ORIGINAL + "\",\"ownerId\":999}")).andExpect(status().isCreated());
        assertEquals(owner, links.findAll().getFirst().getOwnerId());
    }

    @Test void theBrowserCanSubmitTheActualSessionCsrfToken() throws Exception {
        var bootstrap = mvc.perform(get("/api/auth/session").with(google("browser"))).andReturn();
        var session = (MockHttpSession) bootstrap.getRequest().getSession(false);
        String token = json.readTree(bootstrap.getResponse().getContentAsString()).path("csrfToken").asText();
        mvc.perform(post("/api/urls").session(session).header("X-CSRF-TOKEN", token)
            .header("X-Sniply-Account", "true").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + ORIGINAL + "\"}")).andExpect(status().isCreated());
        assertEquals(accounts.findByGoogleSubject("browser").orElseThrow().getId(), links.findAll().getFirst().getOwnerId());
    }

    @Test void anonymousCreationRemainsPublicAndIsNotAssignedToAUser() throws Exception {
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + ORIGINAL + "\"}")).andExpect(status().isCreated());
        assertNull(links.findAll().getFirst().getOwnerId());
    }

    @Test void anExpiredAccountSessionCannotSilentlyCreateAnAnonymousLink() throws Exception {
        mvc.perform(post("/api/urls").header("X-Sniply-Account", "true")
            .contentType(MediaType.APPLICATION_JSON).content("{\"originalUrl\":\"" + ORIGINAL + "\"}"))
            .andExpect(status().isUnauthorized());
        assertEquals(0, links.count());
    }

    @Test void ownersOnlySeeTheirOwnMappingsAndNeverAnonymousLinks() throws Exception {
        Long alice = account("alice");
        Long bob = account("bob");
        String aliceUrl = service.create(ORIGINAL, alice).shortUrl();
        service.create("https://example.com/bob", bob);
        service.create("https://example.com/guest");
        mvc.perform(get("/api/account/links").with(google("alice"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].shortUrl").value(aliceUrl))
            .andExpect(jsonPath("$.items[0].createdAt").isNotEmpty())
            .andExpect(jsonPath("$.items[0].clickCount").value(0))
            .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test void historyUsesBoundedCursorPagesWithoutDuplicates() throws Exception {
        Long owner = account("many-links");
        for (int i = 0; i < 23; i++) service.create("https://example.com/" + i, owner);
        var first = mvc.perform(get("/api/account/links").with(google("many-links")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(20)).andReturn();
        long cursor = json.readTree(first.getResponse().getContentAsString()).path("nextCursor").asLong();
        mvc.perform(get("/api/account/links").param("before", Long.toString(cursor)).with(google("many-links")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(3))
            .andExpect(jsonPath("$.nextCursor").isEmpty())
            .andExpect(jsonPath("$.items[0].originalUrl").value("https://example.com/2"));
        mvc.perform(get("/api/account/links").param("before", "0").with(google("many-links")))
            .andExpect(status().isBadRequest());
    }

    @Test void redirectsIncrementAtomicallyWhileHeadAndUnknownCodesDoNotCount() throws Exception {
        String url = service.create(ORIGINAL, account("click-owner")).shortUrl();
        String path = URI.create(url).getPath();
        mvc.perform(head(path)).andExpect(status().isFound()).andExpect(header().string("Cache-Control", "no-store"));
        assertEquals(0, links.findAll().getFirst().getClickCount());
        for (int i = 0; i < 3; i++) mvc.perform(get(path)).andExpect(status().isFound())
                .andExpect(header().string("Location", ORIGINAL));
        mvc.perform(get("/s/missing")).andExpect(status().isNotFound());
        mvc.perform(get("/api/account/links").with(google("click-owner")))
            .andExpect(jsonPath("$.items[0].clickCount").value(3));
    }

    @Test void concurrentRedirectsDoNotLoseIncrements() throws Exception {
        String code = URI.create(service.create(ORIGINAL).shortUrl()).getPath().substring(3);
        try (var workers = Executors.newFixedThreadPool(6)) {
            var calls = IntStream.range(0, 48)
                    .mapToObj(i -> workers.submit(() -> service.resolve(code))).toList();
            for (var call : calls) assertEquals(ORIGINAL, call.get(10, TimeUnit.SECONDS));
        }
        assertEquals(48, links.findByCode(code).orElseThrow().getClickCount());
    }

    @Test void logoutRequiresCsrfAndInvalidatesTheSession() throws Exception {
        var loggedIn = mvc.perform(get("/api/auth/session").with(google("logout"))).andReturn();
        var session = (MockHttpSession) loggedIn.getRequest().getSession(false);
        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/account/links")).andExpect(status().isUnauthorized());
    }

    @Test void loginRedirectIncludesOidcStateAndUsesConfiguredFrontendCallback() throws Exception {
        var result = mvc.perform(get("/oauth2/authorization/google")).andExpect(status().isFound()).andReturn();
        String destination = result.getResponse().getRedirectedUrl();
        assertTrue(destination.startsWith("https://accounts.google.com/"));
        assertTrue(destination.contains("state="));
        assertTrue(destination.contains("nonce="));
        assertTrue(destination.contains("localhost:5173") || destination.contains("localhost%3A5173"));
        mvc.perform(get("/login/oauth2/code/google").param("code", "untrusted").param("state", "invalid"))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("http://localhost:5173/?login=failed"));
    }
}
