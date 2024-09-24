package com.clinton.authorization_server.service;

import com.clinton.authorization_server.model.SQSClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.*;

import java.util.ArrayList;
import java.util.List;

/**
 * @author Clinton Fernandes
 */
@Service
@Profile("polling")
public class SendMessageToSQS {

    private static final Logger LOG = LoggerFactory.getLogger(SendMessageToSQS.class);

    private final SqsClient sqsClient;

    @Value("${POLLING.QUEUE.URL}")
    private String queueUrl;

    @Autowired
    public SendMessageToSQS(SQSClient _sqsClient) {
        this.sqsClient = _sqsClient.getSqsClient();
    }

    public void sendMessageInBatch(List<Long> authorizedTransactions) {
        List<SendMessageBatchRequestEntry> entries = new ArrayList<>();
        for (int i = 0; i < authorizedTransactions.size(); i++) {
            entries.add((SendMessageBatchRequestEntry.builder().id(String.valueOf(i+1)).messageBody(String.valueOf(authorizedTransactions.get(i))).build()));
            if ((i+1) % 10 == 0) {
                this.sendMessagesBatch(entries);
                entries = new ArrayList<>();
            }
        }
        if (!entries.isEmpty()) {
            this.sendMessagesBatch(entries);
        }
    }

    @Async
    private void sendMessagesBatch(List<SendMessageBatchRequestEntry> entries) {
        List<SendMessageBatchResultEntry> successfulEntries;
        List<BatchResultErrorEntry> failedEntries;
        entries.forEach((entry) -> {
            LOG.info("ID: " + entry.id() + " Transaction: " + entry.messageBody());
        });
        try {
            SendMessageBatchRequest sendMessageBatchRequest = SendMessageBatchRequest.builder().queueUrl(queueUrl).entries(entries).build();
            SendMessageBatchResponse sendMessageBatchResponse = sqsClient.sendMessageBatch(sendMessageBatchRequest);
            if (sendMessageBatchResponse.hasSuccessful()) {
                successfulEntries = sendMessageBatchResponse.successful();
                LOG.info("Processed below entries: ");
                successfulEntries.forEach((entry) -> {
                    LOG.info(entry.messageId());
                });
            }
            if (sendMessageBatchResponse.hasFailed()) {
                failedEntries = sendMessageBatchResponse.failed();
                LOG.info("Below entries failed: ");
                failedEntries.forEach((entry) -> {
                    LOG.info(entry.id() + " " + entry.message());
                });
            }
        } catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }
}
