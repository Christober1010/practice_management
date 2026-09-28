package com.launchpad.api.staff;

import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/staff")
public class StaffController {

    private final StaffService staffService;

    public StaffController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "share_key", required = false) String shareKey,
            @RequestParam(value = "user_id", required = false) Integer userId
    ) {
        return staffService.listStaff(name, shareKey, userId);
    }

    @PostMapping("/submissions")
    public Map<String, Object> submit(@RequestBody Map<String, Object> body) {
        return staffService.submitForm(body);
    }

    @PostMapping("/share-keys")
    public Map<String, Object> shareKey(@RequestBody Map<String, Object> body) {
        return staffService.createShareKey(body);
    }

    @PostMapping("/reminders")
    public Map<String, Object> reminder(@RequestBody Map<String, Object> body) {
        return staffService.sendReminder(body);
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable("id") long id) {
        return staffService.downloadAttachment(id, false);
    }

    @GetMapping("/attachments/{id}/view")
    public ResponseEntity<Resource> view(@PathVariable("id") long id) {
        return staffService.downloadAttachment(id, true);
    }
}
