<?php

header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/Exception.php';
require __DIR__ . '/PHPMailer/PHPMailer.php';
require __DIR__ . '/PHPMailer/SMTP.php';

// Debug mode true or false
$debug = false;

// Set mailer to use SMTP or PHP's mail() function
// If you use SMTP, it will be "true". Otherwise, it will be "false"
$useSMTP = false;  

// Recipient name. Change this name to your
$recipientName = "Joe User";

// Recipient email. Change this email to your
$recipientEmail = "joe@example.com";

// Collect form data
$name    = trim($_POST['name'] ?? '');
$email   = trim($_POST['email'] ?? '');
$subject = trim($_POST['subject'] ?? '(No Subject)');
$message = trim($_POST['message'] ?? '');

// Optional mobile field
$mobile = isset($_POST['mobile']) ? trim($_POST['mobile']) : "";

// Required fields check
if (!$name || !$email || !$message) {
    echo json_encode(['status' => 'error', 'message' => 'Please fill all required fields.']);
    exit;
}

// Email content
$htmlBody = "<p><strong>Name:</strong> {$name}</p>";
$htmlBody .= "<p><strong>Email:</strong> {$email}</p>";
if ($mobile) $htmlBody .= "<p><strong>Mobile:</strong> {$mobile}</p>";
$htmlBody .= "<p><strong>Subject:</strong> {$subject}</p>";
$htmlBody .= "<p><strong>Message:</strong><br>{$message}</p>";

$plainBody = "Name: {$name}\nEmail: {$email}\n";
if ($mobile) $plainBody .= "Mobile: {$mobile}\n";
$plainBody .= "Subject: {$subject}\n\n{$message}";

// PHPMailer setup
$mail = new PHPMailer(true);

try {
    if ($useSMTP) {
        // SMTP Settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';               // Change to your SMTP host
        $mail->SMTPAuth   = true;
        $mail->Username   = 'yourname@gmail.com';           // SMTP username
        $mail->Password   = 'your-app-password';            // SMTP password or App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // or PHPMailer::ENCRYPTION_SMTPS
        $mail->Port       = 587;                            // 465 for SSL
        if ($debug) $mail->SMTPDebug = 2;
    } else {
        // PHP mail() fallback
        $mail->isMail();
    }

    // Sender / Recipient
    // $mail->setFrom('noreply@yourdomain.com', 'Contact Form');
    $mail->setFrom($email, $name);
    $mail->addAddress($recipientEmail, $recipientName);
    $mail->addReplyTo($email, $name);

    // Message
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $htmlBody;
    $mail->AltBody = $plainBody;

    // Send email
    $mail->send();

    // Success message
    echo json_encode(['status' => 'success', 'message' => 'Your message has been sent successfully!']);

} catch (Exception $e) {
    // Error message
    $errorMessage = $debug ? $mail->ErrorInfo : 'Email could not be sent. Please try again later.';
    echo json_encode(['status' => 'error', 'message' => $errorMessage]);
}
