package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.text.MessageFormat;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * @author Clinton Fernandes
 */
@Service
public class AccountService {

    Map<String, String> success = new HashMap<>(1);
    Map<String, String> failure = new HashMap<>(1);
    private final AccountRepository accountRepository;

    @Autowired
    public AccountService(AccountRepository _accountRepository) {
        this.accountRepository = _accountRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public ResponseEntity<Map<String, String>> createAccount(Account account) {
        account = accountRepository.save(account);
        success.put("Success", "Account created with account number: " + account.getAccountNumber());
        return new ResponseEntity<>(success, HttpStatus.CREATED);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public ResponseEntity<Map<String, String>> deleteAccount(Integer accountId) {
        accountRepository.delete(accountRepository.getReferenceById(accountId));
        success.put("Success", "Account deleted with account number: " + accountId);
        return new ResponseEntity<>(success, HttpStatus.CREATED);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public ResponseEntity<Map<String, String>> creditAccount(Integer accountId, BigDecimal amount) {
        Optional<Account> optionalAccount = accountRepository.findById(accountId);
        if (optionalAccount.isPresent()) {
            optionalAccount.get().setAccountBalance(optionalAccount.get().getAccountBalance().add(amount));
            accountRepository.save(optionalAccount.get());
            success.put("Success", MessageFormat.format("Amount {0} credited to account {1}", amount, accountId));
            return new ResponseEntity<>(success, HttpStatus.ACCEPTED);
        } else {
            failure.put("Failure", "Account not found!");
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED, rollbackFor = {DataAccessException.class, SQLException.class, TransactionException.class})
    public ResponseEntity<Map<String, String>> debitAccount(Integer accountId, BigDecimal amount) {
        Optional<Account> optionalAccount = accountRepository.findById(accountId);
        Map<String, String> result = new HashMap<>();
        if (optionalAccount.isPresent()) {
            if (optionalAccount.get().getAccountBalance().subtract(amount).compareTo(BigDecimal.ZERO) < 0) {
                failure.put("Failure", "Insufficient Funds!");
                return new ResponseEntity<>(failure, HttpStatus.OK);
            } else {
                optionalAccount.get().setAccountBalance(optionalAccount.get().getAccountBalance().subtract(amount));
                Account account = accountRepository.save(optionalAccount.get());
                success.put("Success", MessageFormat.format("Account {0} debited with {1}, remaining balance: {2}", accountId, amount, account.getAccountBalance()));
                return new ResponseEntity<>(success, HttpStatus.ACCEPTED);
            }
        } else {
            failure.put("Failure", "Account not found!");
            return new ResponseEntity<>(failure, HttpStatus.NOT_FOUND);
        }
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public boolean checkAccount(Integer accountId) {
        return accountRepository.findById(accountId).isPresent();
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED)
    public Account findAccount(Integer accountId) {
        Optional<Account> optionalAccount = accountRepository.findById(accountId);
        if (optionalAccount.isPresent()) {
            return optionalAccount.get();
        } else {
            throw new RuntimeException("Account Id: " + accountId + " not found");
        }
    }
}
