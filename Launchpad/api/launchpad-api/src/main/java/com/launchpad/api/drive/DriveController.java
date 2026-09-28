package com.launchpad.api.drive;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/drive")
public class DriveController {

    private final DriveService driveService;

    public DriveController(DriveService driveService) {
        this.driveService = driveService;
    }

    @GetMapping("/oauth/start")
    public Map<String, Object> start() {
        return driveService.start();
    }

    @GetMapping({"/oauth/link", "/link"})
    public Map<String, Object> link() {
        return driveService.link();
    }

    @GetMapping({"/status", "/oauth/status"})
    public Map<String, Object> status() {
        return driveService.status();
    }

    @PostMapping({"/disconnect", "/oauth/disconnect"})
    public Map<String, Object> disconnect() {
        return driveService.disconnect();
    }

    @GetMapping("/callback")
    public Map<String, Object> callback(@RequestParam Map<String, String> params) {
        return driveService.callback(new LinkedHashMap<>(params));
    }
}
