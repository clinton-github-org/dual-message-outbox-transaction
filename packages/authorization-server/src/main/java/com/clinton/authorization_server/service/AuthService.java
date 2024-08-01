package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.Account;
import com.clinton.authorization_server.model.Authorization;
import com.clinton.authorization_server.model.Outbox;
import com.clinton.authorization_server.model.Status;
import com.clinton.authorization_server.repository.AccountRepository;
import com.clinton.authorization_server.repository.AuthorizationRepository;
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
import java.util.HashMap;
import java.util.Map;

/**
 * @author Clinton Fernandes
 */
@Service
public class AuthService {

    Map<String, String> success = new HashMap<>(1);
    Map<String, String> failure = new HashMap<>(1);

    @Autowired
    private AccountRepository accountRepository;
    @Autowired
    private AuthorizationRepository authorizationRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_UNCOMMITTED, timeout = 180, rollbackFor = {DataAccessException.class, SQLException.class, TransactionException.class})
    public ResponseEntity<Map<String, String>> authorizePaymentTransaction(Authorization authorization) throws SQLException {
        Outbox outbox = new Outbox();
        if (!hasBalance(authorization.getSenderAccountId(), new BigDecimal(String.valueOf(authorization.getAmount())))) {
            outbox.setStatus(Status.DECLINED);
            failure.put("Failure", "Insufficient funds for transaction in account " + authorization.getSenderAccountId());
            saveEntry(authorization, outbox);
            return new ResponseEntity<>(failure, HttpStatus.OK);
        } else {
            outbox.setStatus(Status.AUTHORIZED);
            authorization = saveEntry(authorization, outbox);
            success.put("Success", "Payment has been authorized! You will be notified once transaction is complete, please note reference ID: " + authorization.getOutbox().getId());
            return new ResponseEntity<>(success, HttpStatus.ACCEPTED);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY, readOnly = true, isolation = Isolation.READ_COMMITTED)
    public boolean hasBalance(Integer senderAccountId, BigDecimal amount) {
        Account account = accountRepository.getReferenceById(senderAccountId);
        BigDecimal reservedAmount = authorizationRepository.getReservedAmount(senderAccountId);
        return (account.getAccountBalance().subtract(reservedAmount == null ? BigDecimal.ZERO : reservedAmount)).subtract(amount).compareTo(BigDecimal.ZERO) >= 0;
    }

    private Authorization saveEntry(Authorization authorization, Outbox outbox) {
        outbox.setAuthorization(authorization);
        authorization.setOutbox(outbox);
        return authorizationRepository.save(authorization);
    }
}
