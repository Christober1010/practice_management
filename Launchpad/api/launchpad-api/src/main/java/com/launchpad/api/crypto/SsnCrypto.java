package com.launchpad.api.crypto;

import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM encryption matching PHP encryptSensitiveValue / decryptSensitiveValue.
 * Payload format: base64(iv[12] + tag[16] + ciphertext).
 */
@Component
public class SsnCrypto {

    private static final int IV_LEN = 12;
    private static final int TAG_LEN = 16;

    private final byte[] key;
    private final SecureRandom secureRandom = new SecureRandom();

    public SsnCrypto(@Value("${launchpad.ssn-encryption-key:}") String keyB64) {
        byte[] decoded = null;
        if (keyB64 != null && !keyB64.isBlank()) {
            try {
                decoded = Base64.getDecoder().decode(keyB64.trim());
                if (decoded.length != 32) {
                    decoded = null;
                }
            } catch (IllegalArgumentException ignored) {
                decoded = null;
            }
        }
        this.key = decoded;
    }

    public boolean isConfigured() {
        return key != null;
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || key == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LEN];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LEN * 8, iv));
            byte[] cipherWithTag = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            // Java appends the tag to the ciphertext
            byte[] ciphertext = new byte[cipherWithTag.length - TAG_LEN];
            byte[] tag = new byte[TAG_LEN];
            System.arraycopy(cipherWithTag, 0, ciphertext, 0, ciphertext.length);
            System.arraycopy(cipherWithTag, ciphertext.length, tag, 0, TAG_LEN);
            ByteBuffer buf = ByteBuffer.allocate(IV_LEN + TAG_LEN + ciphertext.length);
            buf.put(iv);
            buf.put(tag);
            buf.put(ciphertext);
            return Base64.getEncoder().encodeToString(buf.array());
        } catch (Exception ex) {
            return null;
        }
    }

    public String decrypt(String payloadB64) {
        if (payloadB64 == null || payloadB64.isBlank() || key == null) {
            return null;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(payloadB64);
            if (raw.length < IV_LEN + TAG_LEN + 1) {
                return null;
            }
            byte[] iv = new byte[IV_LEN];
            byte[] tag = new byte[TAG_LEN];
            byte[] ciphertext = new byte[raw.length - IV_LEN - TAG_LEN];
            System.arraycopy(raw, 0, iv, 0, IV_LEN);
            System.arraycopy(raw, IV_LEN, tag, 0, TAG_LEN);
            System.arraycopy(raw, IV_LEN + TAG_LEN, ciphertext, 0, ciphertext.length);

            byte[] cipherWithTag = new byte[ciphertext.length + TAG_LEN];
            System.arraycopy(ciphertext, 0, cipherWithTag, 0, ciphertext.length);
            System.arraycopy(tag, 0, cipherWithTag, ciphertext.length, TAG_LEN);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LEN * 8, iv));
            byte[] plain = cipher.doFinal(cipherWithTag);
            return new String(plain, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return null;
        }
    }
}
