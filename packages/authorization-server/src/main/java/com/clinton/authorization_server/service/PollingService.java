package com.clinton.authorization_server.service;

import com.clinton.authorization_server.repository.AuthorizationRepository;
import com.clinton.authorization_server.repository.OutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * @author Clinton Fernandes
 */

@Profile("polling")
@Service
public class PollingService {

    private static final Logger LOG = LoggerFactory.getLogger(PollingService.class);

    private final AuthorizationRepository authorizationRepository;
    private final SendMessageToSQS sendMessageToSQS;

    @Autowired
    public PollingService(AuthorizationRepository _authorizationRepository, OutboxRepository _outboxRepository, SendMessageToSQS _sendMessageToSQS) {
        this.authorizationRepository = _authorizationRepository;
        this.sendMessageToSQS = _sendMessageToSQS;
    }

    @Scheduled(cron = "0 */5 * * * ?")
    public void pollOutboxAndSendToSqs() {
        LOG.info("Starting polling execution...");
        try {
            List<Long> authorizedTransactions = this.getAllAuthorizedTransactionsFromDB();
            LOG.info("Found entries " + authorizedTransactions.size());
            if (authorizedTransactions.size() > 0) {
                sendMessageToSQS.sendMessageInBatch(authorizedTransactions);
            }
        } catch (Exception exception) {
            LOG.error("Polling failed! ", exception.getMessage(), exception);
            throw new RuntimeException();
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.SERIALIZABLE)
    private List<Long> getAllAuthorizedTransactionsFromDB() {
        return authorizationRepository.getAuthorizedTransactions();
    }
}
