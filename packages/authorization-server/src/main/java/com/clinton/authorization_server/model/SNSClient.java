package com.clinton.authorization_server.model;


import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

/**
 * @author Clinton Fernandes
 */
@Component
public class SNSClient {

    private final SnsClient snsClient;

    public SNSClient() {
        this.snsClient = SnsClient.builder().region(Region.AP_SOUTH_1).build();
    }

    public SnsClient getSNSClient() {
        return snsClient;
    }
}
