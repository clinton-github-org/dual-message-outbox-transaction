package com.clinton.authorization_server.model;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsClient;

/**
 * @author Clinton Fernandes
 */
@Component
@Profile("polling")
public class SQSClient {

    private final SqsClient sqsClient;

    public SQSClient() {
        this.sqsClient = SqsClient.builder().region(Region.AP_SOUTH_1).build();
    }

    public SqsClient getSqsClient() {
        return this.sqsClient;
    }
}
