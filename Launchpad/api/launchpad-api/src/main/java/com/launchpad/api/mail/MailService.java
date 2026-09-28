package com.launchpad.api.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public MailService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${launchpad.smtp-from:noreply@launchpad.local}") String fromAddress
    ) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public boolean sendHtml(String to, String subject, String htmlBody) {
        if (to == null || to.isBlank()) {
            return false;
        }
        if (mailSender == null) {
            log.info("[mail-disabled] to={} subject={} bodyPreview={}", to, subject, preview(htmlBody));
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            return true;
        } catch (Exception ex) {
            log.warn("Failed to send mail to {}: {}", to, ex.getMessage());
            return false;
        }
    }

    public void logOtpForLocalDev(String email, String otp) {
        log.info("[local-otp] email={} otp={}", email, otp);
    }

    private static String preview(String html) {
        if (html == null) {
            return "";
        }
        String plain = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return plain.length() > 160 ? plain.substring(0, 160) + "..." : plain;
    }
}
