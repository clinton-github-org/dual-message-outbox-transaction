package com.clinton.authorization_server.model;


import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;

/**
 * @author Clinton Fernandes
 */
@Component
public class SESClient {

    private final SesClient sesClient;

    public SESClient() {
        this.sesClient = SesClient.builder().region(Region.AP_SOUTH_1).build();
    }

    public SesClient getSNSClient() {
        return sesClient;
    }
}
