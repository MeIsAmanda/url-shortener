package com.amanda.urlshortener.account;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_accounts")
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 255)
    private String googleSubject;
    @Column(nullable = false, length = 255)
    private String displayName;
    @Column(length = 320)
    private String email;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected UserAccount() { }
    public UserAccount(String subject, String name, String email) {
        this.googleSubject = subject;
        this.displayName = name;
        this.email = email;
        this.createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
}
