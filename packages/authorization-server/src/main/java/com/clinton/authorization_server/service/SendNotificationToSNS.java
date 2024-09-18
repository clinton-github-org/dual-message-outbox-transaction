package com.clinton.authorization_server.service;


import com.clinton.authorization_server.model.SNSClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;

import java.text.MessageFormat;

/**
 * @author Clinton Fernandes
 */
@Service
@Profile("auth")
public class SendNotificationToSNS {

    private static final Logger LOG = LoggerFactory.getLogger(SendNotificationToSNS.class);

    private final SnsClient snsClient;
    @Value("${NOTIFICATION.TOPIC.ARN}")
    private String snsTopicArn;

    @Autowired
    public SendNotificationToSNS(SNSClient _snsClient) {
        this.snsClient = _snsClient.getSNSClient();
    }

    public void sendNotification(String message, String subject, String phoneNumber) {
        LOG.info("Sending notification to " + phoneNumber);

        PublishRequest request = PublishRequest.builder().message(message).subject(subject).topicArn(snsTopicArn).phoneNumber(phoneNumber).build();
        PublishResponse response = snsClient.publish(request);

        LOG.info(MessageFormat.format("Message sent to {0} with ID {1} and status: {2}", phoneNumber, response.messageId(), response.sdkHttpResponse().statusCode()));
    }
}