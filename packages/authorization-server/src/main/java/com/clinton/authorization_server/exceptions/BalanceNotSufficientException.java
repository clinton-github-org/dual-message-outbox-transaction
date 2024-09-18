package com.clinton.authorization_server.exceptions;

/**
 * @author Clinton Fernandes
 */
public class BalanceNotSufficientException extends RuntimeException {

    public BalanceNotSufficientException() {
        super("Balance is not sufficient!");
    }
}
