package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * @author Clinton Fernandes
 */
public class AccountService {

    @Autowired
    private AccountRepository accountRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public Account createAccount(Account account) {
        return accountRepository.save(account);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    public void deleteAccount(Integer accountId) {
        accountRepository.delete(accountRepository.getReferenceById(accountId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public void creditAccount(Integer accountId, BigDecimal amount) {
        Account account = accountRepository.getReferenceById(accountId);
        account.setAccountBalance(account.getAccountBalance().add(amount));
        accountRepository.save(account);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public boolean debitAccount(Integer accountId, BigDecimal amount) {
        Account account = accountRepository.getReferenceById(accountId);
        if (account.getAccountBalance().subtract(amount).compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        account.setAccountBalance(account.getAccountBalance().subtract(amount));
        accountRepository.save(account);
        return true;
    }
}
