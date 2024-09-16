package com.clinton.polling_server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = "com.clinton")
@EnableScheduling
@Profile("polling")
@EnableJpaRepositories(basePackages = {"com.clinton.authorization_server.repository"})
@EntityScan(basePackages = {"com.clinton.authorization_server.model"})
public class PollingApplication {
    public static void main(String[] args) {
        SpringApplication.run(PollingApplication.class, args);
    }

}
