package com.clinton.authorization_server.controller;

import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * @author Clinton Fernandes
 */
@RestController
@RequestMapping("/api/v1/account")
public class AccountController {

    private final AccountService accountService;
    Map<String, String> failure = new HashMap<>(1);

    @Autowired
    public AccountController(AccountService _accountService) {
        this.accountService = _accountService;
    }

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AddAccountDoc
    public ResponseEntity<Map<String, String>> addAccount(@Valid @RequestBody Account account) {
        return accountService.createAccount(account);
    }

    @DeleteMapping(path = "/{accountId}", produces = "application/json")
    @ControllerAnnotations.DeleteAccountDoc
    public ResponseEntity<Map<String, String>> deleteAccount(@PathVariable Integer accountId) {
        if (accountService.checkAccount(accountId)) {
            return accountService.deleteAccount(accountId);
        } else {
            failure.put("Failure", "Account not found!");
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping(path = "/credit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.CreditAccountDoc
    public ResponseEntity<Map<String, String>> creditAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        if (accountService.checkAccount(accountId)) {
            return accountService.creditAccount(accountId, amount);
        } else {
            failure.put("Failure", "Account not found!");
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping(path = "/debit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.DebitAccountDoc
    public ResponseEntity<Map<String, String>> debitAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        if (accountService.checkAccount(accountId)) {
            return accountService.debitAccount(accountId, amount);
        } else {
            failure.put("Failure", "Account not found!");
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        }
    }
}
