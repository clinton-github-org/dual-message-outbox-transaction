package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.model.Outbox;
import com.clinton.authorization_server.model.Status;
import com.clinton.authorization_server.repository.AccountRepository;
import com.clinton.authorization_server.repository.AuthorizationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.SQLException;

/**
 * @author Clinton Fernandes
 */
@Service
public class AuthService {

    @Autowired
    private AccountRepository accountRepository;
    @Autowired
    private AuthorizationRepository authorizationRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_UNCOMMITTED, timeout = 180, rollbackFor = {DataAccessException.class, SQLException.class, TransactionException.class})
    public Status authorizePaymentTransaction(Authorization authorization) {
        Outbox outbox = new Outbox();
        if (!hasBalance(authorization.getSenderAccountId(), new BigDecimal(String.valueOf(authorization.getAmount())))) {
            outbox.setStatus(Status.DECLINED);
        } else {
            outbox.setStatus(Status.AUTHORIZED);
        }
        outbox.setAuthorization(authorization);
        authorization.setOutbox(outbox);
        authorization = authorizationRepository.save(authorization);
        return authorization.getOutbox().getStatus();
    }

    @Transactional(propagation = Propagation.MANDATORY, readOnly = true, isolation = Isolation.READ_COMMITTED)
    public boolean hasBalance(Integer senderAccountId, BigDecimal amount) {
        Account account = accountRepository.getReferenceById(senderAccountId);

        return account.getAccountBalance().subtract(amount).compareTo(BigDecimal.ZERO) >= 0;
    }


}
