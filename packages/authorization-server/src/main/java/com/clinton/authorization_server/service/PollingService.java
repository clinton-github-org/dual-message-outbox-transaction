package com.clinton.authorization_server.service;

import com.clinton.authorization_server.repository.AuthorizationRepository;
import com.clinton.authorization_server.repository.OutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.ecs.EcsClient;
import software.amazon.awssdk.services.ecs.model.StopTaskRequest;
import software.amazon.awssdk.services.ecs.model.StopTaskResponse;

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

    @Value("${CLUSTER.NAME}")
    private String clusterName;

    @Value("${TASK.ARN}")
    private String taskArn;

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
            } else {
                stopEcsTask();
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

    private void stopEcsTask() {
        try (EcsClient ecsClient = EcsClient.create()) {
            StopTaskRequest stopTaskRequest = StopTaskRequest.builder().cluster(clusterName).task(taskArn).reason("Stopping task due to scheduled event").build();

            StopTaskResponse stopTaskResponse = ecsClient.stopTask(stopTaskRequest);

            LOG.info("Task stopped! Task ARN: " + stopTaskResponse.task().taskArn());
        } catch (Exception exception) {
            LOG.error(exception.getMessage(), exception);
            throw new RuntimeException();
        }
    }
}
