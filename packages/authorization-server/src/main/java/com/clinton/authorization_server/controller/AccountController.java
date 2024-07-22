package com.clinton.authorization_server.controller;

import com.clinton.authorization_server.annotations.ControllerAnnotations;
import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.service.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.text.MessageFormat;

/**
 * @author Clinton Fernandes
 */
@RestController
@RequestMapping("/api/v1/account")
public class AccountController {

    @Autowired
    private AccountService accountService;

    @PostMapping(path = "/", produces = "application/json")
    @ControllerAnnotations.AddAccountDoc
    public Account addAccount(@RequestBody Account account) {
        return accountService.createAccount(account);
    }

    @DeleteMapping(path = "/{accountId}", produces = "application/json")
    @ControllerAnnotations.DeleteAccountDoc
    public String deleteAccount(@PathVariable Integer accountId) {
        accountService.deleteAccount(accountId);
        return MessageFormat.format("Account {0}", accountId);
    }

    @PostMapping(path = "/credit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.CreditAccountDoc
    public String creditAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        accountService.creditAccount(accountId, amount);
        return MessageFormat.format("Amount {0} credited to account {1}", amount, accountId);
    }

    @PostMapping(path = "/debit/{accountId}/{amount}", produces = "application/json")
    @ControllerAnnotations.DebitAccountDoc
    public String debitAccount(@PathVariable Integer accountId, @PathVariable BigDecimal amount) {
        if (accountService.debitAccount(accountId, amount)) {
            return MessageFormat.format("Amount {0} debited from account {1}", amount, accountId);
        } else {
            return MessageFormat.format("Insufficient funds in account {0}", accountId);
        }
    }
}
