package com.amanda.urlshortener.link;

import java.net.URI;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    "spring.datasource.url=jdbc:h2:mem:shortener-tests;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.public-base-url=http://localhost:8080"
})
class ShortLinkApiTest {
    @Autowired WebApplicationContext context;
    @Autowired ShortLinkRepository repository;
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
        assertTrue(shortUrl.length() < original.length());
        assertEquals(1, repository.count());
        mvc.perform(get(URI.create(shortUrl).getPath()))
            .andExpect(status().isFound()).andExpect(header().string("Location", original));
    }

    @Test
    void invalidInputAndUnknownCodeHaveReadableErrors() throws Exception {
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON).content("{\"originalUrl\":\"javascript:alert(1)\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_URL"));
        mvc.perform(post("/api/urls").contentType(MediaType.APPLICATION_JSON).content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(get("/s/Missing"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
        assertEquals(0, repository.count());
    }

    @Test
    void databaseEnforcesUniqueCodes() {
        repository.saveAndFlush(new ShortLink("Abc1234", "https://example.com/first"));
        assertThrows(DataIntegrityViolationException.class,
            () -> repository.saveAndFlush(new ShortLink("Abc1234", "https://example.com/second")));
        assertEquals("https://example.com/first", repository.findByCode("Abc1234").orElseThrow().getOriginalUrl());
    }
}
