package com.amanda.urlshortener.link;

import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

/** Runs after packaging via Maven Failsafe; uses only an isolated local H2 file. */
class ShortLinkRestartIT {
    @TempDir Path directory;
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void acknowledgedLinkAndSequenceSurviveAnImmediateProcessStop() throws Exception {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        String origin = "http://127.0.0.1:" + port;
        String original = "https://example.com/a-long-destination-for-the-packaged-restart-check?x=1#section";
        Process first = null;
        Process restarted = null;

        try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER).build()) {
            first = start(port, directory.resolve("first-start.log"));
            awaitReady(client, first, origin, directory.resolve("first-start.log"));
            HttpResponse<String> creation = create(client, origin, original);

            // Kill immediately after receiving the response, before parsing it.
            // A graceful shutdown would flush H2 and mask its default write delay.
            first.destroyForcibly();
            assertTrue(first.waitFor(10, TimeUnit.SECONDS), "First backend did not stop");
            assertEquals(201, creation.statusCode(), creation.body());
            String shortUrl = json.readValue(creation.body(), CreateLinkResponse.class).shortUrl();

            restarted = start(port, directory.resolve("restart.log"));
            awaitReady(client, restarted, origin, directory.resolve("restart.log"));
            HttpResponse<String> redirect = client.send(HttpRequest.newBuilder(URI.create(shortUrl))
                    .timeout(Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(302, redirect.statusCode(), redirect.body());
            assertEquals(original, redirect.headers().firstValue("Location").orElseThrow());

            HttpResponse<String> next = create(client, origin, original);
            assertEquals(201, next.statusCode(), next.body());
            String nextUrl = json.readValue(next.body(), CreateLinkResponse.class).shortUrl();
            assertTrue(decodeCode(nextUrl) > decodeCode(shortUrl), "Sequence restarted or reused an ID");
        } finally {
            stop(first);
            stop(restarted);
        }
    }

    private Process start(int port, Path log) throws Exception {
        Path java = Path.of(System.getProperty("java.home"), "bin", "java");
        Path jar = Path.of(System.getProperty("application.jar")).toAbsolutePath();
        return new ProcessBuilder(java.toString(), "-jar", jar.toString(),
                "--server.port=" + port,
                "--app.public-base-url=http://127.0.0.1:" + port,
                "--spring.datasource.url=jdbc:h2:file:" + directory.resolve("links").toAbsolutePath().toString().replace('\\', '/'),
                "--logging.level.root=WARN", "--debug=false")
            .redirectErrorStream(true).redirectOutput(log.toFile()).start();
    }

    private void awaitReady(HttpClient client, Process process, String origin, Path log) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(40).toNanos();
        while (System.nanoTime() < deadline && process.isAlive()) {
            try {
                var response = client.send(HttpRequest.newBuilder(URI.create(origin + "/s/Missing"))
                        .timeout(Duration.ofSeconds(1)).GET().build(), HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 404) return;
            } catch (java.io.IOException ignored) {
                // The server is still starting; retry within the bounded deadline.
            }
            Thread.sleep(100);
        }
        fail("Packaged backend did not become ready. Log:\n" + Files.readString(log));
    }

    private HttpResponse<String> create(HttpClient client, String origin, String original) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(origin + "/api/urls"))
                .timeout(Duration.ofSeconds(10)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(new CreateLinkRequest(original))))
                .build(), HttpResponse.BodyHandlers.ofString());
    }

    private long decodeCode(String url) {
        String code = URI.create(url).getPath().substring("/s/".length());
        String alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        long value = 0;
        for (char digit : code.toCharArray()) {
            int index = alphabet.indexOf(digit);
            assertTrue(index >= 0, "Unexpected code character");
            value = Math.addExact(Math.multiplyExact(value, 62), index);
        }
        return value;
    }

    private void stop(Process process) throws Exception {
        if (process != null && process.isAlive()) {
            process.destroy();
            if (!process.waitFor(10, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                assertTrue(process.waitFor(10, TimeUnit.SECONDS), "Backend process did not stop");
            }
        }
    }
}
