package com.launchpad.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VersionController {

    @GetMapping("/version")
    public Map<String, Object> version() {
        return Map.of(
                "success", true,
                "name", "launchpad-api",
                "version", "0.0.1-SNAPSHOT"
        );
    }
}
