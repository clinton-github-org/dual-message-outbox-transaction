package com.clinton.authorization_server.controller;


import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.model.Status;
import com.clinton.authorization_server.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
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
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AuthorizeTransactionDoc
    public String authorizeTransaction(@RequestBody Authorization authorization) {
        authorization.setTimestamp(LocalDateTime.now());
        if (authService.authorizePaymentTransaction(authorization).equals(Status.AUTHORIZED)) {
            return "Payment has been authorized! You will be notified once transaction is complete";
        } else if (authService.authorizePaymentTransaction(authorization).equals(Status.DECLINED)) {
            return "Payment has been declined, please try again";
        } else {
            return "Server error, please try again";
        }
    }


}
