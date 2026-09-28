package com.launchpad.api.offers;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/offers")
public class OffersController {

    private final OffersService offersService;

    public OffersController(OffersService offersService) {
        this.offersService = offersService;
    }

    @GetMapping("/positions")
    public Map<String, Object> positions() {
        return offersService.listPositions();
    }

    @GetMapping("/initiations")
    public Map<String, Object> getInitiation(@RequestParam(value = "staff_id", required = false) Long staffId) {
        return offersService.getInitiation(staffId);
    }

    @PostMapping("/initiations")
    public Map<String, Object> submitInitiation(@RequestBody Map<String, Object> body) {
        return offersService.submitInitiation(body);
    }

    @GetMapping("/acceptances")
    public Map<String, Object> getAcceptance(@RequestParam(value = "staff_id", required = false) Long staffId) {
        return offersService.getAcceptance(staffId);
    }

    @PostMapping("/acceptances")
    public Map<String, Object> submitAcceptance(@RequestBody Map<String, Object> body) {
        return offersService.submitAcceptance(body);
    }

    @PostMapping("/acceptances/signed-pdf")
    public Map<String, Object> uploadSignedPdf(
            @RequestParam(value = "staff_id", required = false) Long staffId,
            @RequestPart("file") MultipartFile file
    ) throws Exception {
        return offersService.uploadSignedPdf(staffId, file);
    }
}
