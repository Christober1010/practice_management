<?php
/**
 * Check Google API Client Dependencies
 * 
 * This script verifies that all required Google API client dependencies are installed.
 * Access this file in your browser to see what's missing.
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Google API Client Dependency Check</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        h2 { border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Google API Client Dependency Check</h1>
    
    <?php
    $issues = [];
    $warnings = [];
    
    // Check 1: Composer autoloader
    echo "<h2>1. Composer Autoloader</h2>";
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (file_exists($autoload)) {
        echo "<p class='success'>✓ vendor/autoload.php found</p>";
        try {
            require_once $autoload;
            echo "<p class='success'>✓ Autoloader loaded successfully</p>";
        } catch (Exception $e) {
            echo "<p class='error'>✗ Failed to load autoloader: " . htmlspecialchars($e->getMessage()) . "</p>";
            $issues[] = "Autoloader failed to load";
        }
    } else {
        echo "<p class='error'>✗ vendor/autoload.php not found</p>";
        $issues[] = "Composer dependencies not installed";
        echo "<pre>Run: composer install</pre>";
    }
    
    // Check 2: Google Client class
    echo "<h2>2. Google Client Class</h2>";
    if (class_exists('Google\\Client')) {
        echo "<p class='success'>✓ Google\\Client class found</p>";
    } else {
        echo "<p class='error'>✗ Google\\Client class not found</p>";
        $issues[] = "Google Client class missing";
    }
    
    // Check 3: OAuth2 class
    echo "<h2>3. Google Auth OAuth2 Class</h2>";
    if (class_exists('Google\\Auth\\OAuth2')) {
        echo "<p class='success'>✓ Google\\Auth\\OAuth2 class found</p>";
    } else {
        echo "<p class='error'>✗ Google\\Auth\\OAuth2 class not found</p>";
        $issues[] = "OAuth2 class missing - dependencies incomplete";
    }
    
    // Check 4: Other required classes
    echo "<h2>4. Other Required Classes</h2>";
    $requiredClasses = [
        'Google\\Service\\Drive',
        'Google\\Service\\Drive\\DriveFile',
        'Google\\Auth\\ApplicationDefaultCredentials',
    ];
    
    foreach ($requiredClasses as $class) {
        if (class_exists($class)) {
            echo "<p class='success'>✓ {$class} found</p>";
        } else {
            echo "<p class='warning'>⚠ {$class} not found (may not be needed for OAuth flow)</p>";
        }
    }
    
    // Check 5: Composer.json
    echo "<h2>5. Composer Configuration</h2>";
    $composerJson = __DIR__ . '/../composer.json';
    if (file_exists($composerJson)) {
        echo "<p class='success'>✓ composer.json found</p>";
        $composer = json_decode(file_get_contents($composerJson), true);
        if (isset($composer['require']['google/apiclient'])) {
            $version = $composer['require']['google/apiclient'];
            echo "<p class='success'>✓ google/apiclient required: {$version}</p>";
        } else {
            echo "<p class='error'>✗ google/apiclient not in composer.json</p>";
            $issues[] = "google/apiclient not in composer.json";
        }
    } else {
        echo "<p class='error'>✗ composer.json not found</p>";
        $issues[] = "composer.json missing";
    }
    
    // Check 6: Vendor directory structure
    echo "<h2>6. Vendor Directory Structure</h2>";
    $vendorDir = __DIR__ . '/../vendor';
    if (is_dir($vendorDir)) {
        echo "<p class='success'>✓ vendor/ directory exists</p>";
        
        $googleDir = $vendorDir . '/google';
        if (is_dir($googleDir)) {
            echo "<p class='success'>✓ vendor/google/ directory exists</p>";
            
            $apiclientDir = $googleDir . '/apiclient';
            if (is_dir($apiclientDir)) {
                echo "<p class='success'>✓ vendor/google/apiclient/ directory exists</p>";
            } else {
                echo "<p class='error'>✗ vendor/google/apiclient/ directory not found</p>";
                $issues[] = "google/apiclient package not installed";
            }
            
            // Check for auth package (required for OAuth2)
            $authDir = $googleDir . '/auth';
            if (is_dir($authDir)) {
                echo "<p class='success'>✓ vendor/google/auth/ directory exists</p>";
                
                // Check for OAuth2.php file
                $oauth2File = $authDir . '/src/OAuth2.php';
                if (file_exists($oauth2File)) {
                    echo "<p class='success'>✓ OAuth2.php file found</p>";
                } else {
                    echo "<p class='error'>✗ OAuth2.php file not found in vendor/google/auth/</p>";
                    $issues[] = "OAuth2 class file missing - incomplete installation";
                }
            } else {
                echo "<p class='error'>✗ vendor/google/auth/ directory not found</p>";
                $issues[] = "google/auth package missing - required for OAuth2";
            }
        } else {
            echo "<p class='error'>✗ vendor/google/ directory not found</p>";
            $issues[] = "Google packages not installed";
        }
    } else {
        echo "<p class='error'>✗ vendor/ directory not found</p>";
        $issues[] = "Composer dependencies not installed";
    }
    
    // Summary
    echo "<h2>Summary</h2>";
    if (empty($issues)) {
        echo "<p class='success'><strong>✓ All checks passed! Google API client is properly installed.</strong></p>";
    } else {
        echo "<p class='error'><strong>✗ Issues found:</strong></p>";
        echo "<ul>";
        foreach ($issues as $issue) {
            echo "<li class='error'>{$issue}</li>";
        }
        echo "</ul>";
        echo "<h3>How to Fix:</h3>";
        
        // Check if composer.json exists to determine if this is IONOS shared hosting
        $composerJsonExists = file_exists(__DIR__ . '/../composer.json');
        
        if (!$composerJsonExists) {
            echo "<div style='background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;'>";
            echo "<strong>⚠ IONOS Shared Hosting Detected</strong><br>";
            echo "Since composer.json is not on the server, you're likely on shared hosting.<br>";
            echo "👉 <a href='IONOS_SHARED_HOSTING_SETUP.md' target='_blank'>See IONOS_SHARED_HOSTING_SETUP.md for detailed instructions</a>";
            echo "</div>";
        }
        
        echo "<h4>Option 1: Install Locally and Upload (Recommended for IONOS)</h4>";
        echo "<pre>";
        echo "1. On your LOCAL computer, install Composer:\n";
        echo "   Download from: https://getcomposer.org/download/\n\n";
        echo "2. Navigate to your project directory locally:\n";
        echo "   cd /path/to/maha-launchpad\n\n";
        echo "3. Delete the existing vendor/ folder (if it exists):\n";
        echo "   rm -rf vendor/  (Mac/Linux)\n";
        echo "   rmdir /s vendor  (Windows)\n\n";
        echo "4. Run composer install:\n";
        echo "   composer install --no-dev\n\n";
        echo "5. Verify vendor/google/auth/ exists locally\n\n";
        echo "6. Upload the ENTIRE vendor/ folder to your server via FTP\n";
        echo "   Make sure to upload ALL subdirectories and files\n";
        echo "</pre>";
        
        echo "<h4>Option 2: SSH Access (If Available)</h4>";
        echo "<pre>";
        echo "1. SSH into your server\n";
        echo "2. Navigate to the project directory:\n";
        echo "   cd /path/to/maha-launchpad\n";
        echo "3. Delete incomplete vendor folder:\n";
        echo "   rm -rf vendor/\n";
        echo "4. Run composer install:\n";
        echo "   composer install --no-dev\n";
        echo "5. If composer is not installed, install it first:\n";
        echo "   php -r \"copy('https://getcomposer.org/installer', 'composer-setup.php');\"\n";
        echo "   php composer-setup.php\n";
        echo "   php -r \"unlink('composer-setup.php');\"\n";
        echo "</pre>";
        
        echo "<div style='background: #d1ecf1; padding: 15px; border-left: 4px solid #0c5460; margin: 20px 0;'>";
        echo "<strong>💡 Important:</strong><br>";
        echo "The vendor/ folder must include ALL dependencies, not just google/apiclient.<br>";
        echo "Make sure vendor/google/auth/ directory exists with OAuth2.php file.<br>";
        echo "The folder is typically 50-100MB in size when complete.";
        echo "</div>";
    }
    ?>
</body>
</html>

