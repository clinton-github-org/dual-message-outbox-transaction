package com.clinton.authorization_server.controller;


import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.service.AccountService;
import com.clinton.authorization_server.service.AuthService;
import com.clinton.authorization_server.service.SendNotificationToSNS;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

/**
 * @author Clinton Fernandes
 */
@RestController
@RequestMapping(path = "/api/v1/authorize")
@Profile("auth")
public class AuthController {

    private final AuthService authService;
    private final AccountService accountService;
    private final SendNotificationToSNS sendNotificationToSNS;

    @Value("${NOTIFICATION.MESSAGE}")
    private String message;

    @Value("${NOTIFICATION.SUBJECT}")
    private String subject;


    @Autowired
    public AuthController(AuthService _authService, AccountService _accountService, SendNotificationToSNS _sendNotificationToSNS) {
        this.authService = _authService;
        this.accountService = _accountService;
        this.sendNotificationToSNS = _sendNotificationToSNS;
    }

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AuthorizeTransactionDoc
    public ResponseEntity<String> authorizeTransaction(@Valid @RequestBody Authorization authorization) {
        authorization.setTimestamp(LocalDateTime.now());
        authService.authorizePaymentTransaction(authorization);
        return ResponseEntity.ok("Authorized! Clearance to be done soon");
    }


}
