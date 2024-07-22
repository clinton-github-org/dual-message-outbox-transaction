package com.clinton.authorization_server.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * @author Clinton Fernandes
 */
@Entity
@Table(name = "auth")
public class Authorization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Size(min = 10, max = 10)
    @Column(length = 10)
    private Integer phoneNumber;
    @NotNull
    private Integer senderAccountId;
    @NotNull
    private Integer receiverAccountId;
    @NotNull
    private BigDecimal amount;
    private String currency;
    private LocalDateTime timestamp;
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "outbox_id", referencedColumnName = "id")
    private Outbox outbox;

    public Authorization() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(Integer phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public Integer getSenderAccountId() {
        return senderAccountId;
    }

    public void setSenderAccountId(Integer senderAccountId) {
        this.senderAccountId = senderAccountId;
    }

    public Integer getReceiverAccountId() {
        return receiverAccountId;
    }

    public void setReceiverAccountId(Integer receiverAccountId) {
        this.receiverAccountId = receiverAccountId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Outbox getOutbox() {
        return outbox;
    }

    public void setOutbox(Outbox outbox) {
        this.outbox = outbox;
    }

    @Override
    public String toString() {
        return "Authorization{" + "id=" + id + ", phoneNumber=" + phoneNumber + ", senderAccountId='" + senderAccountId + '\'' + ", receiverAccountId='" + receiverAccountId + '\'' + ", amount=" + amount + ", currency='" + currency + '\'' + ", timestamp=" + timestamp + ", outbox=" + outbox + '}';
    }
}
