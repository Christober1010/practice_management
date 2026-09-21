package com.mahaverse.api.web;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VersionController {

    @GetMapping("/version")
    public Map<String, Object> version() {
        return Map.of(
                "service", "mahaverse-api",
                "status", "ok",
                "time", Instant.now().toString()
        );
    }
}

