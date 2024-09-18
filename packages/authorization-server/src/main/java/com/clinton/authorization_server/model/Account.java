package com.clinton.authorization_server.model;

import com.clinton.authorization_server.exceptions.BalanceNotSufficientException;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;

/**
 * @author Clinton Fernandes
 */
@Entity
@Table(name = "account")
public class Account {
    @Id()
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer accountNumber;
    @NotEmpty(message = "Account name cannot be empty")
    private String accountName;

    private String accountType;

    private BigDecimal accountBalance;

    private BigDecimal reservedAmount;

    @NotEmpty(message = "Phone number cannot be empty")
    private String phoneNumber;

    public Account() {
    }

    public Account(Integer accountNumber, String accountName, String accountType, BigDecimal accountBalance) {
        this.accountNumber = accountNumber;
        this.accountName = accountName;
        this.accountType = accountType;
        this.accountBalance = accountBalance;
    }

    public String getAccountName() {
        return accountName;
    }

    public void setAccountName(String accountName) {
        this.accountName = accountName;
    }

    public Integer getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(Integer accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getAccountType() {
        return accountType;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }

    public BigDecimal getAccountBalance() {
        return accountBalance;
    }

    public void setAccountBalance(BigDecimal accountBalance) {
        this.accountBalance = accountBalance;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public BigDecimal getReservedAmount() {
        return reservedAmount;
    }

    public void setReservedAmount(BigDecimal reservedAmount) {
        this.reservedAmount = reservedAmount;
    }

    public void creditAccount(BigDecimal amount) {
        this.setAccountBalance(accountBalance.add(amount));
    }

    public void debitAccount(BigDecimal amount) {
        if (accountBalance.subtract(amount).compareTo(BigDecimal.ZERO) >= 0) {
            this.setAccountBalance(accountBalance.subtract(amount));
        } else {
            throw new BalanceNotSufficientException();
        }
    }

    public Boolean sufficientBalance(BigDecimal amount) {
        return ((accountBalance.subtract(reservedAmount)).subtract(amount)).compareTo(BigDecimal.ZERO) >= 0;
    }

    @Override
    public String toString() {
        return "Account{" + "accountNumber=" + accountNumber + ", accountName='" + accountName + '\'' + ", accountType='" + accountType + '\'' + ", accountBalance=" + accountBalance + ", reservedAmount=" + reservedAmount + ", phoneNumber='" + phoneNumber + '\'' + '}';
    }
}
