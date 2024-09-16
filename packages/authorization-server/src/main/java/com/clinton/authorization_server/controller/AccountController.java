package com.clinton.authorization_server.controller;

import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
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
@Profile("auth")
public class AccountController {

    private final AccountService accountService;
    Map<String, String> failure = new HashMap<>(1);

    @Autowired
    public AccountController(AccountService _accountService) {
        this.accountService = _accountService;
    }

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AddAccountDoc
    public ResponseEntity<Account> addAccount(@Valid @RequestBody Account account) {
        return ResponseEntity.status(HttpStatus.CREATED).body(accountService.createAccount(account));
    }

    @DeleteMapping(path = "/{accountId}", produces = "application/json")
    @ControllerAnnotations.DeleteAccountDoc
    public ResponseEntity<Void> deleteAccount(@PathVariable Integer accountId) {
        accountService.deleteAccount(accountId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/credit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.CreditAccountDoc
    public ResponseEntity<String> creditAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        accountService.creditAccount(accountId, amount);
        return ResponseEntity.ok("Account credited with " + amount);
    }

    @PostMapping(path = "/debit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.DebitAccountDoc
    public ResponseEntity<Void> debitAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        accountService.debitAccount(accountId, amount);
        return ResponseEntity.noContent().build();
    }
}
