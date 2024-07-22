package com.clinton.authorization_server.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

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
    @NotNull
    private String accountName;
    @NotNull
    private String accountType;
    @NotNull
    private BigDecimal accountBalance;

    public Account() {
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

    @Override
    public String toString() {
        return "Account{" +
                "accountNumber=" + accountNumber +
                ", accountName='" + accountName + '\'' +
                ", accountType='" + accountType + '\'' +
                ", accountBalance=" + accountBalance +
                '}';
    }
}
