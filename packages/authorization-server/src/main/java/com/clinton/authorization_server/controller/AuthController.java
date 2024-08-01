package com.clinton.authorization_server.controller;


import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.service.AccountService;
import com.clinton.authorization_server.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.SQLException;
import java.text.MessageFormat;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * @author Clinton Fernandes
 */
@RestController
@RequestMapping(path = "/api/v1/authorize")
public class AuthController {

    Map<String, String> failure = new HashMap<>(1);
    @Autowired
    private AuthService authService;

    @Autowired
    private AccountService accountService;

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AuthorizeTransactionDoc
    public ResponseEntity<Map<String, String>> authorizeTransaction(@Valid @RequestBody Authorization authorization) throws SQLException {
        if (!accountService.checkAccount(authorization.getSenderAccountId())) {
            failure.put("Failure", MessageFormat.format("Account {0} not found!", authorization.getSenderAccountId()));
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        } else if (!accountService.checkAccount(authorization.getReceiverAccountId())) {
            failure.put("Failure", MessageFormat.format("Account {0} not found!", authorization.getReceiverAccountId()));
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        } else {
            authorization.setTimestamp(LocalDateTime.now());
            return authService.authorizePaymentTransaction(authorization);
        }

    }


}
