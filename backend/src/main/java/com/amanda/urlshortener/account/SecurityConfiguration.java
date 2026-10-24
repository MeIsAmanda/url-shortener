package com.amanda.urlshortener.account;

import java.net.URI;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfiguration {
    @Bean
    AuthenticationManager noPasswordAuthentication() {
        return authentication -> { throw new BadCredentialsException("Use Google sign-in."); };
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, AccountService accounts,
            ObjectProvider<ClientRegistrationRepository> registrations,
            @Value("${app.frontend-base-url}") String frontend) throws Exception {
        String origin = origin(frontend);
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(request -> request.getMethod().equals("POST")
                    && request.getRequestURI().equals(request.getContextPath() + "/api/urls")
                    && "true".equals(request.getHeader("X-Sniply-Account"))).authenticated()
                .requestMatchers("/api/account/**").authenticated()
                .anyRequest().permitAll())
            .csrf(csrf -> csrf.ignoringRequestMatchers(request -> {
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                // Anonymous creation has no account authority to exploit through CSRF.
                return request.getRequestURI().equals(request.getContextPath() + "/api/urls")
                        && (authentication == null || !authentication.isAuthenticated()
                            || authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
            }))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"code\":\"AUTHENTICATION_REQUIRED\",\"message\":\"Please sign in again.\"}");
                })
                .accessDeniedHandler((request, response, error) -> {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"code\":\"ACCESS_DENIED\",\"message\":\"Refresh the page and try again.\"}");
                }))
            .requestCache(cache -> cache.disable())
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)));
        ClientRegistrationRepository clients = registrations.getIfAvailable();
        if (clients != null) {
            http.oauth2Login(login -> login.clientRegistrationRepository(clients)
                .successHandler((request, response, authentication) -> {
                    accounts.accountFor((org.springframework.security.oauth2.core.oidc.user.OidcUser) authentication.getPrincipal());
                    response.sendRedirect(origin);
                })
                .failureHandler((request, response, error) -> response.sendRedirect(origin + "/?login=failed")));
        }
        return http.build();
    }

    static String origin(String value) {
        URI uri = URI.create(value);
        if (uri.getScheme() == null || !(uri.getScheme().equalsIgnoreCase("http") || uri.getScheme().equalsIgnoreCase("https"))
                || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                || uri.getFragment() != null || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))
                || uri.getPort() > 65535) throw new IllegalArgumentException("app.frontend-base-url must be an HTTP(S) origin.");
        return value.replaceAll("/+$", "");
    }

    @Configuration
    @ConditionalOnProperty(name = "app.google.enabled", havingValue = "true")
    static class GoogleClientConfiguration {
        @Bean
        ClientRegistrationRepository googleClient(
                @Value("${app.google.client-id:}") String id,
                @Value("${app.google.client-secret:}") String secret,
                @Value("${app.frontend-base-url}") String frontend) {
            if (id.isBlank() || secret.isBlank()) throw new IllegalArgumentException("Google OAuth credentials are required when enabled.");
            var registration = CommonOAuth2Provider.GOOGLE.getBuilder("google")
                    .clientId(id).clientSecret(secret).scope("openid", "profile", "email")
                    .redirectUri(origin(frontend) + "/login/oauth2/code/google").build();
            return new InMemoryClientRegistrationRepository(registration);
        }
    }
}
