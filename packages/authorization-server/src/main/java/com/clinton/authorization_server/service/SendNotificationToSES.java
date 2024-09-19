package com.clinton.authorization_server.service;


import com.clinton.authorization_server.model.SESClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SendEmailResponse;

/**
 * @author Clinton Fernandes
 */
@Service
@Profile("auth")
public class SendNotificationToSES {

    private static final Logger LOG = LoggerFactory.getLogger(SendNotificationToSES.class);

    private final SesClient sesClient;

    @Value("${SENDER.EMAIL}")
    private String senderEmail;

    @Autowired
    public SendNotificationToSES(SESClient _sesClient) {
        this.sesClient = _sesClient.getSESClient();
    }

    public void sendNotification(String recipientEmail, String recipientName) {
        LOG.info("Sending notification to " + recipientEmail);

        try {
            String subjectText = "Payment Authorized!";
            String bodyText = "Hello " + recipientName + ",\n\nYour payment has been authorized and will be cleared soon.\n\nThanks and Regards,\n\nClinton Fernandes";

            SendEmailRequest request = SendEmailRequest.builder().source(senderEmail).destination(d -> d.toAddresses(recipientEmail)).message(m -> m.subject(s -> s.data(subjectText)).body(b -> b.text(t -> t.data(bodyText)))).build();

            SendEmailResponse response = sesClient.sendEmail(request);

            LOG.info("Email sent! Message ID: " + response.messageId());
        } catch (Exception e) {
            LOG.error(e.getMessage(), e);
            throw new RuntimeException();
        }
    }
}
