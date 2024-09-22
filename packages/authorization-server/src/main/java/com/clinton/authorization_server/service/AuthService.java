package com.clinton.authorization_server.service;

import com.clinton.authorization_server.exceptions.AccountNotFoundException;
import com.clinton.authorization_server.exceptions.BalanceNotSufficientException;
import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.model.Outbox;
import com.clinton.authorization_server.model.Status;
import com.clinton.authorization_server.repository.AccountRepository;
import com.clinton.authorization_server.repository.AuthorizationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.util.Optional;

/**
 * @author Clinton Fernandes
 */
@Service
@Profile("auth")
public class AuthService {

    private final AccountRepository accountRepository;
    private final AuthorizationRepository authorizationRepository;

    private final SendNotificationToSES sendNotificationToSES;

    @Autowired
    public AuthService(AccountRepository _accountRepository, AuthorizationRepository _authorizationRepository, SendNotificationToSES _sendNotificationToSES) {
        this.accountRepository = _accountRepository;
        this.authorizationRepository = _authorizationRepository;
        this.sendNotificationToSES = _sendNotificationToSES;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_UNCOMMITTED, timeout = 180, rollbackFor = {DataAccessException.class, SQLException.class, TransactionException.class}, noRollbackFor = {BalanceNotSufficientException.class})
    public void authorizePaymentTransaction(Authorization authorization) {
        Outbox outbox;
        Optional<Account> senderAccount = accountRepository.findById(authorization.getSenderAccountId());
        Optional<Account> receiverAccount = accountRepository.findById(authorization.getReceiverAccountId());

        if (senderAccount.isPresent() && receiverAccount.isPresent()) {
            Account account = senderAccount.get();
            if (account.sufficientBalance(authorization.getAmount())) {
                account.setReservedAmount(account.getReservedAmount().add(authorization.getAmount()));
                outbox = new Outbox(Status.AUTHORIZED, authorization);
                authorization.setOutbox(outbox);
                accountRepository.save(account);
                authorizationRepository.save(authorization);
                sendNotificationToSES.sendNotification(account.get().getPhoneNumber(), account.getAccountName());
            } else {
                outbox = new Outbox(Status.DECLINED, authorization);
                authorization.setOutbox(outbox);
                authorizationRepository.save(authorization);
                throw new BalanceNotSufficientException();
            }
        } else {
            throw new AccountNotFoundException("Account with id " + (senderAccount.isEmpty() ? authorization.getSenderAccountId() : authorization.getReceiverAccountId()) + " not found");
        }
    }
}
