package com.clinton.authorization_server.exceptions;

/**
 * @author Clinton Fernandes
 */
public class AccountNotFoundException extends RuntimeException {

    public AccountNotFoundException(String message) {
        super(message);
    }
}
