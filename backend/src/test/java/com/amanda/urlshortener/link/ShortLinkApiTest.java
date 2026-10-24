package com.amanda.urlshortener.link;

import java.net.URI;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:shortener-sequence-api-tests;DB_CLOSE_DELAY=-1",
    "app.public-base-url=http://localhost:8080"
})
class ShortLinkApiTest {
    @Autowired WebApplicationContext context;
    @Autowired ShortLinkRepository repository;
    @Autowired ShortLinkService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void createsAndRedirectsToExactDestination() throws Exception {
        String original = "https://example.com/some/long/path?campaign=assessment&x=1#section";
        var response = mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + original + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.originalUrl").value(original))
            .andReturn().getResponse();
        String shortUrl = response.getHeader("Location");
        assertNotNull(shortUrl);
        assertEquals(1, repository.count());
        ShortLink saved = repository.findAll().getFirst();
        assertEquals(new Base62Encoder().encode(saved.getId()), saved.getCode());
        assertFalse(saved.isNew());
        mvc.perform(get(URI.create(shortUrl).getPath()))
            .andExpect(status().isFound()).andExpect(header().string("Location", original));
    }

    @Test
    void malformedJsonAndUnknownCodeHaveReadableErrors() throws Exception {
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON).content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(get("/s/Missing"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
        assertEquals(0, repository.count());
    }

    @Test
    void savesShortDestinationsEvenWhenTheGeneratedUrlIsLonger() throws Exception {
        var response = mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"https://x.co\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.originalUrl").value("https://x.co"))
            .andReturn().getResponse();
        assertTrue(response.getHeader("Location").length() > "https://x.co".length());
        mvc.perform(get(URI.create(response.getHeader("Location")).getPath()))
            .andExpect(status().isFound()).andExpect(header().string("Location", "https://x.co"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  supplied text  ", "example.com", "ftp://example.com", "https://example.invalid",
        "https://example.com/?q=%ZZ", "https://example.com/a b", "http://localhost:8080"})
    void rejectsInvalidDestinationsWithoutSaving(String input) throws Exception {
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + input + "\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_URL"));
        assertEquals(0, repository.count());
    }

    @Test
    void acceptsTheLengthBoundaryAndRejectsOneCharacterBeyondIt() throws Exception {
        String original = "https://example.com/" + "a".repeat(2048 - "https://example.com/".length());
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + original + "\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.originalUrl").value(original));
        assertEquals(original, repository.findAll().getFirst().getOriginalUrl());
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON)
            .content("{\"originalUrl\":\"" + original + "a\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_URL"));
        assertEquals(1, repository.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"originalUrl\":null}"})
    void rejectsMissingOrNullDestination(String body) throws Exception {
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_URL"));
        assertEquals(0, repository.count());
    }

    @Test
    void doesNotRevalidateExistingMappingsOnRedirect() throws Exception {
        String legacyDestination = "https://example.com/" + "a".repeat(5000);
        repository.saveAndFlush(new ShortLink(9_000_000L, "Legacy1", legacyDestination));
        mvc.perform(get("/s/Legacy1")).andExpect(status().isFound())
            .andExpect(header().string("Location", legacyDestination));
    }

    @Test
    void databaseEnforcesUniqueCodes() {
        repository.saveAndFlush(new ShortLink(1_000_000L, "Abc1234", "https://example.com/first"));
        assertThrows(DataIntegrityViolationException.class,
            () -> repository.saveAndFlush(new ShortLink(1_000_001L, "Abc1234", "https://example.com/second")));
        assertEquals("https://example.com/first", repository.findByCode("Abc1234").orElseThrow().getOriginalUrl());
    }

    @Test
    void duplicateAssignedIdsFailInsteadOfOverwritingExistingMappings() {
        repository.saveAndFlush(new ShortLink(1_000_000L, "First01", "https://example.com/first"));
        assertThrows(DataIntegrityViolationException.class,
            () -> repository.saveAndFlush(new ShortLink(1_000_000L, "Other02", "https://example.com/second")));
        assertEquals("https://example.com/first", repository.findById(1_000_000L).orElseThrow().getOriginalUrl());
    }

    @Test
    void preservesLegacyAliasesIncludingLeadingZeros() throws Exception {
        repository.saveAndFlush(new ShortLink(1_000_000L, "0000001", "https://example.com/legacy"));
        mvc.perform(get("/s/0000001"))
            .andExpect(status().isFound()).andExpect(header().string("Location", "https://example.com/legacy"));
    }

    @Test
    void concurrentCreationsHaveDistinctIdsAndCodes() throws Exception {
        int requests = 48;
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<CreateLinkResponse>>();
            for (int i = 0; i < requests; i++) {
                futures.add(executor.submit(() -> {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    return service.create("https://example.com/the-same-long-destination-for-concurrent-requests");
                }));
            }
            start.countDown();
            var urls = new HashSet<String>();
            for (var future : futures) {
                assertTrue(urls.add(future.get(20, TimeUnit.SECONDS).shortUrl()));
            }
            assertEquals(requests, urls.size());
        }
        assertEquals(requests, repository.count());
        var ids = new HashSet<Long>();
        Base62Encoder encoder = new Base62Encoder();
        for (ShortLink link : repository.findAll()) {
            assertTrue(ids.add(link.getId()));
            assertEquals(encoder.encode(link.getId()), link.getCode());
        }
    }
}
