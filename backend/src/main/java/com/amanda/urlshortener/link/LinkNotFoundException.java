package com.amanda.urlshortener.link;

public class LinkNotFoundException extends RuntimeException {
    public LinkNotFoundException() { super("This short link could not be found."); }
}
