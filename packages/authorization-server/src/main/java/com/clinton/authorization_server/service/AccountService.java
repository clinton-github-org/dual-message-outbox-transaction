package com.clinton.authorization_server.service;

import com.clinton.authorization_server.exceptions.AccountNotFoundException;
import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.Optional;

/**
 * @author Clinton Fernandes
 */
@Service
@Profile("auth")
public class AccountService {
    private final AccountRepository accountRepository;

    @Autowired
    public AccountService(AccountRepository _accountRepository) {
        this.accountRepository = _accountRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public Account createAccount(Account account) {
        account.setReservedAmount(BigDecimal.ZERO);
        return accountRepository.save(account);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public void deleteAccount(Integer accountId) {
        if (accountRepository.existsById(accountId)) {
            accountRepository.delete(accountRepository.getReferenceById(accountId));
        } else {
            throw new AccountNotFoundException("Account with id " + accountId + " not found");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public void creditAccount(Integer accountId, BigDecimal amount) {
        Optional<Account> account = accountRepository.findById(accountId);
        if (account.isPresent()) {
            account.get().creditAccount(amount);
            accountRepository.save(account.get());
        } else {
            throw new AccountNotFoundException("Account with id " + accountId + " not found");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED, rollbackFor = {DataAccessException.class, SQLException.class, TransactionException.class})
    public void debitAccount(Integer accountId, BigDecimal amount) {
        Optional<Account> account = accountRepository.findById(accountId);
        if (account.isPresent()) {
            account.get().debitAccount(amount);
            accountRepository.save(account.get());
        } else {
            throw new AccountNotFoundException("Account with id " + accountId + " not found");
        }
    }
}
