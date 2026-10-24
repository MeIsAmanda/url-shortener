package com.amanda.urlshortener.web;

import com.amanda.urlshortener.link.LinkNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler extends org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    public record ApiError(String code, String message) { }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            org.springframework.http.HttpHeaders headers, org.springframework.http.HttpStatusCode status,
            org.springframework.web.context.request.WebRequest request) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Send a JSON object with an originalUrl field."));
    }

    @ExceptionHandler(LinkNotFoundException.class)
    ResponseEntity<ApiError> missing(LinkNotFoundException ex) {
        return ResponseEntity.status(404).body(new ApiError("LINK_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) {
        // Do not log exception messages that could contain submitted URLs or SQL values.
        log.error("Request failed with {}", ex.getClass().getSimpleName());
        return ResponseEntity.internalServerError().body(new ApiError("SERVER_ERROR", "Something went wrong. Please try again."));
    }
}
